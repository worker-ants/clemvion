STATUS=success

===REPORT_MARKDOWN_BELOW===

# 정식 규약 준수 검토 — convention_compliance

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
확인된 사실: 이번 PR(`retry-turn-cancel-guard-ba75a2`)은 `spec/` 에 대한 diff 가 **0줄**이다
(`git diff origin/main --stat -- spec/` 공백). 실제 변경은
`codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (+테스트) 한 곳뿐이고,
`RetryTurnService.finalizeGuarded()` 신설 + `completeRetryExecution`/`failRetryExecution` 을
guarded UPDATE(+`canTransition` 검사)로 전환하는 버그 픽스다. 따라서 본 리뷰는 diff 자체가 아니라
"이 코드 변경이 전제로 삼는 spec/conventions 상태가 지금도 정합한가"를 기준으로 수행했다.

## 발견사항

- **[WARNING]** `spec/conventions/node-cancellation.md` §6 구현 현황 표 + `code:` 가 이번 변경으로 확장된 실제 구현 표면(`retry-turn.service.ts`)을 반영하지 못함 — 동일 파일(`spec/5-system/4-execution-engine.md`) 안에 구·신 서술이 병존하는 자기모순 동반
  - target 위치: `spec/5-system/4-execution-engine.md` §1.1 상태 전이표 63~77행(특히 77행 `failed→running` 행) 및 §1.3 산문 1448~1454행("`failed → running` 재진입 전이" 절)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` R-1(“status: partial spec 의 `code:`/구현현황은 실제 구현 surface 를 추적해야 한다” — 글로브 매치 자체는 통과하지만 완전성은 이 컨벤션의 명시 관심사) · `spec/conventions/node-cancellation.md` §6 구현 현황 표(“코드 대조로 갱신” 원칙) · §2.4 문서 자체("두 절을 섞으면 … 오독이 생긴다 — 실제로 그 오독이 결함의 배경이었다"는 경고가 이번에도 반복되는 형국)
  - 상세: `spec/5-system/4-execution-engine.md` 77행/1454행은 "replay 가 RUNNING 으로 도는 중 도착한 cancel 은 graceful no-op … 취소는 다음 `waiting_for_input` park 에서 비로소 발효된다 … (replay 가 park 없이 그 turn 에서 종결되면 cancel 은 무효과로 흘려보내진다.)" 라고 서술한다. 그런데 같은 파일 79~92행(§2.4, 2026-07-27 신설)은 "park↔resume 짝 전이 terminal 가드" — 즉 park 여부와 무관하게 이미 `cancelled` 로 기록된 실행 위에 뒤늦은 `FAILED`/`COMPLETED` 쓰기가 절대 덮어쓰지 못한다 — 를 규정한다. 이번 PR 이 코드로 실제로 만든 것이 후자다: `finalizeGuarded()` 는 `canTransition(live.status, target)` 이 거짓이면(=DB 가 이미 `cancelled`) 저장·이벤트 emit 을 전부 skip한다(회귀 테스트 문구 "정본이 이미 CANCELLED 면 FAILED 로 전이를 시도조차 하지 않는다" — `retry-turn.service.spec.ts`). 즉 77/1454행의 "park 없이 종결되면 cancel 은 무효과로 흘려보내진다"는 서술은 **현재 코드와 반대**다. 같은 문서 안에서 같은 주제(재진입 replay 중 cancel 처리)에 대해 정반대 결론이 공존한다. 부수적으로 `node-cancellation.md` 의 `code:` frontmatter(9개 파일 명시 — `execution-engine.service.ts`·`ai-turn-orchestrator.service.ts` 등)와 §6 표 어디에도 `retry-turn.service.ts`/`finalizeGuarded` 행이 없어, 이 컨벤션이 규율하는 "DB 관측 취소 가드" 구현 목록이 실제보다 좁게 잡혀 있다.
  - 이미 추적 중: `plan/in-progress/retry-turn-terminal-guard.md` 하단 "project-planner 위임(developer 권한 밖)" 항목이 정확히 이 두 가지(77/1454행 정정, node-cancellation.md §6 행 추가)를 이미 자체적으로 지목해 두었다 — `developer` 가 `spec/` write 권한이 없어(CLAUDE.md skill 표) 올바르게 project-planner 턴으로 넘긴 상태이며, 이 검토 시점까지 미해결이다. 다만 그 plan 파일 frontmatter 는 `spec_impact: none` 인데 본문은 spec 정정이 필요하다고 명시하는 자기모순이 있다 — plan 이 `complete/` 로 이동할 때 Gate C(`spec-plan-completion.test.ts`)가 이 필드를 그대로 신뢰하므로, 지금 상태로 완료 처리되면 "spec 영향 없음"이 잘못 확정된다.
  - 제안: project-planner 턴에서 (1) `4-execution-engine.md` 77/1454행을 §2.4/node-cancellation.md와 정합하도록 정정 — "replay 는 park 도달 여부와 무관하게, DB 에 이미 기록된 cancel 을 절대 덮어쓰지 않는다"는 취지로. (2) `node-cancellation.md` §6 표에 `retry-turn.service.ts`(`finalizeGuarded`) 행을 추가하고 frontmatter `code:` 에도 등재. (3) `retry-turn-terminal-guard.md` 의 `spec_impact: none` 을 위 정정 대상 spec 경로 목록으로 갱신(또는 완료 전 재검토 필요 표시).

