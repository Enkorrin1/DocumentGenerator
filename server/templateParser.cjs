const path = require('node:path');
const PizZip = require('pizzip');
const { XMLParser } = require('fast-xml-parser');

const WORD_XML_FILE = /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/;

const TYPE_RULES = [
  { type: 'date', confidence: 0.96, reason: 'Название похоже на дату', pattern: /(date|birth|birthday|issued|created|updated|signed|start|end|дата|рожд|начало|конец|выдач|подпис)/i },
  { type: 'email', confidence: 0.98, reason: 'Название похоже на email', pattern: /(email|e-mail|mail|почта)/i },
  { type: 'tel', confidence: 0.95, reason: 'Название похоже на телефон', pattern: /(phone|tel|mobile|fax|телефон|моб)/i },
  { type: 'number', confidence: 0.88, reason: 'Название похоже на число', pattern: /(amount|sum|price|salary|total|count|qty|quantity|number|rate|percent|days|hours|index|сумма|стоим|зарплат|количество|номер|процент|дней|час)/i },
  { type: 'checkbox', confidence: 0.82, reason: 'Название похоже на boolean-флаг', pattern: /(^|\.)(is|has|can|should|allow|enable|active|approved|visible|required)[A-Z._-]?/i },
  { type: 'textarea', confidence: 0.86, reason: 'Название похоже на длинный текст', pattern: /(comment|description|reason|note|address|details|body|text|комментарий|описание|причина|основание|адрес|текст|детали)/i },
];

const LABELS = {
  'manager.fullName': 'ФИО руководителя',
  'employee.fullName': 'ФИО сотрудника',
  'employee.name': 'Имя сотрудника',
  'employee.position': 'Должность',
  'employee.department': 'Подразделение',
  'employee.email': 'Email',
  'employee.phone': 'Телефон',
  'vacation.startDate': 'Дата начала отпуска',
  'vacation.endDate': 'Дата окончания отпуска',
  'vacation.days': 'Количество дней',
  'dismissal.lastWorkDate': 'Последний рабочий день',
  'dismissal.reason': 'Причина увольнения',
  'dayOff.date': 'Дата отгула',
  'dayOff.hours': 'Количество часов',
  'dayOff.reason': 'Основание',
  'trip.destination': 'Место командировки',
  'trip.startDate': 'Дата начала командировки',
  'trip.endDate': 'Дата окончания командировки',
  'trip.purpose': 'Цель командировки',
  'certificate.destination': 'Место предоставления',
  'certificate.purpose': 'Цель выдачи',
  'request.date': 'Дата заявления',
  'documents[].index': '№',
  'documents[].title': 'Название документа',
  'documents[].number': 'Номер документа',
  'documents[].date': 'Дата документа',
  reason: 'Основание',
  fullName: 'ФИО',
  name: 'Имя',
  position: 'Должность',
  department: 'Подразделение',
  email: 'Email',
  phone: 'Телефон',
  startDate: 'Дата начала',
  endDate: 'Дата окончания',
  date: 'Дата',
  days: 'Количество дней',
  reason: 'Основание',
  title: 'Название',
  number: 'Номер',
  index: '№',
  amount: 'Сумма',
  address: 'Адрес',
  comment: 'Комментарий',
  description: 'Описание',
};

const GROUP_LABELS = {
  employee: 'Сотрудник',
  manager: 'Руководитель',
  vacation: 'Отпуск',
  dismissal: 'Увольнение',
  dayOff: 'Отгул',
  trip: 'Командировка',
  certificate: 'Справка',
  request: 'Заявление',
  documents: 'Документы',
  items: 'Строки',
  children: 'Дети',
  organization: 'Организация',
  company: 'Компания',
};

const TYPE_OVERRIDES = {
  'documents[].number': {
    inputType: 'text',
    confidence: 0.94,
    reason: 'Номер документа может содержать буквы, дефисы и префиксы',
  },
};

