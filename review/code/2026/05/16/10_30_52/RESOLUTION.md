# RESOLUTION — AI 대화 messages[].source 마커 리뷰 조치

세션: `review/code/2026/05/16/10_30_52`
SUMMARY: BLOCK 없음. Critical 0건 / Warning 13건 / Info 16건 / 전체 위험도 LOW.

## 조치 요약

| ID | 항목 | 조치 |
|---|---|---|
| W1 | source 타입 3곳 중복 | `MessageSource = 'live' \| 'injected'` + `RawMessage` 를 `conversation-utils.ts` 에서 export → `use-execution-events.ts` 2곳 인라인 제거 후 import 로 통합 |
| W2 | system case 의 source 마킹 | `mapTurnsToChatMessages` 의 switch 정리 + JSDoc 에 "system 은 emit 전 필터됨" 명시. 추가로 `withSourceMarker` 에 system role 가드 |
| W3 | switch 분기별 source 중복 기재 | switch 각 case 에서 source 제거하고 함수 말미에서 `.map((m) => ({...m, source: 'injected'}))` 일괄 적용. 분기 추가 시 누락 불가능 |
| W4 | `void source` 패턴 | `({ source: _source, ...rest }) => rest` 관용 패턴으로 교체 |
| W5 | `withSourceMarker` system 가드 부재 | 함수 내부에 `if (m.role === 'system') return m;` 가드 + JSDoc 에 호출 순서 무관 보장 명시 |
| W6 | conversation-utils.ts 주석 과밀도 | 의도적 보존 — 핵심 불변식(injected 가 turn 카운트 무관) 이 회귀 핵심이라 유지 |
| W7 | mapTurnsToChatMessages 분기별 단위 테스트 부재 | thread.spec 의 통합 테스트가 5개 source 분기 모두를 행동 단위로 커버 — 별도 단위 테스트는 mapTurnsToChatMessages export 가 의미 없어 보류 |
| W8 | LlmService strip 단위 테스트 없음 | `llm.service.spec.ts` 에 `describe('source field stripping (spec §4.4.6)')` 추가 — 5개 케이스 (live/injected/tool 필드 보존/다른 ChatParams 보존/source 미지정) |
| W9 | `withSourceMarker` 엣지 케이스 미비 | `execution-engine.service.spec.ts` 에 신규 케이스 3개 — 기존 'live' identity 보존, 빈 배열, multi-turn 혼합 |
| W10 | `toBeGreaterThanOrEqual(2)` 단언 | `toHaveLength(2)` + role array 정확 매칭 + backfill 전/후 단계 의미 주석 |
| W11 | `isInjected` UI chip 표시 | 본 PR scope 밖 (데이터 레이어까지). `plan/in-progress/ai-thread-source-mark.md` 의 Follow-up 섹션에 별도 PR 항목으로 기록 |
| W12 | `mapTurnsToChatMessages` JSDoc 미흡 | 함수 수준 JSDoc 에 source 마킹 책임·spec 참조·system 처리 명시 |
| W13 | injected+live 복합 시나리오 테스트 | `conversation-utils.test.ts` 신규 케이스 — injected assistant → live user → live tool call → live assistant. `assistantIdxInTurn` 가 live 만 증가하는지 검증 |

## INFO 처리

| ID | 항목 | 결정 |
|---|---|---|
| I1 | source 런타임 화이트리스트 | 보류. 타입 유니온으로 충분, optional + 'live' fallback 으로 안전 |
| I2 | `ProviderChatMessage = Omit<ChatMessage, 'source'>` 분리 | 보류. LlmService.chat 한 곳에서만 strip 하므로 타입 분리 필요 없음 |
| I3 | `withSourceMarker` 파라미터 타입 좁히기 | 보류. `buildConversationConfigFromOutput` 가 `Array<Record<string, unknown>>` 로 받기 때문에 일관성 유지. system 가드 추가로 안전성 확보 |
| I4 | nodeLabel 프롬프트 인젝션 | 보류. 본 작업 무관 기존 코드. 별도 보안 plan 으로 분리 |
| I5/I6 | filter+map / 무조건 spread | 보류. 메시지 수가 50~100 단위라 측정 가능한 영향 없음 |
| I7 | source 로직 단일 진실 | 보류. 마킹(`mapTurnsToChatMessages`) vs 백필(`withSourceMarker`) 은 책임이 다른 두 지점 — 의도된 분리 |
| I8 | `currentTurn \|\| 1` 의 첫 user 와 injected turnIndex 충돌 | UI 가 `isInjected` 로 구분하므로 의도된 동작 |
| I9 | 리터럴 중앙화 | 보류. `MessageSource` 유니온이 컴파일 보호. 상수화 시 import 늘어남 |
| I10 | `as ChatMessage` 단언 제거 | 보류. switch 의 다른 case 간 호환을 위해 명시 단언 필요 |
| I11 | `isInjected` JSDoc | 반영 — "older persisted data may omit; treat undefined as false" 추가 |
| I12 | tool item isInjected assert | 반영 — 기존 테스트에 `isInjected: false` matcher 추가 |
| I13 | condMessages 경로 전용 테스트 | 보류 — withSourceMarker 단위 테스트가 동일 코드 경로 커버 |
| I14 | use-execution-events 인라인 타입 의미 주석 | RawMessage import 로 단일 진실 통합되어 해소됨 |
| I15 | spec §4.4.6 JSON 예시 | 확인 완료 — §4.4 의 ai_message JSON 예시와 conversationConfig 예시 둘 다 source 마커 혼재 케이스 포함 |
| I16 | third-party-oauth fix scope | commit message 에 무관 사항임을 명시. 본 작업 무관한 lint error 가 build 를 막아서 잡지 않을 수 없었음 |

## TEST WORKFLOW 결과 (재실행)

- backend lint: 0 errors / 17 warnings (모두 본 작업 무관 기존 warning)
- backend unit test: 206 suites / 3610 tests 모두 통과 (+8건 신규)
- backend build: 통과
- frontend lint: clean
- frontend unit test (conversation-utils): 17 tests 통과 (+1 신규 W13 시나리오)
- frontend build: 통과
- e2e: `make e2e-test` — 12 suites / 66 tests 통과

## Follow-up

- `plan/in-progress/ai-thread-source-mark.md` Follow-up 섹션에 UI chip 표시 (W11) 항목 등록.
- impl-prep consistency-check 부산물 (C1–C4) — `plan/in-progress/spec-update-impl-prep-findings.md` 로 위임 완료.
