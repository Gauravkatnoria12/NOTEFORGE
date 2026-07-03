import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Eye, Edit3, Tag, Plus, X, Search, FileText, CheckCircle, NotepadText, Star, Check } from 'lucide-react'

// Notion-style rich link preview card component
function LinkPreviewCard({ url, noteId, activeNote, localPreviews, setLocalPreviews }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 1. Check if we already have it in cached state
    const existing = (activeNote?.link_previews || []).find(p => p.url === url) || localPreviews.find(p => p.url === url)
    if (existing) {
      setPreview(existing)
      return
    }

    // 2. Not cached, trigger backend fetch
    setLoading(true)
    const fetchPreview = async () => {
      try {
        const res = await fetch(`/api/notes/${noteId}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        })
        if (res.ok) {
          const data = await res.json()
          setPreview(data)
          setLocalPreviews(prev => {
            if (prev.some(p => p.url === url)) return prev
            return [...prev, data]
          })
        }
      } catch (e) {
        console.error("Failed to load metadata preview:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchPreview()
  }, [url, noteId, activeNote, localPreviews, setLocalPreviews])

  if (loading) {
    return (
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between border border-neutral-100 dark:border-neutral-800/80 rounded-lg p-3 bg-neutral-50/30 dark:bg-neutral-900/30 max-w-xl my-3 animate-pulse"
      >
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-3 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-2 w-2/3 bg-neutral-100 dark:bg-neutral-800 rounded" />
          <div className="text-[10px] text-neutral-400 mt-1">{url}</div>
        </div>
        <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
      </a>
    )
  }

  if (!preview) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-[#0071e3] dark:text-[#2f97ff] hover:underline font-semibold cursor-pointer mx-0.5 align-middle border-b border-[#0071e3]/20 hover:border-[#0071e3]"
      >
        <span>{url}</span>
        <span className="text-[10px] opacity-70">↗</span>
      </a>
    )
  }

  const { title, description, image, favicon } = preview

  // Safely extract hostname for display
  let hostname = ""
  try {
    hostname = new URL(url).hostname
  } catch (e) {
    hostname = url
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-stretch border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-50/40 hover:bg-neutral-50 dark:bg-neutral-900/30 dark:hover:bg-neutral-900/60 transition-all max-w-xl my-3 group cursor-pointer shadow-xs hover:shadow-sm"
    >
      <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0">
        <div className="min-w-0">
          <div className="font-semibold text-xs md:text-sm text-neutral-800 dark:text-neutral-200 truncate group-hover:text-[#0071e3] dark:group-hover:text-[#2f97ff] transition-colors mb-1">
            {title || url}
          </div>
          {description && (
            <p className="text-neutral-500 dark:text-neutral-400 text-3xs md:text-2xs line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2.5 min-w-0">
          {favicon && (
            <img 
              src={favicon} 
              alt="" 
              className="w-3.5 h-3.5 object-contain rounded flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          )}
          <span className="text-[10px] text-neutral-400 truncate">{hostname}</span>
        </div>
      </div>
      {image && (
        <div className="w-24 md:w-32 bg-neutral-100 dark:bg-neutral-800 flex-shrink-0 relative overflow-hidden border-l border-neutral-200 dark:border-neutral-800">
          <img 
            src={image} 
            alt="" 
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            onError={(e) => { e.target.parentNode.style.display = 'none' }}
          />
        </div>
      )}
    </a>
  )
}

export default function Editor({ activeNote, onSave, notes = [], onNavigate }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [emoji, setEmoji] = useState('📝')
  const [fontFamily, setFontFamily] = useState('sans')
  const [isStarred, setIsStarred] = useState(false)
  const [tags, setTags] = useState([])
  const [newTag, setNewTag] = useState('')

  const [mode, setMode] = useState('edit') // 'edit' or 'preview'
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  // Floating '#' note linker state
  const [showLinker, setShowLinker] = useState(false)
  const [linkerQuery, setLinkerQuery] = useState('')
  const [linkerCoords, setLinkerCoords] = useState({ top: 0, left: 0 })
  const [localPreviews, setLocalPreviews] = useState([])
  
  const textareaRef = useRef(null)
  const lastLoadedNoteIdRef = useRef(null)

  // AI Modal States
  const [showAIModal, setShowAIModal] = useState(false)
  const [activeAITab, setActiveAITab] = useState('title') // 'title' | 'writing'
  const [titleRefText, setTitleRefText] = useState('')
  const [generatedTitle, setGeneratedTitle] = useState('')
  const [writingRefText, setWritingRefText] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')

  // Sync inputs when modal opens
  useEffect(() => {
    if (showAIModal && activeNote) {
      setTitleRefText(content)
      setWritingRefText(content)
      setGeneratedTitle('')
      setGeneratedContent('')
    }
  }, [showAIModal, activeNote])

  // Minimalist emojis
  const EMOJIS = ['📝', '💡', '📅', '🚀', '🎯', '☘️', '🎨', '🔒', '💻', '⚡', '☕', '🧠', '✍️', '💼', '📌']

  // Update editor state when activeNote changes
  useEffect(() => {
    if (activeNote) {
      // Check if we are switching to a completely different note page!
      const prevNoteId = lastLoadedNoteIdRef.current
      const isNoteSwitch = prevNoteId && prevNoteId !== activeNote.id

      if (isNoteSwitch) {
        // Find the previous note's database state to check for unsaved edits
        const prevNote = notes.find((n) => n.id === prevNoteId)
        if (prevNote) {
          const hasChanges =
            title !== (prevNote.title || '') ||
            content !== (prevNote.content || '') ||
            emoji !== (prevNote.emoji || '📝') ||
            fontFamily !== (prevNote.font_family || 'sans') ||
            isStarred !== (prevNote.is_starred || false) ||
            JSON.stringify(tags) !== JSON.stringify(prevNote.tags || [])

          if (hasChanges) {
            onSave(prevNoteId, {
              title,
              content,
              emoji,
              font_family: fontFamily,
              is_starred: isStarred,
              tags
            })
          }
        }
      }

      lastLoadedNoteIdRef.current = activeNote.id

      setTitle(activeNote.title || '')
      setContent(activeNote.content || '')
      setEmoji(activeNote.emoji || '📝')
      setFontFamily(activeNote.font_family || 'sans')
      setIsStarred(activeNote.is_starred || false)
      setTags(activeNote.tags || [])
      
      if (isNoteSwitch) {
        // If it is a new/empty note, start in edit mode, otherwise default to preview mode!
        const isNewNote = !activeNote.content.trim() || activeNote.title === 'Untitled Note'
        setMode(isNewNote ? 'edit' : 'preview')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote, notes])

  const [isSaving, setIsSaving] = useState(false)

  // Memoized check for unsaved changes relative to the database model
  const hasUnsavedChanges = useMemo(() => {
    if (!activeNote) return false
    return (
      title !== (activeNote.title || '') ||
      content !== (activeNote.content || '') ||
      emoji !== (activeNote.emoji || '📝') ||
      fontFamily !== (activeNote.font_family || 'sans') ||
      isStarred !== (activeNote.is_starred || false) ||
      JSON.stringify(tags) !== JSON.stringify(activeNote.tags || [])
    )
  }, [title, content, emoji, fontFamily, isStarred, tags, activeNote])

  // Core manual save function
  const handleManualSave = async () => {
    if (!activeNote || isSaving) return
    setIsSaving(true)
    try {
      await onSave(activeNote.id, {
        title,
        content,
        emoji,
        font_family: fontFamily,
        is_starred: isStarred,
        tags
      })
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  // Ref hook to always let the global event listener call the latest function instance
  const saveCallbackRef = useRef(handleManualSave)
  useEffect(() => {
    saveCallbackRef.current = handleManualSave
  })

  // Keyboard listener for Ctrl+S / Meta+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (saveCallbackRef.current) {
          saveCallbackRef.current()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Ref to hold all current values for the tab-close handler
  const unloadValuesRef = useRef({ title, content, emoji, fontFamily, isStarred, tags, activeNote })
  useEffect(() => {
    unloadValuesRef.current = { title, content, emoji, fontFamily, isStarred, tags, activeNote }
  })

  // Tab closing / page exit auto-save handler
  useEffect(() => {
    const handleBeforeUnload = () => {
      const vals = unloadValuesRef.current
      if (!vals.activeNote) return

      const unsaved =
        vals.title !== (vals.activeNote.title || '') ||
        vals.content !== (vals.activeNote.content || '') ||
        vals.emoji !== (vals.activeNote.emoji || '📝') ||
        vals.fontFamily !== (vals.activeNote.font_family || 'sans') ||
        vals.isStarred !== (vals.activeNote.is_starred || false) ||
        JSON.stringify(vals.tags) !== JSON.stringify(vals.activeNote.tags || [])

      if (unsaved) {
        const payload = {
          title: vals.title,
          content: vals.content,
          emoji: vals.emoji,
          font_family: vals.fontFamily,
          is_starred: vals.isStarred,
          tags: vals.tags
        }

        // Trigger keepalive fetch request to ensure completion after page destruction
        fetch(`/api/notes/${vals.activeNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])



  const getFontClass = () => {
    switch (fontFamily) {
      case 'serif': return 'font-serif'
      case 'mono': return 'font-mono text-sm'
      default: return 'font-sans'
    }
  }

  // Handle keys and '#' note linking triggers
  const handleTextareaChange = (e) => {
    const value = e.target.value
    setContent(value)

    const start = e.target.selectionStart
    const textBefore = value.slice(0, start)
    const words = textBefore.split(/[\s\n]/)
    const lastWord = words[words.length - 1]

    if (lastWord.startsWith('#') && !lastWord.startsWith('#http://') && !lastWord.startsWith('#https://')) {
      const query = lastWord.slice(1)
      setLinkerQuery(query)
      
      // Position linker dropdown roughly below cursor position
      const textarea = e.target
      setLinkerCoords({
        top: textarea.offsetTop + 30,
        left: Math.min(textarea.offsetLeft + 20, textarea.clientWidth - 240)
      })
      setShowLinker(true)
    } else {
      setShowLinker(false)
    }
  }

  const insertNoteLink = (linkedNote) => {
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const value = textarea.value

    // Find index of the starting '#' character
    const beforeLink = value.substring(0, start)
    const lastHashIdx = beforeLink.lastIndexOf('#')
    if (lastHashIdx === -1) return

    const beforeText = value.substring(0, lastHashIdx)
    const afterText = value.substring(start)
    
    // Markdown style note link: [Title](#id)
    const linkStr = `[${linkedNote.title || 'Untitled'}](#${linkedNote.id}) `
    const newContent = beforeText + linkStr + afterText

    setContent(newContent)
    setShowLinker(false)

    setTimeout(() => {
      textarea.focus()
      const newPos = lastHashIdx + linkStr.length
      textarea.setSelectionRange(newPos, newPos)
    }, 50)
  }

  // AI assistant operations
  const handleGenerateTitleAI = async () => {
    if (!titleRefText.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: titleRefText })
      })
      const data = await res.json()
      if (res.ok) {
        setGeneratedTitle(data.title)
      } else {
        alert(data.detail || 'Failed to generate title')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  const handleImproveTextAI = async (endpoint) => {
    if (!writingRefText.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch(`/api/ai/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: writingRefText })
      })
      const data = await res.json()
      if (res.ok) {
        setGeneratedContent(data.improved_content)
      } else {
        alert(data.detail || 'Failed to process text')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  const handleApplyTitle = () => {
    if (generatedTitle) {
      setTitle(generatedTitle)
      setShowAIModal(false)
    }
  }

  const handleApplyContent = () => {
    if (generatedContent) {
      setContent(generatedContent)
      setShowAIModal(false)
    }
  }

  // Tags management
  const saveNewTag = (tagStr) => {
    const clean = tagStr.trim()
    if (!clean) return
    // Split by comma or spaces, filter duplicates, and append
    const splitTags = clean
      .split(/[,\s]+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !tags.includes(t))
    
    if (splitTags.length > 0) {
      setTags([...tags, ...splitTags])
    }
    setNewTag('')
  }

  const handleAddTag = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveNewTag(newTag)
    }
  }

  const handleTagInputChange = (val) => {
    // If the user enters a comma, seal the tag badge immediately
    if (val.endsWith(',')) {
      const tagContent = val.slice(0, -1).trim().toLowerCase()
      if (tagContent && !tags.includes(tagContent)) {
        setTags([...tags, tagContent])
      }
      setNewTag('')
    } else {
      setNewTag(val)
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  // Custom helper to parse inline markdown links (both internal page links and external website links)
  const parseLineContent = (textLine) => {
    const linkRegex = /\[(.*?)\]\((.*?)\)/g
    const elements = []
    let lastIndex = 0
    
    // Helper to auto-link raw URLs in a plain text block
    const parseRawUrls = (plainText, keyPrefix) => {
      // Match optional leading #, followed by URL (no spaces or #), followed by optional trailing #
      const rawUrlRegex = /#?(https?:\/\/[^\s#]+)#?/g
      const parts = []
      let lastRawIdx = 0
      const urlMatches = [...plainText.matchAll(rawUrlRegex)]
      
      if (urlMatches.length === 0) return plainText
      
      urlMatches.forEach((uMatch, uIdx) => {
        const startIdx = uMatch.index
        const textBefore = plainText.substring(lastRawIdx, startIdx)
        const [fullUrlMatch, rawUrl] = uMatch
        
        if (textBefore) parts.push(textBefore)
        
        parts.push(
          <a
            key={`${keyPrefix}-raw-${uIdx}`}
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[#0071e3] dark:text-[#2f97ff] hover:underline font-semibold cursor-pointer mx-0.5 align-middle border-b border-[#0071e3]/20 hover:border-[#0071e3]"
          >
            <span>{fullUrlMatch}</span>
            <span className="text-[10px] opacity-70">↗</span>
          </a>
        )
        lastRawIdx = startIdx + fullUrlMatch.length
      })
      
      const textAfter = plainText.substring(lastRawIdx)
      if (textAfter) parts.push(textAfter)
      return parts
    }

    const matches = [...textLine.matchAll(linkRegex)]
    if (matches.length === 0) {
      return parseRawUrls(textLine, 'plain')
    }
    
    matches.forEach((match, idx) => {
      const startIdx = match.index
      const textBefore = textLine.substring(lastIndex, startIdx)
      const [fullMatch, label, url] = match
      
      if (textBefore) {
        elements.push(parseRawUrls(textBefore, `before-${idx}`))
      }
      
      // Clean URL if it starts with #http or #https
      const isExternalUrl = !url.startsWith('#') || url.startsWith('#http://') || url.startsWith('#https://')
      
      if (!isExternalUrl) {
        // Internal Page Link -> render as a beautiful, interactive card button!
        const noteId = url.substring(1)
        elements.push(
          <button
            key={`int-${idx}`}
            onClick={(e) => {
              e.preventDefault()
              if (onNavigate) onNavigate(noteId)
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800/80 text-[#0071e3] dark:text-[#2f97ff] text-xs font-semibold cursor-pointer transition-all hover:scale-[1.02] shadow-xs align-middle"
          >
            <FileText size={11} className="flex-shrink-0" />
            <span>{label.replace(/^Page:\s*/, '')}</span>
          </button>
        )
      } else {
        // External Web Link -> render as target="_blank"
        const cleanUrl = url.startsWith('#') ? url.substring(1) : url
        elements.push(
          <a
            key={`ext-${idx}`}
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[#0071e3] dark:text-[#2f97ff] hover:underline font-semibold cursor-pointer mx-0.5 align-middle border-b border-[#0071e3]/20 hover:border-[#0071e3]"
          >
            <span>{label}</span>
            <span className="text-[10px] opacity-70">↗</span>
          </a>
        )
      }
      
      lastIndex = startIdx + fullMatch.length
    })
    
    const textAfter = textLine.substring(lastIndex)
    if (textAfter) {
      elements.push(parseRawUrls(textAfter, 'after'))
    }
    
    return elements
  }

  // Custom minimalist markdown parser to render in preview mode
  const renderMarkdownContent = () => {
    const lines = content.split('\n')
    return lines.map((line, idx) => {
      const trimmed = line.trim()

      // Check if the entire line is a raw URL (optionally wrapped in #)
      const urlOnlyMatch = trimmed.match(/^#?(https?:\/\/[^\s#]+)#?$/)
      if (urlOnlyMatch) {
        const url = urlOnlyMatch[1]
        return (
          <LinkPreviewCard 
            key={idx} 
            url={url} 
            noteId={activeNote.id} 
            activeNote={activeNote}
            localPreviews={localPreviews}
            setLocalPreviews={setLocalPreviews}
          />
        )
      }
      
      // H1 Header
      if (trimmed.startsWith('# ')) {
        return <h1 key={idx} className="text-2xl font-bold border-b border-neutral-100 dark:border-neutral-800 pb-2 mt-4 mb-2 text-black dark:text-white">{parseLineContent(trimmed.slice(2))}</h1>
      }
      // H2 Header
      if (trimmed.startsWith('## ')) {
        return <h2 key={idx} className="text-xl font-bold mt-4 mb-2 text-black dark:text-white">{parseLineContent(trimmed.slice(3))}</h2>
      }
      // Quote block
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote key={idx} className="pl-4 border-l-4 border-neutral-300 dark:border-neutral-700 italic my-2 text-neutral-500 dark:text-neutral-400">
            {parseLineContent(trimmed.slice(2))}
          </blockquote>
        )
      }
      // Bullet list
      if (trimmed.startsWith('- ')) {
        return <li key={idx} className="list-disc pl-2 ml-4 my-1">{parseLineContent(trimmed.slice(2))}</li>
      }

      // Empty line spacer
      if (!trimmed) return <div key={idx} className="h-3" />

      return <p key={idx} className="my-1.5 leading-relaxed">{parseLineContent(line)}</p>
    })
  }

  const renderedContent = useMemo(() => {
    return renderMarkdownContent()
  }, [content, activeNote?.link_previews, localPreviews, activeNote?.id])

  // Filter linked note autocomplete options
  const linkerSuggestions = notes.filter((n) => {
    if (n.id === activeNote.id) return false // Don't link to self
    return (n.title || '').toLowerCase().includes(linkerQuery.toLowerCase())
  })

  const handleModeChange = async (newMode) => {
    if (newMode === 'preview' && mode === 'edit' && hasUnsavedChanges) {
      await handleManualSave()
    }
    setMode(newMode)
  }

  if (!activeNote) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-[#191919] select-none">
        <div className="w-16 h-16 opacity-30 dark:invert mb-4">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="20" width="60" height="60" rx="4" stroke="black" strokeWidth="2" fill="none"/>
            <line x1="35" y1="40" x2="65" y2="40" stroke="black" strokeWidth="2" />
            <line x1="35" y1="55" x2="65" y2="55" stroke="black" strokeWidth="2" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-neutral-400">Select Note</h3>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Select a workspace page to begin editing.</p>
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col relative bg-white dark:bg-[#191919] overflow-hidden ${getFontClass()}`}>
      
      {/* Editor Header / Toolbars */}
      <div className="h-18.5 border-b border-neutral-100 dark:border-neutral-800 pl-14 md:pl-6 pr-4 md:pr-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-3 md:gap-4 glass z-20">
        
        {/* Toggle Mode and Font Picker */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Edit / Preview Tabs */}
          <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => handleModeChange('edit')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${mode === 'edit' ? 'bg-white dark:bg-neutral-900 text-black dark:text-white font-semibold shadow-sm' : 'text-neutral-400'}`}
            >
              <Edit3 size={13} />
              <span>Edit</span>
            </button>
            <button
              onClick={() => handleModeChange('preview')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${mode === 'preview' ? 'bg-white dark:bg-neutral-900 text-black dark:text-white font-semibold shadow-sm' : 'text-neutral-400'}`}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>

          {/* Font Selector — hidden on small screens */}
          <div className="hidden sm:flex border border-neutral-100 dark:border-neutral-800 rounded-lg p-1 text-xs">
            {['sans', 'serif', 'mono'].map((f) => (
              <button
                key={f}
                onClick={() => setFontFamily(f)}
                className={`px-2 py-1 rounded transition-all uppercase tracking-wide text-2xs cursor-pointer ${fontFamily === f ? 'bg-neutral-100 dark:bg-neutral-800 font-semibold' : 'text-neutral-400'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Right side actions: Save and AI Assistant */}
        <div className="flex items-center gap-2">
          {/* Manual Save Button */}
          <button
            onClick={handleManualSave}
            disabled={!hasUnsavedChanges || isSaving}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0 cursor-pointer ${
              isSaving
                ? 'bg-neutral-150 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                : hasUnsavedChanges
                  ? 'bg-[#0071e3] hover:bg-[#0077ed] text-white hover:scale-[1.01]'
                  : 'bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                <span>Save</span>
              </>
            ) : (
              <>
                <Check size={13} className="text-neutral-400 dark:text-neutral-500" />
                <span>Saved</span>
              </>
            )}
          </button>

          {/* AI Action Button */}
          <button
            onClick={() => setShowAIModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm flex-shrink-0"
          >
            <span className="text-[13px] leading-none select-none">✦</span>
            <span className="hidden sm:inline">AI Assistant</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-16 py-6 md:py-8 flex flex-col">
        {/* Top Metadata: Starred toggle & Emoji selector */}
        <div className="flex items-center justify-between gap-4 mb-4 select-none">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-neutral-900 dark:bg-neutral-800 flex items-center justify-center shadow-xs">
              <NotepadText size={24} className="text-white" />
            </div>
          </div>

          {/* Star toggle */}
          <button
            onClick={async () => {
              const nextStarred = !isStarred
              setIsStarred(nextStarred)
              if (activeNote) {
                try {
                  await onSave(activeNote.id, {
                    title,
                    content,
                    emoji,
                    font_family: fontFamily,
                    is_starred: nextStarred,
                    tags
                  })
                } catch (err) {
                  console.error(err)
                }
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 hover:bg-neutral-100/80 dark:bg-neutral-900/30 dark:hover:bg-neutral-800/80 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 text-xs font-semibold cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-xs"
          >
            <Star 
              size={13} 
              className={isStarred 
                ? "text-[#00a2b1] fill-[#00a2b1] dark:text-[#64d2ff] dark:fill-[#64d2ff]" 
                : "text-neutral-400 dark:text-neutral-500"
              } 
            />
            <span>{isStarred ? 'Starred' : 'Star'}</span>
          </button>
        </div>

        {/* Title Input */}
        <input
          type="text"
          placeholder="Untitled note"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={mode === 'preview'}
          className="text-3xl md:text-4xl font-bold tracking-tight text-black dark:text-white bg-transparent border-none outline-none mb-4 placeholder-neutral-200 dark:placeholder-neutral-800 focus:ring-0 w-full"
        />

        {/* Tags management bar */}
        <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-neutral-100 dark:border-neutral-800/80 pb-4">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Tag size={13} />
            <span className="text-3xs uppercase font-bold tracking-wider mr-1">Tags:</span>
          </div>

          {tags.map((tag) => (
            <span 
              key={tag}
              className="inline-flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2.5 py-0.5 rounded-full text-xs font-medium"
            >
              <span>{tag}</span>
              {mode === 'edit' && (
                <button 
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-500 transition-colors cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}

          {mode === 'edit' && (
            <div className="flex items-center gap-1 relative pl-1">
              <input
                type="text"
                placeholder="Add tag..."
                value={newTag}
                onChange={(e) => handleTagInputChange(e.target.value)}
                onKeyDown={handleAddTag}
                className="bg-transparent border-none outline-none text-xs focus:ring-0 text-black dark:text-white placeholder-neutral-300 w-20"
              />
              <button
                type="button"
                onClick={() => saveNewTag(newTag)}
                disabled={!newTag.trim()}
                title="Add tag"
                className="p-1 rounded-md text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer disabled:opacity-30 flex items-center justify-center"
              >
                <Plus size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Note Content (Editable Textarea vs Markdown HTML rendering) */}
        <div className="flex-1 relative min-h-[300px]">
          {mode === 'edit' ? (
            <textarea
              ref={textareaRef}
              placeholder="Start writing... Type '#' to link another note page, or use AI tools above."
              value={content}
              onChange={handleTextareaChange}
              className="w-full h-full min-h-[350px] resize-none bg-transparent border-none outline-none text-base leading-relaxed placeholder-neutral-300 dark:placeholder-neutral-700 focus:ring-0 focus:outline-none"
            />
          ) : (
            <div className="prose prose-neutral dark:prose-invert max-w-none text-base leading-relaxed min-h-[350px] text-neutral-800 dark:text-neutral-200">
              {renderedContent}
            </div>
          )}

          {/* Floating `#` internal Note Linker Dropdown */}
          {showLinker && mode === 'edit' && (
            <div 
              style={{ top: `${linkerCoords.top}px`, left: `${linkerCoords.left}px` }}
              className="absolute w-60 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl py-2 z-40 glass"
            >
              <div className="px-3 py-1 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                <span>Link Workspace Page</span>
                <Search size={10} />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {linkerSuggestions.map((linkedNote) => (
                  <button
                    key={linkedNote.id}
                    onClick={() => insertNoteLink(linkedNote)}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-white cursor-pointer"
                  >
                    <div className="w-4 h-4 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                      <NotepadText size={10} className="text-neutral-500 dark:text-neutral-400" />
                    </div>
                    <span className="truncate">{linkedNote.title || 'Untitled note'}</span>
                  </button>
                ))}
                {linkerSuggestions.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-neutral-400 font-sans">
                    No matching pages.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* NoteForge AI Assistant Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-xl w-full shadow-2xl flex flex-col overflow-hidden max-h-[85vh] transition-all scale-100">
            {/* Header */}
            <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[16px] leading-none select-none text-[#0071e3]">✦</span>
                <h3 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider">NoteForge AI Assistant</h3>
              </div>
              <button 
                onClick={() => setShowAIModal(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            
            {/* Tab navigation */}
            <div className="flex border-b border-neutral-100 dark:border-neutral-800 px-5 py-1 gap-4 bg-neutral-50/50 dark:bg-neutral-950/20">
              <button
                type="button"
                onClick={() => setActiveAITab('title')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeAITab === 'title' ? 'border-[#0071e3] text-[#0071e3]' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              >
                Title Assistant
              </button>
              <button
                type="button"
                onClick={() => setActiveAITab('writing')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeAITab === 'writing' ? 'border-[#0071e3] text-[#0071e3]' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              >
                Writing Assistant
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {activeAITab === 'title' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-3xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Reference Context</label>
                    <textarea
                      value={titleRefText}
                      onChange={(e) => setTitleRefText(e.target.value)}
                      placeholder="Paste details or notes to generate a title..."
                      className="w-full h-28 px-3 py-2 text-xs border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-950 text-black dark:text-white focus:outline-none focus:border-[#0071e3] dark:focus:border-[#2f97ff] resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateTitleAI}
                    disabled={aiLoading || !titleRefText.trim()}
                    className="w-full py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {aiLoading ? (
                      <div className="w-4 h-4 border-2 border-neutral-300 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span className="text-[13px] leading-none select-none">✦</span>
                        <span>Generate Suggestion</span>
                      </>
                    )}
                  </button>

                  {generatedTitle && (
                    <div className="space-y-2 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
                      <label className="block text-3xs font-bold uppercase tracking-wider text-neutral-400">AI Suggested Title</label>
                      <input
                        type="text"
                        value={generatedTitle}
                        onChange={(e) => setGeneratedTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-950 text-black dark:text-white focus:outline-none focus:border-[#0071e3]"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-3xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Reference Text</label>
                    <textarea
                      value={writingRefText}
                      onChange={(e) => setWritingRefText(e.target.value)}
                      placeholder="Enter text to polish or grammar check..."
                      className="w-full h-28 px-3 py-2 text-xs border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-950 text-black dark:text-white focus:outline-none focus:border-[#0071e3] dark:focus:border-[#2f97ff] resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleImproveTextAI('fix-grammar')}
                      disabled={aiLoading || !writingRefText.trim()}
                      className="py-2.5 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white transition-all text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-white dark:bg-neutral-950 text-black dark:text-white disabled:opacity-50"
                    >
                      <CheckCircle size={13} className="text-[#34c759]" />
                      <span>Fix Grammar</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleImproveTextAI('improve-content')}
                      disabled={aiLoading || !writingRefText.trim()}
                      className="py-2.5 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white transition-all text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-white dark:bg-neutral-950 text-black dark:text-white disabled:opacity-50"
                    >
                      <span className="text-[13px] leading-none select-none text-[#5856d6]">✦</span>
                      <span>Improve Writing</span>
                    </button>
                  </div>

                  {generatedContent && (
                    <div className="space-y-2 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
                      <label className="block text-3xs font-bold uppercase tracking-wider text-neutral-400">Polished Draft</label>
                      <textarea
                        value={generatedContent}
                        onChange={(e) => setGeneratedContent(e.target.value)}
                        className="w-full h-32 px-3 py-2 text-xs border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-950 text-black dark:text-white focus:outline-none focus:border-[#0071e3] dark:focus:border-[#2f97ff] resize-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 flex items-center justify-end gap-3.5">
              {aiLoading && <div className="w-4 h-4 border-2 border-neutral-300 border-t-[#0071e3] rounded-full animate-spin mr-auto"></div>}
              
              <button
                type="button"
                onClick={() => setShowAIModal(false)}
                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              
              {activeAITab === 'title' ? (
                <button
                  type="button"
                  onClick={handleApplyTitle}
                  disabled={!generatedTitle}
                  className="px-4 py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  Apply Title
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyContent}
                  disabled={!generatedContent}
                  className="px-4 py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  Apply Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}


