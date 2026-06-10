export const SHEET_HEADERS = [
  'ID',
  'Property',
  'Interior/Exterior',
  'Upstairs/Downstairs',
  'Area',
  'Category',
  'Task Description',
  'Priority',
  'Order',
  'Cost ($)',
  'State',
  'Date Completed'
];

export function parseTaskRow(row = [], rowIndex) {
  return {
    rowIndex,
    id: row[0] || '',
    property: row[1] || '',
    interiorExterior: row[2] || '',
    upstairsDownstairs: row[3] || '',
    area: row[4] || '',
    category: row[5] || '',
    description: row[6] || '',
    priority: row[7] || 'Low',
    order: row[8] || '',
    cost: parseFloat(row[9]) || 0,
    state: row[10] || 'Pending',
    dateCompleted: row[11] || ''
  };
}

export function formatTaskRow(task) {
  return [
    task.id || '',
    task.property || '',
    task.interiorExterior || '',
    task.upstairsDownstairs || '',
    task.area || '',
    task.category || '',
    task.description || '',
    task.priority || 'Low',
    task.order || '',
    task.cost !== undefined && task.cost !== null ? String(task.cost) : '',
    task.state || 'Pending',
    task.dateCompleted || ''
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
    interiorExterior: '',
    upstairsDownstairs: '',
    area: '',
    category: '',
    description: '',
    priority: 'Low',
    order: '',
    cost: 0,
    state: 'Pending',
    dateCompleted: ''
  };
}
