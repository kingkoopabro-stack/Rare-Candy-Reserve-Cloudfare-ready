// Local Storage Key
const STORAGE_KEY = 'rareCandy_websiteEdits';

// DOM Elements
const taskInput = document.getElementById('taskInput');
const categorySelect = document.getElementById('categorySelect');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const completedCount = document.getElementById('completedCount');
const pendingCount = document.getElementById('pendingCount');
const filterBtns = document.querySelectorAll('.filter-btn');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const exportBtn = document.getElementById('exportBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

// State
let tasks = [];
let currentFilter = 'all';

// Load tasks from local storage on page load
window.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    renderTasks();
    updateStats();
});

// Event Listeners
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});

filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderTasks();
    });
});

clearCompletedBtn.addEventListener('click', clearCompleted);
exportBtn.addEventListener('click', exportTasks);
clearAllBtn.addEventListener('click', clearAll);

// Functions
function addTask() {
    const text = taskInput.value.trim();
    const category = categorySelect.value;

    if (!text) {
        alert('Please enter a task!');
        return;
    }

    const task = {
        id: Date.now(),
        text: text,
        category: category,
        completed: false,
        createdAt: new Date().toLocaleString()
    };

    tasks.push(task);
    saveTasks();
    taskInput.value = '';
    renderTasks();
    updateStats();
}

function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);
    saveTasks();
    renderTasks();
    updateStats();
}

function toggleTask(id) {
    tasks = tasks.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
    );
    saveTasks();
    renderTasks();
    updateStats();
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newText = prompt('Edit task:', task.text);
    if (newText && newText.trim()) {
        task.text = newText.trim();
        saveTasks();
        renderTasks();
    }
}

function renderTasks() {
    taskList.innerHTML = '';

    let filteredTasks = tasks;

    if (currentFilter === 'active') {
        filteredTasks = tasks.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
        filteredTasks = tasks.filter(t => t.completed);
    } else if (currentFilter !== 'all') {
        filteredTasks = tasks.filter(t => t.category === currentFilter);
    }

    if (filteredTasks.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    filteredTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <input
                type="checkbox"
                class="task-checkbox"
                ${task.completed ? 'checked' : ''}
                onchange="toggleTask(${task.id})"
            >
            <div class="task-content">
                <div class="task-text">${escapeHtml(task.text)}</div>
                <span class="task-category">${getCategoryEmoji(task.category)} ${task.category}</span>
            </div>
            <div class="task-actions">
                <button class="task-btn edit-btn" onclick="editTask(${task.id})">✏️ Edit</button>
                <button class="task-btn delete-btn" onclick="deleteTask(${task.id})">🗑️ Delete</button>
            </div>
        `;
        taskList.appendChild(li);
    });
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;

    totalCount.textContent = total;
    completedCount.textContent = completed;
    pendingCount.textContent = pending;
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
    const saved = localStorage.getItem(STORAGE_KEY);
    tasks = saved ? JSON.parse(saved) : [];
}

function clearCompleted() {
    if (confirm('Are you sure you want to delete all completed tasks?')) {
        tasks = tasks.filter(t => !t.completed);
        saveTasks();
        renderTasks();
        updateStats();
    }
}

function clearAll() {
    if (confirm('⚠️ This will delete ALL tasks. Are you absolutely sure?')) {
        tasks = [];
        saveTasks();
        renderTasks();
        updateStats();
        currentFilter = 'all';
        filterBtns.forEach(b => b.classList.remove('active'));
        filterBtns[0].classList.add('active');
    }
}

function exportTasks() {
    if (tasks.length === 0) {
        alert('No tasks to export!');
        return;
    }

    const exportData = {
        website: 'rarecandyreserve.org',
        exportedAt: new Date().toLocaleString(),
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.completed).length,
        tasks: tasks.map(t => ({
            task: t.text,
            category: t.category,
            status: t.completed ? 'Completed' : 'Pending',
            createdAt: t.createdAt
        }))
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rare-candy-reserve-tasks-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function getCategoryEmoji(category) {
    const emojis = {
        images: '📸',
        text: '✏️',
        styling: '🎨',
        layout: '📐',
        other: '⚙️'
    };
    return emojis[category] || '⚙️';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
