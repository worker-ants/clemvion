# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: autoRefresh attention 술어 구현
- `codebase/backend/src/modules/integrations/integrations.service.ts`
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
- `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` (.en.mdx 포함)
- `review/code/2026/06/28/17_04_07/` 산출물 (이전 리뷰 세션 참고용)

diff-base: origin/main

---

## 발견사항

### [WARNING] `excludeAutoRefresh` 헬퍼와 `autoRefreshExclusion` 인라인 문자열의 이중 경로

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` — `expiring` 분기 vs `attention` 분기 connected 서브조건
- **상세**: 동일한 SQL fragment(`i.service_type NOT IN (:...autoRefreshServiceTypes)`)와 파라미터를 두 가지 방식으로 적용한다.
  - `expiring`: `excludeAutoRefresh(qb)` 헬퍼 함수 호출 (최상위 AND)
  - `attention`: `autoRefreshExclusion` 인라인 문자열 보간 (OR 합집합 내 connected 서브조건)

  주석(`// 빈 목록이면 NOT IN () 가 무의미/오류이므로...`)으로 이 설계 결정의 이유를 설명하고 있으나, 두 경로가 존재한다는 사실 자체가 미래의 유지보수자에게 혼란을 준다. `AUTO_REFRESH_NOT_IN`과 `autoRefreshParams` 상수를 공유하는 것은 단일 진실 확보의 좋은 패턴이지만, 하나는 함수로, 하나는 문자열 보간으로 사용하는 비대칭 구조는 동등성을 눈으로 확인해야 하는 부담을 남긴다. `expiring`에 새 조건이 추가될 때 `attention`에도 병행 적용해야 함을 코드 구조만 보고는 알 수 없다.
- **제안**: 설계 결정(OR 합집합 안에서는 헬퍼를 쓸 수 없다는 이유)은 이미 주석에 명시되어 있으므로 Critical 차단은 아니다. 추가로 `excludeAutoRefresh` 헬퍼 JSDoc에 "주의: attention 분기의 OR 합집합 내부에서는 직접 사용 불가 — `AUTO_REFRESH_NOT_IN` 인라인 방식 사용"을 한 줄 명시하면 두 경로의 의도 차이를 명확히 전달할 수 있다.

---

### [INFO] `excludeAutoRefresh` 헬퍼의 파라미터 타입이 `typeof qb`로 구조 결합

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` — `const excludeAutoRefresh = (qbRef: typeof qb): void`
- **상세**: 헬퍼 타입이 `typeof qb`(클로저 내 로컬 변수 타입 참조)로 정의되어 있어 함수가 외부로 추출될 수 없는 구조다. 현재는 동일 함수 본문 내에서만 사용되므로 기능적 문제는 없다. 그러나 동일 패턴이 다른 쿼리 빌더 분기에 필요해질 경우 복사-붙여넣기가 불가피해진다. `SelectQueryBuilder<Integration>`과 같은 명시적 타입을 사용하면 재사용성이 높아지고 타입 의도도 문서화된다.
- **제안**: `qbRef: typeof qb` → `qbRef: SelectQueryBuilder<Integration>` (또는 해당 qb 타입). 현재 스코프에서는 동작상 동등하므로 차단 불필요.

---

### [INFO] `needsAttention` 함수에서 `TODO` 주석 제거 — 긍정적 변화, 주석 길이 확인

- **위치**: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `needsAttention` 함수
- **상세**: 기존 9행짜리 `TODO(autoRefresh 가드)` 주석이 제거되고 4행의 설명 주석으로 대체됐다. 부채가 해소됐음을 명확히 보여주는 좋은 패턴이다. 새 주석은 설계 의도(거짓 양성 방지), spec 참조, 신호 회귀 없음 이유를 간결하게 설명한다. 함수 자체는 3행으로 단순하며 단일 책임을 가진다.
- **제안**: 없음. 현행 유지.

---

### [INFO] 테스트에서 `expect(expected).toEqual(expect.arrayContaining([...]))` 하드코딩 목록 포함

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` L78-L80
  ```
  expect(expected).toEqual(
    expect.arrayContaining(['cafe24', 'google', 'makeshop']),
  );
  ```
