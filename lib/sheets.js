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
  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A2:K`, {
    valueRenderOption: 'FORMATTED_VALUE'
  });
  const response = await fetch(url, { headers: buildHeaders(token) });
  if (!response.ok) {
    throw new Error(`Unable to fetch tasks: ${response.statusText}`);
  }
  const data = await response.json();
  const rows = data.values || [];
  return rows.map((row, index) => parseTaskRow(row, index + 2));
}

export async function addTask(task) {
  const token = await getAccessToken();
  const normalizedTask = {
    ...getDefaultTask(),
    ...task,
    state: task.state || 'Pending'
  };

  if (String(normalizedTask.state).toLowerCase() === 'complete' && !normalizedTask.dateCompleted) {
    normalizedTask.dateCompleted = formatDate(new Date());
  }

  const values = formatTaskRow(normalizedTask);
  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A:K:append`, {
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
  return response.json();
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
    range: `${SHEET_NAME}!A${rowIndex}:K${rowIndex}`,
    majorDimension: 'ROWS',
    values: [formatTaskRow(merged)]
  };

  const url = buildUrl(`values/${encodeURIComponent(SHEET_NAME)}!A${rowIndex}:K${rowIndex}`, {
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
  const response = await fetch(url, { headers: buildHeaders(token) });
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
  const url = buildUrl('batchUpdate');
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

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Unable to delete task: ${response.statusText}`);
  }
  return response.json();
}
