# Code Review 통합 — agent-memory 공유 유틸 추출 (#484 후속 리팩토링)

**BLOCK: NO** — Critical 0. 5 code reviewer 전원 BLOCK:NO. behavior-preserving 확인(side-effect: JSON schema byte-identical·DEFAULT 값·resolveMemoryTtlDays/scheduleExtraction 불변). 게이트 lint/unit/build/e2e(174) PASS, 22 suites/675 tests.

## 조치(legit)
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| A | architecture/maintainability/cross-spec/convention(4) | IE handler 가 DEFAULT_MEMORY_TOP_K/THRESHOLD 를 아직 `ai-agent/ai-agent.schema` 경유 import(경계 미완) | `shared/agent-memory-schema` 직접 import |
| B | testing(W×3) | shared 승격 헬퍼(resolveMemoryTtlDays·scheduleMemoryExtraction·buildAgentMemorySchemaFields) 직접 단위테스트 부재 | resolveMemoryTtlDays 경계 직접 테스트 + IE/ai_agent schema 차이(summary_buffer/tokenBudget/summaryModel 유무) 핀 + scheduleMemoryExtraction 핵심 경로(no-op/graceful/watermark) 단위테스트 |
| C | cross-spec(INFO) | 17-agent-memory.md code: 에 shared 파일 미등록(AGM-04/08 evidence) | shared 두 파일 추가 |
| D | side-effect(W1) | ai-agent.handler JSDoc "getThreadExcludingNode" stale(실제 getThread) | 주석 정정 |

## 보류(backlog — followup-v2)
- maintainability(W): recall 패턴 중복(injectMemoryContext vs injectRecallPrefix) → `performRecallAndBuildPrefix` 공유 추출(다음 리팩토링).
- selfNodeId dead param 제거, buildAgentMemorySchemaFields 반환 타입 정밀화, estimateTokensLanguageAware non-export.

## ⚠️ FALSE POSITIVE
- scope(W1) "A4 lite(estimateTokensLanguageAware)가 본 PR 신규 기능·'동작 불변' 라벨 부정확" → **FP. A4 lite 는 main(#485)에 이미 존재**(git show merge-base 에 3건), git mv 가 운반한 것. 본 PR 동작 변경 0. reviewer 가 rename diff 오독.

## reviewer별 BLOCK: architecture NO · side-effect NO · scope NO · maintainability NO · testing NO
