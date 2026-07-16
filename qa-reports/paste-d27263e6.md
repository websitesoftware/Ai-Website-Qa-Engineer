# QA Remediation Report

**Target:** http://192.168.1.5:3000/
**Scan ID:** ac865d39-571a-4df7-8ea6-444b7ccd14cd
**Overall score:** 0/100
**Generated:** 2026-07-16T10:39:43.714Z

## Top priority: Does not use HTTPS
- **Severity:** High  |  **Priority score:** 88/100
- **Impact:** A high lighthouse issue on http://192.168.1.5:3000/. One of 20 in that category.
- **Observed location:** `http://192.168.1.5:3000/`
- **Analysis:** All sites should be protected with HTTPS, even ones that don't handle sensitive data. This includes avoiding , where some resources are loaded over HTTP despite the initial request being served over HTTPS. HTTPS prevents intruders from tampering with or passively listening in on the communications between your app and your users, and is a prerequisite for HTTP/2 and many new web platform APIs. .. Current value: 13 insecure requests found Lighthouse flags this at the page level rather than a single line.

### Suggested fix
```diff
- // Lighthouse: Does not use HTTPS
+ // Remediation: Current value: 13 insecure requests found
```

## All prioritized issues
| # | Severity | Category | Score | Issue | URL |
|---|----------|----------|-------|-------|-----|
| 1 | High | lighthouse | 88 | Does not use HTTPS | http://192.168.1.5:3000/ |