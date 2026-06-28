# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: autoRefresh attention 필터 구현 (4 코드 파일)
diff-base: origin/main

---

## 발견사항

### [WARNING] `excludeAutoRefresh` 헬퍼와 `attention` 분기 인라인 문자열 — 동일 로직 두 경로 혼재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.ts` — `expiring` 분기(헬퍼 호출) vs `attention` 분기(인라인 문자열 템플릿)
- 상세: `expiring` 분기는 `excludeAutoRefresh(qb)` 헬퍼를 통해 `NOT IN` 절을 붙이는 반면, `attention` 분기는 SQL fragment 문자열 보간(`autoRefreshExclusion`)으로 동일한 조건을 직접 조립한다. 두 경로가 동일 의미의 `i.service_type NOT IN (:...autoRefreshServiceTypes)` 조건을 서로 다른 방식으로 표현하므로, 향후 파라미터 이름이나 컬럼 레퍼런스 변경 시 한쪽만 수정하는 회귀 위험이 있다. 현재 이 구조의 불가피성(OR 합집합 안쪽에 삽입해야 하므로 최상위 `andWhere` 불가)은 헬퍼 위 주석에 충실하게 설명돼 있어 이해는 가능하나, SQL fragment 상수를 분리해 두 경로가 동일 문자열을 공유하면 오타/이름 불일치 위험을 제거할 수 있다.
- 제안: SQL fragment 와 파라미터 키를 단일 상수로 추출해 헬퍼와 attention 인라인 모두 참조하도록 한다:
  ```ts
  const AUTO_REFRESH_NOT_IN_FRAGMENT =
    'i.service_type NOT IN (:...autoRefreshServiceTypes)';
  ```
  이렇게 하면 파라미터 이름 변경 시 한 곳만 수정하면 된다.

---

### [INFO] `attention` 분기 `autoRefreshServiceTypes.length > 0` 조건 이중 평가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.ts` — `attention` 분기 내 `autoRefreshExclusion` 문자열 결정과 파라미터 객체 조건 생성
- 상세: `autoRefreshServiceTypes.length > 0` 체크가 두 번 등장한다 — 한 번은 `autoRefreshExclusion` 문자열 결정에, 한 번은 파라미터 객체 조건에. 두 평가는 항상 같은 결과를 내므로 논리적 중복이다. 지역 변수 한 개(`const hasAutoRefreshTypes = autoRefreshServiceTypes.length > 0`)로 단일화하면 의도가 더 명확해진다.
- 제안:
  ```ts
  const hasAutoRefreshTypes = autoRefreshServiceTypes.length > 0;
  const autoRefreshExclusion = hasAutoRefreshTypes
    ? ' AND i.service_type NOT IN (:...autoRefreshServiceTypes)'
    : '';
  qb.andWhere(
    `...${autoRefreshExclusion}))`,
    hasAutoRefreshTypes ? { autoRefreshServiceTypes } : {},
  );
  ```

---

