import { getTasks, addTask, updateTask, deleteTask } from '../lib/sheets.js';
import { formatCurrency, formatDate, groupBy, normalizePriority, getDefaultTask } from '../lib/utils.js';

const state = {
  tasks: [],
  filters: {
    search: '',
    property: '',
    priority: '',
    category: ''
  },
  currentEdit: null
};

const elements = {
  searchInput: document.querySelector('#search-input'),
  filterProperty: document.querySelector('#filter-property'),
  filterPriority: document.querySelector('#filter-priority'),
  filterCategory: document.querySelector('#filter-category'),
  taskContainer: document.querySelector('#task-container'),
  openAddForm: document.querySelector('#open-add-form'),
  taskModal: document.querySelector('#task-modal'),
  closeModal: document.querySelector('#close-modal'),
  taskForm: document.querySelector('#task-form'),
  modalTitle: document.querySelector('#modal-title'),
  refreshButton: document.querySelector('#refresh-button')
};

window.addEventListener('DOMContentLoaded', initialize); 

function initialize() {
  elements.searchInput.addEventListener('input', onFilterChange);
  elements.filterProperty.addEventListener('change', onFilterChange);
  elements.filterPriority.addEventListener('change', onFilterChange);
  elements.filterCategory.addEventListener('change', onFilterChange);
  elements.openAddForm.addEventListener('click', () => openTaskModal(getDefaultTask()));
  elements.closeModal.addEventListener('click', closeTaskModal);
  elements.taskForm.addEventListener('submit', onSubmitTaskForm);
  elements.refreshButton.addEventListener('click', loadTasks);
  loadTasks();
}

async function loadTasks() {
  try {
    elements.taskContainer.innerHTML = '<p class="loading">Loading tasks…</p>';
    state.tasks = await getTasks();
    renderFilters();
    renderTasks();
  } catch (error) {
    elements.taskContainer.innerHTML = `<p class="error">${error.message}</p>`;
  }
}

function onFilterChange() {
  state.filters.search = elements.searchInput.value.trim().toLowerCase();
  state.filters.property = elements.filterProperty.value;
  state.filters.priority = elements.filterPriority.value;
  state.filters.category = elements.filterCategory.value;
  renderTasks();
}

function renderFilters() {
  const properties = Array.from(new Set(state.tasks.map((task) => task.property).filter(Boolean))).sort();
  const categories = Array.from(new Set(state.tasks.map((task) => task.category).filter(Boolean))).sort();

  elements.filterProperty.innerHTML = '<option value="">All Properties</option>' + properties.map((property) => `<option value="${property}">${property}</option>`).join('');
  elements.filterCategory.innerHTML = '<option value="">All Categories</option>' + categories.map((category) => `<option value="${category}">${category}</option>`).join('');
  setSelectOptions(elements.taskForm.property, properties, 'Choose property');
  setSelectOptions(elements.taskForm.interiorExterior, getUniqueOptions('interiorExterior'), 'Choose interior/exterior');
  setSelectOptions(elements.taskForm.upstairsDownstairs, getUniqueOptions('upstairsDownstairs'), 'Choose up/down');
  setSelectOptions(elements.taskForm.area, getUniqueOptions('area'), 'Choose area');
  setSelectOptions(elements.taskForm.category, categories, 'Choose category');
}

function filterTasks() {
  return state.tasks
    .filter((task) => {
      const search = state.filters.search;
      const matchSearch = !search || [
        task.property,
        task.area,
        task.category,
        task.description,
        task.state
      ].some((value) => String(value || '').toLowerCase().includes(search));
      const matchProperty = !state.filters.property || task.property === state.filters.property;
      const matchPriority = !state.filters.priority || task.priority === state.filters.priority;
      const matchCategory = !state.filters.category || task.category === state.filters.category;
      return matchSearch && matchProperty && matchPriority && matchCategory;
    })
    .sort((a, b) => a.description.localeCompare(b.description));
}

  function getUniqueOptions(field) {
    return Array.from(new Set(state.tasks.map((task) => task[field]).filter(Boolean))).sort();
  }

  function setSelectOptions(select, values, placeholder) {
    const options = [`<option value="">${placeholder}</option>`, ...values.map((value) => `<option value="${value}">${value}</option>`)];
    select.innerHTML = options.join('');
  }

  function ensureOptionExists(select, value) {
    if (!value) return;
    const normalized = String(value);
    if (![...select.options].some((option) => option.value === normalized)) {
      const option = document.createElement('option');
      option.value = normalized;
      option.textContent = normalized;
      select.appendChild(option);
    }
  }

function renderTasks() {
  const filteredTasks = filterTasks();
  const grouped = groupBy(filteredTasks, 'property');

  elements.taskContainer.innerHTML = Object.keys(grouped).length === 0
    ? '<p class="empty-state">No tasks matched the current filters.</p>'
    : Object.entries(grouped).map(([property, tasks]) => renderPropertyGroup(property, tasks)).join('');
}

