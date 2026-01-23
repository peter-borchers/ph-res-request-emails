import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { Mail, Calendar, Users, Bed, ArrowDownLeft, ArrowUpRight, Sparkles, RefreshCw } from 'lucide-react';

type Conversation = Database['public']['Tables']['msgraph_conversations']['Row'];
type Reservation = Database['public']['Tables']['reservations']['Row'];
type RoomProposal = Database['public']['Tables']['room_proposals']['Row'];

interface ConversationWithDetails extends Conversation {
  reservation?: Reservation;
  room_proposals?: RoomProposal[];
  message_count?: number;
  unread_count?: number;
  sender_name?: string;
  sender_email?: string;
}

interface EmailInboxProps {
  selectedEmailId: string | null;
  onSelectEmail: (conversation: ConversationWithDetails) => void;
  refreshTrigger?: number;
}

export function EmailInbox({ selectedEmailId, onSelectEmail, refreshTrigger }: EmailInboxProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mailboxDomain, setMailboxDomain] = useState<string>('');

  useEffect(() => {
    loadMailboxSettings();
  }, []);

  useEffect(() => {
    loadConversations();
  }, [refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 20000);

    return () => clearInterval(interval);
  }, [mailboxDomain]);

  async function loadMailboxSettings() {
    const { data } = await supabase
      .from('settings')
      .select('mailbox_address')
      .maybeSingle();

    if (data?.mailbox_address) {
      setMailboxDomain(data.mailbox_address);
    }
  }

  async function loadConversations() {
    try {
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('msgraph_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      const conversationsWithDetails = await Promise.all(
        (conversationsData || []).map(async (conversation) => {
          const { data: messages } = await supabase
            .from('msgraph_messages')
            .select('id, is_read, from_email, from_name, received_at')
            .eq('conversation_uuid', conversation.id)
            .order('received_at', { ascending: true });

          const messageCount = messages?.length || 0;
          const unreadCount = messages?.filter(m => !m.is_read).length || 0;

          const firstMessage = messages?.[0];
          const senderEmail = firstMessage?.from_email || '';
          const senderName = firstMessage?.from_name || senderEmail.split('@')[0] || 'Unknown';

          const { data: reservation } = await supabase
            .from('reservations')
            .select('*')
            .eq('conversation_id', conversation.conversation_id)
            .maybeSingle();

          let roomProposals: RoomProposal[] = [];
          if (reservation) {
            const { data } = await supabase
              .from('room_proposals')
              .select('*')
              .eq('reservation_id', reservation.id)
              .order('display_order', { ascending: true });
            roomProposals = data || [];
          }

          return {
            ...conversation,
            reservation: reservation || undefined,
            room_proposals: roomProposals,
            message_count: messageCount,
            unread_count: unreadCount,
            sender_email: senderEmail,
            sender_name: senderName,
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/msgraph/sync`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mailbox_address: mailboxDomain }),
      });

      if (!response.ok) {
        console.error('MS Graph sync failed:', response.status, response.statusText);
      } else {
        console.log('MS Graph sync successful');
      }
    } catch (error) {
      console.error('Error during MS Graph sync:', error);
    }

    await loadConversations();
    setRefreshing(false);
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatDateTime(dateString: string | null) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ' ' + date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatStayDate(dateString: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function calculateNights(arrival: string, departure: string): number {
    if (!arrival || !departure) return 0;
    const arrivalDate = new Date(arrival);
    const departureDate = new Date(departure);
    const diffTime = departureDate.getTime() - arrivalDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  if (loading) {
    return (
      <div className="w-96 border-r border-slate-200 bg-white p-8">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-600"></div>
          <span className="text-slate-600">Loading enquiries...</span>
        </div>
      </div>
    );
  }

  function isNewEnquiry(conversation: ConversationWithDetails): boolean {
    return !conversation.viewed_at;
  }

  return (
    <div className="w-96 border-r border-slate-200 bg-white flex flex-col h-screen">
      <div className="p-5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Enquiries</h2>
            <p className="text-sm text-slate-500 mt-0.5">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            title="Refresh enquiries"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const reservation = conversation.reservation;
          const nights = reservation
            ? calculateNights(reservation.arrival_date, reservation.departure_date)
            : 0;
          const hasUnread = (conversation.unread_count || 0) > 0;
          const isNew = isNewEnquiry(conversation);
          const guestName = reservation?.guest_name || conversation.sender_name || 'Unknown Guest';
          const isOutbound = conversation.last_message_direction === 'outbound';

          return (
            <button
              key={conversation.id}
              onClick={() => onSelectEmail(conversation)}
              className={`w-full text-left p-4 border-b transition-all ${
                selectedEmailId === conversation.id
                  ? 'bg-sky-50 border-slate-200 border-l-4 border-l-sky-600 shadow-sm'
                  : 'bg-white border-slate-100 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Mail className={`w-4 h-4 flex-shrink-0 ${hasUnread ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span className={`text-sm truncate ${hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {guestName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-slate-600 font-medium">
                    {formatDateTime(conversation.last_message_at)}
                  </span>
                  {isOutbound ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" title="Last message sent by hotel" />
                  ) : (
                    <ArrowDownLeft className="w-3.5 h-3.5 text-green-600" title="Last message received from guest" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                {isNew && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    NEW
                  </span>
                )}
                {hasUnread && !isNew && (
                  <div className="w-2 h-2 bg-sky-600 rounded-full animate-pulse"></div>
                )}
              </div>

              <div className="text-xs text-slate-500 mb-2.5 space-y-1 relative">
                <div className="flex items-center gap-1.5 justify-between">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-slate-600 font-medium">From:</span>
                    <span className="truncate">{conversation.sender_email || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-center bg-sky-600 text-white rounded-full w-6 h-6 text-xs font-bold shadow-sm flex-shrink-0">
                    {conversation.message_count || 0}
                  </div>
                </div>
              </div>

              {reservation ? (
                <div className="space-y-2 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                  {reservation.arrival_date && reservation.departure_date && (
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <div className="text-slate-700 font-medium">
                        <span className="text-slate-900 font-semibold">{formatStayDate(reservation.arrival_date)}</span>
                        <span> to </span>
                        <span className="text-slate-900 font-semibold">{formatStayDate(reservation.departure_date)}</span>
                        <span className="text-slate-500"> ({nights} night{nights !== 1 ? 's' : ''})</span>
                      </div>
                    </div>
                  )}

                  {(reservation.adults > 0 || reservation.children > 0) && (
                    <div className="flex items-center gap-2 text-xs">
                      <Users className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="text-slate-700 font-medium">
                        {reservation.adults > 0 && `${reservation.adults} adult${reservation.adults !== 1 ? 's' : ''}`}
                        {reservation.adults > 0 && reservation.children > 0 && ', '}
                        {reservation.children > 0 && `${reservation.children} child${reservation.children !== 1 ? 'ren' : ''}`}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs">
                    <Bed className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="text-slate-700 font-medium">
                      {conversation.room_proposals && conversation.room_proposals.length > 0
                        ? `${conversation.room_proposals.length} room${conversation.room_proposals.length !== 1 ? 's' : ''} & rate${conversation.room_proposals.length !== 1 ? 's' : ''} proposal${conversation.room_proposals.length !== 1 ? 's' : ''}`
                        : 'No rooms & rates proposed'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic py-2 bg-slate-50 rounded px-2 border border-slate-200">
                  No stay details extracted yet
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
