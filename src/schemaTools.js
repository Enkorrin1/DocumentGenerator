export const INPUT_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'textarea', label: 'Длинный текст' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Телефон' },
  { value: 'checkbox', label: 'Да/нет' },
];

const DEMO_VALUES = {
  'manager.fullName': 'Артем Данилецкий',
  'employee.fullName': 'Иван Иванов',
  'employee.name': 'Иван Иванов',
  'employee.position': 'инженер-программист',
  'employee.department': 'Отдел автоматизации',
  'employee.email': 'ivan.ivanov@example.com',
  'employee.phone': '+375 29 123-45-67',
  'vacation.startDate': '2026-07-01',
  'vacation.endDate': '2026-07-14',
  'vacation.days': '14',
  'dismissal.lastWorkDate': '2026-07-31',
  'dismissal.reason': 'по собственному желанию',
  'dayOff.date': '2026-06-15',
  'dayOff.hours': '8',
  'dayOff.reason': 'за ранее отработанное время',
  'trip.destination': 'Минск',
  'trip.startDate': '2026-07-03',
  'trip.endDate': '2026-07-05',
  'trip.purpose': 'участие в рабочей встрече с партнером',
  'certificate.destination': 'по месту требования',
  'certificate.purpose': 'для предоставления в организацию',
  'request.date': '2026-06-08',
  'documents[].index': '1',
  'documents[].title': 'График отпусков',
  'documents[].number': 'ОТ-2026-017',
  'documents[].date': '2026-06-01',
  reason: 'согласно утвержденному графику отпусков',
};

export function cloneSchema(schema) {
  return structuredClone(schema);
}

export function flattenFields(schema) {
  if (!schema) {
    return [];
  }

  if (schema.type === 'field') {
    return [schema];
  }

  if (schema.type === 'array') {
    return flattenFields(schema.item);
  }

  return Object.values(schema.children || {}).flatMap((child) => flattenFields(child));
}

export function createInitialData(node) {
  if (node.type === 'field') {
    if (node.defaultValue !== undefined && node.defaultValue !== '') {
      return node.defaultValue;
    }

    return node.inputType === 'checkbox' ? false : '';
  }

  if (node.type === 'array') {
    return [createArrayItemData(node.item, 0)];
  }

  return Object.fromEntries(Object.values(node.children || {}).map((child) => [child.key, createInitialData(child)]));
}

export function createArrayItemData(itemSchema, index = 0) {
  return applyArrayIndex(createInitialData(itemSchema), itemSchema, index);
}

export function reindexArrayData(itemSchema, items) {
  return items.map((item, index) => applyArrayIndex(item, itemSchema, index));
}

function applyArrayIndex(value, node, index) {
  if (node.type === 'field') {
    if (node.key === 'index' || node.path?.endsWith('[].index')) {
      return String(index + 1);
    }

    return value;
  }

  if (node.type === 'array') {
    const items = Array.isArray(value) ? value : [];
    return items.map((item, itemIndex) => applyArrayIndex(item, node.item, itemIndex));
  }

  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.values(node.children || {}).map((child) => [
    child.key,
    applyArrayIndex(source[child.key], child, index),
  ]));
}

export function applyDefaults(schema, data) {
  return mergeDefaults(schema, data);
}

function mergeDefaults(node, value) {
  if (node.type === 'field') {
    if (value === undefined || value === null || value === '') {
      return createInitialData(node);
    }
    return value;
  }

  if (node.type === 'array') {
    const source = Array.isArray(value) && value.length > 0 ? value : [undefined];
    return source.map((item) => mergeDefaults(node.item, item));
  }

  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.values(node.children || {}).map((child) => [child.key, mergeDefaults(child, source[child.key])]));
}

export function generateDemoData(schema) {
  return generateDemoNode(schema);
}

