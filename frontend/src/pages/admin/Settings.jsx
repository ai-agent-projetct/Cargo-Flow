import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Building2, Bell, Shield, Palette } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AdminSettings = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  const profileForm = useForm({
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      company: user?.company || 'CargoFlo Logistics',
    },
  });

  const pwdForm = useForm({
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const handleProfileSave = async (data) => {
    setLoading(true);
    try {
      const response = await authAPI.updateProfile(data);
      updateUser(response.data.data);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (data) => {
    if (data.new_password !== data.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authAPI.changePassword({ current_password: data.current_password, new_password: data.new_password });
      toast.success('Password changed!');
      pwdForm.reset();
    } catch {
      toast.error('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: Building2 },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-slate-900">Settings</h2>

      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === id ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-5">Profile Information</h3>
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user?.first_name?.[0] || 'A'}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{user?.first_name} {user?.last_name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <button className="mt-1 text-xs text-primary-600 hover:text-primary-800">Change photo</button>
            </div>
          </div>
          <form onSubmit={profileForm.handleSubmit(handleProfileSave)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
                <input type="text" className="input-field w-full" {...profileForm.register('first_name')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
                <input type="text" className="input-field w-full" {...profileForm.register('last_name')} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" className="input-field w-full" {...profileForm.register('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input type="tel" className="input-field w-full" {...profileForm.register('phone')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
              <input type="text" className="input-field w-full" {...profileForm.register('company')} />
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
                <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-5">Change Password</h3>
          <form onSubmit={pwdForm.handleSubmit(handlePasswordChange)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
              <input type="password" className="input-field w-full" {...pwdForm.register('current_password', { required: 'Required' })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
              <input type="password" className="input-field w-full" {...pwdForm.register('new_password', { required: 'Required', minLength: { value: 8, message: 'Min 8 chars' } })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
              <input type="password" className="input-field w-full" {...pwdForm.register('confirm_password', { required: 'Required' })} />
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
                <Shield className="w-4 h-4" /> {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-5">Notification Preferences</h3>
          <div className="space-y-4">
            {[
              ['New shipment bookings', true],
              ['Shipment status updates', true],
              ['New quotation requests', true],
              ['Invoice payment received', true],
              ['Overdue invoice alerts', true],
              ['System maintenance alerts', false],
            ].map(([label, def]) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-700">{label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={def} className="sr-only peer" />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4">
            <button className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
              <Save className="w-4 h-4" /> Save Preferences
            </button>
          </div>
        </div>
      )}

      {activeTab === 'appearance' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-5">Appearance</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {['Light', 'Dark', 'System'].map((t) => (
                  <button key={t} className={`p-3 border-2 rounded-xl text-sm font-medium transition-colors ${t === 'Light' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Sidebar Style</label>
              <div className="grid grid-cols-2 gap-3">
                {['Expanded', 'Compact'].map((s) => (
                  <button key={s} className={`p-3 border-2 rounded-xl text-sm font-medium ${s === 'Expanded' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
