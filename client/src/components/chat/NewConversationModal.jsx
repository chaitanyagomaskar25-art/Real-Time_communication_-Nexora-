import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  UsersRound,
  Search,
  Users
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { contactService } from '../../services/contactService';

const NewConversationModal = ({
  isOpen,
  onClose,
  onStartDirectConversation,
  onCreateGroupRoom
}) => {
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'group'
  const [groupTitle, setGroupTitle] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const fetchContacts = async () => {
      setIsLoading(true);
      try {
        const res = await contactService.getContacts();
        const list = res?.data || res || [];
        setContacts(Array.isArray(list) ? list : []);
      } catch {
        setContacts([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContacts();
  }, [isOpen]);

  const filteredContacts = contacts.filter((c) => {
    const name = c.user?.fullName || c.user?.name || '';
    const email = c.user?.email || '';
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  });

  const handleSelectContact = (contact) => {
    if (onStartDirectConversation) {
      onStartDirectConversation(contact.user || contact);
    }
    onClose();
  };

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!groupTitle.trim()) return;
    if (onCreateGroupRoom) {
      onCreateGroupRoom(groupTitle.trim());
    }
    setGroupTitle('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start New Conversation"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Tab selection: Direct vs Group */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-dark-800 text-xs font-semibold border border-slate-200/60 dark:border-dark-750">
          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`py-2 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'direct'
                ? 'bg-white dark:bg-dark-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Direct Message
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('group')}
            className={`py-2 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'group'
                ? 'bg-white dark:bg-dark-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UsersRound className="w-4 h-4" />
            Team Channel
          </button>
        </div>

        {activeTab === 'direct' ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search contact name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading contacts...</div>
              ) : filteredContacts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-400">No contacts found</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Add new contacts from the Contacts page to chat directly.
                  </p>
                </div>
              ) : (
                filteredContacts.map((c) => {
                  const targetUser = c.user || c;
                  const name = targetUser.fullName || targetUser.name || 'User';
                  const isOnline = targetUser.isOnline;
                  return (
                    <div
                      key={targetUser.id || targetUser._id}
                      onClick={() => handleSelectContact(c)}
                      className="py-2.5 px-2 flex items-center justify-between rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span
                            className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-dark-900 ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {targetUser.email}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Chat
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <Input
              label="Channel Name"
              placeholder="e.g. Design Team Sync, Sprint Review"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              required
            />
            <p className="text-[11px] text-slate-400">
              Create an encrypted team communication room with instant peer-to-peer conferencing capabilities.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="gradient" size="sm" disabled={!groupTitle.trim()}>
                Create Channel
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default NewConversationModal;
