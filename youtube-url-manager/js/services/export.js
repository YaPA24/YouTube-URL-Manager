const Export = (() => {
  const STATUS_LABELS = {
    queue: 'В очереди', later: 'Посмотреть позже', watching: 'Смотрю',
    watched: 'Просмотрено', archived: 'Архив'
  };

  function _escHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
  function _escAttr(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _csvField(v) { return v ? '"' + String(v).replace(/"/g, '""') + '"' : '""'; }
  function _dateStamp() { return new Date().toISOString().slice(0, 10); }

  function _downloadFile(content, filename, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

  function _exportHTML(data) {
    const cards = data.links.map(l => {
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
      '<h1>YouTube URL Manager</h1><p>' + new Date().toLocaleString('ru-RU') + ' \u2014 ' + data.links.length + ' видео</p><hr>' +
      cards + '</body></html>';
  }

  function handleExport(format) {
    const modalId = 'export-progress-modal';
    const existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal" style="max-width:560px">
      <div class="modal__header"><h2>Экспорт данных (${_escHtml(format.toUpperCase())})</h2>
      <button class="modal__close" onclick="document.getElementById('${modalId}').remove()">×</button></div>
      <div class="modal__body"><p>Выполняется подготовка данных...</p>
      <div id="export-log-content" style="background:#1e1e1e;padding:10px;height:300px;overflow-y:auto;border-radius:4px;font-size:12px;border:1px solid #333"></div></div></div>`;
    document.body.appendChild(modal);
    Logger.logExport('Начало экспорта в формате: ' + format);
    const data = Storage.exportAll();
    Logger.logExport('Данные получены из хранилища. Ссылок: ' + data.links.length + ', Групп: ' + data.groups.length);
    if (data.settings.youtubeApiKey) Logger.logExport('Найден API ключ YouTube.');
    let content, filename, mime;
    switch (format) {
      case 'json': Logger.logExport('Формирование JSON...'); content = JSON.stringify(data, null, 2); filename = 'yt-manager-' + _dateStamp() + '.json'; mime = 'application/json'; break;
      case 'csv': Logger.logExport('Формирование CSV...'); content = _exportCSV(data); filename = 'yt-manager-' + _dateStamp() + '.csv'; mime = 'text/csv;charset=utf-8'; break;
      case 'html': Logger.logExport('Формирование HTML...'); content = _exportHTML(data); filename = 'yt-manager-' + _dateStamp() + '.html'; mime = 'text/html;charset=utf-8'; break;
      default: Logger.logExport('Неизвестный формат: ' + format, 'error'); alert('Неизвестный формат экспорта'); modal.remove(); return;
    }
    Logger.logExport('Файл подготовлен (' + (content.length / 1024).toFixed(2) + ' KB). Вызов скачивания...');
    _downloadFile(content, filename, mime);
    setTimeout(() => { const m = document.getElementById(modalId); if (m) m.remove(); }, 2000);
  }

  return { handleExport };
})();
