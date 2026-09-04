/* ============================================================
import.js — Модуль импорта данных
YouTube URL Manager
============================================================ */
const Import = (() => {
  let importMode = '';

  function setMode(mode) {
    importMode = mode;
  }

  function getMode() {
    return importMode;
  }

  function clearMode() {
    importMode = '';
  }

  function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    Logger.clearImportLogs();
    
    const modalId = 'import-progress-modal';
    const existingModal = document.getElementById(modalId);
    
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay';
    
    modal.innerHTML = `
      <div class="modal" style="max-width:560px">
        <div class="modal__header">
          <h2>Импорт данных</h2>
          <button class="modal__close" onclick="document.getElementById('${modalId}').remove()">×</button>
        </div>
        <div class="modal__body">
          <p>Выполняется импорт...</p>
          <div id="import-log-content" style="
            background:#1e1e1e;
            padding:10px;
            height:300px;
            overflow-y:auto;
            border-radius:4px;
            font-size:12px;
            border:1px solid #333;
          "></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    Logger.logImport('Чтение файла...');
    
    const reader = new FileReader();
    
    reader.onload = function(ev) {
      try {
        const c = ev.target.result;
        
        Logger.logImport(`Файл прочитан (${(c.length / 1024).toFixed(2)} KB)`);
        
        if (!importMode) {
          throw new Error('Не выбран режим импорта');
        }
        
        if (importMode === 'bookmarks' || importMode === 'bookmarks-file') {
          Logger.logImport('Обработка HTML-файла закладок...');
          
          const createNewGroup = importMode === 'bookmarks-file';
          const r = Storage.importBookmarks(c, createNewGroup);
          
          if (r.success) {
            const action = createNewGroup && r.groupName
              ? ` в новую папку "${r.groupName}"`
              : '';
            
            Logger.logImport(`Закладки: ${r.found} найдено, ${r.added} добавлено${action}.`);
            alert(`Закладки: ${r.added} добавлено${action}`);
            
            // Вызываем callback для обновления UI
            if (window.App && window.App.refreshAll) {
              window.App.refreshAll();
            }
          } else {
            Logger.logImport(`КРИТИЧЕСКАЯ ОШИБКА: ${r.error}`, 'error');
            alert('Ошибка: ' + r.error);
          }
        } else if (importMode === 'json-file') {
          Logger.logImport('Парсинг JSON...');
          
          let data;
          
          try {
            data = JSON.parse(c);
          } catch (parseErr) {
            throw new Error(`Ошибка парсинга JSON: ${parseErr.message}`);
          }
          
          Logger.logImport('JSON успешно распарсен.');
          
          if (!data) {
            throw new Error('Пустой файл данных');
          }
          
          if (!Array.isArray(data.links)) {
            Logger.logImport('Предупреждение: поле "links" не найдено или не является массивом.', 'warn');
            data.links = [];
          }
          
          if (!data.settings || typeof data.settings !== 'object') {
            Logger.logImport('Предупреждение: поле "settings" не найдено.', 'warn');
            data.settings = {};
          }
          
          if (!Array.isArray(data.groups)) {
            data.groups = [];
          }
          
          Logger.logImport(`Найдено ссылок: ${data.links.length}`);
          Logger.logImport(`Найдено групп: ${data.groups.length}`);
          
          if (data.settings.youtubeApiKey) {
            Logger.logImport('Найден API ключ YouTube.');
          }
          
          Logger.logImport('Запись данных в хранилище...');
          
          const r = Storage.importJSON(data, false);
          
          Logger.logImport(`Storage.importJSON returned: success=${r.success}, linksAdded=${r.linksAdded}, groupsAdded=${r.groupsAdded}, settingsUpdated=${r.settingsUpdated}, error=${r.error || ''}`);
          
          if (r.success) {
            Logger.logImport(`Успешно импортировано: ${r.linksAdded} новых ссылок.`);
            
            if (r.groupsAdded) {
              Logger.logImport(`Добавлено групп: ${r.groupsAdded}.`);
            }
            
            if (r.settingsUpdated) {
              Logger.logImport('Настройки обновлены.');
            }
            
            // Вызываем callback для обновления UI
            if (window.App && window.App.refreshAll) {
              window.App.refreshAll();
            }
            
            alert(`Импорт завершен: ${r.linksAdded} новых ссылок.`);
          } else {
            Logger.logImport(`Ошибка импорта: ${r.error}`, 'error');
            alert(`Ошибка импорта: ${r.error}`);
          }
        } else {
          throw new Error('Неизвестный режим импорта: ' + importMode);
        }
        
        clearMode();
        
        setTimeout(() => {
          const m = document.getElementById(modalId);
          if (m) m.remove();
        }, 2000);
      } catch (err) {
        Logger.logImport(`КРИТИЧЕСКАЯ ОШИБКА: ${err.message}`, 'error');
        alert(`Ошибка импорта: ${err.message}`);
        clearMode();
      }
    };
    
    reader.onerror = function() {
      Logger.logImport('Ошибка чтения файла', 'error');
      alert('Ошибка чтения файла');
      clearMode();
    };
    
    reader.readAsText(file);
    e.target.value = '';
  }

  return {
    setMode,
    getMode,
    clearMode,
    handleFileImport
  };
})();
