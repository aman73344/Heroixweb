import { NextRequest, NextResponse } from 'next/server';
import { getOrders, addOrder, updateOrder } from '@/lib/orders-store';
import { AdminOrder } from '@/lib/chatbot/admin-store';

interface OrderRequest {
  customer: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  total: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('id');

    const orders = getOrders();

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

    // Validate required fields
    if (!body.customer || !body.email || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const orders = getOrders();
    const orderId = `ORD-${String(orders.length + 1).padStart(3, '0')}`;

    const newOrder: AdminOrder = {
      id: orderId,
      date: new Date().toISOString().split('T')[0],
      customer: body.customer,
      email: body.email,
      phone: body.phone || '',
      address: body.address || '',
      city: body.city || '',
      items: body.items.length,
      total: body.total,
      status: 'pending',
    };

    addOrder(newOrder);

    return NextResponse.json(
      {
        success: true,
        message: 'Order created successfully',
        data: newOrder,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Orders API POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
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
