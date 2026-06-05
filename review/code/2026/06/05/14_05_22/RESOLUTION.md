# RESOLUTION — A2 contextScope 자동주입 두 노드 확장 (F1~F5)

리뷰 SUMMARY: `review/code/2026/06/05/14_05_22/SUMMARY.md` (BLOCK: NO, Critical 0).
본 RESOLUTION 은 Warning 항목 F1~F5 를 반영한다. 보류 항목은 손대지 않았다.

## 발견 → 조치

| # | 발견 | 조치 |
|---|------|------|
| F1 | text_classifier / information_extractor handler 가 `meta.contextInjection` echo 누락 — conversation-thread.md §5.3 "세 노드 공통" 위배 (impl+spec 갭). 두 노드 개별 spec meta 표에도 행 없음 | (impl) 두 handler 성공 path 에 `appliedScope !== 'none'` 조건부 `meta.contextInjection` echo 추가 (ai_agent 와 동일 형태). text_classifier: single/multi-label 두 process 분기 호출부에서 `out.meta` 병합. information_extractor: single-turn `meta` 직접, multi-turn 은 첫 진입 injection 결과를 `MultiTurnState.contextInjection` 으로 운반→hydrate→`buildMultiTurnFinalOutput` meta echo. (spec) `2-text-classifier.md` §5.1·§5.2, `3-information-extractor.md` §5.1·§5.6 meta 표에 `meta.contextInjection` 행 추가 (§10/§5.3 참조). (test) 두 thread.spec 에 thread 시 echo 단언 + none 시 미포함 단언 |
| F2 | `DEFAULT_CONVERSATION_CONTEXT_SCOPE_N`(injection.ts) vs `DEFAULT_CONTEXT_SCOPE_N`(schema.ts) 이중 선언 | injection.ts 상수 삭제, schema.ts `DEFAULT_CONTEXT_SCOPE_N` import 해 사용 (단일 진실). schema.ts 는 zod 만 import 하므로 순환 없음 |
| F3 | 프론트 docs 두 노드에 `contextInjectionMode`/`includeToolTurns`/`excludeFromConversationThread` 3필드 누락 | `ai.mdx`·`ai.en.mdx` text_classifier·information_extractor 필드 표에 3필드 추가 (ai_agent 기존 문구·ko/en parity 일치) |
| F4 | `mapTurnsToChatMessages` 분기 단독 테스트 + info-extractor multi-turn none 회귀 부재 | injection.spec 에 presentation_user(prefix)/ai_tool(toolCallId 유무)/system/default 5 케이스. info-extractor thread.spec 에 multi-turn 첫 진입 contextScope=none messages 불변 회귀 |
| F5 | info-extractor multi-turn no-inputField 경로 inject 미실행 의도 불명 + 두 노드 system_text 시 injected.finalSystemPrompt 미사용 | (주석만, 동작 무변경) no-LLM 대기 경로에 "주입은 LLM 콜 있는 resume 진입에서만" 주석. 두 노드 injected.messages 소비부에 "messages[0] system content 이미 갱신됨" 주석 |

## 보류 (백로그, 미조치)

- `includeToolTurns` 가 두 노드에 노출되나 inject 무효과 — spec §10 비고가 "주입측 인터페이스 일관성용" 으로 의도 명시, 유지.
- API 비대칭 (group 파라미터·selfNodeId inline·dead re-export) — 경미.
- N=0 clamp / target undefined / droppedTurns 단독 테스트 (INFO).

## TEST 결과

| stage | status | 결과 |
|-------|--------|------|
| lint | PASS | duration=33s |
| unit | PASS | tests=40 passed |
| build | PASS | duration=75s |
| e2e (docker) | PASS | tests=173 passed |
| docs/label guard (frontend vitest) | PASS | 18 files / 1978 tests passed |

AI 노드 회귀 0: `ai-agent.thread.spec` + text-classifier/information-extractor 전체 7 suite / 181 test 통과.
