import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, LogOut, User as UserIcon, PlusCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from './Button';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 dark:bg-dark-900/90 border-b border-slate-200/90 dark:border-dark-750/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand NEXORA */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-brand-600/30 group-hover:scale-105 transition-transform duration-200">
            <Video className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-1 font-heading">
              NEXORA
            </span>
            <span className="text-[9px] text-brand-600 dark:text-brand-400 -mt-0.5 font-bold tracking-widest uppercase">
              Workspace
            </span>
          </div>
        </Link>

        {/* Navigation Items */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  New Meeting
                </Button>
              </Link>

              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-dark-750">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400 font-semibold text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 hidden md:inline-block">
                    {user?.name}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="gradient" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
