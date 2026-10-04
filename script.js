(() => {
  'use strict';

  // 1. Firebase Configuration with safe failover
  const firebaseConfig = {
    apiKey: "AIzaSyC7H4Z4SHfpFaZXJdMeAKG9szDg2KUdBpo",
    authDomain: "grocery-list-5533e.firebaseapp.com",
    databaseURL: "https://grocery-list-5533e-default-rtdb.firebaseio.com",
    projectId: "grocery-list-5533e",
    storageBucket: "grocery-list-5533e.firebasestorage.app",
    messagingSenderId: "429534628995",
    appId: "1:429534628995:web:97677367fbb7b1979edfb6"
  };

  let db = null;
  try {
    if (typeof firebase !== 'undefined' && firebase.apps) {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.database();
    }
  } catch (err) {
    console.warn("Firebase initialization skipped:", err);
  }

  // Storage Helpers
  function safeGet(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
  function safeSet(store, key, value) { try { store.setItem(key, value); } catch (e) { } }
  function safeRemove(store, key) { try { store.removeItem(key); } catch (e) { } }

  // Auth Constants
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
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = loginUsername.value.trim();
      const pass = loginPassword.value;

      if (user === CREDENTIALS.username && pass === CREDENTIALS.password) {
        currentUser = user;
        if (usernameDisplay) usernameDisplay.textContent = user;
        safeSet(localStorage, AUTH_KEY, user);
        showApp();
        init();
      } else {
        loginError.style.display = 'block';
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      currentUser = null;
      safeRemove(localStorage, AUTH_KEY);
      showLogin();
    });
  }

  // Theme Handling
  const THEME_KEY = 'grocery.theme';
  const themeBtn = document.getElementById('themeBtn');

  function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    if (themeBtn) themeBtn.textContent = theme === 'light' ? '☀️ Light' : '🌙 Dark';
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = currentTheme() === 'light' ? 'dark' : 'light';
      applyTheme(next);
      safeSet(localStorage, THEME_KEY, next);
    });
  }

  applyTheme(currentTheme());

  // Default Categories & Lists
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
  let undoStack = [];
  let redoStack = [];
  let isRemoteSync = false;

  function pushHistory() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 30) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  function saveState() {
    safeSet(localStorage, 'grocery.state', JSON.stringify(state));
    if (db && !isRemoteSync) {
      try { db.ref('groceryState').set(state); } catch (e) {}
    }
  }

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

  function activeItems() {
    if (!state.listsData[state.activeList]) {
      state.listsData[state.activeList] = { items: [] };
    }
    return state.listsData[state.activeList].items;
  }

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

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2500);
  }

  // DOM Elements
  const listNav = document.getElementById('listNav');
  const pageTitle = document.getElementById('pageTitle');
  const tabList = document.getElementById('tabList');
  const tabRemoved = document.getElementById('tabRemoved');
  const toggleAddBtn = document.getElementById('toggleAddBtn');
  const viewAdd = document.getElementById('viewAdd');
  const viewList = document.getElementById('viewList');
  const viewRemoved = document.getElementById('viewRemoved');
  const addForm = document.getElementById('addForm');
  const itemName = document.getElementById('itemName');
  const categoryInput = document.getElementById('categoryInput');
  const quickCategories = document.getElementById('quickCategories');
  const customChipInput = document.getElementById('customChipInput');
  const addChipBtn = document.getElementById('addChipBtn');
  const quantityInput = document.getElementById('quantityInput');
  const unitInput = document.getElementById('unitInput');
  const searchInput = document.getElementById('searchInput');
  const listGroups = document.getElementById('listGroups');
  const removedGroups = document.getElementById('removedGroups');
  const countActive = document.getElementById('countActive');
  const countRemoved = document.getElementById('countRemoved');

  let selectedCategory = '';

  function switchTab(viewName) {
    tabList.classList.remove('selected');
    toggleAddBtn.classList.remove('selected');
    tabRemoved.classList.remove('selected');

    viewAdd.classList.remove('active');
    viewList.classList.remove('active');
    viewRemoved.classList.remove('active');

    if (viewName === 'add') {
      toggleAddBtn.classList.add('selected');
      viewAdd.classList.add('active');
      if (itemName) itemName.focus();
    } else if (viewName === 'removed') {
      tabRemoved.classList.add('selected');
      viewRemoved.classList.add('active');
    } else {
      tabList.classList.add('selected');
      viewList.classList.add('active');
    }
  }

  function renderSidebar() {
    if (!listNav) return;
    listNav.innerHTML = '';
    LISTS.forEach(name => {
      const btn = document.createElement('button');
      btn.className = `nav-btn ${name === state.activeList ? 'active' : ''}`;
      btn.type = 'button';
      btn.innerHTML = `<span>${LIST_ICONS[name] || '📋'}</span> <span>${name}</span>`;
      btn.addEventListener('click', () => {
        state.activeList = name;
        saveState();
        renderAll();
      });
      listNav.appendChild(btn);
    });
  }

  function renderQuickCategories() {
    if (!quickCategories) return;
    quickCategories.innerHTML = '';
    const allCategories = [...Object.keys(BUILT_IN_CATEGORIES), ...state.customChips];
    allCategories.forEach(cat => {
      const chip = document.createElement('button');
      chip.type = 'button';
      const isChosen = selectedCategory.trim().toLowerCase() === cat.trim().toLowerCase();
      chip.className = `category-chip ${isChosen ? 'chosen' : ''}`;
      chip.textContent = cat;
      chip.addEventListener('click', () => {
        selectedCategory = cat;
        if (categoryInput) categoryInput.value = cat;
        renderQuickCategories();
      });
      quickCategories.appendChild(chip);
    });
  }

  function renderAll() {
    if (pageTitle) {
      pageTitle.innerHTML = `${LIST_ICONS[state.activeList] || '🛒'} ${state.activeList} <span class="live-badge">LIVE</span>`;
    }
    renderSidebar();
    renderQuickCategories();
    renderItems();
    updateUndoRedoButtons();
  }

  function renderItems() {
    const items = activeItems();
    const search = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const activeList = items.filter(i => !i.removed && (search ? i.name.toLowerCase().includes(search) : true));
    const removedList = items.filter(i => i.removed);

    if (countActive) countActive.textContent = items.filter(i => !i.removed).length;
    if (countRemoved) countRemoved.textContent = removedList.length;

    // Active Items
    if (listGroups) {
      listGroups.innerHTML = '';
      if (activeList.length === 0) {
        listGroups.innerHTML = '<div class="empty">No items in this list. Click "+ Add Item" above to add!</div>';
      } else {
        const grouped = {};
        activeList.forEach(item => {
          const cat = item.category || '📦 Other';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        });

        for (const [cat, catItems] of Object.entries(grouped)) {
          const groupEl = document.createElement('div');
          groupEl.className = 'group';
          groupEl.innerHTML = `<div class="group-title">${cat}</div>`;
          const rowsEl = document.createElement('div');
          rowsEl.className = 'rows';

          catItems.forEach(item => {
            const row = document.createElement('div');
            row.className = `row ${item.purchased ? 'purchased' : ''}`;
            row.innerHTML = `
              <label class="checkbox">
                <input type="checkbox" ${item.purchased ? 'checked' : ''} />
                <span class="checkmark"></span>
              </label>
              <div class="row-info">
                <span class="row-name">${item.name}</span>
                <span class="row-meta">${item.quantity} ${item.unit}</span>
              </div>
              <button type="button" class="row-action delete" title="Remove item">🗑️</button>
            `;

            const checkbox = row.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
              pushHistory();
              item.purchased = checkbox.checked;
              saveState();
              renderItems();
            });

            const deleteBtn = row.querySelector('.delete');
            deleteBtn.addEventListener('click', () => {
              pushHistory();
              item.removed = true;
              saveState();
              renderItems();
              showToast(`Moved "${item.name}" to Removed`);
            });

            rowsEl.appendChild(row);
          });

          groupEl.appendChild(rowsEl);
          listGroups.appendChild(groupEl);
        }
      }
    }

    // Removed Items
    if (removedGroups) {
      removedGroups.innerHTML = '';
      if (removedList.length === 0) {
        removedGroups.innerHTML = '<div class="empty">No removed items.</div>';
      } else {
        const rowsEl = document.createElement('div');
        rowsEl.className = 'rows';

        removedList.forEach(item => {
          const row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = `
            <div class="row-info">
              <span class="row-name">${item.name}</span>
              <span class="row-meta">${item.quantity} ${item.unit} • ${item.category}</span>
            </div>
            <button type="button" class="row-action restore" title="Restore item">↩ Restore</button>
            <button type="button" class="row-action delete" title="Delete permanently">❌</button>
          `;

          const restoreBtn = row.querySelector('.restore');
          restoreBtn.addEventListener('click', () => {
            pushHistory();
            item.removed = false;
            saveState();
            renderItems();
            showToast(`Restored "${item.name}"`);
          });

          const deleteBtn = row.querySelector('.delete');
          deleteBtn.addEventListener('click', () => {
            pushHistory();
            const idx = items.indexOf(item);
            if (idx !== -1) items.splice(idx, 1);
            saveState();
            renderItems();
            showToast(`Permanently deleted "${item.name}"`);
          });

          rowsEl.appendChild(row);
        });

        removedGroups.appendChild(rowsEl);
      }
    }
  }

  // Live Auto-Detection on Item Typing
  if (itemName) {
    itemName.addEventListener('input', () => {
      const detected = suggestCategory(itemName.value);
      selectedCategory = detected;
      if (categoryInput) categoryInput.value = detected;
      renderQuickCategories();
    });
  }

  // Live Syncing when typing Category manually
  if (categoryInput) {
    categoryInput.addEventListener('input', () => {
      selectedCategory = categoryInput.value;
      renderQuickCategories();
    });
  }

  // Handle Form Submission
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = itemName.value.trim();
      if (!name) return;

      const category = categoryInput.value.trim() || '📦 Other';
      const quantity = parseInt(quantityInput.value, 10) || 1;
      const unit = unitInput.value || 'pcs';

      pushHistory();

      if (category && !BUILT_IN_CATEGORIES[category] && !state.customChips.includes(category)) {
        state.customChips.push(category);
      }

      state.learned[name.toLowerCase()] = category;

      activeItems().push({
        id: uid(),
        name,
        category,
        quantity,
        unit,
        purchased: false,
        removed: false
      });

      saveState();

      itemName.value = '';
      categoryInput.value = '';
      selectedCategory = '';
      quantityInput.value = '1';

      renderAll();
      showToast(`Added "${name}" to ${state.activeList}`);
      switchTab('list');
    });
  }

  // Add Custom Category Chip
  if (addChipBtn) {
    addChipBtn.addEventListener('click', () => {
      const val = customChipInput.value.trim();
      if (val && !state.customChips.includes(val) && !BUILT_IN_CATEGORIES[val]) {
        pushHistory();
        state.customChips.push(val);
        customChipInput.value = '';
        saveState();
        renderQuickCategories();
        showToast(`Added category chip "${val}"`);
      }
    });
  }

  // Navigation Event Listeners
  if (tabList) tabList.addEventListener('click', () => switchTab('list'));
  if (toggleAddBtn) toggleAddBtn.addEventListener('click', () => switchTab('add'));
  if (tabRemoved) tabRemoved.addEventListener('click', () => switchTab('removed'));
  if (searchInput) searchInput.addEventListener('input', renderItems);

  // Initialization
  function init() {
    state = loadState();

    if (db) {
      try {
        db.ref('groceryState').on('value', (snapshot) => {
          const remoteData = snapshot.val();
          if (remoteData) {
            isRemoteSync = true;
            state = remoteData;
            safeSet(localStorage, 'grocery.state', JSON.stringify(state));
            renderAll();
            isRemoteSync = false;
          }
        });
      } catch (e) {}
    }

    renderAll();
  }

  const savedUser = safeGet(localStorage, AUTH_KEY);
  if (savedUser === CREDENTIALS.username) {
    currentUser = savedUser;
    if (usernameDisplay) usernameDisplay.textContent = savedUser;
    showApp();
    init();
  } else {
    showLogin();
  }
})();