function parseTemplate(buffer) {
  const zip = new PizZip(buffer);
  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: true,
    processEntities: true,
  });

  const textParts = [];
  const files = zip.file(WORD_XML_FILE);

  for (const file of files) {
    const xml = file.asText();
    const parsed = xmlParser.parse(xml);
    collectWordText(parsed, textParts);
  }

  const text = textParts.join('');
  const tags = extractCarboneTags(text);
  const references = extractDataReferences(tags);
  const schema = buildSchema(references);
  const fields = flattenFields(schema);
  const previewText = buildPreviewText(zip);

  return {
    tags,
    fields,
    schema,
    previewText,
    profile: buildTemplateProfile({ tags, fields, schema }),
  };
}

function buildPreviewText(zip) {
  const files = zip.file(/^word\/document\.xml$/);
  const paragraphs = [];

  for (const file of files) {
    const xml = file.asText();
    paragraphs.push(...extractParagraphTexts(xml));
  }

  return normalizePreviewText(paragraphs.join('\n'));
}

function extractParagraphTexts(xml) {
  const paragraphs = [];
  const paragraphRegex = /<(?:\w+:)?p\b[\s\S]*?<\/(?:\w+:)?p>/g;
  let match;

  while ((match = paragraphRegex.exec(xml)) !== null) {
    const text = extractInlineText(match[0]);

    if (text.trim()) {
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

function extractInlineText(xml) {
  const parts = [];
  const tokenRegex = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>|<(?:\w+:)?tab\b[^>]*\/>|<(?:\w+:)?br\b[^>]*\/>/g;
  let match;

  while ((match = tokenRegex.exec(xml)) !== null) {
    if (match[1] !== undefined) {
      parts.push(decodeXml(match[1]));
      continue;
    }

    if (/br\b/.test(match[0])) {
      parts.push('\n');
    } else {
      parts.push(' ');
    }
  }

  return parts.join('');
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function normalizePreviewText(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function collectWordText(node, textParts) {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectWordText(child, textParts);
    }
    return;
  }

  if (!node || typeof node !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'w:t' || key.endsWith(':t')) {
      collectTextNodeValue(value, textParts);
      continue;
    }

    if (key !== ':@') {
      collectWordText(value, textParts);
    }
  }
}

function collectTextNodeValue(value, textParts) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextNodeValue(item, textParts);
    }
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    textParts.push(String(value));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === '#text') {
      textParts.push(String(child));
    } else if (key !== ':@') {
      collectTextNodeValue(child, textParts);
    }
  }
}

