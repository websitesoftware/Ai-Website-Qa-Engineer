# QA Remediation Report

**Target:** http://127.0.0.1:5501/Becoach-web/index.html
**Scan ID:** 3cafe3a1-85f7-4f45-ba56-88030a2a8b97
**Overall score:** 0/100
**Generated:** 2026-07-16T08:52:00.119Z

## Top priority: Does not use HTTPS
- **Severity:** High  |  **Priority score:** 88/100
- **Impact:** 23 open issues on http://127.0.0.1:5501/Becoach-web/index.html (0 critical, 19 high). Top item is a high lighthouse issue, one of 20 in that category.
- **Observed location:** `http://127.0.0.1:5501/Becoach-web/index.html`
- **Analysis:** All sites should be protected with HTTPS, even ones that don't handle sensitive data. This includes avoiding , where some resources are loaded over HTTP despite the initial request being served over HTTPS. HTTPS prevents intruders from tampering with or passively listening in on the communications between your app and your users, and is a prerequisite for HTTP/2 and many new web platform APIs. .. Current value: 1 insecure request found Lighthouse flags this at the page level rather than a single line.

### Suggested fix
```diff
- // Lighthouse: Does not use HTTPS
+ // Remediation: Current value: 1 insecure request found
```

## All prioritized issues
| # | Severity | Category | Score | Issue | URL |
|---|----------|----------|-------|-------|-----|
| 1 | High | lighthouse | 88 | Does not use HTTPS | http://127.0.0.1:5501/Becoach-web/index.html |
| 2 | High | lighthouse | 88 | Browser errors were logged to the console | http://127.0.0.1:5501/Becoach-web/index.html |
| 3 | High | lighthouse | 88 | Displays images with incorrect aspect ratio | http://127.0.0.1:5501/Becoach-web/index.html |
| 4 | High | lighthouse | 88 | Serves images with low resolution | http://127.0.0.1:5501/Becoach-web/index.html |
| 5 | High | lighthouse | 88 | Background and foreground colors do not have a sufficient contrast ratio. | http://127.0.0.1:5501/Becoach-web/index.html |
| 6 | High | lighthouse | 88 | Heading elements are not in a sequentially-descending order | http://127.0.0.1:5501/Becoach-web/index.html |
| 7 | High | lighthouse | 88 | Links do not have a discernible name | http://127.0.0.1:5501/Becoach-web/index.html |
| 8 | High | lighthouse | 88 | Reduce unused CSS | http://127.0.0.1:5501/Becoach-web/index.html |
| 9 | High | lighthouse | 88 | Document does not have a meta description | http://127.0.0.1:5501/Becoach-web/index.html |
| 10 | High | lighthouse | 88 | Page prevented back/forward cache restoration | http://127.0.0.1:5501/Becoach-web/index.html |