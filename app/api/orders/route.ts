import { NextRequest, NextResponse } from 'next/server';
import { getOrders, addOrder, updateOrder, AdminOrder } from '@/lib/orders-store';

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
    price: number;
    quantity: number;
  }[];
  total: number;
}

export async function GET(request: NextRequest) {
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
  try {
    const body = await request.json() as OrderRequest;

    if (!body.customer || !body.email || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: customer=${body.customer}, email=${body.email}, items=${body.items?.length}` },
        { status: 400 }
      );
    }
    
    const customerName = String(body.customer).trim() || 'Guest';
    const customerEmail = String(body.email).trim();

    const orders = await getOrders();
    const existingIds = new Set(orders.map(o => o.id));
    let orderId = `ORD-${Date.now().toString().slice(-6)}`;
    
    let counter = 0;
    while (existingIds.has(orderId)) {
      counter++;
      orderId = `ORD-${Date.now().toString().slice(-6)}${counter}`;
    }

    const newOrder: AdminOrder = {
      id: orderId,
      date: new Date().toISOString().split('T')[0],
      customer: customerName,
      email: customerEmail,
      phone: body.phone || '',
      address: body.address || '',
      city: body.city || '',
      items: body.items.length,
      total: body.total,
      status: 'pending',
      items_data: body.items.map(item => ({
        product: item.product || item.name || 'Unknown',
        productId: item.productId,
        price: item.price,
        quantity: item.quantity,
      })),
    };

    const saved = await addOrder(newOrder);

    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Database error: RLS policy or connection issue' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Order created successfully',
        data: newOrder,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Orders API POST error:', error);
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
