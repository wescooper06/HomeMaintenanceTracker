import { formatDate, getDefaultTask } from './utils.js';
import { getAccessToken } from './auth.js';

const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '18la6E47KuiFWXFSIASd8QYbvxEo-ZJ7RaxnnuxIml9k';
const SHEET_NAME = 'Tasks';
const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

const FIELD_HEADER_ALIASES = {
  id: ['id'],
  property: ['property'],
  area: ['area'],
  category: ['category'],
  description: ['taskdescription', 'description', 'task'],
  priority: ['priority'],
  order: ['order'],
  cost: ['cost', 'cost$', 'costusd'],
  state: ['state', 'status'],
  dateCompleted: ['datecompleted', 'completeddate'],
  resourceLinks: ['resourcelinks', 'resourcelink', 'resources']
};

const DEFAULT_INDEXES = {
  id: 0,
  property: 1,
  area: 2,
  category: 3,
  description: 4,
  priority: 5,
  order: 6,
  cost: 7,
  state: 8,
  dateCompleted: 9,
  resourceLinks: 10
};

function buildUrl(path, query) {
  const url = new URL(`${BASE_URL}/${SPREADSHEET_ID}/${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  return url.toString();
}

function buildHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function parseOrder(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && Number.isInteger(number) ? number : null;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getColumnLetter(indexOneBased) {
  let value = indexOneBased;
  let letter = '';
  while (value > 0) {
    const rem = (value - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    value = Math.floor((value - 1) / 26);
  }
  return letter;
}

function resolveIndexes(headers = []) {
  const normalized = headers.map((header) => normalizeHeader(header));
  const indexes = {};

  Object.entries(FIELD_HEADER_ALIASES).forEach(([field, aliases]) => {
    const found = normalized.findIndex((header) => aliases.includes(header));
    indexes[field] = found >= 0 ? found : DEFAULT_INDEXES[field];
  });

  return indexes;
}

function maxIndex(indexes) {
  return Math.max(...Object.values(indexes).filter((value) => Number.isFinite(value)));
}

function getCellValue(row, index) {
  if (!Array.isArray(row)) return '';
  if (!Number.isFinite(index) || index < 0) return '';
  return row[index] ?? '';
}

function parseTaskFromRow(row = [], rowIndex, indexes) {
  return {
    rowIndex,
    id: getCellValue(row, indexes.id),
    property: getCellValue(row, indexes.property),
    area: getCellValue(row, indexes.area),
    category: getCellValue(row, indexes.category),
    description: getCellValue(row, indexes.description),
    priority: getCellValue(row, indexes.priority) || 'Low',
    order: getCellValue(row, indexes.order),
    cost: parseFloat(getCellValue(row, indexes.cost)) || 0,
    state: getCellValue(row, indexes.state) || 'Pending',
    dateCompleted: getCellValue(row, indexes.dateCompleted),
    resourceLinks: getCellValue(row, indexes.resourceLinks)
  };
}

function buildRowValues(task, indexes) {
  const rowLength = Math.max(maxIndex(indexes) + 1, 11);
  const row = Array(rowLength).fill('');
  row[indexes.id] = task.id || '';
  row[indexes.property] = task.property || '';
  row[indexes.area] = task.area || '';
  row[indexes.category] = task.category || '';
  row[indexes.description] = task.description || '';
  row[indexes.priority] = task.priority || 'Low';
  row[indexes.order] = task.order || '';
  row[indexes.cost] = task.cost !== undefined && task.cost !== null ? String(task.cost) : '';
  row[indexes.state] = task.state || 'Pending';
  row[indexes.dateCompleted] = task.dateCompleted || '';
  row[indexes.resourceLinks] = task.resourceLinks || '';
  return row;
}

async function getSheetLayout(token) {
  const headerUrl = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!1:1`, {
    valueRenderOption: 'FORMATTED_VALUE',
    t: Date.now()
  });
  const headerResponse = await fetch(headerUrl, { headers: buildHeaders(token), cache: 'no-store' });
  if (!headerResponse.ok) {
    throw new Error(`Unable to read sheet headers: ${headerResponse.statusText}`);
  }
  const headerData = await headerResponse.json();
  const headers = (headerData.values && headerData.values[0]) || [];
  const indexes = resolveIndexes(headers);
  const lastCol = getColumnLetter(Math.max(maxIndex(indexes) + 1, headers.length || 1));
  return { indexes, lastCol };
}

async function fetchTasks(token, layout) {
  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A2:${layout.lastCol}`, {
    valueRenderOption: 'FORMATTED_VALUE',
    t: Date.now()
  });
  const response = await fetch(url, { headers: buildHeaders(token), cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to fetch tasks: ${response.statusText}`);
  }
  const data = await response.json();
  const rows = data.values || [];
  return rows.map((row, index) => parseTaskFromRow(row, index + 2, layout.indexes));
}

async function writeTaskRow(rowIndex, task, layout) {
  const token = await getAccessToken();
  const sheetLayout = layout || await getSheetLayout(token);
  const body = {
    range: `${SHEET_NAME}!A${rowIndex}:${sheetLayout.lastCol}${rowIndex}`,
    majorDimension: 'ROWS',
    values: [buildRowValues(task, sheetLayout.indexes)]
  };
  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A${rowIndex}:${sheetLayout.lastCol}${rowIndex}`, {
    valueInputOption: 'RAW'
  });
  const response = await fetch(url, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Unable to write task row ${rowIndex}: ${response.statusText}`);
  }
  return response.json();
}

