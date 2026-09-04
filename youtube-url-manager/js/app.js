/* ============================================================
app.js — Главный координатор приложения
YouTube URL Manager
============================================================ */
const App = (() => {
  const VERSION = '1.0.2-dev';
  const VERSION_INFO = {
    app: VERSION,
    storage: '1.0.0',
    youtube: '1.0.0'
  };

  function init() {
    // Обновляем отображение версии
    const versionSpan = document.getElementById('version-display');
    if (versionSpan) {
      const versionsStr = Object.entries(VERSION_INFO)
        .map(([module, ver]) => `${module}:${ver}`)
        .join(', ');
      versionSpan.textContent = versionsStr;
    }

    // Привязываем обработчики
    Sidebar.bind();
    Table.bindSort();
    Details.bind();
    Details.bindResize();
    Details.bindZoom();
    ContextMenu.bind();
    bindToolbarMenus();
    bindSearch();
    bindKeyboard();
    bindTableClickDeselect();

    // Первоначальный рендер
    Sidebar.render();
    renderView();
    setStatus('Готово');
  }

  function bindToolbarMenus() {
    dropdownToggle('menuFilterBtn', 'menuFilter');
    dropdownToggle('menuIoBtn', 'menuIo');
    dropdownToggle('menuSortBtn', 'menuSort');

    document.addEventListener('click', e => {
      if (!e.target.closest('.tb-dropdown')) {
        closeAllMenus();
      }
    });

    // Управление
    const addLinkBtn = document.getElementById('menuAddLinkBtn');
    if (addLinkBtn) {
      addLinkBtn.addEventListener('click', () => {
        closeAllMenus();
        Modal.showAddLinkModal();
      });
    }

    const addGroupBtn = document.getElementById('menuAddGroupBtn');
    if (addGroupBtn) {
      addGroupBtn.addEventListener('click', () => {
        closeAllMenus();
        Modal.showGroupModal();
      });
    }

    const deleteBtn = document.getElementById('menuDeleteSelected');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        closeAllMenus();
        deleteSelected();
      });
    }

    const refreshBtn = document.getElementById('menuRefreshMeta');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        closeAllMenus();
        ContextMenu.refreshAllMeta();
      });
    }

    const historyBtn = document.getElementById('menuHistory');
    if (historyBtn) {
      historyBtn.addEventListener('click', () => {
        closeAllMenus();
        const selectedLinkId = Details.getSelectedLinkId();
        Modal.showHistoryModal(selectedLinkId);
      });
    }

    const settingsBtn = document.getElementById('menuSettings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        closeAllMenus();
        Modal.showSettingsModal();
      });
    }

    // Фильтр — статусы
    document.querySelectorAll('#menuFilter .tb-dropdown__item[data-filter]').forEach(item => {
      item.addEventListener('click', () => {
        closeAllMenus();
        Sidebar.setCurrentFilter(item.dataset.filter);
        Sidebar.setCurrentGroupId('');
        Sidebar._syncFilterMenu();
        Sidebar.render();
        renderView();
      });
    });

    // Переключение вида
    const viewRowsBtn = document.getElementById('viewRowsBtn');
    if (viewRowsBtn) {
      viewRowsBtn.addEventListener('click', () => {
        if (Table.getViewMode() === 'rows') return;
        Table.setViewMode('rows');
        syncViewButtons();
        renderView();
      });
    }

    const viewMosaicBtn = document.getElementById('viewMosaicBtn');
    if (viewMosaicBtn) {
      viewMosaicBtn.addEventListener('click', () => {
        if (Table.getViewMode() === 'mosaic') return;
        Table.setViewMode('mosaic');
        syncViewButtons();
        renderView();
      });
    }

    // Импорт / Экспорт
    document.querySelectorAll('#menuIo .tb-dropdown__item[data-export]').forEach(item => {
      item.addEventListener('click', () => {
        closeAllMenus();
        Export.handleExport(item.dataset.export);
      });
    });

    const importJsonBtn = document.getElementById('menuImportJson');
    if (importJsonBtn) {
      importJsonBtn.addEventListener('click', () => {
        closeAllMenus();
        Import.setMode('json-file');
        document.getElementById('fileInput').click();
      });
    }

    const importBookmarksBtn = document.getElementById('menuImportBookmarks');
    if (importBookmarksBtn) {
      importBookmarksBtn.addEventListener('click', () => {
        closeAllMenus();
        Import.setMode('bookmarks-file');
        document.getElementById('fileInput').click();
      });
    }

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', Import.handleFileImport);
    }
  }

  function syncViewButtons() {
    const rowsBtn = document.getElementById('viewRowsBtn');
    const mosaicBtn = document.getElementById('viewMosaicBtn');
    
    if (rowsBtn) rowsBtn.classList.toggle('active', Table.getViewMode() === 'rows');
    if (mosaicBtn) mosaicBtn.classList.toggle('active', Table.getViewMode() === 'mosaic');
  }

  function dropdownToggle(btnId, menuId) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);

    if (!btn || !menu) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();

      const isOpen = menu.classList.contains('open');
      closeAllMenus();

      if (!isOpen) {
        menu.classList.add('open');
        btn.classList.add('open');
      }
    });
  }

  function closeAllMenus() {
    document.querySelectorAll('.tb-dropdown__menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('open'));
  }

  function bindSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');

    if (!input || !clearBtn) return;

    input.addEventListener('input', e => {
      Table.setSearchQuery(e.target.value.trim().toLowerCase());
      renderView();

      if (e.target.value.trim() !== '') {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      Table.setSearchQuery('');
      renderView();
      clearBtn.classList.add('hidden');
    });
  }

  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Escape') {
        Details.selectLink('');
        const ctxMenu = document.getElementById('ctxMenu');
        if (ctxMenu) ctxMenu.classList.remove('open');
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        navigateUp();
      }
    });
  }

  function bindTableClickDeselect() {
    const tableBody = document.getElementById('tableBody');
    const mosaicView = document.getElementById('mosaicView');

    if (tableBody) {
      tableBody.addEventListener('click', e => {
        const row = e.target.closest('.trow');
        if (!row) Details.selectLink('');
      });
    }

    if (mosaicView) {
      mosaicView.addEventListener('click', e => {
        const card = e.target.closest('.mosaic-card');
        if (!card) Details.selectLink('');
      });
    }
  }

  function navigateUp() {
    const currentGroupId = Sidebar.getCurrentGroupId();
    if (!currentGroupId) return;

    const g = Storage.getGroupById(currentGroupId);
    Sidebar.setCurrentGroupId(g ? g.parentId || '' : '');
    Details.selectLink('');
    Sidebar.render();
    renderView();
  }

  function deleteSelected() {
    const selectedLinkId = Details.getSelectedLinkId();
    
    if (!selectedLinkId) {
      Toast.show('Ничего не выбрано', 'error');
      return;
    }

    if (confirm('Удалить это видео?')) {
      Storage.deleteLink(selectedLinkId);
      Details.selectLink('');
      renderView();
      Sidebar.render();
      Toast.show('Удалено', 'info');
    }
  }

  function renderView() {
    const viewMode = Table.getViewMode();
    const wrapper = document.getElementById('tableWrapper');
    const mosaic = document.getElementById('mosaicView');

    if (viewMode === 'mosaic') {
      if (wrapper) wrapper.classList.add('hidden');
      if (mosaic) mosaic.classList.remove('hidden');
      Mosaic.render();
    } else {
      if (wrapper) wrapper.classList.remove('hidden');
      if (mosaic) mosaic.classList.add('hidden');
      Table.render();
    }
  }

  function setStatus(t) {
    const el = document.getElementById('statusText');
    if (el) el.textContent = t;
  }

  function refreshAll() {
    Sidebar.render();
    renderView();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    init,
    refreshAll
  };
})();
