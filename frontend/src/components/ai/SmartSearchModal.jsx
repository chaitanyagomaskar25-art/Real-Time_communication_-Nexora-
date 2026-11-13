import React, { useState } from 'react';
import {
  Search,
  FileText,
  MessageSquare,
  Clock,
  ArrowRight,
  X,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { aiService } from '../../services/aiService';

const SmartSearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      setSearched(true);
      const data = await aiService.smartSearch(query.trim());
      setResults(data?.results || []);
    } catch (err) {
      console.warn('Smart search error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Header */}
        <form onSubmit={handleSearch} className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search all transcripts and meeting notes by keyword or phrase..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setSearched(false);
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20"
          >
            Search
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </form>

        {/* Results List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-brand-500 animate-spin" />
              Searching dialogue transcripts and saved notes...
            </div>
          ) : searched && results.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No matching transcripts or notes found for "{query}".
            </div>
          ) : (
            results.map((res, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onClose();
                  navigate(`/meeting/${res.meetingId}`);
                }}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-800 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-800 transition cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                    {res.type === 'transcript' ? (
                      <MessageSquare className="w-3.5 h-3.5 text-brand-500" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    )}
                    {res.speakerName || res.lastEditedBy || 'Participant'} • Meeting {res.meetingId}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(res.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2">
                  {res.snippet || res.text}
                </p>

                <div className="flex items-center justify-end text-[11px] text-brand-600 dark:text-brand-400 font-medium gap-1 pt-1">
                  View Meeting <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartSearchModal;

