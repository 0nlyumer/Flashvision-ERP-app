import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import AddNewUser from './AddNewUser';
import PermissionsAdmin from './PermissionsAdmin';
import { isTelegramLinked } from '../../utils/telegram';
import GlobalPagination from '../ui/GlobalPagination';

export default function UserControl() {
  const { state, deleteUser, updateUser, hasPermission } = useApp();
  const [activeUserView, setActiveUserView] = useState(null); // null, 'new', or user object
  const [showPermissions, setShowPermissions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Permissions redesign (2026-10-27): User Control action gates.
  const canCreateUser = hasPermission ? hasPermission('userManagement', 'userControl', 'create') : true;
  const canDeleteUser = hasPermission ? hasPermission('userManagement', 'userControl', 'delete') : true;
  const canEditPermissions = hasPermission ? hasPermission('userManagement', 'permissionsAdmin', 'edit') : true;

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filteredUsers = state.users?.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const displayedUsers = state?.isGlobalPaginated
    ? filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredUsers;

  if (activeUserView) {
    return <AddNewUser 
      initialUser={activeUserView !== 'new' ? activeUserView : null} 
      onCancel={() => setActiveUserView(null)} 
    />;
  }

  return (
    <div className="animate-in fade-in duration-500 pb-24">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-10">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-headline text-on-surface tracking-tight mb-2">User Directory</h1>
          <p className="text-on-surface-variant max-w-md text-sm">Manage organizational access, security roles, and module-specific permissions for the team.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="bg-surface-container-low px-4 py-2.5 rounded-xl flex items-center gap-2 border border-outline-variant/10 focus-within:ring-2 focus-within:ring-primary/20 transition-all w-full sm:w-auto">
            <span className="material-symbols-outlined text-on-surface-variant text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
            <input 
              className="bg-transparent border-none focus:ring-0 text-sm font-medium w-full sm:w-48 outline-none placeholder:text-on-surface-variant/50 text-on-surface" 
              placeholder="Filter users..." 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowPermissions(true)}
            disabled={!canEditPermissions}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary-container text-on-secondary-container rounded-xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95 text-sm w-full sm:w-auto shrink-0 ${!canEditPermissions ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>shield_person</span>
            Permissions & Access
          </button>
          <button onClick={() => setActiveUserView('new')} disabled={!canCreateUser} className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95 text-sm w-full sm:w-auto shrink-0 ${!canCreateUser ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}>
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>person_add</span>
            New User
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* User Card Grid */}
        {displayedUsers.length === 0 ? (
          <div className="bg-surface-container-low rounded-2xl p-12 text-center border border-outline-variant/10">
            <span className="material-symbols-outlined text-outline-variant text-4xl mb-3">group_off</span>
            <p className="text-on-surface-variant font-medium text-sm">No matching user profiles found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
            {displayedUsers.map((user) => (
              <div 
                key={user.id} 
                onClick={() => setActiveUserView(user)}
                className="flex flex-col bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/10 hover:border-primary/30 p-6 rounded-2xl transition-all duration-300 relative group shadow-sm hover:shadow-md cursor-pointer text-center items-center h-full"
              >
                {/* Status Indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-surface-container-lowest/80 px-2 py-0.5 rounded-full border border-outline-variant/5">
                  <span className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-surface-dim'}`}></span>
                  <span className={`text-[10px] font-bold ${user.status === 'Active' ? 'text-on-surface' : 'text-on-surface-variant italic'}`}>
                    {user.status || 'Active'}
                  </span>
                </div>

                {/* Profile Picture */}
                <div className="w-20 h-20 rounded-full overflow-hidden mb-4 border-2 border-outline-variant/20 flex items-center justify-center bg-outline-variant/10 text-on-surface-variant font-extrabold text-2xl shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-sm">
                  {user.image ? (
                    <img alt={user.name} className="w-full h-full object-cover" src={user.image} />
                  ) : (
                    <span className="text-primary font-bold text-xl uppercase">
                      {user.initials || user.name?.substring(0, 2).toUpperCase() || '??'}
                    </span>
                  )}
                </div>

                {/* User Info */}
                <div className="w-full px-2 mb-4">
                  <h4 className="font-extrabold text-on-surface tracking-tight text-base mb-1 truncate w-full" title={user.name}>{user.name}</h4>
                  <p className="text-xs text-primary font-semibold mb-1 truncate w-full">@{user.username || 'username'}</p>
                  <p className="text-xs text-on-surface-variant/80 font-medium truncate w-full" title={user.email}>{user.email}</p>
                </div>

                {/* Role & Department Badges */}
                <div className="mt-auto flex flex-col gap-2 w-full items-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    user.role === 'Admin' || user.role === 'Super Admin' ? 'bg-primary-fixed text-primary' :
                    user.role === 'Warehouse Manager' ? 'bg-secondary-container text-on-secondary-container' :
                    'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                  }`}>
                    {user.role || 'User'}
                  </span>
                  {user.department && (
                    <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest leading-none">
                      {user.department}
                    </span>
                  )}
                  {isTelegramLinked(user) && (
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">
                      ● Telegram linked
                    </span>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="mt-5 flex gap-3 pt-4 border-t border-outline-variant/10 w-full justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveUserView(user);
                    }}
                    className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-all duration-200"
                    title="Edit Permissions"
                  >
                    <span className="material-symbols-outlined text-lg">shield_person</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if(window.confirm(`Are you sure you want to delete ${user.name}?`)) {
                        deleteUser(user.id);
                      }
                    }}
                    disabled={!canDeleteUser}
                    className={`flex items-center justify-center w-9 h-9 rounded-xl bg-error/10 text-error hover:bg-error hover:text-white transition-all duration-200 ${!canDeleteUser ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}
                    title="Delete User"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <GlobalPagination
            totalItems={filteredUsers.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          />
        </div>
      </div>

      {showPermissions && (
        <PermissionsAdmin onClose={() => setShowPermissions(false)} />
      )}
    </div>
  );
}
