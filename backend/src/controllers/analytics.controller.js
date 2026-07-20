const testsRepo = require("../repositories/tests.repository");

function dayKey(iso) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function get(req, res) {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  const all = testsRepo.list();
  const windowed = all.filter((t) => new Date(t.createdAt).getTime() >= since);

  // ---- score trend + pass/fail trend + issue severity trend, bucketed by day ----
  const byDay = new Map();
  windowed.forEach((t) => {
    const key = dayKey(t.createdAt);
    if (!byDay.has(key)) {
      byDay.set(key, {
        date: key,
        scoreSum: 0,
        scoreCount: 0,
        passed: 0,
        failed: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      });
    }
    const bucket = byDay.get(key);
    if (t.score !== null && t.score !== undefined) {
      bucket.scoreSum += t.score;
      bucket.scoreCount += 1;
    }
    if (t.status === "passed") bucket.passed += 1;
    if (t.status === "failed") bucket.failed += 1;
    (t.issues || []).forEach((i) => {
      if (bucket[i.severity] !== undefined) bucket[i.severity] += 1;
    });
  });

  const sortedDays = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

  const scoreTrend = sortedDays.map((b) => ({
    date: b.date,
    avgScore: b.scoreCount ? Math.round(b.scoreSum / b.scoreCount) : null,
    count: b.scoreCount,
  }));

  const passFailTrend = sortedDays.map((b) => ({
    date: b.date,
    passed: b.passed,
    failed: b.failed,
  }));

  const issuesBySeverityTrend = sortedDays.map((b) => ({
    date: b.date,
    critical: b.critical,
    high: b.high,
    medium: b.medium,
    low: b.low,
  }));

  // ---- top domains ----
  const byUrl = new Map();
  windowed.forEach((t) => {
    if (!byUrl.has(t.url)) byUrl.set(t.url, { url: t.url, scoreSum: 0, scoreCount: 0, testCount: 0, lastScan: t.createdAt });
    const d = byUrl.get(t.url);
    d.testCount += 1;
    if (t.score !== null && t.score !== undefined) {
      d.scoreSum += t.score;
      d.scoreCount += 1;
    }
    if (new Date(t.createdAt) > new Date(d.lastScan)) d.lastScan = t.createdAt;
  });
  const topDomains = [...byUrl.values()]
    .map((d) => ({
      url: d.url,
      avgScore: d.scoreCount ? Math.round(d.scoreSum / d.scoreCount) : null,
      testCount: d.testCount,
      lastScan: d.lastScan,
    }))
    .sort((a, b) => b.testCount - a.testCount)
    .slice(0, 10);

  // ---- summary ----
  const completedAllTime = all.filter((t) => t.score !== null && t.score !== undefined);
  const avgScoreAllTime = completedAllTime.length
    ? Math.round(completedAllTime.reduce((s, t) => s + t.score, 0) / completedAllTime.length)
    : null;

  const last7dSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const prev7dSince = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const last7d = all.filter((t) => t.score !== null && new Date(t.createdAt).getTime() >= last7dSince);
  const prev7d = all.filter(
    (t) =>
      t.score !== null &&
      new Date(t.createdAt).getTime() >= prev7dSince &&
      new Date(t.createdAt).getTime() < last7dSince
  );
  const avgScoreLast7d = last7d.length
    ? Math.round(last7d.reduce((s, t) => s + t.score, 0) / last7d.length)
    : null;
  const avgScorePrev7d = prev7d.length
    ? Math.round(prev7d.reduce((s, t) => s + t.score, 0) / prev7d.length)
    : null;
  const scoreDeltaPct =
    avgScoreLast7d !== null && avgScorePrev7d !== null && avgScorePrev7d !== 0
      ? Math.round(((avgScoreLast7d - avgScorePrev7d) / avgScorePrev7d) * 100)
      : null;

  res.json({
    scoreTrend,
    passFailTrend,
    issuesBySeverityTrend,
    topDomains,
    summary: {
      totalTests: all.length,
      avgScoreAllTime,
      avgScoreLast7d,
      scoreDeltaPct,
    },
  });
}

module.exports = { get };
