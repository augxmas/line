(() => {
  const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
  const excludedHeaders = /^(관리|기능|선택|작업)$/;

  function valueOf(row, index) {
    const cell = row.cells[index];
    if (!cell) return '';
    return (cell.dataset.sortValue || cell.textContent || '').trim();
  }

  function comparable(value) {
    const compact = value.replaceAll(',', '').replace(/\s*(명|건|개|원|%)$/, '');
    if (/^-?\d+(\.\d+)?$/.test(compact)) return { type: 'number', value: Number(compact) };
    if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.test(value)) {
      const timestamp = Date.parse(value.replaceAll('.', '-').replaceAll('/', '-'));
      if (!Number.isNaN(timestamp)) return { type: 'number', value: timestamp };
    }
    return { type: 'text', value };
  }

  function compare(left, right) {
    const a = comparable(left), b = comparable(right);
    if (a.type === 'number' && b.type === 'number') return a.value - b.value;
    return collator.compare(String(a.value), String(b.value));
  }

  function sortTable(table, header, index) {
    const direction = header.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
    table.querySelectorAll('thead th').forEach((cell) => {
      cell.removeAttribute('aria-sort');
      const indicator = cell.querySelector('.grid-sort-indicator');
      if (indicator) indicator.textContent = '↕';
    });
    header.setAttribute('aria-sort', direction);
    header.querySelector('.grid-sort-indicator').textContent = direction === 'ascending' ? '▲' : '▼';
    table.querySelectorAll(':scope > tbody').forEach((body) => {
      const rows = Array.from(body.rows);
      const sortable = rows.filter((row) => row.cells.length > 1 && !row.querySelector('td[colspan]'));
      const fixed = rows.filter((row) => !sortable.includes(row));
      sortable.sort((a, b) => {
        const result = compare(valueOf(a, index), valueOf(b, index));
        return direction === 'ascending' ? result : -result;
      });
      sortable.forEach((row) => body.append(row));
      fixed.forEach((row) => body.append(row));
    });
  }

  function enhance(table) {
    if (table.dataset.gridSortReady === '1' || table.dataset.sortable === 'false') return;
    const headers = table.querySelectorAll(':scope > thead > tr:last-child > th');
    if (!headers.length) return;
    table.dataset.gridSortReady = '1';
    headers.forEach((header, index) => {
      const label = (header.textContent || '').trim();
      if (!label || excludedHeaders.test(label) || header.dataset.sortable === 'false') return;
      header.tabIndex = 0;
      header.title = `${label} 정렬`;
      header.style.cursor = 'pointer';
      header.style.userSelect = 'none';
      const indicator = document.createElement('span');
      indicator.className = 'grid-sort-indicator';
      indicator.textContent = '↕';
      indicator.style.cssText = 'display:inline-block;margin-left:6px;color:#8491a5;font-size:.7em';
      header.append(indicator);
      const activate = () => sortTable(table, header, index);
      header.addEventListener('click', activate);
      header.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  function enhanceAll(root = document) {
    if (root.matches?.('table')) enhance(root);
    root.querySelectorAll?.('table').forEach(enhance);
  }

  document.addEventListener('DOMContentLoaded', () => {
    enhanceAll();
    new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) enhanceAll(node);
    }))).observe(document.body, { childList: true, subtree: true });
  });
})();
