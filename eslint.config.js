import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";

export default defineConfig([
	{
		files: ["**/*.{js,mjs,cjs}"],
		plugins: { js },
		extends: ["js/recommended"],
		rules: {
			"no-unused-vars": "off", // Disable the no-unused-vars rule
		  },
	},
	{
		files: ["**/*.{js,mjs,cjs}"],
		languageOptions: {
			globals: {
				...globals.node, // Use Node.js globals
				...globals.es2021, // Or your desired ECMAScript version
			},
		},
	},
]);
