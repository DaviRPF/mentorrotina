import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    // Check if default calendar exists
    const existingCalendar = await prisma.calendar.findFirst({
      where: { name: 'Meu Calendário' },
    });

    if (existingCalendar) {
      return NextResponse.json({ message: 'Default calendar already exists', calendar: existingCalendar });
    }

    // Create default calendar
    const calendar = await prisma.calendar.create({
      data: {
        name: 'Meu Calendário',
        color: '#3b82f6',
        isVisible: true,
      },
    });

    return NextResponse.json({ message: 'Default calendar created', calendar }, { status: 201 });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Failed to seed database' },
      { status: 500 }
    );
  }
}
