/* ============================================================
details.js — UI модуль панели деталей
YouTube URL Manager
============================================================ */
const Details = (() => {
  const STATUS_LABELS = {
    queue: 'В очереди',
    later: 'Посмотреть позже',
    watching: 'Смотрю',
    watched: 'Просмотрено',
    archived: 'Архив'
  };

  let selectedLinkId = '';

  function getSelectedLinkId() {
    return selectedLinkId;
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

  function _buildGroupOptions(selId) {
    const groups = Storage.getGroups();
    
    let h = '<option value="">— Без группы —</option>';
    
    const _r = (pid, ind) => {
      groups
        .filter(g => g.parentId === pid)
        .forEach(g => {
          h += '<option value="' + _escAttr(g.id) + '"' + (g.id === selId ? ' selected' : '') + '>' +
            '\u00A0\u00A0'.repeat(ind) + _escHtml(g.title) + '</option>';
          
          _r(g.id, ind + 1);
        });
    };
    
    _r('', 0);
    
    return h;
  }

  function _clearSelectionUI() {
    document.querySelectorAll('.trow.selected').forEach(r => r.classList.remove('selected'));
    document.querySelectorAll('.mosaic-card.selected').forEach(c => c.classList.remove('selected'));
  }

  function selectLink(id) {
    _clearSelectionUI();
    
    if (!id) {
      selectedLinkId = '';
      hidePanel();
      return;
    }
    
    selectedLinkId = id;
    
    const row = document.querySelector('.trow[data-id="' + id + '"]');
    if (row) row.classList.add('selected');
    
    const card = document.querySelector('.mosaic-card[data-id="' + id + '"]');
    if (card) card.classList.add('selected');
    
    showPanel(id);
  }

  function showPanel(id) {
    const link = Storage.getLinkById(id);
    
    if (!link) {
      hidePanel();
      return;
    }
    
    const panel = document.getElementById('detailsPanel');
    const handle = document.getElementById('resizeHandleV');
    const body = document.querySelector('.content-body');
    
    if (!panel) return;
    
    const thumb = link.thumbnailUrl || YouTube.getThumbnailUrl(link.youtubeId);
    const img = document.getElementById('detailsThumbImg');
    
    if (img) {
      img.src = thumb;
      img.style.display = '';
      img.style.transform = '';
      
      img.onerror = function() {
        this.style.display = 'none';
      };
    }
    
    const setVal = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    
    setVal('detailName', link.title || '');
    setVal('detailUrl', link.url || '');
    setVal('detailChannel', link.channelTitle || '');
    setVal('detailDuration', link.duration || '');
    setVal('detailPublished', link.publishedAt ? _formatDate(link.publishedAt) : '');
    setVal('detailNotes', link.notes || '');
    setVal('detailTags', (link.tags || []).join(', '));
    
    const statusSelect = document.getElementById('detailStatus');
    if (statusSelect) {
      statusSelect.innerHTML = Object.entries(STATUS_LABELS).map(([k, v]) =>
        '<option value="' + k + '"' + (k === link.status ? ' selected' : '') + '>' + _escHtml(v) + '</option>'
      ).join('');
    }
    
    const groupSelect = document.getElementById('detailGroup');
    if (groupSelect) {
      groupSelect.innerHTML = _buildGroupOptions(link.groupId);
    }
    
    panel.classList.add('visible');
    panel.classList.remove('hidden');
    
    if (handle) handle.classList.remove('hidden');
    if (body) body.classList.add('has-details-panel');
  }

  function hidePanel() {
    const panel = document.getElementById('detailsPanel');
    const handle = document.getElementById('resizeHandleV');
    const body = document.querySelector('.content-body');
    
    if (panel) {
      panel.classList.remove('visible');
      panel.classList.add('hidden');
    }
    
    if (handle) {
      handle.classList.add('hidden');
    }
    
    if (body) {
      body.classList.remove('has-details-panel');
    }
  }

  function bind() {
    function saveField(fieldName, getter) {
      if (!selectedLinkId) return;
      
      const link = Storage.getLinkById(selectedLinkId);
      if (!link) return;
      
      const val = getter();
      const updates = {};
      
      updates[fieldName] = val;
      
      if (fieldName === 'title') {
        updates.manualTitle = val !== '';
      }
      
      Storage.updateLink(selectedLinkId, updates);
      
      if (window.Table && Table.getViewMode() === 'rows') {
        Table.updateItem(selectedLinkId);
      } else if (window.Mosaic) {
        Mosaic.updateItem(selectedLinkId);
      }
    }
    
    const detailName = document.getElementById('detailName');
    
    if (detailName) {
      detailName.addEventListener('change', function() {
        saveField('title', () => this.value.trim());
      });
      
      detailName.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.blur();
        }
      });
    }
    
    const detailStatus = document.getElementById('detailStatus');
    if (detailStatus) {
      detailStatus.addEventListener('change', function() {
        saveField('status', () => this.value);
      });
    }
    
    const detailGroup = document.getElementById('detailGroup');
    if (detailGroup) {
      detailGroup.addEventListener('change', function() {
        saveField('groupId', () => this.value);
      });
    }
    
    const detailTags = document.getElementById('detailTags');
    if (detailTags) {
      detailTags.addEventListener('change', function() {
        const raw = this.value.trim();
        const tags = raw
          ? raw.split(',').map(t => t.trim()).filter(Boolean)
          : [];
        
        saveField('tags', () => tags);
      });
    }
    
    const detailNotes = document.getElementById('detailNotes');
    if (detailNotes) {
      detailNotes.addEventListener('change', function() {
        saveField('notes', () => this.value.trim());
      });
    }
    
    const detailsClose = document.getElementById('detailsClose');
    if (detailsClose) {
      detailsClose.addEventListener('click', () => {
        _clearSelectionUI();
        selectedLinkId = '';
        hidePanel();
      });
    }
    
    const copyUrlBtn = document.getElementById('copyUrlBtn');
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', () => {
        const url = document.getElementById('detailUrl').value;
        
        if (url) {
          navigator.clipboard.writeText(url).then(() => {
            if (window.Toast) Toast.show('URL скопирован', 'success');
          });
        }
      });
    }
    
    const detailsHistoryBtn = document.getElementById('detailsHistoryBtn');
    if (detailsHistoryBtn) {
      detailsHistoryBtn.addEventListener('click', () => {
        if (window.Modal) Modal.showHistoryModal(selectedLinkId);
      });
    }
    
    const detailsDeleteBtn = document.getElementById('detailsDeleteBtn');
    if (detailsDeleteBtn) {
      detailsDeleteBtn.addEventListener('click', () => {
        if (confirm('Удалить это видео?')) {
          Storage.deleteLink(selectedLinkId);
          _clearSelectionUI();
          selectedLinkId = '';
          hidePanel();
          
          if (window.Table) Table.render();
          if (window.Mosaic) Mosaic.render();
          if (window.Sidebar) Sidebar.render();
          
          if (window.Toast) Toast.show('Видео удалено', 'info');
        }
      });
    }
  }

  function bindResize() {
    const handle = document.getElementById('resizeHandleV');
    const panel = document.getElementById('detailsPanel');
    
    if (!handle || !panel) return;
    
    let startX = 0;
    let startW = 0;
    
    handle.addEventListener('mousedown', e => {
      startX = e.clientX;
      startW = panel.offsetWidth || panel.getBoundingClientRect().width;
      
      handle.classList.add('dragging');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      
      e.preventDefault();
    });
    
    function onMove(e) {
      const newW = startW - (e.clientX - startX);
      const safeW = Math.max(200, Math.min(500, newW));
      
      panel.style.width = safeW + 'px';
      document.documentElement.style.setProperty('--details-width', safeW + 'px');
    }
    
    function onUp() {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  }

  function bindZoom() {
    const thumb = document.getElementById('detailsThumb');
    const img = document.getElementById('detailsThumbImg');
    
    if (!thumb || !img) return;
    
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

  return {
    getSelectedLinkId,
    selectLink,
    showPanel,
    hidePanel,
    bind,
    bindResize,
    bindZoom
  };
})();
