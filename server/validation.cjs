function validateData(schema, data) {
  const errors = [];
  validateNode(schema, data, [], errors);
  return errors;
}

function validateNode(node, value, path, errors) {
  if (node.type === 'object') {
    const source = isPlainObject(value) ? value : {};
    for (const child of Object.values(node.children || {})) {
      validateNode(child, source[child.key], [...path, child.key], errors);
    }
    return;
  }

  if (node.type === 'array') {
    if (!Array.isArray(value) || value.length === 0) {
      errors.push({
        path: stringifyPath(path),
        message: `Добавьте хотя бы одну запись в "${node.label}"`,
      });
      return;
    }

    value.forEach((item, index) => {
      validateNode(node.item, item, [...path, index], errors);
    });
    return;
  }

  if (!node.required || node.inputType === 'checkbox') {
    return;
  }

  if (value === undefined || value === null || String(value).trim() === '') {
    errors.push({
      path: stringifyPath(path),
      message: `Заполните поле "${node.label}"`,
    });
    return;
  }

  if (node.inputType === 'number' && Number.isNaN(Number(value))) {
    errors.push({
      path: stringifyPath(path),
      message: `Поле "${node.label}" должно быть числом`,
    });
  }

  if (node.inputType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
    errors.push({
      path: stringifyPath(path),
      message: `Поле "${node.label}" должно быть email-адресом`,
    });
  }
}

function stringifyPath(path) {
  return path.map((part) => String(part)).join('.');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  validateData,
};
