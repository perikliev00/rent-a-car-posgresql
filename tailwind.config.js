/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./views/**/*.ejs",
		"./public/js/**/*.js",
		"./controllers/**/*.js",
	],
	theme: {
		extend: {
			colors: {
				brand: {
					DEFAULT: '#0ea5e9',
					dark: '#0369a1',
				},
			},
			boxShadow: {
				brand: '0 10px 25px -5px rgba(2,132,199,0.45), 0 8px 10px -6px rgba(2,132,199,0.35)',
			},
		},
	},
	corePlugins: {
		// Avoid resetting existing site styles
		preflight: false,
	},
	plugins: [],
};


