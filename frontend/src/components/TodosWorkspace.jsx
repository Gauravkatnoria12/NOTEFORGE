import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Calendar, Clock, ChevronDown, ChevronRight, Check, ListChecks } from 'lucide-react'
import confetti from 'canvas-confetti'

export default function TodosWorkspace({ activeNoteId }) {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form input state
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')

  // Accordion state to track which todo cards have their subtasks panel expanded
  const [expandedTodos, setExpandedTodos] = useState({})
  // Track which todos are running AI subtask generation
  const [aiGenerating, setAiGenerating] = useState({})
  
  // Custom subtask input state per todo ID
  const [newSubtaskText, setNewSubtaskText] = useState({})
  
  // Custom date/time picker dropdown state
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  useEffect(() => {
    fetchTodos()
  }, [])

  const fetchTodos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/todos')
      const data = await res.json()
      if (res.ok) {
        setTodos(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTodo = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          completed: false,
          note_id: activeNoteId,
          due_date: dueDate || null,
          due_time: dueTime || null,
          subtasks: []
        })
      })
      const data = await res.json()
      if (res.ok) {
        setTodos([data, ...todos])
        setText('')
        setDueDate('')
        setDueTime('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleTodo = async (todo) => {
    const updatedCompleted = !todo.completed
    
    if (updatedCompleted) {
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.8 },
        colors: ['#000000', '#666666', '#cccccc']
      })
    }

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...todo,
          completed: updatedCompleted
        })
      })
      const data = await res.json()
      if (res.ok) {
        setTodos(todos.map((t) => (t.id === todo.id ? data : t)))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteTodo = async (id) => {
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTodos(todos.filter((t) => t.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Subtask management
  const toggleSubtask = async (todo, index) => {
    const updatedSubtasks = [...todo.subtasks]
    updatedSubtasks[index].completed = !updatedSubtasks[index].completed

    // Confetti if all subtasks are finished
    const allFinished = updatedSubtasks.every(s => s.completed)
    if (allFinished && updatedSubtasks[index].completed) {
      confetti({ particleCount: 30, spread: 30, colors: ['#ffffff', '#000000'] })
    }

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...todo,
          subtasks: updatedSubtasks
        })
      })
      const data = await res.json()
      if (res.ok) {
        setTodos(todos.map((t) => (t.id === todo.id ? data : t)))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddSubtask = async (todo, subtaskText) => {
    if (!subtaskText.trim()) return
    const updatedSubtasks = [...todo.subtasks, { text: subtaskText, completed: false }]

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...todo,
          subtasks: updatedSubtasks
        })
      })
      const data = await res.json()
      if (res.ok) {
        setTodos(todos.map((t) => (t.id === todo.id ? data : t)))
        setNewSubtaskText({ ...newSubtaskText, [todo.id]: '' })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteSubtask = async (todo, index) => {
    const updatedSubtasks = todo.subtasks.filter((_, i) => i !== index)
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...todo,
          subtasks: updatedSubtasks
        })
      })
      const data = await res.json()
      if (res.ok) {
        setTodos(todos.map((t) => (t.id === todo.id ? data : t)))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Trigger Gemini AI subtask suggestions
  const handleGenerateSubtasks = async (todo) => {
    setAiGenerating({ ...aiGenerating, [todo.id]: true })
    try {
      const res = await fetch('/api/ai/todo-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todo_text: todo.text })
      })
      const data = await res.json()
      if (res.ok) {
        // Map list of strings to subtask structures
        const aiSubtasks = data.subtasks.map((txt) => ({ text: txt, completed: false }))
        const updatedSubtasks = [...todo.subtasks, ...aiSubtasks]

        // Update database
        const putRes = await fetch(`/api/todos/${todo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...todo,
            subtasks: updatedSubtasks
          })
        })
        const updatedTodo = await putRes.json()
        if (putRes.ok) {
          setTodos(todos.map((t) => (t.id === todo.id ? updatedTodo : t)))
          setExpandedTodos({ ...expandedTodos, [todo.id]: true }) // Auto-expand panel
        }
      } else {
        alert(data.detail || 'Failed to generate subtasks.')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAiGenerating({ ...aiGenerating, [todo.id]: false })
    }
  }

  const toggleExpand = (id) => {
    setExpandedTodos({ ...expandedTodos, [id]: !expandedTodos[id] })
  }

  // Grouping logic
  const getTodayStr = () => new Date().toISOString().split('T')[0]
  const getTomorrowStr = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const getGroupedTodos = () => {
    const today = getTodayStr()
    const tomorrow = getTomorrowStr()

    const overdue = []
    const dueToday = []
    const dueTomorrow = []
    const upcoming = []
    const noDate = []

    todos.forEach((todo) => {
      if (todo.completed) {
        noDate.push(todo) // Render completed separately or inside noDate
        return
      }

      if (!todo.due_date) {
        noDate.push(todo)
      } else if (todo.due_date < today) {
        overdue.push(todo)
      } else if (todo.due_date === today) {
        dueToday.push(todo)
      } else if (todo.due_date === tomorrow) {
        dueTomorrow.push(todo)
      } else {
        upcoming.push(todo)
      }
    })

    // Sort completed tasks to the bottom of the "No Date" list
    noDate.sort((a, b) => a.completed - b.completed)

    return { overdue, dueToday, dueTomorrow, upcoming, noDate }
  }

  const groups = getGroupedTodos()

  // Helper formatting for dates
  const formatDateBadge = (dateStr, timeStr) => {
    if (!dateStr) return null
    const parts = dateStr.split('-')
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2])
    const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const timeLabel = timeStr ? ` at ${timeStr}` : ''
    return `${label}${timeLabel}`
  }

  const renderTodoCard = (todo) => {
    const isExpanded = expandedTodos[todo.id]
    const isGenerating = aiGenerating[todo.id]
    const currentSubtaskText = newSubtaskText[todo.id] || ''

    return (
      <div 
        key={todo.id} 
        className={`group border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-900 shadow-sm transition-all duration-300 hover:shadow-md ${todo.completed ? 'opacity-65' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Custom Checkbox */}
            <button
              onClick={() => handleToggleTodo(todo)}
              className="mt-1 flex-shrink-0 cursor-pointer"
            >
              {todo.completed ? (
                <div className="w-5 h-5 rounded-md bg-[#0071e3] text-white flex items-center justify-center">
                  <Check size={13} strokeWidth={3} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-md border-2 border-neutral-300 dark:border-neutral-700 hover:border-[#0071e3] dark:hover:border-[#2f97ff] transition-colors" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium break-words leading-snug ${todo.completed ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'}`}>
                {todo.text}
              </p>
              
              {/* Due Date Badge */}
              {todo.due_date && (
                <span className={`inline-flex items-center gap-1.5 mt-5 px-3 py-2 rounded-md text-[12px] font-medium whitespace-nowrap ${
                  todo.completed 
                    ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500' 
                    : todo.due_date < getTodayStr()
                      ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-950 font-semibold'
                      : 'bg-blue-50/50 text-[#0071e3] border border-blue-100/30 dark:bg-blue-950/10 dark:text-[#2f97ff] dark:border-blue-900/30'
                }`}>
                  <Calendar size={10} />
                  {formatDateBadge(todo.due_date, todo.due_time)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* AI Subtask Generator */}
            <button
              onClick={() => handleGenerateSubtasks(todo)}
              disabled={todo.completed || isGenerating}
              title="Generate Subtasks with AI"
              className="p-1.5 rounded-md text-neutral-400 hover:text-[#5856d6] dark:hover:text-[#5d5cde] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-30 cursor-pointer"
            >
              <span className={`text-[14px] px-1 py-0.5 leading-none select-none ${isGenerating ? 'animate-pulse text-[#5856d6] dark:text-[#5d5cde]' : ''}`}>✦</span>
            </button>
            
            {/* Delete */}
            <button
              onClick={() => handleDeleteTodo(todo.id)}
              title="Delete Task"
              className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>

            {/* Expand Arrow */}
            <button
              onClick={() => toggleExpand(todo.id)}
              className="p-1.5 rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        {/* Nested Subtask Panel */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800/60 space-y-3">
            <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-neutral-400">
              <ListChecks size={11} />
              <span>Subtasks Checklist</span>
            </div>

            {/* Subtasks List */}
            <div className="space-y-2">
              {todo.subtasks.map((sub, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 pl-1 select-none">
                  <div 
                    onClick={() => toggleSubtask(todo, idx)}
                    className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                  >
                    <button className="flex-shrink-0 cursor-pointer">
                      {sub.completed ? (
                        <div className="w-4 h-4 rounded bg-neutral-800 dark:bg-neutral-200 text-white dark:text-black flex items-center justify-center">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded border-2 border-neutral-300 dark:border-neutral-700" />
                      )}
                    </button>
                    <span className={`text-xs break-all ${sub.completed ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-300'}`}>
                      {sub.text}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteSubtask(todo, idx)}
                    className="text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Custom Subtask Form */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Add subtask..."
                value={currentSubtaskText}
                onChange={(e) => setNewSubtaskText({ ...newSubtaskText, [todo.id]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddSubtask(todo, currentSubtaskText)
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
              />
              <button
                onClick={() => handleAddSubtask(todo, currentSubtaskText)}
                disabled={!currentSubtaskText.trim()}
                className="px-3 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-black dark:text-white disabled:opacity-40 text-xs font-semibold cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderGroupSection = (title, items, borderClass = '') => {
    if (items.length === 0) return null
    return (
      <div className={`space-y-4 ${borderClass}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 pl-1">
          {title} ({items.length})
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(renderTodoCard)}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative bg-white dark:bg-[#191919]">
      {/* Pinned Top Header Bar */}
      <div className="pl-14 md:pl-16 pr-4 md:pr-16 pt-6 md:pt-8 pb-5 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-[#191919] flex-shrink-0 z-20 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black dark:text-white mb-2">
            Todo Workspace
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Manage your schedule, deadlines, and task checklist steps.
          </p>
        </div>

        {/* Add Task Form Bar */}
        <form 
          onSubmit={handleAddTodo}
          className="w-full border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-neutral-50/50 dark:bg-neutral-900/30 backdrop-blur flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
        <div className="flex-1">
          <input
            type="text"
            required
            placeholder="Write a new task..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Due Date Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowDatePicker(!showDatePicker)
                setShowTimePicker(false)
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-neutral-600 dark:text-neutral-400 hover:border-black dark:hover:border-white transition-all cursor-pointer select-none font-medium"
            >
              <Calendar size={14} />
              <span>{dueDate ? formatDateBadge(dueDate, '') : 'No Date'}</span>
            </button>
            
            {showDatePicker && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl py-1.5 z-50 glass">
                <button
                  type="button"
                  onClick={() => { setDueDate(''); setShowDatePicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer"
                >
                  Clear Date
                </button>
                <button
                  type="button"
                  onClick={() => { setDueDate(getTodayStr()); setShowDatePicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer font-semibold"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => { setDueDate(getTomorrowStr()); setShowDatePicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer font-semibold"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextWeek = new Date()
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    setDueDate(nextWeek.toISOString().split('T')[0])
                    setShowDatePicker(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer"
                >
                  Next Week
                </button>
                <div className="border-t border-neutral-100 dark:border-neutral-800/80 my-1"></div>
                <div className="px-3 py-1.5">
                  <label className="block text-4xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Custom Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded p-1 text-black dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Due Time Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTimePicker(!showTimePicker)
                setShowDatePicker(false)
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-neutral-600 dark:text-neutral-400 hover:border-black dark:hover:border-white transition-all cursor-pointer select-none font-medium"
            >
              <Clock size={14} />
              <span>{dueTime ? dueTime : 'No Time'}</span>
            </button>

            {showTimePicker && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl py-1.5 z-50 glass">
                <button
                  type="button"
                  onClick={() => { setDueTime(''); setShowTimePicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer"
                >
                  Clear Time
                </button>
                <button
                  type="button"
                  onClick={() => { setDueTime('09:00'); setShowTimePicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer"
                >
                  Morning (9:00 AM)
                </button>
                <button
                  type="button"
                  onClick={() => { setDueTime('12:00'); setShowTimePicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer"
                >
                  Noon (12:00 PM)
                </button>
                <button
                  type="button"
                  onClick={() => { setDueTime('15:00'); setShowTimePicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer"
                >
                  Afternoon (3:00 PM)
                </button>
                <button
                  type="button"
                  onClick={() => { setDueTime('18:00'); setShowTimePicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer"
                >
                  Evening (6:00 PM)
                </button>
                <div className="border-t border-neutral-100 dark:border-neutral-800/80 my-1"></div>
                <div className="px-3 py-1.5">
                  <label className="block text-4xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Custom Time</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded p-1 text-black dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="px-5 py-2.5 rounded-lg bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer flex-shrink-0 border border-[#0071e3]"
          >
            <Plus size={14} />
            <span>Add Task</span>
          </button>
        </div>
      </form>
      </div>

      {/* Scrollable Grouped Todos Layout */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-16 py-6 md:py-8">
        {loading && todos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-black dark:border-neutral-700 dark:border-t-white rounded-full animate-spin"></div>
          </div>
        ) : todos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl my-10 bg-neutral-50/20">
            <div className="w-12 h-12 opacity-30 dark:invert mb-4">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="30" stroke="black" strokeWidth="2" />
                <path d="M40 50 L47 57 L60 43" stroke="black" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-neutral-400">All caught up!</h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-[200px] mt-1">
              Create a task using the bar above to start planning your workflow.
            </p>
          </div>
        ) : (
          <div className="space-y-10 pb-20">
            {/* Group 1: Overdue */}
            {renderGroupSection('⚠️ Overdue Tasks', groups.overdue)}

            {/* Group 2: Today */}
            {renderGroupSection('📅 Due Today', groups.dueToday)}

            {/* Group 3: Tomorrow */}
            {renderGroupSection('🌅 Tomorrow', groups.dueTomorrow)}

            {/* Group 4: Upcoming */}
            {renderGroupSection('💫 Upcoming Schedule', groups.upcoming)}

            {/* Group 5: No Date / Completed */}
            {renderGroupSection('📄 General Checklist / Completed', groups.noDate)}
          </div>
        )}
      </div>
    </div>
  )
}
