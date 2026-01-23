import { useState, useEffect } from 'react';
import { EmailInbox } from './components/EmailInbox';
import { ReservationDetail } from './components/ReservationDetail';
import { TemplateAdmin } from './components/TemplateAdmin';
import { AdminSettings } from './components/AdminSettings';
import type { Database } from './lib/database.types';
import { Inbox, FileText, ShieldCheck } from 'lucide-react';

type Conversation = Database['public']['Tables']['msgraph_conversations']['Row'];
type View = 'inbox' | 'templates' | 'admin';

function App() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [currentView, setCurrentView] = useState<View>('inbox');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleReservationUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (currentView === 'inbox') {
      const intervalId = setInterval(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 20000);

      return () => clearInterval(intervalId);
    }
  }, [currentView]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reservation Assistant</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage enquiries and bookings</p>
        </div>
        <nav className="flex gap-2">
          <button
            onClick={() => setCurrentView('inbox')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all font-medium ${
              currentView === 'inbox'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Inbox className="w-5 h-5" />
            <span>Enquiries</span>
          </button>
          <button
            onClick={() => setCurrentView('templates')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all font-medium ${
              currentView === 'templates'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Templates</span>
          </button>
          <button
            onClick={() => setCurrentView('admin')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all font-medium ${
              currentView === 'admin'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Admin</span>
          </button>
        </nav>
      </header>

      {currentView === 'inbox' && (
        <div className="flex-1 flex">
          <EmailInbox
            selectedEmailId={selectedConversation?.id || null}
            onSelectEmail={setSelectedConversation}
            refreshTrigger={refreshTrigger}
          />
          <ReservationDetail
            conversation={selectedConversation}
            onReservationUpdate={handleReservationUpdate}
          />
        </div>
      )}

      {currentView === 'templates' && <TemplateAdmin />}

      {currentView === 'admin' && <AdminSettings onSyncComplete={handleReservationUpdate} />}
    </div>
  );
}

export default App;
