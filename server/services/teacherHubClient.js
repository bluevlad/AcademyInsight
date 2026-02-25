const axios = require('axios');

const TEACHERHUB_API_URL = process.env.TEACHERHUB_API_URL || 'http://host.docker.internal:9010';
const BASE = `${TEACHERHUB_API_URL}/api/v2`;

const client = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: { 'Accept': 'application/json' }
});

async function safeGet(path, params) {
  try {
    const res = await client.get(path, { params });
    return res.data;
  } catch (err) {
    console.error(`[TeacherHub] GET ${path} failed:`, err.message);
    return null;
  }
}

/** 오늘 분석 요약 (totalMentions, avgSentimentScore, totalTeachers 등) */
async function getAnalysisSummary() {
  return safeGet('/analysis/summary');
}

/** 학원별 통계 (멘션수, 감성점수, 상위 강사 등) */
async function getAcademyStats() {
  return safeGet('/analysis/academy-stats');
}

/** 강사 랭킹 (멘션수 기준 상위 N명) */
async function getRanking(limit = 10) {
  return safeGet('/analysis/ranking', { limit });
}

/** 오늘 분석 리포트 전체 */
async function getAnalysisToday() {
  return safeGet('/analysis/today');
}

/** 학원 목록 */
async function getAcademies() {
  return safeGet('/academies');
}

/** 일간 리포트 (teacherSummaries 포함) */
async function getDailyReport(date) {
  return safeGet('/reports/daily', date ? { date } : undefined);
}

/** 현재 주차 정보 (year, week, weekLabel, startDate, endDate) */
async function getCurrentWeek() {
  return safeGet('/weekly/current');
}

/** 주간 요약 통계 */
async function getWeeklySummary(year, week) {
  return safeGet('/weekly/summary', { year, week });
}

/** 주간 강사 랭킹 (sourceDistribution 포함) */
async function getWeeklyRanking(year, week, limit = 20) {
  return safeGet('/weekly/ranking', { year, week, limit });
}

/** 주간 리포트 전체 */
async function getWeeklyReport(year, week) {
  return safeGet('/weekly/report', { year, week });
}

/** TeacherHub 연결 상태 확인 */
async function healthCheck() {
  try {
    await client.get('/academies', { timeout: 3000 });
    return { connected: true, url: TEACHERHUB_API_URL };
  } catch {
    return { connected: false, url: TEACHERHUB_API_URL };
  }
}

module.exports = {
  getAnalysisSummary,
  getAcademyStats,
  getRanking,
  getAnalysisToday,
  getAcademies,
  getDailyReport,
  getCurrentWeek,
  getWeeklySummary,
  getWeeklyRanking,
  getWeeklyReport,
  healthCheck
};
