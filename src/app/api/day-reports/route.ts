import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
