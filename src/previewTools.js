const TAG_PATTERN = /\{[^{}]*\bd(?=\.|\[)[^{}]*\}/g;

export function buildLivePreview(templateText, data, schema) {
  const source = templateText || '';
  const segments = [];
  const labels = buildLabelLookup(schema);
  const stats = {
    total: 0,
    filled: 0,
    missing: 0,
  };

  let cursor = 0;
  let match;

  while ((match = TAG_PATTERN.exec(source)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: 'text', text: source.slice(cursor, match.index) });
    }

    const resolved = resolveTag(match[0], data, labels);
    stats.total += 1;

    if (resolved.filled) {
      stats.filled += 1;
      segments.push({ type: 'value', text: resolved.text, raw: match[0] });
    } else {
      stats.missing += 1;
      segments.push({ type: 'placeholder', text: resolved.label, raw: match[0] });
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    segments.push({ type: 'text', text: source.slice(cursor) });
  }

  return {
    lines: splitSegmentsIntoLines(segments),
    stats,
    hasTemplateText: source.trim().length > 0,
  };
}

function resolveTag(tag, data, labels) {
  const reference = readFirstDataReference(tag.slice(1, -1).trim());
  const label = reference ? labels.get(normalizeReferencePath(reference)) || formatReferenceLabel(reference) : 'Поле';

  if (!reference) {
    return { filled: false, label, text: '' };
  }

  const value = getValueAtPath(data, parseReferencePath(reference));
  const text = formatPreviewValue(value);

  return {
    filled: text.length > 0,
    label,
    text,
  };
}

function readFirstDataReference(expression) {
  const dataRefRegex = /(^|[^A-Za-z0-9_$])d(?=\.|\[)/g;
  const match = dataRefRegex.exec(expression);

  if (!match) {
    return '';
  }

  let cursor = match.index + match[1].length + 1;
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

  return expression.slice(match.index + match[1].length, cursor);
}

function parseReferencePath(reference) {
  let expression = reference.trim();

  if (expression.startsWith('d')) {
    expression = expression.slice(1);
  }

  if (expression.startsWith('.')) {
    expression = expression.slice(1);
  }

  return splitPath(expression).flatMap((token) => {
    const key = token.replace(/\[[^\]]*\]/g, '').trim();
    const indexes = [...token.matchAll(/\[([^\]]*)\]/g)].map((match) => parsePreviewIndex(match[1]));

    return [key, ...indexes].filter((part) => part !== '');
  });
}

function normalizeReferencePath(reference) {
  let expression = reference.trim();

  if (expression.startsWith('d')) {
    expression = expression.slice(1);
  }

  if (expression.startsWith('.')) {
    expression = expression.slice(1);
  }

  return splitPath(expression)
    .map((token) => {
      const key = token.replace(/\[[^\]]*\]/g, '').trim();
      const hasArray = /\[[^\]]*\]/.test(token);
      return hasArray ? `${key}[]` : key;
    })
    .filter(Boolean)
    .join('.');
}

function buildLabelLookup(schema) {
  const labels = new Map();

  collectFieldLabels(schema, labels);
  return labels;
}

function collectFieldLabels(node, labels) {
  if (!node) {
    return;
  }

  if (node.type === 'field') {
    labels.set(node.path, node.label);

    for (const tag of node.tags || []) {
      const reference = readFirstDataReference(tag.slice(1, -1).trim());
      if (reference) {
        labels.set(normalizeReferencePath(reference), node.label);
      }
    }

    return;
  }

  if (node.type === 'array') {
    collectFieldLabels(node.item, labels);
    return;
  }

  for (const child of Object.values(node.children || {})) {
    collectFieldLabels(child, labels);
  }
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

function parsePreviewIndex(expression) {
  const source = String(expression || '').replace(/\s+/g, '');

  if (!source || source === 'i') {
    return 0;
  }

  const offsetMatch = source.match(/^i\+(\d+)$/);
  if (offsetMatch) {
    return Number(offsetMatch[1]);
  }

  if (/^\d+$/.test(source)) {
    return Number(source);
  }

  return 0;
}

function getValueAtPath(source, path) {
  return path.reduce((value, part) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    return value[part];
  }, source);
}

function formatPreviewValue(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Да' : 'Нет';
  }

  if (Array.isArray(value)) {
    return value.length ? `${value.length} записей` : '';
  }

  if (typeof value === 'object') {
    return '';
  }

  return String(value);
}

function formatReferenceLabel(reference) {
  return reference
    .replace(/^d\.?/, '')
    .replace(/\[[^\]]*\]/g, '')
    .split('.')
    .filter(Boolean)
    .at(-1) || 'Поле';
}

function splitSegmentsIntoLines(segments) {
  const lines = [[]];

  for (const segment of segments) {
    const pieces = segment.text.split('\n');

    pieces.forEach((piece, index) => {
      if (index > 0) {
        lines.push([]);
      }

      if (piece) {
        lines.at(-1).push({ ...segment, text: piece });
      }
    });
  }

  return lines.filter((line) => line.length > 0);
}