- **[INFO]** `spec/5-system/*.md` 전반의 "Overview" 표제 표기 불균일 (3섹션 권장 규약과의 형식적 거리)
  - target 위치: `spec/5-system/` 디렉토리 전체 — `11-mcp-client.md`·`5-expression-language.md`·`7-llm-client.md` 는 `## Overview` 대신 `## 1. 개요`; `2-api-convention.md`·`6-websocket-protocol.md`·`16-system-status-api.md` 는 Overview 성격 섹션 없이 바로 `## 1. ...` 로 시작. 반면 `1-auth.md`·`4-execution-engine.md`·`10-graph-rag.md`·`12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·`17-agent-memory.md`·`8-embedding-pipeline.md`·`9-rag-search.md` 는 리터럴 `## Overview` 사용
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" — `## Overview (제품 정의)` 표제 권장
  - 상세: "권장"(MUST 아님) 조항이라 CRITICAL/WARNING 대상은 아니며, 이번 PR 범위(retry-turn)와도 무관한 이전부터의 상태다. `_product-overview.md` 는 그 자체가 Overview 컨텐츠이므로 예외로 타당하다(구조 위반 아님).
  - 제안: 시급하지 않음. 향후 spec/5-system 전체를 손보는 별도 정리 작업(project-planner) 이 있을 때 표제를 `## Overview` 로 통일하는 것을 고려. 이번 PR 의 스코프에서 조치할 필요는 없음.

이 외 확인했으나 위반 없음(참고용):
- `error-codes.md`/`node-output.md` §3.2.1 의 `retryable === true` 일 때만 `retryAfterSec` 를 set 하는 invariant — `ai-turn-orchestrator.service.ts:1347-1360`, `information-extractor.handler.ts:1455-1461`, `text-classifier.handler.ts:238-240` 전부 `if (retryable)` 가드 뒤에서만 `retryAfterSec` 를 계산·병합해 위반 없음(이번 PR 의 diff 밖이지만 인접 영역이라 함께 확인).
- 이번 PR 이 신설한 `finalizeGuarded`/`canTransition` 임포트는 기존 `state-machine.ts` 의 이미 export 된 함수를 재사용한 것으로, 신규 명명 표면이 없다.
- WS 이벤트 페이로드에 `cancelledBy` 가 빠져 있는 문제(`6-websocket-protocol.md` §4.1 요구와의 불일치)는 이미 `review/code/2026/07/28/00_44_54`(5R, api_contract 리뷰어 W1)에서 **코드-vs-스펙 불일치**로 별도 추적 중이다 — 이는 "target 문서가 conventions 를 따르는가"가 아니라 "코드가 spec 을 따르는가" 문제라 본 checker 의 판단 축(정식 규약 준수) 밖으로 판단해 중복 보고하지 않는다.

## 요약

이번 PR 은 `spec/5-system/` 에 어떤 변경도 가하지 않은 순수 코드 버그 픽스(retry-turn 종결 경로의 무가드 terminal 쓰기 차단)라, target 문서 자체가 새로 conventions 를 위반할 여지는 없다. 다만 이 PR 이 실제로 구현한 동작(재진입 replay 도중 도착한 cancel 은 park 여부와 무관하게 항상 보존됨)은 `spec/5-system/4-execution-engine.md` 안에 남아있는 구(舊) 서술(재진입이 park 없이 끝나면 cancel 이 무효과로 흘려보내진다)과 정면으로 배치되며, 이 사실은 `node-cancellation.md` §6 구현 현황 표의 갱신 누락과 함께 spec-impl-evidence 컨벤션이 기대하는 "구현 현황 추적의 정합성"을 흐린다. 다행히 이 갭은 developer 가 스스로 발견해 `plan/in-progress/retry-turn-terminal-guard.md` 에 project-planner 위임 항목으로 이미 등재해 두었고(CLAUDE.md 워크플로 그대로), 빌드 가드를 깨는 CRITICAL 은 아니다 — 단 그 plan 의 `spec_impact: none` 이 본문과 모순되므로 완료 처리 전에 반드시 재확인이 필요하다. 그 외 명명·출력 포맷·API 문서·금지 패턴 관점에서는 이번 변경과 직접 관련된 범위 내에서 위반을 발견하지 못했다.

## 위험도

LOW
