# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건. 이번 diff(`ie-endmultiturn-errorpayload-contract`, spec_impact: none)는 `spec/4-nodes/3-ai/**.md` 를 건드리지 않고 `information-extractor.handler.ts`/`node-handler.interface.ts` docblock·시그니처·pinning 테스트만 추가하는 behavior-preserving 변경으로, 5개 checker 모두 이를 확인했다.

## 전체 위험도
**LOW** — 신규 위반은 0건. 다만 `plan_coherence` 가 target 영역(`spec/4-nodes/3-ai`)에 이미 존재하던 spec-vs-구현 괴리 4건(WARNING, 전부 이전부터 열려 있던 plan 이 추적 중)을 재확인했고, 그중 1건은 durable anchor 가 없어 소실 위험이 있다.

## Critical 위배 (BLOCK 사유)

없음 — 5개 checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence/naming_collision) 전원 Critical 0건.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | Multi-turn `out` 포트 유무 자기모순 (요구사항 spec vs 기술 spec 정반대, 4회+ 연속 노출) | `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 (라인 217, 231 마이그레이션절: "Multi Turn 모드에는 out 포트 없음, 조건 0개도 동일") | `spec/4-nodes/3-ai/_product-overview.md` ND-AG-24, `spec/4-nodes/_product-overview.md`(root) ND-AG-24 — 둘 다 "조건 0개 시 out+error 제공(하위호환)"으로 정반대 서술 | 이번 PR 블로킹 사유 아님. `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1 을 다음 project-planner 턴에서 코드(`ai-agent.handler.ts`/`ai-turn-executor.ts`)를 SoT 로 확정해 실제 처분 — 5회째 반복 노출 전에 우선순위 상향 권고 |
| 2 | plan_coherence | §7.3 single-turn `error` 포트가 미구현(uncaught throw → engine FAILED)인데 target 문서가 무조건 사실처럼 서술, `pending_plans` frontmatter 에도 누락 | `spec/4-nodes/3-ai/1-ai-agent.md` §7.3 (라인 632-664) + frontmatter `pending_plans` | `plan/in-progress/node-output-redesign/ai-agent.md` "CRITICAL(single-turn 잔여)" — `executeSingleTurn` 의 `llmService.chat` 이 try/catch 미포장(2026-05-16 최초 발견, 여전히 미완료) | project-planner 트랙: (a) frontmatter `pending_plans` 에 해당 plan 추가, (b) §7.3 본문에 "현재 uncaught throw(Planned: try/catch 래핑)" 캐비어 명시. 이번 PR 블로킹 대상 아님 |
| 3 | plan_coherence | §5.5 IE `resumed` 스냅샷도 동일 패턴 — 미구현인데 사실처럼 서술, frontmatter 에 `pending_plans` 필드 자체 부재 | `spec/4-nodes/3-ai/3-information-extractor.md` §5.5 (라인 393-421) + frontmatter (`pending_plans` 없음) | `plan/in-progress/node-output-redesign/information-extractor.md` — 엔진이 IE turn 에서 `status:'resumed'` 스냅샷 emit 안 함(form/buttons 경로만 emit), 2026-05-16 최초 발견 → 오늘 impl-prep 에서도 "C3"로 재확인 | frontmatter 에 `pending_plans: [plan/in-progress/node-output-redesign/information-extractor.md]` 추가 + §5.5 본문에 미구현 캐비어. project-planner 트랙, 비차단 |
| 4 | convention_compliance + plan_coherence (병합) | `0-common.md §5/§9` 가 wrapper 계약 근거를 실제와 다른 "(Principle 11)"로 오귀속 (실제는 Principle 1.1/3.2/4.4/8.2가 분담). 이 WARNING 을 적발한 근거 plan 이 곧 `complete/` 로 이동해 durable 추적처 소실 위험 | `spec/4-nodes/3-ai/0-common.md` §5 헤더/본문(라인 81-83), §9 교차링크(라인 144) | `spec/conventions/node-output.md` Principle 11(실제=출력 예시 문서화 서식 규칙, wrapper 구조 근거 아님) — 형제 문서(`2-text-classifier.md:130`, `3-information-extractor.md:181`)의 동일 표현은 올바른 용법이라 혼동 유발 | project-planner 트랙: `0-common.md` §5/§9 텍스트를 "(Principle 1.1/3.2/4.4/8.2)"로 정정(코드 변경 불요, 순수 spec 오타). 근거 plan 이 사라지기 전에 이 WARNING 을 `spec-drift-ai-agent-outport-countmax.md` 에 항목 추가하거나 지금 바로 정정 권고 — durable anchor 없이 소실되는 패턴 재발 방지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/5-system/6-websocket-protocol.md` 내 `§4.4` 섹션 번호 중복(사전 존재, target 무관·앵커 slug 는 상이해 실질 링크 오류 없음) | `spec/5-system/6-websocket-protocol.md` L378/L747 (target 은 다회 인용만 함) | target 수정 불요. 해당 문서 후속 작업에서 두 번째 §4.4(알림 이벤트)를 §4.5 로 재번호 검토 |
| 2 | rationale_continuity | `spec/5-system/4-execution-engine.md §8` "노드별 기본 타임아웃 30초" 표가 실제 노드별 상이한 기본값(Code 30s/Background 300s/AI Agent 600s)과 cross-reference 없이 병존 | `spec/4-nodes/3-ai/1-ai-agent.md §12.16`(`AI_AGENT_LLM_CALL_TIMEOUT_MS`=600000ms) vs `execution-engine.md §8` | AI Agent 문서 수정 불요. execution-engine.md §8 표에 "노드 타입별 상이" 각주 추가 검토 (project-planner 트랙) |
| 3 | convention_compliance | `1-ai-agent.md §7.1~§7.9` 출력 케이스 헤더가 Principle 11 `### Case: <이름>` 서식과 불일치(서술형 제목 사용, 형제 문서는 준수) | `spec/4-nodes/3-ai/1-ai-agent.md` §7.x 헤더 | 우선순위 낮음. 후속 spec 편집 시 `### N.M Case: …` 형태로 통일 검토 |
| 4 | naming_collision | 이번 diff 의 "신규처럼 보이는" 식별자(`_errorPayload`/`_failedUserMessage`/`_failedUserMessageSource`/`ResumableMessageSource`)는 전부 `node-handler.interface.ts` 기존 계약·export 재사용이며 신규 의미 없음 | `information-extractor.handler.ts` | 조치 불요(positive confirmation) |
| 5 | convention_compliance | 신규 docblock 이 인용하는 `3-information-extractor.md §5.3` retryable invariant 는 실제 spec 원문과 정확히 일치 | `node-handler.interface.ts:452-475`, `information-extractor.handler.ts:1180-1220` | 조치 불요(positive confirmation) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 11개 교차 영역(MCP Client·Agent Memory·ConversationThread·Presentation 공통·실행엔진·데이터모델·interaction-type-registry 등) 전수 대조, 실질 모순 없음. INFO 1건은 target 무관 |
| rationale_continuity | NONE | target(`spec/4-nodes/3-ai`) 이번 브랜치 무변경(diff 0). §12 다단계 번복 이력이 매번 근거 명시 패턴 준수. INFO 1건은 인접 문서(execution-engine.md) 표 정합 제안 |
| convention_compliance | LOW | 신규 docblock 인용 정확(위반 0). 회귀 확인된 기존 WARNING 1건("(Principle 11)" 오귀속, 이번 diff 미도입) + INFO 1건(Case: 헤더 서식) |
| plan_coherence | LOW | 이번 PR 자체는 spec 미변경으로 신규 충돌 없음. 다만 target 문서에 이미 열려있던 spec-vs-구현 괴리 3건(out 포트 자기모순/§7.3 미구현/§5.5 미구현) + durable anchor 없는 WARNING 1건 재확인 |
| naming_collision | NONE | 신규 식별자 전부 기존 인터페이스 계약 재사용, 의미 충돌 없음. `spec/4-nodes/3-ai/*.md` diff 0줄 재확인 |

## 권장 조치사항

1. (이번 PR 비차단, project-planner 다음 우선순위) `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1(Multi-turn `out` 포트 자기모순)을 코드 SoT 확인 후 실제 처분 — 5회째 WARNING 노출 전에 해소.
2. `1-ai-agent.md`(§7.3) frontmatter 에 `plan/in-progress/node-output-redesign/ai-agent.md` cross-link 추가 + 본문에 미구현 캐비어 삽입.
3. `3-information-extractor.md`(§5.5) frontmatter 에 `pending_plans: [plan/in-progress/node-output-redesign/information-extractor.md]` 추가 + 본문에 미구현 캐비어 삽입.
4. `0-common.md §5/§9` 의 "(Principle 11)" 오귀속을 "(Principle 1.1/3.2/4.4/8.2)"로 정정(코드 변경 불요) — 근거 plan(`ie-endmultiturn-errorpayload-contract.md`)이 complete 로 이동하기 전에 durable anchor 확보 또는 즉시 정정.
5. (낮은 우선순위, 선택) `execution-engine.md §8` 타임아웃 표에 노드별 상이 각주, `1-ai-agent.md §7.x` 헤더 `Case:` 서식 통일.
