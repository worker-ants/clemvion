# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음

## 전체 위험도
**LOW** — spec 변경 없는 순수 코드 정정(impl-done). 기능/계약 충돌은 없으나, 이 PR 이 해소한 정본 트래커 CRITICAL 항목의 "완료 후 정리"(체크박스 갱신·스테일 경고 마커 제거)가 아직 반영되지 않아 WARNING 2건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 CRITICAL 항목(`12_24_55` cross_spec, "system_error 재시도 배너가 라이브 WS 경로에서 안 뜬다")이 이 PR 로 실제로 해소됐음에도 여전히 미체크(`- [ ]`) 상태이고 역참조도 없음 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L206~230 | `plan/in-progress/system-error-banner-live-ws.md` (해소 작업, 체크리스트 전부 `[x]`) | `system-error-banner-live-ws.md` 를 `complete/` 로 옮기는 마무리 커밋에서 트래커 항목을 `[x]` 로 체크하고 "system-error-banner-live-ws 로 해소" 역참조 추가 |
| 2 | plan_coherence | `conversation-thread.md` §9.7 위 ⚠️ 스테일 마커("코드 수정은 … 정본 트래커에 등재돼 있고 그 작업이 이 두 행의 문구도 함께 검증한다")가, 그 코드 수정이 실제로 완료된 지금도 "아직 안 고쳐졌다"는 취지로 남아 향후 독자를 오도함 | `spec/conventions/conversation-thread.md:578` (이번 diff 는 이 파일을 건드리지 않음) | 정본 트래커 자신의 명문 지시("착수 시 … §9.7 위 ⚠️ 블록을 지우면 된다") | 마무리 커밋에서 ⚠️ 블록 제거 또는 "해소됨(PR: system-error-banner-live-ws)"으로 갱신 — §4.1-a/§9.7 본문 내용은 그대로 두고 경고 마커만 정리 |
| 3 | cross_spec | 같은 문서(`6-websocket-protocol.md`) §4.2 의 `retry_last_turn` 관련 3곳(278/435/436행)이 §4.1-a(2026-08-24 정정)의 이중 래핑 표기(`output.output.error…`)를 반영하지 못하고 구표기(`output.error.details…`, 한 겹 얕음)를 유지 — 이번 PR 이 고친 프런트 결함과 정확히 같은 모양의 문서 표기 오차 | `spec/5-system/6-websocket-protocol.md` §4.2 — 278/435/436행 | 같은 문서 §4.1-a(241~248행), 188~189행 및 `spec/conventions/node-output.md` Principle 0 | §4.2 의 3곳을 §4.1-a 와 동일 표기(`outputData.output.error.details.retryable` 등)로 통일. 백엔드 `retry-turn.service.ts:153-164` 는 이미 올바른 이중 nesting 구현이므로 순수 문서 drift, 기능 회귀 아님 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `3-execution.md`/`data-hydration-surfaces.md` 의 `execution.node.failed` 필드 요약이 §4.1-a 만큼 정밀하지 않음(뭉뚱그려 `error` 나열) | `spec/3-workflow-editor/3-execution.md:305`, `spec/conventions/data-hydration-surfaces.md:32` | 급하지 않음. 다음에 해당 표를 만질 때 `error`(string)/`output.output.error`(구조화) 구분 또는 §4.1-a 링크 추가 |
| 2 | convention_compliance | `spec/5-system/6-websocket-protocol.md` 에 명시적 `## Overview` 절이 없음(CLAUDE.md 3섹션 권장에 못 미침) | `spec/5-system/6-websocket-protocol.md` 타이틀 직후 | 이번 diff 범위 밖(`spec/5-system/` 전반 기존 관행). 별도 planner 턴에서 톤 통일 여부만 판단 |
| 3 | naming_collision | 신규 로컬 헬퍼 `asRecord`(`use-execution-events.ts:52`)가 `channel-web-chat/src/lib/presentation.ts:102` 의 동명 함수와 이름은 같으나 널 처리(반환 `null` vs 빈 객체 폴백)가 다름 — 두 패키지는 import 관계 없어 실질 충돌 없음 | `codebase/frontend/src/lib/websocket/use-execution-events.ts:52` | 조치 불필요. 향후 공유 유틸 추출 시 시그니처 통일 고려 |
| 4 | naming_collision | 신규 테스트 헬퍼 `wrapNodeHandlerOutput`(FE 테스트 로컬)이 backend `mock-output.ts` 의 `NodeHandlerOutput` mock 빌더와 개념은 겹치나 이름·경로 모두 분리 — DRY 관심사이지 식별자 충돌 아님 | `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1987` | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §4.2 3곳이 §4.1-a 의 이중 래핑 정정을 반영 못함(WARNING) — 백엔드는 이미 올바르게 구현돼 있어 순수 문서 drift |
| rationale_continuity | NONE | target 은 2026-08-24 확정된 §4.1-a/Principle 0 정정을 코드에 반영하는 사전 예고된 후속 작업 — 기각된 해석 재도입 없음 |
| convention_compliance | NONE | spec diff 0건, 코드가 §4.1-a/Principle 0/§1.2.1/Principle 3.2 SoT 와 정확히 일치. Overview 절 부재는 diff 범위 밖 INFO |
| plan_coherence | MEDIUM | 기능·스펙 정합성 자체는 완전 일치하나, 정본 트래커의 "완료 후 정리" 지시 2건(체크박스·스테일 마커) 미반영 |
| naming_collision | NONE | spec 신규 식별자 없음. 코드 신규 로컬 헬퍼 2개는 모두 비공개라 실질 충돌 없음(INFO 2건) |

## 권장 조치사항
1. `system-error-banner-live-ws.md` 를 `complete/` 로 옮기는 마무리 커밋에서 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 `12_24_55` 항목을 `[x]` 로 체크하고 역참조를 남긴다 (WARNING #1).
2. 같은 마무리 커밋에서 `spec/conventions/conversation-thread.md:578` 의 ⚠️ 스테일 마커를 제거하거나 "해소됨"으로 갱신한다 (WARNING #2).
3. 향후 `spec/5-system/6-websocket-protocol.md` 를 만질 기회에 §4.2 의 278/435/436행 표기를 §4.1-a 와 통일한다 (WARNING #3) — 급하지 않으나 재발 방지 차원.
4. INFO 4건은 즉시 조치 불필요, 각 항목 제안대로 후속 기회에 반영.