### [INFO] 주석 밀도 — 구현 근거 주석이 코드 분량 대비 과도
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.ts` — `autoRefreshServiceTypes` 도출 + `excludeAutoRefresh` 헬퍼 선언부 주석 블록 (약 20줄 주석, 약 7줄 코드)
- 상세: 주석 내용(왜 DB 컬럼을 쓸 수 없는지, attention 분기에서 인라인을 써야 하는 이유, 두 경로가 동일함을 명시)은 실제로 필요한 경고이지만, 한국어·영어 혼용과 `**안쪽**` 강조 마크다운 등 스타일이 이 파일의 다른 섹션과 다소 이질적이다. 또한 현재 provider 목록("현재 cafe24/google/makeshop = true") 을 주석에 나열하는 것은 spec 문서와 중복되며, registry 내용이 바뀔 때 주석도 함께 갱신해야 하는 부담을 만든다.
- 제안: 핵심 경고("attention 은 OR 합집합이라 헬퍼 사용 불가 → 인라인")는 유지하되, 현재 provider 목록 등 spec 문서에 이미 있는 내용은 `spec §9.1` 참조만 남겨 압축한다. 차단 아님.

---

### [INFO] `needsAttention` 함수 내 `!integration.autoRefresh` — falsy 처리 암묵적
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L382-385
- 상세: `!integration.autoRefresh` 는 `autoRefresh` 가 `undefined`(필드 누락)인 경우도 `true` 로 처리해 `isExpiringSoon` 결과를 그대로 반환한다. `IntegrationDto.autoRefresh` 가 항상 `boolean` (non-optional)이면 문제없으나, 타입이 느슨하게 확장될 경우 silent bug 가 될 수 있다. 또한 기존 `if (integration.status === "connected") return isExpiringSoon(...)` 단일 표현식 패턴에서 괄호 감싸기 + 줄바꿈 형태로 바뀌어 같은 파일 내 스타일 일관성이 약간 깨진다.
- 제안: `IntegrationDto.autoRefresh` 타입이 `boolean` (non-optional)임을 확인한다. non-optional이면 `return isExpiringSoon(integration.tokenExpiresAt) && !integration.autoRefresh;` 로 한 줄로 단순화해 이전 스타일과 통일한다. optional이라면 `integration.autoRefresh !== true` 로 의도를 명시화한다. 차단 아님.

---

### [INFO] `status-badge.test.tsx` — `needsAttention` describe 블록 내 `inDays` 헬퍼 중복 정의
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` — `needsAttention` describe 내 새 `inDays` 선언 vs `computeAttentionBreakdown` describe 내 기존 동일 헬퍼
- 상세: `inDays` 헬퍼(`new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()`)가 두 describe 블록에 동일하게 정의된다. 테스트 파일 내 중복이지만, 로직 변경 시(예: 밀리초 계산 정밀도) 두 곳을 동시에 수정해야 하는 부담이 생긴다.
- 제안: 두 describe 블록 공통 스코프(파일 레벨 또는 가장 가까운 공통 describe)에 `inDays` 를 한 번만 정의한다. 차단 아님, 테스트 동작에는 영향 없음.

---

### [INFO] 테스트 내 `['cafe24', 'google', 'makeshop']` 하드코딩 어서션
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.spec.ts` L79
- 상세: `expect(expected).toEqual(expect.arrayContaining(['cafe24', 'google', 'makeshop']))` 는 registry 에서 동적으로 파생한 값을 다시 하드코딩된 리터럴로 교차 검증한다. 새 autoRefresh provider 가 추가되거나 기존 provider 가 제거되면 이 어서션도 함께 갱신해야 한다. 바로 위의 `expect(expected.length).toBeGreaterThan(0)` 가 이미 registry 연동을 검증하고 있어 `arrayContaining` 어서션의 추가 보호 범위가 모호하다.
- 제안: 이 어서션의 목적이 "현재 알려진 provider 가 registry 에 실제로 포함돼 있음을 문서화"라면 주석에 그 의도를 명시하고 유지한다. 그렇지 않다면 `expect(expected.length).toBeGreaterThan(0)` 만으로도 충분하므로 중복 어서션을 제거해 registry 변경 시 테스트 갱신 부담을 줄인다. 차단 아님.

---

## 요약

이번 변경셋의 핵심 코드(backend `integrations.service.ts`, frontend `status-badge.tsx`, 테스트 2개)는 전반적으로 잘 구조화되어 있고, autoRefresh 제외 로직의 의도와 근거가 상세한 주석으로 명확하게 기술되어 있다. 유지보수성 관점의 주요 관심사는 `expiring` 분기(헬퍼)와 `attention` 분기(인라인 문자열)가 동일 SQL 조건을 서로 다른 방식으로 표현하는 구조로, 현재 동작은 동등하지만 향후 파라미터 이름 변경 시 한쪽만 누락될 위험이 있다. SQL fragment 상수 추출로 단일 진실을 보장하는 것이 권장된다. 나머지 발견(중복 length 체크, 주석 밀도, falsy 처리 명시화, 테스트 헬퍼 중복, 리터럴 어서션)은 모두 INFO 수준의 개선 권고이며 차단 요인이 아니다.

## 위험도

LOW