async function shiftTaskOrders(tasks, excludedRowIndex, targetOrder) {
  const token = await getAccessToken();
  const layout = await getSheetLayout(token);
  const orderTarget = parseOrder(targetOrder);
  if (orderTarget === null) return;

  const tasksToShift = tasks
    .filter((task) => task.rowIndex !== excludedRowIndex)
    .map((task) => ({ task, order: parseOrder(task.order) }))
    .filter(({ order }) => order !== null && order >= orderTarget)
    .sort((a, b) => a.order - b.order || a.task.rowIndex - b.task.rowIndex);

  let nextOrder = orderTarget;
  for (const { task } of tasksToShift) {
    nextOrder += 1;
    await writeTaskRow(task.rowIndex, { ...task, order: nextOrder }, layout);
  }
}

export async function getTasks() {
  const token = await getAccessToken();
  const layout = await getSheetLayout(token);
  return fetchTasks(token, layout);
}

export async function addTask(task) {
  const token = await getAccessToken();
  const layout = await getSheetLayout(token);
  // Ensure an ID exists for new tasks. If missing, scan the sheet for the
  // highest numeric ID and use highest+1. Preserve any existing ID.
  const normalizedTask = {
    ...getDefaultTask(),
    ...task,
    state: task.state || 'Pending'
  };

  if (!normalizedTask.id) {
    // Read current tasks to determine max numeric ID
    const existing = await fetchTasks(token, layout);
    const numericIds = existing
      .map((t) => Number(t.id))
      .filter((n) => Number.isFinite(n) && !Number.isNaN(n));
    const maxId = numericIds.length ? Math.max(...numericIds) : 0;
    normalizedTask.id = String(maxId + 1);
  }

  const insertOrder = parseOrder(normalizedTask.order);
  if (insertOrder !== null) {
    const existing = await fetchTasks(token, layout);
    await shiftTaskOrders(existing, null, insertOrder);
  }

  if (String(normalizedTask.state).toLowerCase() === 'complete' && !normalizedTask.dateCompleted) {
    normalizedTask.dateCompleted = formatDate(new Date());
  }

  const values = buildRowValues(normalizedTask, layout.indexes);
  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A:${layout.lastCol}:append`, {
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS'
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({ values: [values] })
  });

  if (!response.ok) {
    throw new Error(`Unable to add task: ${response.statusText}`);
  }

  // Try to return the created task (including rowIndex) by re-fetching
  // tasks and locating the one with the assigned id. This keeps callers
  // able to inspect the persisted task without changing existing flows.
  try {
    const data = await response.json();
    const refreshed = await fetchTasks(token, layout);
    const created = refreshed.find((t) => String(t.id) === String(normalizedTask.id));
    return created || data;
  } catch (e) {
    return response.json();
  }
}

export async function updateTask(rowIndex, values) {
  const token = await getAccessToken();
  const layout = await getSheetLayout(token);
  const tasks = await fetchTasks(token, layout);
  const existing = tasks.find((task) => task.rowIndex === rowIndex);
  if (!existing) {
    throw new Error(`Task at row ${rowIndex} not found.`);
  }

  const merged = {
    ...existing,
    ...values,
    priority: values.priority || existing.priority,
    state: values.state || existing.state,
    dateCompleted: values.dateCompleted || existing.dateCompleted
  };

  if (String(merged.state).toLowerCase() === 'complete' && !merged.dateCompleted) {
    merged.dateCompleted = formatDate(new Date());
  }

  const newOrder = parseOrder(values.order);
  const oldOrder = parseOrder(existing.order);
  if (newOrder !== null && newOrder !== oldOrder) {
    await shiftTaskOrders(tasks, rowIndex, newOrder);
  }

  const body = {
    range: `${SHEET_NAME}!A${rowIndex}:${layout.lastCol}${rowIndex}`,
    majorDimension: 'ROWS',
    values: [buildRowValues(merged, layout.indexes)]
  };

  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A${rowIndex}:${layout.lastCol}${rowIndex}`, {
    valueInputOption: 'RAW'
  });

  const response = await fetch(url, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Unable to update task: ${response.statusText}`);
  }
  return response.json();
}

async function getSheetId(token) {
  const url = buildUrl('', { fields: 'sheets.properties' });
  const response = await fetch(url, { headers: buildHeaders(token), cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to read spreadsheet metadata: ${response.statusText}`);
  }
  const data = await response.json();
  const sheet = (data.sheets || []).find((item) => item.properties && item.properties.title === SHEET_NAME);
  if (!sheet || !sheet.properties || typeof sheet.properties.sheetId !== 'number') {
    throw new Error(`Unable to find the sheet named ${SHEET_NAME}.`);
  }
  return sheet.properties.sheetId;
}

export async function deleteTask(rowIndex) {
  const token = await getAccessToken();
  const sheetId = await getSheetId(token);
  const url = buildUrl(':batchUpdate');
  const requestBody = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex
          }
        }
      }
    ]
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(requestBody)
    });
  } catch (error) {
    throw new Error(`Unable to delete task: ${error.message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Unable to delete task: ${response.status} ${response.statusText} - ${text}`);
  }
  return response.json();
}
