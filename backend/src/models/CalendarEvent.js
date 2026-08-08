const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Calendar > Meetings" — mirrors calendar.event. Events either stand alone or
// hang off a source document (a lead, quote, shipment, partner…), which is what
// the form's Document button opens.
const CalendarEvent = sequelize.define('CalendarEvent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(250), allowNull: false, comment: 'Meeting Subject' },

  start: { type: DataTypes.DATE, allowNull: false },
  stop: { type: DataTypes.DATE, allowNull: false },
  // Stored in hours the way float_time renders it: 1.5 -> "01:30 hours".
  duration: { type: DataTypes.FLOAT, defaultValue: 1 },
  allday: { type: DataTypes.BOOLEAN, defaultValue: false },
  eventTz: { type: DataTypes.STRING(60), allowNull: true },

  organizer: { type: DataTypes.STRING(150), allowNull: true },
  organizerId: { type: DataTypes.UUID, allowNull: true },
  // [{ id, name, email, status }] — status uses the attendee_status selection.
  attendees: { type: DataTypes.JSON, defaultValue: [] },

  location: { type: DataTypes.STRING(250), allowNull: true },
  videocallLocation: { type: DataTypes.STRING(250), allowNull: true, comment: 'Meeting URL' },
  description: { type: DataTypes.TEXT, allowNull: true },

  // Reminders + Tags, stored as label arrays to stay flat.
  alarms: { type: DataTypes.JSON, defaultValue: [] },
  tags: { type: DataTypes.JSON, defaultValue: [] },

  privacy: {
    type: DataTypes.ENUM('public', 'private', 'confidential'),
    defaultValue: 'public',
  },
  showAs: { type: DataTypes.ENUM('free', 'busy'), defaultValue: 'busy' },

  // Recurrence — the Options tab's full rrule set.
  recurrency: { type: DataTypes.BOOLEAN, defaultValue: false },
  interval: { type: DataTypes.INTEGER, defaultValue: 1 },
  rruleType: { type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly'), defaultValue: 'weekly' },
  endType: { type: DataTypes.ENUM('count', 'end_date', 'forever'), defaultValue: 'count' },
  count: { type: DataTypes.INTEGER, defaultValue: 1 },
  until: { type: DataTypes.DATEONLY, allowNull: true },
  monthBy: { type: DataTypes.ENUM('date', 'day'), defaultValue: 'date' },
  day: { type: DataTypes.INTEGER, allowNull: true },
  byday: { type: DataTypes.STRING(4), allowNull: true },
  weekday: { type: DataTypes.STRING(4), allowNull: true },
  // Days-of-week flags for weekly recurrence.
  weekdays: { type: DataTypes.JSON, defaultValue: [] },

  // The source document the Document button opens.
  resModel: { type: DataTypes.STRING(80), allowNull: true },
  resId: { type: DataTypes.STRING(80), allowNull: true },
  resName: { type: DataTypes.STRING(250), allowNull: true },

  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'calendar_events',
  hooks: {
    beforeValidate: (rec) => {
      // start/stop and duration must agree; whichever the caller supplied wins.
      if (rec.start && rec.stop) {
        const hours = (new Date(rec.stop) - new Date(rec.start)) / 3600000;
        if (hours >= 0) rec.duration = Math.round(hours * 100) / 100;
      } else if (rec.start && rec.duration) {
        rec.stop = new Date(new Date(rec.start).getTime() + rec.duration * 3600000);
      }
      if (rec.allday) rec.duration = 24;
    },
  },
});

// float_time: 1.5 -> "01:30"
CalendarEvent.prototype.durationLabel = function durationLabel() {
  const h = Math.floor(this.duration || 0);
  const m = Math.round(((this.duration || 0) - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

module.exports = CalendarEvent;
