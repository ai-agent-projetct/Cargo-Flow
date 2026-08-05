import React, { useState } from 'react';
import { X, Paperclip, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

// "Send Mail (booking)" dialog, mirroring SeaRates ERP / Odoo's mass-mailing
// composer opened from a record's "Action" menu: From / Recipients / CC /
// Subject / Replies (radio) / message body / Attach a file, with a "booking"
// mail template selector and Send / Cancel / Save as new template actions.
const SendMailModal = ({ isOpen, onClose, recordName = '' }) => {
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(recordName ? `${recordName}` : '');
  const [replyMode, setReplyMode] = useState('thread');
  const [redirectEmail, setRedirectEmail] = useState('');
  const [body, setBody] = useState('');
  const [template, setTemplate] = useState('booking');

  if (!isOpen) return null;

  const handleSend = () => {
    toast.success('Email sent');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-primary-600">Send Mail (booking)</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm">
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <label className="text-slate-600 font-medium">From</label>
            <input
              type="text"
              value='"CargoFlo" <noreply@cargoflo.com>'
              disabled
              className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-start gap-2">
            <label className="text-slate-600 font-medium pt-2">Recipients</label>
            <div className="space-y-1">
              <p className="font-semibold text-slate-700">Email mass mailing on the selected records.</p>
              <select
                defaultValue=""
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="" disabled>Add contacts to notify...</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <label className="text-slate-600 font-medium">CC</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="emails with separated by comma"
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <label className="text-slate-600 font-medium">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject..."
              className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-start gap-2">
            <label className="text-slate-600 font-medium pt-1">Replies</label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sendMailReplies"
                  checked={replyMode === 'thread'}
                  onChange={() => setReplyMode('thread')}
                />
                Log in the original discussion thread
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sendMailReplies"
                  checked={replyMode === 'redirect'}
                  onChange={() => setReplyMode('redirect')}
                />
                Redirect to another email address
              </label>
              {replyMode === 'redirect' && (
                <input
                  type="text"
                  value={redirectEmail}
                  onChange={(e) => setRedirectEmail(e.target.value)}
                  placeholder="email address"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              )}
            </div>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Write your message here..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => toast('Coming soon')}
              className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            >
              <Paperclip className="w-3.5 h-3.5" /> Attach a file
            </button>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Use template</span>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="booking">booking</option>
              </select>
              <button onClick={() => toast('Coming soon')} className="p-1.5 text-slate-400 hover:text-slate-600">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl">
          <div className="flex items-center gap-3">
            <button onClick={handleSend} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
              Send
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          </div>
          <button onClick={() => toast('Coming soon')} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            Save as new template
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendMailModal;
