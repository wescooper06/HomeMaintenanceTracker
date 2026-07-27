import { getTasks, addTask, updateTask, deleteTask } from '../lib/sheets.js';
import { formatCurrency, formatDate, normalizePriority, getDefaultTask } from '../lib/utils.js';

const state = {
  tasks: [],
  filters: {
    search: '',
    property: [],
    priority: [],
    category: [],
    area: [],
    state: []
  },
  sortKey: 'property',
  sortAsc: true,
  selectedIds: new Set(),
  editingRowIndex: null,
  costChart: null,
  countChart: null,
  projectDrawerOpen: false
};

const elements = {
  tableBody: document.querySelector('#task-table tbody'),
  search: document.querySelector('#dashboard-search'),
  propertyIcons: document.querySelector('#property-icons'),
  categoryIcons: document.querySelector('#category-icons'),
  priorityIcons: document.querySelector('#priority-icons'),
  stateIcons: document.querySelector('#state-icons'),
  areaFilter: document.querySelector('#dashboard-area-filter'),
  
  selectAll: document.querySelector('#select-all'),
  refreshButton: document.querySelector('#refresh-data'),
  projectListButton: document.querySelector('#project-list-button'),
  deleteSelected: document.querySelector('#delete-selected'),
  openAddForm: document.querySelector('#open-add-form'),
  taskModal: document.querySelector('#task-modal'),
  closeModal: document.querySelector('#close-modal'),
  projectDrawer: document.querySelector('#projectDrawer'),
  closeProjectDrawer: document.querySelector('#close-project-drawer'),
  projectDrawerContent: document.querySelector('#project-drawer-content'),
  taskForm: document.querySelector('#task-form'),
  taskIdDisplay: document.querySelector('#task-form input[name="idDisplay"]'),
  modalTitle: document.querySelector('#modal-title'),
  tableHeaders: document.querySelectorAll('#task-table th[data-sort]'),
  costCanvas: document.querySelector('#cost-chart'),
  countCanvas: document.querySelector('#count-chart'),
  itemCounter: document.querySelector('#item-counter')
};

window.addEventListener('DOMContentLoaded', initialize);

function initialize() {
  elements.search.addEventListener('input', onFilterChange);
  elements.selectAll.addEventListener('change', onSelectAll);
  elements.refreshButton.addEventListener('click', loadTasks);
  if (elements.projectListButton) elements.projectListButton.addEventListener('click', toggleProjectDrawer);
  elements.openAddForm.addEventListener('click', () => openTaskModal(getDefaultTask(), 'add'));
  elements.closeModal.addEventListener('click', closeTaskModal);
  if (elements.closeProjectDrawer) elements.closeProjectDrawer.addEventListener('click', closeProjectDrawer);
  elements.taskForm.addEventListener('submit', onSubmitTaskForm);
  elements.deleteSelected.addEventListener('click', deleteSelectedRows);
  elements.tableBody.addEventListener('click', onTableClick);
  elements.tableBody.addEventListener('focusout', onCellEditComplete);
  elements.tableBody.addEventListener('change', onCellEditComplete);
  elements.tableHeaders.forEach((header) => header.addEventListener('click', onHeaderSort));
  // Dashboard slicers
  if (elements.areaFilter) elements.areaFilter.addEventListener('change', onFilterChange);
  setupPropertyIcons();
  setupIconGroup('category');
  setupIconGroup('priority');
  setupIconGroup('state');
  loadTasks();
}

async function loadTasks() {
  try {
    const tasks = await getTasks();
    state.tasks = tasks;
    populateFilterOptions();
    populateTaskFormOptions();
    renderTable();
    renderCharts();
    if (state.projectDrawerOpen) {
      renderProjectList(tasks);
    }
  } catch (error) {
    elements.tableBody.innerHTML = `<tr><td colspan="12">${error.message}</td></tr>`;
  }
}

