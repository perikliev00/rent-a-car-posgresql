/**
 * Custom Dropdown Component
 * Replaces native HTML <select> elements with styled custom dropdowns
 * while maintaining full form functionality and accessibility.
 */

(function() {
  'use strict';

  /**
   * CustomDropdown class - handles individual dropdown instance
   */
  class CustomDropdown {
    constructor(selectElement) {
      this.select = selectElement;
      this.wrapper = null;
      this.button = null;
      this.menu = null;
      this.options = [];
      this.selectedIndex = -1;
      this.highlightedIndex = -1;
      this.isOpen = false;
      this.portalParent = null;
      this.portalNextSibling = null;
      this.rafPositionId = null;
      this.outsideClickHandler = null;
      
      this.init();
    }

    /**
     * Initialize the dropdown component
     */
    init() {
      // Create wrapper structure
      this.createWrapper();
      
      // Extract options from original select
      this.extractOptions();
      
      // Create custom dropdown UI
      this.createButton();
      this.createMenu();
      
      // Set initial selected value
      this.setInitialValue();
      
      // Hide original select
      this.select.style.display = 'none';
      
      // Attach event listeners
      this.attachEvents();
    }

    /**
     * Create wrapper div around the original select
     */
    createWrapper() {
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'custom-dropdown';
      this.select.parentNode.insertBefore(this.wrapper, this.select);
      this.wrapper.appendChild(this.select);
    }

    /**
     * Extract options from original select element
     */
    extractOptions() {
      const options = this.select.querySelectorAll('option');
      options.forEach((option, index) => {
        this.options.push({
          value: option.value,
          text: option.textContent.trim(),
          disabled: option.disabled,
          selected: option.selected
        });
        if (option.selected) {
          this.selectedIndex = index;
        }
      });
    }

    /**
     * Create the dropdown button
     */
    createButton() {
      this.button = document.createElement('button');
      this.button.type = 'button';
      this.button.className = 'custom-dropdown-toggle';
      this.button.setAttribute('aria-haspopup', 'listbox');
      this.button.setAttribute('aria-expanded', 'false');
      this.button.setAttribute('aria-labelledby', this.select.id || '');
      
      const selectedSpan = document.createElement('span');
      selectedSpan.className = 'custom-dropdown-selected';
      selectedSpan.textContent = this.getSelectedText();
      
      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'custom-dropdown-arrow';
      arrowSpan.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      
      this.button.appendChild(selectedSpan);
      this.button.appendChild(arrowSpan);
      this.wrapper.appendChild(this.button);
    }

    /**
     * Create the dropdown menu
     */
    createMenu() {
      this.menu = document.createElement('ul');
      this.menu.className = 'custom-dropdown-menu';
      this.menu.setAttribute('role', 'listbox');
      this.menu.setAttribute('aria-labelledby', this.select.id || '');
      this.menu.hidden = true;
      
      this.options.forEach((option, index) => {
        const li = document.createElement('li');
        li.className = 'custom-dropdown-option';
        li.setAttribute('role', 'option');
        li.setAttribute('data-value', option.value);
        li.setAttribute('data-index', index);
        li.textContent = option.text;
        
        if (option.disabled) {
          li.classList.add('disabled');
          li.setAttribute('aria-disabled', 'true');
        }
        
        if (index === this.selectedIndex) {
          li.classList.add('selected');
          li.setAttribute('aria-selected', 'true');
        }
        
        this.menu.appendChild(li);
      });
      
      this.wrapper.appendChild(this.menu);
    }

    /**
     * Set initial selected value
     */
    setInitialValue() {
      if (this.selectedIndex >= 0) {
        const selectedOption = this.options[this.selectedIndex];
        this.updateButtonText(selectedOption.text);
        this.updateSelectedOption(this.selectedIndex);
      } else if (this.options.length > 0) {
        // If no option is selected, select the first one
        this.selectedIndex = 0;
        const firstOption = this.options[0];
        this.updateButtonText(firstOption.text);
        this.updateSelectedOption(0);
        this.updateOriginalSelect(firstOption.value);
      }
    }

    /**
     * Get selected option text
     */
    getSelectedText() {
      if (this.selectedIndex >= 0 && this.options[this.selectedIndex]) {
        return this.options[this.selectedIndex].text;
      }
      return 'Select...';
    }

    /**
     * Update button text
     */
    updateButtonText(text) {
      const selectedSpan = this.button.querySelector('.custom-dropdown-selected');
      if (selectedSpan) {
        selectedSpan.textContent = text;
      }
    }

    /**
     * Update selected option styling
     */
    updateSelectedOption(index) {
      const allOptions = this.menu.querySelectorAll('.custom-dropdown-option');
      allOptions.forEach((opt, i) => {
        opt.classList.remove('selected');
        opt.removeAttribute('aria-selected');
        if (i === index) {
          opt.classList.add('selected');
          opt.setAttribute('aria-selected', 'true');
        }
      });
    }

    /**
     * Update original select value (for form submission)
     */
    updateOriginalSelect(value) {
      if (this.select) {
        this.select.value = value;
        // Trigger change event on original select for form validation
        const changeEvent = new Event('change', { bubbles: true });
        this.select.dispatchEvent(changeEvent);
      }
    }

    /**
     * Open dropdown menu
     */
    open() {
      if (this.isOpen) return;
      
      // Close other dropdowns
      CustomDropdown.closeAll(this);
      
      this.isOpen = true;
      this.menu.hidden = false;
      this.button.setAttribute('aria-expanded', 'true');
      this.button.classList.add('active');
      this.wrapper.classList.add('open');

      // Portal menu to <body> and position with `fixed` to escape stacking contexts.
      // This avoids transforms/backdrop-filter parents changing the fixed containing block.
      this.portalMenuToBody();
      this.updatePortalPosition();
      
      // Scroll selected option into view
      const selectedOption = this.menu.querySelector('.custom-dropdown-option.selected');
      if (selectedOption) {
        selectedOption.scrollIntoView({ block: 'nearest' });
      }
      
      // Focus management
      this.button.focus();
    }
    
    /**
     * Portal the menu element to <body> so it's not affected by parent stacking contexts.
     */
    portalMenuToBody() {
      if (!this.portalParent) {
        this.portalParent = this.menu.parentNode;
        this.portalNextSibling = this.menu.nextSibling;
      }

      if (this.menu.parentNode !== document.body) {
        document.body.appendChild(this.menu);
      }

      this.menu.classList.add('custom-dropdown-portal-menu');
      // "open" visual state must not depend on `.custom-dropdown.open .custom-dropdown-menu`
      this.menu.classList.add('is-open');
    }

    /**
     * Restore menu back to its original place in the dropdown wrapper.
     */
    restoreMenuFromPortal() {
      this.menu.classList.remove('is-open');
      this.menu.classList.remove('open-up');
      this.menu.classList.remove('custom-dropdown-portal-menu');

      // Reset inline positioning styles
      this.menu.style.position = '';
      this.menu.style.top = '';
      this.menu.style.left = '';
      this.menu.style.width = '';
      this.menu.style.right = '';

      if (this.portalParent && this.menu.parentNode === document.body) {
        if (this.portalNextSibling && this.portalNextSibling.parentNode === this.portalParent) {
          this.portalParent.insertBefore(this.menu, this.portalNextSibling);
        } else {
          this.portalParent.appendChild(this.menu);
        }
      }
    }

    /**
     * Clamp and flip positioning for the portaled fixed menu.
     * Uses viewport coords from getBoundingClientRect() (no scroll offsets).
     */
    updatePortalPosition() {
      if (!this.isOpen) return;

      const rect = this.button.getBoundingClientRect();
      const menu = this.menu;

      // Ensure fixed overlay dominance
      menu.style.position = 'fixed';
      menu.style.right = 'auto';

      const width = rect.width;
      const gutter = 8;
      let left = rect.left;

      // Clamp horizontally in viewport
      if (left + width > window.innerWidth - gutter) {
        left = Math.max(gutter, window.innerWidth - width - gutter);
      } else {
        left = Math.max(gutter, left);
      }

      menu.style.width = `${Math.round(width)}px`;
      menu.style.left = `${Math.round(left)}px`;

      // Compute menu height (respect max-height)
      const computed = window.getComputedStyle(menu);
      const maxH = parseFloat(computed.maxHeight) || 300;
      const menuHeight = Math.min(menu.scrollHeight, maxH);

      const belowTop = rect.bottom + 4;
      const wouldOverflowBottom = belowTop + menuHeight + gutter > window.innerHeight;

      if (wouldOverflowBottom) {
        // Open upward
        const top = Math.max(gutter, rect.top - 4 - menuHeight);
        menu.style.top = `${Math.round(top)}px`;
        menu.classList.add('open-up');
      } else {
        // Open downward
        menu.style.top = `${Math.round(belowTop)}px`;
        menu.classList.remove('open-up');
      }
    }

    requestPortalPositionUpdate() {
      if (!this.isOpen) return;
      if (this.rafPositionId) return;
      this.rafPositionId = window.requestAnimationFrame(() => {
        this.rafPositionId = null;
        this.updatePortalPosition();
      });
    }

    /**
     * Close dropdown menu
     */
    close(returnFocus = false) {
      if (!this.isOpen) return;
      
      this.isOpen = false;
      this.menu.hidden = true;
      this.button.setAttribute('aria-expanded', 'false');
      this.button.classList.remove('active');
      this.wrapper.classList.remove('open');

      // Restore from portal + clear inline styles/classes
      this.restoreMenuFromPortal();
      
      // Reset keyboard navigation
      this.selectedIndex = this.getCurrentSelectedIndex();
      this.highlightedIndex = -1;
      
      // Remove highlight from all options
      this.menu.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        opt.classList.remove('highlighted');
      });

      if (returnFocus) {
        this.button.focus();
      }
    }

    /**
     * Toggle dropdown menu
     */
    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    /**
     * Select an option by index
     */
    selectOption(index) {
      if (index < 0 || index >= this.options.length) return;
      
      const option = this.options[index];
      if (option.disabled) return;
      
      this.selectedIndex = index;
      this.updateButtonText(option.text);
      this.updateSelectedOption(index);
      this.updateOriginalSelect(option.value);
      
      this.close(true);
      
      // Trigger custom event
      const customEvent = new CustomEvent('customDropdownChange', {
        detail: { value: option.value, text: option.text, index: index },
        bubbles: true
      });
      this.wrapper.dispatchEvent(customEvent);
      
      // Handle onchange attribute (e.g., for auto-submit on category change)
      if (this.select.hasAttribute('onchange')) {
        const onchangeAttr = this.select.getAttribute('onchange');
        // If it's a form submit, trigger it
        if (onchangeAttr.includes('submit') || onchangeAttr.includes('form.submit')) {
          const form = this.select.closest('form');
          if (form) {
            // Small delay to ensure select value is updated
            setTimeout(() => {
              form.submit();
            }, 10);
          }
        }
      }
    }

    /**
     * Get current selected index from original select
     */
    getCurrentSelectedIndex() {
      const value = this.select ? this.select.value : '';
      return this.options.findIndex(opt => opt.value === value);
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyDown(event) {
      if (!this.isOpen) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          this.open();
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.navigateOptions(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.navigateOptions(-1);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (this.highlightedIndex >= 0) {
            this.selectOption(this.highlightedIndex);
          }
          break;
        case 'Escape':
          event.preventDefault();
          this.close(true);
          break;
        case 'Home':
          event.preventDefault();
          this.highlightOption(0);
          break;
        case 'End':
          event.preventDefault();
          this.highlightOption(this.options.length - 1);
          break;
      }
    }

    /**
     * Navigate through options with arrow keys
     */
    navigateOptions(direction) {
      let newIndex = this.highlightedIndex >= 0 ? this.highlightedIndex : this.selectedIndex;
      
      // Find next enabled option
      do {
        newIndex += direction;
        if (newIndex < 0) newIndex = this.options.length - 1;
        if (newIndex >= this.options.length) newIndex = 0;
        
        // Prevent infinite loop if all options are disabled
        if (newIndex === (this.highlightedIndex >= 0 ? this.highlightedIndex : this.selectedIndex)) {
          break;
        }
      } while (this.options[newIndex].disabled);
      
      this.highlightOption(newIndex);
    }

    /**
     * Highlight an option (for keyboard navigation)
     */
    highlightOption(index) {
      this.highlightedIndex = index;
      
      const allOptions = this.menu.querySelectorAll('.custom-dropdown-option');
      allOptions.forEach((opt, i) => {
        opt.classList.remove('highlighted');
        if (i === index) {
          opt.classList.add('highlighted');
          opt.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    /**
     * Attach event listeners
     */
    attachEvents() {
      // Button click
      this.button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });

      // Option click
      this.menu.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-dropdown-option');
        if (option && !option.classList.contains('disabled')) {
          const index = parseInt(option.getAttribute('data-index'), 10);
          this.selectOption(index);
        }
      });

      // Keyboard navigation
      this.button.addEventListener('keydown', (e) => {
        this.handleKeyDown(e);
      });

      this.menu.addEventListener('keydown', (e) => {
        this.handleKeyDown(e);
      });

      // Close on outside click
      this.outsideClickHandler = (e) => {
        // When menu is portaled to <body>, it's not inside wrapper.
        if (!this.wrapper.contains(e.target) && !this.menu.contains(e.target)) {
          this.close(false);
        }
      };
      document.addEventListener('click', this.outsideClickHandler);

      // Prevent menu from closing when clicking inside
      this.menu.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      // Handle window resize - update position if open
      this.resizeHandler = () => {
        if (this.isOpen) {
          this.requestPortalPositionUpdate();
        }
      };
      window.addEventListener('resize', this.resizeHandler);
      
      // Handle window scroll - update position if open
      this.scrollHandler = () => {
        if (this.isOpen) {
          this.requestPortalPositionUpdate();
        }
      };
      window.addEventListener('scroll', this.scrollHandler, true);
    }

    /**
     * Destroy dropdown instance
     */
    destroy() {
      // Remove event listeners
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }
      if (this.scrollHandler) {
        window.removeEventListener('scroll', this.scrollHandler, true);
      }
      if (this.outsideClickHandler) {
        document.removeEventListener('click', this.outsideClickHandler);
      }
      if (this.rafPositionId) {
        window.cancelAnimationFrame(this.rafPositionId);
        this.rafPositionId = null;
      }
      
      if (this.wrapper && this.wrapper.parentNode) {
        this.select.style.display = '';
        this.wrapper.parentNode.insertBefore(this.select, this.wrapper);
        this.wrapper.remove();
      }
    }

    /**
     * Static method to close all dropdowns except the given one
     */
    static closeAll(except) {
      document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
        const instance = dropdown._customDropdownInstance;
        if (instance && instance !== except && instance.isOpen) {
          instance.close();
        }
      });
    }
  }

  /**
   * Initialize all custom dropdowns on page load
   */
  function initCustomDropdowns() {
    // Find all select elements in .form-row containers
    const formRowSelects = document.querySelectorAll('.form-row select');
    
    // Find all .filters-select elements in filters-aside
    const filtersSelects = document.querySelectorAll('.filters-select');
    
    // Combine both selectors
    const allSelects = [...formRowSelects, ...filtersSelects];
    
    allSelects.forEach(select => {
      // Skip if already initialized
      if (select._customDropdownInitialized) return;
      
      // Create dropdown instance
      const dropdown = new CustomDropdown(select);
      
      // Store reference
      select._customDropdownInitialized = true;
      select._customDropdownInstance = dropdown;
      if (dropdown.wrapper) {
        dropdown.wrapper._customDropdownInstance = dropdown;
      }
    });
  }

  /**
   * Reinitialize dropdowns (useful for dynamically added content)
   */
  function reinitCustomDropdowns() {
    const formRowSelects = document.querySelectorAll('.form-row select');
    const filtersSelects = document.querySelectorAll('.filters-select');
    const allSelects = [...formRowSelects, ...filtersSelects];
    
    allSelects.forEach(select => {
      if (select._customDropdownInstance) {
        select._customDropdownInstance.destroy();
        select._customDropdownInitialized = false;
      }
    });
    initCustomDropdowns();
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomDropdowns);
  } else {
    initCustomDropdowns();
  }

  // Export for global access if needed
  window.CustomDropdown = CustomDropdown;
  window.reinitCustomDropdowns = reinitCustomDropdowns;
})();

