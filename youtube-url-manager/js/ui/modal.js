/* ============================================================
modal.js — UI модуль модальных окон
YouTube URL Manager
============================================================ */
const Modal = (() => {
  const STATUS_LABELS = {
    queue: 'В очереди',
    later: 'Посмотреть позже',
    watching: 'Смотрю',
    watched: 'Просмотрено',
    archived: 'Архив'
  };

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

  function _formatDateTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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

  function _displayValue(field, value) {
    if (field === 'status' && STATUS_LABELS[value]) {
      return STATUS_LABELS[value];
    }
    
    if (field === 'groupId') {
      const g = Storage.getGroupById(value);
      return g ? g.title : '';
    }
    
    if (field === 'tags') {
      return Array.isArray(value) ? value.join(', ') : value;
    }
    
    if (field === 'thumbnailUrl') {
      return value ? '(обновлено)' : '';
    }
    
    if (field === 'publishedAt') {
      return _formatDate(value);
    }
    
    return String(value || '');
  }

  function showAddLinkModal() {
    const currentGroupId = window.Sidebar ? Sidebar.getCurrentGroupId() : '';
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
    html += '<div class="modal__footer">';
    html += '<button class="modal-btn" data-close>Отмена</button>';
    html += '<button class="modal-btn modal-btn--primary" id="addLinkSave">Добавить</button>';
    html += '</div>';
    html += '</div></div>';
    
    document.getElementById('modals').innerHTML = html;
    
    const overlay = document.getElementById('addLinkModal');
    
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    
    const urlInput = document.getElementById('addUrl');
    
    urlInput.focus();
    urlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') _doAddLink(overlay);
    });
    
    document.getElementById('addLinkSave').addEventListener('click', () => _doAddLink(overlay));
  }

  async function _doAddLink(overlay) {
    const url = document.getElementById('addUrl').value.trim();
    
    if (!url) {
      alert('Введите URL');
      return;
    }
    
    const videoId = YouTube.extractVideoId(url);
    
    if (!videoId) {
      alert('Не распознан YouTube URL');
      return;
    }
    
    if (Storage.getLinks().find(l => l.youtubeId === videoId)) {
      alert('Уже добавлено');
      return;
    }
    
    const link = Storage.addLink({
      url,
      youtubeId: videoId,
      status: document.getElementById('addStatus').value,
      groupId: document.getElementById('addGroup').value,
      notes: document.getElementById('addNotes').value.trim(),
      thumbnailUrl: YouTube.getThumbnailUrl(videoId)
    });
    
    overlay.remove();
    
    if (window.Table) Table.render();
    if (window.Mosaic) Mosaic.render();
    if (window.Sidebar) Sidebar.render();
    
    if (window.Toast) Toast.show('Загружаю метаданные...', 'info');
    
    try {
      const meta = await YouTube.fetchMetadata(videoId, Storage.getApiKey());
      
      if (meta.title || meta.channelTitle) {
        Storage.updateLinkMetadata(link.id, meta);
        
        if (window.Table) Table.render();
        if (window.Mosaic) Mosaic.render();
        if (window.Sidebar) Sidebar.render();
        
        if (window.Toast) Toast.show('Метаданные загружены (' + (meta.fetchSource || '') + ')', 'success');
      }
    } catch (err) {
      if (window.Toast) Toast.show('Ошибка метаданных', 'error');
    }
    
    if (window.Details) Details.selectLink(link.id);
  }

  function showGroupModal(editId) {
    const isEdit = !!editId;
    const group = isEdit ? Storage.getGroupById(editId) : null;
    const groups = Storage.getGroups();
    
    let parentOpts = '<option value="">— Без родителя —</option>';
    
    const _r = (pid, indent) => {
      groups
        .filter(g => g.parentId === pid)
        .forEach(g => {
          if (editId && g.id === editId) return;
          
          const sel = group && group.parentId === g.id ? ' selected' : '';
          
          parentOpts += '<option value="' + g.id + '"' + sel + '>' +
            '\u00A0\u00A0'.repeat(indent) + _escHtml(g.title) + '</option>';
          
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
    
    if (isEdit) {
      html += '<button class="modal-btn modal-btn--danger" id="grpDelete">Удалить</button>';
    }
    
    html += '<button class="modal-btn" data-close>Отмена</button>';
    html += '<button class="modal-btn modal-btn--primary" id="grpSave">' + (isEdit ? 'Сохранить' : 'Создать') + '</button>';
    html += '</div></div></div>';
    
    document.getElementById('modals').innerHTML = html;
    
    const overlay = document.getElementById('groupModal');
    
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    
    document.getElementById('grpSave').addEventListener('click', () => {
      const title = document.getElementById('grpTitle').value.trim();
      
      if (!title) {
        alert('Введите название');
        return;
      }
      
      if (isEdit) {
        Storage.updateGroup(editId, {
          title,
          parentId: document.getElementById('grpParent').value
        });
      } else {
        Storage.addGroup(title, document.getElementById('grpParent').value);
      }
      
      overlay.remove();
      
      if (window.Table) Table.render();
      if (window.Mosaic) Mosaic.render();
      if (window.Sidebar) Sidebar.render();
      
      if (window.Toast) Toast.show(isEdit ? 'Группа обновлена' : 'Группа создана', 'success');
    });
    
    if (isEdit) {
      document.getElementById('grpDelete').addEventListener('click', () => {
        if (confirm('Удалить группу?')) {
          const grp = Storage.getGroupById(editId);
          const parentId = grp ? grp.parentId : '';
          
          Storage.deleteGroup(editId);
          
          const currentGroupId = window.Sidebar ? Sidebar.getCurrentGroupId() : '';
          
          if (currentGroupId === editId) {
            if (window.Sidebar) {
              Sidebar.setCurrentGroupId(parentId || '');
              Sidebar.render();
            }
            
            if (window.Details) {
              Details.selectLink('');
            }
          }
          
          overlay.remove();
          
          if (window.Table) Table.render();
          if (window.Mosaic) Mosaic.render();
          
          if (window.Toast) Toast.show('Группа удалена', 'info');
        }
      });
    }
  }

  function showHistoryModal(id) {
    const link = Storage.getLinkById(id);
    
    if (!link) {
      alert('Выберите видео');
      return;
    }
    
    const history = link.history || [];
    
    const FL = {
      title: 'Название',
      channelTitle: 'Канал',
      duration: 'Длительность',
      publishedAt: 'Дата',
      thumbnailUrl: 'Превью',
      status: 'Статус',
      groupId: 'Группа',
      notes: 'Заметки',
      tags: 'Метки'
    };
    
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
            (entry.fetchUpdate ? ' <span class="history-item__fetch-badge">fetch</span>' : '') +
            '</div>';
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
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function showSettingsModal() {
    let html = '<div class="modal-overlay" id="settingsModal"><div class="modal">';
    
    html += '<div class="modal__header"><h2>Настройки</h2><button class="modal__close" data-close>&times;</button></div>';
    html += '<div class="modal__body">';
    
    html += '<div class="form-group">';
    html += '<label>YouTube Data API v3 Key</label>';
    html += '<input type="text" id="setApiKey" value="' + _escAttr(Storage.getApiKey()) + '">';
    html += '<span class="detail-hint" style="display:block;margin-top:4px">';
    html += 'С ключом: название, канал, длительность, дата. Без ключа: название, канал, превью (oEmbed).';
    html += '</span>';
    html += '</div>';
    
    html += '<div class="form-group">';
    html += '<button class="modal-btn" id="downloadInternalLogBtn">Скачать внутренний лог</button>';
    html += '</div>';
    
    html += '</div>';
    html += '<div class="modal__footer">';
    html += '<button class="modal-btn" data-close>Отмена</button>';
    html += '<button class="modal-btn modal-btn--primary" id="setSave">Сохранить</button>';
    html += '</div>';
    html += '</div></div>';
    
    document.getElementById('modals').innerHTML = html;
    
    const overlay = document.getElementById('settingsModal');
    
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    
    document.getElementById('setSave').addEventListener('click', () => {
      Storage.setApiKey(document.getElementById('setApiKey').value.trim());
      overlay.remove();
      if (window.Toast) Toast.show('Настройки сохранены', 'success');
    });
    
    document.getElementById('downloadInternalLogBtn').addEventListener('click', () => {
      if (window.Logger) Logger.downloadLog();
    });
  }

  return {
    showAddLinkModal,
    showGroupModal,
    showHistoryModal,
    showSettingsModal
  };
})();