function populateFilterOptions() {
  const properties = getUniqueOptions('property');
  const categories = getUniqueOptions('category');
  const priorities = getUniqueOptions('priority').length ? getUniqueOptions('priority') : ['High', 'Medium', 'Low'];
  const states = getUniqueOptions('state');
  const areas = getUniqueOptions('area');
  

  renderIconButtons(elements.categoryIcons, categories, 'category');
  renderIconButtons(elements.priorityIcons, priorities, 'priority');
  renderIconButtons(elements.stateIcons, states, 'state');

  updateIconSelection('category');
  updateIconSelection('priority');
  updateIconSelection('state');
  // Populate the dashboard-level filter selects so they reflect sheet data
  setSelectOptions(elements.areaFilter, areas, 'All Areas');

  // Also populate the modal/task-form selects
  setSelectOptions(elements.taskForm.property, properties, 'Choose property');
  setSelectOptions(elements.taskForm.area, areas, 'Choose area');
  setSelectOptions(elements.taskForm.category, categories, 'Choose category');
}

function populateTaskFormOptions() {
  setSelectOptions(elements.taskForm.property, getUniqueOptions('property'), 'Choose property');
  setSelectOptions(elements.taskForm.area, getUniqueOptions('area'), 'Choose area');
  setSelectOptions(elements.taskForm.category, getUniqueOptions('category'), 'Choose category');
}

function setSelectOptions(select, values, placeholder) {
  if (!select) return;
  const options = [`<option value="">${placeholder}</option>`, ...values.map((value) => `<option value="${value}">${value}</option>`)];
  select.innerHTML = options.join('');
}

function getUniqueOptions(field) {
  return Array.from(new Set(state.tasks.map((task) => task[field]).filter(Boolean))).sort();
}

// Ensure option exists in dropdown select
function ensureOptionExists(select, value) {
  if (!select || !value) return;
  const normalized = String(value);
  if (![...select.options].some((option) => option.value === normalized)) {
    const option = document.createElement('option');
    option.value = normalized;
    option.textContent = normalized;
    select.appendChild(option);
  }
}

function getSelectValues(select) {
  if (!select) return [];
  return Array.from(select.selectedOptions)
    .map((option) => option.value)
    .filter((value) => value);
}

function onFilterChange() {
  state.filters.search = elements.search.value.trim().toLowerCase();
  state.filters.area = getSelectValues(elements.areaFilter);
  renderTable();
  renderCharts();
}

function setupPropertyIcons() {
  if (!elements.propertyIcons) return;
  updatePropertyIconSelection();
  elements.propertyIcons.addEventListener('click', onPropertyIconClick);
}

function setupIconGroup(field) {
  const container = elements[`${field}Icons`];
  if (!container) return;
  container.addEventListener('click', onFilterIconClick);
}