function generateDemoNode(node) {
  if (node.type === 'field') {
    if (DEMO_VALUES[node.path] !== undefined) {
      return DEMO_VALUES[node.path];
    }

    if (node.inputType === 'date') {
      return '2026-06-08';
    }

    if (node.inputType === 'number') {
      return '1';
    }

    if (node.inputType === 'email') {
      return 'user@example.com';
    }

    if (node.inputType === 'tel') {
      return '+375 29 000-00-00';
    }

    if (node.inputType === 'checkbox') {
      return true;
    }

    return `${node.label}`;
  }

  if (node.type === 'array') {
    return [generateDemoNode(node.item), generateDemoNodeWithIndex(node.item, 2)];
  }

  return Object.fromEntries(Object.values(node.children || {}).map((child) => [child.key, generateDemoNode(child)]));
}

function generateDemoNodeWithIndex(node, index) {
  if (node.type === 'field') {
    if (node.path?.endsWith('[].index')) {
      return String(index);
    }

    if (node.path?.endsWith('[].title')) {
      return index === 2 ? 'Копия трудового договора' : generateDemoNode(node);
    }

    if (node.path?.endsWith('[].number')) {
      return index === 2 ? 'ТД-2024-042' : generateDemoNode(node);
    }

    return generateDemoNode(node);
  }

  if (node.type === 'array') {
    return [generateDemoNodeWithIndex(node.item, index)];
  }

  return Object.fromEntries(Object.values(node.children || {}).map((child) => [child.key, generateDemoNodeWithIndex(child, index)]));
}

export function updateFieldSetting(schema, fieldPath, patch) {
  const next = cloneSchema(schema);
  mutateField(next, fieldPath, patch);
  return next;
}

function mutateField(node, fieldPath, patch) {
  if (node.type === 'field') {
    if (node.path === fieldPath) {
      Object.assign(node, patch);
    }
    return;
  }

  if (node.type === 'array') {
    mutateField(node.item, fieldPath, patch);
    return;
  }

  for (const child of Object.values(node.children || {})) {
    mutateField(child, fieldPath, patch);
  }
}

export function validateData(schema, data) {
  const errors = {};
  validateNode(schema, data, [], errors);
  return errors;
}

function validateNode(node, value, path, errors) {
  if (node.type === 'object') {
    for (const child of Object.values(node.children || {})) {
      validateNode(child, value?.[child.key], [...path, child.key], errors);
    }
    return;
  }

  if (node.type === 'array') {
    if (!Array.isArray(value) || value.length === 0) {
      errors[stringifyPath(path)] = `Добавьте хотя бы одну запись в "${node.label}"`;
      return;
    }

    value.forEach((item, index) => validateNode(node.item, item, [...path, index], errors));
    return;
  }

  if (!node.required || node.inputType === 'checkbox') {
    return;
  }

  if (value === undefined || value === null || String(value).trim() === '') {
    errors[stringifyPath(path)] = `Заполните поле "${node.label}"`;
    return;
  }

  if (node.inputType === 'number' && Number.isNaN(Number(value))) {
    errors[stringifyPath(path)] = `Поле "${node.label}" должно быть числом`;
  }

  if (node.inputType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
    errors[stringifyPath(path)] = `Поле "${node.label}" должно быть email-адресом`;
  }
}

export function coerceData(node, value) {
  if (node.type === 'field') {
    if (node.inputType === 'number' && value !== '') {
      return Number(value);
    }

    if (node.inputType === 'checkbox') {
      return Boolean(value);
    }

    return value ?? '';
  }

  if (node.type === 'array') {
    return Array.isArray(value) ? value.map((item) => coerceData(node.item, item)) : [];
  }

  return Object.fromEntries(Object.values(node.children || {}).map((child) => [child.key, coerceData(child, value?.[child.key])]));
}

export function updateAtPath(source, path, value) {
  if (path.length === 0) {
    return value;
  }

  const [head, ...rest] = path;

  if (typeof head === 'number') {
    const next = Array.isArray(source) ? [...source] : [];
    next[head] = updateAtPath(next[head], rest, value);
    return next;
  }

  return {
    ...(source || {}),
    [head]: updateAtPath(source?.[head], rest, value),
  };
}

export function clearErrorBranch(errors, pathKey) {
  return Object.fromEntries(Object.entries(errors).filter(([key]) => key !== pathKey && !key.startsWith(`${pathKey}.`)));
}

export function stringifyPath(path) {
  return path.map((part) => String(part)).join('.');
}

