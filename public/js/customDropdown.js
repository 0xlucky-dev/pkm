/**
 * Custom Dropdown Component — Dark Glass UI
 * Replaces native <select> with a styled dropdown that supports icons.
 * Usage: CustomDropdown.init(selectElement) — converts a <select> into custom dropdown.
 */

const CustomDropdown = (() => {
  'use strict';

  // Utility: get ball icon slug
  function getBallSlug(name) {
    return name.toLowerCase().replace(/[éè]/g, 'e').replace(/[^a-z]/g, '');
  }

  /**
   * Convert a native <select> into a custom dropdown.
   * @param {HTMLSelectElement} select - The select element to replace.
   * @param {Object} opts - Options: { icons: boolean, iconPath: string, maxHeight: string }
   */
  function init(select, opts = {}) {
    if (!select || select.dataset.customDropdown === 'true') return;
    select.dataset.customDropdown = 'true';

    const { icons = false, iconPath = '/icons/', maxHeight = '200px' } = opts;

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'cd-wrap';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.style.display = 'none';

    // Build button (trigger)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cd-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');

    const selectedOpt = select.options[select.selectedIndex];
    btn.innerHTML = buildBtnContent(selectedOpt, icons, iconPath);
    wrapper.appendChild(btn);

    // Build dropdown menu
    const menu = document.createElement('div');
    menu.className = 'cd-menu';
    menu.style.maxHeight = maxHeight;
    menu.setAttribute('role', 'listbox');

    // Search input inside menu (for long lists)
    const options = Array.from(select.options);
    let searchInput = null;
    if (options.length > 8) {
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'cd-search';
      searchInput.placeholder = 'Search...';
      searchInput.autocomplete = 'off';
      menu.appendChild(searchInput);
    }

    // Options container
    const optionsList = document.createElement('div');
    optionsList.className = 'cd-options';
    menu.appendChild(optionsList);

    let optionsRendered = false;

    // Render options lazily — only called when menu opens for the first time,
    // or when search filter changes. This avoids building thousands of DOM nodes
    // upfront for large lists (e.g. 400+ move options × 4 slots).
    function renderOptions(filter = '') {
      optionsList.innerHTML = '';
      const lowerFilter = filter.toLowerCase();

      function renderOption(opt) {
        if (lowerFilter && !opt.textContent.toLowerCase().includes(lowerFilter)) return;

        const item = document.createElement('div');
        item.className = 'cd-item' + (opt.value === select.value ? ' cd-item--active' : '');
        item.dataset.value = opt.value;
        item.setAttribute('role', 'option');

        if (icons && opt.value) {
          const slug = getBallSlug(opt.value);
          item.innerHTML = `<img src="${iconPath}${slug}.png" class="cd-item-icon" width="20" height="20" alt="" onerror="this.style.display='none'"><span>${opt.textContent}</span>`;
        } else if (opt.dataset && opt.dataset.type) {
          const typeSlug = opt.dataset.type.toLowerCase();
          item.innerHTML = `<img src="/icons/types/${typeSlug}.svg" class="cd-item-icon" width="16" height="16" alt="${opt.dataset.type}" onerror="this.style.display='none'"><span>${opt.textContent}</span>`;
        } else {
          item.innerHTML = `<span>${opt.textContent}</span>`;
        }
        optionsList.appendChild(item);
      }

      for (const node of select.children) {
        if (node.tagName === 'OPTGROUP') {
          const groupOpts = Array.from(node.children);
          const visible = !lowerFilter || groupOpts.some((o) => o.textContent.toLowerCase().includes(lowerFilter));
          if (!visible) continue;

          const header = document.createElement('div');
          header.className = 'cd-group-header';
          const groupType = node.dataset.type;
          if (groupType) {
            const typeSlug = groupType.toLowerCase();
            header.innerHTML = `<img src="/icons/types/${typeSlug}.svg" class="cd-group-header-icon" width="14" height="14" alt="" onerror="this.style.display='none'"><span>${node.label}</span>`;
          } else {
            header.textContent = node.label;
          }
          optionsList.appendChild(header);
          groupOpts.forEach(renderOption);
        } else if (node.tagName === 'OPTION') {
          renderOption(node);
        }
      }
      optionsRendered = true;
    }

    // Do NOT call renderOptions() here — defer to first open
    wrapper.appendChild(menu);

    // Toggle menu
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close all other open custom dropdowns first
      document.querySelectorAll('.cd-wrap.cd-open').forEach(w => {
        if (w !== wrapper) {
          w.classList.remove('cd-open');
          const b = w.querySelector('.cd-btn');
          if (b) b.setAttribute('aria-expanded', 'false');
        }
      });
      const isOpen = wrapper.classList.toggle('cd-open');
      btn.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        // Lazy-render options on first open
        if (!optionsRendered) renderOptions();
        positionMenu();
        if (searchInput) {
          searchInput.value = '';
          renderOptions();
          setTimeout(() => searchInput.focus(), 50);
        }
        // Dispatch custom event so external code can update indicators
        select.dispatchEvent(new Event('cd-open', { bubbles: true }));
      }
    });

    // Dropdown always opens downward. The overlay body is scrollable and has
    // enough bottom padding, so flipping upward is unnecessary and confusing.
    function positionMenu() {
      wrapper.classList.remove('cd-open--up');
    }

    // Search filter
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderOptions(searchInput.value);
      });
      searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    // Select option
    optionsList.addEventListener('click', (e) => {
      const item = e.target.closest('.cd-item');
      if (!item) return;
      const val = item.dataset.value;
      select.value = val;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      btn.innerHTML = buildBtnContent(select.options[select.selectedIndex], icons, iconPath);
      wrapper.classList.remove('cd-open');
      btn.setAttribute('aria-expanded', 'false');
      // Update active state
      optionsList.querySelectorAll('.cd-item').forEach(i => i.classList.remove('cd-item--active'));
      item.classList.add('cd-item--active');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        wrapper.classList.remove('cd-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    // Return wrapper for reference
    return wrapper;
  }

  function buildBtnContent(option, icons, iconPath) {
    if (!option) return '<span class="cd-placeholder">Select...</span>';
    const text = option.textContent;
    const value = option.value;
    if (!value) return `<span class="cd-placeholder">${text}</span><svg class="cd-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;

    if (icons && value) {
      const slug = getBallSlug(value);
      return `<img src="${iconPath}${slug}.png" class="cd-btn-icon" width="20" height="20" alt="" onerror="this.style.display='none'"><span>${text}</span><svg class="cd-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
    }

    // Show type icon in the button when a move with data-type is selected
    if (option.dataset && option.dataset.type) {
      const typeSlug = option.dataset.type.toLowerCase();
      return `<img src="/icons/types/${typeSlug}.svg" class="cd-btn-icon" width="16" height="16" alt="${option.dataset.type}" onerror="this.style.display='none'"><span>${text}</span><svg class="cd-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
    }

    return `<span>${text}</span><svg class="cd-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
  }

  /**
   * Initialize all selects in a container.
   * Ball select gets icons, others get plain custom dropdown.
   */
  function initAll(container) {
    const selects = container.querySelectorAll('select');
    selects.forEach(sel => {
      // Skip form select, hidden OT gender, and hidden/locked selects
      if (sel.id === 'cfg-form') return;
      if (sel.id === 'cfg-ot-gender') return;
      if (sel.style.display === 'none') return;

      const isBall = sel.id === 'cfg-ball';
      const isMove = sel.id && sel.id.startsWith('cfg-move');
      init(sel, {
        icons: isBall,
        iconPath: '/icons/',
        maxHeight: isMove ? '320px' : (isBall ? '300px' : '300px'),
      });
    });
  }

  return { init, initAll };
})();

window.CustomDropdown = CustomDropdown;
