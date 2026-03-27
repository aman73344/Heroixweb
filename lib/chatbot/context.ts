export interface ChatSession {
  sessionId: string;
  conversationPhase: 'greeting' | 'discovery' | 'ordering' | 'confirming' | 'complete';
  messages: { role: string; content: string }[];
  lastActivityAt: string;
  customerName?: string;
  customerPhone?: string;
}

const mockSessions: ChatSession[] = [
  {
    sessionId: 'sess_abc123def456',
    conversationPhase: 'ordering',
    messages: [
      { role: 'user', content: 'I want to buy a keychain' },
      { role: 'assistant', content: 'Great! What anime or design are you looking for?' },
      { role: 'user', content: 'Something from Naruto' },
    ],
    lastActivityAt: new Date().toISOString(),
    customerName: 'John Doe',
    customerPhone: '03001234567',
  },
  {
    sessionId: 'sess_xyz789ghi012',
    conversationPhase: 'confirming',
    messages: [
      { role: 'user', content: 'Show me your products' },
      { role: 'assistant', content: 'Here are our available keychains...' },
    ],
    lastActivityAt: new Date(Date.now() - 3600000).toISOString(),
    customerName: 'Jane Smith',
  },
  {
    sessionId: 'sess_mno345pqr678',
    conversationPhase: 'discovery',
    messages: [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello! Welcome to Heroix. How can I help you?' },
    ],
    lastActivityAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

export function getRecentSessions(limit: number = 5): ChatSession[] {
  return mockSessions.slice(0, limit);
}

export function getSessionStats() {
  return {
    totalSessions: mockSessions.length,
    activeSessions: mockSessions.filter(s => 
      s.conversationPhase !== 'complete' && s.conversationPhase !== 'confirming'
    ).length,
    completedOrders: mockSessions.filter(s => s.conversationPhase === 'complete').length,
    averageMessagesPerSession: Math.round(
      mockSessions.reduce((acc, s) => acc + s.messages.length, 0) / mockSessions.length
    ),
  };
}
