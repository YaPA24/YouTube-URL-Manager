/* ============================================================
sidebar.js — UI модуль боковой панели
YouTube URL Manager
============================================================ */
const Sidebar = (() => {
  let currentFilter = 'all';
  let currentGroupId = '';

  function setCurrentFilter(filter) {
    currentFilter = filter;
  }

  function getCurrentFilter() {
    return currentFilter;
  }

  function setCurrentGroupId(id) {
    currentGroupId = id;
  }

  function getCurrentGroupId() {
    return currentGroupId;
  }

  function _escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function _syncFilterMenu() {
    // Синхронизируем элементы боковой панели
    document.querySelectorAll('.nav-list[data-filter] .nav-item').forEach(item => {
      const filter = item.dataset.filter;
      const isActive = filter === currentFilter && !currentGroupId;
      item.classList.toggle('active', isActive);
    });

    // Синхронизируем выпадающее меню фильтра
    document.querySelectorAll('#menuFilter .tb-dropdown__item[data-filter]').forEach(item => {
      item.classList.toggle('active', item.dataset.filter === currentFilter);
    });
  }

  function _handleStatusFilterClick(e) {
    const item = e.currentTarget;
    const filter = item.dataset.filter;
    
    if (!filter) return;
    
    currentFilter = filter;
    currentGroupId = '';
    
    _syncFilterMenu();
    render();
    
    // Вызываем callback для обновления таблицы
    if (window.Table) Table.render();
  }

  function bind() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const addGroupBtn = document.getElementById('sidebarAddGroup');
    
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        toggleBtn.title = sidebar.classList.contains('collapsed')
          ? 'Развернуть панель'
          : 'Свернуть панель';
      });
    }
    
    if (addGroupBtn) {
      addGroupBtn.addEventListener('click', () => {
        if (window.Modal) Modal.showGroupModal();
      });
    }
  }

  function render() {
    const groupsList = document.getElementById('sidebarGroups');
    if (!groupsList) return;
    
    const groups = Storage.getGroups();
    const links = Storage.getLinks();
    
    const statusCounts = {
      all: links.length,
      queue: links.filter(l => l.status === 'queue').length,
      later: links.filter(l => l.status === 'later').length,
      watching: links.filter(l => l.status === 'watching').length,
      watched: links.filter(l => l.status === 'watched').length,
      archived: links.filter(l => l.status === 'archived').length
    };
    
    const setCount = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    };
    
    setCount('countAll', statusCounts.all);
    setCount('countQueue', statusCounts.queue);
    setCount('countLater', statusCounts.later);
    setCount('countWatching', statusCounts.watching);
    setCount('countWatched', statusCounts.watched);
    setCount('countArchived', statusCounts.archived);
    
    document.querySelectorAll('.nav-list[data-filter] .nav-item, .nav-item[data-filter]').forEach(item => {
      item.removeEventListener('click', _handleStatusFilterClick);
      item.addEventListener('click', _handleStatusFilterClick);
    });
    
    groupsList.innerHTML = '';
    
    groups.forEach(group => {
      const li = document.createElement('li');
      li.className = 'nav-item';
      li.dataset.groupId = group.id;
      
      if (group.id === currentGroupId) {
        li.classList.add('active');
      }
      
      const linkCount = links.filter(l => l.groupId === group.id).length;
      
      li.innerHTML = `
        <div class="nav-item-content">
          <span class="nav-icon">📁</span>
          <span class="nav-label">${_escHtml(group.title)}</span>
          <span class="nav-count">${linkCount}</span>
        </div>
        <div class="nav-item-actions">
          <button class="nav-action-btn" data-action="edit-group" data-group-id="${group.id}" title="Редактировать группу">✏️</button>
          <button class="nav-action-btn" data-action="delete-group" data-group-id="${group.id}" title="Удалить группу">🗑️</button>
        </div>
      `;
      
      li.querySelector('.nav-item-content').addEventListener('click', () => {
        currentGroupId = group.id;
        currentFilter = 'all';
        _syncFilterMenu();
        render();
        if (window.Table) Table.render();
      });
      
      li.querySelector('[data-action="edit-group"]').addEventListener('click', e => {
        e.stopPropagation();
        if (window.Modal) Modal.showGroupModal(group.id);
      });
      
      li.querySelector('[data-action="delete-group"]').addEventListener('click', e => {
        e.stopPropagation();
        
        if (confirm(`Удалить группу "${group.title}" и все её ссылки?`)) {
          Storage.deleteGroup(group.id);
          
          if (currentGroupId === group.id) {
            currentGroupId = '';
          }
          
          render();
          if (window.Table) Table.render();
        }
      });
      
      groupsList.appendChild(li);
    });
  }

  return {
    bind,
    render,
    setCurrentFilter,
    getCurrentFilter,
    setCurrentGroupId,
    getCurrentGroupId,
    _syncFilterMenu
  };
})();
