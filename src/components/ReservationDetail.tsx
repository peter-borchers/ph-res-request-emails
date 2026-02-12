import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { Calendar, Users, Send, Mail, MessageSquare, RefreshCw, ChevronDown, ChevronUp, History, ExternalLink, Code2, Eye, Plus, Trash2, Edit, File, FileText, Paperclip, Upload, Archive, ArchiveRestore } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

type Conversation = Database['public']['Tables']['msgraph_conversations']['Row'];
type Message = Database['public']['Tables']['msgraph_messages']['Row'];
type Reservation = Database['public']['Tables']['reservations']['Row'];
type EmailTemplate = Database['public']['Tables']['email_templates']['Row'];
type RoomType = Database['public']['Tables']['room_types']['Row'];
type RoomProposal = Database['public']['Tables']['room_proposals']['Row'];
type TemplateAttachment = Database['public']['Tables']['template_attachments']['Row'];
type EmailDraft = Database['public']['Tables']['email_drafts']['Row'];

interface SelectedRoom {
  code: string;
  name: string;
  quantity: number;
  nightly_rate: number;
}

interface ReservationDetailProps {
  conversation: Conversation | null;
  onReservationUpdate?: () => void;
}

export function ReservationDetail({ conversation, onReservationUpdate }: ReservationDetailProps) {
  const [reservation, setReservation] = useState<Partial<Reservation>>({
    guest_name: '',
    arrival_date: '',
    departure_date: '',
    adults: 2,
    children: 0,
    room_types: [],
    nightly_rate_currency: 'ZAR',
    nightly_rate_amount: 0,
    archived: false,
  });
  const [roomCount, setRoomCount] = useState<number>(1);

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailPreview, setEmailPreview] = useState<string>('');
  const [availableTemplateNames, setAvailableTemplateNames] = useState<string[]>([]);
  const [availableTones, setAvailableTones] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<SelectedRoom[]>([]);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [mailboxAddress, setMailboxAddress] = useState<string>('');
  const [bookingUrlTemplate, setBookingUrlTemplate] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [showOriginalEmail, setShowOriginalEmail] = useState(false);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [hasManualEdit, setHasManualEdit] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctedText, setCorrectedText] = useState<string>('');
  const [isHtmlTemplate, setIsHtmlTemplate] = useState(false);
  const [htmlEditorMode, setHtmlEditorMode] = useState<'visual' | 'code'>('visual');
  const [roomProposals, setRoomProposals] = useState<RoomProposal[]>([]);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [editingProposal, setEditingProposal] = useState<RoomProposal | null>(null);
  const [proposalRooms, setProposalRooms] = useState<SelectedRoom[]>([]);
  const [proposalName, setProposalName] = useState<string>('');
  const [emailAttachments, setEmailAttachments] = useState<TemplateAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [newToEmail, setNewToEmail] = useState<string>('');
  const [newCcEmail, setNewCcEmail] = useState<string>('');
  const [messageAttachments, setMessageAttachments] = useState<Map<string, TemplateAttachment[]>>(new Map());
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([]);
  const [sendingDraft, setSendingDraft] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadRoomTypes();
    loadMailboxSettings();
  }, []);

  async function loadMailboxSettings() {
    const { data } = await supabase
      .from('settings')
      .select('mailbox_address, booking_url_template')
      .maybeSingle();

    if (data?.mailbox_address) {
      setMailboxAddress(data.mailbox_address);
    }
    if (data?.booking_url_template) {
      setBookingUrlTemplate(data.booking_url_template);
    }
  }

  function generateBookingUrl(): string {
    if (!bookingUrlTemplate) return '';

    const arrivalDate = reservation.arrival_date || '';
    const departureDate = reservation.departure_date || '';

    let url = bookingUrlTemplate;
    url = url.replace(/\{\{adultCount\}\}/g, String(reservation.adults || 0));
    url = url.replace(/\{\{childCount\}\}/g, String(reservation.children || 0));
    url = url.replace(/\{\{roomCount\}\}/g, String(roomCount));
    url = url.replace(/\{\{arrivalDate\}\}/g, arrivalDate);
    url = url.replace(/\{\{departureDate\}\}/g, departureDate);

    return url;
  }

  async function markConversationAsViewed(conversationUuid: string) {
    const { data: conv } = await supabase
      .from('msgraph_conversations')
      .select('viewed_at')
      .eq('id', conversationUuid)
      .maybeSingle();

    if (conv && !conv.viewed_at) {
      await supabase
        .from('msgraph_conversations')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', conversationUuid);
    }
  }

  useEffect(() => {
    if (conversation) {
      loadReservationData(conversation.conversation_id);
      markMessagesAsRead(conversation.id);
      markConversationAsViewed(conversation.id);
      loadMessageHistory(conversation.id);
      setShowCompose(false);
    }
  }, [conversation]);

  useEffect(() => {
    if (reservationId) {
      loadRoomProposals(reservationId);
      loadEmailDrafts(reservationId);
    }
  }, [reservationId]);

  useEffect(() => {
    if (messages.length > 0 && !expandedMessageId) {
      setExpandedMessageId(messages[messages.length - 1].id);
    }
  }, [messages]);

  useEffect(() => {
    generateEmailPreview();
  }, [reservation, selectedTemplate, templates, selectedRooms, roomProposals]);

  useEffect(() => {
    loadTemplateAttachments();
  }, [selectedTemplate, templates]);

  useEffect(() => {
    if (showCompose && toRecipients.length === 0) {
      initializeRecipients();
    }
  }, [showCompose, conversation, messages]);

  useEffect(() => {
    if (conversation && reservationId) {
      loadMessageAttachments(conversation.id);
    }
  }, [conversation, reservationId, messages]);

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

  async function loadTemplates() {
    const { data } = await supabase
      .from('email_templates')
      .select(`
        *,
        email_template_attachments (
          id,
          template_attachments (
            id,
            filename,
            display_name,
            file_size,
            content_type,
            storage_path
          )
        )
      `)
      .eq('is_active', true)
      .order('name');

    if (data && data.length > 0) {
      setTemplates(data);

      const uniqueNames = [...new Set(data.map(t => t.name))];
      const uniqueTones = [...new Set(data.map(t => t.tone))];

      setAvailableTemplateNames(uniqueNames);
      setAvailableTones(uniqueTones);

      if (!selectedTemplate && data.length > 0) {
        setSelectedTemplate(data[0].id);
      }
    }
  }

  async function loadRoomTypes() {
    const { data } = await supabase
      .from('room_types')
      .select('*')
      .eq('is_active', true)
      .order('code');

    if (data) {
      setRoomTypes(data);
    }
  }

  async function loadRoomProposals(resId: string) {
    const { data } = await supabase
      .from('room_proposals')
      .select('*')
      .eq('reservation_id', resId)
      .order('display_order');

    if (data) {
      setRoomProposals(data);
    }
  }

  function loadTemplateAttachments() {
    if (!selectedTemplate || templates.length === 0) {
      setEmailAttachments([]);
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);
    if (template && (template as any).email_template_attachments) {
      const attachments = (template as any).email_template_attachments
        .map((eta: any) => eta.template_attachments)
        .filter((att: any) => att !== null);
      setEmailAttachments(attachments);
    } else {
      setEmailAttachments([]);
    }
  }

  async function handleAttachmentUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    try {
      // Generate unique file path with timestamp
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const storagePath = `${timestamp}-${fileName}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('template-attachments')
        .upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Store metadata in database
      const { data: attachment, error: dbError } = await supabase
        .from('template_attachments')
        .insert({
          filename: file.name,
          display_name: file.name,
          file_size: file.size,
          content_type: file.type || 'application/octet-stream',
          storage_path: storagePath,
        })
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await supabase.storage.from('template-attachments').remove([storagePath]);
        console.error('Database error:', dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      if (attachment) {
        setEmailAttachments([...emailAttachments, attachment]);
      }
    } catch (error) {
      console.error('Error uploading attachment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to upload file: ${errorMessage}`);
    } finally {
      setUploadingAttachment(false);
      event.target.value = '';
    }
  }

  function removeEmailAttachment(attachmentId: string) {
    setEmailAttachments(emailAttachments.filter(a => a.id !== attachmentId));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function initializeRecipients() {
    const recipientEmail = reservation.guest_email || messages[0]?.from_email;
    if (recipientEmail && !toRecipients.includes(recipientEmail)) {
      setToRecipients([recipientEmail]);
    }
  }

  function addToRecipient() {
    const email = newToEmail.trim();
    if (email && !toRecipients.includes(email)) {
      if (isValidEmail(email)) {
        setToRecipients([...toRecipients, email]);
        setNewToEmail('');
      } else {
        alert('Please enter a valid email address');
      }
    }
  }

  function removeToRecipient(email: string) {
    setToRecipients(toRecipients.filter(e => e !== email));
  }

  function addCcRecipient() {
    const email = newCcEmail.trim();
    if (email && !ccRecipients.includes(email)) {
      if (isValidEmail(email)) {
        setCcRecipients([...ccRecipients, email]);
        setNewCcEmail('');
      } else {
        alert('Please enter a valid email address');
      }
    }
  }

  function removeCcRecipient(email: string) {
    setCcRecipients(ccRecipients.filter(e => e !== email));
  }

  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function openAddProposalModal() {
    setEditingProposal(null);
    setProposalName('');
    setProposalRooms([]);
    setShowProposalModal(true);
  }

  function openEditProposalModal(proposal: RoomProposal) {
    setEditingProposal(proposal);
    setProposalName(proposal.proposal_name);
    setProposalRooms(proposal.rooms as SelectedRoom[]);
    setShowProposalModal(true);
  }

  async function saveProposal() {
    if (!reservationId || proposalRooms.length === 0) {
      alert('Please add at least one room to the proposal');
      return;
    }

    const proposalData = {
      reservation_id: reservationId,
      proposal_name: proposalName || `Option ${roomProposals.length + 1}`,
      rooms: proposalRooms,
      display_order: editingProposal?.display_order ?? roomProposals.length
    };

    if (editingProposal) {
      await supabase
        .from('room_proposals')
        .update(proposalData)
        .eq('id', editingProposal.id);
    } else {
      await supabase
        .from('room_proposals')
        .insert(proposalData);
    }

    await loadRoomProposals(reservationId);
    setShowProposalModal(false);
    setProposalName('');
    setProposalRooms([]);
    setEditingProposal(null);
  }

  async function deleteProposal(proposalId: string) {
    if (!confirm('Are you sure you want to delete this proposal?')) return;

    await supabase
      .from('room_proposals')
      .delete()
      .eq('id', proposalId);

    if (reservationId) {
      await loadRoomProposals(reservationId);
    }
  }

  function toggleProposalRoom(roomType: RoomType) {
    const isSelected = proposalRooms.some(r => r.code === roomType.code);

    if (isSelected) {
      setProposalRooms(proposalRooms.filter(r => r.code !== roomType.code));
    } else {
      setProposalRooms([...proposalRooms, {
        code: roomType.code,
        name: roomType.name,
        quantity: 1,
        nightly_rate: 0
      }]);
    }
  }

  function updateProposalRoomQuantity(code: string, quantity: number) {
    setProposalRooms(proposalRooms.map(room =>
      room.code === code ? { ...room, quantity: Math.max(1, quantity) } : room
    ));
  }

  function updateProposalRoomRate(code: string, rate: number) {
    setProposalRooms(proposalRooms.map(room =>
      room.code === code ? { ...room, nightly_rate: Math.max(0, rate) } : room
    ));
  }

  async function loadMessageHistory(conversationUuid: string) {
    const { data } = await supabase
      .from('msgraph_messages')
      .select('*')
      .eq('conversation_uuid', conversationUuid)
      .order('received_at', { ascending: true });

    if (data) {
      setMessages(data);
      loadMessageAttachments(conversationUuid);
    }
  }

  async function loadMessageAttachments(conversationUuid: string) {
    if (!reservationId) return;

    const { data, error } = await supabase
      .from('message_attachments')
      .select(`
        *,
        template_attachments (
          id,
          filename,
          display_name,
          file_size,
          content_type,
          storage_path
        )
      `)
      .eq('reservation_id', reservationId);

    if (!error && data) {
      const attachmentsByMessage = new Map<string, TemplateAttachment[]>();

      data.forEach((msgAttachment: any) => {
        if (msgAttachment.template_attachments) {
          const existing = attachmentsByMessage.get(msgAttachment.reservation_id) || [];
          attachmentsByMessage.set(
            msgAttachment.reservation_id,
            [...existing, msgAttachment.template_attachments]
          );
        }
      });

      setMessageAttachments(attachmentsByMessage);
    }
  }

  async function loadEmailDrafts(resId: string) {
    const { data, error } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('reservation_id', resId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEmailDrafts(data);
    }
  }

  async function sendDraft(draft: EmailDraft) {
    if (!conversation || !reservationId) return;

    setSendingDraft(draft.id);

    await supabase.from('email_drafts').update({ status: 'sending' }).eq('id', draft.id);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservationId: draft.reservation_id,
          conversationId: draft.conversation_id,
          toRecipients: draft.to_recipients,
          ccRecipients: draft.cc_recipients || [],
          subject: draft.subject,
          bodyHtml: draft.body_html || undefined,
          bodyText: draft.body_text || undefined,
          templateId: draft.template_id,
          attachmentIds: [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      // 3) mark sent
      await supabase.from('email_drafts').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id);

      await loadEmailDrafts(reservationId);
      await refreshMessageHistory();

      if (onReservationUpdate) {
        onReservationUpdate();
      }

      setEmailDrafts(prev => prev.filter(d => d.id !== draft.id));
      
      alert('Email sent successfully!');
    } catch (error) {
      console.error('Error sending draft:', error);

      await supabase
        .from('email_drafts')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          attempt_count: draft.attempt_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id);

      await loadEmailDrafts(reservationId);
      alert('Failed to send email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSendingDraft(null);
    }
  }

  async function deleteDraft(draftId: string) {
    if (!confirm('Are you sure you want to delete this draft?')) return;

    await supabase
      .from('email_drafts')
      .delete()
      .eq('id', draftId);

    if (reservationId) {
      await loadEmailDrafts(reservationId);
    }
  }

  async function editDraft(draft: EmailDraft) {
    if (draft.template_id) {
      setSelectedTemplate(draft.template_id);
    }

    const recipients = Array.isArray(draft.to_recipients) ? draft.to_recipients : [];
    setToRecipients(recipients);

    const ccRecipientsArray = Array.isArray(draft.cc_recipients) ? draft.cc_recipients : [];
    setCcRecipients(ccRecipientsArray);

    if (draft.body_html) {
      setEmailPreview(draft.body_html);
      setIsHtmlTemplate(true);
    } else if (draft.body_text) {
      setEmailPreview(draft.body_text);
      setIsHtmlTemplate(false);
    }

    setShowCompose(true);

    await supabase
      .from('email_drafts')
      .delete()
      .eq('id', draft.id);

    if (reservationId) {
      await loadEmailDrafts(reservationId);
    }
  }

  async function refreshMessageHistory() {
    if (!conversation || !mailboxAddress) return;

    setRefreshing(true);
    try {
      const syncResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/msgraph/sync-conversation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mailbox_address: mailboxAddress,
            conversation_id: conversation.conversation_id
          }),
        }
      );

      if (!syncResponse.ok) {
        console.error('Sync failed:', await syncResponse.text());
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      await loadMessageHistory(conversation.id);
      await loadReservationData(conversation.conversation_id);

      if (onReservationUpdate) {
        onReservationUpdate();
      }
    } catch (error) {
      console.error('Error refreshing messages:', error);
      alert('Failed to refresh messages');
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleArchive() {
    if (!reservationId) return;

    const newArchivedState = !(reservation.archived ?? false);

    const { error } = await supabase
      .from('reservations')
      .update({ archived: newArchivedState })
      .eq('id', reservationId);

    if (error) {
      console.error('Error archiving reservation:', error);
      alert('Failed to archive reservation');
      return;
    }

    setReservation({ ...reservation, archived: newArchivedState });

    if (onReservationUpdate) {
      onReservationUpdate();
    }
  }

  async function markMessagesAsRead(conversationUuid: string) {
    const { data: settings } = await supabase
      .from('settings')
      .select('mailbox_address')
      .maybeSingle();

    const mailboxAddress = settings?.mailbox_address;
    if (!mailboxAddress) return;

    const { data: unreadMessages } = await supabase
      .from('msgraph_messages')
      .select('msgraph_message_id, is_read')
      .eq('conversation_uuid', conversationUuid)
      .eq('is_read', false);

    if (unreadMessages && unreadMessages.length > 0) {
      for (const msg of unreadMessages) {
        try {
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/msgraph/mark-read`;
          await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message_id: msg.msgraph_message_id,
              mailbox_address: mailboxAddress
            }),
          });
        } catch (error) {
          console.error('Error marking message as read:', error);
        }
      }
    }
  }

  async function loadReservationData(conversationId: string) {
    setHasUnsavedChanges(false);

    const { data: existingReservation } = await supabase
      .from('reservations')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (existingReservation) {
      setReservationId(existingReservation.id);
      setReservation({
        guest_name: existingReservation.guest_name,
        arrival_date: existingReservation.arrival_date,
        departure_date: existingReservation.departure_date,
        adults: existingReservation.adults,
        children: existingReservation.children,
        room_types: existingReservation.room_types || [],
        nightly_rate_currency: existingReservation.nightly_rate_currency,
        nightly_rate_amount: existingReservation.nightly_rate_amount,
        additional_info: existingReservation.additional_info || '',
        archived: existingReservation.archived ?? false,
      });

      if (existingReservation.room_details && existingReservation.room_details.length > 0) {
        setSelectedRooms(existingReservation.room_details);
      } else if (existingReservation.room_types && existingReservation.room_types.length > 0) {
        const roomsFromDb = existingReservation.room_types.map((code: string) => {
          const roomType = roomTypes.find(rt => rt.code === code);
          return {
            code,
            name: roomType?.name || code,
            quantity: 1,
            nightly_rate: 0
          };
        });
        setSelectedRooms(roomsFromDb);
      } else {
        setSelectedRooms([]);
      }
    } else {
      setReservationId(null);
      setReservation({
        guest_name: '',
        arrival_date: '',
        departure_date: '',
        adults: 2,
        children: 0,
        room_types: [],
        nightly_rate_currency: 'ZAR',
        nightly_rate_amount: 0,
        archived: false,
      });
      setSelectedRooms([]);
    }
  }

  async function saveReservation() {
    if (!conversation) return;

    const roomTypeCodes = selectedRooms.map(r => r.code);

    const reservationData = {
      conversation_id: conversation.conversation_id,
      guest_name: reservation.guest_name,
      guest_email: reservation.guest_email,
      arrival_date: reservation.arrival_date,
      departure_date: reservation.departure_date,
      adults: reservation.adults || 0,
      children: reservation.children || 0,
      room_types: roomTypeCodes,
      room_details: selectedRooms,
      nightly_rate_currency: reservation.nightly_rate_currency || 'ZAR',
      nightly_rate_amount: reservation.nightly_rate_amount || 0,
      additional_info: reservation.additional_info || null,
      status: 'pending'
    };

    if (reservationId) {
      await supabase
        .from('reservations')
        .update(reservationData)
        .eq('id', reservationId);
    } else {
      const { data } = await supabase
        .from('reservations')
        .insert(reservationData)
        .select()
        .single();

      if (data) {
        setReservationId(data.id);
      }
    }

    setHasUnsavedChanges(false);

    if (onReservationUpdate) {
      onReservationUpdate();
    }
  }

  function updateReservation(updates: Partial<Reservation>) {
    setReservation({ ...reservation, ...updates });
    setHasUnsavedChanges(true);
  }

  async function extractReservationData(message: Message) {
    setExtracting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-reservation`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailContent: `From: ${message.from_name} <${message.from_email}>
Subject: ${message.subject}

${message.body_content || message.body_preview}`,
          reservationId: reservationId || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to extract data:', errorData);

        fallbackExtraction(message);
        return;
      }

      const result = await response.json();
      const extracted = result.data;

      if (result.skipped) {
        console.log('Extraction skipped:', result.reason);
      }

      const updatedReservation = {
        ...reservation,
        guest_name: extracted.guest_name || message.from_name,
        guest_email: extracted.guest_email || message.from_email,
        arrival_date: extracted.arrival_date || '',
        departure_date: extracted.departure_date || '',
        adults: extracted.adult_count || 2,
        children: extracted.child_count || 0,
        additional_info: extracted.additional_info || reservation.additional_info || '',
      };

      setReservation(updatedReservation);

      // Save extracted data to database immediately
      if (conversation) {
        const roomTypeCodes = selectedRooms.map(r => r.code);

        const reservationData = {
          conversation_id: conversation.conversation_id,
          guest_name: updatedReservation.guest_name,
          guest_email: updatedReservation.guest_email,
          arrival_date: updatedReservation.arrival_date,
          departure_date: updatedReservation.departure_date,
          adults: updatedReservation.adults || 0,
          children: updatedReservation.children || 0,
          room_types: roomTypeCodes,
          room_details: selectedRooms,
          nightly_rate_currency: updatedReservation.nightly_rate_currency || 'ZAR',
          nightly_rate_amount: updatedReservation.nightly_rate_amount || 0,
          additional_info: updatedReservation.additional_info || null,
          status: 'pending'
        };

        if (reservationId) {
          await supabase
            .from('reservations')
            .update(reservationData)
            .eq('id', reservationId);
        } else {
          const { data } = await supabase
            .from('reservations')
            .insert(reservationData)
            .select()
            .single();

          if (data) {
            setReservationId(data.id);
          }
        }

        setHasUnsavedChanges(false);

        // Refresh message history after save
        await refreshMessageHistory();
      }
    } catch (error) {
      console.error('Error extracting reservation data:', error);
      fallbackExtraction(message);
    } finally {
      setExtracting(false);
    }
  }

  function fallbackExtraction(message: Message) {
    const body = (message.body_content || message.body_preview).toLowerCase();

    const dateMatch = body.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{4})/g);
    const adultsMatch = body.match(/(\d+)\s*adults?/i);
    const childrenMatch = body.match(/(\d+)\s*children?/i);
    const roomMatch = body.match(/\b(CR|CMT|COS|FS|STU|MAB|CMD|CA)\b/gi);

    setReservation({
      guest_name: message.from_name,
      guest_email: message.from_email,
      arrival_date: dateMatch && dateMatch[0] ? parseDateString(dateMatch[0]) : '',
      departure_date: dateMatch && dateMatch[1] ? parseDateString(dateMatch[1]) : '',
      adults: adultsMatch ? parseInt(adultsMatch[1]) : 2,
      children: childrenMatch ? parseInt(childrenMatch[1]) : 0,
      room_types: roomMatch ? [...new Set(roomMatch.map(r => r.toUpperCase()))] : [],
      nightly_rate_currency: 'ZAR',
      nightly_rate_amount: 0,
      archived: false,
    });
  }

  function parseDateString(dateStr: string): string {
    const parts = dateStr.split(/[\/\-\s]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return '';
  }

  function toggleRoomSelection(roomType: RoomType) {
    const isSelected = selectedRooms.some(r => r.code === roomType.code);

    if (isSelected) {
      setSelectedRooms(selectedRooms.filter(r => r.code !== roomType.code));
    } else {
      setSelectedRooms([...selectedRooms, {
        code: roomType.code,
        name: roomType.name,
        quantity: 1,
        nightly_rate: 0
      }]);
    }
    setHasUnsavedChanges(true);
  }

  function updateRoomQuantity(code: string, quantity: number) {
    setSelectedRooms(selectedRooms.map(room =>
      room.code === code ? { ...room, quantity: Math.max(1, quantity) } : room
    ));
    setHasUnsavedChanges(true);
  }

  function updateRoomRate(code: string, rate: number) {
    setSelectedRooms(selectedRooms.map(room =>
      room.code === code ? { ...room, nightly_rate: Math.max(0, rate) } : room
    ));
    setHasUnsavedChanges(true);
  }

  function generateEmailPreview() {
    const template = templates.find(t => t.id === selectedTemplate);

    if (!template || !reservation.guest_name) {
      setEmailPreview('Please select a template and fill in the guest details to preview the email.');
      setHasManualEdit(false);
      setIsHtmlTemplate(false);
      return;
    }

    const hasHtml = !!((template as any).html_body_template);
    setIsHtmlTemplate(hasHtml);

    const arrivalDate = reservation.arrival_date || '';
    const departureDate = reservation.departure_date || '';
    const nights = arrivalDate && departureDate
      ? Math.ceil((new Date(departureDate).getTime() - new Date(arrivalDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    let roomDetailsText = '';
    if (roomProposals.length > 0) {
      roomDetailsText = roomProposals.map((proposal, idx) => {
        const proposalRooms = proposal.rooms as SelectedRoom[];
        const totalRoomRate = proposalRooms.reduce((total, room) =>
          total + (room.quantity * room.nightly_rate), 0
        );
        const totalCost = totalRoomRate * nights;

        const roomsList = proposalRooms.map(room =>
          `  ${room.quantity}x ${room.name} (${room.code}) - R${room.nightly_rate} per night`
        ).join('\n');

        return `${proposal.proposal_name}:\n${roomsList}\n  Total per night: R${totalRoomRate}\n  Total for ${nights} nights: R${totalCost}`;
      }).join('\n\n');
    } else {
      roomDetailsText = 'No room proposals yet';
    }

    const roomSummary = roomProposals.length > 0
      ? `${roomProposals.length} option${roomProposals.length > 1 ? 's' : ''} available`
      : 'No rooms proposed';

    let preview = hasHtml ? (template as any).html_body_template : template.body_template;

    preview = preview.replace(/\{\{guest_name\}\}/g, reservation.guest_name || '');
    preview = preview.replace(/\{\{guest_email\}\}/g, reservation.guest_email || messages[0]?.from_email || '');
    preview = preview.replace(/\{\{arrival_date\}\}/g, formatDate(arrivalDate));
    preview = preview.replace(/\{\{departure_date\}\}/g, formatDate(departureDate));
    preview = preview.replace(/\{\{adults\}\}/g, String(reservation.adults || 0));
    preview = preview.replace(/\{\{children\}\}/g, String(reservation.children || 0));
    preview = preview.replace(/\{\{room_types\}\}/g, roomSummary);
    preview = preview.replace(/\{\{room_details\}\}/g, roomDetailsText);
    preview = preview.replace(/\{\{total_nights\}\}/g, String(nights));

    setEmailPreview(preview);
    setHasManualEdit(false);
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  async function handleCheckEmailText() {
    if (!emailPreview) return;

    setCheckingEmail(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-email-text`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailText: emailPreview
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to check email: ${error.error}`);
        return;
      }

      const result = await response.json();

      // Only show modal if the text is different
      if (result.correctedText !== emailPreview) {
        setCorrectedText(result.correctedText);
        setShowCorrectionModal(true);
      } else {
        alert('No corrections needed! Your email looks good.');
        setHasManualEdit(false);
      }
    } catch (error) {
      console.error('Error checking email:', error);
      alert('Failed to check email text');
    } finally {
      setCheckingEmail(false);
    }
  }

  function handleAcceptCorrection() {
    setEmailPreview(correctedText);
    setShowCorrectionModal(false);
    setCorrectedText('');
    setHasManualEdit(false);
  }

  async function handleSendEmail() {
    if (!conversation || !messages.length || !reservationId) return;

    if (toRecipients.length === 0) {
      alert('Please add at least one recipient');
      return;
    }

    const { data: settings } = await supabase
      .from('settings')
      .select('mailbox_address')
      .maybeSingle();

    const mailboxAddressFromSettings = settings?.mailbox_address;
    if (!mailboxAddressFromSettings) {
      alert('Mailbox address not configured');
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);

    setSendingEmail(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservationId,
          conversationId: conversation.conversation_id,
          toRecipients,
          ccRecipients,
          subject: template?.subject_template.replace(/\{\{guest_name\}\}/g, reservation.guest_name || '') || 'Booking Information',
          bodyHtml: isHtmlTemplate ? emailPreview : undefined,
          bodyText: isHtmlTemplate ? undefined : emailPreview,
          templateId: selectedTemplate,
          attachmentIds: emailAttachments.map(a => a.id)
        }),
      });

      if (response.ok) {
        alert('Email sent successfully!');
        setShowCompose(false);

        setTimeout(async () => {
          await refreshMessageHistory();
        }, 4000);
      } else {
        const error = await response.json();
        alert(`Failed to send email: ${error.error}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <Mail className="w-20 h-20 mx-auto mb-4 opacity-50" />
          <p className="text-xl font-semibold text-slate-600">Select an enquiry to view details</p>
          <p className="text-sm text-slate-500 mt-2">Choose an email from the inbox to get started</p>
        </div>
      </div>
    );
  }

  const calculateNights = () => {
    if (!reservation.arrival_date || !reservation.departure_date) return 0;
    const arrival = new Date(reservation.arrival_date);
    const departure = new Date(reservation.departure_date);
    return Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-screen overflow-hidden">
      {/* Fixed Header Section */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-8 py-3">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-slate-900">{conversation.subject}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshMessageHistory}
                disabled={refreshing}
                className="px-4 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-2 font-medium border border-slate-200 shadow-sm disabled:opacity-50 text-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              {reservationId && (
                <button
                  onClick={toggleArchive}
                  className={`px-4 py-1.5 rounded-lg transition-all flex items-center gap-2 font-medium shadow-sm text-sm ${
                    reservation.archived
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-600 text-white hover:bg-slate-700'
                  }`}
                >
                  {reservation.archived ? (
                    <>
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      Archive
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {extracting && (
            <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                <span className="text-sm text-emerald-800 font-semibold">
                  Extracting reservation data using AI...
                </span>
              </div>
            </div>
          )}

          {/* Guest & Stay Details Grid */}
          <div className="grid grid-cols-12 gap-4">
            {/* Guest Info */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Guest Name</label>
              <input
                type="text"
                value={reservation.guest_name || ''}
                onChange={(e) => updateReservation({ guest_name: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
              />
            </div>

            {/* Arrival Date */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Arrival</label>
              <input
                type="date"
                value={reservation.arrival_date || ''}
                onChange={(e) => updateReservation({ arrival_date: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
              />
            </div>

            {/* Departure Date */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Departure</label>
              <input
                type="date"
                value={reservation.departure_date || ''}
                onChange={(e) => updateReservation({ departure_date: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
              />
            </div>

            {/* Adults */}
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Adults</label>
              <input
                type="number"
                min="1"
                value={reservation.adults || 0}
                onChange={(e) => updateReservation({ adults: parseInt(e.target.value) })}
                className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
              />
            </div>

            {/* Children */}
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Children</label>
              <input
                type="number"
                min="0"
                value={reservation.children || 0}
                onChange={(e) => updateReservation({ children: parseInt(e.target.value) })}
                className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
              />
            </div>

            {/* Rooms */}
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Rooms</label>
              <input
                type="number"
                min="1"
                value={roomCount}
                onChange={(e) => setRoomCount(parseInt(e.target.value) || 1)}
                className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
              />
            </div>

            {/* Search Availability Button */}
            {bookingUrlTemplate && (
              <div className="col-span-3 flex items-end">
                <a
                  href={generateBookingUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all text-xs font-semibold shadow-sm w-full"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Search Availability Online
                </a>
              </div>
            )}
          </div>

          {/* Room Proposals */}
          <div className="mt-3">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-600">Room/Rate Proposals</label>
              <button
                onClick={openAddProposalModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all font-semibold text-xs shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Room/Rate Proposal
              </button>
            </div>

            {roomProposals.length > 0 ? (
              <div className="space-y-2">
                {roomProposals.map((proposal) => {
                  const proposalRooms = proposal.rooms as SelectedRoom[];
                  const arrivalDate = reservation.arrival_date || '';
                  const departureDate = reservation.departure_date || '';
                  const nights = arrivalDate && departureDate
                    ? Math.ceil((new Date(departureDate).getTime() - new Date(arrivalDate).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  const totalRoomRate = proposalRooms.reduce((total, room) =>
                    total + (room.quantity * room.nightly_rate), 0
                  );
                  const totalCost = totalRoomRate * nights;

                  return (
                    <div key={proposal.id} className="bg-white rounded-lg border border-slate-300 p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-900 text-sm">{proposal.proposal_name}</h4>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditProposalModal(proposal)}
                            className="p-1 text-slate-600 hover:text-sky-600 transition-all"
                            title="Edit proposal"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteProposal(proposal.id)}
                            className="p-1 text-slate-600 hover:text-red-600 transition-all"
                            title="Delete proposal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {proposalRooms.map((room) => (
                          <div key={room.code} className="flex items-center gap-2 text-sm">
                            <span className="font-semibold text-slate-900">{room.code}</span>
                            <span className="text-slate-600">-</span>
                            <span className="text-slate-700">{room.quantity}x {room.name}</span>
                            <span className="text-slate-600">@</span>
                            <span className="font-semibold text-slate-900">R{room.nightly_rate}/night</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                        <span className="text-slate-600">Per night: <span className="font-bold text-slate-900">R{totalRoomRate}</span></span>
                        {nights > 0 && (
                          <span className="text-slate-600">Total ({nights} nights): <span className="font-bold text-emerald-700">R{totalCost}</span></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 text-sm">
                No room proposals yet. Click "Add Room/Rate Proposal" to create one.
              </div>
            )}
          </div>

          {hasUnsavedChanges && (
            <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-2.5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-amber-900">Unsaved changes</span>
              </div>
              <button
                onClick={saveReservation}
                className="px-4 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all font-semibold shadow-sm text-sm"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Conversation History + Compose Section */}
      <div className="flex-1 overflow-y-auto bg-slate-50 px-8 py-4">
        <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-sky-600" />
          Conversation History
          <span className="text-sm text-slate-500 font-medium">({messages.length + emailDrafts.length})</span>
        </h3>

        {messages.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-base font-semibold">No messages yet</p>
            <p className="text-sm mt-1">Messages will appear here once synchronized</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {messages.map((msg, idx) => {
              const mailboxDomain = mailboxAddress ? mailboxAddress.split('@')[1] : '';
              const isOutgoing = mailboxDomain && msg.from_email ? msg.from_email.includes(`@${mailboxDomain}`) : false;
              const isLatest = idx === messages.length - 1;
              const hasDraft = isLatest && emailDrafts.length > 0;
              const isExpanded = hasDraft ? false : expandedMessageId === msg.id;

              return (
                <React.Fragment key={msg.id}>
                  <div
                    className={`rounded-lg border shadow-sm transition-all ${
                      isOutgoing
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-sky-50 border-sky-200'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedMessageId(isExpanded ? null : msg.id)}
                      className="w-full p-3 text-left hover:bg-opacity-80 transition-all"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="space-y-1 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-600">From:</span>
                              <span className="font-bold text-slate-900 text-sm">{msg.from_name}</span>
                              <span className="text-xs text-slate-600">{msg.from_email}</span>
                              {isOutgoing && (
                                <span className="px-2 py-0.5 text-xs font-bold bg-emerald-200 text-emerald-800 rounded border border-emerald-300">
                                  You
                                </span>
                              )}
                              {isLatest && !isOutgoing && (
                                <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded border border-amber-200">
                                  Latest
                                </span>
                              )}
                            </div>

                            {msg.to_emails && Array.isArray(msg.to_emails) && msg.to_emails.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-600">To:</span>
                                <span className="text-xs text-slate-600">
                                  {(msg.to_emails as any[]).map((email: any, i: number) => (
                                    <span key={i}>
                                      {typeof email === 'string' ? email : email.emailAddress?.address || email.address || ''}
                                      {i < msg.to_emails.length - 1 && ', '}
                                    </span>
                                  ))}
                                </span>
                              </div>
                            )}
                          </div>

                          {!isExpanded && (
                            <div className="text-sm text-slate-600 mt-2 line-clamp-2">
                              {msg.body_preview}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            {new Date(msg.received_at).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-slate-300">
                        {msg.subject && (
                          <div className="text-sm font-bold text-slate-700 mb-2 mt-2">
                            Subject: {msg.subject}
                          </div>
                        )}
                        <div
                          className="text-slate-700 text-sm prose max-w-none"
                          dangerouslySetInnerHTML={{ __html: msg.body_content || msg.body_preview }}
                        />

                        {reservationId && messageAttachments.get(reservationId) && messageAttachments.get(reservationId)!.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Paperclip className="w-4 h-4 text-slate-500" />
                              <span className="text-xs font-bold text-slate-600">
                                Attachments ({messageAttachments.get(reservationId)!.length})
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {messageAttachments.get(reservationId)!.map((attachment) => (
                                <div
                                  key={attachment.id}
                                  className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 hover:border-slate-300 transition-all"
                                >
                                  {attachment.content_type.includes('pdf') ? (
                                    <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                                  ) : (
                                    <File className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-900 truncate">
                                      {attachment.display_name || attachment.filename}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {formatFileSize(attachment.file_size)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Show drafts after the latest message */}
                  {isLatest && emailDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="rounded-lg border shadow-sm p-4 bg-amber-50 border-amber-300"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-200 text-amber-800 border border-amber-300">
                              DRAFT
                            </span>
                            <span className="text-xs text-slate-600">
                              Created {new Date(draft.created_at).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-slate-900 mb-1">{draft.subject}</div>
                          <div className="text-xs text-slate-600 mb-1">
                            To: {Array.isArray(draft.to_recipients) ? draft.to_recipients.join(', ') : 'No recipients'}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-700 mb-3 p-2 bg-white rounded border border-slate-200 max-h-48 overflow-y-auto">
                        {draft.body_text ? (
                          <div className="whitespace-pre-wrap">{draft.body_text}</div>
                        ) : draft.body_html ? (
                          <div dangerouslySetInnerHTML={{ __html: draft.body_html }} />
                        ) : (
                          <span className="text-slate-400 italic">No content</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => sendDraft(draft)}
                          disabled={sendingDraft === draft.id}
                          className="px-3 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all font-semibold flex items-center gap-1.5 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm text-xs"
                        >
                          {sendingDraft === draft.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              Send Now
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => editDraft(draft)}
                          disabled={sendingDraft === draft.id}
                          className="px-3 py-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-all font-semibold flex items-center gap-1.5 border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-xs"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteDraft(draft.id)}
                          disabled={sendingDraft === draft.id}
                          className="px-3 py-1.5 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-all font-semibold flex items-center gap-1.5 border border-red-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Compose Reply Button - Below Messages */}
        {!showCompose && messages.length > 0 && (
          <div className="mt-4 mb-4">
            <button
              onClick={() => {
                setShowCompose(true);
                setHasManualEdit(false);
              }}
              className="w-full px-4 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <Send className="w-4 h-4" />
              Compose Reply
            </button>
          </div>
        )}

        {/* Compose Reply Section - Inline */}
        {showCompose && (
          <div className="mt-6 mb-4">
            <div className="bg-white border-2 border-sky-300 rounded-xl shadow-lg p-5 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-5 h-5 text-sky-600" />
                  Compose Reply
                </h3>
                <button
                  onClick={() => setShowCompose(false)}
                  className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all font-semibold"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Template</label>
                {templates.length > 0 ? (
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all font-medium text-sm"
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} - {template.tone}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-amber-50 text-amber-800 text-sm font-medium">
                    No active templates available. Please create templates in the Templates section.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">To Recipients</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newToEmail}
                      onChange={(e) => setNewToEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToRecipient();
                        }
                      }}
                      placeholder="Add recipient email..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
                    />
                    <button
                      onClick={addToRecipient}
                      disabled={!newToEmail.trim()}
                      className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all font-semibold text-sm disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  {toRecipients.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {toRecipients.map((email, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg"
                        >
                          <span className="text-sm text-slate-800 font-medium">{email}</span>
                          <button
                            onClick={() => removeToRecipient(email)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 px-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-700 font-medium">No recipients added</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">CC Recipients (Optional)</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newCcEmail}
                      onChange={(e) => setNewCcEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCcRecipient();
                        }
                      }}
                      placeholder="Add CC recipient email..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
                    />
                    <button
                      onClick={addCcRecipient}
                      disabled={!newCcEmail.trim()}
                      className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all font-semibold text-sm disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  {ccRecipients.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {ccRecipients.map((email, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <span className="text-sm text-slate-800 font-medium">{email}</span>
                          <button
                            onClick={() => removeCcRecipient(email)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Email Preview</label>
                  {isHtmlTemplate && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHtmlEditorMode('visual')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                          htmlEditorMode === 'visual'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Visual
                      </button>
                      <button
                        type="button"
                        onClick={() => setHtmlEditorMode('code')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                          htmlEditorMode === 'code'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        Code
                      </button>
                    </div>
                  )}
                </div>
                {isHtmlTemplate && htmlEditorMode === 'visual' ? (
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <ReactQuill
                      theme="snow"
                      value={emailPreview}
                      onChange={(value) => {
                        setEmailPreview(value);
                        setHasManualEdit(true);
                      }}
                      modules={quillModules}
                      formats={quillFormats}
                      placeholder="Email preview will appear here..."
                      className="bg-white"
                      style={{ minHeight: '250px' }}
                    />
                  </div>
                ) : (
                  <textarea
                    value={emailPreview}
                    onChange={(e) => {
                      setEmailPreview(e.target.value);
                      setHasManualEdit(true);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-3 bg-white min-h-[250px] max-h-[400px] resize-y font-sans text-sm text-slate-800 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm"
                    placeholder="Email preview will appear here..."
                  />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Attachments
                  </label>
                  <label
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                      uploadingAttachment
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-sky-600 text-white hover:bg-sky-700'
                    }`}
                  >
                    {uploadingAttachment ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        Add File
                      </>
                    )}
                    <input
                      type="file"
                      onChange={handleAttachmentUpload}
                      disabled={uploadingAttachment}
                      className="hidden"
                      accept="*/*"
                    />
                  </label>
                </div>

                {emailAttachments.length > 0 ? (
                  <div className="space-y-2">
                    {emailAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        {attachment.content_type.includes('pdf') ? (
                          <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                        ) : (
                          <File className="w-5 h-5 text-slate-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {attachment.display_name || attachment.filename}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatFileSize(attachment.file_size)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeEmailAttachment(attachment.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove attachment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-slate-50 rounded-lg border border-slate-200">
                    <Paperclip className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">No attachments</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                {hasManualEdit && (
                  <button
                    onClick={handleCheckEmailText}
                    disabled={checkingEmail || !emailPreview}
                    className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all font-bold flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm text-sm"
                  >
                    {checkingEmail ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Checking...
                      </>
                    ) : (
                      'Check Email Text'
                    )}
                  </button>
                )}
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || hasManualEdit || !selectedTemplate || !emailPreview || emailPreview.includes('Please select')}
                  className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all font-bold flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm text-sm"
                >
                  {sendingEmail ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Reply
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Correction Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Suggested Corrections</h3>
              <p className="text-sm text-slate-600 mt-1">Review the corrected version below</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-600 mb-2">Original Text:</label>
                {isHtmlTemplate ? (
                  <div
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: emailPreview }}
                  />
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap">
                    {emailPreview}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Corrected Text:</label>
                {isHtmlTemplate ? (
                  <div
                    className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-slate-700 prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: correctedText }}
                  />
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap">
                    {correctedText}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCorrectionModal(false);
                  setCorrectedText('');
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all font-semibold text-sm"
              >
                Keep Original
              </button>
              <button
                onClick={handleAcceptCorrection}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-bold text-sm flex items-center gap-2"
              >
                Accept Corrections
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Proposal Modal */}
      {showProposalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProposal ? 'Edit Room Proposal' : 'Add Room Proposal'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">Select rooms and set rates for this proposal</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Proposal Name</label>
                <input
                  type="text"
                  value={proposalName}
                  onChange={(e) => setProposalName(e.target.value)}
                  placeholder={`Option ${roomProposals.length + 1}`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-sm"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Room Types</label>
                <div className="flex flex-wrap gap-2">
                  {roomTypes.map((roomType) => (
                    <button
                      key={roomType.code}
                      onClick={() => toggleProposalRoom(roomType)}
                      className={`px-3 py-1.5 border rounded-lg font-semibold text-sm transition-all ${
                        proposalRooms.some(r => r.code === roomType.code)
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-sky-400 hover:text-sky-600'
                      }`}
                      title={roomType.name}
                    >
                      {roomType.code} - {roomType.name}
                    </button>
                  ))}
                </div>
              </div>

              {proposalRooms.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Room Details</label>
                  <div className="space-y-2">
                    {proposalRooms.map((room) => (
                      <div key={room.code} className="bg-slate-50 rounded-lg border border-slate-200 p-3 flex items-center gap-3">
                        <div className="font-semibold text-slate-900 text-sm min-w-[80px]">
                          {room.code}
                        </div>
                        <div className="flex-1 text-sm text-slate-700">
                          {room.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-600 font-semibold">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={room.quantity}
                            onChange={(e) => updateProposalRoomQuantity(room.code, parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1.5 border border-slate-300 rounded text-sm"
                          />
                          <label className="text-xs text-slate-600 font-semibold ml-2">Rate:</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={room.nightly_rate}
                            onChange={(e) => updateProposalRoomRate(room.code, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm"
                          />
                          <span className="text-xs text-slate-600">ZAR/night</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowProposalModal(false);
                  setProposalName('');
                  setProposalRooms([]);
                  setEditingProposal(null);
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveProposal}
                disabled={proposalRooms.length === 0}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all font-bold text-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {editingProposal ? 'Update Proposal' : 'Add Proposal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
