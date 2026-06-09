import { getTasks, updateTask } from '../lib/sheets.js';
import { formatCurrency, formatDate, normalizePriority } from '../lib/utils.js';

const state = {
  tasks: [],
  filters: {
    search: '',
    property: '',
    priority: '',
    category: ''
  },
  sortKey: 'property',
  sortAsc: true,
  selectedIds: new Set(),
  costChart: null,
  countChart: null
};

const elements = {
  tableBody: document.querySelector('#task-table tbody'),
  search: document.querySelector('#dashboard-search'),
  propertyFilter: document.querySelector('#dashboard-property-filter'),
  priorityFilter: document.querySelector('#dashboard-priority-filter'),
  categoryFilter: document.querySelector('#dashboard-category-filter'),
  selectAll: document.querySelector('#select-all'),
  refreshButton: document.querySelector('#refresh-data'),
  bulkState: document.querySelector('#bulk-state'),
  bulkPriority: document.querySelector('#bulk-priority'),
  applyBulkState: document.querySelector('#apply-bulk-state'),
  applyBulkPriority: document.querySelector('#apply-bulk-priority'),
  tableHeaders: document.querySelectorAll('#task-table th[data-sort]'),
  costCanvas: document.querySelector('#cost-chart'),
  countCanvas: document.querySelector('#count-chart')
};

window.addEventListener('DOMContentLoaded', initialize);

function initialize() {
  elements.search.addEventListener('input', onFilterChange);
  elements.propertyFilter.addEventListener('change', onFilterChange);
  elements.priorityFilter.addEventListener('change', onFilterChange);
  elements.categoryFilter.addEventListener('change', onFilterChange);
  elements.selectAll.addEventListener('change', onSelectAll);
  elements.refreshButton.addEventListener('click', loadTasks);
  elements.applyBulkState.addEventListener('click', applyBulkState);
  elements.applyBulkPriority.addEventListener('click', applyBulkPriority);
  elements.tableBody.addEventListener('click', onTableClick);
  elements.tableBody.addEventListener('focusout', onCellEditComplete);
  elements.tableHeaders.forEach((header) => header.addEventListener('click', onHeaderSort));
  loadTasks();
}

async function loadTasks() {
  try {
    const tasks = await getTasks();
    state.tasks = tasks;
    populateFilterOptions();
    renderTable();
    renderCharts();
  } catch (error) {
    elements.tableBody.innerHTML = `<tr><td colspan="12">${error.message}</td></tr>`;
  }
}

function populateFilterOptions() {
  const properties = Array.from(new Set(state.tasks.map((task) => task.property).filter(Boolean))).sort();
  const categories = Array.from(new Set(state.tasks.map((task) => task.category).filter(Boolean))).sort();

  elements.propertyFilter.innerHTML = '<option value="">All Properties</option>' + properties.map((value) => `<option value="${value}">${value}</option>`).join('');
  elements.categoryFilter.innerHTML = '<option value="">All Categories</option>' + categories.map((value) => `<option value="${value}">${value}</option>`).join('');
}

function onFilterChange() {
  state.filters.search = elements.search.value.trim().toLowerCase();
  state.filters.property = elements.propertyFilter.value;
  state.filters.priority = elements.priorityFilter.value;
  state.filters.category = elements.categoryFilter.value;
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
        task.property,
        task.interiorExterior,
        task.upstairsDownstairs,
        task.area,
        task.category,
        task.description,
        task.state,
        task.order
      ].some((value) => String(value || '').toLowerCase().includes(state.filters.search));
      const matchesProperty = !state.filters.property || task.property === state.filters.property;
      const matchesPriority = !state.filters.priority || task.priority === state.filters.priority;
      const matchesCategory = !state.filters.category || task.category === state.filters.category;
      return matchesSearch && matchesProperty && matchesPriority && matchesCategory;
    })
    .sort((a, b) => {
      const left = String(a[state.sortKey] || '').toLowerCase();
      const right = String(b[state.sortKey] || '').toLowerCase();
      if (left === right) return 0;
      return state.sortAsc ? left.localeCompare(right) : right.localeCompare(left);
    });
}

function renderTable() {
  const tasks = getFilteredTasks();
  if (!tasks.length) {
    elements.tableBody.innerHTML = '<tr><td colspan="12">No tasks found.</td></tr>';
    return;
  }

  elements.tableBody.innerHTML = tasks.map((task) => `
    <tr>
      <td><input type="checkbox" data-id="${task.rowIndex}" ${state.selectedIds.has(task.rowIndex) ? 'checked' : ''}></td>
      <td data-field="property">${task.property || ''}</td>
      <td data-field="interiorExterior">${task.interiorExterior || ''}</td>
      <td data-field="upstairsDownstairs">${task.upstairsDownstairs || ''}</td>
      <td data-field="area">${task.area || ''}</td>
      <td data-field="category">${task.category || ''}</td>
      <td data-field="description">${task.description || ''}</td>
      <td data-field="priority">${normalizePriority(task.priority)}</td>
      <td data-field="order">${task.order || ''}</td>
      <td data-field="cost">${formatCurrency(task.cost)}</td>
      <td data-field="state">${task.state || 'Pending'}</td>
      <td data-field="dateCompleted">${task.dateCompleted || ''}</td>
    </tr>
  `).join('');
}

function onTableClick(event) {
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
  const row = cell.closest('tr');
  const rowId = Number(row.querySelector('input[data-id]').dataset.id);
  const task = state.tasks.find((item) => item.rowIndex === rowId);
  if (!task) return;

  if (field === 'cost') {
    cell.innerHTML = `<input type="number" step="0.01" min="0" value="${task.cost || 0}" data-edit-field="${field}">`;
  } else if (field === 'priority') {
    cell.innerHTML = `
      <select data-edit-field="${field}">
        <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
        <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
        <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
      </select>
    `;
  } else if (field === 'dateCompleted') {
    cell.innerHTML = `<input type="date" value="${task.dateCompleted || ''}" data-edit-field="${field}">`;
  } else {
    cell.innerHTML = `<input type="text" value="${cell.textContent.trim()}" data-edit-field="${field}">`;
  }
  const input = cell.querySelector('[data-edit-field]');
  input.focus();
}

async function onCellEditComplete(event) {
  const input = event.target.closest('[data-edit-field]');
  if (!input) return;

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
    task[field] = updateValue;
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

async function applyBulkState() {
  const nextState = elements.bulkState.value;
  if (!nextState || state.selectedIds.size === 0) return;
  await updateSelectedTasks({ state: nextState });
}

async function applyBulkPriority() {
  const nextPriority = elements.bulkPriority.value;
  if (!nextPriority || state.selectedIds.size === 0) return;
  await updateSelectedTasks({ priority: normalizePriority(nextPriority) });
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
