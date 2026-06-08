import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  INPUT_TYPES,
  applyDefaults,
  clearErrorBranch,
  cloneSchema,
  coerceData,
  createArrayItemData,
  createInitialData,
  flattenFields,
  generateDemoData,
  getCompletionState,
  getFormSections,
  getSchemaProfile,
  getSectionProgress,
  reindexArrayData,
  stringifyPath,
  updateAtPath,
  updateFieldSetting,
  validateData,
} from './schemaTools';
import { buildLivePreview } from './previewTools';
import './styles.css';

const emptyState = {
  template: null,
  schema: null,
  data: null,
  errors: {},
  serverError: '',
  uploadState: 'idle',
  renderState: 'idle',
  activeTab: 'form',
  previewUrl: '',
  templateDialogOpen: true,
  libraryTemplates: [],
  libraryState: 'idle',
};

function App() {
  const [state, setState] = React.useState(emptyState);

  React.useEffect(() => {
    return () => {
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
      }
    };
  }, [state.previewUrl]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadTemplateLibrary() {
      setState((current) => ({
        ...current,
        libraryState: 'loading',
      }));

      try {
        const response = await fetch('/api/template-library');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Не удалось загрузить готовые шаблоны.');
        }

        if (!cancelled) {
          setState((current) => ({
            ...current,
            libraryTemplates: payload.templates || [],
            libraryState: 'success',
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            libraryState: 'error',
            serverError: error.message,
          }));
        }
      }
    }

    loadTemplateLibrary();

    return () => {
      cancelled = true;
    };
  }, []);

  async function uploadTemplate(file) {
    if (!file) {
      return;
    }

    setState((current) => ({
      ...current,
      uploadState: 'loading',
      serverError: '',
      errors: {},
    }));

    const formData = new FormData();
    formData.append('template', file);

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось загрузить шаблон.');
      }

      const schema = cloneSchema(payload.schema);

      setState((current) => {
        if (current.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
        }

        return {
          ...current,
          template: payload,
          schema,
          data: createInitialData(schema),
          uploadState: 'success',
          renderState: 'idle',
          activeTab: 'form',
          serverError: '',
          errors: {},
          previewUrl: '',
          templateDialogOpen: false,
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        uploadState: 'error',
        serverError: error.message,
      }));
    }
  }

  async function selectLibraryTemplate(slug) {
    setState((current) => ({
      ...current,
      uploadState: 'loading',
      serverError: '',
      errors: {},
    }));

    try {
      const response = await fetch(`/api/template-library/${slug}/select`, {
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось открыть готовый шаблон.');
      }

      const schema = cloneSchema(payload.schema);

      setState((current) => {
        if (current.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
        }

        return {
          ...current,
          template: payload,
          schema,
          data: createInitialData(schema),
          uploadState: 'success',
          renderState: 'idle',
          activeTab: 'form',
          serverError: '',
          errors: {},
          previewUrl: '',
          templateDialogOpen: false,
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        uploadState: 'error',
        serverError: error.message,
      }));
    }
  }

  function updateData(path, value) {
    setState((current) => ({
      ...current,
      data: updateAtPath(current.data, path, value),
      errors: clearErrorBranch(current.errors, stringifyPath(path)),
    }));
  }

  function updateField(fieldPath, patch) {
    setState((current) => ({
      ...current,
      schema: updateFieldSetting(current.schema, fieldPath, patch),
      errors: {},
    }));
  }

  function fillDemoData() {
    if (!state.schema) {
      return;
    }

    setState((current) => ({
      ...current,
      data: generateDemoData(current.schema),
      errors: {},
      serverError: '',
    }));
  }

  function applyDefaultValues() {
    if (!state.schema) {
      return;
    }

    setState((current) => ({
      ...current,
      data: applyDefaults(current.schema, current.data),
      errors: {},
      serverError: '',
    }));
  }

  function resetData() {
    if (!state.schema) {
      return;
    }

    setState((current) => ({
      ...current,
      data: createInitialData(current.schema),
      errors: {},
      serverError: '',
    }));
  }

  function scrollToSection(sectionKey) {
    const element = document.getElementById(`section-${sectionKey}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function focusField(path) {
    setState((current) => ({
      ...current,
      activeTab: 'form',
      errors: validateData(current.schema, current.data),
    }));

    window.setTimeout(() => {
      const id = `field-${stringifyPath(path).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
    }, 80);
  }

  function scrollToPreview() {
    document.querySelector('.live-preview-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function renderDocument(format, mode) {
    if (!state.template || !state.schema || !state.data) {
      return;
    }

    const clientErrors = validateData(state.schema, state.data);

    if (Object.keys(clientErrors).length > 0) {
      setState((current) => ({
        ...current,
        errors: clientErrors,
        serverError: 'Заполните обязательные поля.',
      }));
      return;
    }

    setState((current) => ({
      ...current,
      renderState: mode,
      serverError: '',
      errors: {},
    }));

    try {
      const response = await fetch(`/api/templates/${state.template.id}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          schema: state.schema,
          data: coerceData(state.schema, state.data),
        }),
      });

      if (!response.ok) {
        const payload = await safeJson(response);
        const validationErrors = Object.fromEntries((payload.validationErrors || []).map((error) => [error.path, error.message]));
        setState((current) => ({
          ...current,
          renderState: 'idle',
          errors: validationErrors,
          serverError: format === 'pdf'
            ? 'PDF сейчас недоступен. Скачайте документ в формате Word.'
            : payload.error || 'Не удалось сформировать документ.',
        }));
        return;
      }

      const blob = await response.blob();
      const filename = getFilename(response.headers.get('Content-Disposition'), format);

      if (mode === 'preview') {
        setState((current) => {
          if (current.previewUrl) {
            URL.revokeObjectURL(current.previewUrl);
          }

          return {
            ...current,
            renderState: 'success',
            previewUrl: URL.createObjectURL(blob),
          };
        });
        return;
      }

      downloadBlob(blob, filename);
      setState((current) => ({
        ...current,
        renderState: 'success',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        renderState: 'idle',
        serverError: format === 'pdf' ? 'PDF сейчас недоступен. Скачайте документ в формате Word.' : error.message,
      }));
    }
  }

  const fields = flattenFields(state.schema);
  const profile = state.schema ? getSchemaProfile(state.schema, state.template?.profile) : null;
  const completion = state.schema ? getCompletionState(state.schema, state.data) : null;
  const sections = state.schema ? getFormSections(state.schema) : [];
  const sectionProgress = state.schema ? getSectionProgress(state.schema, state.data) : [];
  const nextMissingField = completion?.missing?.[0] || null;
  const requiredCount = fields.filter((field) => field.required).length;
  const completionTotal = completion?.total || requiredCount;
  const hasTemplate = Boolean(state.template && state.schema && state.data);
  const isRendering = state.renderState === 'docx' || state.renderState === 'pdf' || state.renderState === 'preview';
  const topStatusLabel = !hasTemplate ? 'Ждет шаблон' : completion?.ready ? 'Можно скачать' : `${completion?.filled || 0} из ${completionTotal} заполнено`;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <span>D</span>
          </span>
          <div>
            <h1>Генератор документов</h1>
          </div>
        </div>
        <StatusBadge active={Boolean(completion?.ready)} label={topStatusLabel} />
      </header>

      <main className="workspace">
        <aside className="left-rail">
          <section className="panel upload-panel">
            <div className="panel-heading">
            <div>
              <h2>Шаблон</h2>
            </div>
          </div>
            <div className="template-source-actions">
              <button className="button primary" type="button" onClick={() => setState((current) => ({ ...current, templateDialogOpen: true }))}>
                <FileText size={17} />
                Выбрать готовый
              </button>
            </div>
            <FileDropZone onFile={uploadTemplate} loading={state.uploadState === 'loading'} />
            {state.template && (
              <TemplateCard template={state.template} fields={fields} profile={profile} />
            )}
          </section>

          <WorkflowCard hasTemplate={hasTemplate} hasData={Boolean(hasTemplate && fields.length)} hasDocument={Boolean(completion?.ready)} />
          {hasTemplate && <SectionNav sections={sections} progress={sectionProgress} onSelect={scrollToSection} />}
        </aside>

        <section className="panel form-panel">
          <div className="panel-heading form-heading">
            <div>
              <h2>{state.activeTab === 'form' ? 'Заполнение документа' : 'Настройка формы'}</h2>
              <p>{hasTemplate ? 'Проверьте данные перед скачиванием' : 'Форма появится после загрузки шаблона'}</p>
            </div>
            {hasTemplate && <StatusBadge active={completion?.ready} label={`${completion?.filled || 0} из ${completionTotal}`} />}
          </div>

          {hasTemplate ? (
            <>
              <div className="tabbar">
                <button className={state.activeTab === 'form' ? 'active' : ''} type="button" onClick={() => setState((current) => ({ ...current, activeTab: 'form' }))}>
                  Заполнение
                </button>
                <button className={state.activeTab === 'settings' ? 'active' : ''} type="button" onClick={() => setState((current) => ({ ...current, activeTab: 'settings' }))}>
                  Настроить поля
                </button>
              </div>

              {state.activeTab === 'form' ? (
                <>
                  <FormCoach
                    completion={completion}
                    nextField={nextMissingField}
                    onNext={focusField}
                    onReview={scrollToPreview}
                  />
                  <DynamicForm
                    schema={state.schema}
                    value={state.data}
                    errors={state.errors}
                    onChange={updateData}
                  />
                </>
              ) : (
                <SettingsPanel fields={fields} onUpdateField={updateField} />
              )}
            </>
          ) : (
            <EmptyCanvas onOpenTemplates={() => setState((current) => ({ ...current, templateDialogOpen: true }))} />
          )}
        </section>

        <aside className="right-rail">
          {hasTemplate && (
            <LivePreviewPanel
              template={state.template}
              data={state.data}
              schema={state.schema}
              completion={completion}
            />
          )}
          <ActionPanel
            hasTemplate={hasTemplate}
            isRendering={isRendering}
            renderState={state.renderState}
            serverError={state.serverError}
            completion={completion}
            onFillDemo={fillDemoData}
            onApplyDefaults={applyDefaultValues}
            onReset={resetData}
            onRender={renderDocument}
            onFocusField={focusField}
          />
          {state.previewUrl && (
            <section className="panel preview-panel">
              <div className="panel-heading">
                <h2>Предпросмотр</h2>
              </div>
              <div className="preview-frame">
                <iframe title="PDF preview" src={state.previewUrl} />
              </div>
            </section>
          )}
        </aside>
      </main>
      <TemplateLibraryModal
        open={state.templateDialogOpen}
        templates={state.libraryTemplates}
        loading={state.libraryState === 'loading'}
        selectedSlug={state.template?.slug}
        onSelect={selectLibraryTemplate}
        onClose={() => setState((current) => ({ ...current, templateDialogOpen: false }))}
      />
    </div>
  );
}

function TemplateLibraryModal({ open, templates, loading, selectedSlug, onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = React.useState('Все');

  React.useEffect(() => {
    if (open) {
      setActiveCategory('Все');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const categories = ['Все', ...Array.from(new Set(templates.map((template) => template.category).filter(Boolean)))];
  const visibleTemplates = activeCategory === 'Все'
    ? templates
    : templates.filter((template) => template.category === activeCategory);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="template-dialog" role="dialog" aria-modal="true" aria-label="Выбор шаблона" onMouseDown={(event) => event.stopPropagation()}>
        <div className="template-dialog-header">
          <div>
            <span>Библиотека шаблонов</span>
            <h2>Что нужно оформить?</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="template-categories">
          {categories.map((category) => (
            <button className={activeCategory === category ? 'active' : ''} key={category} type="button" onClick={() => setActiveCategory(category)}>
              {category}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="template-loading">Загружаем шаблоны...</div>
        ) : (
          <div className="template-library-grid">
            {visibleTemplates.map((template) => (
              <article className={selectedSlug === template.slug ? 'template-option selected' : 'template-option'} key={template.slug}>
                <div className="template-option-top">
                  <div className="template-option-icon">
                    <FileText size={20} />
                  </div>
                  <span>{template.badge}</span>
                </div>
                <div className="template-option-body">
                  <h3>{template.title}</h3>
                  <p>{template.description}</p>
                </div>
                <div className="template-option-meta">
                  <span>{template.fieldCount} полей</span>
                  {template.hasRepeatingBlocks && <span>Повторяемые строки</span>}
                </div>
                <button className="button primary" type="button" onClick={() => onSelect(template.slug)}>
                  {selectedSlug === template.slug ? 'Открыт' : 'Открыть'}
                  <ArrowRight size={16} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FileDropZone({ onFile, loading }) {
  const inputRef = React.useRef(null);

  function handleChange(event) {
    onFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    onFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div
      className="drop-zone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" accept=".docx" onChange={handleChange} />
      <UploadCloud size={28} />
      <strong>Перетащите шаблон сюда</strong>
      <span>или выберите файл на компьютере</span>
      <button className="button secondary" type="button" onClick={() => inputRef.current?.click()} disabled={loading}>
        {loading ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}
        Выбрать файл
      </button>
    </div>
  );
}

function TemplateCard({ template, fields, profile }) {
  const hasRepeatingBlocks = (profile?.summary?.arrays || 0) > 0;
  const displayName = template.documentTitle || template.name;

  return (
    <div className="template-card">
      <div className="template-icon">
        <span>DOCX</span>
      </div>
      <div>
        <strong>{displayName}</strong>
        <span>{fields.length} полей для заполнения</span>
      </div>
      <div className="template-note">
        <span>{hasRepeatingBlocks ? 'Есть повторяемые разделы' : 'Форма готова'}</span>
      </div>
    </div>
  );
}

function WorkflowCard({ hasTemplate, hasData, hasDocument }) {
  const steps = [
    { title: 'Шаблон', done: hasTemplate },
    { title: 'Данные', done: hasData },
    { title: 'Документ', done: hasDocument },
  ];

  return (
    <section className="panel workflow-card">
      <div className="panel-heading">
        <div>
          <h2>Порядок работы</h2>
        </div>
      </div>
      <div className="step-list">
        {steps.map((step, index) => (
          <div className={step.done ? 'step done' : 'step'} key={step.title}>
            <span>{index + 1}</span>
            <strong>{step.title}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionNav({ sections, progress, onSelect }) {
  if (sections.length === 0) {
    return null;
  }

  const progressByKey = new Map(progress.map((item) => [item.key, item]));

  return (
    <section className="panel section-card">
      <div className="panel-heading">
        <div>
          <h2>Разделы</h2>
          <p>Готовность формы</p>
        </div>
      </div>
      <div className="section-list">
        {sections.map((section) => {
          const item = progressByKey.get(section.key) || { filled: 0, total: 0, missing: 0, percent: 0, ready: false };

          return (
            <button className={item.ready ? 'ready' : ''} key={section.key} type="button" onClick={() => onSelect(section.key)}>
              <span className="section-row">
                <span className="section-title">
                  {item.ready ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                  {section.label}
                </span>
                <span className="section-count">{item.total ? `${item.filled}/${item.total}` : '—'}</span>
              </span>
              <span className="section-progress">
                <span style={{ width: `${item.percent}%` }} />
              </span>
              <span className="section-note">{item.ready ? 'Готово' : `Осталось ${item.missing}`}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FormCoach({ completion, nextField, onNext, onReview }) {
  if (!completion) {
    return null;
  }

  if (completion.ready) {
    return (
      <div className="form-coach ready">
        <div>
          <span className="coach-kicker">Форма готова</span>
          <strong>Проверьте документ справа и скачайте Word</strong>
        </div>
        <button className="button ghost" type="button" onClick={onReview}>
          <Eye size={16} />
          К предпросмотру
        </button>
      </div>
    );
  }

  return (
    <div className="form-coach">
      <div>
        <span className="coach-kicker">Следующее поле</span>
        <strong>{nextField?.label || 'Продолжите заполнение'}</strong>
        {nextField?.section && <small>{nextField.section}</small>}
      </div>
      {nextField && (
        <button className="button primary" type="button" onClick={() => onNext(nextField.path)}>
          Заполнить
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

function LivePreviewPanel({ template, data, schema, completion }) {
  const preview = React.useMemo(
    () => buildLivePreview(template?.previewText, data, schema),
    [template?.previewText, data, schema],
  );
  const missingFields = completion?.missing?.length ?? preview.stats.missing;

  if (!preview.hasTemplateText) {
    return (
      <section className="panel live-preview-panel">
        <div className="panel-heading">
          <div>
            <h2>Предпросмотр</h2>
            <p>Черновик документа</p>
          </div>
          <FileText size={18} />
        </div>
        <div className="preview-empty">
          <span>Текст шаблона не удалось показать на странице.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel live-preview-panel">
      <div className="panel-heading">
        <div>
          <h2>Предпросмотр</h2>
          <p>Черновик документа</p>
        </div>
        <span className="live-badge">Живой</span>
      </div>
      <div className="preview-summary">
        <span>{completion?.filled || 0} из {completion?.total || 0} заполнено</span>
        {missingFields > 0 ? <span>Осталось {missingFields}</span> : <span>Готово</span>}
      </div>
      <div className="preview-paper-wrap">
        <div className="preview-paper" aria-label="Живой предпросмотр документа">
          {preview.lines.map((line, lineIndex) => (
            <p key={`line-${lineIndex}`}>
              {line.map((segment, segmentIndex) => (
                <PreviewSegment key={`${lineIndex}-${segmentIndex}`} segment={segment} />
              ))}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreviewSegment({ segment }) {
  if (segment.type === 'value') {
    return <span className="preview-value">{segment.text}</span>;
  }

  if (segment.type === 'placeholder') {
    return <span className="preview-placeholder">{segment.text}</span>;
  }

  return <>{segment.text}</>;
}

function ActionPanel({
  hasTemplate,
  isRendering,
  renderState,
  serverError,
  completion,
  onFillDemo,
  onApplyDefaults,
  onReset,
  onRender,
  onFocusField,
}) {
  const missing = completion?.missing || [];
  const canGenerate = Boolean(hasTemplate && completion?.ready && !isRendering);
  const actionHint = !hasTemplate
    ? 'Загрузите шаблон, чтобы собрать документ.'
    : completion?.ready
      ? 'Документ готов к скачиванию.'
      : `Заполните обязательные поля: осталось ${missing.length}.`;

  return (
    <section className="panel action-panel">
      <div className="panel-heading">
        <div>
          <h2>Готовый документ</h2>
          <p>Скачайте после проверки данных</p>
        </div>
      </div>

      {serverError && (
        <div className="error-banner">
          <AlertCircle size={17} />
          <span>{serverError}</span>
        </div>
      )}

      {completion && (
        <div className="completion-box">
          <div className="completion-top">
            <strong>{completion.ready ? 'Все обязательные поля заполнены' : 'Осталось заполнить'}</strong>
            <span>{completion.filled}/{completion.total}</span>
          </div>
          <div className="completion-bar">
            <span style={{ width: `${completion.percent}%` }} />
          </div>
          {!completion.ready && (
            <div className="missing-list">
              {missing.slice(0, 5).map((field) => (
                <button key={`${field.section}-${stringifyPath(field.path)}`} type="button" onClick={() => onFocusField(field.path)}>
                  <span>{field.label}</span>
                  <small>{field.section}</small>
                </button>
              ))}
              {missing.length > 5 && <div className="missing-extra">Еще {missing.length - 5} полей</div>}
            </div>
          )}
        </div>
      )}

      <div className="quick-actions">
        <button className="button secondary" disabled={!hasTemplate} type="button" onClick={onFillDemo}>
          Тестовые
        </button>
        <button className="button secondary" disabled={!hasTemplate} type="button" onClick={onApplyDefaults}>
          По умолчанию
        </button>
        <button className="button secondary" disabled={!hasTemplate} type="button" onClick={onReset}>
          <RotateCcw size={16} />
          Очистить
        </button>
      </div>

      <div className="download-box">
        <p className="download-hint">{actionHint}</p>
        <button className="button primary download-main" disabled={!canGenerate} onClick={() => onRender('docx', 'docx')}>
          {renderState === 'docx' ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
          Скачать Word
        </button>
        <div className="secondary-downloads">
          <button className="button secondary" disabled={!canGenerate} onClick={() => onRender('pdf', 'pdf')}>
            {renderState === 'pdf' ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
            PDF
          </button>
          <button className="button ghost" disabled={!canGenerate} onClick={() => onRender('pdf', 'preview')}>
            {renderState === 'preview' ? <Loader2 className="spin" size={16} /> : <Eye size={16} />}
            Предпросмотр
          </button>
        </div>
      </div>
    </section>
  );
}

function DynamicForm({ schema, value, errors, onChange }) {
  return (
    <div className="dynamic-form">
      <SchemaNode node={schema} value={value} path={[]} errors={errors} onChange={onChange} root />
    </div>
  );
}

function SettingsPanel({ fields, onUpdateField }) {
  return (
    <div className="settings-panel">
      <div className="settings-intro">
        <span>Переименуйте поля, выберите формат ввода и отметьте обязательные пункты.</span>
      </div>
      <div className="settings-list">
        {fields.map((field) => (
          <FieldSettingsRow key={field.path} field={field} onUpdateField={onUpdateField} />
        ))}
      </div>
    </div>
  );
}

function FieldSettingsRow({ field, onUpdateField }) {
  const defaultInputType = field.inputType === 'checkbox' ? 'checkbox' : field.inputType === 'textarea' ? 'text' : field.inputType;

  return (
    <div className="field-config-row">
      <label>
        Название поля
        <input value={field.label} onChange={(event) => onUpdateField(field.path, { label: event.target.value })} />
      </label>
      <label>
        Формат
        <select value={field.inputType} onChange={(event) => onUpdateField(field.path, { inputType: event.target.value })}>
          {INPUT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>
      <label>
        Значение по умолчанию
        {field.inputType === 'checkbox' ? (
          <select value={String(Boolean(field.defaultValue))} onChange={(event) => onUpdateField(field.path, { defaultValue: event.target.value === 'true' })}>
            <option value="false">Нет</option>
            <option value="true">Да</option>
          </select>
        ) : (
          <input type={defaultInputType} value={field.defaultValue ?? ''} onChange={(event) => onUpdateField(field.path, { defaultValue: event.target.value })} />
        )}
      </label>
      <label className="switch-control">
        <input type="checkbox" checked={field.required} onChange={(event) => onUpdateField(field.path, { required: event.target.checked })} />
        <span>Обязательное</span>
      </label>
    </div>
  );
}

function SchemaNode({ node, value, path, errors, onChange, root = false }) {
  if (node.type === 'field') {
    return (
      <FieldControl
        node={node}
        value={value}
        path={path}
        error={errors[stringifyPath(path)]}
        onChange={onChange}
      />
    );
  }

  if (node.type === 'array') {
    return (
      <ArrayControl
        node={node}
        value={Array.isArray(value) ? value : []}
        path={path}
        errors={errors}
        onChange={onChange}
      />
    );
  }

  const children = Object.values(node.children || {});
  const fields = children.filter((child) => child.type === 'field');
  const groups = children.filter((child) => child.type !== 'field');

  return (
    <div className={root ? 'form-root' : 'object-group'} id={!root && path.length === 1 ? `section-${path[0]}` : undefined}>
      {!root && (
        <div className="group-title">
          <h3>{node.label}</h3>
        </div>
      )}
      {fields.length > 0 && (
        <div className="field-grid">
          {fields.map((child) => (
            <SchemaNode
              key={child.key}
              node={child}
              value={value?.[child.key]}
              path={[...path, child.key]}
              errors={errors}
              onChange={onChange}
            />
          ))}
        </div>
      )}
      {groups.map((child) => (
        <SchemaNode
          key={child.key || 'items'}
          node={child}
          value={value?.[child.key]}
          path={child.key ? [...path, child.key] : path}
          errors={errors}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function ArrayControl({ node, value, path, errors, onChange }) {
  const pathKey = stringifyPath(path);
  const arrayError = errors[pathKey];

  function addItem() {
    onChange(path, [...value, createArrayItemData(node.item, value.length)]);
  }

  function removeItem(index) {
    onChange(path, reindexArrayData(node.item, value.filter((_, currentIndex) => currentIndex !== index)));
  }

  return (
    <div className="array-group" id={path.length === 1 ? `section-${path[0]}` : undefined}>
      <div className="array-heading">
        <div>
          <h3>{node.label}</h3>
          {arrayError && <span className="field-error">{arrayError}</span>}
        </div>
        <button className="icon-button" type="button" onClick={addItem} title="Добавить запись">
          <Plus size={18} />
        </button>
      </div>

      <div className="array-items">
        {value.map((item, index) => (
          <div className="array-item" key={`${pathKey}-${index}`}>
            <div className="array-item-heading">
              <span>Запись {index + 1}</span>
              <button className="icon-button danger" type="button" onClick={() => removeItem(index)} title="Удалить запись">
                <Trash2 size={17} />
              </button>
            </div>
            <SchemaNode
              node={node.item}
              value={item}
              path={[...path, index]}
              errors={errors}
              onChange={onChange}
              root
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldControl({ node, value, path, error, onChange }) {
  const id = `field-${stringifyPath(path).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const commonProps = {
    id,
    value: node.inputType === 'checkbox' ? undefined : value ?? '',
    checked: node.inputType === 'checkbox' ? Boolean(value) : undefined,
    placeholder: node.placeholder,
    'aria-invalid': Boolean(error),
    onChange: (event) => {
      const nextValue = node.inputType === 'checkbox' ? event.target.checked : event.target.value;
      onChange(path, nextValue);
    },
  };

  return (
    <label className={`field-control ${error ? 'has-error' : ''}`} htmlFor={id}>
      <span>
        {node.label}
        {node.required && <b>*</b>}
      </span>
      {node.inputType === 'textarea' ? (
        <textarea rows="4" {...commonProps} />
      ) : node.inputType === 'checkbox' ? (
        <span className="toggle-row">
          <input type="checkbox" {...commonProps} />
          <span>Да</span>
        </span>
      ) : (
        <input type={node.inputType} {...commonProps} />
      )}
      {error && <small>{error}</small>}
    </label>
  );
}

function EmptyCanvas({ onOpenTemplates }) {
  return (
    <div className="empty-canvas">
      <div className="empty-icon">
        <span>DOC</span>
      </div>
      <strong>Выберите шаблон, чтобы начать</strong>
      <span>Готовая форма сразу построит поля и покажет предпросмотр документа.</span>
      <button className="button primary" type="button" onClick={onOpenTemplates}>
        <FileText size={17} />
        Открыть библиотеку
      </button>
    </div>
  );
}

function StatusBadge({ active, label }) {
  return (
    <span className={`status-badge ${active ? 'active' : ''}`}>
      <span />
      {label}
    </span>
  );
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getFilename(contentDisposition, format) {
  const fallback = `document.${format}`;
  if (!contentDisposition) {
    return fallback;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch) {
    return decodeURIComponent(utfMatch[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallback;
}

createRoot(document.getElementById('root')).render(<App />);
