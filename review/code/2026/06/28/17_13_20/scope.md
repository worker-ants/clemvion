# 변경 범위(Scope) 리뷰 결과

리뷰 대상: autoRefresh=true 통합을 attention/expiring 술어에서 제외하는 구현 (4개 코드 파일 + review 산출물)
diff-base: origin/main

---

## 발견사항

### [INFO] status-badge.tsx — subLabel 문자열 "in" → "next in" 추가 수정
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L348–349, L358
- 상세: `"Auto-renews · in ${humanizeUntil(...)}"` → `"Auto-renews · next in ${humanizeUntil(...)}"` 로 subLabel 문자열과 JSDoc 주석이 함께 변경됐다. PR 의 주요 목적(attention 술어에서 autoRefresh 제외)과 직접적 관련은 없지만, 주석에서 spec §4.1 헤더 메타 라인 정합화라는 근거가 명시됐다. 관련 테스트(`status-badge.test.tsx` L190)도 동시에 갱신됐다.
  - 범위 관점: 엄밀히는 PR 주제 밖의 추가 UI 문자열 수정이나, 동일 autoRefresh UI 영역의 spec 정합화이고 변경 규모가 작다. 기능 동작에 영향 없는 표현 교정 수준이다.
- 제안: INFO 수준. 차단하지 않는다. PR 설명에 "subLabel 문자열 next in 정합화 포함" 한 줄 추가 시 리뷰어 혼선을 줄일 수 있다.

### [INFO] integrations.service.ts — excludeAutoRefresh 헬퍼와 인라인 문자열 혼용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.ts` — expiring 분기(헬퍼 호출) vs attention 분기(인라인 autoRefreshExclusion)
- 상세: expiring 분기는 `excludeAutoRefresh(qb)` 헬퍼를 사용하고, attention 분기는 동일 SQL 조건을 인라인 문자열로 조립한다. 헬퍼 내 주석이 "attention 은 OR 합집합이라 최상위 AND 로 추가하면 expired/error 행까지 잘못 걸러진다 → connected 서브절 안에 인라인으로 넣어야 한다"는 기술적 이유를 명시하고 있어 의도적 설계임이 명확하다. 두 경로 모두 PR 의도(autoRefresh 제외) 구현에 해당하며 범위 초과가 아니다.
  - 범위 관점: 허용 범위 내 구현 패턴. 같은 조건이 두 표현 방식으로 존재하는 것은 유지보수 관점 별도 이슈이며 maintainability reviewer 가 평가한다.
- 제안: 범위 관점 차단 없음.

### [INFO] service.spec.ts — SERVICE_REGISTRY 임포트 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.spec.ts` L35
- 상세: `SERVICE_REGISTRY` 임포트가 추가됐고 신규 테스트(`it.each(['expiring', 'attention']...)`) 내 `expected` 값 계산에 실제로 사용된다. 불필요한 임포트가 아니다.
- 제안: 없음.

### [INFO] status-badge.test.tsx — 기존 테스트에 autoRefresh: false 명시 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` — computeAttentionBreakdown 기존 케이스 다수
- 상세: 기존 테스트의 `row({ status: "connected", tokenExpiresAt: inDays(2) })` 픽스처에 `autoRefresh: false`가 명시 추가됐다. `needsAttention()` 에 `&& !integration.autoRefresh` 조건이 추가되면서 기존 테스트가 암묵적으로 가정했던 `autoRefresh=false` 값을 명시화한 것이다. 테스트 의미를 바꾸지 않고 회귀를 방지하는 필수 동반 수정이다.
- 제안: 없음.

### [INFO] review/code/2026/06/28/17_04_07/ 산출물 — stale-base 무효 세션 커밋 포함
- 위치: `review/code/2026/06/28/17_04_07/SUMMARY.md`, `_retry_state.json`, `api_contract.md`, `architecture.md`, `documentation.md` 등
- 상세: 17_04_07 세션은 stale 로컬 main 기반(294 files changeset)으로 수행돼 SUMMARY.md 에서 스스로 "무효, 재실행으로 대체"를 선언한 선행 리뷰 세션이다. `review/code/**` 는 코드 리뷰어 역할의 쓰기 권한 범위(CLAUDE.md)이므로 이 파일들의 커밋은 규약 위반이 아니다. 이력 보존 목적으로 무효 세션 산출물을 함께 커밋하는 것은 허용된 패턴이다.
  - 범위 관점: 코드 변경(4개 파일)과 무관한 대량 산출물이 diff 에 포함되어 있으나, 이는 review 워크플로 관리 산출물이며 기능 코드 범위를 벗어나지 않는다.
- 제안: 없음. 의도된 포함으로 판단.

---

## 요약

이번 PR 의 코드 변경 4개 파일(integrations.service.ts, integrations.service.spec.ts, status-badge.tsx, status-badge.test.tsx)은 모두 `autoRefresh=true` 통합을 attention/expiring 술어에서 제외한다는 단일 목적에 집중되어 있다. status-badge.tsx 의 `subLabel` 문자열 `"next in"` 수정은 주요 목적 밖의 소규모 추가 변경이나, 동일 spec 영역(§4.1)의 정합화이고 테스트도 동시에 갱신됐다. 불필요한 리팩토링, 포맷팅 노이즈, 무관한 임포트 정리, 설정 파일 수정은 발견되지 않았다. review 산출물 파일 포함은 CLAUDE.md 규약에 따른 의도된 구성이다.

## 위험도

NONE
