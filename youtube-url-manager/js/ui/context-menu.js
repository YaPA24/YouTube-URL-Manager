/* ============================================================
context-menu.js — UI модуль контекстного меню
YouTube URL Manager
============================================================ */
const ContextMenu = (() => {
  let ctxTargetId = '';
  let ctxTargetIsFolder = false;

  function _escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function _populateMoveSubmenu() {
    const sub = document.getElementById('ctxMoveSubmenu');
    if (!sub) return;
    
    const link = Storage.getLinkById(ctxTargetId);
    const currentGroupIdLink = link ? link.groupId : '';
    const groups = Storage.getGroups();
    
    let html = '';
    
    const noGroupSel = currentGroupIdLink === ''
      ? ' class="ctx-menu__item active"'
      : ' class="ctx-menu__item"';
    
    html += '<button' + noGroupSel + ' data-move-group="">— Без группы —</button>';
    
    const addGroups = (pid, indent) => {
      groups
        .filter(g => g.parentId === pid)
        .forEach(g => {
          const isCurrent = g.id === currentGroupIdLink;
          const cls = isCurrent
            ? ' class="ctx-menu__item active"'
            : ' class="ctx-menu__item"';
          
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
        
        Storage.updateLink(id, { groupId });
        
        const ctxMenu = document.getElementById('ctxMenu');
        if (ctxMenu) ctxMenu.classList.remove('open');
        
        if (window.Table) Table.render();
        if (window.Mosaic) Mosaic.render();
        if (window.Sidebar) Sidebar.render();
        
        const selectedLinkId = window.Details ? Details.getSelectedLinkId() : '';
        
        if (selectedLinkId === id) {
          if (window.Details) Details.showPanel(id);
        }
        
        const groupName = groupId
          ? (Storage.getGroupById(groupId) || {}).title || groupId
          : 'без группы';
        
        if (window.Toast) Toast.show('Перемещено в: ' + groupName, 'success');
      });
    });
  }

  function bind() {
    const ctxMenu = document.getElementById('ctxMenu');
    if (!ctxMenu) return;
    
    const moveBtn = document.getElementById('ctxMoveToFolder');
    const moveSub = document.getElementById('ctxMoveSubmenu');
    const linkSection = ctxMenu.querySelector('.ctx-link-section');
    const folderSection = ctxMenu.querySelector('.ctx-folder-section');
    const tableBody = document.getElementById('tableBody');
    const mosaicView = document.getElementById('mosaicView');
    
    if (tableBody) {
      tableBody.addEventListener('contextmenu', e => {
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
          if (window.Details) Details.selectLink(ctxTargetId);
          _showCtxMenu(e.clientX, e.clientY, false);
        }
      });
    }
    
    if (mosaicView) {
      mosaicView.addEventListener('contextmenu', e => {
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
          if (window.Details) Details.selectLink(ctxTargetId);
          _showCtxMenu(e.clientX, e.clientY, false);
        }
      });
    }
    
    function _showCtxMenu(x, y, isFolder) {
      if (linkSection) linkSection.classList.toggle('hidden', isFolder);
      if (folderSection) folderSection.classList.toggle('hidden', !isFolder);
      
      if (!isFolder) {
        _populateMoveSubmenu();
      }
      
      if (moveSub) moveSub.classList.remove('open');
      
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
    
    document.addEventListener('click', e => {
      if (!e.target.closest('.ctx-menu')) {
        ctxMenu.classList.remove('open');
      }
    });
    
    document.addEventListener('contextmenu', e => {
      if (!e.target.closest('.trow') && !e.target.closest('.mosaic-card')) {
        ctxMenu.classList.remove('open');
      }
    });
    
    if (moveBtn && moveSub) {
      moveBtn.addEventListener('mouseenter', () => {
        if (moveSub.children.length > 0) moveSub.classList.add('open');
      });
      
      moveBtn.addEventListener('mouseleave', () => moveSub.classList.remove('open'));
      moveSub.addEventListener('mouseenter', () => moveSub.classList.add('open'));
      moveSub.addEventListener('mouseleave', () => moveSub.classList.remove('open'));
    }
    
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
            navigator.clipboard.writeText(link.url).then(() => {
              if (window.Toast) Toast.show('URL скопирован', 'success');
            });
            break;
            
          case 'copy-title':
            navigator.clipboard.writeText(link.title || '').then(() => {
              if (window.Toast) Toast.show('Название скопировано', 'success');
            });
            break;
            
          case 'history':
            if (window.Modal) Modal.showHistoryModal(id);
            break;
            
          case 'delete':
            if (confirm('Удалить это видео?')) {
              Storage.deleteLink(id);
              
              const selectedLinkId = window.Details ? Details.getSelectedLinkId() : '';
              
              if (selectedLinkId === id) {
                if (window.Details) Details.selectLink('');
              }
              
              if (window.Table) Table.render();
              if (window.Mosaic) Mosaic.render();
              if (window.Sidebar) Sidebar.render();
              
              if (window.Toast) Toast.show('Удалено', 'info');
            }
            break;
        }
      });
    });
    
    ctxMenu.querySelectorAll('.ctx-folder-section .ctx-menu__item[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        ctxMenu.classList.remove('open');
        
        const action = btn.dataset.action;
        const id = ctxTargetId;
        
        if (!id || !ctxTargetIsFolder) return;
        
        switch (action) {
          case 'rename-folder':
            if (window.Modal) Modal.showGroupModal(id);
            break;
            
          case 'delete-folder':
            if (confirm('Удалить папку и всё вложенное?')) {
              const grp = Storage.getGroupById(id);
              const parentId = grp ? grp.parentId : '';
              
              Storage.deleteGroup(id);
              
              const currentGroupId = window.Sidebar ? Sidebar.getCurrentGroupId() : '';
              
              if (currentGroupId === id) {
                if (window.Sidebar) {
                  Sidebar.setCurrentGroupId(parentId || '');
                  Sidebar.render();
                }
                
                if (window.Details) {
                  Details.selectLink('');
                }
              }
              
              if (window.Table) Table.render();
              if (window.Mosaic) Mosaic.render();
              
              if (window.Toast) Toast.show('Папка удалена', 'info');
            }
            break;
        }
      });
    });
  }

  async function _doRefreshMeta(id) {
    const link = Storage.getLinkById(id);
    if (!link) return;
    
    if (window.Toast) Toast.show('Обновляю метаданные...', 'info');
    
    try {
      const meta = await YouTube.fetchMetadata(link.youtubeId, Storage.getApiKey());
      
      if (link.manualTitle && meta.title) {
        delete meta.title;
      }
      
      Storage.updateLinkMetadata(id, meta);
      
      const selectedLinkId = window.Details ? Details.getSelectedLinkId() : '';
      
      if (selectedLinkId === id) {
        if (window.Details) Details.showPanel(id);
      }
      
      if (window.Table) Table.render();
      if (window.Mosaic) Mosaic.render();
      
      if (window.Toast) Toast.show('Метаданные обновлены (' + (meta.fetchSource || 'ok') + ')', 'success');
    } catch (err) {
      if (window.Toast) Toast.show('Ошибка: ' + err.message, 'error');
    }
  }

  async function refreshAllMeta() {
    const links = Storage.getLinks();
    
    if (links.length === 0) {
      if (window.Toast) Toast.show('Нет видео для обновления', 'info');
      return;
    }
    
    if (window.Toast) Toast.show('Обновляю все метаданные...', 'info');
    
    let updated = 0;
    
    for (const link of links) {
      try {
        const meta = await YouTube.fetchMetadata(link.youtubeId, Storage.getApiKey());
        
        if (link.manualTitle && meta.title) {
          delete meta.title;
        }
        
        Storage.updateLinkMetadata(link.id, meta);
        
        const selectedLinkId = window.Details ? Details.getSelectedLinkId() : '';
        
        if (selectedLinkId === link.id) {
          if (window.Details) Details.showPanel(link.id);
        }
        
        if (window.Table && Table.getViewMode() === 'rows') {
          Table.updateItem(link.id);
        } else if (window.Mosaic) {
          Mosaic.updateItem(link.id);
        }
        
        updated++;
      } catch (err) {
        // продолжаем
      }
      
      await new Promise(r => setTimeout(r, 350));
    }
    
    if (window.Toast) Toast.show('Обновлено: ' + updated + ' / ' + links.length, 'success');
  }

  return {
    bind,
    refreshAllMeta
  };
})();
