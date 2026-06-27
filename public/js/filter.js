document.addEventListener('DOMContentLoaded', () => {
  const pickerInputs = document.querySelectorAll('.js-auto-show-picker');
  pickerInputs.forEach((input) => {
    const show = () => {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      }
    };
    input.addEventListener('focus', show);
    input.addEventListener('click', show);
  });
});

