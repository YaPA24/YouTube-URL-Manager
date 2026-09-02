/* ============================================================
 *  storage.js — Модуль работы с localStorage
 *  YouTube URL Manager
 * ============================================================ */

const Storage = (() => {
  const STORAGE_KEY = 'yt_url_manager';

  const DEFAULT_DATA = {
    version: 1,
    settings: {
      youtubeApiKey: ''
    },
    groups: [],
    links: []
  };

  /* ---------- helpers ---------- */

  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function _now() {
    return new Date().toISOString();
  }

  /* ---------- core CRUD ---------- */

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
      const data = JSON.parse(raw);
      // миграция / защита
      if (!data.version) data.version = 1;
      if (!data.settings) data.settings = { youtubeApiKey: '' };
      if (!Array.isArray(data.groups)) data.groups = [];
      if (!Array.isArray(data.links)) data.links = [];
      return data;
    } catch (e) {
      console.error('Storage load error:', e);
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }

  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      return false;
    }
  }

  /* ---------- Settings ---------- */

  function getSettings() {
    return _load().settings;
  }

  function saveSettings(settings) {
    const data = _load();
    Object.assign(data.settings, settings);
    return _save(data);
  }

  function getApiKey() {
    return _load().settings.youtubeApiKey || '';
  }

  function setApiKey(key) {
    const data = _load();
    data.settings.youtubeApiKey = key;
    return _save(data);
  }

  /* ---------- Groups ---------- */

  function getGroups() {
    return _load().groups;
  }

  function getGroupById(id) {
    return _load().groups.find(g => g.id === id) || null;
  }

  function addGroup(title, parentId) {
    const data = _load();
    const group = {
      id: _uuid(),
      title: title.trim(),
      parentId: parentId || '',
      type: 'folder',
      createdAt: _now(),
      updatedAt: _now()
    };
    data.groups.push(group);
    _save(data);
    return group;
  }

  function updateGroup(id, updates) {
    const data = _load();
    const group = data.groups.find(g => g.id === id);
    if (!group) return null;
    Object.assign(group, updates, { updatedAt: _now() });
    _save(data);
    return group;
  }

  function deleteGroup(id) {
    const data = _load();
    // Удаляем группу
    data.groups = data.groups.filter(g => g.id !== id);
    // Удаляем дочерние группы рекурсивно
    const childIds = _getAllDescendantGroupIds(id, data.groups);
    childIds.forEach(cid => {
      data.groups = data.groups.filter(g => g.id !== cid);
    });
    // Сбрасываем groupId у ссылок
    const affectedIds = [id, ...childIds];
    data.links.forEach(link => {
      if (affectedIds.includes(link.groupId)) {
        link.groupId = '';
      }
    });
    _save(data);
    return true;
  }

  function _getAllDescendantGroupIds(parentId, groups) {
    const ids = [];
    const children = groups.filter(g => g.parentId === parentId);
    children.forEach(child => {
      ids.push(child.id);
      ids.push(..._getAllDescendantGroupIds(child.id, groups));
    });
    return ids;
  }

  /** Построить дерево групп */
  function buildGroupTree(groups, parentId) {
    if (parentId === undefined) parentId = '';
    const children = groups
      .filter(g => g.parentId === parentId)
      .map(g => ({
        ...g,
        children: buildGroupTree(groups, g.id)
      }));
    return children;
  }

  /* ---------- Links ---------- */

  function getLinks() {
    return _load().links;
  }

  function getLinkById(id) {
    return _load().links.find(l => l.id === id) || null;
  }

  function addLink(linkData) {
    const data = _load();
    const now = _now();
    const link = {
      id: _uuid(),
      url: linkData.url || '',
      youtubeId: linkData.youtubeId || '',
      title: linkData.title || '',
      channelTitle: linkData.channelTitle || '',
      duration: linkData.duration || '',
      durationSeconds: linkData.durationSeconds || 0,
      publishedAt: linkData.publishedAt || '',
      thumbnailUrl: linkData.thumbnailUrl || '',
      status: linkData.status || 'queue',
      groupId: linkData.groupId || '',
      tags: linkData.tags || [],
      notes: linkData.notes || '',
      manualTitle: linkData.manualTitle || false,
      createdAt: now,
      updatedAt: now,
      fetchedAt: linkData.fetchedAt || '',
      fetchSource: linkData.fetchSource || '',
      fetchError: linkData.fetchError || '',
      history: []
    };
    data.links.push(link);
    _save(data);
    return link;
  }

  function updateLink(id, updates) {
    const data = _load();
    const link = data.links.find(l => l.id === id);
    if (!link) return null;

    // Сохраняем историю изменений
    const changedFields = {};
    const trackedFields = ['title', 'status', 'groupId', 'notes', 'tags', 'channelTitle', 'duration', 'thumbnailUrl'];
    trackedFields.forEach(field => {
      if (updates[field] !== undefined && JSON.stringify(updates[field]) !== JSON.stringify(link[field])) {
        changedFields[field] = { old: link[field], new: updates[field] };
      }
    });

    if (Object.keys(changedFields).length > 0) {
      if (!Array.isArray(link.history)) link.history = [];
      link.history.push({
        timestamp: _now(),
        changes: changedFields
      });
    }

    Object.assign(link, updates, { updatedAt: _now() });
    _save(data);
    return link;
  }

  function deleteLink(id) {
    const data = _load();
    data.links = data.links.filter(l => l.id !== id);
    _save(data);
    return true;
  }

  function updateLinkMetadata(id, meta) {
    const data = _load();
    const link = data.links.find(l => l.id === id);
    if (!link) return null;

    // Не переписываем ручное название
    if (link.manualTitle && meta.title) {
      delete meta.title;
    }

    // Логируем обновление метаданных
    const changedFields = {};
    const metaFields = ['title', 'channelTitle', 'duration', 'durationSeconds', 'publishedAt', 'thumbnailUrl'];
    metaFields.forEach(field => {
      if (meta[field] !== undefined && JSON.stringify(meta[field]) !== JSON.stringify(link[field])) {
        changedFields[field] = { old: link[field], new: meta[field] };
      }
    });

    if (Object.keys(changedFields).length > 0) {
      if (!Array.isArray(link.history)) link.history = [];
      link.history.push({
        timestamp: _now(),
        changes: changedFields,
        fetchUpdate: true
      });
    }

    Object.assign(link, meta, {
      updatedAt: _now(),
      fetchedAt: _now(),
      fetchSource: meta.fetchSource || 'oembed',
      fetchError: meta.fetchError || ''
    });
    _save(data);
    return link;
  }

  /* ---------- Import / Export ---------- */

  function exportAll() {
    return _load();
  }

  function importJSON(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      if (!imported.version && !imported.links && !imported.groups) {
        throw new Error('Invalid format');
      }
      // Мерджим
      const data = _load();
      if (imported.settings) {
        Object.assign(data.settings, imported.settings);
      }
      if (Array.isArray(imported.groups)) {
        const existingIds = new Set(data.groups.map(g => g.id));
        imported.groups.forEach(g => {
          if (!existingIds.has(g.id)) {
            data.groups.push(g);
          }
        });
      }
      if (Array.isArray(imported.links)) {
        const existingIds = new Set(data.links.map(l => l.id));
        imported.links.forEach(l => {
          if (!existingIds.has(l.id)) {
            if (!Array.isArray(l.history)) l.history = [];
            data.links.push(l);
          }
        });
      }
      _save(data);
      return { success: true, groupsAdded: imported.groups ? imported.groups.length : 0, linksAdded: imported.links ? imported.links.length : 0 };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function importBookmarks(htmlString) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const anchors = doc.querySelectorAll('a[href]');
      const results = [];

      anchors.forEach(a => {
        const url = a.getAttribute('href');
        const ytId = YouTube.extractVideoId(url);
        if (ytId) {
          results.push({
            url: url,
            youtubeId: ytId,
            title: a.textContent.trim() || ''
          });
        }
      });

      // Добавляем найденные
      let added = 0;
      const data = _load();
      const existingUrls = new Set(data.links.map(l => l.youtubeId));

      results.forEach(r => {
        if (!existingUrls.has(r.youtubeId)) {
          data.links.push({
            id: _uuid(),
            url: r.url,
            youtubeId: r.youtubeId,
            title: r.title,
            channelTitle: '',
            duration: '',
            durationSeconds: 0,
            publishedAt: '',
            thumbnailUrl: '',
            status: 'queue',
            groupId: '',
            tags: [],
            notes: '',
            manualTitle: false,
            createdAt: _now(),
            updatedAt: _now(),
            fetchedAt: '',
            fetchSource: '',
            fetchError: '',
            history: []
          });
          existingUrls.add(r.youtubeId);
          added++;
        }
      });

      _save(data);
      return { success: true, found: results.length, added: added };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function clearAll() {
    _save(JSON.parse(JSON.stringify(DEFAULT_DATA)));
  }

  /* ---------- Public API ---------- */
  return {
    getSettings,
    saveSettings,
    getApiKey,
    setApiKey,
    getGroups,
    getGroupById,
    addGroup,
    updateGroup,
    deleteGroup,
    buildGroupTree,
    getLinks,
    getLinkById,
    addLink,
    updateLink,
    deleteLink,
    updateLinkMetadata,
    exportAll,
    importJSON,
    importBookmarks,
    clearAll
  };
})();
