import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const calendars = await prisma.calendar.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(calendars);
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendars' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const calendar = await prisma.calendar.create({
      data: {
        name,
        color: color || '#3b82f6',
      },
    });

    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    console.error('Error creating calendar:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar' },
      { status: 500 }
    );
  }
}
