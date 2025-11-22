'use client';

import { Plus, Eye, EyeOff, Trash2, Settings } from 'lucide-react';
import { useState } from 'react';
import { useCalendarStore } from '@/store/calendar-store';
import { MiniCalendar } from './MiniCalendar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { COLORS } from '@/types';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const {
    calendars,
    toggleCalendarVisibility,
    addCalendar,
    removeCalendar,
    setIsEventModalOpen,
    setNewEventStart,
    setNewEventEnd,
  } = useCalendarStore();

  const [isAddCalendarOpen, setIsAddCalendarOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarColor, setNewCalendarColor] = useState(COLORS[0].value);

  const handleCreateEvent = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now);
    end.setHours(end.getHours() + 1);

    setNewEventStart(now);
    setNewEventEnd(end);
    setIsEventModalOpen(true);
  };

  const handleAddCalendar = async () => {
    if (!newCalendarName.trim()) return;

    try {
      const response = await fetch('/api/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCalendarName,
          color: newCalendarColor,
        }),
      });

      if (response.ok) {
        const calendar = await response.json();
        addCalendar(calendar);
        setNewCalendarName('');
        setNewCalendarColor(COLORS[0].value);
        setIsAddCalendarOpen(false);
      }
    } catch (error) {
      console.error('Error creating calendar:', error);
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este calendário? Todos os eventos serão removidos.')) {
      return;
    }

    try {
      const response = await fetch(`/api/calendars/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        removeCalendar(id);
      }
    } catch (error) {
      console.error('Error deleting calendar:', error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4">
          <Button onClick={handleCreateEvent} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Criar evento
          </Button>
        </div>

        <MiniCalendar />

        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Meus calendários
            </h3>
            <button
              onClick={() => setIsAddCalendarOpen(true)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {calendars.map((calendar) => (
              <div
                key={calendar.id}
                className="flex items-center justify-between group py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <button
                  onClick={() => toggleCalendarVisibility(calendar.id)}
                  className="flex items-center gap-2 flex-1"
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center"
                    style={{ backgroundColor: calendar.color }}
                  >
                    {calendar.isVisible && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {calendar.name}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteCalendar(calendar.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
                >
                  <Trash2 className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <Modal
        isOpen={isAddCalendarOpen}
        onClose={() => setIsAddCalendarOpen(false)}
        title="Novo calendário"
      >
        <div className="space-y-4">
          <Input
            label="Nome"
            value={newCalendarName}
            onChange={(e) => setNewCalendarName(e.target.value)}
            placeholder="Nome do calendário"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setNewCalendarColor(color.value)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-transform',
                    newCalendarColor === color.value &&
                      'ring-2 ring-offset-2 ring-gray-400 scale-110'
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsAddCalendarOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleAddCalendar}>Criar</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
