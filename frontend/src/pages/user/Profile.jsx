import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Shield, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { getInitials } from '../../utils/helpers';
import toast from 'react-hot-toast';

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  const profileForm = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      company: user?.company?.name || user?.companyName || '',
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

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-slate-900">My Profile</h2>

      {/* Profile header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {getInitials(user?.name || user?.email || '')}
          </div>
          <div>
            {/* The account carries a single `name`; there is no first/last split. */}
            <p className="text-lg font-bold text-slate-900">{user?.name || '—'}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <span className="mt-1 inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {/* company is the associated record, not a string — render its name. */}
              {user?.company?.name || user?.companyName || 'Customer'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100 w-fit">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'security', label: 'Security', icon: Shield },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === id ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-5">Personal Information</h3>
          <form onSubmit={profileForm.handleSubmit(handleProfileSave)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
              <input type="text" className="input-field w-full" {...profileForm.register('name')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <input type="email" className="input-field w-full" {...profileForm.register('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
              <input type="tel" className="input-field w-full" placeholder="+1 555 0100" {...profileForm.register('phone')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name</label>
              <input type="text" disabled title="Set by your administrator"
                className="input-field w-full bg-slate-50 text-slate-500" {...profileForm.register('company')} />
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
    </div>
  );
};

export default UserProfile;
