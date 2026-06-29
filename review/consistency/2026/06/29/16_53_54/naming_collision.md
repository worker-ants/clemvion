# 신규 식별자 충돌 검토 결과

## 검토 대상

- Target: `spec/conventions/i18n-userguide.md`
- 관련 변경 파일: `spec/2-navigation/13-user-guide.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/user-guide-evidence.md`

## 변경 범위 요약

이번 PR 의 실제 diff 는 매우 좁다.

`spec/conventions/i18n-userguide.md` — 3개 라인 치환 (신규 식별자 없음):
1. Principle 3-C 보간 계약 설명에 `GraphWarningRule.evaluate` 반환 타입 SoT 교차 참조 추가 (`cross-node-warning-rules.md` 링크).
2. Principle 7 GUI 흐름 절 판별 기준 기술을 `findGuiFlowSections()` 두 신호 OR 로 구체화.
3. 자동 가드 요약 표의 Principle 7 행 갱신 (test 파일 목록 명시).

`spec/2-navigation/13-user-guide.md` — 1개 라인 치환:
- `<ImplAnchor>` 컴포넌트 설명에 `kind="api-endpoint"` 동작 상세 추가.

`spec/conventions/spec-impl-evidence.md` — 1개 라인 추가:
- `impl-anchor-existence.test.ts` 등 reverse-evidence 가드 3건 과의 검증 도메인 직교성 설명 추가.

`spec/conventions/user-guide-evidence.md` — 2줄 추가:
- "개념 설명 절" 의 coverage 가드 제외 근거 문단 추가.

---

## 발견사항

신규 도입 식별자 분류:

| 관점 | 검토 항목 | 결과 |
|---|---|---|
| 요구사항 ID 충돌 | 새로 부여된 요구사항 ID (NAV-*, ED-*, ND-* 등) | 없음 |
| 엔티티/타입명 충돌 | 새 DTO·인터페이스·타입명 | 없음 |
| API endpoint 충돌 | 새 endpoint (method + path) | 없음 |
| 이벤트/메시지명 충돌 | webhook·queue·SSE 이벤트명 | 없음 |
| 환경변수·설정키 충돌 | 새 ENV var, config key | 없음 |
| 파일 경로 충돌 | 새 spec 파일 | 없음 (기존 파일 갱신만) |

검토 항목별 상세:

**요구사항 ID**: 이번 변경에서 새로 부여된 요구사항 ID(예: NAV-*, CCH-*)가 없다. 기존 Principle 번호(1~7, 3-B, 3-C, 6-B)는 `origin/main` 에 이미 존재하며 이번에 신규 추가된 것이 없다.

**함수명 `findGuiFlowSections()`**: i18n-userguide.md Principle 7 절이 이 함수명을 판별 정의 참조로 언급한다. 해당 함수는 `origin/main` 의 `spec/conventions/user-guide-evidence.md` 에 이미 등재되어 있으며(`user-guide-evidence.md` 의 `integrations-coverage.test.ts` / `triggers-coverage.test.ts` 항목), 코드베이스 `/codebase/frontend/src/lib/docs/__tests__/impl-anchor-parse.ts` 에도 이미 정의돼 있다. 이번 변경은 동일 함수를 spec 에 교차 참조한 것이며, 새 식별자 도입이 아니다.

**`kind="api-endpoint"`**: `spec/2-navigation/13-user-guide.md` 의 `<ImplAnchor>` 설명 추가. `api-endpoint` 값은 `origin/main` 의 `spec/conventions/user-guide-evidence.md` §1.2 에 이미 `kind` enum 의 4번째 멤버로 존재하며, `impl-anchor-existence.test.ts` 도 이미 이 kind 를 처리하고 있다. 13-user-guide.md 에서의 이번 추가는 기존 식별자에 대한 설명 보강일 뿐이다.

**`spec-impl-evidence.md` 추가 문단**: 새 식별자 없음. 기존 `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts` 파일명을 이미 존재하는 context 에서 언급한 것이다.

**`user-guide-evidence.md` 추가 문단**: 새 식별자 없음. "개념 설명 절" 이라는 용어는 새 named identifier 가 아닌 일반 서술어이며, `i18n-userguide.md §Principle 7` 와의 경계를 기술한 설명문이다.

---

## 요약

이번 PR 의 4개 spec 파일 변경은 모두 기존 식별자에 대한 설명 보강·교차 참조 추가·판별 기준 명확화다. 새로 도입된 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수, 설정키, 파일 경로가 전무하며, 기존 코퍼스와의 식별자 충돌 또는 동명이의 위험이 발견되지 않았다.

## 위험도

NONE
