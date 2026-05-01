const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    const validChannels = ['countdown-complete', 'postpone-break', 'skip-break'];
    if (validChannels.includes(channel)) ipcRenderer.send(channel, data);
  },

  on: (channel, func) => {
    const validChannels = ['start-countdown', 'background-config'];
    if (validChannels.includes(channel)) {
      const sub = (event, ...args) => func(...args);
      ipcRenderer.on(channel, sub);
      return () => ipcRenderer.removeListener(channel, sub);
    }
  },

  once: (channel, func) => {
    const validChannels = ['start-countdown', 'background-config'];
    if (validChannels.includes(channel)) {
      ipcRenderer.once(channel, (event, ...args) => func(...args));
    }
  },

  invoke: async (channel, data) => {
    const validChannels = [
      'get-settings',
      'save-settings',
      'get-statistics',
      'upload-background-images',
      'remove-background-image',
      'get-background-images',
      'open-external',
      'copy-to-clipboard',
      'capture-statistics',
      'complete-onboarding',
      'get-onboarding-status'
    ];
    if (validChannels.includes(channel)) return await ipcRenderer.invoke(channel, data);
  },

  removeAllListeners: (channel) => {
    const validChannels = ['start-countdown', 'background-config'];
    if (validChannels.includes(channel)) ipcRenderer.removeAllListeners(channel);
  }
});
