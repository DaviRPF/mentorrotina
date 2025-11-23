import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - List all book references
export async function GET() {
  try {
    const books = await prisma.bookReference.findMany({
      where: { userSettingsId: 'default' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      books.map(b => ({
        id: b.id,
        title: b.title,
        topics: b.topics,
        enabled: b.enabled,
      }))
    );
  } catch (error) {
    console.error('Error fetching book references:', error);
    return NextResponse.json(
      { error: 'Failed to fetch book references' },
      { status: 500 }
    );
  }
}

// POST - Create a new book reference
export async function POST(request: NextRequest) {
  try {
    const { title, topics } = await request.json();

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Ensure default settings exists
    await prisma.userSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    const book = await prisma.bookReference.create({
      data: {
        title,
        topics: topics || '',
        userSettingsId: 'default',
      },
    });

    return NextResponse.json({
      id: book.id,
      title: book.title,
      topics: book.topics,
      enabled: book.enabled,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating book reference:', error);
    return NextResponse.json(
      { error: 'Failed to create book reference' },
      { status: 500 }
    );
  }
}
