"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Send, X, Star } from "lucide-react";

interface QuickReply {
  text: string;
  action?: any;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
  timestamp?: Date;
  products?: any[];
  quickReplies?: (string | QuickReply)[];
}

interface ChatModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChatModal({ open, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open && !hasInitialized) {
      const newSessionId = `session-${Date.now()}`;
      setSessionId(newSessionId);

      const greetingMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "Welcome to HEROIX! I'm your AI shopping assistant. How can I help you find the perfect keychain today?",
        timestamp: new Date(),
      };
      setMessages([greetingMsg]);
      setHasInitialized(true);
    }
  }, [open, hasInitialized]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: input },
          ],
          sessionId: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        products: data.products,
        quickReplies: data.quickReplies,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("[v0] Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 md:p-0">
      <Card className="w-full md:w-96 h-[600px] md:h-[500px] rounded-t-3xl md:rounded-2xl border-border flex flex-col">
        {/* Header */}
        <div className="relative p-4 border-b border-border bg-gradient-to-r from-accent/10 to-accent/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent flex items-center justify-center text-accent font-bold text-lg">
                ⚙️
              </div>
              <div>
                <h3 className="font-bold text-lg text-accent">CHAT WITH US</h3>
                <p className="text-xs text-muted-foreground">
                  HEROIX AI Assistant
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-accent to-transparent opacity-30"></div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="space-y-2 max-w-xs">
                {/* Text message */}
                <div
                  className={`px-4 py-2 rounded-lg ${
                    message.role === "user"
                      ? "bg-accent text-accent-foreground"
                      : "bg-card text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>

                {/* Products */}
                {message.products && message.products.length > 0 && (
                  <div className="space-y-2">
                    {message.products.map((product) => (
                      <Card
                        key={product.id}
                        className="p-3 bg-card/50 border-border hover:border-accent transition-colors"
                      >
                        <div className="flex gap-3">
                          {product.image && (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">
                              {product.name}
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {product.description}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-bold text-accent">
                                Rs {product.price}
                              </span>
                              {product.rating && (
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  <span className="text-xs">
                                    {product.rating}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Quick Replies */}
                {message.quickReplies && message.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {message.quickReplies.map((reply, idx) => {
                      // Handle both string and object formats
                      const replyText =
                        typeof reply === "string" ? reply : reply.text;

                      return (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => setInput(replyText)}
                          className="text-xs h-8"
                        >
                          {replyText}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {message.timestamp && (
                  <p className="text-xs text-muted-foreground px-2">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card text-foreground px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <Spinner className="w-4 h-4" />
                  <span className="text-xs text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-border"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={loading}
              className="flex-1 px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
