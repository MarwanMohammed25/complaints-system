const { contextBridge, ipcRenderer } = require('electron');

// Firebase will be loaded in renderer process
// We just expose IPC channels for communication

contextBridge.exposeInMainWorld('firebaseAPI', {
    signIn: async (email, password) => {
        return await ipcRenderer.invoke('auth:signIn', { email, password });
    },
    
    createAccount: async (email, password) => {
        return await ipcRenderer.invoke('auth:createAccount', { email, password });
    },
    
    resetPassword: async (email) => {
        return await ipcRenderer.invoke('auth:resetPassword', { email });
    },
    
    signOut: async () => {
        return await ipcRenderer.invoke('auth:signOut');
    },
    
    onAuthStateChanged: (callback) => {
        ipcRenderer.on('auth:stateChanged', (event, user) => {
            callback(user);
        });
    },
    
    getCurrentUser: async () => {
        return await ipcRenderer.invoke('auth:getCurrentUser');
    }
});

console.log('Preload script loaded successfully');

