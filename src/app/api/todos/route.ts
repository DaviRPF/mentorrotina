import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parseDeadline, calculatePriority } from '@/lib/parse-deadline';

const prisma = new PrismaClient();

// GET /api/todos - List all todos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const includePast = searchParams.get('includePast') === 'true';

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    // By default, exclude completed/cancelled unless specified
    if (!status) {
      where.status = { in: ['pending', 'scheduled'] };
    }

    const todos = await prisma.todo.findMany({
      where,
      orderBy: [
        { deadline: 'asc' },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Update priorities based on current time
    const updatedTodos = todos.map(todo => ({
      ...todo,
      priority: todo.deadline ? calculatePriority(todo.deadline) : todo.priority,
    }));

    return NextResponse.json(updatedTodos);
  } catch (error) {
    console.error('Error fetching todos:', error);
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 });
  }
}

// POST /api/todos - Create new todo
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, estimatedMinutes } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Parse deadline from content
    const { deadline, priority, cleanContent } = parseDeadline(content);

    const todo = await prisma.todo.create({
      data: {
        content: cleanContent,
        deadline,
        priority,
        estimatedMinutes: estimatedMinutes || null,
        status: 'pending',
      },
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error('Error creating todo:', error);
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
  }
}
