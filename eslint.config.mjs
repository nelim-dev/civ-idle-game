import tsParser from "@typescript-eslint/parser";

export default [
    {
        ignores: [
            ".next/**",
            "node_modules/**",
            "out/**",
            "build/**",
            "coverage/**",
            "next-env.d.ts",
        ],
    },
    {
        files: ["**/*.{js,mjs,cjs,ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
    },
    {
        files: ["src/logic/**/*.{ts,tsx}"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["@/store", "@/store/*"],
                            message: "Logic не должен импортировать store. Используйте EventBus и serialize().",
                        },
                    ],
                },
            ],
        },
    },
];