function updatePropertyIconSelection() {
  if (!elements.propertyIcons) return;
  const icons = elements.propertyIcons.querySelectorAll('.prop-icon');
  const selectedProps = state.filters.property || [];
  icons.forEach((icon) => {
    const prop = icon.dataset.property;
    const selected = selectedProps.includes(prop);
    icon.classList.toggle('selected', !!selected);
    icon.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function updateIconSelection(field) {
  const container = elements[`${field}Icons`];
  if (!container) return;
  const selectedValues = state.filters[field] || [];
  container.querySelectorAll('.icon-button').forEach((button) => {
    const value = button.dataset.value;
    const selected = selectedValues.includes(value);
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function renderIconButtons(container, values, field) {
  if (!container) return;
  container.innerHTML = values.map((value) => `
    <button type="button" class="icon-button ${field}-button" data-filter="${field}" data-value="${value}" aria-pressed="false" title="${value}">
      ${getFilterIconSvg(field, value)}
      <span class="icon-label">${value}</span>
    </button>
  `).join('');
}

function getFilterIconSvg(field, value) {
  if (field === 'category') {
    return getCategoryIconSvg(value || '');
  }
  if (field === 'priority') {
    return getPriorityIconSvg(value);
  }
  if (field === 'state') {
    return getStateIconSvg(value);
  }
  return `
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 5h16v3H4zM4 10h16v3H4zM4 15h16v3H4z" />
    </svg>
  `;
}

function getCategoryIconSvg(name) {
  const key = String(name || '').trim().toLowerCase();
  switch (key) {
    // user-specific category titles -> explicit icons
    case 'build':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M2 21l21-9-9-9L2 12v9z" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 14l3 3M14 7l3-3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    case 'clean':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M6 2l2 5 5 2-2-5L6 2zM2 12l4 1 1 4-4-1-1-4zM16 16l6 6-2-6-4 0z" />
        </svg>
      `;
    case 'install':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 3v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 8l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="3" y="16" width="18" height="5" rx="1" />
        </svg>
      `;
    case 'maintenance':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M21 7L13 15M3 21l7-7" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 3l7 7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    case 'organize':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <rect x="3" y="10" width="12" height="4" rx="1" />
          <rect x="3" y="16" width="8" height="4" rx="1" />
        </svg>
      `;
    case 'renovate':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4 21v-7l8-8 7 7-8 8H4z" />
          <path d="M14 7l3 3" stroke="#fff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    case 'repair':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M3 21l18-18" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 3l7 7M10 14L3 21" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    case 'plumbing':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M3 12h4v3a3 3 0 0 0 3 3h4v-4" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="6" cy="6" r="2" fill="currentColor" />
        </svg>
      `;
    case 'electrical':
    case 'electric':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      `;
    case 'roofing':
    case 'roof':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M2 12l10-7 10 7" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 12v6h10v-6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    case 'painting':
    case 'paint':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M20.7 7.3a1 1 0 0 0-1.4 0L16 10.6 13.4 8l3.3-3.3a1 1 0 0 0 0-1.4L16.7 1.3a1 1 0 0 0-1.4 0L9 7.6V11h3.4l4.3-4.3 3 3z" />
        </svg>
      `;
    case 'hvac':
    case 'heating':
    case 'cooling':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2v5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 19h10" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    case 'landscaping':
    case 'yard':
    case 'gardening':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2s4 4 0 8c-4-4 0-8 0-8zM6 20c1-4 6-6 6-6s5 2 6 6H6z" />
        </svg>
      `;
    case 'flooring':
    case 'floor':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path d="M3 9h18M9 21V9" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
        </svg>
      `;
    case 'appliances':
    case 'appliance':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="3" y="3" width="18" height="14" rx="2" stroke-linejoin="round"/>
          <path d="M8 8h8" stroke-linecap="round"/>
          <circle cx="18" cy="18" r="1" fill="currentColor" />
        </svg>
      `;
    case 'cleaning':
    case 'clean':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2l1.5 4L18 8l-4.5 1L12 14l-1.5-5L6 8l4.5-2L12 2z" />
        </svg>
      `;
    case 'security':
    case 'locks':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="4" y="10" width="16" height="10" rx="2" stroke-linejoin="round"/>
          <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    case 'windows':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" />
          <rect x="13" y="3" width="8" height="8" />
          <rect x="3" y="13" width="8" height="8" />
          <rect x="13" y="13" width="8" height="8" />
        </svg>
      `;
    case 'doors':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="6" y="3" width="12" height="18" rx="1" />
          <circle cx="16" cy="12" r="0.8" fill="rgba(255,255,255,0.9)" />
        </svg>
      `;
    case 'gutter':
    case 'gutters':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M3 7h18v4a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V7z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    case 'masonry':
    case 'stone':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M3 7h18v10H3zM7 7v10" opacity="0.6" />
        </svg>
      `;
    case 'fencing':
    case 'fence':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4 3v18M10 3v18M16 3v18M22 3v18M2 12h20" />
        </svg>
      `;
    case 'pool':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M2 12c4-3 8-3 12 0s8 3 12 0v6H2v-6z" />
        </svg>
      `;
    case 'lighting':
    case 'lights':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2v6M8 8h8l-1 5a3 3 0 0 1-6 0L8 8z" />
        </svg>
      `;
    case 'pests':
    case 'pest control':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2c2 2 3 5 3 7 0 3-2 5-3 5s-3-2-3-5c0-2 1-5 3-7z" />
        </svg>
      `;
    default:
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4 5h16v3H4zM4 10h16v3H4zM4 15h16v3H4z" />
        </svg>
      `;
  }
}

function getPriorityIconSvg(value) {
  const key = String(value || '').trim().toLowerCase();
  switch (key) {
    case 'high':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 3l9 18H3L12 3z" />
        </svg>
      `;
    case 'medium':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="12" cy="8" r="3" />
          <rect x="6" y="14" width="12" height="6" rx="1" />
        </svg>
      `;
    case 'low':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 21V3" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="18" r="2" fill="currentColor" />
        </svg>
      `;
    default:
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 4l8 16H4z" />
        </svg>
      `;
  }
}
 
function getStateIconSvg(value) {
  const key = String(value || '').trim().toLowerCase();
  switch (key) {
    case 'completed':
    case 'complete':
      return `
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      `;
    case 'cancelled':
    case 'canceled':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 9l6 6M15 9l-6 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      `;
    case 'deferred':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 8v5l3 3" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      `;
    case 'in progress':
    case 'in-progress':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M6 3h12M6 21h12" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M8 3c0 4 4 5 4 9s-4 5-4 9" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M16 3c0 4-4 5-4 9s4 5 4 9" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      `;
    case 'not started':
    case 'not-started':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
        </svg>
      `;
    case 'pending':
    default:
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M6 2h12v6l-6 4-6-4V2z" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M6 14v6h12v-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      `;
  }
}

function onFilterIconClick(event) {
  const btn = event.target.closest('.icon-button');
  if (!btn) return;
  const field = btn.dataset.filter;
  const value = btn.dataset.value;
  if (!field || !value) return;

  const current = state.filters[field] || [];
  if (current.includes(value)) {
    state.filters[field] = current.filter((item) => item !== value);
  } else {
    state.filters[field] = [...current, value];
  }

  updateIconSelection(field);
  renderTable();
  renderCharts();
}

function onPropertyIconClick(event) {
  const btn = event.target.closest('.prop-icon');
  if (!btn) return;
  const prop = btn.dataset.property;
  const currently = state.filters.property || [];
  const isMultiSelect = event.ctrlKey || event.metaKey;

  if (isMultiSelect) {
    if (currently.includes(prop)) {
      state.filters.property = currently.filter((value) => value !== prop);
    } else {
      state.filters.property = [...currently, prop];
    }
  } else {
    if (currently.length === 1 && currently[0] === prop) {
      state.filters.property = [];
    } else {
      state.filters.property = [prop];
    }
  }

  updatePropertyIconSelection();
  renderTable();
  renderCharts();
}

function onSelectAll() {
  const rows = elements.tableBody.querySelectorAll('input[type="checkbox"][data-id]');
  state.selectedIds.clear();
  rows.forEach((checkbox) => {
    checkbox.checked = elements.selectAll.checked;
    if (checkbox.checked) {
      state.selectedIds.add(Number(checkbox.dataset.id));
    }
  });
}

function getFilteredTasks() {
  return state.tasks
    .filter((task) => {
      const matchesSearch = !state.filters.search || [
        task.id,
        task.property,
        task.area,
        task.category,
        task.description,
        task.state,
        task.order
      ].some((value) => String(value || '').toLowerCase().includes(state.filters.search));
      const matchesProperty = !state.filters.property.length || state.filters.property.includes(task.property);
      const matchesPriority = !state.filters.priority.length || state.filters.priority.includes(task.priority);
      const matchesCategory = !state.filters.category.length || state.filters.category.includes(task.category);
      const matchesArea = !state.filters.area.length || state.filters.area.includes(task.area);
      const matchesState = !state.filters.state.length || state.filters.state.includes(task.state);
      return matchesSearch && matchesProperty && matchesPriority && matchesCategory && matchesArea && matchesState;
    })
    .sort((a, b) => {
      if (state.sortKey === 'order') {
        const leftRaw = String(a.order || '').trim();
        const rightRaw = String(b.order || '').trim();
        const leftValue = parseFloat(leftRaw);
        const rightValue = parseFloat(rightRaw);
        const leftNumeric = Number.isFinite(leftValue);
        const rightNumeric = Number.isFinite(rightValue);
        if (leftNumeric && rightNumeric) {
          if (leftValue === rightValue) return 0;
          return state.sortAsc ? leftValue - rightValue : rightValue - leftValue;
        }
        if (leftNumeric) return state.sortAsc ? -1 : 1;
        if (rightNumeric) return state.sortAsc ? 1 : -1;
        if (leftRaw === rightRaw) return 0;
        return state.sortAsc ? leftRaw.localeCompare(rightRaw) : rightRaw.localeCompare(leftRaw);
      }
      const left = String(a[state.sortKey] || '').toLowerCase();
      const right = String(b[state.sortKey] || '').toLowerCase();
      if (left === right) return 0;
      return state.sortAsc ? left.localeCompare(right) : right.localeCompare(left);
    });
}

function renderTable() {
  const tasks = getFilteredTasks();
  if (elements.itemCounter) {
    elements.itemCounter.textContent = `${tasks.length}`;
    elements.itemCounter.classList.add('count-updated');
    window.requestAnimationFrame(() => {
      elements.itemCounter.classList.remove('count-updated');
    });
  }
  if (!tasks.length) {
    elements.tableBody.innerHTML = '<tr><td colspan="14">No tasks found.</td></tr>';
    if (state.projectDrawerOpen) {
      renderProjectList(tasks);
    }
    return;
  }

  elements.tableBody.innerHTML = tasks.map((task) => `
    <tr>
      <td><input type="checkbox" data-id="${task.rowIndex}" ${state.selectedIds.has(task.rowIndex) ? 'checked' : ''}></td>
      <td data-field="id">${task.id || ''}</td>
      <td data-field="property">${task.property || ''}</td>
      
      <td data-field="area">${task.area || ''}</td>
      <td data-field="category">${task.category || ''}</td>
      <td data-field="description">${task.description || ''}</td>
      <td data-field="priority">${normalizePriority(task.priority)}</td>
      <td data-field="order">${task.order || ''}</td>
      <td data-field="cost">${formatCurrency(task.cost)}</td>
      <td data-field="state">${task.state || 'Pending'}</td>
      <td data-field="dateCompleted">${task.dateCompleted || ''}</td>
      <td class="row-actions">
        <button type="button" class="edit-row" data-action="edit" data-row="${task.rowIndex}">Edit</button>
        <button type="button" class="delete-row" data-action="delete" data-row="${task.rowIndex}">Delete</button>
      </td>
    </tr>
  `).join('');

  if (state.projectDrawerOpen) {
    renderProjectList(tasks);
  }
}

function renderProjectList(tasks) {
  if (!elements.projectDrawerContent) return;
  const projectTasks = tasks
    .filter((task) => String(task.order || '').trim() !== '')
    .filter((task) => {
      const stateValue = String(task.state || '').trim().toLowerCase();
      return stateValue !== 'complete' && stateValue !== 'completed';
    })
    .slice()
    .sort((a, b) => {
      const leftOrder = Number(String(a.order || '').trim());
      const rightOrder = Number(String(b.order || '').trim());
      if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder)) {
        return leftOrder - rightOrder;
      }
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

  if (!projectTasks.length) {
    elements.projectDrawerContent.innerHTML = '<p class="project-drawer-empty">No tasks to show.</p>';
    return;
  }

  elements.projectDrawerContent.innerHTML = `
    <ul class="project-drawer-list">
      ${projectTasks.map((task) => `
        <li class="project-drawer-item">
          <div class="project-drawer-main">
            <span class="project-id">ID ${task.id || ''}</span>
            <span class="project-property">${task.property || 'Unspecified'}: ${task.area || 'No area'}</span>
            <span class="project-description">${task.description || ''}</span>
          </div>
          <span class="project-order">${task.order || ''}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function openProjectDrawer() {
  state.projectDrawerOpen = true;
  if (elements.projectDrawer) {
    elements.projectDrawer.classList.add('open');
    elements.projectDrawer.setAttribute('aria-hidden', 'false');
  }
  renderProjectList(getFilteredTasks());
}

function closeProjectDrawer() {
  state.projectDrawerOpen = false;
  if (elements.projectDrawer) {
    elements.projectDrawer.classList.remove('open');
    elements.projectDrawer.setAttribute('aria-hidden', 'true');
  }
}

function toggleProjectDrawer() {
  if (state.projectDrawerOpen) {
    closeProjectDrawer();
  } else {
    openProjectDrawer();
  }
}

async function onTableClick(event) {
  // If the click originated from an active edit control (input/select),
  // do not handle it here — otherwise opening a select will trigger this
  // handler and re-render the cell, closing the dropdown prematurely.
  if (event.target.closest('[data-edit-field]')) return;
  // If some cell is currently being edited, ignore clicks outside it so
  // the user can interact with its dropdown without the table re-rendering.
  const editingCell = elements.tableBody.querySelector('td.editing');
  if (editingCell && !editingCell.contains(event.target)) return;
  const actionBtn = event.target.closest('button[data-action]');
  if (actionBtn) {
    const action = actionBtn.dataset.action;
    const rowIndex = Number(actionBtn.dataset.row);
    const task = state.tasks.find((item) => item.rowIndex === rowIndex);
    if (action === 'edit' && task) {
      openTaskModal(task, 'edit');
      return;
    }
    if (action === 'delete') {
      const confirmed = confirm('Delete this task from Google Sheets?');
      if (!confirmed) return;
      try {
        await deleteTask(rowIndex);
        await loadTasks();
      } catch (err) {
        alert(`Could not delete task: ${err.message}`);
      }
    }
    return;
  }

  const checkbox = event.target.closest('input[type="checkbox"][data-id]');
  if (checkbox) {
    const id = Number(checkbox.dataset.id);
    if (checkbox.checked) {
      state.selectedIds.add(id);
    } else {
      state.selectedIds.delete(id);
      elements.selectAll.checked = false;
    }
    return;
  }

  const cell = event.target.closest('td[data-field]');
  if (!cell) return;

  const field = cell.dataset.field;
  if (field === 'id') return;

  const row = cell.closest('tr');
  const rowId = Number(row.querySelector('input[data-id]').dataset.id);
  const task = state.tasks.find((item) => item.rowIndex === rowId);
  if (!task) return;

  if (field === 'cost') {
    cell.innerHTML = `<input type="number" step="0.01" min="0" value="${task.cost || 0}" data-edit-field="${field}">`;
    cell.classList.add('editing');
  } else if (field === 'priority') {
    cell.innerHTML = `
      <select data-edit-field="${field}">
        <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
        <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
        <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
      </select>
    `;
      cell.classList.add('editing');
  } else if (['property', 'area', 'category'].includes(field)) {
    const options = getUniqueOptions(field);
    const selectOptions = [`<option value=""></option>`, ...options.map((value) => `<option value="${value}" ${task[field] === value ? 'selected' : ''}>${value}</option>`)];
    cell.innerHTML = `<select data-edit-field="${field}">${selectOptions.join('')}</select>`;
      cell.classList.add('editing');
  } else if (field === 'dateCompleted') {
    cell.innerHTML = `<input type="date" value="${task.dateCompleted || ''}" data-edit-field="${field}">`;
      cell.classList.add('editing');
  } else {
    cell.innerHTML = `<input type="text" value="${cell.textContent.trim()}" data-edit-field="${field}">`;
      cell.classList.add('editing');
  }
  const input = cell.querySelector('[data-edit-field]');
  input.focus();
}

async function deleteSelectedRows() {
  if (state.selectedIds.size === 0) return;
  const confirmed = confirm(`Delete ${state.selectedIds.size} selected task(s)? This cannot be undone.`);
  if (!confirmed) return;
  const ids = Array.from(state.selectedIds).sort((a, b) => b - a);
  for (const rowIndex of ids) {
    try {
      await deleteTask(rowIndex);
    } catch (error) {
      console.error(`Unable to delete row ${rowIndex}:`, error);
    }
  }
  state.selectedIds.clear();
  await loadTasks();
}

async function onCellEditComplete(event) {
  const input = event.target.closest('[data-edit-field]');
  if (!input) return;

  // If this is a SELECT element, ignore focusout events so the user can
  // open the dropdown and make a selection; rely on the 'change' event to
  // commit the value instead.
  if (input.tagName === 'SELECT' && event.type === 'focusout') return;

  const cell = input.closest('td');
  const row = cell.closest('tr');
  const rowId = Number(row.querySelector('input[data-id]').dataset.id);
  const field = input.dataset.editField;
  const value = input.value.trim();
  const task = state.tasks.find((item) => item.rowIndex === rowId);
  if (!task) return;

  let updateValue = value;
  if (field === 'cost') {
    updateValue = Number(value) || 0;
  }
  if (field === 'priority') {
    updateValue = normalizePriority(value);
  }
  if (field === 'dateCompleted' && !value) {
    updateValue = '';
  }

  try {
    await updateTask(rowId, { [field]: updateValue });
    if (field === 'order') {
      await loadTasks();
      return;
    }
    task[field] = updateValue;
    // editing completed for this cell
    const editingCell = elements.tableBody.querySelector('td.editing');
    if (editingCell) editingCell.classList.remove('editing');
    if (field === 'state' && updateValue.toLowerCase() === 'complete' && !task.dateCompleted) {
      task.dateCompleted = formatDate(new Date());
    }
    renderTable();
    renderCharts();
  } catch (error) {
    alert(`Update failed: ${error.message}`);
    renderTable();
  }
}

function onHeaderSort(event) {
  const key = event.currentTarget.dataset.sort;
  if (state.sortKey === key) {
    state.sortAsc = !state.sortAsc;
  } else {
    state.sortKey = key;
    state.sortAsc = true;
  }
  renderTable();
}

function openTaskModal(task, mode = 'add') {
  state.editingRowIndex = mode === 'edit' ? task.rowIndex : null;
  elements.modalTitle.textContent = mode === 'edit' ? 'Edit Task' : 'Add Task';
  elements.taskForm.id.value = task.id || '';
  if (elements.taskIdDisplay) {
    elements.taskIdDisplay.value = task.id || '';
  }
  elements.taskForm.property.value = task.property || '';
  elements.taskForm.area.value = task.area || '';
  elements.taskForm.category.value = task.category || '';
  elements.taskForm.description.value = task.description || '';
  elements.taskForm.priority.value = task.priority || 'Low';
  elements.taskForm.order.value = task.order || '';
  elements.taskForm.cost.value = task.cost || '';
  elements.taskForm.state.value = task.state || 'Pending';
  elements.taskForm.dateCompleted.value = task.dateCompleted || '';
  ensureOptionExists(elements.taskForm.property, task.property);
  ensureOptionExists(elements.taskForm.area, task.area);
  ensureOptionExists(elements.taskForm.category, task.category);
  elements.taskModal.classList.remove('hidden');
}

function closeTaskModal() {
  elements.taskForm.reset();
  state.editingRowIndex = null;
  elements.taskModal.classList.add('hidden');
}

async function onSubmitTaskForm(event) {
  event.preventDefault();

  const taskData = {
    id: elements.taskForm.id.value.trim(),
    property: elements.taskForm.property.value.trim(),
    area: elements.taskForm.area.value.trim(),
    category: elements.taskForm.category.value.trim(),
    
    description: elements.taskForm.description.value.trim(),
    priority: elements.taskForm.priority.value,
    order: elements.taskForm.order.value.trim(),
    cost: parseFloat(elements.taskForm.cost.value || 0) || 0,
    state: elements.taskForm.state.value.trim() || 'Pending',
    dateCompleted: elements.taskForm.dateCompleted.value || ''
  };

  if (taskData.state.toLowerCase() === 'complete' && !taskData.dateCompleted) {
    taskData.dateCompleted = formatDate(new Date());
  } else if (taskData.state.toLowerCase() !== 'complete') {
    taskData.dateCompleted = '';
  }

  try {
    if (state.editingRowIndex) {
      await updateTask(state.editingRowIndex, taskData);
    } else {
      if (!taskData.id) {
        const numericIds = state.tasks
          .map((t) => Number(t.id))
          .filter((n) => Number.isFinite(n) && !Number.isNaN(n));
        const maxId = numericIds.length ? Math.max(...numericIds) : 0;
        taskData.id = String(maxId + 1);
      }
      await addTask(taskData);
    }
    closeTaskModal();
    await loadTasks();
  } catch (error) {
    alert(`Could not save task: ${error.message}`);
  }
}

async function updateSelectedTasks(payload) {
  const selectedIds = Array.from(state.selectedIds);
  if (!selectedIds.length) return;
  for (const rowIndex of selectedIds) {
    const task = state.tasks.find((item) => item.rowIndex === rowIndex);
    if (!task) continue;
    try {
      await updateTask(rowIndex, payload);
      Object.assign(task, payload);
    } catch (error) {
      console.error(`Unable to update row ${rowIndex}:`, error);
    }
  }
  renderTable();
  renderCharts();
}

function renderCharts() {
  const tasks = getFilteredTasks();
  const categoryCost = {};
  const categoryCount = {};

  tasks.forEach((task) => {
    const category = task.category || 'Uncategorized';
    categoryCost[category] = (categoryCost[category] || 0) + (Number(task.cost) || 0);
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });

  const labels = Object.keys(categoryCost);
  const costData = labels.map((key) => categoryCost[key]);
  const countData = labels.map((key) => categoryCount[key]);

  if (window.Chart) {
    if (!state.costChart) {
      state.costChart = new Chart(elements.costCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Total Cost', data: costData, backgroundColor: '#2563eb' }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    } else {
      state.costChart.data.labels = labels;
      state.costChart.data.datasets[0].data = costData;
      state.costChart.update();
    }

    if (!state.countChart) {
      state.countChart = new Chart(elements.countCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ label: 'Task Count', data: countData, backgroundColor: ['#2563eb', '#f59e0b', '#16a34a', '#ef4444', '#8b5cf6'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    } else {
      state.countChart.data.labels = labels;
      state.countChart.data.datasets[0].data = countData;
      state.countChart.update();
    }
  }
}
