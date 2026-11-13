const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      default: () => 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      index: true
    },
    adminId: {
      type: String,
      required: true,
      index: true
    },
    adminEmail: {
      type: String,
      required: true,
      index: true
    },
    adminName: {
      type: String,
      default: 'Admin'
    },
    action: {
      type: String,
      required: true,
      enum: [
        'user_suspended',
        'user_reactivated',
        'user_role_changed',
        'user_deleted',
        'meeting_terminated',
        'meeting_report_investigated',
        'meeting_report_resolved',
        'meeting_report_dismissed',
        'file_deleted',
        'system_settings_updated'
      ],
      index: true
    },
    targetType: {
      type: String,
      required: true,
      enum: ['user', 'meeting', 'file', 'system'],
      index: true
    },
    targetId: {
      type: String,
      required: true,
      index: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

adminAuditLogSchema.methods.toSafeObject = function () {
  return {
    id: this.logId || this._id.toString(),
    logId: this.logId,
    adminId: this.adminId,
    adminEmail: this.adminEmail,
    adminName: this.adminName,
    action: this.action,
    targetType: this.targetType,
    targetId: this.targetId,
    details: this.details || {},
    ipAddress: this.ipAddress,
    createdAt: this.createdAt
  };
};

// High-performance audit log query indexes
adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);

