'use strict';
(() => {
  let id = 0;
  window.TikaymiSearchableSelect = function(select, { placeholder = 'Escribe para buscar…', minOptions = 12, force = false, onSelect } = {}) {
    if (!select) return null;
    if (select.dataset.searchEnhanced) return select.searchableSelectRefresh?.() || null;
    if (!force && select.options.length < minOptions) return null;
    select.dataset.searchEnhanced = 'true';
    const readOptions = () => [...select.options].filter(option => option.value !== '').map(option => ({ value: option.value, label: option.textContent.trim(), option }));
    let options = readOptions();
    const selected = options.find(item => item.value === select.value);
    const wrapper = document.createElement('div'); wrapper.className = 'search-select';
    const input = document.createElement('input'); input.type = 'search'; input.className = 'search-select-input'; input.placeholder = placeholder; input.autocomplete = 'off'; input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', `search-select-${++id}`);
    const list = document.createElement('div'); list.className = 'search-select-options'; list.id = input.getAttribute('aria-controls'); list.setAttribute('role', 'listbox'); list.hidden = true;
    const required = select.required; select.required = false; select.hidden = true;
    input.required = required; input.value = selected?.label || '';
    let internalChange = false;
    select.addEventListener('change', () => {
      if (internalChange) return;
      const current = options.find(item => item.value === select.value);
      input.value = current?.label || '';
      input.setCustomValidity(required && !current ? 'Selecciona una opción de la lista.' : '');
    });
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); };
    const choose = item => {
      if (!item) return;
      const changed = select.value !== item.value;
      select.value = item.value; input.value = item.label; input.setCustomValidity(''); close();
      if (changed) { internalChange = true; select.dispatchEvent(new Event('change', { bubbles: true })); internalChange = false; }
      onSelect?.(item.option);
    };
    const render = () => {
      const query = input.value.trim().toLocaleLowerCase();
      const matches = options.filter(item => !query || item.label.toLocaleLowerCase().includes(query) || item.value.toLocaleLowerCase().includes(query));
      list.replaceChildren();
      if (!matches.length) {
        const empty = document.createElement('div'); empty.className = 'search-select-empty'; empty.textContent = 'No hay coincidencias'; list.append(empty);
      } else for (const item of matches.slice(0, 80)) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'search-select-option'; button.setAttribute('role', 'option'); button.textContent = item.label;
        button.addEventListener('mousedown', event => event.preventDefault()); button.addEventListener('click', () => choose(item)); list.append(button);
      }
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    };
    input.addEventListener('focus', render);
    input.addEventListener('input', () => {
      const exact = options.find(item => item.label.toLocaleLowerCase() === input.value.trim().toLocaleLowerCase());
      if (exact) choose(exact);
      else {
        if (select.value) { select.value = ''; internalChange = true; select.dispatchEvent(new Event('change', { bubbles: true })); internalChange = false; }
        input.setCustomValidity(input.value.trim() ? 'Elige una opción de la lista o borra el campo.' : required ? 'Selecciona una opción de la lista.' : '');
        render();
      }
    });
    input.addEventListener('keydown', event => {
      const choices = [...list.querySelectorAll('.search-select-option')];
      if (event.key === 'ArrowDown' && choices.length) { event.preventDefault(); choices[0].focus(); }
      else if (event.key === 'Escape') close();
    });
    list.addEventListener('keydown', event => {
      const choices = [...list.querySelectorAll('.search-select-option')], active = choices.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' && choices.length) { event.preventDefault(); choices[(active + 1) % choices.length].focus(); }
      else if (event.key === 'ArrowUp' && active > 0) { event.preventDefault(); choices[active - 1].focus(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); input.focus(); }
      else if (event.key === 'Escape') { close(); input.focus(); }
    });
    input.addEventListener('blur', () => setTimeout(() => { if (!wrapper.contains(document.activeElement)) close(); }, 0));
    wrapper.append(input, list); select.parentNode.insertBefore(wrapper, select);
    select.searchableSelectRefresh = () => { options = readOptions(); const current = options.find(item => item.value === select.value); input.value = current?.label || ''; input.setCustomValidity(required && !current ? 'Selecciona una opción de la lista.' : ''); return input; };
    return input;
  };
})();
