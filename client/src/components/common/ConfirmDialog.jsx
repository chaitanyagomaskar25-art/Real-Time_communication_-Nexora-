import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Trash2, CheckCircle2 } from 'lucide-react';
import Button from './Button';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'warning' | 'info' | 'success'
  isLoading = false
}) => {
  if (!isOpen) return null;

  const iconConfig = {
    danger: {
      Icon: Trash2,
      bgColor: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
      buttonVariant: 'danger'
    },
    warning: {
      Icon: AlertTriangle,
      bgColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
      buttonVariant: 'primary'
    },
    success: {
      Icon: CheckCircle2,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
      buttonVariant: 'primary'
    },
    info: {
      Icon: Info,
      bgColor: 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-900/50',
      buttonVariant: 'primary'
    }
  }[type] || iconConfig.danger;

  const { Icon, bgColor, buttonVariant } = iconConfig;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="relative w-full max-w-sm bg-white dark:bg-dark-900 rounded-3xl border border-slate-200/90 dark:border-dark-750 shadow-2xl p-6 space-y-4 z-10"
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${bgColor} shadow-sm`}>
              <Icon className="w-5 h-5" />
            </div>

            <div className="space-y-1 pt-0.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-heading">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-dark-800">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="text-xs font-semibold px-4"
            >
              {cancelText}
            </Button>
            <Button
              variant={buttonVariant}
              size="sm"
              onClick={onConfirm}
              isLoading={isLoading}
              className="text-xs font-semibold px-4"
            >
              {confirmText}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmDialog;
