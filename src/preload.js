const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widgetAPI', {
  onUsageUpdated: (callback) => {
    ipcRenderer.on('usage-updated', (_event, data) => callback(data));
  },
  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings-updated', (_event, settings) => callback(settings));
  },
  onTriggerBubbleAlert: (callback) => {
    ipcRenderer.on('trigger-bubble-alert', (_event, info) => callback(info));
  },
  updateSettings: (settings) => {
    ipcRenderer.send('update-settings', settings);
  },
  setViewMode: (mode) => {
    ipcRenderer.send('set-view-mode', mode);
  },
  requestRefresh: () => {
    ipcRenderer.send('request-refresh');
  },
  closeApp: () => {
    ipcRenderer.send('close-app');
  },
  setSimulation: (percent) => {
    ipcRenderer.send('set-simulation', percent);
  },
  resetPosition: () => {
    ipcRenderer.send('reset-position');
  },
  dragWindow: (deltaX, deltaY) => {
    ipcRenderer.send('drag-window', { deltaX, deltaY });
  },
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },
  hideWindow: () => {
    ipcRenderer.send('hide-window');
  }
});
