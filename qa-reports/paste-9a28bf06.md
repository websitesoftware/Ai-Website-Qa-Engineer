# QA Remediation Report

**Target:** http://192.168.1.5:3000/
**Scan ID:** ac865d39-571a-4df7-8ea6-444b7ccd14cd
**Overall score:** 0/100
**Generated:** 2026-07-16T10:41:31.997Z

## Top priority: Page prevented back/forward cache restoration
- **Severity:** High  |  **Priority score:** 88/100
- **Impact:** A high lighthouse issue on http://192.168.1.5:3000/. One of 20 in that category.
- **Observed location:** `http://192.168.1.5:3000/`
- **Analysis:** Many navigations are performed by going back to a previous page, or forwards again. The back/forward cache (bfcache) can speed up these return navigations.. Current value: 4 failure reasons Lighthouse flags this at the page level rather than a single line.

### Suggested fix
```diff
- // Lighthouse: Page prevented back/forward cache restoration
+ // Remediation: Current value: 4 failure reasons
```

## All prioritized issues
| # | Severity | Category | Score | Issue | URL |
|---|----------|----------|-------|-------|-----|
| 1 | High | lighthouse | 88 | Page prevented back/forward cache restoration | http://192.168.1.5:3000/ |