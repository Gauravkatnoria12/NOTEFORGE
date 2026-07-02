import React, { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, LogOut, CheckSquare, Folder, Star, Search, FileText, Tag, Layers, NotepadText } from 'lucide-react'
import Editor from './Editor'
import TodosWorkspace from './TodosWorkspace'
import { gsap } from 'gsap'

export default function Dashboard({ user, onLogout }) {
  const [notes, setNotes] = useState([])
  const [activeNoteId, setActiveNoteId] = useState(null)
  
  // Workspace Mode toggle: 'notes' or 'todos'
  const [workspaceMode, setWorkspaceMode] = useState('notes')

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState(null)

  const sidebarRef = useRef(null)
  const mainContentRef = useRef(null)

  useEffect(() => {
    fetchNotes()
    
    // Slide in sidebar
    gsap.fromTo(
      sidebarRef.current,
      { x: -60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }
    )
  }, [])

  // Animate main workspace on tab change
  useEffect(() => {
    gsap.fromTo(
      mainContentRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
    )
  }, [workspaceMode])

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes')
      const data = await res.json()
      if (res.ok) {
        setNotes(data)
        if (data.length > 0 && !activeNoteId) {
          setActiveNoteId(data[0].id)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateNote = async () => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Note',
          content: '',
          emoji: '📝',
          font_family: 'sans',
          is_starred: false,
          tags: []
        })
      })
      const data = await res.json()
      if (res.ok) {
        setNotes([data, ...notes])
        setActiveNoteId(data.id)
        setWorkspaceMode('notes') // Auto-switch to notes
        
        // Trigger list item reveal animation
        setTimeout(() => {
          gsap.fromTo(
            `.note-item-${data.id}`,
            { opacity: 0, scale: 0.95 },
            { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }
          )
        }, 50)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveNote = async (id, updatedFields) => {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      })
      const data = await res.json()
      if (res.ok) {
        setNotes(notes.map((n) => (n.id === id ? data : n)))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteNote = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this page?')) return
    
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        const updatedNotes = notes.filter((n) => n.id !== id)
        setNotes(updatedNotes)
        if (activeNoteId === id) {
          setActiveNoteId(updatedNotes.length > 0 ? updatedNotes[0].id : null)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleLogOutSubmit = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      onLogout()
    } catch (e) {
      console.error(e)
    }
  }

  // Handle links clicking to jump to a specific note
  const handleNoteNavigation = (noteId) => {
    setActiveNoteId(noteId)
    setWorkspaceMode('notes')
  }

  // Get active note model
  const activeNote = notes.find((n) => n.id === activeNoteId)

  // Starred notes list
  const starredNotes = notes.filter((n) => n.is_starred)

  // Extract all unique tags across all user notes
  const allTags = Array.from(
    new Set(notes.reduce((acc, note) => [...acc, ...(note.tags || [])], []))
  )

  // Filter notes based on sidebar search query and selected tag
  const filteredNotes = notes.filter((note) => {
    const matchesSearch = 
      (note.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.content || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesTag = selectedTag ? (note.tags || []).includes(selectedTag) : true
    
    return matchesSearch && matchesTag
  })

  return (
    <div className="h-screen w-full flex bg-white dark:bg-[#191919] text-black dark:text-white font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside 
        ref={sidebarRef} 
        className="w-64 md:w-72 border-r border-neutral-100 dark:border-neutral-800 flex flex-col justify-between bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur flex-shrink-0 select-none"
      >
        {/* Workspace Brand Header */}
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="NoteForge Logo" 
                className="w-10 h-10 object-cover rounded-md flex-shrink-0"
              />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider">NoteForge</h2>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-sans tracking-wide truncate max-w-[150px] font-medium">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogOutSubmit}
              title="Logout"
              className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Navigation / Workspace mode toggle */}
        <div className="px-2 py-4 space-y-4 flex-1 overflow-y-auto">
          
          {/* Main Views */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 px-3 block mb-2">
              Workspaces
            </span>
            <button
              onClick={() => setWorkspaceMode('notes')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                workspaceMode === 'notes'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <FileText size={15} className={workspaceMode === 'notes' ? 'text-[#0071e3] dark:text-[#2f97ff]' : ''} />
              <span>Notes Workspace</span>
            </button>
            <button
              onClick={() => setWorkspaceMode('todos')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                workspaceMode === 'todos'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <CheckSquare size={15} className={workspaceMode === 'todos' ? 'text-[#0071e3] dark:text-[#2f97ff]' : ''} />
              <span>Todo Workspace</span>
            </button>
          </div>

          {/* Starred Favorites Section */}
          {starredNotes.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 px-3 block mb-2">
                ★ Favorites
              </span>
              <div className="space-y-0.5">
                {starredNotes.map((fav) => (
                  <div
                    key={fav.id}
                    onClick={() => handleNoteNavigation(fav.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      activeNoteId === fav.id && workspaceMode === 'notes'
                        ? 'bg-neutral-100/60 dark:bg-neutral-800/60 text-black dark:text-white font-semibold'
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded-md bg-neutral-900 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                        <NotepadText size={12} className="text-white" />
                      </div>
                      <Star size={9} className="text-[#00a2b1] fill-[#00a2b1] dark:text-[#e8eb38] dark:fill-[#e8eb38] flex-shrink-0" />
                    </span>
                    <span className="truncate">{fav.title || 'Untitled'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Pages with search and tag filters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-3 border-t border-neutral-100 dark:border-neutral-800/60 pt-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                Notes Pages
              </span>
              <button
                onClick={handleCreateNote}
                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white transition-all cursor-pointer"
                title="Create Note Page"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Note search input */}
            <div className="px-3 relative flex items-center">
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 pl-8 rounded-md bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white placeholder-neutral-400"
              />
              <Search size={12} className="absolute left-5.5 text-neutral-400" />
            </div>

            {/* Note List */}
            <div className="space-y-0.5">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => handleNoteNavigation(note.id)}
                  className={`note-item-${note.id} group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                    activeNoteId === note.id && workspaceMode === 'notes'
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white font-semibold'
                      : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <div className="w-5 h-5 rounded-md bg-neutral-900 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                      <NotepadText size={12} className="text-white" />
                    </div>
                    <span className="truncate">{note.title || 'Untitled'}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteNote(e, note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {filteredNotes.length === 0 && (
                <div className="text-[10px] text-center text-neutral-400 dark:text-neutral-600 font-mono py-4">
                  No matching notes.
                </div>
              )}
            </div>
          </div>

          {/* Tags Filtering Section */}
          {allTags.length > 0 && (
            <div className="space-y-2 border-t border-neutral-100 dark:border-neutral-800/60 pt-4 px-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 block mb-2">
                Filter by Tag
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    selectedTag === null
                      ? 'bg-[#0071e3] text-white border border-[#0071e3]'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white'
                  }`}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                      tag === selectedTag
                        ? 'bg-[#0071e3] text-white border border-[#0071e3]'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <Tag size={10} />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main 
        ref={mainContentRef} 
        className="flex-1 flex flex-col min-w-0"
      >
        {workspaceMode === 'notes' ? (
          <Editor 
            activeNote={activeNote} 
            onSave={handleSaveNote}
            notes={notes}
            onNavigate={handleNoteNavigation}
          />
        ) : (
          <TodosWorkspace 
            activeNoteId={activeNoteId}
          />
        )}
      </main>

    </div>
  )
}
