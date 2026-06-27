// requireAuth защитава routes достъпни само за логнати потребители.
function requireAuth(req, res, next) {
	// Разрешаваме заявката само когато session съществува и login флагът е сетнат.
	if (req.session && req.session.isLoggedIn) {
		// Потребителят е удостоверен – предаваме контрола на следващия middleware/controller.
		return next();
	}
	// Неудостоверени потребители се пренасочват към login страницата.
	return res.redirect('/login');
}

// requireGuest е обратното – блокира логнати потребители от guest-only страници (login/signup).
function requireGuest(req, res, next) {
	// Ако посетителят вече е логнат – няма смисъл да показваме guest екрани отново.
	if (req.session && req.session.isLoggedIn) {
		// Пренасочваме удостоверените потребители към home.
		return res.redirect('/');
	}
	// Guest потребителите могат да продължат.
	return next();
}

// requireAdmin е по-стриктно – изисква и auth, и admin роля в session payload.
function requireAdmin(req, res, next) {
	// Първа проверка: session с isLoggedIn и съхранен user обект.
	if (!req.session || !req.session.isLoggedIn || !req.session.user) {
		// Липсваща auth/session – потребителят трябва първо да се логне.
		return res.redirect('/login');
	}

	// Втора проверка: дори логнати потребители се отхвърлят ако ролята не е admin.
	if (req.session.user.role !== 'admin') {
		// Non-admin се пренасочват от admin страниците.
		return res.redirect('/');
	}

	// И двете проверки са минати – admin route може да се изпълни безопасно.
	return next();
}

// Експорт на трите auth middleware – routes да композират access правилата.
module.exports = { requireAuth, requireGuest, requireAdmin };
