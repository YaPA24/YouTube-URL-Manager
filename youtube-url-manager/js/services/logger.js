const Logger = (() => {
  const importLogs = [];
  const exportLogs = [];

  function _timestamp() {
    return new Date().toLocaleTimeString('en-GB', { 
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  }

  function log(moduleName, message, level = 'log') {
    const timestamp = _timestamp();
    const fullMessage = `${timestamp} [${moduleName}] ${message}`;
    switch (level.toLowerCase()) {
      case 'error': console.error(fullMessage); break;
      case 'warn': console.warn(fullMessage); break;
      case 'info': console.info(fullMessage); break;
      default: console.log(fullMessage);
    }
  }

  function logImport(msg, type = 'info') {
    const timestamp = _timestamp();
    const consoleMsg = `[IMPORT ${timestamp}] ${msg}`;
    if (type === 'error') console.error(consoleMsg);
    else if (type === 'warn') console.warn(consoleMsg);
    else console.log(consoleMsg);
    importLogs.push(consoleMsg);
    if (importLogs.length > 100) importLogs.shift();
    const logContainer = document.getElementById('import-log-content');
    if (logContainer) {
      const p = document.createElement('div');
      p.textContent = `> ${msg}`;
      p.style.color = type === 'error' ? '#ff6b6b' : (type === 'warn' ? '#ffd93d' : '#6bff6b');
      p.style.fontFamily = 'monospace';
      p.style.fontSize = '12px';
      p.style.marginBottom = '4px';
      logContainer.appendChild(p);
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  function logExport(msg, type = 'info') {
    const consoleMsg = `[EXPORT] ${msg}`;
    if (type === 'error') console.error(consoleMsg);
    else if (type === 'warn') console.warn(consoleMsg);
    else console.log(consoleMsg);
    exportLogs.push(consoleMsg);
    if (exportLogs.length > 100) exportLogs.shift();
    const logContainer = document.getElementById('export-log-content');
    if (logContainer) {
      const p = document.createElement('div');
      p.textContent = `> ${msg}`;
      p.style.color = type === 'error' ? '#ff6b6b' : (type === 'warn' ? '#ffd93d' : '#6bff6b');
      p.style.fontFamily = 'monospace';
      p.style.fontSize = '12px';
      p.style.marginBottom = '4px';
      logContainer.appendChild(p);
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  function clearImportLogs() { importLogs.length = 0; }
  function getImportLogs() { return importLogs; }
  function getExportLogs() { return exportLogs; }

  function downloadLog() {
    const lines = [];
    if (importLogs && importLogs.length > 0) {
      lines.push('=== IMPORT LOG ===');
      lines.push(...importLogs);
    }
    if (exportLogs && exportLogs.length > 0) {
      lines.push('');
      lines.push('=== EXPORT LOG ===');
      lines.push(...exportLogs);
    }
    if (!lines.length) { alert('Лог пуст'); return; }
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `internal-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { log, logImport, logExport, clearImportLogs, getImportLogs, getExportLogs, downloadLog };
})();
