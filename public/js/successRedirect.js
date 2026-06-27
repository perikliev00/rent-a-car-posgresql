(function () {
  const countdownElement = document.getElementById('countdown');
  if (!countdownElement) {
    return;
  }

  let timeLeft = parseInt(countdownElement.textContent, 10);
  if (Number.isNaN(timeLeft) || timeLeft < 1) {
    timeLeft = 4;
  }

  const timer = setInterval(function () {
    timeLeft -= 1;
    countdownElement.textContent = String(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(timer);
      window.location.href = '/';
    }
  }, 1000);
})();
