import {
  buildThreadContextMarkdown,
  collectFieldValues,
  createCheckboxField,
  createMarkdownBody,
  createFormFrame,
  createMarkdownField,
  createSection,
  createTextareaField,
  createThread,
  ensureRocFormAssets,
  showResult,
  startHeartbeat,
} from './form-components.mjs';

export async function mount({ root, data, submit, cancel, assetsBaseURL }) {
  await ensureRocFormAssets(assetsBaseURL);

  const { marked } = await import('https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js');
  const renderMd = (md) => marked.parse(md, { gfm: true, breaks: true });

  const frame = createFormFrame({
    title: data.title || 'PR Review Triage',
    subtitle: data.subtitle || '',
    eyebrow: data.eyebrow || 'PR Follow-up',
    submitLabel: data.submit_label || 'Submit',
    cancelLabel: data.cancel_label || 'Cancel',
  });
  root.replaceChildren(frame.container);

  const fields = [];

  if (data.summary_md) {
    frame.header.appendChild(await createMarkdownBody(data.summary_md, 'md-body form-summary'));
  }

  for (const group of data.groups || []) {
    const threads = [];
    for (const thread of group.threads || []) {
      const controls = [];

      if (thread.instruction_field) {
        controls.push(createTextareaField({
          name: thread.instruction_field,
          label: thread.instruction_label || 'How to handle',
          value: thread.instruction_value || '',
          placeholder: thread.instruction_placeholder || '',
          rows: thread.instruction_rows || 4,
        }));
      }

      if (thread.auto_resolve_field) {
        controls.push(createCheckboxField({
          name: thread.auto_resolve_field,
          label: thread.auto_resolve_label || 'Auto comment+resolve',
          checked: Boolean(thread.auto_resolve_value),
        }));
      }

      threads.push(await createThread({
        title: thread.title || '',
        contextMarkdown: buildThreadContextMarkdown(thread, { renderMd }),
        fields: controls,
      }));
    }

    const section = await createSection({
      titleMarkdown: group.title_md || group.title || '',
      hideFieldName: group.hide_field || '',
      hideLabel: group.hide_label || 'Hide this review group on PR page',
      hideValue: Boolean(group.hide_value),
      threads,
    });
    fields.push(...section.fields);
    frame.formBody.appendChild(section.element);
  }

  const stopHeartbeat = startHeartbeat();
  const setBusy = (disabled) => {
    frame.submitButton.disabled = disabled;
    frame.cancelButton.disabled = disabled;
  };
  const finish = (message) => {
    stopHeartbeat();
    showResult(frame.container, message);
  };
  const runAction = async (action, successMessage) => {
    try {
      setBusy(true);
      await action();
      finish(successMessage);
    } catch {
      setBusy(false);
      showResult(frame.container, 'Error: connection failed');
    }
  };

  frame.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await runAction(() => submit(collectFieldValues(fields)), 'Submitted');
  });

  frame.cancelButton.addEventListener('click', async () => {
    await runAction(cancel, 'Cancelled');
  });
}
