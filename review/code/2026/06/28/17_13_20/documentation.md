# 문서화(Documentation) 리뷰 결과

리뷰 범위: autoRefresh attention 술어 구현 (4개 코드 파일)
diff-base: origin/main

---

## 발견사항

### [INFO] `integrations.service.ts` — `excludeAutoRefresh` 헬퍼 인라인 주석 (양호)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.ts` L489~508
- 상세: 신규 로직(autoRefreshServiceTypes 산출 + excludeAutoRefresh 헬퍼)에 대해 (1) 왜 DB 컬럼이 아닌 service registry에서 조회하는지, (2) `expiring` 분기는 최상위 AND 헬퍼를 쓸 수 있으나 `attention` OR 합집합에서는 connected 서브절 내 인라인으로만 적용해야 하는 이유, (3) 빈 목록 가드 의도가 모두 명확히 설명되어 있다. spec 섹션 참조(`§2.3·§2.4·§9.1·§11.4`)와 Rationale 링크도 포함되어 있다. 복잡한 SQL 구성 로직에 대한 인라인 주석 모범 사례다.
- 제안: 없음.

### [INFO] `status-badge.tsx` — `needsAttention` 함수 주석 (양호)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L148~158
- 상세: 기존 `TODO(autoRefresh 가드)` 블록 주석(9줄)이 제거되고 구현 완료 사실과 정합 근거를 요약한 간결한 주석으로 교체됐다. error/expired 전이 시 신호 회귀가 없다는 설계 의도(§10.5 참조)가 명시됐다. 주석이 변경된 코드와 완전히 일치하며 오래된 TODO가 소거됐다.
- 제안: 없음.

### [INFO] `humanizeUntil` JSDoc 동기화 (양호)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L119~132
- 상세: `humanizeUntil` 함수의 JSDoc 내 subLabel 예시 문자열이 `"Auto-renews · in <X>"` → `"Auto-renews · next in <X>"`로 코드 변경과 동기화됐다. 독스트링과 실제 동작이 일치한다.
- 제안: 없음.

### [INFO] 테스트 파일 인라인 주석 — spec 참조 충실도 (양호)
- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.spec.ts` L1687~1694, L1703~1710
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` L198~203, L255~257, L279~280
- 상세: 신규 테스트 케이스마다 관련 spec 섹션(`§2.3·§2.4·§9.1·§11.4`)을 인라인 주석으로 표기하고, 추가 설명 컨텍스트(예: "cafe24 2h 토큰 등의 거짓 양성 방지", "갱신 실패 시 error/expired 전이로 재포함 §10.5")를 달았다. 테스트 의도가 spec과 연결되어 이후 유지보수자가 왜 이 케이스가 존재하는지 파악하기 쉽다.
- 제안: 없음.

### [INFO] `integrations.service.spec.ts` — attention 필터 설명 주석 업데이트 (양호)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.spec.ts` L1687~1693
- 상세: attention 가상 필터값 정의 주석이 "union of expired ∪ error ∪ (connected within 7d)" 에서 "union of expired ∪ error ∪ (connected within 7d AND NOT autoRefresh)"으로 정확하게 갱신됐다. 기존 주석이 변경된 동작과 일치하지 않던 부분이 올바르게 수정됐다.
- 제안: 없음.

### [WARNING] `spec/2-navigation/4-integration.md` Rationale l.1194 — provider 목록 stale
- 위치: `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` l.1194
- 상세: Rationale "왜 derived 필드인가" 절이 "현재 `cafe24`/`google` 만 true"라고 기술하나, 동일 spec §9.1 본문(l.794) 및 이번 PR 신규 테스트(`expect.arrayContaining(['cafe24', 'google', 'makeshop'])`)는 `makeshop` 도 `supportsTokenAutoRefresh=true` 임을 명시한다. 신규 구현자가 Rationale을 참조할 때 makeshop을 제외 대상으로 오인할 수 있다.
- 제안: Rationale l.1194 "현재 `cafe24`/`google` 만 true" → "현재 `cafe24`/`google`/`makeshop` 이 true"로 1행 정정. `spec/` 수정이므로 project-planner 후속 PR 이관 권고(본 PR 코드 범위 밖).

---

## 요약

이번 변경셋(4개 코드 파일)은 autoRefresh attention 술어 구현으로, 문서화 관점에서 전반적으로 높은 품질을 보인다. 핵심 로직 변경(`excludeAutoRefresh` 헬퍼 신설, `needsAttention` 가드 추가)에 대해 왜 그 설계 결정이 내려졌는지 spec 참조·Rationale 링크와 함께 명확히 설명하는 인라인 주석이 작성됐다. 기존 TODO 주석 소거, JSDoc 동기화, 테스트 케이스 설명 주석의 spec 참조 모두 올바르게 처리됐다. 이 PR 범위(4개 파일) 내에서 유일한 문서화 문제는 `spec/2-navigation/4-integration.md` Rationale l.1194 의 provider 목록 stale(cafe24/google만 언급, makeshop 누락)이며 spec 파일 수정이 필요하므로 project-planner 위임이 권고된다.

---

## 위험도

LOW
