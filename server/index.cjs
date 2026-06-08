const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const carbone = require('carbone');
const { parseTemplate, buildTemplateName } = require('./templateParser.cjs');
const { validateData } = require('./validation.cjs');
const { BUILT_IN_TEMPLATES } = require('./builtInTemplates.cjs');

const app = express();
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';
const clientDistDir = path.join(__dirname, '..', 'dist');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const uploadDir = path.join(__dirname, 'uploads');
const generatedDir = path.join(__dirname, 'generated');
const libraryDir = path.join(__dirname, '..', 'templates', 'library');
const templates = new Map();

app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/template-library', async (_request, response, next) => {
  try {
    const libraryTemplates = await Promise.all(BUILT_IN_TEMPLATES.map((template) => getLibraryTemplate(template.slug)));
    response.json({
      templates: libraryTemplates.map(publicLibraryTemplate),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/template-library/:slug/select', async (request, response, next) => {
  try {
    const template = await getLibraryTemplate(request.params.slug);

    if (!template) {
      response.status(404).json({ error: 'Готовый шаблон не найден.' });
      return;
    }

    response.json(publicTemplate(template));
  } catch (error) {
    next(error);
  }
});

app.post('/api/templates', upload.single('template'), async (request, response, next) => {
  try {
    const file = request.file;

    if (!file) {
      response.status(400).json({ error: 'Загрузите DOCX-шаблон.' });
      return;
    }

    if (!file.originalname.toLowerCase().endsWith('.docx')) {
      response.status(400).json({ error: 'Поддерживаются только DOCX-шаблоны.' });
      return;
    }

    const parsed = parseTemplate(file.buffer);
    const id = randomUUID();
    const safeName = buildTemplateName(file.originalname);
    const templatePath = path.join(uploadDir, `${id}-${safeName}`);

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(templatePath, file.buffer);

    const template = {
      id,
      name: safeName,
      path: templatePath,
      tags: parsed.tags,
      fields: parsed.fields,
      schema: parsed.schema,
      previewText: parsed.previewText,
      profile: parsed.profile,
      uploadedAt: new Date().toISOString(),
    };

    templates.set(id, template);
    response.status(201).json(publicTemplate(template));
  } catch (error) {
    next(error);
  }
});

app.get('/api/templates/:id', (request, response) => {
  const template = templates.get(request.params.id);

  if (!template) {
    response.status(404).json({ error: 'Шаблон не найден. Загрузите его заново.' });
    return;
  }

  response.json(publicTemplate(template));
});

app.post('/api/templates/:id/render', async (request, response, next) => {
  try {
    const template = templates.get(request.params.id);

    if (!template) {
      response.status(404).json({ error: 'Шаблон не найден. Загрузите его заново.' });
      return;
    }

    const format = request.body?.format === 'pdf' ? 'pdf' : 'docx';
    const data = request.body?.data;
    const validationSchema = request.body?.schema || template.schema;
    const validationErrors = validateData(validationSchema, data);

    if (validationErrors.length > 0) {
      response.status(422).json({
        error: 'Проверьте обязательные поля.',
        validationErrors,
      });
      return;
    }

    const result = await renderDocument(template.path, data, format);
    const filename = buildOutputName(template.documentTitle || template.name, format);

    await fs.mkdir(generatedDir, { recursive: true });
    await fs.writeFile(path.join(generatedDir, `${randomUUID()}-${filename}`), result);

    response.setHeader('Content-Type', contentType(format));
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    response.send(result);
  } catch (error) {
    next(error);
  }
});

if (isProduction) {
  app.use(express.static(clientDistDir));

  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api')) {
      return next();
    }

    response.sendFile(path.join(clientDistDir, 'index.html'), (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found.' });
});

app.use((error, _request, response, _next) => {
  console.error(error);

  response.status(500).json({
    error: 'Не удалось выполнить операцию.',
    details: error.message,
  });
});

async function start() {
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });

  app.listen(port, () => {
    console.log(`Document generator API is running on http://localhost:${port}`);
  });
}

async function getLibraryTemplate(slug) {
  const meta = BUILT_IN_TEMPLATES.find((template) => template.slug === slug);

  if (!meta) {
    return null;
  }

  const id = `library-${meta.slug}`;
  const cached = templates.get(id);

  if (cached) {
    return cached;
  }

  const templatePath = path.join(libraryDir, meta.file);
  const buffer = await fs.readFile(templatePath);
  const parsed = parseTemplate(buffer);
  const template = {
    id,
    slug: meta.slug,
    source: 'library',
    title: meta.title,
    documentTitle: meta.documentTitle,
    category: meta.category,
    description: meta.description,
    badge: meta.badge,
    name: meta.file,
    path: templatePath,
    tags: parsed.tags,
    fields: parsed.fields,
    schema: parsed.schema,
    previewText: parsed.previewText,
    profile: parsed.profile,
    uploadedAt: new Date().toISOString(),
  };

  templates.set(id, template);
  return template;
}

function renderDocument(templatePath, data, format) {
  return new Promise((resolve, reject) => {
    const options = format === 'pdf' ? { convertTo: 'pdf' } : {};

    carbone.render(templatePath, data, options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

function publicTemplate(template) {
  return {
    id: template.id,
    slug: template.slug,
    source: template.source,
    title: template.title,
    documentTitle: template.documentTitle,
    category: template.category,
    description: template.description,
    badge: template.badge,
    name: template.name,
    tags: template.tags,
    fields: template.fields,
    schema: template.schema,
    previewText: template.previewText,
    profile: template.profile,
    uploadedAt: template.uploadedAt,
  };
}

function publicLibraryTemplate(template) {
  return {
    id: template.id,
    slug: template.slug,
    title: template.title,
    documentTitle: template.documentTitle,
    category: template.category,
    description: template.description,
    badge: template.badge,
    fieldCount: template.fields.length,
    requiredCount: template.fields.filter((field) => field.required).length,
    hasRepeatingBlocks: (template.profile?.summary?.arrays || 0) > 0,
    typeCounts: template.profile?.summary?.typeCounts || {},
  };
}

function buildOutputName(templateName, format) {
  const baseName = templateName.replace(/\.docx$/i, '');
  return `${baseName}-generated.${format}`;
}

function contentType(format) {
  if (format === 'pdf') {
    return 'application/pdf';
  }

  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
