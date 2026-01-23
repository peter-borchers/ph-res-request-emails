import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Link } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MSGraphSyncProps {
  mailboxAddress?: string;
  onSyncComplete?: () => void;
}

interface AuthStatus {
  authenticated: boolean;
  mailbox_address?: string;
  token_expires_at?: string;
  needs_refresh?: boolean;
  message?: string;
}

export function MSGraphSync({ mailboxAddress, onSyncComplete }: MSGraphSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<any>(null);
  const [actualMailbox, setActualMailbox] = useState<string>('');

  useEffect(() => {
    loadMailboxAddress();
  }, [mailboxAddress]);

  useEffect(() => {
    if (actualMailbox) {
      testConnection();
      checkAuthStatus();
    }
  }, [actualMailbox]);

  async function loadMailboxAddress() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('mailbox_address')
        .maybeSingle();

      if (error) throw error;

      const mailbox = mailboxAddress || data?.mailbox_address || '';
      setActualMailbox(mailbox);
    } catch (err) {
      console.error('Error loading mailbox address:', err);
      setActualMailbox(mailboxAddress || '');
    }
  }

  async function testConnection() {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      console.log('=== Connection Test ===');
      console.log('Supabase URL:', supabaseUrl);
      console.log('Anon Key present:', !!anonKey);
      console.log('Edge Function URL:', `${supabaseUrl}/functions/v1/msgraph/auth/status`);

      if (!supabaseUrl) {
        console.error('VITE_SUPABASE_URL is not set!');
        setError('Configuration error: VITE_SUPABASE_URL not found');
        return;
      }

      if (!anonKey) {
        console.error('VITE_SUPABASE_ANON_KEY is not set!');
        setError('Configuration error: VITE_SUPABASE_ANON_KEY not found');
        return;
      }

      const testUrl = `${supabaseUrl}/functions/v1/msgraph/auth/status?mailbox_address=test@test.com`;
      console.log('Testing connection to:', testUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('Connection test response:', response.status, response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    } catch (err) {
      console.error('Connection test failed:', err);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.error('Request timed out after 10 seconds');
          setError('Connection timeout - edge function may not be responding');
        } else {
          console.error('Error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack
          });
        }
      }
    }
  }

  async function handleCredentialMismatch(errorData: any) {
    const detailsStr = errorData?.details || JSON.stringify(errorData);
    const isAccessDenied = detailsStr.includes('ErrorAccessDenied') || detailsStr.includes('Access is denied');

    if (isAccessDenied) {
      console.log('Detected credential mismatch - clearing OAuth tokens');

      try {
        const { error: deleteError } = await supabase
          .from('msgraph_oauth_tokens')
          .delete()
          .eq('mailbox_address', actualMailbox);

        if (deleteError) {
          console.error('Failed to delete OAuth tokens:', deleteError);
        } else {
          console.log('OAuth tokens cleared successfully');
          setAuthStatus({ authenticated: false, message: 'Credentials mismatch detected. Please reconnect with the correct account.' });
        }
      } catch (err) {
        console.error('Error clearing OAuth tokens:', err);
      }
    }
  }

  async function checkAuthStatus() {
    if (!actualMailbox) return;

    setError(null);
    setDetailedError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/msgraph/auth/status?mailbox_address=${actualMailbox}`;

      console.log('Checking auth status:', apiUrl);

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Auth status response:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        console.error('Auth status error:', errorData);

        await handleCredentialMismatch(errorData);

        setError(`Failed to check auth status: ${errorData.error || response.statusText}`);
        setDetailedError(errorData);
        setAuthStatus({ authenticated: false, message: 'Unable to check authentication status' });
        return;
      }

      const data = await response.json();
      console.log('Auth status data:', data);
      setAuthStatus(data);
    } catch (err) {
      console.error('Error checking auth status:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Connection error: ${errorMsg}`);
      setDetailedError({ error: errorMsg, type: 'network_error' });
      setAuthStatus({ authenticated: false, message: 'Unable to check authentication status' });
    }
  }

  async function handleSync() {
    if (!actualMailbox) return;

    setSyncing(true);
    setError(null);
    setDetailedError(null);

    try {
      const mailboxToUse = authStatus?.mailbox_address || actualMailbox;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/msgraph/sync`;

      console.log('Syncing emails for mailbox:', mailboxToUse);
      console.log('API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mailbox_address: mailboxToUse }),
      });

      console.log('Sync response:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        console.error('Sync error data:', errorData);

        await handleCredentialMismatch(errorData);

        setError(`Sync failed: ${errorData.error || response.statusText}`);
        setDetailedError(errorData);
        return;
      }

      const result = await response.json();
      console.log('Sync successful:', result);

      setLastSync(new Date());
      setError(null);
      setDetailedError(null);

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err) {
      console.error('Error syncing emails:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to sync emails';
      setError(`Connection error: ${errorMsg}`);
      setDetailedError({ error: errorMsg, type: 'network_error' });
    } finally {
      setSyncing(false);
    }
  }

  async function handleAuthSetup() {
    if (!actualMailbox) return;

    setError(null);
    setDetailedError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/msgraph/oauth/initiate?mailbox_address=${actualMailbox}`;

      console.log('Initiating OAuth for mailbox:', actualMailbox);
      console.log('API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('OAuth initiate response:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        console.error('OAuth initiate error:', errorData);
        setError(`Failed to initiate OAuth: ${errorData.error || response.statusText}`);
        setDetailedError(errorData);
        return;
      }

      const data = await response.json();
      console.log('OAuth initiate data:', data);

      if (data.auth_url) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          data.auth_url,
          'oauth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no`
        );

        const messageHandler = (event: MessageEvent) => {
          if (event.data?.type === 'oauth_success') {
            console.log('OAuth success message received');
            checkAuthStatus();
            window.removeEventListener('message', messageHandler);
            if (popup && !popup.closed) {
              popup.close();
            }
          }
        };

        window.addEventListener('message', messageHandler);
      } else {
        setError('No authorization URL returned from server');
        setDetailedError(data);
      }
    } catch (err) {
      console.error('Error initiating OAuth:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to initiate OAuth';
      setError(`Connection error: ${errorMsg}`);
      setDetailedError({ error: errorMsg, type: 'network_error' });
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Link className="w-4 h-4" />
            Microsoft Graph Integration
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Mailbox: {authStatus?.mailbox_address || actualMailbox}
          </p>
        </div>

        {authStatus?.authenticated ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600" />
        )}
      </div>

      <div className="space-y-3">
        {authStatus && (
          <div className="text-xs">
            {authStatus.authenticated ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded">
                <CheckCircle className="w-4 h-4" />
                <span>Connected to Microsoft 365</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded">
                <XCircle className="w-4 h-4" />
                <span>{authStatus.message || 'Not authenticated'}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {!authStatus?.authenticated ? (
            <button
              onClick={handleAuthSetup}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Connect to Outlook
            </button>
          ) : (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Emails'}
            </button>
          )}
        </div>

        {lastSync && (
          <div className="text-xs text-gray-500">
            Last synced: {lastSync.toLocaleTimeString()}
          </div>
        )}

        {error && (
          <div className="space-y-2">
            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
              <div className="font-semibold mb-1">Error:</div>
              <div>{error}</div>
            </div>

            {detailedError && (
              <details className="text-xs bg-gray-50 px-3 py-2 rounded border border-gray-200">
                <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                  View Technical Details
                </summary>
                <pre className="mt-2 text-xs overflow-x-auto text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(detailedError, null, 2)}
                </pre>
              </details>
            )}

            <div className="text-xs bg-blue-50 px-3 py-2 rounded border border-blue-200">
              <div className="font-semibold text-blue-900 mb-1">Troubleshooting:</div>
              <ul className="list-disc list-inside text-blue-800 space-y-1">
                <li>Check browser console for detailed logs</li>
                <li>Verify all credentials are configured in Admin Settings</li>
                <li>Ensure mailbox address is correct: {actualMailbox}</li>
                <li>Check that edge function is deployed and accessible</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
