import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { Plus, Edit2, Trash2, Save, X, Info, Code2, Eye } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

type EmailTemplate = Database['public']['Tables']['email_templates']['Row'];

interface TemplateFormData {
  name: string;
  tone: string;
  subject_template: string;
  body_template: string;
  html_body_template: string;
  is_active: boolean;
}

export function TemplateAdmin() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    tone: 'professional',
    subject_template: '',
    body_template: '',
    html_body_template: '',
    is_active: true,
  });
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [htmlEditorMode, setHtmlEditorMode] = useState<'visual' | 'code'>('visual');

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  function startCreating() {
    setIsCreating(true);
    setEditingId(null);
    setFormData({
      name: '',
      tone: 'professional',
      subject_template: '',
      body_template: '',
      html_body_template: '',
      is_active: true,
    });
    setIsHtmlMode(false);
    setShowHtmlPreview(false);
    setHtmlEditorMode('visual');
  }

  function startEditing(template: EmailTemplate) {
    setEditingId(template.id);
    setIsCreating(false);
    setFormData({
      name: template.name,
      tone: template.tone,
      subject_template: template.subject_template,
      body_template: template.body_template,
      html_body_template: (template as any).html_body_template || '',
      is_active: template.is_active,
    });
    setIsHtmlMode(!!((template as any).html_body_template));
    setShowHtmlPreview(false);
    setHtmlEditorMode('visual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditing() {
    setEditingId(null);
    setIsCreating(false);
    setFormData({
      name: '',
      tone: 'professional',
      subject_template: '',
      body_template: '',
      html_body_template: '',
      is_active: true,
    });
    setIsHtmlMode(false);
    setShowHtmlPreview(false);
    setHtmlEditorMode('visual');
  }

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link', 'image'],
      ['clean'],
    ],
  };

  const quillFormats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'color',
    'background',
    'list',
    'bullet',
    'align',
    'link',
    'image',
  ];

  async function saveTemplate() {
    try {
      if (isCreating) {
        const { error } = await supabase
          .from('email_templates')
          .insert([formData]);

        if (error) throw error;
      } else if (editingId) {
        const { error } = await supabase
          .from('email_templates')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
      }

      await loadTemplates();
      cancelEditing();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  }

  const placeholders = [
    { key: '{{guest_name}}', description: 'Guest full name' },
    { key: '{{guest_email}}', description: 'Guest email address' },
    { key: '{{arrival_date}}', description: 'Check-in date' },
    { key: '{{departure_date}}', description: 'Check-out date' },
    { key: '{{adults}}', description: 'Number of adults' },
    { key: '{{children}}', description: 'Number of children' },
    { key: '{{room_types}}', description: 'Summary of room types' },
    { key: '{{room_details}}', description: 'Detailed room list with rates' },
    { key: '{{rate_amount}}', description: 'Total nightly rate (all rooms)' },
    { key: '{{total_nights}}', description: 'Number of nights' },
    { key: '{{total_cost}}', description: 'Total cost for entire stay' },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-600"></div>
          <span className="text-slate-600 font-medium">Loading templates...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Email Templates</h1>
            <p className="text-slate-600 mt-2 font-medium">Manage your email response templates</p>
          </div>
          {!isCreating && !editingId && (
            <button
              onClick={startCreating}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all shadow-sm font-semibold"
            >
              <Plus className="w-5 h-5" />
              New Template
            </button>
          )}
        </div>

        {(isCreating || editingId) && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {isCreating ? 'Create New Template' : 'Edit Template'}
              </h2>
              <button
                onClick={() => setShowPlaceholders(!showPlaceholders)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-sky-600 hover:bg-sky-50 rounded-lg transition-all border border-sky-200 font-semibold"
              >
                <Info className="w-4 h-4" />
                {showPlaceholders ? 'Hide' : 'Show'} Placeholders
              </button>
            </div>

            {showPlaceholders && (
              <div className="mb-6 p-5 bg-sky-50 rounded-lg border border-sky-200 shadow-sm">
                <h3 className="font-bold text-sky-900 mb-4 text-sm">Available Placeholders:</h3>
                <div className="grid grid-cols-2 gap-3">
                  {placeholders.map((placeholder) => (
                    <div key={placeholder.key} className="text-sm">
                      <code className="bg-sky-100 text-sky-800 px-2.5 py-1 rounded font-mono font-semibold border border-sky-200">
                        {placeholder.key}
                      </code>
                      <span className="text-slate-600 ml-2 font-medium">{placeholder.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
                  placeholder="e.g., Booking Confirmation"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tone
                </label>
                <select
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all font-medium"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Subject Template
                </label>
                <input
                  type="text"
                  value={formData.subject_template}
                  onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
                  placeholder="e.g., Booking Confirmation for {{guest_name}}"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Email Body Template
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsHtmlMode(false)}
                      className={`px-3 py-1 text-sm font-semibold rounded-lg transition-all ${
                        !isHtmlMode
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      Plain Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsHtmlMode(true)}
                      className={`px-3 py-1 text-sm font-semibold rounded-lg transition-all ${
                        isHtmlMode
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      HTML
                    </button>
                  </div>
                </div>
                {!isHtmlMode ? (
                  <textarea
                    value={formData.body_template}
                    onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
                    rows={12}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all font-mono text-sm"
                    placeholder="Dear {{guest_name}},&#10;&#10;Thank you for your reservation...&#10;&#10;Room Details:&#10;{{room_details}}&#10;&#10;Total Stay ({{total_nights}} nights): {{total_cost}}"
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        type="button"
                        onClick={() => setHtmlEditorMode('visual')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                          htmlEditorMode === 'visual'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        Visual Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => setHtmlEditorMode('code')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                          htmlEditorMode === 'code'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        <Code2 className="w-4 h-4" />
                        Source Code
                      </button>
                    </div>
                    {htmlEditorMode === 'visual' ? (
                      <div className="border border-slate-300 rounded-lg overflow-hidden">
                        <ReactQuill
                          theme="snow"
                          value={formData.html_body_template}
                          onChange={(value) => setFormData({ ...formData, html_body_template: value })}
                          modules={quillModules}
                          formats={quillFormats}
                          placeholder="Write your HTML email template here. Use {{placeholders}} for dynamic content."
                          className="bg-white"
                          style={{ minHeight: '300px' }}
                        />
                      </div>
                    ) : (
                      <textarea
                        value={formData.html_body_template}
                        onChange={(e) => setFormData({ ...formData, html_body_template: e.target.value })}
                        rows={16}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all font-mono text-sm"
                        placeholder="<html>&#10;<body style='font-family: Arial, sans-serif;'>&#10;  <h2>Hello {{guest_name}}</h2>&#10;  <p>Thank you for your reservation...</p>&#10;  <div>{{room_details}}</div>&#10;</body>&#10;</html>"
                      />
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-slate-700 font-medium">
                  Template is active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={saveTemplate}
                  disabled={!formData.name || !formData.subject_template || (!formData.body_template && !formData.html_body_template)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm font-semibold"
                >
                  <Save className="w-4 h-4" />
                  Save Template
                </button>
                <button
                  onClick={cancelEditing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all font-semibold"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`bg-white rounded-lg shadow-sm p-6 border ${
                editingId === template.id
                  ? 'border-sky-400 ring-2 ring-sky-100'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{template.name}</h3>
                    {template.is_active ? (
                      <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                        Inactive
                      </span>
                    )}
                    <span className="px-2.5 py-1 text-xs font-bold bg-sky-100 text-sky-700 rounded-full border border-sky-200">
                      {template.tone}
                    </span>
                    {(template as any).html_body_template && (
                      <span className="px-2.5 py-1 text-xs font-bold bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                        HTML
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 mb-3">
                    <span className="font-semibold">Subject:</span> {template.subject_template}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditing(template)}
                    disabled={isCreating || editingId !== null}
                    className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg transition-all border border-transparent hover:border-sky-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Edit template"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    disabled={isCreating || editingId !== null}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                {(template as any).html_body_template ? (
                  <div>
                    <p className="text-xs text-slate-500 font-semibold mb-3">HTML Template Preview:</p>
                    <div
                      className="bg-white border border-slate-200 rounded p-4"
                      dangerouslySetInnerHTML={{ __html: (template as any).html_body_template }}
                    />
                  </div>
                ) : (
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                    {template.body_template}
                  </pre>
                )}
              </div>
            </div>
          ))}

          {templates.length === 0 && !isCreating && (
            <div className="text-center py-16 bg-white rounded-lg border border-slate-200 shadow-sm">
              <p className="text-slate-500 mb-4 text-lg font-semibold">No templates yet</p>
              <button
                onClick={startCreating}
                className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all shadow-sm font-semibold"
              >
                <Plus className="w-5 h-5" />
                Create Your First Template
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
