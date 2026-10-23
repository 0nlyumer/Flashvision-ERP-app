import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { askFlashVisionAI } from '../../services/aiService';
import { humanoidAudio } from '../../services/aiAudioService';
import { keyManager } from '../../services/aiConfig';

export default function AICopilot({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { state, dispatch, saveState } = useApp();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Assalam-o-Alaikum! Main FlashVision ERP ka AI Brain hoon. Aap voice ya text ke zariye mujh se koi bhi document banwa sakte hain, stock check kar sakte hain, ya reporting karwa sakte hain.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [keyStatus, setKeyStatus] = useState(keyManager.getStatus());

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ur-PK, en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          handleSend(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      humanoidAudio.stop();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setKeyStatus(keyManager.getStatus());
  }, [messages, isThinking]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      humanoidAudio.stop();
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.warn('SpeechRecognition start error:', err);
      }
    }
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query || isThinking) return;

    setInputText('');
    const userMsg = {
      id: 'msg-' + Date.now(),
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const response = await askFlashVisionAI({
        prompt: query,
        erpState: state,
        currentUser: state.currentUser,
        history: messages.slice(-4)
      });

      setIsThinking(false);
      setKeyStatus(keyManager.getStatus());

      const botMsg = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        text: response.text,
        toolCall: response.toolCall,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);

      // If action is navigate_to_screen, navigate directly
      if (response.toolCall?.name === 'navigate_to_screen') {
        const { path, tab } = response.toolCall.args || {};
        if (path) {
          const targetUrl = tab ? `${path}?tab=${encodeURIComponent(tab)}` : path;
          navigate(targetUrl);
        }
      }

      // If action requires document confirmation, set pending action
      if (response.toolCall && ['create_sale_order', 'create_gate_pass', 'record_employee_attendance'].includes(response.toolCall.name)) {
        setPendingAction(response.toolCall);
      }

      // Play humanoid audio if not muted
      if (!voiceMuted && response.text) {
        setIsSpeaking(true);
        humanoidAudio.speak(response.text).finally(() => {
          setIsSpeaking(false);
        });
      }
    } catch (err) {
      setIsThinking(false);
      setMessages(prev => [...prev, {
        id: 'bot-err-' + Date.now(),
        role: 'assistant',
        text: 'Maaf kijiye, system query execute karte waqt temporary issue aaya. Dobara try kijiye.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  // Execute confirmed document creation
  const handleConfirmAction = async (action) => {
    if (!action) return;
    try {
      if (action.name === 'create_sale_order') {
        const args = action.args || {};
        const newOrder = {
          id: 'SO-' + Date.now(),
          orderNumber: 'SO-' + Math.floor(1000 + Math.random() * 9000),
          customer: args.customerName || 'Walk-in Customer',
          date: new Date().toISOString().split('T')[0],
          deliveryDate: args.deliveryDate || new Date().toISOString().split('T')[0],
          status: 'Pending',
          items: (args.items || []).map(it => ({
            id: 'item-' + Math.random().toString(36).substring(7),
            name: it.itemName,
            quantity: Number(it.meters || it.quantity || 1),
            rate: Number(it.rate || 0),
            unit: 'Meters',
            remarks: it.remarks || ''
          })),
          remarks: args.remarks || 'Drafted via FlashVision AI Brain',
          createdAt: new Date().toISOString()
        };

        const updatedOrders = [newOrder, ...(state.saleOrders || [])];
        dispatch({ type: 'SET_SALE_ORDERS', payload: updatedOrders });
        if (saveState) saveState({ ...state, saleOrders: updatedOrders });

        setMessages(prev => [...prev, {
          id: 'sys-' + Date.now(),
          role: 'assistant',
          text: `✅ Sale Order #${newOrder.orderNumber} (${newOrder.customer}) kamyabi se save ho gaya hai! Database update ho chuka hai.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } else if (action.name === 'record_employee_attendance') {
        const args = action.args || {};
        const record = {
          id: 'att-' + Date.now(),
          employeeName: args.employeeName,
          date: args.date || new Date().toISOString().split('T')[0],
          status: args.status || 'Present',
          timestamp: new Date().toISOString()
        };
        const currentAtt = state.hrAttendance || [];
        const updatedAtt = [record, ...currentAtt];
        dispatch({ type: 'SET_ATTENDANCE', payload: updatedAtt });
        if (saveState) saveState({ ...state, hrAttendance: updatedAtt });

        setMessages(prev => [...prev, {
          id: 'sys-' + Date.now(),
          role: 'assistant',
          text: `✅ Employee '${args.employeeName}' ki attendance mark ho gayi hai (${args.status}).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }

      setPendingAction(null);
    } catch (err) {
      console.error('Action confirmation failed:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-[90vh] max-h-[820px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl border border-cyan-500/30 flex flex-col overflow-hidden font-body">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-100/90 dark:bg-slate-950/80 border-b border-cyan-500/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <span className="material-symbols-outlined text-white text-[24px]">bolt</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">FlashVision AI Brain</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                  Soul Core
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Pool: {keyStatus.availableKeys}/{keyStatus.totalKeys} Keys Active</span>
                <span className="text-slate-600">|</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{state.currentUser?.role || 'Super Admin'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setVoiceMuted(!voiceMuted);
                if (!voiceMuted) humanoidAudio.stop();
              }}
              title={voiceMuted ? 'Unmute Humanoid Voice' : 'Mute Humanoid Voice'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${voiceMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {voiceMuted ? 'volume_off' : 'volume_up'}
              </span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-xl bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-700 dark:text-cyan-300 shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[18px]">neurology</span>
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-md ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-100 dark:bg-slate-800/90 border border-slate-300/70 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div className="text-[10px] mt-2 opacity-60 text-right">{msg.timestamp}</div>
              </div>
            </div>
          ))}

          {/* Pending Action Card */}
          {pendingAction && (
            <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-500/40 shadow-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">edit_document</span>
                  Action Ready for Confirmation
                </span>
                <span className="text-[11px] text-slate-400 font-mono">{pendingAction.name}</span>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-300 dark:border-slate-800 font-mono whitespace-pre-wrap">
                {JSON.stringify(pendingAction.args, null, 2)}
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setPendingAction(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={() => handleConfirmAction(pendingAction)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Confirm & Save to ERP
                </button>
              </div>
            </div>
          )}

          {isThinking && (
            <div className="flex gap-3 items-center text-cyan-600 dark:text-cyan-400 text-xs italic">
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              FlashVision Brain analyze kar raha hai...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-5 py-2 bg-slate-100/70 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            '📊 Low Stock Report do',
            '🛒 Ahmed Bhai ka sale order banao',
            '👥 Aaj ki HR attendance check karo',
            '🚚 Inward Gate Pass create karo'
          ].map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="px-3 py-1 rounded-xl text-[11px] font-medium bg-slate-200/80 dark:bg-slate-800/80 hover:bg-cyan-100 dark:hover:bg-cyan-950 hover:text-cyan-800 dark:hover:text-cyan-300 hover:border-cyan-500/40 border border-slate-300 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 whitespace-nowrap transition-all"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Voice Visualizer / Status Banner */}
        {(isListening || isSpeaking) && (
          <div className="px-5 py-2 bg-gradient-to-r from-cyan-100/80 via-indigo-100/80 to-purple-100/80 dark:from-cyan-950/80 dark:via-indigo-950/80 dark:to-purple-950/80 border-t border-cyan-500/30 flex items-center justify-between text-xs text-cyan-800 dark:text-cyan-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <span>{isListening ? 'Aapki aawaz suni ja rahi hai...' : 'AI Humanoid bol rahi hai...'}</span>
            </div>
            {isSpeaking && (
              <button
                onClick={() => humanoidAudio.stop()}
                className="text-[11px] font-bold text-red-400 hover:underline"
              >
                Stop Voice
              </button>
            )}
          </div>
        )}

        {/* Bottom Input Area */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-3">
          <button
            onClick={toggleListening}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-red-500/40 ring-4 ring-red-500/30'
                : 'bg-gradient-to-tr from-cyan-500 to-indigo-600 hover:scale-105 text-white shadow-cyan-500/30'
            }`}
            title={isListening ? 'Listening (Click to Stop)' : 'Click to Speak (Voice Input)'}
          >
            <span className="material-symbols-outlined text-[24px]">
              {isListening ? 'mic' : 'mic'}
            </span>
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Kuch bhi bole ya type karein (e.g. 50 bags cement ka order bana do)..."
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/70 focus:border-cyan-500 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all shadow-inner"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isThinking}
            className="w-12 h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 flex items-center justify-center transition-all shadow-md shadow-cyan-500/20 font-bold"
          >
            <span className="material-symbols-outlined text-[22px]">send</span>
          </button>
        </div>

      </div>
    </div>
  );
}
