(() => {
  'use strict';

  // Firebase Configuration
  const firebaseConfig = {
    apiKey: "AIzaSyC7H4Z4SHfpFaZXJdMeAKG9szDg2KUdBpo",
    authDomain: "grocery-list-5533e.firebaseapp.com",
    databaseURL: "https://grocery-list-5533e-default-rtdb.firebaseio.com",
    projectId: "grocery-list-5533e",
    storageBucket: "grocery-list-5533e.firebasestorage.app",
    messagingSenderId: "429534628995",
    appId: "1:429534628995:web:97677367fbb7b1979edfb6",
    measurementId: "G-LNQZNWG61X"
  };

  // Initialize Firebase
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    if (firebase.analytics) {
      firebase.analytics();
    }
  }

  function safeGet(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
  function safeSet(store, key, value) { try { store.setItem(key, value); } catch (e) { } }
  function safeRemove(store, key) { try { store.removeItem(key); } catch (e) { } }

  const CREDENTIALS = { username: 'ASWATHY', password: 'HARI' };
  const AUTH_KEY = 'grocery.authed.user';

  const loginScreen = document.getElementById('loginScreen');
  const appRoot = document.getElementById('appRoot');
  const loginForm = document.getElementById('loginForm');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const signOutBtn = document.getElementById('signOutBtn');
  const usernameDisplay = document.getElementById('username');

  let currentUser = null;

  function showApp() { loginScreen.style.display = 'none'; appRoot.style.display = 'flex'; }
  function showLogin() {
    appRoot.style.display = 'none';
    loginScreen.style.display = 'flex';
    loginUsername.value = '';
    loginPassword.value = '';
    loginError.style.display = 'none';
    loginUsername.focus();
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = loginUsername.value.trim();
    const pass = loginPassword.value;

    if (user === CREDENTIALS.username && pass === CREDENTIALS.password) {
      currentUser = user;
      usernameDisplay.textContent = user;
      safeSet(localStorage, AUTH_KEY, user);
      showApp();
      init();
    } else {
      loginError.style.display = 'block';
      loginPassword.value = '';
      loginPassword.focus();
    }
  });

  signOutBtn.addEventListener('click', () => {
    currentUser = null;
    safeRemove(localStorage, AUTH_KEY);
    clearAllTimers();
    showLogin();
  });

  const savedUser = safeGet(localStorage, AUTH_KEY);
  if (savedUser === CREDENTIALS.username) {
    currentUser = savedUser;
    usernameDisplay.textContent = savedUser;
    showApp();
  } else {
    showLogin();
  }

  const THEME_KEY = 'grocery.theme';
  const themeBtn = document.getElementById('themeBtn');

  function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    themeBtn.textContent = theme === 'light' ? '☀️ Light' : '🌙 Dark';
  }

  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    safeSet(localStorage, THEME_KEY, next);
  });

  applyTheme(currentTheme());

  const LISTS = ['Grocery List', 'Costco List'];
  const LIST_ICONS = { 'Grocery List': '🛒', 'Costco List': '📦' };

  const BUILT_IN_CATEGORIES = {
    '🥦 Produce': ['apple','apples','banana','bananas','berry','berries','spinach','lettuce','tomato','tomatoes','potato','potatoes','onion','onions','garlic','carrot','carrots','avocado','lemon','lime','cucumber','grape','grapes','broccoli','pepper','mushroom','ginger','fruit','vegetable','orange','oranges'],
    '🥛 Dairy': ['milk','cheese','butter','yogurt','yoghurt','cream','egg','eggs','paneer'],
    '🍞 Bakery': ['bread','puff pastry','croissant','bagel','bun','buns','muffin','cake','pita'],
    '🍗 Meat & Seafood': ['chicken','beef','pork','lamb','salmon','fish','shrimp','prawns','bacon','turkey','mince','steak'],
    '🍿 Snacks': ['chips','chocolate','popcorn','nuts','biscuit','biscuits','crackers','cookie','cookies','candy'],
    '🥤 Drinks': ['juice','soda','coke','water','coffee','tea','sparkling water','energy drink'],
    '❄️ Frozen': ['ice cream','frozen peas','pizza','frozen berries','nuggets'],
    '🧽 Household': ['paper towel','toilet paper','trash bags','sponge','cleaner'],
    '🍚 Pantry': ['rice','pasta','olive oil','flour','sugar','salt','pepper','sauce','cereal','oats','canned beans','chickpeas'],
    '🍛 Indian Store': ['atta','basmati','ghee','masala','turmeric','paneer','roti','naan']
  };

  function emptyState() {
    const listsData = {};
    LISTS.forEach(name => { listsData[name] = { items: [] }; });
    return { activeList: 'Grocery List', listsData, customChips: [], learned: {} };
  }

  let state = emptyState();

  function saveState() { safeSet(localStorage, 'grocery.state', JSON.stringify(state)); }

  function loadState() {
    try {
      const raw = safeGet(localStorage, 'grocery.state');
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      const fresh = emptyState();
      const listsData = {};
      LISTS.forEach(name => {
        const saved = parsed.listsData && parsed.listsData[name];
        listsData[name] = (saved && Array.isArray(saved.items)) ? saved : fresh.listsData[name];
      });
      return {
        activeList: (parsed.activeList && listsData[parsed.activeList]) ? parsed.activeList : 'Grocery List',
        listsData,
        customChips: Array.isArray(parsed.customChips) ? parsed.customChips : [],
        learned: (parsed.learned && typeof parsed.learned === 'object') ? parsed.learned : {}
      };
    } catch (e) {
      return emptyState();
    }
  }

  function activeItems() { return state.listsData[state.activeList].items; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function suggestCategory(rawName) {
    const q = rawName.trim().toLowerCase();
    if (!q) return '';
    if (state.learned[q]) return state.learned[q];
    for (const [cat, keywords] of Object.entries(BUILT_IN_CATEGORIES)) {
      if (keywords.some(kw => q.includes(kw) || kw.includes(q))) return cat;
    }
    return '📦 Other';
  }

  function clearAllTimers() { }
  function init() { }
})();
