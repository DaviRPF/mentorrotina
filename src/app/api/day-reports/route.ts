import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Lista todos os relatórios
export async function GET() {
  try {
    const reports = await prisma.dayReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        daySession: true,
      },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching day reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
