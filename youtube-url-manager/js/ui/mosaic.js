/* ============================================================
mosaic.js — UI модуль мозаики
YouTube URL Manager
============================================================ */
const Mosaic = (() => {
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

  function _renderMosaicCard(link) {
    const thumb = link.thumbnailUrl || YouTube.getThumbnailUrl(link.youtubeId);
    const title = link.title || 'Без названия';
    const duration = link.duration || '';
    const selectedLinkId = window.Details ? Details.getSelectedLinkId() : '';
    const sel = link.id === selectedLinkId ? ' selected' : '';
    
    let html = '<div class="mosaic-card' + sel + '" data-id="' + _escAttr(link.id) + '">';
    
    html += '<div class="mosaic-card__thumb">';
    html += '<img src="' + _escAttr(thumb) + '" alt="" loading="lazy">';
    
    if (duration) {
      html += '<span class="mosaic-card__duration">' + _escHtml(duration) + '</span>';
    }
    
    html += '</div>';
    
    html += '<div class="mosaic-card__body">';
    html += '<div class="mosaic-card__title" title="' + _escAttr(title) + '">' + _escHtml(title) + '</div>';
    html += '</div>';
    
    html += '</div>';
    
    return html;
  }

  function _renderMosaicFolderCard(group) {
    const count = _countLinksInGroup(group.id);
    
    let html = '<div class="mosaic-card mosaic-card--folder" data-folder-id="' + _escAttr(group.id) + '">';
    html += '<div class="mosaic-card__folder-icon">📁</div>';
    html += '<div class="mosaic-card__body">';
    html += '<div class="mosaic-card__title">' + _escHtml(group.title) + '</div>';
    html += '<div class="mosaic-card__count">' + count + ' видео</div>';
    html += '</div>';
    html += '</div>';
    
    return html;
  }

  function _renderMosaicParentCard() {
    const currentGroupId = window.Sidebar ? Sidebar.getCurrentGroupId() : '';
    const current = Storage.getGroupById(currentGroupId);
    const parentTitle = current && current.parentId
      ? (Storage.getGroupById(current.parentId) || {}).title || ''
      : '';
    
    let html = '<div class="mosaic-card mosaic-card--parent">';
    html += '<div class="mosaic-card__parent-icon">\u22EF</div>';
    html += '<div class="mosaic-card__body">';
    html += '<div class="mosaic-card__title">Назад</div>';
    
    if (parentTitle) {
      html += '<div class="mosaic-card__count">' + _escHtml(parentTitle) + '</div>';
    }
    
    html += '</div>';
    html += '</div>';
    
    return html;
  }

  function render() {
    const currentGroupId = window.Sidebar ? Sidebar.getCurrentGroupId() : '';
    const currentFilter = window.Sidebar ? Sidebar.getCurrentFilter() : 'all';
    const searchQuery = window.Table ? Table.getSearchQuery() : '';
    const sortField = window.Table ? Table.getSortField() : '';
    const sortAsc = window.Table ? Table.getSortAsc() : true;
    
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
    
    const childGroups = Storage.getGroups()
      .filter(g => g.parentId === currentGroupId)
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    
    const mosaic = document.getElementById('mosaicView');
    const mosaicEmpty = document.getElementById('mosaicEmpty');
    
    if (!mosaic) return;
    
    let html = '';
    
    if (currentGroupId) {
      html += _renderMosaicParentCard();
    }
    
    childGroups.forEach(g => {
      html += _renderMosaicFolderCard(g);
    });
    
    links.forEach(l => {
      html += _renderMosaicCard(l);
    });
    
    if (!html.trim()) {
      mosaic.innerHTML = '';
      if (mosaicEmpty) mosaicEmpty.classList.remove('hidden');
      return;
    }
    
    if (mosaicEmpty) mosaicEmpty.classList.add('hidden');
    
    mosaic.innerHTML = html;
    
    const parentCard = mosaic.querySelector('.mosaic-card--parent');
    if (parentCard) {
      parentCard.addEventListener('click', () => {
        const current = Storage.getGroupById(currentGroupId);
        const parentId = current ? current.parentId || '' : '';
        
        if (window.Sidebar) {
          Sidebar.setCurrentGroupId(parentId);
          Sidebar.render();
        }
        
        render();
      });
    }
    
    mosaic.querySelectorAll('.mosaic-card--folder').forEach(card => {
      card.addEventListener('click', () => {
        if (window.Sidebar) {
          Sidebar.setCurrentGroupId(card.dataset.folderId);
          Sidebar.setCurrentFilter('all');
          Sidebar._syncFilterMenu();
          Sidebar.render();
        }
        render();
      });
    });
    
    mosaic.querySelectorAll('.mosaic-card:not(.mosaic-card--folder):not(.mosaic-card--parent)').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        if (window.Details) Details.selectLink(card.dataset.id);
      });
      
      card.addEventListener('dblclick', () => {
        const l = Storage.getLinkById(card.dataset.id);
        if (l) window.open(YouTube.getVideoUrl(l.youtubeId), '_blank');
      });
    });
  }

  function updateItem(id) {
    const link = Storage.getLinkById(id);
    if (!link) return;
    
    const existing = document.querySelector('.mosaic-card[data-id="' + id + '"]');
    if (!existing) return;
    
    const tmp = document.createElement('div');
    tmp.innerHTML = _renderMosaicCard(link);
    
    const newCard = tmp.firstElementChild;
    newCard.classList.add('selected');
    
    newCard.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      if (window.Details) Details.selectLink(newCard.dataset.id);
    });
    
    newCard.addEventListener('dblclick', () => {
      window.open(YouTube.getVideoUrl(link.youtubeId), '_blank');
    });
    
    existing.replaceWith(newCard);
  }

  return {
    render,
    updateItem
  };
})();
