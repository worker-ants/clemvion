# Code Review 통합 보고서

## 전체 위험도
**LOW** — behavior-neutral 픽스(LLM 안내 문자열 정합화 + 회귀 단언 2건). spec §10 stale 항목 1건(SPEC-DRIFT)이 잔존하나 sibling PR #685 로 처리 중이며 코드 동작에는 무영향.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 처리 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `spec/3-workflow-editor/4-ai-assistant.md` line 958 의 `finishBlockCount > 0` skip 조건이 stale 잔존. 코드(`AssistantFinishGuard.shouldSkipReview`)는 M-3 2단계(#680)에서 제거. 코드가 옳고 spec 낡음. | `spec/3-workflow-editor/4-ai-assistant.md` line 958 | **sibling PR #685(project-planner)가 §10 line 958 불릿 삭제로 처리** — 유지보수 불변식의 짝. 본 developer PR 은 spec 미수정(planner 영역). 동행 머지. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| 1 | Testing | `assistant-finish-guard.service.spec.ts` 에 `finishBlockCount: 1` 상태에서 `shouldSkipReview` false 반환 명시 단언 부재(묵시적 보장만) | **defer** — M-3 2단계 테스트 파일(범위 밖). 코드가 finishBlockCount 미참조라 묵시 보장 + 본 PR 의 prompt-level 회귀 단언으로 drift 재발 방지. |
| 2 | Testing | `reviewRoundCount: 1` 경계 케이스 부재(`>=` 엄밀 경계) | **defer** — pre-existing 커버리지 갭, 본 PR 무관. |
| 3 | Maintainability | `system-prompt.ts` Note 절 inline append 로 문장 길이 증가 | **defer (cosmetic)** — 가독성 미세. Note 가 직전 문장과 논리적으로 연결(skip 조건의 예외)이라 inline 유지가 자연스러움. |
| 4 | Security | `_retry_state.json` 로컬 절대 경로 | pre-existing, 내부 전용 저장소라 무위험. 본 PR 무관. |
| 5 | Documentation | `shouldSkipReview` 인라인 주석 최신성 | PR #685 머지 시 확인(범위 밖). |
| 6 | Security | `toWorkflowView` 마스킹 테스트 커버 | 기존 구조 유지, 본 PR 무관. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. 프롬프트 인젝션 방어 유지. |
| requirement | LOW | SPEC-DRIFT(§10 line 958) — sibling #685 처리 중. |
| scope | NONE | 범위 일탈 없음(3파일 + 의무 산출물). |
| side_effect | NONE | 시그니처·전역 상태·이벤트·네트워크 무변경. |
| maintainability | NONE | inline Note 가독성 경미만. |
| testing | LOW | code-level finishBlockCount 단언 부재(묵시 보장 + prompt-level 단언으로 보강). |
| documentation | NONE | JSDoc·주석 유효. spec stale 은 #685. |

## 권장 조치사항 (처리 반영)

1. **[SPEC-DRIFT — sibling PR #685]** spec §10 line 958 finishBlockCount 삭제 — #685(project-planner)가 처리. 동행 머지 권장.
2. **[defer]** finish-guard code-level 단언·reviewRoundCount 경계: 범위 밖/pre-existing. prompt-level 회귀 단언으로 본 PR 드리프트는 가드됨.
3. **[defer]** system-prompt Note 포맷: inline 유지(직전 skip 조건의 예외로 논리 연결).

## 라우터 결정

라우터 사용됨 (`routing=done`). 실행 7명(전원 router_safety): security·requirement·scope·side_effect·maintainability·testing·documentation. 제외 7명: performance·architecture·dependency·database·concurrency·api_contract·user_guide_sync(프롬프트 문자열 변경 — 시그니처·DB·API·동시성 무변경).
