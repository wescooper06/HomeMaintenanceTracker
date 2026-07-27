export const SHEET_HEADERS = [
  'ID',
  'Property',
  'Area',
  'Category',
  'Task Description',
  'Priority',
  'Order',
  'Cost ($)',
  'State',
  'Date Completed',
  'ResourceLinks'
];

export function parseTaskRow(row = [], rowIndex) {
  return {
    rowIndex,
    id: row[0] || '',
    property: row[1] || '',
    area: row[2] || '',
    category: row[3] || '',
    description: row[4] || '',
    priority: row[5] || 'Low',
    order: row[6] || '',
    cost: parseFloat(row[7]) || 0,
    state: row[8] || 'Pending',
    dateCompleted: row[9] || '',
    resourceLinks: row[10] || ''
  };
}

export function formatTaskRow(task) {
  return [
    task.id || '',
    task.property || '',
    task.area || '',
    task.category || '',
    task.description || '',
    task.priority || 'Low',
    task.order || '',
    task.cost !== undefined && task.cost !== null ? String(task.cost) : '',
    task.state || 'Pending',
    task.dateCompleted || '',
    task.resourceLinks || ''
  ];
}

export function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCurrency(value) {
  const number = Number(value || 0);
  if (Number.isNaN(number)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(number);
}

export function normalizePriority(priority) {
  const value = String(priority || '').trim().toLowerCase();
  if (value === 'high') return 'High';
  if (value === 'medium') return 'Medium';
  if (value === 'low') return 'Low';
  return 'Low';
}

export function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const groupKey = item[key] || 'Unspecified';
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {});
}

export function getDefaultTask() {
  return {
    id: '',
    property: '',
    area: '',
    category: '',
    description: '',
    priority: 'Low',
    order: '',
    cost: 0,
    state: 'Pending',
    dateCompleted: '',
    resourceLinks: ''
  };
}
