# Code Review 조치 (RESOLUTION)

## 본 커밋의 범위

`refactor(ai-agent): toolNodeIds/toolOverrides 스키마에서 완전 제거 (숨김 → 제거)` (`8b8bd064`)

직전 커밋(`83ea538c`, `b450dfcd`) 의 "숨김 + 보존" feature-out 을 사용자 요청에 따라 **스키마 완전 제거** 로 강화한 후속 커밋이다.

## scope 리뷰어 평가 (전제)

> **이번 변경은 `toolNodeIds` / `toolOverrides` 도구 연결 입력 경로를 스키마·핸들러·테스트에서 제거하고, 관련 PRD·Spec·Plan 문서에 "재작성 예정" 표기를 추가하는 것으로 범위가 매우 잘 통제되어 있다. 코드 삭제 범위는 plan 문서에 기술된 항목과 일치하며, legacy DB 데이터 호환을 위한 `.passthrough()` 전략과 회귀 방지 테스트 블록이 함께 추가되어 안전하다.** — `scope/review.md`, 위험도 LOW

본 커밋이 도입한 결함은 없다. SUMMARY 의 HIGH 등급은 다른 리뷰어가 다시 발견한 **사전 존재(pre-existing) 결함**들에서 비롯한다.

## 사전 존재 이슈 — 이전 RESOLUTION 으로 일괄 처리

본 라운드에서 다시 surface 된 Critical / Warning 항목은 **모두** `review/2026-05-06_13-01-52/RESOLUTION.md` 의 (B) backlog 또는 (C) 별도 PR 로 분류된 항목과 일치한다. 본 커밋의 목표(스키마 제거) 와 무관하므로 본 RESOLUTION 에서 다시 다루지 않는다.

대표 매핑:

| 이번 라운드 발견 | 이전 RESOLUTION 분류 | 상태 |
|----------------|-----------------|------|
| CRIT — Multi-turn 종료 포트 라우팅 (`buildMultiTurnFinalOutput` always `port: 'out'`) | (C) WARN #1 — buildConditionOutput mode 오염과 동일 카테고리. 재작성 backlog (B) WARN #9 와도 맞물림 | 별도 PR |
| CRIT — Spec 출력 구조 불일치 (`response` vs `output.result.response`) | (C) CRIT #2 — 동일 항목 | 별도 PR |
| CRIT — Multi-turn 첫 턴 동작 Spec 불일치 | 사전 식별 안 됨 — 별도 PR 로 추가 | 별도 PR |
| WARN — `endMultiTurnConversation` 테스트 전무 | (C) CRIT #1 — 동일 항목 | 별도 PR |
| WARN — `conversationHistory` silent feature gap | (C) WARN #2 — 동일 항목 | 별도 PR |
| WARN — `.passthrough()` 보안 위험 | (C) WARN #8 — 동일 항목. 본 PR 에서는 .passthrough() 가 legacy 데이터 호환에 의도적으로 활용됨 | 별도 PR |
| WARN — provider tool 순차 실행 | (C) WARN #15/#16 — 동일 항목 | 별도 PR |
| WARN — `_resumeState` 스프레드 | (B) WARN #11 — plan backlog | 재작성 시 처리 |
| WARN — tool loop 중복 / `classifyToolCalls` 매 이터레이션 Map | (B) WARN #9 / #17 — plan backlog | 재작성 시 처리 |
| WARN — `toolCallCount` 비대칭 | (B) WARN #20 — plan backlog | 재작성 시 처리 |
| WARN — PRD `✅` 표기 오류 (제거된 항목인데 ✅ 유지) | 본 PR 에서 라벨로 표시 (`_(제거됨 — 재작성 예정)_`) | 본 PR 에서 부분 처리 |

## 본 RESOLUTION 에서 별도 조치한 항목

없음. scope 리뷰어가 LOW 로 평가한 대로 본 커밋의 범위는 잘 통제되어 있고, 새로 도입한 결함이 없다.

## 검토했으나 채택하지 않은 제안

### scope INFO #1 — Plan 파일 분리 제안

> 현재 plan 이 tool-connection-rewrite 에 국한된다는 점을 감안하면 해당 backlog 항목들을 별도 plan 파일(`plan/in-progress/ai-agent-handler-refactor.md`)로 분리하는 것이 plan 경계를 명확히 한다. 단, 기능적 문제는 없다.

**불채택 사유**: backlog 항목들은 모두 도구 연결 재작성과 직접 맞물린다 (tool loop 추출은 새 도구 입력 경로 구현 시 자연스럽게 함께 가는 작업). 별도 파일로 분리하면 두 plan 사이의 의존성을 따로 관리해야 하고, 재작성 시 양쪽을 동기화하는 부담이 추가된다. 현재 단일 plan 안의 구분된 섹션으로 충분하다.

## 검증

- backend lint·unit(167 suite, 2716/2716 pass — skip 0)·build green
- frontend lint·unit(103 file, 1208/1208 pass)·build green

본 커밋은 스코프 통제·테스트 그린·문서 정합 모두 충족하며 추가 조치 없이 머지 가능 상태다. 사전 결함은 본 PR 의 단위성을 보존하기 위해 별도 PR 로 유도한다.
