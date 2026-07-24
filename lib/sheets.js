import { parseTaskRow, formatTaskRow, formatDate, getDefaultTask } from './utils.js';
import { getAccessToken } from './auth.js';

const SPREADSHEET_ID = window.GOOGLE_SPREADSHEET_ID || '18la6E47KuiFWXFSIASd8QYbvxEo-ZJ7RaxnnuxIml9k';
const SHEET_NAME = 'Tasks';
const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

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

export async function getTasks() {
  const token = await getAccessToken();
  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A2:ZZ`, {
    valueRenderOption: 'FORMATTED_VALUE',
    t: Date.now()
  });
  const response = await fetch(url, { headers: buildHeaders(token), cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to fetch tasks: ${response.statusText}`);
  }
  const data = await response.json();
  const rows = data.values || [];
  return rows.map((row, index) => parseTaskRow(row, index + 2));
}

export async function addTask(task) {
  const token = await getAccessToken();
  // Ensure an ID exists for new tasks. If missing, scan the sheet for the
  // highest numeric ID and use highest+1. Preserve any existing ID.
  const normalizedTask = {
    ...getDefaultTask(),
    ...task,
    state: task.state || 'Pending'
  };

  if (!normalizedTask.id) {
    // Read current tasks to determine max numeric ID
    const existing = await getTasks();
    const numericIds = existing
      .map((t) => Number(t.id))
      .filter((n) => Number.isFinite(n) && !Number.isNaN(n));
    const maxId = numericIds.length ? Math.max(...numericIds) : 0;
    normalizedTask.id = String(maxId + 1);
  }

  if (String(normalizedTask.state).toLowerCase() === 'complete' && !normalizedTask.dateCompleted) {
    normalizedTask.dateCompleted = formatDate(new Date());
  }

  const values = formatTaskRow(normalizedTask);
  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A:L:append`, {
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
    const refreshed = await getTasks();
    const created = refreshed.find((t) => String(t.id) === String(normalizedTask.id));
    return created || data;
  } catch (e) {
    return response.json();
  }
}

export async function updateTask(rowIndex, values) {
  const token = await getAccessToken();
  const tasks = await getTasks();
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

  const body = {
    range: `${SHEET_NAME}!A${rowIndex}:L${rowIndex}`,
    majorDimension: 'ROWS',
    values: [formatTaskRow(merged)]
  };

  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A${rowIndex}:L${rowIndex}`, {
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
