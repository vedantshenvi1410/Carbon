const client = window.CARBONWISE_SUPABASE;
const $ = (id) => document.getElementById(id);

(() => {
  const state = { user: null, workspace: null, projects: [], current: null, saveTimer: null, writeChain: Promise.resolve() };
  const stages = ['auth-loading', 'auth-entry', 'auth-reset', 'auth-workspace', 'auth-project', 'auth-error'];

  function showStage(id, authState = id === 'auth-loading' ? 'loading' : 'signed-out') {
    document.body.dataset.authState = authState;
    stages.forEach((stage) => { const el = $(stage); if (el) el.hidden = stage !== id; });
  }
  function message(id, text, kind = '') {
    const el = $(id); if (!el) return;
    el.textContent = text; el.dataset.kind = kind;
  }
  function setBusy(form, busy) {
    form?.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = busy; });
  }
  function fail(error, messageId) {
    console.error('Carbonwise request failed', error);
    message(messageId, error?.message || 'That request could not be completed. Please try again.', 'error');
  }
  function safeName(value) { return String(value || '').trim(); }
  function projectPayload(form) {
    const data = new FormData(form);
    return {
      workspace_id: state.workspace.id,
      name: safeName(data.get('name')),
      location: String(data.get('location') || ''),
      building_type: String(data.get('building_type') || ''),
      floor_plate_m2: Number(data.get('floor_plate_m2')),
      floors: Number(data.get('floors')),
      study_period_years: Number(data.get('study_period_years'))
    };
  }

  function showApp() {
    showStage('', 'ready');
    $('user-email-label').textContent = state.user?.email || '';
    $('workspace-name') && ($('workspace-name').value = state.workspace?.name || '');
    const picker = $('project-picker');
    picker.replaceChildren(...state.projects.map((project) => {
      const option = document.createElement('option'); option.value = project.id; option.textContent = project.name; return option;
    }));
    picker.value = state.current?.id || '';
    $('saved-status-text').textContent = 'All changes saved';
  }

  async function loadProject(project) {
    state.current = project;
    window.CarbonwiseApp.resetProjectForm();
    window.CarbonwiseApp.applyProjectDetails(project);
    const { data, error } = await client.from('project_assessments').select('inputs').eq('project_id', project.id).maybeSingle();
    if (error) throw error;
    if (data?.inputs) window.CarbonwiseApp.restoreDraft(data.inputs);
    showApp();
  }

  async function refreshProjects(preferredId) {
    const { data, error } = await client.from('projects').select('id,workspace_id,name,location,building_type,floor_plate_m2,floors,study_period_years,updated_at').eq('workspace_id', state.workspace.id).order('updated_at', { ascending: false });
    if (error) throw error;
    state.projects = data || [];
    const selected = state.projects.find((item) => item.id === (preferredId || state.current?.id)) || state.projects[0];
    if (!selected) { showStage('auth-project', 'onboarding'); return; }
    await loadProject(selected);
  }

  async function bootstrap(user) {
    state.user = user;
    if (!user) { state.workspace = null; state.projects = []; state.current = null; showStage('auth-entry', 'signed-out'); return; }
    const { data, error } = await client.from('workspaces').select('id,name,created_at').order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) { showStage('auth-workspace', 'onboarding'); return; }
    state.workspace = data;
    await refreshProjects();
  }

  function persistProject(project, draft) {
    const write = state.writeChain.then(() => persistProjectNow(project, draft));
    state.writeChain = write.catch(() => {});
    return write;
  }

  async function persistProjectNow(project, draft) {
    if (!project || !state.user) return;
    if (state.current?.id === project.id) $('saved-status-text').textContent = 'Saving…';
    const values = draft.fields || {};
    const { error: projectError } = await client.from('projects').update({
      name: safeName(values['project-name']) || project.name,
      location: values.location || '', building_type: values['building-type'] || '',
      floor_plate_m2: values['floor-area'] === '' ? null : Number(values['floor-area']),
      floors: values.floors === '' ? null : Number(values.floors),
      study_period_years: values.lifetime === '' ? null : Number(values.lifetime), updated_at: new Date().toISOString()
    }).eq('id', project.id);
    if (projectError) { if (state.current?.id === project.id) $('saved-status-text').textContent = 'Save failed'; throw projectError; }
    const { error } = await client.from('project_assessments').upsert({ project_id: project.id, schema_version: '1', inputs: draft, updated_at: new Date().toISOString() }, { onConflict: 'project_id' });
    if (error) { if (state.current?.id === project.id) $('saved-status-text').textContent = 'Save failed'; throw error; }
    const updated = { ...project, name: safeName(values['project-name']) || project.name, location: values.location || '', building_type: values['building-type'] || '', floor_plate_m2: values['floor-area'] === '' ? null : Number(values['floor-area']), floors: values.floors === '' ? null : Number(values.floors), study_period_years: values.lifetime === '' ? null : Number(values.lifetime), updated_at: new Date().toISOString() };
    state.projects = state.projects.map((item) => item.id === updated.id ? updated : item);
    if (state.current?.id === project.id) {
      state.current = updated;
      $('crumb-project').textContent = updated.name; $('side-project').textContent = updated.name;
      $('saved-status-text').textContent = 'All changes saved';
      const picker = $('project-picker'); const option = [...picker.options].find((item) => item.value === updated.id); if (option) option.textContent = updated.name;
    }
  }

  async function saveCurrentProject() {
    if (!state.current || !state.user) return;
    clearTimeout(state.saveTimer);
    return persistProject({ ...state.current }, window.CarbonwiseApp.captureDraft());
  }

  function queueSave() {
    if (!state.current || !state.user || state.busy) return;
    $('saved-status-text').textContent = 'Unsaved changes';
    clearTimeout(state.saveTimer);
    const project = { ...state.current };
    const draft = window.CarbonwiseApp.captureDraft();
    state.saveTimer = setTimeout(() => persistProject(project, draft).catch((error) => { console.error(error); }), 900);
  }

  async function createProject(form, messageId) {
    clearTimeout(state.saveTimer);
    if (state.current) await saveCurrentProject();
    const { data, error } = await client.from('projects').insert(projectPayload(form)).select('id,workspace_id,name,location,building_type,floor_plate_m2,floors,study_period_years,updated_at').single();
    if (error) throw error;
    state.projects.unshift(data);
    const { error: saveError } = await client.from('project_assessments').insert({ project_id: data.id, schema_version: '1', inputs: {} });
    if (saveError) throw saveError;
    form.reset();
    message(messageId, '');
    $('new-project-dialog').close();
    await loadProject(data);
  }

  async function runForm(form, messageId, fn) {
    setBusy(form, true); message(messageId, '');
    try { await fn(); } catch (error) { fail(error, messageId); } finally { setBusy(form, false); }
  }

  function wire() {
    const authForm = $('auth-form');
    let mode = 'signin';
    $('auth-mode-toggle').addEventListener('click', () => {
      mode = mode === 'signin' ? 'signup' : 'signin';
      $('auth-heading').textContent = mode === 'signup' ? 'Create your Carbonwise account.' : 'A clearer view of your building’s carbon.';
      $('auth-submit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
      $('auth-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      $('auth-mode-toggle').textContent = mode === 'signup' ? 'Already have an account? Sign in' : 'Create an account';
      message('auth-message', '');
    });
    authForm.addEventListener('submit', (event) => {
      event.preventDefault();
      runForm(authForm, 'auth-message', async () => {
        const email = $('auth-email').value.trim(); const password = $('auth-password').value;
        const result = mode === 'signup'
          ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}${location.pathname}` } })
          : await client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (mode === 'signup' && !result.data.session) { message('auth-message', 'Check your email for the confirmation link. You can sign in after confirming.'); return; }
        if (result.data.user) await bootstrap(result.data.user);
      });
    });
    $('auth-forgot').addEventListener('click', async () => {
      const email = $('auth-email').value.trim();
      if (!email) { message('auth-message', 'Enter your email address first.'); $('auth-email').focus(); return; }
      $('auth-forgot').disabled = true;
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` });
        if (error) throw error;
        message('auth-message', 'If an account exists for that address, a reset link has been sent.');
      } catch (error) { fail(error, 'auth-message'); } finally { $('auth-forgot').disabled = false; }
    });
    $('reset-form').addEventListener('submit', (event) => {
      event.preventDefault(); const form = event.currentTarget;
      runForm(form, 'reset-message', async () => {
        const { data, error } = await client.auth.updateUser({ password: $('reset-password').value });
        if (error) throw error;
        message('reset-message', 'Password updated. Opening your workspace…');
        await bootstrap(data.user);
      });
    });
    $('workspace-form').addEventListener('submit', (event) => {
      event.preventDefault(); const form = event.currentTarget;
      runForm(form, 'workspace-message', async () => {
        const { data, error } = await client.from('workspaces').insert({ name: safeName($('workspace-name').value) }).select('id,name').single();
        if (error) throw error;
        state.workspace = data; showStage('auth-project', 'onboarding');
      });
    });
    $('first-project-form').addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; runForm(form, 'project-message', async () => createProject(form, 'project-message')); });
    $('new-project').addEventListener('click', () => $('new-project-dialog').showModal());
    $('cancel-new-project').addEventListener('click', () => $('new-project-dialog').close());
    $('new-project-form').addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; runForm(form, 'new-project-message', async () => createProject(form, 'new-project-message')); });
    $('project-picker').addEventListener('change', async (event) => {
      clearTimeout(state.saveTimer);
      try { await saveCurrentProject(); await loadProject(state.projects.find((project) => project.id === event.target.value)); }
      catch (error) { showStage('auth-error', 'error'); $('auth-error-copy').textContent = 'We could not load this project. Try again.'; console.error(error); }
    });
    const signOut = async () => { clearTimeout(state.saveTimer); try { await saveCurrentProject(); } catch (error) { console.error(error); } const { error } = await client.auth.signOut(); if (error) console.error(error); };
    ['auth-signout', 'workspace-signout', 'project-signout', 'auth-error-signout'].forEach((id) => $(id).addEventListener('click', signOut));
    $('auth-retry').addEventListener('click', () => bootstrap(state.user).catch((error) => { fail(error, 'auth-error-copy'); }));
  }

  if (!client) { showStage('auth-error', 'error'); $('auth-error-copy').textContent = window.CARBONWISE_SUPABASE_ERROR || 'Supabase did not initialize. Check the client library and configuration.'; return; }
  wire();
  window.CarbonwiseSession = { queueSave, saveCurrentProject };
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { showStage('auth-reset', 'reset'); return; }
    if (event === 'INITIAL_SESSION') return;
    queueMicrotask(() => bootstrap(session?.user || null).catch((error) => { console.error(error); $('auth-error-copy').textContent = error.message || 'Check the connection and database setup.'; showStage('auth-error', 'error'); }));
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    return bootstrap(data.session?.user || null);
  }).catch((error) => { console.error(error); $('auth-error-copy').textContent = error.message || 'Check the connection and database setup.'; showStage('auth-error', 'error'); });
})();
