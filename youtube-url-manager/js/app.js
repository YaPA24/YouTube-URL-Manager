/* ============================================================
 *  app.js — YouTube URL Manager — Firefox Library Style
 *  File-explorer layout: breadcrumb + table/mosaic + right details
 * ============================================================ */

const App = (() => {
  /* ---------- State ---------- */
  let currentFilter = 'all';
  let currentGroupId = '';
  let searchQuery = '';
  let selectedLinkId = '';
  let sortField = '';
  let sortAsc = true;
  let viewMode = 'rows';
  let importMode = '';
  let ctxTargetId = '';
  let ctxTargetIsFolder = false;
  let _detailSaveTimer = null;

  const STATUS_LABELS = {
    queue: 'В очереди',
    later: 'Посмотреть позже',
    watching: 'Смотрю',
    watched: 'Просмотрено',
    archived: 'Архив'
  };
  const STATUS_ICONS = {
    queue: '\u25B6', later: '\u23F3', watching: '\u25CF',
    watched: '\u2713', archived: '\u2212'
  };

  /* ==================== INIT ==================== */

  function init() {
    _bindToolbarMenus();
    _bindSearch();
    _bindTableSort();
    _bindDetailsResize();
    _bindDetailsZoom();
    _bindContextMenus();
    _bindDetailsPanel();
    _bindTableClickDeselect();
    _bindKeyboard();
    _renderTable();
    _setStatus('Готово');
  }

  /* ==================== TOOLBAR MENUS ==================== */

  function _bindToolbarMenus() {
    _dropdownToggle('menuManageBtn', 'menuManage');
    _dropdownToggle('menuFilterBtn', 'menuFilter');
    _dropdownToggle('menuIoBtn', 'menuIo');

    document.addEventListener('click', e => {
      if (!e.target.closest('.tb-dropdown')) _closeAllMenus();
    });

    /* Управление */
    document.getElementById('menuAddLink').addEventListener('click', () => { _closeAllMenus(); _showAddLinkModal(); });
    document.getElementById('menuAddGroup').addEventListener('click', () => { _closeAllMenus(); _showGroupModal(); });
    document.getElementById('menuDeleteSelected').addEventListener('click', () => { _closeAllMenus(); _deleteSelected(); });
    document.getElementById('menuRefreshMeta').addEventListener('click', () => { _closeAllMenus(); _refreshAllMeta(); });
    document.getElementById('menuHistory').addEventListener('click', () => { _closeAllMenus(); _showHistoryModal(selectedLinkId); });
    document.getElementById('menuSettings').addEventListener('click', () => { _closeAllMenus(); _showSettingsModal(); });

    /* Фильтр — статусы */
    document.querySelectorAll('#menuFilter .tb-dropdown__item[data-filter]').forEach(item => {
      item.addEventListener('click', () => {
        _closeAllMenus();
        currentFilter = item.dataset.filter;
        _syncFilterMenu();
        _renderTable();
      });
    });

    /* Переключение вида — иконки в тулбаре */
    document.getElementById('viewRowsBtn').addEventListener('click', () => {
      if (viewMode === 'rows') return;
      viewMode = 'rows';
      _syncViewButtons();
      _renderTable();
    });
    document.getElementById('viewMosaicBtn').addEventListener('click', () => {
      if (viewMode === 'mosaic') return;
      viewMode = 'mosaic';
      _syncViewButtons();
      _renderTable();
    });

    /* Импорт / Экспорт */
    document.querySelectorAll('#menuIo .tb-dropdown__item[data-export]').forEach(item => {
      item.addEventListener('click', () => { _closeAllMenus(); _handleExport(item.dataset.export); });
    });
    document.getElementById('menuImportJsonMerge').addEventListener('click', () => { _closeAllMenus(); importMode = 'json-merge'; document.getElementById('fileInput').click(); });
    document.getElementById('menuImportJsonReplace').addEventListener('click', () => {
      _closeAllMenus();
      if (confirm('Внимание! Это заменит ВСЕ текущие данные данными из файла. Продолжить?')) {
        importMode = 'json-replace';
        document.getElementById('fileInput').click();
      }
    });
    document.getElementById('menuImportBookmarks').addEventListener('click', () => { _closeAllMenus(); importMode = 'bookmarks'; document.getElementById('fileInput').click(); });
    document.getElementById('fileInput').addEventListener('change', _handleFileImport);
  }

  function _syncViewButtons() {
    document.getElementById('viewRowsBtn').classList.toggle('active', viewMode === 'rows');
    document.getElementById('viewMosaicBtn').classList.toggle('active', viewMode === 'mosaic');
  }

  function _syncFilterMenu() {
    document.querySelectorAll('#menuFilter .tb-dropdown__item').forEach(i => {
      i.classList.toggle('active', i.dataset.filter === currentFilter);
    });
  }

  function _dropdownToggle(btnId, menuId) {
    document.getElementById(btnId).addEventListener('click', e => {
      e.stopPropagation();
      const menu = document.getElementById(menuId);
      const isOpen = menu.classList.contains('open');
      _closeAllMenus();
      if (!isOpen) { menu.classList.add('open'); e.currentTarget.classList.add('open'); }
    });
  }

  function _closeAllMenus() {
    document.querySelectorAll('.tb-dropdown__menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('open'));
  }

  /* ==================== SEARCH ==================== */

  function _bindSearch() {
    document.getElementById('searchInput').addEventListener('input', e => {
      searchQuery = e.target.value.trim().toLowerCase();
      _renderTable();
    });
  }

  /* ==================== TABLE SORT ==================== */

  function _bindTableSort() {
    document.querySelectorAll('.th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (sortField === field) { sortAsc = !sortAsc; } else { sortField = field; sortAsc = true; }
        document.querySelectorAll('.th[data-sort]').forEach(h => {
          h.classList.remove('sorted', 'sorted-desc');
          const arrow = h.querySelector('.sort-arrow');
          if (arrow) arrow.textContent = '';
        });
        th.classList.add(sortAsc ? 'sorted' : 'sorted-desc');
        th.querySelector('.sort-arrow').textContent = sortAsc ? '\u25B2' : '\u25BC';
        _renderTable();
      });
    });
  }

  /* ==================== DETAILS RESIZE ==================== */

  function _bindDetailsResize() {
    const handle = document.getElementById('resizeHandleV');
    const panel = document.getElementById('detailsPanel');
    let startX, startW;
    handle.addEventListener('mousedown', e => {
      startX = e.clientX;
      startW = panel.offsetWidth;
      handle.classList.add('dragging');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
    function onMove(e) {
      const newW = startW - (e.clientX - startX);
      panel.style.width = Math.max(200, Math.min(500, newW)) + 'px';
    }
    function onUp() {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  }

  /* ==================== DETAILS THUMBNAIL ZOOM ==================== */

  function _bindDetailsZoom() {
    const thumb = document.getElementById('detailsThumb');
    const img = document.getElementById('detailsThumbImg');

    thumb.addEventListener('mousemove', e => {
      if (!img.src || img.style.display === 'none') return;
      const rect = thumb.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
      const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
      img.style.transformOrigin = x + '% ' + y + '%';
      img.style.transform = 'scale(2.5)';
    });

    thumb.addEventListener('mouseleave', () => {
      img.style.transform = '';
    });
  }

  /* ==================== KEYBOARD ==================== */

  function _bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Escape') {
        _selectLink('');
        document.getElementById('ctxMenu').classList.remove('open');
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        _navigateUp();
      }
    });
  }

  /* ==================== TABLE CLICK / DESELECT ==================== */

  function _bindTableClickDeselect() {
    document.getElementById('tableBody').addEventListener('click', e => {
      const row = e.target.closest('.trow');
      if (!row) _selectLink('');
    });
    document.getElementById('mosaicView').addEventListener('click', e => {
      const card = e.target.closest('.mosaic-card');
      if (!card) _selectLink('');
    });
  }

  /* ==================== CONTEXT MENU ==================== */

  function _bindContextMenus() {
    const ctxMenu = document.getElementById('ctxMenu');
    const moveBtn = document.getElementById('ctxMoveToFolder');
    const moveSub = document.getElementById('ctxMoveSubmenu');
    const linkSection = ctxMenu.querySelector('.ctx-link-section');
    const folderSection = ctxMenu.querySelector('.ctx-folder-section');

    /* Правый клик на строках таблицы */
    document.getElementById('tableBody').addEventListener('contextmenu', e => {
      const folderRow = e.target.closest('.trow--folder');
      const linkRow = folderRow ? null : e.target.closest('.trow');
      if (folderRow) {
        e.preventDefault();
        ctxTargetId = folderRow.dataset.folderId;
        ctxTargetIsFolder = true;
        _showCtxMenu(e.clientX, e.clientY, true);
      } else if (linkRow) {
        e.preventDefault();
        ctxTargetId = linkRow.dataset.id;
        ctxTargetIsFolder = false;
        _selectLink(ctxTargetId);
        _showCtxMenu(e.clientX, e.clientY, false);
      }
    });

    /* Правый клик на карточках мозаики */
    document.getElementById('mosaicView').addEventListener('contextmenu', e => {
      const folderCard = e.target.closest('.mosaic-card--folder');
      const videoCard = folderCard ? null : e.target.closest('.mosaic-card:not(.mosaic-card--parent)');
      if (folderCard) {
        e.preventDefault();
        ctxTargetId = folderCard.dataset.folderId;
        ctxTargetIsFolder = true;
        _showCtxMenu(e.clientX, e.clientY, true);
      } else if (videoCard) {
        e.preventDefault();
        ctxTargetId = videoCard.dataset.id;
        ctxTargetIsFolder = false;
        _selectLink(ctxTargetId);
        _showCtxMenu(e.clientX, e.clientY, false);
      }
    });

    function _showCtxMenu(x, y, isFolder) {
      linkSection.classList.toggle('hidden', isFolder);
      folderSection.classList.toggle('hidden', !isFolder);
      if (!isFolder) _populateMoveSubmenu();
      moveSub.classList.remove('open');
      ctxMenu.classList.add('open');
      requestAnimationFrame(() => {
        const rect = ctxMenu.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 4;
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 4;
        if (x < 0) x = 4;
        if (y < 0) y = 4;
        ctxMenu.style.left = x + 'px';
        ctxMenu.style.top = y + 'px';
      });
    }

    /* Закрытие */
    document.addEventListener('click', e => {
      if (!e.target.closest('.ctx-menu')) ctxMenu.classList.remove('open');
    });
    document.addEventListener('contextmenu', e => {
      if (!e.target.closest('.trow') && !e.target.closest('.mosaic-card')) {
        ctxMenu.classList.remove('open');
      }
    });

    /* Подменю папок — показ при наведении */
    moveBtn.addEventListener('mouseenter', () => {
      if (moveSub.children.length > 0) moveSub.classList.add('open');
    });
    moveBtn.addEventListener('mouseleave', () => moveSub.classList.remove('open'));
    moveSub.addEventListener('mouseenter', () => moveSub.classList.add('open'));
    moveSub.addEventListener('mouseleave', () => moveSub.classList.remove('open'));

    /* Действия контекстного меню — ссылки */
    ctxMenu.querySelectorAll('.ctx-link-section .ctx-menu__item[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        ctxMenu.classList.remove('open');
        const action = btn.dataset.action;
        const id = ctxTargetId;
        if (!id || ctxTargetIsFolder) return;
        const link = Storage.getLinkById(id);
        if (!link) return;
        switch (action) {
          case 'open':
            window.open(YouTube.getVideoUrl(link.youtubeId), '_blank');
            break;
          case 'refresh':
            _doRefreshMeta(id);
            break;
          case 'copy-url':
            navigator.clipboard.writeText(link.url).then(() => _toast('URL скопирован', 'success'));
            break;
          case 'copy-title':
            navigator.clipboard.writeText(link.title || '').then(() => _toast('Название скопировано', 'success'));
            break;
          case 'history':
            _showHistoryModal(id);
            break;
          case 'delete':
            if (confirm('Удалить это видео?')) {
              Storage.deleteLink(id);
              if (selectedLinkId === id) _selectLink('');
              _renderTable();
              _toast('Удалено', 'info');
            }
            break;
        }
      });
    });

    /* Действия контекстного меню — папки */
    ctxMenu.querySelectorAll('.ctx-folder-section .ctx-menu__item[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        ctxMenu.classList.remove('open');
        const action = btn.dataset.action;
        const id = ctxTargetId;
        if (!id || !ctxTargetIsFolder) return;
        switch (action) {
          case 'rename-folder':
            _showGroupModal(id);
            break;
          case 'delete-folder':
            if (confirm('Удалить папку и всё вложенное?')) {
              const grp = Storage.getGroupById(id);
              const parentId = grp ? grp.parentId : '';
              Storage.deleteGroup(id);
              if (currentGroupId === id) {
                currentGroupId = parentId || '';
                selectedLinkId = '';
                _hideDetails();
              }
              _renderTable();
              _toast('Папка удалена', 'info');
            }
            break;
        }
      });
    });
  }

  /** Заполнить подменю папок для контекстного меню */
  function _populateMoveSubmenu() {
    const sub = document.getElementById('ctxMoveSubmenu');
    const link = Storage.getLinkById(ctxTargetId);
    const currentGroupIdLink = link ? link.groupId : '';
    const groups = Storage.getGroups();

    let html = '';
    const noGroupSel = currentGroupIdLink === '' ? ' class="ctx-menu__item active"' : ' class="ctx-menu__item"';
    html += '<button' + noGroupSel + ' data-move-group="">— Без группы —</button>';

    const addGroups = (pid, indent) => {
      groups.filter(g => g.parentId === pid).forEach(g => {
        const isCurrent = g.id === currentGroupIdLink;
        const cls = isCurrent ? ' class="ctx-menu__item active"' : ' class="ctx-menu__item"';
        const prefix = '\u00A0\u00A0'.repeat(indent);
        html += '<button' + cls + ' data-move-group="' + g.id + '">' + prefix + _escHtml(g.title) + '</button>';
        addGroups(g.id, indent + 1);
      });
    };
    addGroups('', 0);
    sub.innerHTML = html;

    sub.querySelectorAll('[data-move-group]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const groupId = btn.dataset.moveGroup;
        const id = ctxTargetId;
        if (!id) return;
        Storage.updateLink(id, { groupId: groupId });
        document.getElementById('ctxMenu').classList.remove('open');
        _renderTable();
        if (selectedLinkId === id) _showDetails(id);
        const groupName = groupId ? (Storage.getGroupById(groupId) || {}).title || groupId : 'без группы';
        _toast('Перемещено в: ' + groupName, 'success');
      });
    });
  }

  /* ==================== BREADCRUMB ==================== */

  function _updateBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    if (!currentGroupId) {
      bc.innerHTML = '<span class="bc-current">Все видео</span>';
      return;
    }
    const path = [];
    let gid = currentGroupId;
    while (gid) {
      const g = Storage.getGroupById(gid);
      if (!g) break;
      path.unshift(g);
      gid = g.parentId;
    }
    let html = '<span class="bc-item" data-gid="">Все видео</span>';
    path.forEach((g, i) => {
      html += '<span class="bc-sep">\u203A</span>';
      if (i === path.length - 1) {
        html += '<span class="bc-current">' + _escHtml(g.title) + '</span>';
      } else {
        html += '<span class="bc-item" data-gid="' + g.id + '">' + _escHtml(g.title) + '</span>';
      }
    });
    bc.innerHTML = html;
    bc.querySelectorAll('.bc-item').forEach(item => {
      item.addEventListener('click', () => {
        currentGroupId = item.dataset.gid;
        selectedLinkId = '';
        _hideDetails();
        _renderTable();
      });
    });
  }

  /* ==================== NAVIGATION ==================== */

  function _navigateTo(groupId) {
    currentGroupId = groupId;
    selectedLinkId = '';
    _hideDetails();
    _renderTable();
  }

  function _navigateUp() {
    if (!currentGroupId) return;
    const g = Storage.getGroupById(currentGroupId);
    currentGroupId = g ? g.parentId || '' : '';
    selectedLinkId = '';
    _hideDetails();
    _renderTable();
  }

  /* ==================== DATA HELPERS ==================== */

  function _getFilteredLinks() {
    let links = Storage.getLinks();
    if (currentGroupId) {
      const ids = _getGroupAndDescendantIds(currentGroupId);
      links = links.filter(l => ids.includes(l.groupId));
    }
    if (currentFilter !== 'all') {
      links = links.filter(l => l.status === currentFilter);
    }
    if (searchQuery) {
      links = links.filter(l => {
        const h = [l.title, l.channelTitle, l.url, l.status, l.notes, l.youtubeId].concat(l.tags || []).filter(Boolean).join(' ').toLowerCase();
        return h.includes(searchQuery);
      });
    }
    if (sortField) {
      links.sort((a, b) => {
        let va, vb;
        if (sortField === 'durationSeconds') { va = a.durationSeconds || 0; vb = b.durationSeconds || 0; }
        else if (sortField === 'publishedAt') { va = a.publishedAt || ''; vb = b.publishedAt || ''; }
        else if (sortField === 'channelTitle') { va = (a.channelTitle || '').toLowerCase(); vb = (b.channelTitle || '').toLowerCase(); }
        else { va = (a[sortField] || '').toLowerCase(); vb = (b[sortField] || '').toLowerCase(); }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortAsc ? cmp : -cmp;
      });
    } else {
      links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return links;
  }

  function _getChildGroups() {
    return Storage.getGroups().filter(g => g.parentId === currentGroupId).sort((a, b) => a.title.localeCompare(b.title));
  }

  function _getGroupAndDescendantIds(gid) {
    const groups = Storage.getGroups();
    const ids = [gid];
    const c = pid => { groups.filter(g => g.parentId === pid).forEach(g => { ids.push(g.id); c(g.id); }); };
    c(gid); return ids;
  }

  function _countLinksInGroup(groupId) {
    const ids = _getGroupAndDescendantIds(groupId);
    return Storage.getLinks().filter(l => ids.includes(l.groupId)).length;
  }

  /* ==================== RENDER ==================== */

  function _renderTable() {
    _updateBreadcrumb();

    const links = _getFilteredLinks();
    const childGroups = _getChildGroups();
    const body = document.getElementById('tableBody');
    const empty = document.getElementById('tableEmpty');
    const mosaic = document.getElementById('mosaicView');
    const mosaicEmpty = document.getElementById('mosaicEmpty');
    const wrapper = document.getElementById('tableWrapper');

    if (viewMode === 'mosaic') {
      wrapper.classList.add('hidden');
      mosaic.classList.remove('hidden');

      let html = '';
      if (currentGroupId) html += _renderMosaicParentCard();
      childGroups.forEach(g => { html += _renderMosaicFolderCard(g); });
      links.forEach(l => { html += _renderMosaicCard(l); });

      if (!html.trim()) {
        mosaic.innerHTML = '';
        mosaicEmpty.classList.remove('hidden');
        _setStatus(searchQuery || currentFilter !== 'all' ? 'Ничего не найдено' : 'Пусто');
        return;
      }

      mosaicEmpty.classList.add('hidden');
      mosaic.innerHTML = html;
      _setStatus(links.length + ' видео');

      /* Привязка событий */
      const parentCard = mosaic.querySelector('.mosaic-card--parent');
      if (parentCard) parentCard.addEventListener('click', () => _navigateUp());

      mosaic.querySelectorAll('.mosaic-card--folder').forEach(card => {
        card.addEventListener('click', () => _navigateTo(card.dataset.folderId));
      });

      mosaic.querySelectorAll('.mosaic-card:not(.mosaic-card--folder):not(.mosaic-card--parent)').forEach(card => {
        card.addEventListener('click', e => {
          if (e.target.closest('a')) return;
          _selectLink(card.dataset.id);
        });
        card.addEventListener('dblclick', () => {
          const l = Storage.getLinkById(card.dataset.id);
          if (l) window.open(YouTube.getVideoUrl(l.youtubeId), '_blank');
        });
      });

      if (selectedLinkId) {
        const sel = mosaic.querySelector('.mosaic-card[data-id="' + selectedLinkId + '"]');
        if (sel) sel.classList.add('selected');
      }

    } else {
      /* Строки */
      wrapper.classList.remove('hidden');
      mosaic.classList.add('hidden');
      mosaicEmpty.classList.add('hidden');

      let html = '';
      childGroups.forEach(g => { html += _renderFolderRow(g); });
      links.forEach(l => { html += _renderRow(l); });

      if (!html.trim()) {
        body.innerHTML = '';
        empty.classList.remove('hidden');
        _setStatus(searchQuery || currentFilter !== 'all' ? 'Ничего не найдено' : 'Пусто');
        return;
      }

      empty.classList.add('hidden');
      body.innerHTML = html;
      _setStatus(links.length + ' видео');

      body.querySelectorAll('.trow--folder').forEach(row => {
        row.addEventListener('click', () => _navigateTo(row.dataset.folderId));
      });

      body.querySelectorAll('.trow:not(.trow--folder)').forEach(row => {
        row.addEventListener('click', e => {
          if (e.target.closest('a')) return;
          _selectLink(row.dataset.id);
        });
        row.addEventListener('dblclick', () => {
          const l = Storage.getLinkById(row.dataset.id);
          if (l) window.open(YouTube.getVideoUrl(l.youtubeId), '_blank');
        });
      });

      if (selectedLinkId) {
        const sel = body.querySelector('.trow[data-id="' + selectedLinkId + '"]');
        if (sel) sel.classList.add('selected');
      }
    }
  }

  /* ---- Row ---- */

  function _renderRow(link) {
    const thumb = link.thumbnailUrl || YouTube.getThumbnailUrl(link.youtubeId);
    const title = link.title || 'Без названия';
    const channel = link.channelTitle || '';
    const duration = link.duration || '';
    const published = link.publishedAt ? _formatDate(link.publishedAt) : '';
    const sel = link.id === selectedLinkId ? ' selected' : '';

    let html = '<div class="trow' + sel + '" data-id="' + link.id + '">';
    html += '<div class="tcell tcell--icon"><img src="' + _escAttr(thumb) + '" onerror="this.style.display=\'none\'" alt=""></div>';
    html += '<div class="tcell tcell--name">' + _escHtml(title) + '</div>';
    html += '<div class="tcell tcell--channel">' + _escHtml(channel) + '</div>';
    html += '<div class="tcell tcell--duration">' + _escHtml(duration) + '</div>';
    html += '<div class="tcell tcell--published">' + _escHtml(published) + '</div>';
    html += '<div class="tcell tcell--url">' + _escHtml(link.url || '') + '</div>';
    html += '</div>';
    return html;
  }

  /* ---- Folder Row ---- */

  function _renderFolderRow(group) {
    const count = _countLinksInGroup(group.id);
    let html = '<div class="trow trow--folder" data-folder-id="' + group.id + '">';
    html += '<div class="tcell tcell--icon"><span class="folder-icon">\uD83D\uDCC1</span></div>';
    html += '<div class="tcell tcell--name">' + _escHtml(group.title) + '</div>';
    html += '<div class="tcell tcell--channel"><span class="folder-count">' + count + ' видео</span></div>';
    html += '<div class="tcell tcell--duration"></div>';
    html += '<div class="tcell tcell--published"></div>';
    html += '<div class="tcell tcell--url"></div>';
    html += '</div>';
    return html;
  }

  /* ---- Mosaic Card ---- */

  function _renderMosaicCard(link) {
    const thumb = link.thumbnailUrl || YouTube.getThumbnailUrl(link.youtubeId);
    const title = link.title || 'Без названия';
    const channel = link.channelTitle || '';
    const duration = link.duration || '';
    const published = link.publishedAt ? _formatDate(link.publishedAt) : '';
    const sel = link.id === selectedLinkId ? ' selected' : '';

    let html = '<div class="mosaic-card' + sel + '" data-id="' + link.id + '">';
    html += '<div class="mosaic-card__thumb">';
    html += '<img src="' + _escAttr(thumb) + '" alt="" loading="lazy">';
    if (duration) html += '<span class="mosaic-card__duration">' + _escHtml(duration) + '</span>';
    html += '</div>';
    html += '<div class="mosaic-card__body">';
    html += '<div class="mosaic-card__title">' + _escHtml(title) + '</div>';
    if (channel) html += '<div class="mosaic-card__channel">' + _escHtml(channel) + '</div>';
    html += '<div class="mosaic-card__meta">';
    if (published) html += '<span class="mosaic-card__date">' + _escHtml(published) + '</span>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  /* ---- Mosaic Folder Card ---- */

  function _renderMosaicFolderCard(group) {
    const count = _countLinksInGroup(group.id);
    let html = '<div class="mosaic-card mosaic-card--folder" data-folder-id="' + group.id + '">';
    html += '<div class="mosaic-card__folder-icon">\uD83D\uDCC1</div>';
    html += '<div class="mosaic-card__body">';
    html += '<div class="mosaic-card__title">' + _escHtml(group.title) + '</div>';
    html += '<div class="mosaic-card__count">' + count + ' видео</div>';
    html += '</div></div>';
    return html;
  }

  /* ---- Mosaic Parent Card ---- */

  function _renderMosaicParentCard() {
    const current = Storage.getGroupById(currentGroupId);
    const parentTitle = current && current.parentId ? (Storage.getGroupById(current.parentId) || {}).title || '' : '';
    let html = '<div class="mosaic-card mosaic-card--parent">';
    html += '<div class="mosaic-card__parent-icon">\u22EF</div>';
    html += '<div class="mosaic-card__body">';
    html += '<div class="mosaic-card__title">Назад</div>';
    if (parentTitle) html += '<div class="mosaic-card__count">' + _escHtml(parentTitle) + '</div>';
    html += '</div></div>';
    return html;
  }

  /* ==================== SELECTION & DETAILS ==================== */

  function _selectLink(id) {
    document.querySelectorAll('.trow.selected').forEach(r => r.classList.remove('selected'));
    document.querySelectorAll('.mosaic-card.selected').forEach(c => c.classList.remove('selected'));

    if (!id) {
      selectedLinkId = '';
      _hideDetails();
      return;
    }

    selectedLinkId = id;
    const row = document.querySelector('.trow[data-id="' + id + '"]');
    if (row) row.classList.add('selected');
    const card = document.querySelector('.mosaic-card[data-id="' + id + '"]');
    if (card) card.classList.add('selected');
    _showDetails(id);
  }

  function _showDetails(id) {
    const link = Storage.getLinkById(id);
    if (!link) { _hideDetails(); return; }

    const panel = document.getElementById('detailsPanel');
    const handle = document.getElementById('resizeHandleV');
    const thumb = link.thumbnailUrl || YouTube.getThumbnailUrl(link.youtubeId);

    const img = document.getElementById('detailsThumbImg');
    img.src = thumb; img.style.display = ''; img.style.transform = '';
    img.onerror = function() { this.style.display = 'none'; };

    document.getElementById('detailName').value = link.title || '';
    document.getElementById('detailUrl').value = link.url || '';
    document.getElementById('detailChannel').value = link.channelTitle || '';
    document.getElementById('detailDuration').value = link.duration || '';
    document.getElementById('detailPublished').value = link.publishedAt ? _formatDate(link.publishedAt) : '';
    document.getElementById('detailNotes').value = link.notes || '';
    document.getElementById('detailTags').value = (link.tags || []).join(', ');

    document.getElementById('detailStatus').innerHTML = Object.entries(STATUS_LABELS).map(([k, v]) =>
      '<option value="' + k + '"' + (k === link.status ? ' selected' : '') + '>' + _escHtml(v) + '</option>'
    ).join('');

    document.getElementById('detailGroup').innerHTML = _buildGroupOptions(link.groupId);

    panel.classList.add('visible');
    handle.classList.remove('hidden');
  }

  function _hideDetails() {
    document.getElementById('detailsPanel').classList.remove('visible');
    document.getElementById('resizeHandleV').classList.add('hidden');
  }

  /* ==================== DETAILS PANEL — делегированные слушатели ==================== */

  function _bindDetailsPanel() {
    function saveField(fieldName, getter) {
      if (!selectedLinkId) return;
      const link = Storage.getLinkById(selectedLinkId);
      if (!link) return;
      const val = getter();
      const updates = {};
      updates[fieldName] = val;
      if (fieldName === 'title') updates.manualTitle = val !== '';
      Storage.updateLink(selectedLinkId, updates);
      _updateItemInList(selectedLinkId);
    }

    document.getElementById('detailName').addEventListener('change', function() {
      saveField('title', () => this.value.trim());
    });
    document.getElementById('detailName').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
    });

    document.getElementById('detailStatus').addEventListener('change', function() {
      saveField('status', () => this.value);
    });

    document.getElementById('detailGroup').addEventListener('change', function() {
      saveField('groupId', () => this.value);
    });

    document.getElementById('detailTags').addEventListener('change', function() {
      const raw = this.value.trim();
      const tags = raw ? raw.split(',').map(t => t.trim()).filter(Boolean) : [];
      saveField('tags', () => tags);
    });

    document.getElementById('detailNotes').addEventListener('change', function() {
      saveField('notes', () => this.value.trim());
    });
  }

  /** Обновить один элемент в списке (без полного перерендера) */
  function _updateItemInList(id) {
    const link = Storage.getLinkById(id);
    if (!link) return;

    if (viewMode === 'mosaic') {
      const existing = document.querySelector('.mosaic-card[data-id="' + id + '"]');
      if (!existing) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = _renderMosaicCard(link);
      const newCard = tmp.firstElementChild;
      newCard.classList.add('selected');
      newCard.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        _selectLink(newCard.dataset.id);
      });
      newCard.addEventListener('dblclick', () => {
        window.open(YouTube.getVideoUrl(link.youtubeId), '_blank');
      });
      existing.replaceWith(newCard);
    } else {
      const existingRow = document.querySelector('.trow[data-id="' + id + '"]');
      if (!existingRow) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = _renderRow(link);
      const newRow = tmp.firstElementChild;
      newRow.classList.add('selected');
      newRow.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        _selectLink(newRow.dataset.id);
      });
      newRow.addEventListener('dblclick', () => {
        window.open(YouTube.getVideoUrl(link.youtubeId), '_blank');
      });
      existingRow.replaceWith(newRow);
    }
  }

  /* ==================== ACTIONS ==================== */

  function _deleteSelected() {
    if (!selectedLinkId) { _toast('Ничего не выбрано', 'error'); return; }
    if (confirm('Удалить это видео?')) {
      Storage.deleteLink(selectedLinkId);
      selectedLinkId = '';
      _hideDetails();
      _renderTable();
      _toast('Удалено', 'info');
    }
  }

  async function _refreshAllMeta() {
    const links = Storage.getLinks();
    if (links.length === 0) { _toast('Нет видео для обновления', 'info'); return; }
    _toast('Обновляю все метаданные...', 'info');
    let updated = 0;
    for (const link of links) {
      try {
        const meta = await YouTube.fetchMetadata(link.youtubeId, Storage.getApiKey());
        if (link.manualTitle && meta.title) delete meta.title;
        Storage.updateLinkMetadata(link.id, meta);
        if (selectedLinkId === link.id) _showDetails(link.id);
        _updateItemInList(link.id);
        updated++;
      } catch (err) { /* продолжаем */ }
      await new Promise(r => setTimeout(r, 350));
    }
    _toast('Обновлено: ' + updated + ' / ' + links.length, 'success');
  }

  async function _doRefreshMeta(id) {
    const link = Storage.getLinkById(id);
    if (!link) return;
    _toast('Обновляю метаданные...', 'info');
    try {
      const meta = await YouTube.fetchMetadata(link.youtubeId, Storage.getApiKey());
      if (link.manualTitle && meta.title) delete meta.title;
      Storage.updateLinkMetadata(id, meta);
      if (selectedLinkId === id) _showDetails(id);
      _renderTable();
      _toast('Метаданные обновлены (' + (meta.fetchSource || 'ok') + ')', 'success');
    } catch (err) {
      _toast('Ошибка: ' + err.message, 'error');
    }
  }

  /* ==================== ADD LINK MODAL ==================== */

  function _showAddLinkModal() {
    const groupOpts = _buildGroupOptions(currentGroupId);
    const statusOpts = Object.entries(STATUS_LABELS).map(([k, v]) =>
      '<option value="' + k + '">' + _escHtml(v) + '</option>'
    ).join('');

    let html = '<div class="modal-overlay" id="addLinkModal"><div class="modal">';
    html += '<div class="modal__header"><h2>Добавить ссылку</h2><button class="modal__close" data-close>&times;</button></div>';
    html += '<div class="modal__body">';
    html += '<div class="form-group"><label>YouTube URL</label><input type="text" id="addUrl" placeholder="https://youtube.com/watch?v=..." autofocus></div>';
    html += '<div class="form-group"><label>Статус</label><select id="addStatus">' + statusOpts + '</select></div>';
    html += '<div class="form-group"><label>Группа</label><select id="addGroup">' + groupOpts + '</select></div>';
    html += '<div class="form-group"><label>Заметка</label><textarea id="addNotes" rows="2" placeholder="Необязательно..."></textarea></div>';
    html += '</div>';
    html += '<div class="modal__footer"><button class="modal-btn" data-close>Отмена</button><button class="modal-btn modal-btn--primary" id="addLinkSave">Добавить</button></div>';
    html += '</div></div>';

    document.getElementById('modals').innerHTML = html;
    const overlay = document.getElementById('addLinkModal');
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    const urlInput = document.getElementById('addUrl');
    urlInput.focus();
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') _doAddLink(overlay); });
    document.getElementById('addLinkSave').addEventListener('click', () => _doAddLink(overlay));
  }

  async function _doAddLink(overlay) {
    const url = document.getElementById('addUrl').value.trim();
    if (!url) { _toast('Введите URL', 'error'); return; }
    const videoId = YouTube.extractVideoId(url);
    if (!videoId) { _toast('Не распознан YouTube URL', 'error'); return; }
    if (Storage.getLinks().find(l => l.youtubeId === videoId)) { _toast('Уже добавлено', 'error'); return; }

    const link = Storage.addLink({
      url: url, youtubeId: videoId,
      status: document.getElementById('addStatus').value,
      groupId: document.getElementById('addGroup').value,
      notes: document.getElementById('addNotes').value.trim(),
      thumbnailUrl: YouTube.getThumbnailUrl(videoId)
    });

    overlay.remove();
    _renderTable();
    _toast('Загружаю метаданные...', 'info');

    try {
      const meta = await YouTube.fetchMetadata(videoId, Storage.getApiKey());
      if (meta.title || meta.channelTitle) {
        Storage.updateLinkMetadata(link.id, meta);
        _renderTable();
        _toast('Метаданные загружены (' + (meta.fetchSource || '') + ')', 'success');
      }
    } catch (err) { _toast('Ошибка метаданных', 'error'); }

    _selectLink(link.id);
  }

  /* ==================== GROUP MODAL ==================== */

  function _showGroupModal(editId) {
    const isEdit = !!editId;
    const group = isEdit ? Storage.getGroupById(editId) : null;
    const groups = Storage.getGroups();

    let parentOpts = '<option value="">— Без родителя —</option>';
    const _r = (pid, indent) => {
      groups.filter(g => g.parentId === pid).forEach(g => {
        if (editId && g.id === editId) return;
        const sel = (group && group.parentId === g.id) ? ' selected' : '';
        parentOpts += '<option value="' + g.id + '"' + sel + '>' + '\u00A0\u00A0'.repeat(indent) + _escHtml(g.title) + '</option>';
        _r(g.id, indent + 1);
      });
    };
    _r('', 0);

    let html = '<div class="modal-overlay" id="groupModal"><div class="modal">';
    html += '<div class="modal__header"><h2>' + (isEdit ? 'Редактировать группу' : 'Новая группа') + '</h2><button class="modal__close" data-close>&times;</button></div>';
    html += '<div class="modal__body">';
    html += '<div class="form-group"><label>Название</label><input type="text" id="grpTitle" value="' + _escAttr(group ? group.title : '') + '"></div>';
    html += '<div class="form-group"><label>Родительская группа</label><select id="grpParent">' + parentOpts + '</select></div>';
    html += '</div>';
    html += '<div class="modal__footer">';
    if (isEdit) html += '<button class="modal-btn modal-btn--danger" id="grpDelete">Удалить</button>';
    html += '<button class="modal-btn" data-close>Отмена</button>';
    html += '<button class="modal-btn modal-btn--primary" id="grpSave">' + (isEdit ? 'Сохранить' : 'Создать') + '</button>';
    html += '</div></div></div>';

    document.getElementById('modals').innerHTML = html;
    const overlay = document.getElementById('groupModal');
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('grpSave').addEventListener('click', () => {
      const title = document.getElementById('grpTitle').value.trim();
      if (!title) { _toast('Введите название', 'error'); return; }
      if (isEdit) Storage.updateGroup(editId, { title: title, parentId: document.getElementById('grpParent').value });
      else Storage.addGroup(title, document.getElementById('grpParent').value);
      overlay.remove(); _renderTable();
      _toast(isEdit ? 'Группа обновлена' : 'Группа создана', 'success');
    });

    if (isEdit) {
      document.getElementById('grpDelete').addEventListener('click', () => {
        if (confirm('Удалить группу?')) {
          const grp = Storage.getGroupById(editId);
          const parentId = grp ? grp.parentId : '';
          Storage.deleteGroup(editId);
          if (currentGroupId === editId) {
            currentGroupId = parentId || '';
            selectedLinkId = '';
            _hideDetails();
          }
          overlay.remove(); _renderTable(); _toast('Группа удалена', 'info');
        }
      });
    }
  }

  /* ==================== HISTORY MODAL ==================== */

  function _showHistoryModal(id) {
    const link = Storage.getLinkById(id);
    if (!link) { _toast('Выберите видео', 'error'); return; }
    const history = link.history || [];
    const FL = { title:'Название', channelTitle:'Канал', duration:'Длительность', publishedAt:'Дата', thumbnailUrl:'Превью', status:'Статус', groupId:'Группа', notes:'Заметки', tags:'Метки' };

    let listHtml = '';
    if (history.length === 0) {
      listHtml = '<div style="padding:20px;text-align:center;color:var(--text-muted)">История пуста</div>';
    } else {
      listHtml = '<div class="history-list">';
      history.slice().reverse().forEach(entry => {
        const time = _formatDateTime(entry.timestamp);
        let changes = '';
        Object.entries(entry.changes || {}).forEach(([field, vals]) => {
          changes += '<div class="history-item__change"><strong>' + _escHtml(FL[field] || field) + ':</strong> ' +
            _escHtml(_displayValue(field, vals.old) || '(пусто)') + ' &rarr; ' +
            _escHtml(_displayValue(field, vals.new) || '(пусто)') +
            (entry.fetchUpdate ? ' <span class="history-item__fetch-badge">fetch</span>' : '') + '</div>';
        });
        listHtml += '<div class="history-item"><div class="history-item__time">' + time + '</div>' + changes + '</div>';
      });
      listHtml += '</div>';
    }

    let html = '<div class="modal-overlay" id="historyModal"><div class="modal">';
    html += '<div class="modal__header"><h2>История: ' + _escHtml(link.title || 'Без названия') + '</h2><button class="modal__close" data-close>&times;</button></div>';
    html += '<div class="modal__body">' + listHtml + '</div>';
    html += '<div class="modal__footer"><button class="modal-btn" data-close>Закрыть</button></div>';
    html += '</div></div>';

    document.getElementById('modals').innerHTML = html;
    const overlay = document.getElementById('historyModal');
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  function _displayValue(field, value) {
    if (field === 'status' && STATUS_LABELS[value]) return STATUS_LABELS[value];
    if (field === 'groupId') { const g = Storage.getGroupById(value); return g ? g.title : ''; }
    if (field === 'tags') return Array.isArray(value) ? value.join(', ') : value;
    if (field === 'thumbnailUrl') return value ? '(обновлено)' : '';
    if (field === 'publishedAt') return _formatDate(value);
    return String(value || '');
  }

  /* ==================== SETTINGS MODAL ==================== */

  function _showSettingsModal() {
    let html = '<div class="modal-overlay" id="settingsModal"><div class="modal">';
    html += '<div class="modal__header"><h2>Настройки</h2><button class="modal__close" data-close>&times;</button></div>';
    html += '<div class="modal__body">';
    html += '<div class="form-group"><label>YouTube Data API v3 Key</label><input type="text" id="setApiKey" value="' + _escAttr(Storage.getApiKey()) + '">';
    html += '<span style="font-size:0.72rem;color:var(--text-muted);display:block;margin-top:4px">С ключом: название, канал, длительность, дата. Без ключа: название, канал, превью (oEmbed).</span></div>';
    html += '</div>';
    html += '<div class="modal__footer"><button class="modal-btn" data-close>Отмена</button><button class="modal-btn modal-btn--primary" id="setSave">Сохранить</button></div>';
    html += '</div></div>';

    document.getElementById('modals').innerHTML = html;
    const overlay = document.getElementById('settingsModal');
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('setSave').addEventListener('click', () => {
      Storage.setApiKey(document.getElementById('setApiKey').value.trim());
      overlay.remove(); _toast('Настройки сохранены', 'success');
    });
  }

  /* ==================== EXPORT ==================== */

  function _handleExport(format) {
    const data = Storage.exportAll();
    let content, filename, mime;
    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        filename = 'yt-manager-' + _dateStamp() + '.json'; mime = 'application/json'; break;
      case 'csv':
        content = _exportCSV(data);
        filename = 'yt-manager-' + _dateStamp() + '.csv'; mime = 'text/csv;charset=utf-8'; break;
      case 'markdown':
        content = _exportMarkdown(data);
        filename = 'yt-manager-' + _dateStamp() + '.md'; mime = 'text/markdown;charset=utf-8'; break;
      case 'html':
        content = _exportHTML(data);
        filename = 'yt-manager-' + _dateStamp() + '.html'; mime = 'text/html;charset=utf-8'; break;
      default: return;
    }
    _downloadFile(content, filename, mime);
    _toast('Экспорт: ' + format.toUpperCase(), 'success');
  }

  function _exportCSV(data) {
    const BOM = '\uFEFF';
    const header = 'Title,Channel,URL,Status,Group,Duration,Published,Notes\n';
    const rows = data.links.map(l => {
      const g = l.groupId ? (Storage.getGroupById(l.groupId) || {}).title || '' : '';
      return [_csvField(l.title), _csvField(l.channelTitle), _csvField(l.url),
        _csvField(STATUS_LABELS[l.status] || l.status), _csvField(g),
        _csvField(l.duration), _csvField(l.publishedAt), _csvField(l.notes)].join(',');
    }).join('\n');
    return BOM + header + rows;
  }
  function _csvField(v) { return v ? '"' + String(v).replace(/"/g, '""') + '"' : '""'; }

  function _exportMarkdown(data) {
    let md = '# YouTube URL Manager \u2014 Export\n\n_Экспортировано: ' + new Date().toLocaleString('ru-RU') + '_\n\n---\n\n';
    const grouped = {};
    data.links.forEach(l => { const k = l.status || 'queue'; if (!grouped[k]) grouped[k] = []; grouped[k].push(l); });
    Object.entries(grouped).forEach(([s, ls]) => {
      md += '## ' + (STATUS_LABELS[s] || s) + ' (' + ls.length + ')\n\n';
      ls.forEach(l => {
        md += '- **' + (l.title || 'Без названия') + '**';
        if (l.channelTitle) md += ' \u2014 ' + l.channelTitle;
        if (l.duration) md += ' (' + l.duration + ')';
        md += '\n  [' + l.url + '](' + l.url + ')';
        if (l.notes) md += ' \u2014 _' + l.notes + '_';
        md += '\n';
      }); md += '\n';
    });
    return md;
  }

  function _exportHTML(data) {
    let cards = data.links.map(l => {
      const t = l.thumbnailUrl || YouTube.getThumbnailUrl(l.youtubeId);
      const g = l.groupId ? (Storage.getGroupById(l.groupId) || {}).title || '' : '';
      return '<div style="border:1px solid #444;border-radius:6px;margin:12px;overflow:hidden;max-width:320px;display:inline-block;vertical-align:top">' +
        '<a href="' + _escAttr(l.url) + '" target="_blank"><img src="' + _escAttr(t) + '" style="width:100%;display:block" alt=""></a>' +
        '<div style="padding:8px"><strong>' + _escHtml(l.title || 'Без названия') + '</strong>' +
        (l.channelTitle ? '<br><small style="color:#888">' + _escHtml(l.channelTitle) + '</small>' : '') +
        (l.duration ? ' <small style="color:#666">(' + _escHtml(l.duration) + ')</small>' : '') +
        '<br><small style="color:#666">' + _escHtml(STATUS_LABELS[l.status] || l.status) +
        (g ? ' | ' + _escHtml(g) : '') + '</small></div></div>';
    }).join('\n');
    return '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>YT Manager</title></head>' +
      '<body style="font-family:sans-serif;max-width:900px;margin:40px auto;padding:0 20px;background:#1a1a24;color:#eee">' +
      '<h1>YouTube URL Manager</h1><p>' + new Date().toLocaleString('ru-RU') + ' \u2014 ' + data.links.length + ' видео</p><hr>' + cards + '</body></html>';
  }

  /* ==================== IMPORT ==================== */

  function _handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      const c = ev.target.result;
      if (importMode === 'json-merge') {
        const r = Storage.importJSON(c, false);
        if (r.success) _toast('JSON: +' + r.linksAdded + ' ссылок, +' + r.groupsAdded + ' групп', 'success');
        else _toast('Ошибка: ' + r.error, 'error');
      } else if (importMode === 'json-replace') {
        const r = Storage.importJSON(c, true);
        if (r.success) _toast('Восстановлено: ' + r.linksAdded + ' ссылок, ' + r.groupsAdded + ' групп', 'success');
        else _toast('Ошибка: ' + r.error, 'error');
      } else if (importMode === 'bookmarks') {
        const r = Storage.importBookmarks(c);
        if (r.success) _toast('Закладки: ' + r.found + ' найдено, ' + r.added + ' добавлено', 'success');
        else _toast('Ошибка: ' + r.error, 'error');
      }
      _renderTable();
    };
    reader.readAsText(file);
    e.target.value = ''; importMode = '';
  }

  /* ==================== HELPERS ==================== */

  function _buildGroupOptions(selId) {
    const groups = Storage.getGroups();
    let h = '<option value="">— Без группы —</option>';
    const _r = (pid, ind) => {
      groups.filter(g => g.parentId === pid).forEach(g => {
        h += '<option value="' + g.id + '"' + (g.id === selId ? ' selected' : '') + '>' +
          '\u00A0\u00A0'.repeat(ind) + _escHtml(g.title) + '</option>';
        _r(g.id, ind + 1);
      });
    };
    _r('', 0);
    return h;
  }

  function _setStatus(t) { document.getElementById('statusText').textContent = t; }

  function _toast(msg, type) {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.textContent = msg; c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3000);
  }

  function _escHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _escAttr(s) { if (!s) return ''; return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _formatDate(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}); } catch(e) { return iso; } }
  function _formatDateTime(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleString('ru-RU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch(e) { return iso; } }
  function _dateStamp() { return new Date().toISOString().slice(0,10); }

  function _downloadFile(content, filename, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename; document.body.appendChild(a); a.click();
    document.removeChild(a);
  }

  /* ==================== BOOT ==================== */
  document.addEventListener('DOMContentLoaded', init);
  return { init };
})();
