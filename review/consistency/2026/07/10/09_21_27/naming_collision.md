# 신규 식별자 충돌 검토 — spec/data-flow/7-llm-usage.md (--impl-done)

## 점검 범위 확인

- `diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md` = **빈 diff** (target spec 파일 자체는 이번 브랜치에서 미변경, origin/main 과 동일). 확인:
  `git -C /Volumes/project/private/clemvion/.claude/worktrees/ai-usage-attribution-hardening-358929 diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md` → 출력 없음.
- 실제 변경은 코드 5개 파일(`ai-agent.memory.spec.ts`, `ai-memory-manager.ts`, `ai-turn-executor.ts`, `agent-memory-injection.spec.ts`, `agent-memory-injection.ts`) — 모두 `spec/data-flow/7-llm-usage.md §1.3` (기존 attribution 배선 패턴)을 AI Agent 자동 메모리 롤링 요약 압축 chat 에 확장 적용하는 내부 배선.
- `plan/in-progress/ai-usage-attribution-hardening.md` 는 이 spec 문서 자체의 갱신(§1.3 표 L107·§4·Rationale stale 서술 정정)을 **의도적으로 별도 PR-2(project-planner)로 이관**한다고 명시 — 즉 이번 target 문서는 신규 텍스트를 도입하지 않는다. (spec 텍스트가 구현을 아직 못 따라간 staleness 문제는 존재하나, 이는 "신규 식별자 충돌" 관점이 아니라 spec-drift/impl-coverage 관점의 사안이라 본 리뷰 범위 밖으로 판단해 별도 findings 로 다루지 않음.)

이번 diff 가 실제로 도입/확장하는 식별자는 아래와 같으며, 전부 코드 레벨 신규 식별자다. 6개 관점 각각에 대해 기존 사용처와 대조했다.

## 신규/확장 식별자 목록 및 대조 결과

| 식별자 | 종류 | 대조 결과 |
| --- | --- | --- |
| `LlmCallContext.workflowId` / `.nodeExecutionId` (필드 추가) | 인터페이스 필드 | `codebase/backend/src/modules/llm/llm.service.ts:41-45` 에 **기존에 이미 정의**된 인터페이스(pre-existing, diff 는 단지 이 필드들을 소비하는 새 caller 를 추가). 정의 자체는 이번 diff 의 변경분이 아님 — 충돌 없음. |
| `AiMemoryManager.injectMemoryContext` args 의 `workflowId?: string` / `nodeExecutionId?: string` (신규 optional 필드, `ai-memory-manager.ts:113-124`) | 함수 인자 객체 필드 | 같은 args 객체 내 기존 `workspaceId`(§워크스페이스 스코프, 이미 존재) / `executionId`(이미 존재)와 이름이 겹치지 않고, 의미도 `LlmCallContext` 와 동일한 attribution 목적으로 일관. 동일 파일 내 다른 의미의 `workflowId`/`nodeExecutionId` 사용처 없음 (`git grep` 확인). |
| `BuildSummaryBufferArgs.llmContext?: LlmCallContext` (신규 optional 필드, `agent-memory-injection.ts:287`) | 인터페이스 필드 | `llmContext` 라는 프로퍼티명은 이미 `ai-memory-manager.ts`(`llmContext: {...}`, L253), `ai-turn-executor.ts`(`llmContext: LlmCallContext`, L2608), `information-extractor.handler.ts`(`llmContext?: LlmCallContext`, L993/1885) 에서 **동일 타입·동일 의미**로 일관 사용 중. `git grep -n "llmContext" -- codebase/` 전체 28건 확인 — 전부 `LlmCallContext`(workflowId/executionId/nodeExecutionId) 의미로 일관, 다른 의미의 `llmContext` 사용처 없음. |
| `LlmCallContext` import 확장 (`ai-turn-executor.ts`, `agent-memory-injection.ts` 가 새로 import) | 타입 참조 | 정의는 `llm.service.ts` 단일 소스. frontend/packages/channel-web-chat 전역 grep 결과 동일명 타입/충돌 없음. |
| 테스트 mock 리터럴 `'ne-row-1'`, `'nodeexec-row-1'`, `'wf-1'`, `'exec-1'` | 테스트 fixture 값 | 각 spec 파일 로컬 스코프의 mock 데이터 문자열. 다른 테스트의 동일 리터럴과 의미 충돌 없음(격리된 unit test). |

## 6개 관점별 검토

1. **요구사항 ID 충돌** — 해당 없음. `spec/data-flow/*` 문서군은 요구사항 ID 스킴을 쓰지 않는(§1.3 표는 caller 카탈로그이지 ID 목록이 아님) 기술 흐름 문서이고, 이번 diff 는 spec 문서에 어떤 텍스트도 추가하지 않았다.
2. **엔티티/타입명 충돌** — 신규 타입 정의 없음. `LlmCallContext`/`BuildSummaryBufferArgs` 모두 기존 정의에 필드를 추가하거나 기존 정의를 재사용. 다른 의미의 동명 타입 없음.
3. **API endpoint 충돌** — 해당 없음. 이번 diff 는 controller/route 변경이 없다(순수 노드 내부 로직 배선).
4. **이벤트/메시지명 충돌** — 해당 없음. webhook/queue/SSE 이벤트명 변경 없음.
5. **환경변수·설정키 충돌** — 해당 없음. 신규 ENV var·config key 없음.
6. **파일 경로 충돌** — 해당 없음. 신규 spec 파일 생성 없음(target 경로는 기존 파일, 미변경).

## 참고 (충돌 아님, 맥락 정보)

`spec/data-flow/7-llm-usage.md` §1.3 표 L107·§4·Rationale 이 "AI Agent 자동 메모리 롤링 요약 압축 = context 미전달/전부 NULL(미배선)" 이라고 서술하는데, 이번 diff 로 코드는 이미 그 배선을 완료했다. 이는 신규 식별자 충돌이 아니라 spec 텍스트가 구현에 뒤처진 **staleness** 이며, plan (`plan/in-progress/ai-usage-attribution-hardening.md` §SPEC-DRIFT)이 PR-2(project-planner)에서 정정하기로 명시적으로 이관해 둔 사안이다. 다른 검토 관점(spec-drift/consistency)에서 다룰 사안으로 보고 본 checker 의 발견사항에는 포함하지 않는다.

## 요약

이번 diff 는 이미 `LlmService`/`LlmCallContext` 로 확립된 attribution 필드 명명 규약(`workflowId`/`executionId`/`nodeExecutionId`, 프로퍼티명 `llmContext`)을 AI Agent 자동 메모리 롤링 요약 압축 chat 경로 하나에 추가로 배선한 것이며, 신규 타입·엔드포인트·이벤트·환경변수·spec 파일을 전혀 도입하지 않는다. 확장된 필드들은 코드베이스 전역에서 `git grep` 으로 교차 확인한 결과 기존 동명 식별자와 의미가 완전히 일치해, 신규 식별자 충돌 관점에서 CRITICAL/WARNING/INFO 어느 등급의 발견사항도 없다.

## 위험도

NONE
