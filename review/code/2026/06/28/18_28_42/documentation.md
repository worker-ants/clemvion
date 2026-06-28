# 문서화(Documentation) 리뷰 결과

리뷰 범위: autoRefresh attention 술어 구현 (4개 코드 파일 + 사용자 문서 2개 + review/consistency 산출물)
diff-base: origin/main

---

## 발견사항

### [INFO] `integrations.service.ts` — `excludeAutoRefresh` 헬퍼 인라인 주석 (양호)
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L489~136
- 상세: 신규 로직(`autoRefreshServiceTypes` 산출 + `excludeAutoRefresh` 헬퍼)에 대해 (1) 왜 DB 컬럼이 아닌 service registry에서 조회하는지, (2) `expiring` 분기는 최상위 AND 헬퍼를 쓸 수 있으나 `attention` OR 합집합에서는 connected 서브절 내 인라인으로만 적용해야 하는 이유, (3) 빈 목록 가드 의도가 모두 명확히 설명되어 있다. spec 섹션 참조(`§2.3·§2.4·§9.1·§11.4`)와 Rationale 링크도 포함되어 있다. 복잡한 SQL 구성 로직에 대한 인라인 주석 모범 사례다.
- 제안: 없음.

### [INFO] `integrations.service.ts` attention 분기 주석 — 오래된 주석 정확하게 갱신됨 (양호)
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L150~157
- 상세: `// Virtual filter — Expired ∪ Error ∪ (Connected within 7d).` 주석이 `// Virtual filter — Expired ∪ Error ∪ (Connected within 7d, NOT autoRefresh).`로 정확하게 갱신됐다. 이전에 autoRefresh 제외 조건이 추가됐음에도 주석에 반영되지 않던 불일치가 해소됐다. `autoRefresh 통합의 갱신이 실패해 error/expired로 전이하면 IN ('expired','error') 분기로 다시 포함된다`는 설계 의도(§10.5)도 추가 기술됐다.
- 제안: 없음.

### [INFO] `status-badge.tsx` — `needsAttention` 함수 TODO 소거 및 주석 교체 (양호)
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L376~398
- 상세: 기존 9줄 분량의 `TODO(autoRefresh 가드)` 블록 주석이 완전히 제거되고, 구현 완료 사실과 정합 근거를 요약한 간결한 주석으로 교체됐다. 오래된 TODO 주석이 변경된 코드와 불일치하던 상태가 해소됐고, error/expired 전이 시 신호 회귀가 없다는 설계 의도(§10.5 참조)가 명시됐다.
- 제안: 없음.

### [INFO] `status-badge.tsx` — `humanizeUntil` JSDoc 동기화 (양호)
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L119~132
- 상세: `humanizeUntil` 함수의 JSDoc 내 subLabel 예시 문자열이 `"Auto-renews · in <X>"` → `"Auto-renews · next in <X>"`로 코드 변경과 동기화됐다. `computeStatus` 내 subLabel 문자열 변경이 JSDoc에도 즉시 반영된 모범적 주석 관리다.
- 제안: 없음.

### [INFO] 테스트 파일 인라인 주석 — spec 참조 충실도 (양호)
- 위치:
  - `codebase/backend/src/modules/integrations/integrations.service.spec.ts` L1687~1735
  - `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L201~247, L266~301
- 상세: 신규 테스트 케이스마다 관련 spec 섹션(`§2.3·§2.4·§9.1·§11.4`)을 인라인 주석으로 표기하고 컨텍스트(예: "cafe24 2h 토큰 등의 거짓 양성 방지", "갱신 실패 시 error/expired 전이로 재포함 §10.5")를 달았다. `needsAttention` describe 블록 추가도 spec 참조와 목적이 명확하게 기술됐다.
- 제안: 없음.

### [INFO] `integrations.service.spec.ts` — attention 필터 정의 주석 갱신 (양호)
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` L1687~1694
- 상세: attention 가상 필터값 정의 주석이 "union of expired ∪ error ∪ (connected within 7d)"에서 "union of expired ∪ error ∪ (connected within 7d AND NOT autoRefresh)"으로 정확하게 갱신됐다. 이전 주석이 변경된 동작과 불일치하던 부분이 올바르게 수정됐다.
- 제안: 없음.

### [INFO] 사용자 노출 문서(`.mdx`) 업데이트 — attention 정의 갱신 (양호)
- 위치:
  - `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx` L57
  - `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` L68
