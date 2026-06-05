# Code Review 통합 — A2 contextScope 자동주입 두 노드 확장

**BLOCK: NO** — Critical 0. 6 reviewer(architecture/side-effect/requirement/maintainability/testing/scope) 전원 BLOCK:NO.
대상(merge-base 9e65f853..HEAD): ai_agent thread-inject 공유유틸 추출 + text_classifier/information_extractor 배선 + spec.
**side-effect: ai_agent 추출 100% 동치 확인(PASS, 회귀 0).** 게이트 lint/unit/build/e2e(173) PASS.

## Critical
_없음._

## Warning (조치)
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| F1 | requirement/testing/maintainability/side-effect | 두 노드 handler 에 `meta.contextInjection` echo 누락 — conversation-thread §5.3 "세 노드 공통" 위배(impl+spec 갭). 두 노드 개별 spec meta 표에도 행 없음 | 두 handler 성공 path 에 `appliedScope!=='none'` 조건부 `meta.contextInjection` echo + 두 노드 spec meta 행 + 테스트 |
| F2 | architecture/side-effect/maintainability | `DEFAULT_CONVERSATION_CONTEXT_SCOPE_N`(injection.ts) vs `DEFAULT_CONTEXT_SCOPE_N`(schema.ts) 이중 선언, drift 위험 | injection.ts 가 schema.ts 상수 import(단일 진실) |
| F3 | scope | 프론트 docs(ai.mdx/en) 두 노드에 5필드 중 2개만 — 3필드(contextInjectionMode/includeToolTurns/excludeFromConversationThread) 누락 | 누락 3필드 docs 추가(ko/en) |
| F4 | testing | `mapTurnsToChatMessages` public 승격 후 presentation_user/ai_tool/system 분기 단독 테스트 없음 + info-extractor multi-turn 회귀(none) 케이스 없음 | 분기 테스트 + multi-turn none 회귀 케이스 추가 |
| F5 | architecture/maintainability | info-extractor multi-turn no-inputField 경로 inject 미실행(의도 불명) + 두 노드 system_text 시 injected.finalSystemPrompt 미사용 | 주석으로 의도 명시(no-LLM 대기경로/messages[0] 이미 갱신) |

## 보류(백로그)
- includeToolTurns 가 두 노드에 노출되나 inject 무효과 — **spec(§10 비고) 이 "주입측 인터페이스 일관성용"으로 의도 명시**, 유지.
- API 비대칭(group 파라미터·selfNodeId inline·dead re-export) — 경미.
- N=0 clamp/target undefined/droppedTurns 단독 테스트(INFO).

## reviewer별 BLOCK: architecture NO · side-effect NO · requirement NO · maintainability NO · testing NO · scope NO