function extractCarboneTags(text) {
  const tags = new Set();
  const tagRegex = /\{[^{}]*\bd(?=\.|\[)[^{}]*\}/g;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    tags.add(match[0]);
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function extractDataReferences(tags) {
  const byPath = new Map();

  for (const tag of tags) {
    const expression = tag.slice(1, -1).trim();
    const rawReferences = readDataReferences(expression);

    for (const rawReference of rawReferences) {
      const parsed = parseDataPath(rawReference);
      if (!parsed || parsed.parts.length === 0) {
        continue;
      }

      const existing = byPath.get(parsed.normalizedPath);
      if (existing) {
        existing.tags.push(tag);
      } else {
        byPath.set(parsed.normalizedPath, {
          ...parsed,
          tags: [tag],
        });
      }
    }
  }

  return Array.from(byPath.values()).sort((a, b) => a.normalizedPath.localeCompare(b.normalizedPath));
}

function readDataReferences(expression) {
  const references = [];
  const dataRefRegex = /(^|[^A-Za-z0-9_$])d(?=\.|\[)/g;
  let match;

  while ((match = dataRefRegex.exec(expression)) !== null) {
    const start = match.index + match[1].length;
    let cursor = start + 1;
    let bracketDepth = 0;
    let quote = null;

    while (cursor < expression.length) {
      const char = expression[cursor];

      if (quote) {
        if (char === quote && expression[cursor - 1] !== '\\') {
          quote = null;
        }
        cursor += 1;
        continue;
      }

      if (char === '\'' || char === '"') {
        quote = char;
        cursor += 1;
        continue;
      }

      if (char === '[') {
        bracketDepth += 1;
        cursor += 1;
        continue;
      }

      if (char === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
        cursor += 1;
        continue;
      }

      if (bracketDepth === 0 && (char === ':' || char === ',' || char === ')' || char === '{' || char === '}' || /\s/.test(char))) {
        break;
      }

      cursor += 1;
    }

    references.push(expression.slice(start, cursor));
    dataRefRegex.lastIndex = cursor;
  }

  return references;
}

function parseDataPath(reference) {
  let expression = reference.trim();

  if (!expression.startsWith('d')) {
    return null;
  }

  expression = expression.slice(1);
  if (expression.startsWith('.')) {
    expression = expression.slice(1);
  }

  if (!expression) {
    return null;
  }

  const tokens = splitPath(expression);
  const parts = [];

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    const bracketMatches = [...token.matchAll(/\[([^\]]*)\]/g)];
    const key = token.replace(/\[[^\]]*\]/g, '').trim();
    const isArray = bracketMatches.length > 0;

    if (!key && isArray) {
      parts.push({ key: null, kind: 'array', root: true });
      continue;
    }

    if (!key || key.startsWith('.')) {
      continue;
    }

    parts.push({
      key,
      kind: isArray ? 'array' : 'property',
      root: false,
    });
  }

  if (parts.length === 0) {
    return null;
  }

  const normalizedPath = parts.map((part) => {
    if (part.root) {
      return '[]';
    }
    return part.kind === 'array' ? `${part.key}[]` : part.key;
  }).join('.');
  const smart = inferField(normalizedPath, parts.at(-1)?.key || 'items');

  return {
    parts,
    normalizedPath,
    label: smart.label,
    inputType: smart.inputType,
    smart,
  };
}

