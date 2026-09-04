/* ============================================================
table.js — UI модуль таблицы
YouTube URL Manager
============================================================ */
const Table = (() => {
  const STATUS_LABELS = {
    queue: 'В очереди',
    later: 'Посмотреть позже',
    watching: 'Смотрю',
    watched: 'Просмотрено',
    archived: 'Архив'
  };

  let sortField = '';
  let sortAsc = true;
  let searchQuery = '';
  let viewMode = 'rows';

  function setSortField(field) {
    sortField = field;
  }

  function getSortField() {
    return sortField;
  }

  function setSortAsc(asc) {
    sortAsc = asc;
  }

  function getSortAsc() {
    return sortAsc;
  }

  function setSearchQuery(query) {
    searchQuery = query;
  }

  function getSearchQuery() {
    return searchQuery;
  }

  function setViewMode(mode) {
    viewMode = mode;
  }

  function getViewMode() {
    return viewMode;
  }

  function _escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function _escAttr(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return iso;
    }
  }

  function _getGroupAndDescendantIds(gid) {
    const groups = Storage.getGroups();
    const ids = [gid];
    
    const collect = pid => {
      groups
        .filter(g => g.parentId === pid)
        .forEach(g => {
          ids.push(g.id);
          collect(g.id);
        });
    };
    
    collect(gid);
    return ids;
  }

  function _countLinksInGroup(groupId) {
    const ids = _getGroupAndDescendantIds(groupId);
    return Storage.getLinks().filter(l => ids.includes(l.groupId)).length;
  }

  function _getFilteredLinks() {
    let links = Storage.getLinks();
    
    const currentGroupId = window.Sidebar ? Sidebar.getCurrentGroupId() : '';
    const currentFilter = window.Sidebar ? Sidebar.getCurrentFilter() : 'all';
    
    if (currentGroupId) {
      const ids = _getGroupAndDescendantIds(currentGroupId);
      links = links.filter(l => ids.includes(l.groupId));
    }
    
    if (currentFilter !== 'all') {
      links = links.filter(l => l.status === currentFilter);
    }
    
    if (searchQuery) {
      links = links.filter(l => {
        const haystack = [
          l.title,
          l.channelTitle,
          l.url,
          l.status,
          l.notes,
          l.youtubeId
        ]
          .concat(l.tags || [])
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        
        return haystack.includes(searchQuery);
      });
    }
    
    if (sortField) {
      links.sort((a, b) => {
        let va;
        let vb;
        
        if (sortField === 'durationSeconds') {
          va = a.durationSeconds || 0;
          vb = b.durationSeconds || 0;
        } else if (sortField === 'publishedAt') {
          va = a.publishedAt || '';
          vb = b.publishedAt || '';
        } else if (sortField === 'channelTitle') {
          va = (a.channelTitle || '').toLowerCase();
          vb = (b.channelTitle || '').toLowerCase();
        } else {
          va = (a[sortField] || '').toLowerCase();
          vb = (b[sortField] || '').toLowerCase();
        }
        
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortAsc ? cmp : -cmp;
      });
    } else {
      links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    return links;
  }

  function _getChildGroups() {
    const currentGroupId = window.Sidebar ? Sidebar.getCurrentGroupId() : '';
    return Storage.getGroups()
      .filter(g => g.parentId === currentGroupId)
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }

  function _renderRow(link) {
    const title = link.title || 'Без названия';
    const channel = link.channelTitle || '';
    const status = STATUS_LABELS[link.status] || link.status || '';
    const duration = link.duration || '';
    const published = link.publishedAt ? _formatDate(link.publishedAt) : '';
    const selectedLinkId = window.Details ? Details.getSelectedLinkId() : '';
    const sel = link.id === selectedLinkId ? ' selected' : '';
    
    let html = '<div class="trow' + sel + '" data-id="' + _escAttr(link.id) + '">';
    
    html += '<div class="tcell tcell--name">' + _escHtml(title) + '</div>';
    html += '<div class="tcell tcell--channel">' + _escHtml(channel) + '</div>';
    html += '<div class="tcell tcell--status">' + _escHtml(status) + '</div>';
    html += '<div class="tcell tcell--duration">' + _escHtml(duration) + '</div>';
    html += '<div class="tcell tcell--published">' + _escHtml(published) + '</div>';
    html += '<div class="tcell tcell--url">' + _escHtml(link.url || '') + '</div>';
    
    html += '</div>';
    
    return html;
  }

  function _renderFolderRow(group) {
    const count = _countLinksInGroup(group.id);
    
    let html = '<div class="trow trow--folder" data-folder-id="' + _escAttr(group.id) + '">';
    
    html += '<div class="tcell tcell--name"><span class="folder-icon">📁</span>' + _escHtml(group.title) + '</div>';
    html += '<div class="tcell tcell--channel">' + count + ' видео</div>';
    html += '<div class="tcell tcell--status"></div>';
    html += '<div class="tcell tcell--duration"></div>';
    html += '<div class="tcell tcell--published"></div>';
    html += '<div class="tcell tcell--url"></div>';
    
    html += '</div>';
    
    return html;
  }

  function bindSort() {
    document.querySelectorAll('.th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        
        if (sortField === field) {
          sortAsc = !sortAsc;
        } else {
          sortField = field;
          sortAsc = true;
        }
        
        document.querySelectorAll('.th[data-sort]').forEach(h => {
          h.classList.remove('sorted', 'sorted-desc');
          const arrow = h.querySelector('.sort-arrow');
          if (arrow) arrow.textContent = '';
        });
        
        th.classList.add(sortAsc ? 'sorted' : 'sorted-desc');
        
        const arrow = th.querySelector('.sort-arrow');
        if (arrow) arrow.textContent = sortAsc ? '\u25B2' : '\u25BC';
        
        render();
      });
    });
  }

  function render() {
    const links = _getFilteredLinks();
    const childGroups = _getChildGroups();
    
    const body = document.getElementById('tableBody');
    const empty = document.getElementById('tableEmpty');
    const wrapper = document.getElementById('tableWrapper');
    
    if (!body || !wrapper) return;
    
    let html = '';
    
    childGroups.forEach(g => {
      html += _renderFolderRow(g);
    });
    
    links.forEach(l => {
      html += _renderRow(l);
    });
    
    if (!html.trim()) {
      body.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    
    if (empty) empty.classList.add('hidden');
    
    body.innerHTML = html;
    
    body.querySelectorAll('.trow--folder').forEach(row => {
      row.addEventListener('click', () => {
        if (window.Sidebar) {
          Sidebar.setCurrentGroupId(row.dataset.folderId);
          Sidebar.setCurrentFilter('all');
          Sidebar._syncFilterMenu();
          Sidebar.render();
        }
        render();
      });
    });
    
    body.querySelectorAll('.trow:not(.trow--folder)').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        if (window.Details) Details.selectLink(row.dataset.id);
      });
      
      row.addEventListener('dblclick', () => {
        const l = Storage.getLinkById(row.dataset.id);
        if (l) window.open(YouTube.getVideoUrl(l.youtubeId), '_blank');
      });
    });
  }

  function updateItem(id) {
    const link = Storage.getLinkById(id);
    if (!link) return;
    
    const existingRow = document.querySelector('.trow[data-id="' + id + '"]');
    if (!existingRow) return;
    
    const tmp = document.createElement('div');
    tmp.innerHTML = _renderRow(link);
    
    const newRow = tmp.firstElementChild;
    newRow.classList.add('selected');
    
    newRow.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      if (window.Details) Details.selectLink(newRow.dataset.id);
    });
    
    newRow.addEventListener('dblclick', () => {
      window.open(YouTube.getVideoUrl(link.youtubeId), '_blank');
    });
    
    existingRow.replaceWith(newRow);
  }

  return {
    bindSort,
    render,
    updateItem,
    setSortField,
    getSortField,
    setSortAsc,
    getSortAsc,
    setSearchQuery,
    getSearchQuery,
    setViewMode,
    getViewMode
  };
})();
