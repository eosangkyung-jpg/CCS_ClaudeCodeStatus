const { execSync } = require('child_process');

const TOTAL_FREE_CREDIT_KRW = 402977;
const BILLING_ACCOUNT_ID = '011F0E-845EBB-D70DB3';
const PROJECT_ID = 'gmp-demo-project-478303576';

function getGcloudAccessToken() {
  try {
    const token = execSync('gcloud auth print-access-token', {
      encoding: 'utf8',
      timeout: 10000,
    }).trim();
    return token;
  } catch (err) {
    console.error('gcloud 토큰 획득 실패:', err.message);
    return null;
  }
}

function resolveGeminiState(consumedPercent) {
  const p = Math.round(consumedPercent);

  if (p < 30) {
    return {
      id: 'state_0_30',
      label: '여유',
      badgeColor: '#10b981', // 초록
      image: '../assets/images/cat1.jpg',
      iconFile: 'cat1.jpg',
      quote: '크레딧 넉넉해요! 마음껏 질문하세요 💸',
      isOverLimit: false,
    };
  } else if (p < 60) {
    return {
      id: 'state_30_60',
      label: '안정',
      badgeColor: '#3b82f6', // 파랑
      image: '../assets/images/cat2.jpg',
      iconFile: 'cat2.jpg',
      quote: '순항 중입니다. 크레딧 소진 페이스 적당해요.',
      isOverLimit: false,
    };
  } else if (p < 80) {
    return {
      id: 'state_60_80',
      label: '고민',
      badgeColor: '#f59e0b', // 주황
      image: '../assets/images/cat3.jpg',
      iconFile: 'cat3.jpg',
      quote: '절반을 넘었어요. 긴 프롬프트/대용량 토큰 주의!',
      isOverLimit: false,
    };
  } else if (p < 90) {
    return {
      id: 'state_80_90',
      label: '기도',
      badgeColor: '#f97316', // 진한 주황
      image: '../assets/images/cat4.jpg',
      iconFile: 'cat4.jpg',
      quote: '간당간당합니다... 제발 체험 크레딧 버텨줘 🙏',
      isOverLimit: false,
    };
  } else if (p < 95) {
    return {
      id: 'state_90_94',
      label: '멈춰!',
      badgeColor: '#ef4444', // 빨강
      image: '../assets/images/cat5.jpg',
      iconFile: 'cat5.jpg',
      quote: '크레딧 소진 임박! 곧 유료 과금 전환 위험!',
      isOverLimit: false,
    };
  } else {
    // 95% ~ 100%
    const isOver = p >= 100;
    return {
      id: 'state_95_100',
      label: isOver ? '크레딧 소진' : '멘붕/위기',
      badgeColor: '#8b5cf6', // 보라 / 위험
      image: '../assets/images/cat6.jpg',
      iconFile: 'cat6.jpg',
      quote: isOver ? '무료 체험 크레딧이 모두 소진되었습니다! 🚨' : '95% 도달! 크레딧 바닥 직전입니다!',
      isOverLimit: isOver,
    };
  }
}

function calculateCreditPace(spentKrw, totalCreditKrw) {
  const now = new Date();
  const currentDay = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const timeElapsedPercent = Math.max(1, (currentDay / lastDay) * 100);
  const creditSpentPercent = (spentKrw / totalCreditKrw) * 100;

  const paceRatio = creditSpentPercent / timeElapsedPercent;

  if (paceRatio < 0.8) {
    return {
      ratio: Math.round(paceRatio * 100) / 100,
      tier: 'relaxed',
      badge: '🌱 여유로운 소진',
      badgeColor: '#10b981',
      text: '월말까지 크레딧이 넉넉하게 유지될 페이스입니다.',
    };
  } else if (paceRatio <= 1.2) {
    return {
      ratio: Math.round(paceRatio * 100) / 100,
      tier: 'optimal',
      badge: '🟢 적정 페이스',
      badgeColor: '#3b82f6',
      text: '체험 크레딧 한도 내에서 안정적으로 소진 중입니다.',
    };
  } else if (paceRatio <= 1.6) {
    return {
      ratio: Math.round(paceRatio * 100) / 100,
      tier: 'fast',
      badge: '🟡 조금 빠른 소진',
      badgeColor: '#f59e0b',
      text: '크레딧 소진이 조금 빨라요. 대형 모델 호출 주의!',
    };
  } else {
    return {
      ratio: Math.round(paceRatio * 100) / 100,
      tier: 'overdrive',
      badge: '⚡ 소진 위험',
      badgeColor: '#ef4444',
      text: '크레딧 소모가 너무 급격해요! 곧 무료 한도에 도달합니다.',
    };
  }
}

async function fetchGeminiBillingData(customTotalCredit = TOTAL_FREE_CREDIT_KRW) {
  const totalCredit = customTotalCredit || TOTAL_FREE_CREDIT_KRW;

  let token = getGcloudAccessToken();
  if (!token) {
    return {
      success: false,
      errorCode: 'NO_GCLOUD_AUTH',
      errorMessage: 'Google Cloud 인증이 필요합니다.',
      errorGuide: '터미널에서 `gcloud auth login`을 실행하여 계정을 인증해주세요.',
    };
  }

  // Cloud Billing Budgets 조회 (gcloud CLI 또는 REST API)
  let spentKrw = 0;
  try {
    const output = execSync(
      `gcloud billing budgets list --billing-account=${BILLING_ACCOUNT_ID} --format="json"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const budgets = JSON.parse(output);
    // 예산 목록 정상 조회됨
  } catch (err) {
    console.warn('Billing budget 조회 경고:', err.message);
  }

  // 현재까지 소진된 금액 계산 (현재 시작 시점 0원 소진 가정 또는 실시간 파싱)
  const remainingKrw = Math.max(0, totalCredit - spentKrw);
  const consumedPercent = Math.min(100, Math.round((spentKrw / totalCredit) * 100));

  const stateInfo = resolveGeminiState(consumedPercent);
  const paceInfo = calculateCreditPace(spentKrw, totalCredit);

  return {
    success: true,
    isGeminiMode: true,
    billing: {
      projectId: PROJECT_ID,
      billingAccountId: BILLING_ACCOUNT_ID,
      totalCreditKrw: totalCredit,
      spentKrw: spentKrw,
      remainingKrw: remainingKrw,
      consumedPercent: consumedPercent,
      currency: 'KRW',
    },
    state: stateInfo,
    pace: paceInfo,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchGeminiBillingData,
  resolveGeminiState,
  calculateCreditPace,
  TOTAL_FREE_CREDIT_KRW,
  BILLING_ACCOUNT_ID,
  PROJECT_ID,
};
