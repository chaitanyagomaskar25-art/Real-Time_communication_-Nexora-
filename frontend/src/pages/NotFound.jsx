import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import Button from '../components/common/Button';

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="w-16 h-16 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-6 shadow-sm">
        <Compass className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">404 - Page Not Found</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-8">
        The meeting room or page you are looking for doesn't exist, expired, or the URL is incorrect.
      </p>
      <Link to="/dashboard">
        <Button variant="primary" size="md">
          <Home className="w-4 h-4 mr-2" />
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};

export default NotFound;