- **상세**: 테스트 주석(`// 파라미터는 registry 에서 파생 — 현재 cafe24/google/makeshop.`)이 이 assertion의 의도를 설명하고 있으나, registry에 신규 provider가 추가될 경우 이 어서션은 통과하지만 실제로 기대 목록보다 더 많은 service_type이 포함될 수 있다. `arrayContaining`은 부분 집합만 검증하기 때문이다. 전체 집합을 강하게 검증하려면 `toEqual(expect.arrayContaining([...]))` + `.toHaveLength(3)` 조합이 필요하다.
  
  그러나 이 assertion의 의도는 "현재 알려진 provider가 포함됨을 확인"이지 "정확히 이 3개만 포함됨"이 아닐 수 있다. 주석이 현재 상태(cafe24/google/makeshop)를 명시하고 있으므로 신규 provider 추가 시 주석 갱신이 누락될 위험이 있다.
- **제안**: assertion 의도가 "현재 알려진 provider 포함 여부 확인"이라면 현행 유지. "정확한 목록 일치 검증"이라면 `toEqual(['cafe24', 'google', 'makeshop'])` (순서 무관이면 `toEqual(expect.arrayContaining(['cafe24', 'google', 'makeshop']))` + `.toHaveLength(3)`)로 강화할 수 있다.

---

### [INFO] `integrations.service.ts` 내 주석의 한국어/영어 혼용

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` — 신규 추가된 주석 블록 (L106-L136)
- **상세**: 동일 함수 내에 한국어 주석과 영어 주석이 혼재한다. 기존 코드베이스의 영어 주석(L137 이하의 `// spec/2-navigation/4-integration.md §2.3, §2.4, §11.4.` 등)과 스타일이 다르다. 신규 추가 블록은 한국어로 상세 설명이 작성되어 있다. 이 파일의 기존 패턴은 영어 주석이 지배적이다.
- **제안**: 엄격한 일관성을 요구한다면 영어로 통일을 권장하지만, 프로젝트 관행(한국어 팀)을 고려할 때 현행 혼용은 실질적 유지보수 장애가 아니다. 차단 불필요.

---

### [INFO] mdx 문서 — 단일 `<Callout>` 내 복수 정보를 중문으로 전달

- **위치**: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` 및 `.en.mdx`
- **상세**: 변경 후 `<Callout type="tip">` 블록이 기존보다 약 2.5배 길어졌다. 단일 callout에 (1) expired/error → attention, (2) expiring 7d 포함, (3) autoRefresh 제외 이유, (4) 갱신 실패 시 재포함, (5) passive 알림 미발송 이유, (6) active 알림 조건의 6가지 정보를 담고 있다. 문서 가독성 관점에서 사용자가 핵심 메시지(autoRefresh 통합은 attention에 포함 안 됨)를 찾기 어려워질 수 있다.
- **제안**: 차단 불필요. 다음 문서 개정 시 callout을 분리하거나 bullet 목록으로 구조화하면 가독성이 개선된다. 현재로서는 기술적 정확성 우선.

---

## 요약

핵심 코드 변경(`integrations.service.ts`의 autoRefresh 제외 로직, `status-badge.tsx`의 `needsAttention` 가드)은 전반적으로 유지보수성이 양호하다. `AUTO_REFRESH_NOT_IN`·`autoRefreshParams` 상수 공유로 단일 진실 원칙을 지켰고, 기존 TODO 부채가 깔끔하게 해소됐다. 주목할 유지보수성 위험은 `excludeAutoRefresh` 헬퍼(최상위 AND)와 `autoRefreshExclusion` 인라인 보간(OR 서브절 내부)의 이중 경로로, 두 경로가 동일 SQL fragment를 다른 방식으로 적용한다는 점이 미래 수정 시 혼란의 여지를 남긴다. 주석으로 설계 의도를 이미 설명하고 있으므로 차단 수준은 아니며, 헬퍼 JSDoc에 한 줄 보완으로 해결 가능한 수준이다. 테스트 코드는 `it.each`로 `expiring`/`attention` 두 경로를 동시 검증하는 패턴이 간결하고 의도가 명확하다.

## 위험도

LOW
