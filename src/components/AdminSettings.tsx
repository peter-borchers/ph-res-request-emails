import { MSGraphSync } from './MSGraphSync';
import { Settings, Link as LinkIcon, Key, Save, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AdminSettingsProps {
  onSyncComplete?: () => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
}

export function AdminSettings({ onSyncComplete }: AdminSettingsProps = {}) {
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [msgraphClientId, setMsgraphClientId] = useState('');
  const [msgraphClientSecret, setMsgraphClientSecret] = useState('');
  const [msgraphTenantId, setMsgraphTenantId] = useState('');
  const [mailboxAddress, setMailboxAddress] = useState('');
  const [missingDetailsTemplateId, setMissingDetailsTemplateId] = useState<string>('');
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingMsgraph, setSavingMsgraph] = useState(false);
  const [savingAutoDraft, setSavingAutoDraft] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [msgraphSaveStatus, setMsgraphSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [autoDraftSaveStatus, setAutoDraftSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadSettings();
    loadEmailTemplates();
  }, []);

  async function loadSettings() {
    const { data } = await supabase
      .from('settings')
      .select('openai_api_key, msgraph_client_id, msgraph_client_secret, msgraph_tenant_id, mailbox_address, missing_details_template_id')
      .maybeSingle();

    if (data) {
      if (data.openai_api_key) setOpenaiApiKey(data.openai_api_key);
      if (data.msgraph_client_id) setMsgraphClientId(data.msgraph_client_id);
      if (data.msgraph_client_secret) setMsgraphClientSecret(data.msgraph_client_secret);
      if (data.msgraph_tenant_id) setMsgraphTenantId(data.msgraph_tenant_id);
      if (data.mailbox_address) setMailboxAddress(data.mailbox_address);
      if (data.missing_details_template_id) setMissingDetailsTemplateId(data.missing_details_template_id);
    }
  }

  async function loadEmailTemplates() {
    const { data } = await supabase
      .from('email_templates')
      .select('id, name, subject_template')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setEmailTemplates(data.map(t => ({
        id: t.id,
        name: t.name,
        subject: t.subject_template
      })));
    }
  }

  async function saveOpenAIKey() {
    setSaving(true);
    setSaveStatus('idle');

    try {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ openai_api_key: openaiApiKey })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({ openai_api_key: openaiApiKey });

        if (error) throw error;
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save API key:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  async function saveMsgraphCredentials() {
    setSavingMsgraph(true);
    setMsgraphSaveStatus('idle');

    try {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({
            msgraph_client_id: msgraphClientId,
            msgraph_client_secret: msgraphClientSecret,
            msgraph_tenant_id: msgraphTenantId,
            mailbox_address: mailboxAddress,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({
            msgraph_client_id: msgraphClientId,
            msgraph_client_secret: msgraphClientSecret,
            msgraph_tenant_id: msgraphTenantId,
            mailbox_address: mailboxAddress
          });

        if (error) throw error;
      }

      setMsgraphSaveStatus('success');
      setTimeout(() => setMsgraphSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save Microsoft Graph credentials:', error);
      setMsgraphSaveStatus('error');
    } finally {
      setSavingMsgraph(false);
    }
  }

  async function saveAutoDraftSettings() {
    setSavingAutoDraft(true);
    setAutoDraftSaveStatus('idle');

    try {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .maybeSingle();

      const updateData = {
        missing_details_template_id: missingDetailsTemplateId || null,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update(updateData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert(updateData);

        if (error) throw error;
      }

      setAutoDraftSaveStatus('success');
      setTimeout(() => setAutoDraftSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save auto-draft settings:', error);
      setAutoDraftSaveStatus('error');
    } finally {
      setSavingAutoDraft(false);
    }
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-slate-700" />
            <h1 className="text-3xl font-bold text-slate-900">Admin Settings</h1>
          </div>
          <p className="text-slate-600 font-medium">Configure integrations and system settings</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-5">
              <Key className="w-6 h-6 text-emerald-600 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900 mb-1">OpenAI Configuration</h2>
                <p className="text-sm text-slate-600 font-medium">
                  Configure OpenAI API key for intelligent email data extraction
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div>
                <label htmlFor="openai-key" className="block text-sm font-semibold text-slate-700 mb-2">
                  OpenAI API Key
                </label>
                <input
                  id="openai-key"
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline font-semibold">OpenAI Platform</a>
                </p>
              </div>

              <button
                onClick={saveOpenAIKey}
                disabled={saving || !openaiApiKey}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm font-semibold"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save API Key'}
              </button>

              {saveStatus === 'success' && (
                <div className="text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-200 font-semibold">
                  API key saved successfully
                </div>
              )}

              {saveStatus === 'error' && (
                <div className="text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg border border-red-200 font-semibold">
                  Failed to save API key. Please try again.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-5">
              <LinkIcon className="w-6 h-6 text-sky-600 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900 mb-1">Microsoft Graph Configuration</h2>
                <p className="text-sm text-slate-600 font-medium">
                  Configure your Microsoft Entra (Azure AD) app credentials for email integration
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div>
                <label htmlFor="mailbox-address" className="block text-sm font-semibold text-slate-700 mb-2">
                  Mailbox Address
                </label>
                <input
                  id="mailbox-address"
                  type="email"
                  value={mailboxAddress}
                  onChange={(e) => setMailboxAddress(e.target.value)}
                  placeholder="your-mailbox@yourdomain.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
                />
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  The email address to sync. This should be the mailbox where reservation enquiries are received.
                </p>
              </div>

              <div>
                <label htmlFor="tenant-id" className="block text-sm font-semibold text-slate-700 mb-2">
                  Tenant ID
                </label>
                <input
                  id="tenant-id"
                  type="text"
                  value={msgraphTenantId}
                  onChange={(e) => setMsgraphTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono text-sm transition-all"
                />
              </div>

              <div>
                <label htmlFor="client-id" className="block text-sm font-semibold text-slate-700 mb-2">
                  Client ID (Application ID)
                </label>
                <input
                  id="client-id"
                  type="text"
                  value={msgraphClientId}
                  onChange={(e) => setMsgraphClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono text-sm transition-all"
                />
              </div>

              <div>
                <label htmlFor="client-secret" className="block text-sm font-semibold text-slate-700 mb-2">
                  Client Secret
                </label>
                <input
                  id="client-secret"
                  type="password"
                  value={msgraphClientSecret}
                  onChange={(e) => setMsgraphClientSecret(e.target.value)}
                  placeholder="Enter client secret value"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono text-sm transition-all"
                />
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                <p className="text-xs text-sky-900 mb-2 font-bold">Where to find these values:</p>
                <ol className="text-xs text-sky-800 space-y-1 ml-4 list-decimal font-medium">
                  <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Azure Portal</a></li>
                  <li>Navigate to Microsoft Entra ID → App registrations</li>
                  <li>Select your app</li>
                  <li>
                    <strong>Tenant ID & Client ID:</strong> Found on the Overview page
                  </li>
                  <li>
                    <strong>Client Secret:</strong> Go to Certificates & secrets → Client secrets → New client secret
                  </li>
                </ol>
              </div>

              <button
                onClick={saveMsgraphCredentials}
                disabled={savingMsgraph || !msgraphClientId || !msgraphClientSecret || !msgraphTenantId || !mailboxAddress}
                className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm font-semibold"
              >
                <Save className="w-4 h-4" />
                {savingMsgraph ? 'Saving...' : 'Save Credentials'}
              </button>

              {msgraphSaveStatus === 'success' && (
                <div className="text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-200 font-semibold">
                  Microsoft Graph credentials saved successfully
                </div>
              )}

              {msgraphSaveStatus === 'error' && (
                <div className="text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg border border-red-200 font-semibold">
                  Failed to save credentials. Please try again.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-5">
              <LinkIcon className="w-6 h-6 text-sky-600 mt-1" />
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Email Integration</h2>
                <p className="text-sm text-slate-600 font-medium">
                  Connect to Microsoft 365 to sync emails from your configured mailbox
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <MSGraphSync mailboxAddress={mailboxAddress} onSyncComplete={onSyncComplete} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-5">
              <Mail className="w-6 h-6 text-amber-600 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900 mb-1">Auto-Draft Configuration</h2>
                <p className="text-sm text-slate-600 font-medium">
                  Automatically create draft replies when reservation details are incomplete
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div>
                <label htmlFor="missing-details-template" className="block text-sm font-semibold text-slate-700 mb-2">
                  Template for Missing Details
                </label>
                <select
                  id="missing-details-template"
                  value={missingDetailsTemplateId}
                  onChange={(e) => setMissingDetailsTemplateId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                >
                  <option value="">No auto-draft (disabled)</option>
                  {emailTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.subject}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  When a reservation email is received without complete dates or guest count,
                  a draft reply will be automatically created using this template.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-xs text-amber-900 mb-2 font-bold">Available Placeholders:</p>
                <ul className="text-xs text-amber-800 space-y-1 ml-4 list-disc font-medium">
                  <li><code className="bg-amber-100 px-1 rounded">{'{{guest_name}}'}</code> - Guest's name</li>
                  <li><code className="bg-amber-100 px-1 rounded">{'{{missing_fields_list}}'}</code> - List of missing details</li>
                  <li><code className="bg-amber-100 px-1 rounded">{'{{check_in_date}}'}</code> - Check-in date (if provided)</li>
                  <li><code className="bg-amber-100 px-1 rounded">{'{{check_out_date}}'}</code> - Check-out date (if provided)</li>
                  <li><code className="bg-amber-100 px-1 rounded">{'{{guest_count}}'}</code> - Number of guests (if provided)</li>
                </ul>
              </div>

              <button
                onClick={saveAutoDraftSettings}
                disabled={savingAutoDraft}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm font-semibold"
              >
                <Save className="w-4 h-4" />
                {savingAutoDraft ? 'Saving...' : 'Save Auto-Draft Settings'}
              </button>

              {autoDraftSaveStatus === 'success' && (
                <div className="text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-200 font-semibold">
                  Auto-draft settings saved successfully
                </div>
              )}

              {autoDraftSaveStatus === 'error' && (
                <div className="text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg border border-red-200 font-semibold">
                  Failed to save auto-draft settings. Please try again.
                </div>
              )}
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="bg-sky-600 rounded-full p-1.5 mt-0.5">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-sky-900 mb-1">Admin Access Only</h3>
                <p className="text-xs text-sky-800 font-medium">
                  This page is intended for administrators only. OAuth authentication should be set up once
                  and will sync emails automatically in the background. Regular users working with enquiries
                  won't need to access this page.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-5">System Information</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2.5 border-b border-slate-200">
                <span className="text-sm text-slate-600 font-medium">Application Version</span>
                <span className="text-sm font-bold text-slate-900">1.0.0</span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-slate-200">
                <span className="text-sm text-slate-600 font-medium">Configured Mailbox</span>
                <span className="text-sm font-bold text-slate-900">{mailboxAddress || 'Not configured'}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-600 font-medium">Integration Status</span>
                <span className="text-sm font-bold text-emerald-700">Stub Mode Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
