import { useEffect, useState } from 'react';
import { apiGet, apiDelete } from '../utils/fetchInterceptor';
import { getApiUrl } from '../utils/runtime';
import { getToken } from '../utils/interceptors';

export interface LogEntry {
  timestamp: number;
  type: 'info' | 'error' | 'warn' | 'debug';
  source: string;
  message: string;
  processId?: string;
}

// Fetch all logs
export const fetchLogs = async (): Promise<LogEntry[]> => {
  try {
    const response = await apiGet<{ success: boolean; data: LogEntry[]; error?: string }>('/logs');

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch logs');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};

// Clear all logs
export const clearLogs = async (): Promise<void> => {
  try {
    const response = await apiDelete<{ success: boolean; error?: string }>('/logs');

    if (!response.success) {
      throw new Error(response.error || 'Failed to clear logs');
    }
  } catch (error) {
    console.error('Error clearing logs:', error);
    throw error;
  }
};

// Hook to use logs with SSE streaming
export const useLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let abortController: AbortController | null = null;
    let isMounted = true;

    const connectToLogStream = (): void => {
      try {
        if (abortController) {
          abortController.abort();
        }

        const token = getToken();
        abortController = new AbortController();

        fetch(getApiUrl('/logs/stream'), {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
                'x-auth-token': token,
              }
            : {},
          signal: abortController.signal,
        })
          .then(async (response) => {
            if (!response.body) {
              throw new Error('ReadableStream not supported');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (isMounted) {
              const { done, value } = await reader.read();
              if (done) {
                if (isMounted) {
                  setTimeout(connectToLogStream, 5000);
                }
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              let index;
              while ((index = buffer.indexOf('\n\n')) !== -1) {
                const message = buffer.slice(0, index);
                buffer = buffer.slice(index + 2);
                if (message.startsWith('data:')) {
                  try {
                    const data = JSON.parse(message.slice(5).trim());
                    if (data.type === 'initial') {
                      setLogs(data.logs);
                      setLoading(false);
                    } else if (data.type === 'log') {
                      setLogs((prevLogs) => [...prevLogs, data.log]);
                    }
                  } catch (err) {
                    console.error('Error parsing SSE message:', err);
                  }
                }
              }
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            setError(err instanceof Error ? err : new Error('Failed to connect to log stream'));
            setTimeout(connectToLogStream, 5000);
          });
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err : new Error('Failed to connect to log stream'));
        setLoading(false);
      }
    };

    // Initial connection
    connectToLogStream();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (abortController) {
        abortController.abort();
      }
    };
  }, []);

  const clearAllLogs = async () => {
    try {
      await clearLogs();
      setLogs([]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to clear logs'));
    }
  };

  return { logs, loading, error, clearLogs: clearAllLogs };
};
