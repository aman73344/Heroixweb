import { NextRequest, NextResponse } from 'next/server';
import { getOrders, updateOrder, AdminOrder } from '@/lib/orders-store';
import { addOrderIdempotent } from '@/lib/orders-store';
import { reserveStock, releaseStock } from '@/lib/db';
import { priceOrderFromDatabase, OrderPricingError } from '@/lib/order-pricing';
import { adminSupabase } from '@/lib/supabase-admin';
import { requireAdminApi } from '@/lib/admin-guard';
import { rateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

interface OrderRequest {
  customer: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  items: {
    productId: string;
    product?: string;
    name?: string;
    variant?: string;
    /** IGNORED - pricing is recomputed server-side. */
    price?: number;
    quantity: number;
  }[];
  /** IGNORED - the total is recomputed server-side. */
  total?: number;
  /** Client-generated UUID that makes the submission idempotent. */
  idempotencyKey?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns a usable order id: the client's idempotency key when it is a valid
 * UUID, otherwise a fresh one. Never derives from Date.now(), which collided
 * whenever two orders landed in the same millisecond.
 */
function normaliseIdempotencyKey(value: unknown): string {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (UUID_RE.test(candidate)) return candidate;
  return crypto.randomUUID();
}

/** Reads a single order by id. Used for the idempotent-replay fast path. */
async function findOrderById(id: string): Promise<AdminOrder | null> {
  const { data, error } = await (adminSupabase as any)
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as AdminOrder;
}


export async function GET(request: NextRequest) {
  // Admin only - the storefront never needs the full order list.
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('id');

    const orders = await getOrders();

    if (orderId) {
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: order });
    }

    return NextResponse.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('Orders API GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // This endpoint is public (customers place orders without an account), so it
  // must be throttled. Without this, anyone could flood the database with
  // orders and inflate the cost of every other request.
  const limited = rateLimit(request, RATE_LIMITS.orders);
  if (!limited.ok) return rateLimitResponse(limited);

  try {
    const body = await request.json() as OrderRequest;

    if (!body.customer || !body.email || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please provide your name, email and at least one item.' },
        { status: 400 }
      );
    }

    const customerName = String(body.customer).trim().slice(0, 120) || 'Guest';
    const customerEmail = String(body.email).trim().toLowerCase().slice(0, 200);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    // ---- IDEMPOTENCY ------------------------------------------------------
    // The client generates one UUID per checkout attempt and sends it back. It
    // becomes the order's primary key, so a double-click, a retry after a
    // timeout, or a refresh-then-resubmit all resolve to the SAME order.
    // A missing or malformed key is simply replaced with a fresh UUID, which
    // still avoids the old Date.now()() collisions.
    const orderId = normaliseIdempotencyKey(body.idempotencyKey);

    // Fast path for a replayed submission: if the order already exists we return
    // it untouched and do NOT reserve stock a second time.
    const existing = await findOrderById(orderId);
    if (existing) {
      // This is the branch a retry actually takes, so it has to report the SAME
      // number the customer was given the first time. Returning the bare row
      // made a retried checkout fall back to the raw UUID, so the customer would
      // see their order change from "1004" to a UUID on a page refresh.
      const existingNumber = existing.order_number ?? null;
      return NextResponse.json(
        {
          success: true,
          message: 'Order already received',
          data: { ...existing, orderNumber: existingNumber },
          orderNumber: existingNumber,
          customerReference: existingNumber != null ? String(existingNumber) : orderId,
          duplicate: true,
        },
        { status: 200 }
      );
    }

    // ---- TRUSTED PRICING ---------------------------------------------------
    // The client's `price` and `total` fields are ignored entirely. Every price
    // below is read from the database, so a tampered total cannot be stored.
    let priced;
    try {
      priced = await priceOrderFromDatabase(
        body.items.map((item) => ({
          productId: item.productId,
          variant: (item as any).variant,
          quantity: item.quantity,
        }))
      );
    } catch (error: any) {
      const status = error instanceof OrderPricingError ? 400 : 503;
      return NextResponse.json(
        { success: false, error: error?.message || 'Could not price your order.' },
        { status }
      );
    }

    // ---- ATOMIC STOCK RESERVATION -----------------------------------------
    // Reserve BEFORE inserting the order. The reservation is atomic, so two
    // customers racing for the last unit cannot both win.
    const reservation = await reserveStock(
      priced.items.map((i) => ({ productId: i.productId, quantity: i.quantity, variant: i.variant }))
    );

    if (!reservation.ok) {
      const details = reservation.failures
        .map((f) => {
          const item = priced.items.find((i) => i.productId === f.productId);
          const label = item ? `"${item.product}"` : 'An item';
          return `${label} has ${f.available} left (you requested ${f.requested})`;
        })
        .join('; ');
      return NextResponse.json(
        { success: false, error: `Insufficient stock: ${details}. Please adjust your cart.` },
        { status: 409 }
      );
    }

    const newOrder: AdminOrder = {
      id: orderId,
      date: new Date().toISOString().split('T')[0],
      customer: customerName,
      email: customerEmail,
      phone: String(body.phone ?? '').slice(0, 40),
      address: String(body.address ?? '').slice(0, 500),
      city: String(body.city ?? '').slice(0, 100),
      items: priced.itemCount,
      total: priced.total,
      status: 'pending',
      items_data: priced.items.map((i) => ({
        product: i.product,
        productId: i.productId,
        variant: i.variant,
        price: i.price,
        quantity: i.quantity,
      })),
    };

    const result = await addOrderIdempotent(newOrder);

    // What the customer is quoted. The short number is display only; `id` stays
    // the UUID and remains the only safe lookup key.
    const customerReference =
      result.orderNumber != null ? String(result.orderNumber) : newOrder.id;

    if (!result.saved) {
      // The order was not stored, so give the reserved stock back. This releases
      // `reservation.reserved` - exactly the lines this call actually decremented
      // - rather than re-deriving them from the request, which would credit back
      // stock for lines that were never taken.
      await releaseStock(reservation.reserved);
      return NextResponse.json(
        { success: false, error: 'We could not save your order. Please try again.' },
        { status: 500 }
      );
    }

    if (result.duplicate) {
      // We lost a race with an identical submission. That order already exists and
      // its own submission reserved the stock, so return the stock we just took.
      await releaseStock(reservation.reserved);
      const stored = await findOrderById(orderId);
      // A replay must report the SAME number the customer was given first time.
      const replayNumber = stored?.order_number ?? result.orderNumber;
      return NextResponse.json(
        {
          success: true,
          message: 'Order already received',
          data: { ...(stored ?? newOrder), orderNumber: replayNumber ?? null },
          orderNumber: replayNumber ?? null,
          duplicate: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Order created successfully',
        data: { ...newOrder, orderNumber: result.orderNumber ?? null },
        orderNumber: result.orderNumber ?? null,
        customerReference,
        duplicate: false,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Orders API POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  // Admin only - customers cannot change order status.
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('id');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    const updated = updateOrder(orderId, { status });
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Orders API PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Admin only - customers cannot delete orders.
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('id');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const { deleteOrder } = await import('@/lib/orders-store');
    const success = await deleteOrder(orderId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Order not found or could not be deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    console.error('Orders API DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}
