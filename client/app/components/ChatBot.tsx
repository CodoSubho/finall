'use client';
import { useState, useRef, useEffect } from 'react';
import { FaRobot, FaUserCircle, FaSpinner, FaExclamationCircle, FaPlay, FaPause, FaDownload } from 'react-icons/fa';
import jsPDF from 'jspdf';

interface ChatBotProps {
  videoId: string;
  topic: string;
}

interface Message {
  text: string;
  isUser: boolean;
  timestamp?: Date;
}

interface SpeechState {
  isSpeaking: boolean;
  currentUtterance: SpeechSynthesisUtterance | null;
}

export default function ChatBot({ videoId, topic }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechState, setSpeechState] = useState<SpeechState>({
    isSpeaking: false,
    currentUtterance: null
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const generatePdf = () => {
    const doc = new jsPDF(); 

    const margin = 20; 
    let yPos = margin; 
    const pageHeight = doc.internal.pageSize.height; 
    const pageWidth = doc.internal.pageSize.width; 
    const contentWidth = pageWidth - margin * 2; 

    const titleFontSize = 16; 
    const messageFontSize = 10; 

    const getLineHeightInPageUnits = (fontSizeInPt: number) => {
        return (fontSizeInPt / doc.internal.scaleFactor) * 1.4; 
    };

    
    doc.setFontSize(titleFontSize);
    doc.setTextColor(0, 0, 0); 
    let currentLineHeight = getLineHeightInPageUnits(titleFontSize);
    const titleLines = doc.splitTextToSize(`Chat Conversation - ${topic}`, contentWidth);
    titleLines.forEach((line: string) => {
        if (yPos + currentLineHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
            doc.setFontSize(titleFontSize);
            doc.setTextColor(0, 0, 0);
        }
        doc.text(line, margin, yPos);
        yPos += currentLineHeight;
    });
    yPos += currentLineHeight * 0.5;

    
    doc.setFontSize(messageFontSize);
    currentLineHeight = getLineHeightInPageUnits(messageFontSize);

    const userColorHex = '#9333EA'; 
    const botColorHex = '#000000';   

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };

    messages.forEach((msg) => {
      const activeColorRGB = msg.isUser ? hexToRgb(userColorHex) : hexToRgb(botColorHex);
      const activeFont = msg.isUser ? 'helvetica' : 'courier';
      
      const activeFontStyle = msg.isUser ? 'bold' : 'normal'; 
      
      doc.setFont(activeFont, activeFontStyle);
      doc.setTextColor(activeColorRGB[0], activeColorRGB[1], activeColorRGB[2]);

      const timestampStr = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      const senderPrefix = `[${msg.isUser ? 'You' : 'Bot'}]: `;
      const messageContent = msg.text || "";

      const fullText = `${timestampStr} ${senderPrefix}${messageContent}`;
      
      const lines = doc.splitTextToSize(fullText, contentWidth);

      lines.forEach((line: string) => {
        if (yPos + currentLineHeight > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
          doc.setFontSize(messageFontSize);
          doc.setFont(activeFont, activeFontStyle); 
          doc.setTextColor(activeColorRGB[0], activeColorRGB[1], activeColorRGB[2]); 
        }
        doc.text(line, margin, yPos);
        yPos += currentLineHeight;
      });
      
      yPos += currentLineHeight * 0.5;
    });

    doc.save(`ChatBot-Conversation-${topic}-${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setSpeechState({ isSpeaking: true, currentUtterance: utterance });
    };

    utterance.onend = utterance.onerror = () => {
      setSpeechState({ isSpeaking: false, currentUtterance: null });
    };

    window.speechSynthesis.speak(utterance);
  };

  const toggleSpeech = (text: string) => {
    if (speechState.isSpeaking && speechState.currentUtterance?.text === text) {
      window.speechSynthesis.pause();
      setSpeechState(prev => ({ ...prev, isSpeaking: false }));
    } else if (!speechState.isSpeaking && speechState.currentUtterance?.text === text) {
      window.speechSynthesis.resume();
      setSpeechState(prev => ({ ...prev, isSpeaking: true }));
    } else {
      speak(text);
    }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      const userMessage = {
        text: input,
        isUser: true,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, userMessage]);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, videoId, topic }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.detail || errorData.error || 'Failed to get response';
        throw new Error(errorMsg);
      }

      const { text } = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          text,
          isUser: false,
          timestamp: new Date()
        }
      ]);
      setInput('');
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);

      setMessages((prev) => [
        ...prev,
        {
          text: `⚠️ ${errorMessage}`,
          isUser: false,
          timestamp: new Date()
        }
      ]);

      if (errorMessage.includes('quota')) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              text: "⏳ You’ve hit the limit. Please try again in 30 seconds.",
              isUser: false,
              timestamp: new Date()
            }
          ]);
        }, 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const MessageBubble = ({ msg }: { msg: Message }) => (
    <div
      className={`max-w-xs sm:max-w-md p-3 rounded-2xl shadow-md ${
        msg.isUser
          ? 'bg-purple-600 text-white rounded-br-none'
          : 'bg-gray-800 text-gray-200 rounded-bl-none'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <p className="whitespace-pre-wrap flex-1">{msg.text}</p>
        {!msg.isUser && (
          <button
            onClick={() => toggleSpeech(msg.text)}
            className="text-gray-300 hover:text-purple-400 transition-colors ml-2 shrink-0"
            aria-label={speechState.isSpeaking && speechState.currentUtterance?.text === msg.text ? "Pause speech" : "Play speech"}
          >
            {speechState.isSpeaking && speechState.currentUtterance?.text === msg.text ? (
              <FaPause className="shrink-0" />
            ) : (
              <FaPlay className="shrink-0" />
            )}
          </button>
        )}
      </div>
      {msg.timestamp && (
        <span className="text-xs opacity-70 mt-1 block text-right">
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FaRobot className="text-purple-400" />
            <h3 className="text-white font-semibold">Lecture Assistant</h3>
          </div>
          <button
            onClick={generatePdf}
            className="text-gray-400 hover:text-purple-400 transition-colors p-2 rounded-lg"
            title="Download conversation as PDF"
          >
            <FaDownload size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-400 truncate">Topic: {topic}</p>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 italic mt-8">
            Start a conversation by asking a question about the lecture.
            {typeof window !== 'undefined' && !window.speechSynthesis && (
              <div className="text-red-400 text-sm mt-2">
                Note: Text-to-speech is not supported in your browser
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 ${msg.isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!msg.isUser && (
              <div className="mt-1 text-purple-400 shrink-0">
                <FaRobot size={20} />
              </div>
            )}
            <MessageBubble msg={msg} />
            {msg.isUser && (
              <div className="mt-1 text-gray-400 shrink-0">
                <FaUserCircle size={20} />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2 justify-start">
            <div className="mt-1 text-purple-400 shrink-0">
              <FaRobot size={20} />
            </div>
            <div className="bg-gray-800 p-3 rounded-2xl shadow-md text-gray-200">
              <div className="flex items-center gap-2">
                <FaSpinner className="animate-spin text-purple-500" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the lecture..."
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-70 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <FaSpinner className="animate-spin" />
            ) : (
              'Send'
            )}
          </button>
        </div>
        {error && (
          <div className="mt-2 text-red-400 text-sm flex items-center gap-1">
            <FaExclamationCircle />
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  );
}