function splitPath(expression) {
  const tokens = [];
  let current = '';
  let bracketDepth = 0;

  for (const char of expression) {
    if (char === '[') {
      bracketDepth += 1;
      current += char;
      continue;
    }

    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += char;
      continue;
    }

    if (char === '.' && bracketDepth === 0) {
      tokens.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function buildSchema(references) {
  const hasRootArray = references.some((reference) => reference.parts[0]?.root);
  const hasRootObject = references.some((reference) => !reference.parts[0]?.root);
  const root = hasRootArray && !hasRootObject
    ? { type: 'array', key: null, label: 'Записи', item: createObjectNode('item', 'Запись') }
    : createObjectNode('root', 'Документ');

  for (const reference of references) {
    insertReference(root, reference);
  }

  return root;
}

function insertReference(root, reference) {
  let parts = reference.parts;
  let node = root;

  if (root.type === 'array' && parts[0]?.root) {
    parts = parts.slice(1);
    node = root.item;
  }

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const isLeaf = index === parts.length - 1;

    if (part.root) {
      continue;
    }

    if (part.kind === 'array') {
      node.children[part.key] ||= {
        type: 'array',
        key: part.key,
        label: buildGroupLabel(part.key),
        item: createObjectNode(`${part.key}Item`, 'Запись'),
      };
      node = node.children[part.key].item;
      continue;
    }

    if (isLeaf) {
      node.children[part.key] ||= {
        type: 'field',
        key: part.key,
        label: reference.label,
        inputType: reference.inputType,
        required: true,
        defaultValue: defaultValueFor(reference.inputType, reference.normalizedPath),
        placeholder: placeholderFor(reference.inputType),
        path: reference.normalizedPath,
        tags: [],
        smart: reference.smart,
      };
      node.children[part.key].tags = unique([...node.children[part.key].tags, ...reference.tags]);
      continue;
    }

    node.children[part.key] ||= createObjectNode(part.key, buildGroupLabel(part.key));
    node = node.children[part.key];
  }
}

function createObjectNode(key, label) {
  return {
    type: 'object',
    key,
    label,
    children: {},
  };
}

function flattenFields(schema) {
  if (schema.type === 'field') {
    return [{
      key: schema.key,
      label: schema.label,
      inputType: schema.inputType,
      required: schema.required,
      defaultValue: schema.defaultValue,
      placeholder: schema.placeholder,
      path: schema.path,
      tags: schema.tags,
      smart: schema.smart,
    }];
  }

  if (schema.type === 'array') {
    return flattenFields(schema.item);
  }

  return Object.values(schema.children).flatMap((child) => flattenFields(child));
}

function inferField(normalizedPath, key) {
  const label = LABELS[normalizedPath] || LABELS[key] || buildLabel(key);
  const override = TYPE_OVERRIDES[normalizedPath];

  if (override) {
    return {
      label,
      ...override,
    };
  }

  const searchable = `${normalizedPath}.${key}`;
  const rule = TYPE_RULES.find((candidate) => candidate.pattern.test(searchable));

  return {
    label,
    inputType: rule?.type || 'text',
    confidence: rule?.confidence || 0.62,
    reason: rule?.reason || 'Тип выбран как текст по умолчанию',
  };
}

function buildGroupLabel(key) {
  return GROUP_LABELS[key] || buildLabel(key);
}

function buildLabel(key) {
  if (!key) {
    return 'Поле';
  }

  return key
    .replace(/([a-zа-яё])([A-ZА-ЯЁ])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function defaultValueFor(type, fieldPath) {
  if (type === 'checkbox') {
    return false;
  }

  if (type === 'date' && /(request|created|signed|date$)/i.test(fieldPath)) {
    return new Date().toISOString().slice(0, 10);
  }

  return '';
}

function placeholderFor(type) {
  const placeholders = {
    text: 'Введите значение',
    textarea: 'Введите текст',
    number: '0',
    date: 'гггг-мм-дд',
    email: 'name@example.com',
    tel: '+375 XX XXX-XX-XX',
    checkbox: '',
  };

  return placeholders[type] || 'Введите значение';
}

function buildTemplateProfile({ tags, fields, schema }) {
  const arrays = countNodes(schema, 'array');
  const groups = countNodes(schema, 'object') - 1;
  const typeCounts = fields.reduce((acc, field) => {
    acc[field.inputType] = (acc[field.inputType] || 0) + 1;
    return acc;
  }, {});
  const lowConfidenceFields = fields.filter((field) => (field.smart?.confidence || 0) < 0.7);
  const warnings = [];

  if (tags.length === 0) {
    warnings.push('В шаблоне не найдено Carbone-плейсхолдеров вида {d...}.');
  }

  if (fields.length > 35) {
    warnings.push('Полей много: стоит проверить группировку и обязательность перед использованием.');
  }

  if (lowConfidenceFields.length > 0) {
    warnings.push(`Для ${lowConfidenceFields.length} полей тип определен с низкой уверенностью.`);
  }

  const score = Math.max(54, 100 - warnings.length * 12 - lowConfidenceFields.length * 2);

  return {
    score,
    summary: {
      tags: tags.length,
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
      groups > 0 ? 'Вложенная структура JSON' : null,
    ].filter(Boolean),
  };
}

function countNodes(node, type) {
  let count = node.type === type ? 1 : 0;

  if (node.type === 'array') {
    return count + countNodes(node.item, type);
  }

  if (node.type === 'object') {
    for (const child of Object.values(node.children)) {
      count += countNodes(child, type);
    }
  }

  return count;
}

function unique(items) {
  return Array.from(new Set(items));
}

function buildTemplateName(originalName) {
  return path.basename(repairFilenameEncoding(originalName || 'template.docx')).replace(/[^\p{L}\p{N}_. -]/gu, '_');
}

function repairFilenameEncoding(filename) {
  if (!/[ÐÑ]/.test(filename)) {
    return filename;
  }

  try {
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch {
    return filename;
  }
}

module.exports = {
  parseTemplate,
  buildTemplateName,
};
