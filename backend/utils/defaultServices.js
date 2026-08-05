// The out-of-the-box room-service options. A hotel with no custom services
// falls back to this list; the admin "Load default services" action seeds
// these rows so they can be edited/removed. Labels stay in English — the guest
// page localises known labels and shows custom ones as-is.
module.exports = [
  { icon: '🛁', label: 'Extra Towels / Toiletries' },
  { icon: '🧹', label: 'Room Cleaning' },
  { icon: '❄️', label: 'AC / Heating Issue' },
  { icon: '🛏', label: 'Extra Pillow / Blanket' },
  { icon: '💡', label: 'Electrical Issue' },
  { icon: '📞', label: 'Wake-up Call' },
  { icon: '🔒', label: 'Room Key Issue' },
  { icon: '🚿', label: 'Hot Water Issue' },
  { icon: '🍽', label: 'Dining Table Setup' },
  { icon: '🧺', label: 'Laundry Service' },
  { icon: '🔇', label: 'Noise Complaint' },
  { icon: '📡', label: 'TV / WiFi Issue' },
  { icon: '🚕', label: 'Cab Request' },
];
