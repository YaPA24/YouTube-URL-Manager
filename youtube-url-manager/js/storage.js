/* ============================================================
storage.js — Модуль работы с localStorage
YouTube URL Manager
============================================================ */
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

  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function _now() {
    return new Date().toISOString();
  }

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
      const data = JSON.parse(raw);
      if (!data.version) data.version = 1;
      if (!data.settings) data.settings = { youtubeApiKey: '' };
      if (!Array.isArray(data.groups)) data.groups = [];
      if (!Array.isArray(data.links)) data.links = [];
      
      data.groups.forEach(group => {
        if (group.title === undefined && group.name !== undefined) {
          group.title = group.name;
        }
      });
      
      return data;
    } catch (e) {
      console.error('Storage: Error loading data', e);
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }

  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      throw e;
    }
  }

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
    data.groups = data.groups.filter(g => g.id !== id);
    const childIds = _getAllDescendantGroupIds(id, data.groups);
    childIds.forEach(cid => {
      data.groups = data.groups.filter(g => g.id !== cid);
    });
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

  function buildGroupTree(groups, parentId) {
    if (parentId === undefined) parentId = '';
    return groups
      .filter(g => g.parentId === parentId)
      .map(g => ({
        ...g,
        children: buildGroupTree(groups, g.id)
      }));
  }

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
    if (link.manualTitle && meta.title) {
      delete meta.title;
    }
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

  function exportAll() {
    return _load();
  }

  function importJSON(jsonString, replaceAll = false) {
    const imported = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!imported || (!imported.version && !Array.isArray(imported.links) && !Array.isArray(imported.groups))) {
      throw new Error('Invalid format');
    }
    let data;
    let groupsAdded = 0;
    let linksAdded = 0;
    let settingsUpdated = false;
    if (replaceAll) {
      data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      if (imported.version) data.version = imported.version;
      if (imported.settings) data.settings = imported.settings;
      if (Array.isArray(imported.groups)) {
        data.groups = imported.groups;
        groupsAdded = imported.groups.length;
      }
      if (Array.isArray(imported.links)) {
        data.links = imported.links.map(l => {
          if (!l.id) l.id = _uuid();
          if (!Array.isArray(l.history)) l.history = [];
          return l;
        });
        linksAdded = data.links.length;
      }
    } else {
      data = _load();
      if (imported.settings) {
        Object.assign(data.settings, imported.settings);
        settingsUpdated = true;
      }
      if (Array.isArray(imported.groups)) {
        const existingIds = new Set(data.groups.map(g => g.id).filter(Boolean));
        imported.groups.forEach(g => {
          if (!g || !g.id) return;
          if (!existingIds.has(g.id)) {
            if (g.title === undefined && g.name !== undefined) {
              g.title = g.name;
            }
            data.groups.push(g);
            existingIds.add(g.id);
            groupsAdded++;
          }
        });
      }
      if (Array.isArray(imported.links)) {
        const existingIds = new Set(data.links.map(l => l.id).filter(Boolean));
        const existingVideoIds = new Set(data.links.map(l => l.youtubeId).filter(Boolean));
        imported.links.forEach(l => {
          if (!l || typeof l !== 'object') return;
          if (!l.id) {
            l.id = _uuid();
          }
          if (!Array.isArray(l.history)) {
            l.history = [];
          }
          const duplicateById = existingIds.has(l.id);
          const duplicateByVideoId = l.youtubeId && existingVideoIds.has(l.youtubeId);
          if (!duplicateById && !duplicateByVideoId) {
            data.links.push(l);
            existingIds.add(l.id);
            if (l.youtubeId) {
              existingVideoIds.add(l.youtubeId);
            }
            linksAdded++;
          }
        });
      }
    }
    _save(data);
    return {
      success: true,
      groupsAdded,
      linksAdded,
      replaced: replaceAll,
      settingsUpdated
    };
  }

  function importBookmarks(htmlString, createNewGroup = false) {
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
            url,
            youtubeId: ytId,
            title: a.textContent.trim() || ''
          });
        }
      });
      let added = 0;
      const data = _load();
      const existingVideoIds = new Set(data.links.map(l => l.youtubeId).filter(Boolean));
      let newGroupId = '';
      if (createNewGroup) {
        const groupName = `Закладки от ${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;
        newGroupId = _uuid();
        data.groups.push({
          id: newGroupId,
          title: groupName,
          parentId: '',
          createdAt: _now(),
          updatedAt: _now()
        });
      }
      results.forEach(r => {
        if (!existingVideoIds.has(r.youtubeId)) {
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
            groupId: newGroupId,
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
          existingVideoIds.add(r.youtubeId);
          added++;
        }
      });
      _save(data);
      const groupName = createNewGroup
        ? (data.groups.find(g => g.id === newGroupId) || {}).title
        : undefined;
      return {
        success: true,
        found: results.length,
        added,
        groupName
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  }

  function clearAll() {
    _save(JSON.parse(JSON.stringify(DEFAULT_DATA)));
  }

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
