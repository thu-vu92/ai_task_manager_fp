import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Plus, FileText, Clock, AlertCircle, CheckCircle2, Trash2, Upload, Pencil, CalendarIcon, Settings, ChevronDown, ChevronRight, Menu } from 'lucide-react'
import { Calendar } from 'lucide-react';
import './App.css'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useRef } from 'react';

function App() {
  // For editing tasks
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editFields, setEditFields] = useState({ title: '', description: '', estimatedTime: '', deadline: '', projectId: null })

  // For AI extraction status
  const [extractionStatus, setExtractionStatus] = useState('idle'); // 'idle'|'loading'|'success'|'error'

  // Tasks
  const [tasks, setTasks] = useState([]);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'important-not-urgent',
    estimatedTime: '',
    source: 'Manual entry',
    deadline: '',
    projectId: null // Add projectId to newTask
  })

  const [documentText, setDocumentText] = useState('')

  // New state for screenshot upload
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [ocrText, setOcrText] = useState('');

  const [addSuccess, setAddSuccess] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState(false);
  const [extractFail, setExtractFail] = useState(false);

  // Daily Priority and Project Management
  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState({
    name: '',
    priority: 'medium',
    description: ''
  });
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editProjectFields, setEditProjectFields] = useState({ name: '', description: '', priority: 'medium' });

  const priorityColors = {
    'urgent-important': 'bg-red-500 text-white',
    'important-not-urgent': 'bg-blue-500 text-white',
    'urgent-not-important': 'bg-yellow-500 text-black',
    'not-urgent-not-important': 'bg-gray-500 text-white'
  }

  const priorityLabels = {
    'urgent-important': 'Urgent & Important',
    'important-not-urgent': 'Important, Not Urgent',
    'urgent-not-important': 'Urgent, Not Important',
    'not-urgent-not-important': 'Neither Urgent nor Important'
  }

  // Add a mapping for border color classes by priority
  const priorityBorderColors = {
    'urgent-important': 'border-l-red-500',
    'important-not-urgent': 'border-l-blue-500',
    'urgent-not-important': 'border-l-yellow-500',
    'not-urgent-not-important': 'border-l-gray-500',
  };

  // Add a mapping for badge background and text color classes by priority
  const priorityTitleStyles = {
    'urgent-important': 'bg-red-100 text-red-700',
    'important-not-urgent': 'bg-blue-100 text-blue-700',
    'urgent-not-important': 'bg-yellow-100 text-yellow-700',
    'not-urgent-not-important': 'bg-gray-100 text-gray-700',
  };

  // Add state for modal
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [modalPriority, setModalPriority] = useState('important-not-urgent');

  // Add state for task details modal
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [modalEditFields, setModalEditFields] = useState({ 
    title: '', 
    description: '', 
    estimatedTime: '', 
    deadline: '', 
    projectId: null 
  });

  // Add state for LLM configuration
  const [selectedModel, setSelectedModel] = useState('mistral');
  const [showConfig, setShowConfig] = useState(false);

  // Available LLM models
  const availableModels = [
    { id: 'mistral', name: 'Mistral', description: 'Fast and efficient general-purpose model' },
    { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B', description: 'Advanced reasoning model with 14B parameters' },
    { id: 'llama3.2', name: 'Llama 3.2', description: 'Meta\'s latest open-source language model' }
  ];

  // Handle double-click on task card to show details
  const handleTaskDoubleClick = (task) => {
    setSelectedTask(task);
    setShowTaskDetailsModal(true);
  };

  // Close task details modal
  const closeTaskDetailsModal = () => {
    setShowTaskDetailsModal(false);
    setSelectedTask(null);
    setIsEditingInModal(false);
    setModalEditFields({ title: '', description: '', estimatedTime: '', deadline: '', projectId: null });
  };

  // Start editing in modal
  const startEditingInModal = () => {
    setModalEditFields({
      title: selectedTask.title,
      description: selectedTask.description || '',
      estimatedTime: selectedTask.estimatedTime,
      deadline: selectedTask.deadline || '',
      projectId: selectedTask.projectId || null
    });
    setIsEditingInModal(true);
  };

  // Save modal edits
  const saveModalEdit = async () => {
    const updatedTask = {
      ...selectedTask,
      title: modalEditFields.title,
      description: modalEditFields.description,
      estimatedTime: modalEditFields.estimatedTime,
      deadline: modalEditFields.deadline,
      projectId: modalEditFields.projectId || null
    };
    
    const res = await fetch(`/api/tasks/${selectedTask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTask)
    });
    const savedTask = await res.json();
    setTasks(tasks.map(task => task.id === selectedTask.id ? savedTask : task));
    setSelectedTask(savedTask);
    setIsEditingInModal(false);
  };

  // Cancel modal edit
  const cancelModalEdit = () => {
    setIsEditingInModal(false);
    setModalEditFields({ title: '', description: '', estimatedTime: '', deadline: '', projectId: null });
  };

  // Helper function to format date for display
  const formatDate = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date; // Keep existing string dates as-is
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // Fetch tasks and projects from backend on load
  useEffect(() => {
    const fetchData = async () => {
      const [tasksRes, projectsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/projects')
      ]);
      const tasksData = await tasksRes.json();
      const projectsData = await projectsRes.json();
      setTasks(tasksData);
      setProjects(projectsData);
    };
    fetchData();
  }, []);

  const addTask = async () => {
    if (newTask.title.trim()) {
      try {
        console.log('Adding task:', newTask, 'with priority:', modalPriority);
        const taskData = {
          ...newTask,
          priority: modalPriority,
          completed: false
        };
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const createdTask = await res.json();
        console.log('Task created successfully:', createdTask);
        setTasks([...tasks, createdTask]);
        setNewTask({
          title: '',
          description: '',
          priority: 'important-not-urgent',
          estimatedTime: '',
          source: 'Manual entry',
          deadline: '',
          projectId: null
        });
        setShowAddTaskModal(false);
        setAddSuccess(true);
        setTimeout(() => setAddSuccess(false), 2000);
      } catch (error) {
        console.error('Error adding task:', error);
        // Close modal even if there's an error
        setShowAddTaskModal(false);
        alert('Failed to add task: ' + error.message);
      }
    } else {
      console.log('Task title is empty, not adding');
      // Close modal if title is empty
      setShowAddTaskModal(false);
    }
  };

  const toggleTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const updatedTask = { ...task, completed: !task.completed };
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTask)
    });
    const savedTask = await res.json();
    setTasks(tasks.map(t => t.id === id ? savedTask : t));
  };

  const deleteTask = async (id) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(tasks.filter(task => task.id !== id));
  };


  const extractTasksFromText = async () => {
    if (!documentText.trim()) return;
  
    let attempts = 0;
    let success = false;
    setExtractionStatus('loading');
    setExtractFail(false);
    
    console.log('Starting AI extraction with text:', documentText.trim());
    
    while (attempts < 3 && !success) {
      attempts++;
      console.log(`AI Extract attempt ${attempts}/3`);
      
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            prompt: `Extract tasks from this text. For each task, determine priority using these rules and examples:
           
           CRITICAL RULE: Any task with a deadline within 3 days (today, tomorrow, or next 2 days) MUST be classified as URGENT regardless of complexity or importance.
           
           IMPORTANT: For the "description" field, include ALL exact details, actions, requirements, specifications, context, and relevant information from the original text. Be comprehensive and preserve all important details that relate to completing the task.
           
           URGENT-IMPORTANT (urgent-important):
           - Complex tasks: "Write research paper", "Plan team strategy meeting", "Complete project proposal"
           - Critical deadlines: "Submit final report by Friday", "Submit tax return by 2025-10-15", "Prepare presentation for board meeting"
           - High-stakes tasks: "Review contract before signing", "Fix critical bug in production"
           - ANY task with deadline within 3 days from the moment of extraction that is also important
           
           IMPORTANT-NOT-URGENT (important-not-urgent):
           - Long-term planning: "Plan next quarter goals", "Research new technologies"
           - Skill development: "Learn new programming language", "Read industry reports"
           - Relationship building: "Schedule coffee with colleague", "Network at industry events"
           - Important tasks with deadlines beyond 3 days from the moment of extraction
           
           URGENT-NOT-IMPORTANT (urgent-not-important):
           - Simple urgent tasks: "Buy milk today", "Pick up dry cleaning", "Pay utility bill"
           - Quick errands: "Get gas", "Buy groceries", "Return library books"
           - Minor deadlines: "Submit expense report", "RSVP to party"
           - ANY task with deadline within 3 days from the moment of extraction that is not particularly important
           
           NOT-URGENT-NOT-IMPORTANT (not-urgent-not-important):
           - Trivial tasks: "Organize desk", "Watch TV", "Browse social media"
           - Optional activities: "Try new restaurant", "Read fiction book"
           - Tasks with no deadline or deadlines far in the future
           
           Consider: Task complexity, deadline proximity (ESPECIALLY within 3 days), and impact on goals.
           
           DESCRIPTION REQUIREMENTS:
           - Include specific actions to be taken
           - Preserve exact requirements, specifications, or criteria mentioned
           - Include relevant context, background information, or reasons
           - Mention specific people, places, tools, or resources involved
           - Include any constraints, preferences, or special instructions
           - Preserve numbers, quantities, measurements, or technical details
           - Include any preparatory steps or dependencies mentioned
           
           DEADLINE REQUIREMENTS:
           - If a specific deadline is mentioned in the text, convert it to the format "Mon DD, YYYY" (e.g., "Sep 23, 2025", "Dec 15, 2024")
           - Use 3-letter month abbreviations: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
           - If only a relative date is given (e.g., "tomorrow", "next Friday"), convert it to the actual date in the same format
           - If NO deadline is mentioned, leave the "deadline" field as an empty string ""
           - Do NOT use "None" or any placeholder text for missing deadlines
           
           Return only JSON array of task objects with properties: "title" (string), "description" (string), "priority" (string), "estimatedTime" (string), "deadline". Text: """${documentText.trim()}"""`,
            format: 'json',
            stream: false
          })
        });
        
        if (!response.ok) throw new Error(`LLM Error: ${response.status} - ${response.statusText}`);
        const result = await response.json();
        console.log('AI response received:', result);
        
        let parsedTasks;
        try {
          parsedTasks = typeof result.response === 'string'
            ? JSON.parse(result.response)
            : result.response;
            
          // Handle different response structures
          if (parsedTasks.tasks && Array.isArray(parsedTasks.tasks)) {
            // If response has a 'tasks' property
            parsedTasks = parsedTasks.tasks;
          } else if (!Array.isArray(parsedTasks)) {
            parsedTasks = [parsedTasks];
          }
          
          // Normalize task properties (handle task_name vs title)
          parsedTasks = parsedTasks.map(task => ({
            title: task.title || task.task_name || 'Untitled Task',
            description: task.description || 'No description',
            priority: task.priority || 'important-not-urgent',
            estimatedTime: task.estimatedTime || task.estimated_time || 'None',
            deadline: task.deadline || 'None'
          }));
          
          console.log('Parsed tasks:', parsedTasks);
        } catch (jsonErr) {
          console.error('Failed to parse result.response as JSON:', result.response);
          throw new Error('The AI did not return a valid JSON array or object.');
        }
        
        // Check if at least one valid task with title and description
        const validTasks = parsedTasks.filter(task => {
          const hasTitle = task.title && task.title.trim().length > 0;
          const hasDescription = task.description && task.description.trim().length > 0;
          console.log('Checking task validity:', { task, hasTitle, hasDescription });
          return hasTitle || hasDescription; // Allow tasks with either title OR description (more lenient)
        });
        console.log('Valid tasks found:', validTasks);
        
        if (validTasks.length > 0) {
          // Save each task to the backend database
          const savedTasks = [];
          for (const task of validTasks) {
            const taskData = {
              title: task.title || task.task_name || 'AI Generated Task',
              description: task.description || task.title || task.task_name || 'Generated from AI extraction',
              priority: (task.priority || 'important-not-urgent').toLowerCase(),
              estimatedTime: task.estimatedTime || task.estimated_time || 'None',
              source: 'AI Extraction',
              deadline: task.deadline || 'None',
              completed: false,
              projectId: null
            };
            
            console.log('Saving task to database:', taskData);
            
            try {
              const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
              });
              if (res.ok) {
                const savedTask = await res.json();
                console.log('Task saved successfully:', savedTask);
                savedTasks.push(savedTask);
              } else {
                console.error('Failed to save task, status:', res.status);
              }
            } catch (error) {
              console.error('Error saving extracted task:', error);
            }
          }
          
          // Update local state with saved tasks
          if (savedTasks.length > 0) {
            console.log('Updating UI with saved tasks:', savedTasks);
            
            // Force refresh from database to ensure UI sync
            try {
              const response = await fetch('/api/tasks');
              if (response.ok) {
                const allTasks = await response.json();
                console.log('Refreshed tasks from database:', allTasks);
                setTasks(allTasks);
              } else {
                // Fallback to local state update
                setTasks(prev => {
                  const newTasks = [...prev, ...savedTasks];
                  console.log('Fallback: New tasks state:', newTasks);
                  return newTasks;
                });
              }
            } catch (error) {
              console.error('Error refreshing tasks:', error);
              // Fallback to local state update
              setTasks(prev => {
                const newTasks = [...prev, ...savedTasks];
                console.log('Error fallback: New tasks state:', newTasks);
                return newTasks;
              });
            }
            
            setDocumentText('');
            setExtractionStatus('success');
            setExtractSuccess(true);
            setTimeout(() => setExtractSuccess(false), 2000);
            setExtractFail(false);
            success = true;
          } else {
            throw new Error('Failed to save extracted tasks to database');
          }
        } else {
          if (attempts >= 3) {
            setExtractionStatus('error');
            setExtractFail(true);
            setTimeout(() => setExtractFail(false), 2500);
          }
        }
      } catch (error) {
        console.error('Error during AI extraction attempt:', attempts, error);
        if (attempts >= 3) {
          setExtractionStatus('error');
          setExtractFail(true);
          setTimeout(() => setExtractFail(false), 2500);
        }
      }
    }
    console.log(`AI Extract: Extraction attempts: ${attempts}`);
  };
  

  const getTasksByPriority = (priority) => {
    return tasks.filter(task => task.priority === priority)
  }

  //Handling editing tasks - now opens modal in edit mode
  const handleEditClick = (task) => {
    setSelectedTask(task);
    setModalEditFields({
      title: task.title,
      description: task.description || '',
      estimatedTime: task.estimatedTime,
      deadline: task.deadline || '',
      projectId: task.projectId || null
    });
    setIsEditingInModal(true);
    setShowTaskDetailsModal(true);
  }
  
  const saveEdit = async (taskId) => {
    const updatedTask = {
      ...tasks.find(task => task.id === taskId),
      title: editFields.title,
      description: editFields.description,
      estimatedTime: editFields.estimatedTime,
      deadline: editFields.deadline,
      projectId: editFields.projectId || null
    };
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTask)
    });
    const savedTask = await res.json();
    setTasks(tasks.map(task => task.id === taskId ? savedTask : task));
    setEditingTaskId(null);
  };
  
  const cancelEdit = () => {
    setEditingTaskId(null)
    setEditFields({ title: '', description: '', estimatedTime: '', deadline: '', projectId: null })
  }

  // Handling file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
  
    try {
      setExtractionStatus('loading');
  
      const formData = new FormData();
      formData.append('file', file);
  
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData
      });
  
      if (!response.ok) throw new Error(`Vision model error: ${response.statusText}`);
  
      const result = await response.json();
  
      let parsedTasks;
      try {
        parsedTasks = typeof result.response === 'string'
          ? JSON.parse(result.response)
          : result.response;
  
        if (!Array.isArray(parsedTasks)) {
          parsedTasks = [parsedTasks];
        }
        
      } catch (jsonErr) {
        console.error('Failed to parse vision model result:', result.response);
        throw new Error('The AI did not return valid task data.');
      }
  
      const extractedTasks = parsedTasks.map((task, index) => ({
        id: `${Date.now()}-${index}`,
        title: task.title || 'Untitled Task',
        description: task.description || 'No description',
        priority: task.priority || 'important-not-urgent',
        estimatedTime: task.estimatedTime || '30 minutes',
        source: 'Vision Upload',
        completed: false,
        projectId: null // Add projectId to extracted tasks
      }));
  
      setTasks(prev => [...prev, ...extractedTasks]);
      setExtractionStatus('success');
  
    } catch (error) {
      setExtractionStatus('error');
      console.error('File upload failed:', error.message);
      alert('Task extraction from uploaded file failed: ' + error.message);
    }
  };
  
  // Handle screenshot upload and OCR
  const handleScreenshotUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setScreenshotFile(file);
    setExtractionStatus('loading');
    try {
      const formData = new FormData();
      formData.append('screenshot', file);
      const response = await fetch('/api/ocr-extract', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('OCR failed');
      const result = await response.json();
      setOcrText(result.text);
      setDocumentText(result.text); // Auto-fill document text for extraction
      setExtractionStatus('idle');
    } catch (err) {
      setExtractionStatus('error');
      alert('Screenshot OCR failed: ' + err.message);
    }
  };
  
  // Helper: get all priorities in order
  const priorityOrder = [
    'urgent-important',
    'important-not-urgent',
    'urgent-not-important',
    'not-urgent-not-important',
  ];

  // Project priority levels
  const projectPriorities = {
    high: { label: 'High Priority', color: 'bg-red-500 text-white' },
    medium: { label: 'Medium Priority', color: 'bg-yellow-500 text-black' },
    low: { label: 'Low Priority', color: 'bg-green-500 text-white' }
  };

  // Add project function
  const addProject = async () => {
    if (newProject.name.trim()) {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      });
      const createdProject = await res.json();
      setProjects([...projects, createdProject]);
      setNewProject({ name: '', priority: 'medium', description: '' });
      setShowProjectForm(false);
    }
  };

  // Show project form and scroll to it
  const showAddProjectForm = () => {
    setShowProjectForm(true);
    // Scroll to the project form after a short delay to ensure it's rendered
    setTimeout(() => {
      const projectFormElement = document.getElementById('add-project-form');
      if (projectFormElement) {
        projectFormElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Edit project functions
  const handleEditProject = (project) => {
    setEditingProjectId(project.id);
    setEditProjectFields({ name: project.name, description: project.description, priority: project.priority });
    // Scroll to the project after a short delay to ensure the edit form is rendered
    setTimeout(() => {
      const projectElement = document.getElementById(`project-${project.id}`);
      if (projectElement) {
        projectElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const saveProjectEdit = async () => {
    if (editProjectFields.name.trim()) {
      const res = await fetch(`/api/projects/${editingProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProjectFields)
      });
      const updatedProject = await res.json();
      setProjects(projects.map(project => project.id === editingProjectId ? updatedProject : project));
      setEditingProjectId(null);
      setEditProjectFields({ name: '', description: '', priority: 'medium' });
    }
  };

  const cancelProjectEdit = () => {
    setEditingProjectId(null);
    setEditProjectFields({ name: '', description: '', priority: 'medium' });
  };

  const deleteProject = async (projectId) => {
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    setProjects(projects.filter(project => project.id !== projectId));
    // Remove project tags from tasks
    setTasks(tasks.map(task =>
      task.projectId === String(projectId) ? { ...task, projectId: null } : task
    ));
  };

  // Helper function to convert deadline to date input format (YYYY-MM-DD)
  const convertDeadlineToDateInput = (dateStr) => {
    if (!dateStr || dateStr === '' || dateStr === 'None') return '';
    
    // If it's already in YYYY-MM-DD format, return as is
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    // Handle formats like "Sep 23, 2025", "Dec 15, 2024", etc.
    const monthAbbr = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
      'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const dateMatch = dateStr.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
    if (dateMatch) {
      const [_, month, day, year] = dateMatch;
      const monthNum = monthAbbr[month];
      if (monthNum) {
        const dayPadded = day.padStart(2, '0');
        return `${year}-${monthNum}-${dayPadded}`;
      }
    }
    
    // Try to parse other date formats with JavaScript Date constructor
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        // Convert to YYYY-MM-DD format for date input
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.log('Error parsing date:', dateStr, error);
    }
    
    return '';
  };

  // Helper function to convert relative dates to specific dates
  const convertRelativeDateToSpecific = (dateStr) => {
    if (!dateStr || dateStr === 'None') return dateStr;
    
    const today = new Date();
    const dateStrLower = dateStr.toLowerCase().trim();
    
    // Handle "today"
    if (dateStrLower.includes('today') || dateStrLower.includes('now')) {
      return today.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // Handle "tomorrow"
    if (dateStrLower.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // Handle "next [day of week]"
    const dayMatch = dateStrLower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (dayMatch) {
      const targetDay = dayMatch[1];
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIndex = daysOfWeek.indexOf(targetDay);
      const currentDayIndex = today.getDay();
      
      let daysToAdd = targetDayIndex - currentDayIndex;
      if (daysToAdd <= 0) daysToAdd += 7; // Next week
      
      const nextDay = new Date(today);
      nextDay.setDate(today.getDate() + daysToAdd);
      return nextDay.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // Handle "this week" or "next week"
    if (dateStrLower.includes('this week')) {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
      return endOfWeek.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    if (dateStrLower.includes('next week')) {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return nextWeek.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // Handle date picker format (YYYY-MM-DD)
    const datePickerMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
    if (datePickerMatch) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // If it's already a specific date format, return as is
    return dateStr;
  };

  // Get daily priority tasks based on project priorities
  const getDailyPriorityTasks = () => {
    const highPriorityProjects = projects.filter(p => p.priority === 'high');
    const highPriorityProjectIds = highPriorityProjects.map(p => String(p.id));
    
    // Helper function to check if task has a short deadline (within 3 days)
    const hasShortDeadline = (task) => {
      if (!task.deadline || task.deadline === 'None') return false;
      
      // Convert relative dates to specific dates first
      const specificDate = convertRelativeDateToSpecific(task.deadline);
      const deadlineStr = specificDate.toLowerCase();
      const today = new Date();
      
      // Try to parse actual dates
      const dateMatch = deadlineStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/);
      if (dateMatch) {
        const [_, day, month, year] = dateMatch;
        const deadlineDate = new Date(year || today.getFullYear(), month - 1, day);
        const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 3 && diffDays >= 0;
      }
      
      // Try to parse month names (e.g., "Dec 15")
      const monthMatch = deadlineStr.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i);
      if (monthMatch) {
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthIndex = months.indexOf(monthMatch[1].toLowerCase());
        const day = parseInt(monthMatch[2]);
        const deadlineDate = new Date(today.getFullYear(), monthIndex, day);
        
        // If the date has passed this year, assume next year
        if (deadlineDate < today) {
          deadlineDate.setFullYear(today.getFullYear() + 1);
        }
        
        const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 3 && diffDays >= 0;
      }
      
      return false;
    };
    
    // Helper function to check if task belongs to high-priority project
    const belongsToHighPriorityProject = (task) => {
      return task.projectId && highPriorityProjectIds.includes(String(task.projectId));
    };
    
    // Filter and sort tasks by priority
    const priorityTasks = tasks.filter(task => {
      return task.priority === 'urgent-important' ||
             hasShortDeadline(task) ||
             belongsToHighPriorityProject(task);
    });
    
    // Helper function to parse deadline into a Date object for sorting
    const parseDeadlineToDate = (task) => {
      if (!task.deadline || task.deadline === 'None' || task.deadline === '') return null;
      
      const specificDate = convertRelativeDateToSpecific(task.deadline);
      const deadlineStr = specificDate.toLowerCase();
      const today = new Date();
      
      // Try to parse actual dates (MM/DD/YYYY or DD/MM/YYYY)
      const dateMatch = deadlineStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/);
      if (dateMatch) {
        const [_, day, month, year] = dateMatch;
        return new Date(year || today.getFullYear(), month - 1, day);
      }
      
      // Try to parse month names (e.g., "Dec 15, 2025")
      const monthMatch = deadlineStr.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s*(\d{4})?/i);
      if (monthMatch) {
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthIndex = months.indexOf(monthMatch[1].toLowerCase());
        const day = parseInt(monthMatch[2]);
        const year = monthMatch[3] ? parseInt(monthMatch[3]) : today.getFullYear();
        const deadlineDate = new Date(year, monthIndex, day);
        
        // If the date has passed this year and no year was specified, assume next year
        if (!monthMatch[3] && deadlineDate < today) {
          deadlineDate.setFullYear(today.getFullYear() + 1);
        }
        
        return deadlineDate;
      }
      
      // Handle YYYY-MM-DD format
      const isoMatch = specificDate.match(/^\d{4}-\d{2}-\d{2}$/);
      if (isoMatch) {
        return new Date(specificDate);
      }
      
      return null;
    };

    // Sort by priority and deadline: urgent-important first, then by deadline (ascending), then high-priority projects
    priorityTasks.sort((a, b) => {
      const aUrgent = a.priority === 'urgent-important';
      const bUrgent = b.priority === 'urgent-important';
      const aDeadline = hasShortDeadline(a);
      const bDeadline = hasShortDeadline(b);
      const aHighProject = belongsToHighPriorityProject(a);
      const bHighProject = belongsToHighPriorityProject(b);
      
      // Urgent tasks first
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      
      // Then deadline-based tasks
      if (aDeadline && !bDeadline) return -1;
      if (!aDeadline && bDeadline) return 1;
      
      // Then high-priority project tasks
      if (aHighProject && !bHighProject) return -1;
      if (!aHighProject && bHighProject) return 1;
      
      // Within the same priority group, sort by deadline (ascending - nearest first)
      const aDate = parseDeadlineToDate(a);
      const bDate = parseDeadlineToDate(b);
      
      // Tasks with deadlines come before tasks without deadlines
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      
      // Both have deadlines - sort by date (ascending)
      if (aDate && bDate) {
        return aDate.getTime() - bDate.getTime();
      }
      
      return 0;
    });
    
    return priorityTasks.slice(0, 5); // Top 5 priority tasks
  };

  // Drag and drop handler
  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    // Only handle cross-priority moves
    const sourcePriority = source.droppableId;
    const destPriority = destination.droppableId;
    if (sourcePriority === destPriority) return;
    
    // Find the task that was moved
    const movedTask = tasks.find(task => String(task.id) === draggableId);
    if (!movedTask) return;
    
    try {
      // Update the task in the backend with the new priority
      const updatedTask = { ...movedTask, priority: destPriority };
      const res = await fetch(`/api/tasks/${movedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask)
      });
      
      if (!res.ok) {
        throw new Error(`Failed to update task priority: ${res.status}`);
      }
      
      const savedTask = await res.json();
      
      // Update local state with the response from backend
      setTasks(tasks => tasks.map(task =>
        task.id === movedTask.id ? savedTask : task
      ));
      
      console.log('Task priority updated successfully:', savedTask);
    } catch (error) {
      console.error('Error updating task priority:', error);
      // Revert the UI change if backend update failed
      alert('Failed to update task priority: ' + error.message);
    }
  };

  // Voice input state and handlers
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const handleVoiceToText = () => {
    console.log('Voice recognition support:', browserSupportsSpeechRecognition);
    if (!browserSupportsSpeechRecognition) {
      alert('Your browser does not support speech recognition.');
      return;
    }
    if (listening) {
      console.log('Stopping voice recognition...');
      SpeechRecognition.stopListening();
      // Automatically populate the document text with the transcript
      if (transcript) {
        setDocumentText(transcript);
        resetTranscript();
      }
    } else {
      console.log('Starting voice recognition...');
      resetTranscript();
      SpeechRecognition.startListening({ 
        continuous: true, 
        language: 'en-US',
        interimResults: true 
      });
    }
  };

  // Add a handler to update a task's projectId
  const updateTaskProject = async (taskId, projectId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedTask = { ...task, projectId: projectId === 'none' ? null : Number(projectId) };
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTask)
    });
    const savedTask = await res.json();
    setTasks(tasks.map(t => t.id === taskId ? savedTask : t));
  };

  // Add function to open modal with specific priority
  const openAddTaskModal = (priority) => {
    setModalPriority(priority);
    setShowAddTaskModal(true);
  };

  // Ref for screenshot input
  const screenshotInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleScreenshotButtonClick = () => {
    if (screenshotInputRef.current) {
      screenshotInputRef.current.click();
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      // Process the dropped image file using the same logic as handleScreenshotUpload
      setScreenshotFile(imageFile);
      setExtractionStatus('loading');
      try {
        const formData = new FormData();
        formData.append('screenshot', imageFile);
        const response = await fetch('/api/ocr-extract', {
          method: 'POST',
          body: formData
        });
        if (!response.ok) throw new Error('OCR failed');
        const result = await response.json();
        setOcrText(result.text);
        setDocumentText(result.text); // Auto-fill document text for extraction
        setExtractionStatus('idle');
      } catch (err) {
        setExtractionStatus('error');
        alert('Screenshot OCR failed: ' + err.message);
      }
    } else {
      alert('Please drop an image file.');
    }
  };

  return (
    <div
      className="min-h-screen p-4"
      style={{
        backgroundImage: 'url("/src/assets/background_watercolor.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className={`max-w-7xl mx-auto transition-all duration-300 ease-in-out ${showConfig ? 'ml-80' : ''}`}>
        <header className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="text-white hover:text-gray-200 hover:bg-white/10 flex items-center gap-2"
            >
              <Menu className="w-4 h-4" />
              Config
            </Button>
            <div className="flex-1"></div>
          </div>
          <h1 className="text-4xl font-bold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] mb-2">AI Task Manager</h1>
          <p className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">Smart task management with AI-powered extraction and prioritization</p>
        </header>

        {/* Configuration Panel - Sliding Sidebar */}
        <div className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          showConfig ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-6 h-full overflow-y-auto">
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-3 px-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="w-4 h-4" />
                    Configuration
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfig(false)}
                    className="h-6 w-6 p-0 text-gray-600 hover:text-gray-900"
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-0">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">AI Model</label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                                              <SelectContent>
                          {availableModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <span className="font-medium text-sm">{model.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 bg-green-50 p-2 rounded">
                    <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>
                    <div className="flex flex-col">
                      <span className="font-medium">Active:</span>
                      <span>{availableModels.find(m => m.id === selectedModel)?.name}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>



        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Dashboard - Center */}
          <div className="lg:col-span-2">
            {/* Today's Priority Tasks */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Today's Priority Tasks</CardTitle>
                <CardDescription>
                  Based on your project priorities and urgent tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                                    {getDailyPriorityTasks().length > 0 ? (
                    getDailyPriorityTasks().map(task => (
                      <div 
                        key={task.id} 
                        className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 cursor-pointer hover:shadow-sm transition-shadow"
                        onDoubleClick={() => handleTaskDoubleClick(task)}
                      >
                        <div className="flex-1">
                          <h3 className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {task.title}
                          </h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge className={priorityColors[task.priority]}>
{priorityLabels[task.priority]}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {task.estimatedTime && task.estimatedTime !== 'None' ? task.estimatedTime : 'None'}
                            </span>
                            {task.deadline && task.deadline !== 'None' && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {convertRelativeDateToSpecific(task.deadline)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTask(task.id);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <CheckCircle2 className={`w-4 h-4 ${task.completed ? 'text-green-600' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No priority tasks for today.</p>
                      <p className="text-sm">Add high-priority projects or urgent tasks to see suggestions.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Task Dashboard */}
            <Card>
              <CardHeader>
                <CardTitle>Task Dashboard</CardTitle>
                <CardDescription>
                  Organize and manage your tasks by priority using drag and drop
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {priorityOrder.map(priority => (
                  <Card key={priority}
                    className="shadow-md border border-gray-200 rounded-xl"
                    style={{
                      backgroundColor: '#f9f7f3',
                      backgroundImage: 'url("/src/assets/paper-texture.png")',
                      backgroundRepeat: 'repeat',
                      backgroundSize: 'auto',
                      backgroundBlendMode: 'multiply',
                    }}
                  >
                <CardHeader className="pb-2">
                      <CardTitle>
                        <span className={`inline-block px-3 py-1 rounded-full font-semibold text-sm shadow-sm ${priorityTitleStyles[priority]}`}>
                          {priorityLabels[priority]}
                        </span>
                      </CardTitle>
                </CardHeader>
                <CardContent>
                      <Droppable droppableId={priority}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`space-y-2 min-h-[40px] ${snapshot.isDraggingOver ? 'bg-indigo-50' : ''}`}
                          >
                            {getTasksByPriority(priority).map((task, idx) => (
                              <Draggable key={task.id} draggableId={String(task.id)} index={idx}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    id={`task-${task.id}`}
                                    className={`p-2 rounded flex items-center justify-between bg-white shadow-sm border-l-4 ${priorityBorderColors[task.priority]}`}
                                    style={{ ...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.7 : 1 }}
                                    onDoubleClick={() => handleTaskDoubleClick(task)}
                                  >
                          <div className="flex-1">
                            {editingTaskId === task.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={editFields.title}
                                  onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
                                  placeholder="Edit title"
                                />
                                          <Textarea
                                            value={editFields.description}
                                            onChange={(e) => setEditFields({ ...editFields, description: e.target.value })}
                                            placeholder="Edit description"
                                            rows={2}
                                />
                                <Input
                                  value={editFields.estimatedTime}
                                  onChange={(e) => setEditFields({ ...editFields, estimatedTime: e.target.value })}
                                  placeholder="Edit estimated time"
                                />
                                <div className="space-y-2">
                                  <label className="text-xs text-gray-600">Deadline</label>
                                  <input
                                    type="date"
                                    value={convertDeadlineToDateInput(editFields.deadline)}
                                    onChange={(e) => setEditFields({ ...editFields, deadline: e.target.value })}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                </div>
                                <Select 
                                  value={editFields.projectId ? String(editFields.projectId) : 'none'} 
                                  onValueChange={(value) => setEditFields({...editFields, projectId: value === 'none' ? null : Number(value)})}
                                >
                                  <SelectTrigger className="text-xs">
                                    <SelectValue placeholder="Choose project" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No Project</SelectItem>
                                    {projects.map(project => (
                                      <SelectItem key={project.id} value={String(project.id)}>
                                        <div className="flex items-center gap-2">
                                          <span>{project.name}</span>
                                          <Badge className={`${projectPriorities[project.priority]?.color || 'bg-gray-400'} text-xs`}>
                                            {projectPriorities[project.priority]?.label || project.priority}
                                          </Badge>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex gap-2 mt-1">
                                  <Button size="sm" onClick={() => saveEdit(task.id)}>Save</Button>
                                  <Button size="sm" variant="secondary" onClick={cancelEdit}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h4 className={`text-sm font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>
                                  {task.title}
                                </h4>
                                          <p className="text-xs text-gray-600 flex items-center mt-1 gap-2">
                                            <span className="flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                              {task.estimatedTime && task.estimatedTime !== 'None' ? task.estimatedTime : 'None'}
                                            </span>
                                            {task.deadline && task.deadline !== 'None' && (
                                              <span className="flex items-center">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                {convertRelativeDateToSpecific(task.deadline)}
                                              </span>
                                            )}
                                          </p>
                                          {/* Project Badge Display Only */}
                                          {task.projectId && (
                                            <div className="mt-1">
                                              <Badge className={`${projects.find(p => String(p.id) === String(task.projectId))?.color || 'bg-blue-100 text-blue-700'} text-xs`}> 
                                                {projects.find(p => String(p.id) === String(task.projectId))?.name || 'Unknown Project'}
                                              </Badge>
                                            </div>
                                          )}
                              </>
                            )}
                          </div>
                                    <div className="flex flex-col space-y-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleTask(task.id)}
                                        className="h-5 w-5 p-0"
                                        title="Mark as complete"
                            >
                                        <CheckCircle2 className={`w-3 h-3 ${task.completed ? 'text-green-600' : 'text-gray-400'}`} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditClick(task)}
                                        className="h-5 w-5 p-0"
                                        title="Edit task"
                            >
                                        <Pencil className="w-3 h-3 text-blue-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteTask(task.id)}
                                        className="h-5 w-5 p-0 text-red-500"
                                        title="Delete task"
                            >
                                        <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openAddTaskModal(priority)}
                              className="w-full h-8 border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                            >
                              <Plus className="w-4 h-4 text-gray-400" />
                            </Button>
                  </div>
                        )}
                      </Droppable>
                </CardContent>
              </Card>
                ))}
                  </div>
                </DragDropContext>
              </CardContent>
            </Card>

            {/* Project Management */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Projects</CardTitle>
                <CardDescription>
                  Manage your projects and their priority levels
                </CardDescription>
                </CardHeader>
                <CardContent>
                <div className="space-y-4">
                  {/* Project List */}
                  <div className="space-y-2">
                    {projects.map(project => (
                      <div key={project.id} id={`project-${project.id}`} className="flex items-center justify-between p-3 border rounded-lg">
                        {editingProjectId === project.id ? (
                          <div className="flex-1 space-y-2">
                                <Input
                              value={editProjectFields.name}
                              onChange={(e) => setEditProjectFields({ ...editProjectFields, name: e.target.value })}
                              placeholder="Project name"
                            />
                            <Textarea
                              value={editProjectFields.description}
                              onChange={(e) => setEditProjectFields({ ...editProjectFields, description: e.target.value })}
                              placeholder="Project description"
                              rows={2}
                            />
                            <Select value={editProjectFields.priority} onValueChange={(value) => setEditProjectFields({ ...editProjectFields, priority: value })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High Priority</SelectItem>
                                <SelectItem value="medium">Medium Priority</SelectItem>
                                <SelectItem value="low">Low Priority</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex space-x-2">
                              <Button size="sm" onClick={saveProjectEdit}>Save</Button>
                              <Button size="sm" variant="outline" onClick={cancelProjectEdit}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                          <div className="flex-1">
                            <h3 className="font-medium">{project.name}</h3>
                            <p className="text-sm text-gray-600">{project.description}</p>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          {editingProjectId !== project.id && (
                            <>
                              <Badge className={projectPriorities[project.priority].color}>
                                {projectPriorities[project.priority].label}
                              </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                                onClick={() => handleEditProject(project)}
                              className="h-6 w-6 p-0"
                            >
                                <Pencil className="w-3 h-3 text-blue-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                                onClick={() => deleteProject(project.id)}
                              className="h-6 w-6 p-0 text-red-500"
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Project Form */}
                  {showProjectForm ? (
                    <div id="add-project-form" className="space-y-3 p-4 border rounded-lg bg-gray-50">
                      <div>
                        <label className="text-sm font-medium">Project Name</label>
                                <Input
                          placeholder="Enter project name..."
                          value={newProject.name}
                          onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                          placeholder="Enter project description..."
                          value={newProject.description}
                          onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                          rows={2}
                        />
                                </div>
                      <div>
                        <label className="text-sm font-medium">Priority Level</label>
                        <Select value={newProject.priority} onValueChange={(value) => setNewProject({...newProject, priority: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High Priority</SelectItem>
                            <SelectItem value="medium">Medium Priority</SelectItem>
                            <SelectItem value="low">Low Priority</SelectItem>
                          </SelectContent>
                        </Select>
                              </div>
                      <div className="flex space-x-2">
                        <Button onClick={addProject} className="flex-1">
                          Add Project
                            </Button>
                        <Button variant="outline" onClick={() => setShowProjectForm(false)} className="flex-1">
                          Cancel
                            </Button>
                          </div>
                        </div>
                  ) : (
                    <Button onClick={showAddProjectForm} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Project
                    </Button>
                  )}
                  </div>
                </CardContent>
              </Card>
            </div>

          {/* Right Sidebar - Task Creation Tools */}
          <div className="space-y-6">
            {/* AI Extract */}
            <Card>
              <CardHeader>
                <CardTitle>AI Task Extraction</CardTitle>
                <CardDescription>
                  Extract tasks from text, voice, or screenshots
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Voice input section */}
                <div className="mb-2">
                  <label className="text-sm font-medium">Voice Input</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      type="button"
                      variant={listening ? 'secondary' : 'outline'}
                      onClick={handleVoiceToText}
                      className="w-full justify-center"
                    >
                      {listening ? (
                        <>
                          <span className="animate-pulse mr-2">⏹️</span>
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <span className="mr-2">🎤</span>
                          Start Recording
                        </>
                      )}  
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-gray-700 bg-gray-100 rounded p-2 min-h-[2rem]">
                    {!browserSupportsSpeechRecognition && (
                      <div className="text-red-600 mb-2">
                        ⚠️ Your browser doesn't support speech recognition. Try Chrome or Edge.
                      </div>
                    )}
                    {listening ? (
                      <div className="flex items-center">
                        <span className="animate-pulse mr-2">🎤</span>
                        {transcript ? `Listening: ${transcript}` : 'Listening... Speak now'}
                      </div>
                    ) : (
                      transcript ? transcript : 'No voice input yet. Click "Start Voice Input" to begin recording.'
                    )}
                  </div>
                  <div className="mt-2 w-full">
                    <label className="text-sm font-medium">Image Input</label>
                    <div 
                      className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                        isDragOver 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <Upload className="w-8 h-8 text-gray-400" />
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Drop an image here</span> or{' '}
                          <button 
                            type="button"
                            className="text-blue-600 hover:text-blue-800 underline"
                            onClick={handleScreenshotButtonClick}
                          >
                            browse files
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, JPEG up to 10MB</p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      ref={screenshotInputRef}
                      onChange={handleScreenshotUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium"> Text Input (or from Voice Input or Screenshot OCR)</label>
                  <Textarea
                    placeholder="Paste your document text here or upload a screenshot..."
                    value={documentText}
                    onChange={(e) => setDocumentText(e.target.value)}
                    rows={6}
                  />
                </div>
                      <Button
                  onClick={extractTasksFromText} 
                  className="w-full mt-2"
                  disabled={extractionStatus === 'loading'}
                >
                  {extractionStatus === 'loading' ? (
                    <span>Extracting... <span className="ml-2 animate-spin">⏳</span></span>
                  ) : (
                    <>Extract Tasks with AI</>
                  )}
                      </Button>
                {extractFail && (
                  <div className="mt-3 p-3 bg-red-100 text-red-800 rounded-md text-center font-medium shadow">
                    Failed to extract and add tasks. Please check your input and try again.
                    </div>
                )}
                {extractSuccess && (
                  <div className="mt-3 p-3 bg-green-100 text-green-800 rounded-md text-center font-medium shadow">
                    Tasks have been successfully extracted and added
                  </div>
                )}
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                  <strong>How it works:</strong> The AI will analyze your text or screenshot and identify potential tasks, estimate priority level and completion time. NOTE: AI can make mistakes, please check the extracted tasks carefully.
                </div>
              </CardContent>
            </Card>

            {/* Add Task Modal */}
            {showAddTaskModal && (
              <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
                {/* Blur and darken layer */}
                <div className="absolute inset-0 pointer-events-none" style={{backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.30)'}} />
                <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Add New Task</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddTaskModal(false)}
                      className="h-6 w-6 p-0"
                    >
                      ✕
                    </Button>
                  </div>
                  <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Task Title</label>
                  <Input
                    placeholder="Enter task title..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Enter task description..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  />
                </div>
                <div>
                      <label className="text-sm font-medium">Priority</label>
                      <div className="text-sm text-gray-600 mb-2">
                        {priorityLabels[modalPriority]}
                      </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Estimated Time</label>
                  <Input
                    placeholder="e.g., 2 hours, 30 minutes..."
                    value={newTask.estimatedTime}
                    onChange={(e) => setNewTask({...newTask, estimatedTime: e.target.value})}
                  />
                </div>
                <div>
                      <label className="text-sm font-medium">Deadline</label>
                      <Input
                        placeholder="e.g., 2024-07-31 or 'Next Monday'"
                        value={newTask.deadline}
                        onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Project (Optional)</label>
                  <Select 
                    value={newTask.projectId ? String(newTask.projectId) : 'none'} 
                    onValueChange={(value) => setNewTask({...newTask, projectId: value === 'none' ? null : Number(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a project or leave unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Project</SelectItem>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={String(project.id)}>
                          <div className="flex items-center gap-2">
                            <span>{project.name}</span>
                            <Badge className={`${projectPriorities[project.priority]?.color || 'bg-gray-400'} text-xs`}>
                              {projectPriorities[project.priority]?.label || project.priority}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex space-x-2">
                      <Button type="button" onClick={addTask} className="flex-1">
                        Add Task
                  </Button>
                      <Button variant="outline" onClick={() => setShowAddTaskModal(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
                    </div>
                  )}

            {/* Task Details Modal */}
            {showTaskDetailsModal && selectedTask && (
              <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50" onClick={closeTaskDetailsModal}>
                {/* Blur and darken layer */}
                <div className="absolute inset-0 pointer-events-none" style={{backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.30)'}} />
                <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl relative z-10" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Task Details</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={closeTaskDetailsModal}
                      className="h-6 w-6 p-0"
                    >
                      ✕
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {/* Title */}
                    <div>
                      <label className="text-sm font-medium text-gray-700">Title</label>
                      {isEditingInModal ? (
                        <Input
                          value={modalEditFields.title}
                          onChange={(e) => setModalEditFields({ ...modalEditFields, title: e.target.value })}
                          className="mt-1"
                          placeholder="Task title"
                        />
                      ) : (
                        <div className={`text-sm ${selectedTask.completed ? 'line-through text-gray-500' : 'text-gray-900'} mt-1 p-2 bg-gray-50 rounded`}>
                          {selectedTask.title}
                        </div>
                      )}
                    </div>
                    
                    {/* Description */}
                    <div>
                      <label className="text-sm font-medium text-gray-700">Description</label>
                      {isEditingInModal ? (
                        <Textarea
                          value={modalEditFields.description}
                          onChange={(e) => setModalEditFields({ ...modalEditFields, description: e.target.value })}
                          className="mt-1"
                          placeholder="Task description"
                          rows={3}
                        />
                      ) : (
                        <div className="text-sm text-gray-900 mt-1 p-2 bg-gray-50 rounded min-h-[3rem]">
                          {selectedTask.description || 'No description provided'}
                        </div>
                      )}
                    </div>
                    
                    {/* Priority (read-only) */}
                    <div>
                      <label className="text-sm font-medium text-gray-700">Priority</label>
                      <div className="mt-1">
                        <Badge className={priorityTitleStyles[selectedTask.priority]}>
                          {priorityLabels[selectedTask.priority]}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Estimated Time and Deadline */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Estimated Time
                        </label>
                        {isEditingInModal ? (
                          <Input
                            value={modalEditFields.estimatedTime}
                            onChange={(e) => setModalEditFields({ ...modalEditFields, estimatedTime: e.target.value })}
                            className="mt-1"
                            placeholder="e.g., 30 minutes"
                          />
                        ) : (
                          <div className="text-sm text-gray-900 mt-1 p-2 bg-gray-50 rounded">
                            {selectedTask.estimatedTime && selectedTask.estimatedTime !== 'None' ? selectedTask.estimatedTime : 'None'}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-700 flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Deadline
                        </label>
                        {isEditingInModal ? (
                          <input
                            type="date"
                            value={convertDeadlineToDateInput(modalEditFields.deadline)}
                            onChange={(e) => setModalEditFields({ ...modalEditFields, deadline: e.target.value })}
                            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        ) : (
                          <div className="text-sm text-gray-900 mt-1 p-2 bg-gray-50 rounded">
                            {selectedTask.deadline && selectedTask.deadline !== 'None' 
                              ? convertRelativeDateToSpecific(selectedTask.deadline) 
                              : 'None'}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Project */}
                    <div>
                      <label className="text-sm font-medium text-gray-700">Project</label>
                      {isEditingInModal ? (
                        <Select 
                          value={modalEditFields.projectId ? String(modalEditFields.projectId) : 'none'} 
                          onValueChange={(value) => setModalEditFields({...modalEditFields, projectId: value === 'none' ? null : Number(value)})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Choose project" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Project</SelectItem>
                            {projects.map(project => (
                              <SelectItem key={project.id} value={String(project.id)}>
                                <div className="flex items-center gap-2">
                                  <span>{project.name}</span>
                                  <Badge className={`${projectPriorities[project.priority]?.color || 'bg-gray-400'} text-xs`}>
                                    {projectPriorities[project.priority]?.label || project.priority}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        selectedTask.projectId ? (
                          <div className="mt-1">
                            <Badge className="bg-blue-100 text-blue-700">
                              {projects.find(p => String(p.id) === String(selectedTask.projectId))?.name || 'Unknown Project'}
                            </Badge>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 mt-1 p-2 bg-gray-50 rounded">
                            No project assigned
                          </div>
                        )
                      )}
                    </div>
                    
                    {/* Status (read-only) */}
                    <div>
                      <label className="text-sm font-medium text-gray-700">Status</label>
                      <div className="mt-1">
                        <Badge className={selectedTask.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {selectedTask.completed ? 'Completed' : 'In Progress'}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-2">
                      {isEditingInModal ? (
                        <>
                          <Button 
                            variant="default" 
                            onClick={saveModalEdit}
                            className="flex-1"
                          >
                            Save
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={cancelModalEdit}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            variant="outline" 
                            onClick={startEditingInModal}
                            className="flex-1"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={closeTaskDetailsModal} 
                            className="flex-1"
                          >
                            Close
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