function renderPropertyGroup(property, tasks) {
  const cards = tasks.map((task) => renderTaskCard(task)).join('');
  return `
    <section class="property-group">
      <h2>${property || 'Unspecified Property'}</h2>
      ${cards}
    </section>
  `;
}

function renderTaskCard(task) {
  return `
    <article class="task-card">
      <div class="task-row">
        <div>
          <strong>${task.description}</strong>
          <small>${task.area ? `${task.area} · ` : ''}${task.category || 'No category'}</small>
        </div>
        <div class="badges">
          <span class="badge badge-${task.priority.toLowerCase()}">${normalizePriority(task.priority)}</span>
          <span class="badge badge-state">${task.state || 'Pending'}</span>
        </div>
      </div>
      <div class="task-row">
        <div><small>${task.interiorExterior || 'Interior/Exterior not set'}</small></div>
        <div><small>${task.upstairsDownstairs || 'Up/Down not set'}</small></div>
        <div><small>${formatCurrency(task.cost)}</small></div>
      </div>
      <div class="task-row task-buttons">
        <button type="button" class="cta-button" data-action="edit" data-row="${task.rowIndex}">Edit</button>
        <button type="button" class="cta-button complete-button" data-action="complete" data-row="${task.rowIndex}">Mark Complete</button>
        <button type="button" class="cta-button delete-button" data-action="delete" data-row="${task.rowIndex}">Delete</button>
      </div>
    </article>
  `;
}

function openTaskModal(task) {
  state.currentEdit = task;
  elements.modalTitle.textContent = task.rowIndex ? 'Edit Task' : 'Add Task';
  elements.taskForm.property.value = task.property || '';
  elements.taskForm.interiorExterior.value = task.interiorExterior || '';
  elements.taskForm.upstairsDownstairs.value = task.upstairsDownstairs || '';
  elements.taskForm.area.value = task.area || '';
  elements.taskForm.category.value = task.category || '';
  elements.taskForm.description.value = task.description || '';
  elements.taskForm.priority.value = task.priority || 'Low';
  elements.taskForm.order.value = task.order || '';
  elements.taskForm.cost.value = task.cost || '';
  elements.taskForm.state.value = task.state || 'Pending';
  ensureOptionExists(elements.taskForm.property, task.property);
  ensureOptionExists(elements.taskForm.interiorExterior, task.interiorExterior);
  ensureOptionExists(elements.taskForm.upstairsDownstairs, task.upstairsDownstairs);
  ensureOptionExists(elements.taskForm.area, task.area);
  ensureOptionExists(elements.taskForm.category, task.category);
  elements.taskModal.classList.remove('hidden');
}

function closeTaskModal() {
  state.currentEdit = null;
  elements.taskForm.reset();
  elements.taskModal.classList.add('hidden');
}

async function onSubmitTaskForm(event) {
  event.preventDefault();
  const taskData = {
    property: elements.taskForm.property.value.trim(),
    interiorExterior: elements.taskForm.interiorExterior.value.trim(),
    upstairsDownstairs: elements.taskForm.upstairsDownstairs.value.trim(),
    area: elements.taskForm.area.value.trim(),
    category: elements.taskForm.category.value.trim(),
    description: elements.taskForm.description.value.trim(),
    priority: elements.taskForm.priority.value,
    order: elements.taskForm.order.value.trim(),
    cost: parseFloat(elements.taskForm.cost.value || 0) || 0,
    state: elements.taskForm.state.value.trim() || 'Pending'
  };

  // If no ID provided, compute a safe incrementing ID from current tasks
  if (!taskData.id) {
    const numericIds = state.tasks
      .map((t) => Number(t.id))
      .filter((n) => Number.isFinite(n) && !Number.isNaN(n));
    const maxId = numericIds.length ? Math.max(...numericIds) : 0;
    taskData.id = String(maxId + 1);
  }

  try {
    if (state.currentEdit && state.currentEdit.rowIndex) {
      await updateTask(state.currentEdit.rowIndex, taskData);
    } else {
      await addTask(taskData);
    }
    closeTaskModal();
    await loadTasks();
  } catch (error) {
    alert(`Could not save task: ${error.message}`);
  }
}

async function onTaskAction(event) {
  const button = event.target.closest('button');
  if (!button || !button.dataset.action) return;

  const action = button.dataset.action;
  const rowIndex = Number(button.dataset.row);
  const task = state.tasks.find((item) => item.rowIndex === rowIndex);

  if (action === 'edit' && task) {
    openTaskModal(task);
  }

  if (action === 'complete' && task) {
    await setTaskComplete(task);
  }

  if (action === 'delete' && task) {
    const confirmed = confirm('Delete this task from Google Sheets?');
    if (confirmed) {
      await deleteTask(rowIndex);
      await loadTasks();
    }
  }
}

async function setTaskComplete(task) {
  try {
    await updateTask(task.rowIndex, {
      state: 'Complete',
      dateCompleted: formatDate(new Date())
    });
    await loadTasks();
  } catch (error) {
    alert(`Could not mark complete: ${error.message}`);
  }
}

elements.taskContainer.addEventListener('click', (event) => {
  onTaskAction(event);
});
