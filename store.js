// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBNDcw9G_cZQIzWAmR9srjc2mcLkRB9Gp0",
  authDomain: "jisgj-942e7.firebaseapp.com",
  databaseURL: "https://jisgj-942e7-default-rtdb.firebaseio.com",
  projectId: "jisgj-942e7",
  storageBucket: "jisgj-942e7.firebasestorage.app",
  messagingSenderId: "617451491719",
  appId: "1:617451491719:web:cd4d19bf567e41eb764322"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const globalRef = db.ref('together_board');

let globalCache = {};
let callbacks = [];
let isInitialLoad = true;

// Listen to Firebase for real-time updates
globalRef.on('value', (snapshot) => {
    const val = snapshot.val() || {};
    const oldCache = globalCache;
    globalCache = val;
    
    if (isInitialLoad) {
        isInitialLoad = false;
        callbacks.forEach(cb => cb('all'));
        return;
    }
    
    // Trigger callbacks only for keys that actually changed
    const allKeys = new Set([...Object.keys(oldCache), ...Object.keys(globalCache)]);
    for(let key of allKeys) {
        if (JSON.stringify(oldCache[key]) !== JSON.stringify(globalCache[key])) {
            callbacks.forEach(cb => cb(key));
        }
    }
});

const Store = {
  get(key, defaultValue = null) {
    if (key === 'currentUser') {
        const data = localStorage.getItem(`tb_${key}`);
        return data ? JSON.parse(data) : defaultValue;
    }
    return globalCache[key] !== undefined ? globalCache[key] : defaultValue;
  },
  
  set(key, value) {
    if (key === 'currentUser') {
        localStorage.setItem(`tb_${key}`, JSON.stringify(value));
        return;
    }
    // Update local cache immediately for responsive UI
    globalCache[key] = value;
    globalRef.child(key).set(value);
  },
  
  update(key, fn, defaultValue = null) {
    if (key === 'currentUser') {
        const current = this.get(key, defaultValue);
        this.set(key, fn(current));
        return;
    }
    
    // For global data, use Firebase transaction to prevent race conditions when multiple users update at the same time
    globalRef.child(key).transaction((currentData) => {
        const current = currentData !== null ? currentData : defaultValue;
        return fn(current);
    });
  },
  
  clear() {
    globalRef.remove();
    callbacks.forEach(cb => cb('all'));
  },
  
  onUpdate(callback) {
    callbacks.push(callback);
    // If Firebase already loaded the initial data before this callback was registered, trigger it immediately
    if (!isInitialLoad) {
        callback('all');
    }
  },
  
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
};
