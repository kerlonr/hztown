const ICONS = {
  mic: [
    '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>',
    '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>',
    '<path d="M12 19v3"/>'
  ],
  "mic-off": [
    '<path d="m2 2 20 20"/>',
    '<path d="M9 9v3a3 3 0 0 0 5.1 2.1"/>',
    '<path d="M15 9.3V5a3 3 0 0 0-5.1-2.1"/>',
    '<path d="M19 10v2a7 7 0 0 1-.7 3"/>',
    '<path d="M5 10v2a7 7 0 0 0 10.7 5.9"/>',
    '<path d="M12 19v3"/>'
  ],
  video: [
    '<path d="m16 13 5 3V8l-5 3Z"/>',
    '<rect x="3" y="6" width="13" height="12" rx="2"/>'
  ],
  "video-off": [
    '<path d="m2 2 20 20"/>',
    '<path d="M10.7 6H14a2 2 0 0 1 2 2v3l5-3v8"/>',
    '<path d="M16 16v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1"/>'
  ],
  monitor: [
    '<rect x="3" y="4" width="18" height="12" rx="2"/>',
    '<path d="M8 20h8"/>',
    '<path d="M12 16v4"/>'
  ],
  "monitor-off": [
    '<path d="m2 2 20 20"/>',
    '<path d="M9 4h10a2 2 0 0 1 2 2v10"/>',
    '<path d="M14.5 16H5a2 2 0 0 1-2-2V6c0-.7.4-1.3.9-1.7"/>',
    '<path d="M8 20h8"/>',
    '<path d="M12 16v4"/>'
  ],
  message: [
    '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>'
  ],
  phone: [
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2Z"/>'
  ],
  "phone-off": [
    '<path d="m2 2 20 20"/>',
    '<path d="M14.5 14.5a16 16 0 0 1-6.5-6.5"/>',
    '<path d="M8.6 2.2a2 2 0 0 1 .5 1.5c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.5"/>',
    '<path d="M15.7 14.8a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1"/>',
    '<path d="M4.1 2H4a2 2 0 0 0-1.9 2.2 19.8 19.8 0 0 0 3.1 8.6"/>'
  ],
  send: [
    '<path d="m22 2-7 20-4-9-9-4Z"/>',
    '<path d="M22 2 11 13"/>'
  ],
  settings: [
    '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>',
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'
  ],
  speaker: [
    '<path d="M11 5 6 9H2v6h4l5 4Z"/>',
    '<path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    '<path d="M18.5 5.5a9 9 0 0 1 0 13"/>'
  ],
  close: [
    '<path d="M18 6 6 18"/>',
    '<path d="m6 6 12 12"/>'
  ],
  menu: [
    '<path d="M4 6h16"/>',
    '<path d="M4 12h16"/>',
    '<path d="M4 18h16"/>'
  ],
  users: [
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>',
    '<circle cx="9" cy="7" r="4"/>',
    '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  ],
  minimize: [
    '<path d="M5 12h14"/>'
  ],
  note: [
    '<path d="M4 4h16v11l-5 5H4Z"/>',
    '<path d="M15 20v-5h5"/>',
    '<path d="M8 9h8"/>',
    '<path d="M8 13h5"/>'
  ],
  grid: [
    '<rect x="3" y="3" width="8" height="8" rx="1.5"/>',
    '<rect x="13" y="3" width="8" height="8" rx="1.5"/>',
    '<rect x="3" y="13" width="8" height="8" rx="1.5"/>',
    '<rect x="13" y="13" width="8" height="8" rx="1.5"/>'
  ],
  chart: [
    '<path d="M3 3v18h18"/>',
    '<path d="M7 15v-4"/>',
    '<path d="M12 15V7"/>',
    '<path d="M17 15v-7"/>'
  ],
  calendar: [
    '<rect x="3" y="5" width="18" height="16" rx="2"/>',
    '<path d="M8 3v4"/>',
    '<path d="M16 3v4"/>',
    '<path d="M3 10h18"/>',
    '<path d="M8 14h2"/>',
    '<path d="M14 14h2"/>'
  ],
  hammer: [
    '<path d="M13.5 3.5 20.5 10.5 18 13l-7-7Z"/>',
    '<path d="m12.5 7.5-9 9a2.1 2.1 0 1 0 3 3l9-9"/>'
  ],
  board: [
    '<rect x="3.5" y="3" width="4.6" height="18" rx="1"/>',
    '<rect x="9.7" y="3" width="4.6" height="12" rx="1"/>',
    '<rect x="15.9" y="3" width="4.6" height="8" rx="1"/>'
  ],
  "zoom-in": [
    '<circle cx="11" cy="11" r="7"/>',
    '<path d="m21 21-4.3-4.3"/>',
    '<path d="M11 8v6"/>',
    '<path d="M8 11h6"/>'
  ],
  "zoom-out": [
    '<circle cx="11" cy="11" r="7"/>',
    '<path d="m21 21-4.3-4.3"/>',
    '<path d="M8 11h6"/>'
  ]
};

export function setIcon(element, name) {
  element.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      ${ICONS[name].join("")}
    </svg>
  `;
}

export function hydrateStaticIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((element) => {
    setIcon(element, element.dataset.icon);
  });
}
