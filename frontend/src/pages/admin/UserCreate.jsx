import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Eye, EyeOff } from 'lucide-react';
import { usersAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AdminUserCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: '', name: '', role: 'user', password: '', phone: '',
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await usersAPI.create(data);
      toast.success('User created!');
      navigate('/admin/users');
    } catch {
      toast.error('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/users')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeft className="w-4 h-4" /></button>
        <h2 className="text-xl font-bold text-slate-900">Create User</h2>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
          <input type="text" className="input-field w-full" {...register('name', { required: 'Required' })} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
          <input type="email" className="input-field w-full" {...register('email', { required: 'Required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })} />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
          <input type={showPwd ? 'text' : 'password'} className="input-field w-full pr-10"
            {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />
          <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-8 text-slate-400">
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Role *</label>
          <select className="input-field w-full" {...register('role')}>
            <option value="user">User (Limited Access)</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin (Full Access)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
          <input type="tel" className="input-field w-full" placeholder="+1 555 0100" {...register('phone')} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/admin/users')} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
            <Save className="w-4 h-4" /> {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminUserCreate;