- 상세: 두 언어 버전 Callout이 모두 갱신됐다. "connected 통합 중 7일 이내 만료 예정 항목도 attention에 포함" 설명이 추가됐고, autoRefresh 지원 통합(Cafe24·MakeShop·Google)이 만료 임박이어도 Need attention 배너·사이드바 배지·Expiring 필터에 포함되지 않는다는 정책이 명확히 기술됐다. 자동 갱신 실패 시 error/expired 전이 후 재포함 흐름도 KO/EN 양쪽에 대칭적으로 반영됐다. 코드 변경과 사용자 문서가 동기화된 모범적 패턴이다.
- 제안: 없음.

### [WARNING] `spec/2-navigation/4-integration.md` Rationale l.1194 — provider 목록 stale (주석 정확성)
- 위치: `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` Rationale "왜 derived 필드인가" 항, l.1194
- 상세: Rationale 본문이 "현재 `cafe24`/`google` 만 true"라고 기술하나, 이번 PR 신규 테스트(`expect.arrayContaining(['cafe24', 'google', 'makeshop'])`, `integrations.service.spec.ts` L79)와 §9.1 본문(l.794)은 `makeshop`도 `supportsTokenAutoRefresh=true`임을 명시한다. 신규 구현자가 Rationale을 참조할 때 makeshop을 제외 대상으로 오인할 수 있다. 코드와 §9.1 본문은 정확하나 Rationale 주석의 정확성이 떨어진다.
- 제안: Rationale l.1194 `"현재 \`cafe24\`/\`google\` 만 true"` → `"현재 \`cafe24\`/\`google\`/\`makeshop\` 이 true"`로 1행 정정. `spec/` 수정은 project-planner 후속 PR 이관 권고(본 PR 코드 범위 밖).

### [INFO] `integrations.service.ts` 인라인 주석 — provider 목록 나열 (유지보수 주의)
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L115
- 상세: 주석 내 "현재 cafe24/google/makeshop = true" 리터럴이 코드와 일치한다(위 WARNING과 달리 코드 측 주석은 정확함). 그러나 새 autoRefresh provider가 추가될 때 이 주석도 함께 갱신해야 하는 부담이 생긴다. spec §9.1 참조만 남기고 목록은 생략하는 방식이 단일 진실 원칙에 더 부합한다.
- 제안: 주석에서 provider 목록을 `spec §9.1` 참조로 대체하거나, 목록이 registry 기반 동적 파생임을 명시하는 방향으로 압축 가능. 차단 아님.

### [INFO] review/consistency 산출물 — `_retry_state.json` 절대 경로 포함
- 위치: `review/consistency/2026/06/28/16_48_46/_retry_state.json` 외 여러 세션의 `_retry_state.json`
- 상세: orchestrator 내부 상태 파일이 절대 경로(`/Volumes/project/private/clemvion/.claude/worktrees/...`)를 포함한다. 이는 사람이 직접 소비하는 문서가 아니며 기능적 영향이 없다. 문서화 관점에서는 repo 이관·머신 교체 시 재사용 불가능한 경로가 영구 기록되는 점이 관찰 사항이다.
- 제안: 현행 유지 가능. 향후 `_retry_state.json` 스키마에 상대 경로 표기를 검토할 수 있다. 현재는 INFO 수준.

---

## 요약

이번 변경셋(4개 코드 파일 + 사용자 문서 2개)은 autoRefresh attention 술어 구현으로, 문서화 관점에서 전반적으로 높은 품질을 보인다. 핵심 로직 변경(`excludeAutoRefresh` 헬퍼 신설, `needsAttention` 가드 추가)에 대해 왜 그 설계 결정이 내려졌는지 spec 참조·Rationale 링크와 함께 명확히 설명하는 인라인 주석이 작성됐고, 기존 TODO 주석이 깨끗하게 소거됐으며, JSDoc·spec 주석·테스트 케이스 설명 모두 변경된 코드와 정합한다. 사용자 문서(KO/EN `.mdx`)도 이번 기능 변경을 정확하게 반영했다. 유일한 실질적 문서화 문제는 `spec/2-navigation/4-integration.md` Rationale l.1194의 provider 목록 stale(cafe24/google만 언급, makeshop 누락)이며, 이는 spec 파일 수정이 필요하므로 project-planner 위임이 권고된다. 코드 주석 내 provider 목록 나열은 INFO 수준의 개선 권고다.

---

## 위험도

LOW