export function getSchemaProfile(schema, sourceProfile) {
  const fields = flattenFields(schema);
  const typeCounts = fields.reduce((acc, field) => {
    acc[field.inputType] = (acc[field.inputType] || 0) + 1;
    return acc;
  }, {});
  const arrays = countNodes(schema, 'array');
  const groups = Math.max(0, countNodes(schema, 'object') - 1);
  const weak = fields.filter((field) => (field.smart?.confidence || 0) < 0.7).length;
  const warnings = [...(sourceProfile?.warnings || [])];

  if (weak > 0 && !warnings.some((warning) => warning.includes('низкой уверенностью'))) {
    warnings.push(`Для ${weak} полей тип определен с низкой уверенностью.`);
  }

  return {
    score: Math.max(55, 100 - warnings.length * 10 - weak * 2),
    summary: {
      tags: sourceProfile?.summary?.tags || 0,
      fields: fields.length,
      groups,
      arrays,
      required: fields.filter((field) => field.required).length,
      typeCounts,
    },
    warnings,
    capabilities: [
      fields.length > 0 ? 'Динамическая форма' : null,
      arrays > 0 ? 'Повторяемые блоки' : null,
      Object.keys(typeCounts).length > 1 ? 'Автоопределение типов' : null,
      groups > 0 ? 'Вложенный JSON' : null,
    ].filter(Boolean),
  };
}

export function getCompletionState(schema, data) {
  const required = [];
  collectRequiredFields(schema, data, [], [], required);

  const filled = required.filter((field) => field.filled);
  const missing = required.filter((field) => !field.filled);
  const percent = required.length === 0 ? 100 : Math.round((filled.length / required.length) * 100);

  return {
    total: required.length,
    filled: filled.length,
    missing,
    percent,
    ready: missing.length === 0,
  };
}

function collectRequiredFields(node, value, path, sectionPath, result) {
  if (!node) {
    return;
  }

  if (node.type === 'object') {
    const source = value && typeof value === 'object' ? value : {};
    const nextSectionPath = node.key === 'root' ? sectionPath : [...sectionPath, node.label];
    const children = Object.values(node.children || {});
    const orderedChildren = [
      ...children.filter((child) => child.type === 'field'),
      ...children.filter((child) => child.type !== 'field'),
    ];

    for (const child of orderedChildren) {
      collectRequiredFields(child, source[child.key], [...path, child.key], nextSectionPath, result);
    }
    return;
  }

  if (node.type === 'array') {
    const items = Array.isArray(value) && value.length > 0 ? value : [undefined];
    items.forEach((item, index) => {
      collectRequiredFields(node.item, item, [...path, index], [...sectionPath, node.label], result);
    });
    return;
  }

  if (!node.required) {
    return;
  }

  const filled = node.inputType === 'checkbox'
    ? true
    : value !== undefined && value !== null && String(value).trim() !== '';

  result.push({
    label: node.label,
    section: sectionPath.at(-1) || 'Документ',
    path,
    filled,
  });
}

export function getFormSections(schema) {
  if (!schema || schema.type !== 'object') {
    return [];
  }

  return Object.values(schema.children || {})
    .filter((child) => child.type !== 'field')
    .map((child) => ({
      key: child.key,
      label: child.label,
      type: child.type,
    }));
}

export function getSectionProgress(schema, data) {
  if (!schema || schema.type !== 'object') {
    return [];
  }

  return Object.values(schema.children || {})
    .filter((child) => child.type !== 'field')
    .map((child) => {
      const required = [];
      collectRequiredFields(child, data?.[child.key], [child.key], [], required);
      const filled = required.filter((field) => field.filled).length;
      const total = required.length;

      return {
        key: child.key,
        label: child.label,
        total,
        filled,
        missing: total - filled,
        percent: total === 0 ? 100 : Math.round((filled / total) * 100),
        ready: total === filled,
      };
    });
}

function countNodes(node, type) {
  if (!node) {
    return 0;
  }

  let count = node.type === type ? 1 : 0;

  if (node.type === 'array') {
    return count + countNodes(node.item, type);
  }

  if (node.type === 'object') {
    for (const child of Object.values(node.children || {})) {
      count += countNodes(child, type);
    }
  }

  return count;
}
