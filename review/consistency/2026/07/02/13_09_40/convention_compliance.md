# 정식 규약 준수 검토 — `spec/4-nodes/3-ai/1-ai-agent.md`

검토 모드: `--impl-done` (diff-base `origin/main`)
Target spec: `spec/4-nodes/3-ai/1-ai-agent.md`
구현 SoT (워킹트리, 절대경로): `/Volumes/project/private/clemvion/.claude/worktrees/m7-ai-turn-executor-75ed1b`

## 검토 범위 요약

이번 diff는 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 내부에서 `state`/`source` 매개변수를 `Record<string, unknown>` 캐스팅 대신 신규 `ResumeState`/`RetryState`(`codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts`) zod-infer 타입으로 좁히는 **behavior-preserving 내부 리팩터링**이다 (M-7 RESUME-STATE 클러스터). 부수적으로 `to-record.ts`(`isRecord` 가드) JSDoc·테스트가 보강됐다. target spec 문서(`1-ai-agent.md`) 자체는 이번 diff로 변경되지 않았다 — 즉 이번 검토는 "새 spec 서술이 conventions 를 지키는가" 가 아니라 "diff 가 spec/conventions 가 이미 서술한 shape·정책과 어긋나지 않는가" 를 확인하는 작업이다.

## 발견사항

### [INFO] `resume-state.schema.ts` / `to-record.ts` 는 `code:` frontmatter·conventions 어디에도 명시적으로 등재되지 않음

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록 (라인 4-16)
- 위반 규약: 명시적 위반 아님 — `spec/conventions/spec-impl-evidence.md` §2 frontmatter 스키마는 "구현 파일 전체 enumerate" 를 요구하지 않는다 (대표 파일 목록 취지).
- 상세: diff 의 신규 타입 SoT 파일 `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 와 변경된 `codebase/backend/src/modules/execution-engine/utils/to-record.ts` 는 `1-ai-agent.md` 의 `code:` 목록에도, `spec/5-system/4-execution-engine.md` 의 `code:` 목록에도 나타나지 않는다 (두 spec 모두 `ai-turn-executor.ts`/`execution-engine.service.ts` 등 상위 파일만 나열). `resume-state.schema.ts` 는 두 노드(`ai_agent`/`information_extractor`)에 걸친 공유 유틸이라 어느 한 spec 파일 소유로 단정하기 애매한 위치이기도 하다.
- 제안: 강제 조치 불필요(현재도 `spec-impl-evidence.md` 가드를 통과하는 범위). 다만 이 파일이 `_resumeState`/`_resumeCheckpoint`/`_retryState` 3종 타입의 **단일 SoT**로 성격이 뚜렷해졌으므로, 후속 spec 갱신 시 `1-ai-agent.md` 와 `5-system/4-execution-engine.md` 의 `code:` 목록에 `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 를 추가하는 편이 spec-코드 추적성에 도움이 된다 (선택 사항, CRITICAL/WARNING 아님).

### [INFO] `ResumeState`/`RetryState` 필드 shape 는 spec §7.9 / `node-output.md` §4.2.1 서술과 정합

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 (라인 887-951), `spec/conventions/node-output.md` §4.2.1 (라인 200-216)
- 상세(확인 결과, 위반 아님): `resume-state.schema.ts` 의 `credentialStripSubsetShape` 및 `CREDENTIAL_CONTEXT_FIELDS`(`llmConfigId`/`workspaceId`/`executionId`/`nodeId`/`workflowId`/`maxTurns`/`maxToolCalls`/`conditions`/`presentationTools`/`conversationThreadRef`/`rawConfig`) 는 `node-output.md` §4.2.1 및 `4-execution-engine.md` §1.3 이 "credential / context-binding 필드로 재개 시 미동봉·`node.config` 재유도" 라고 서술한 필드군과 정확히 일치한다. `RetryState` 의 `expiresAt`/`lastUserMessage`/`lastUserMessageSource`/`retryAfterSec` 필드도 `1-ai-agent.md` §7.9 JSON 예시·서술과 일치한다. diff 는 이 기존 계약을 어기지 않고 타입으로 명시했을 뿐이다.
- 제안: 없음 (준수 확인).

### [INFO] `isRecord`/`toRecord` 유틸은 conventions 대상 밖

- target 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.ts`, `to-record.spec.ts`
- 상세: `spec/conventions/**` 어디에도 `toRecord`/`isRecord` 명명이나 타입가드 패턴에 대한 규약이 없다. 이번 diff 는 JSDoc 에 "plain-object 가드가 아니다" 캐비어트를 추가하고 이를 뒷받침하는 문서화 테스트(class 인스턴스·`Object.create(null)`)를 보강한 것으로, 정식 규약 위반 여지가 없는 순수 내부 유틸 개선이다.
- 제안: 없음.

### [INFO] 명명 규약 — camelCase 필드명·타입명 일관성

- target 위치: `resume-state.schema.ts` 전체
- 상세: `ResumeState`/`ResumeCheckpoint`/`RetryState` PascalCase 타입명, `resumeStateSchema`/`resumeCheckpointSchema`/`retryStateSchema` camelCase 변수명은 프로젝트 TypeScript 관례 및 `1-ai-agent.md`/`node-output.md` 가 이미 쓰는 `_resumeState`/`_resumeCheckpoint`/`_retryState` (top-level internal 필드, 언더스코어 프리픽스) 네이밍과 자연스럽게 대응한다. `audit-actions.md` 같은 명시적 "명명 규약" 대상은 아니나(TS 식별자는 conventions 문서의 규율 대상이 아님) 기존 컨벤션과 충돌하지 않는다.
- 제안: 없음.

## 요약

이번 diff(M-7 RESUME-STATE 클러스터 첫 착수분)는 `ai-turn-executor.ts` 의 `state`/`source` 매개변수 타입을 `Record<string, unknown>` 캐스팅에서 신규 `ResumeState`/`RetryState`(zod-infer, `resume-state.schema.ts`) 로 좁히는 behavior-preserving 내부 리팩터링이며, target spec(`1-ai-agent.md`)은 이번 diff로 수정되지 않았다. 신규 타입의 필드 구성(`credentialStripSubsetShape`, `CREDENTIAL_CONTEXT_FIELDS`)은 `spec/conventions/node-output.md` §4.2.1 및 `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 가 이미 서술한 `_resumeState`/`_resumeCheckpoint`/`_retryState` 의 credential-strip 부분집합·필드 shape 와 정확히 일치하며, API 응답 포맷·에러 코드·명명 규약·API 문서 데코레이터·금지 패턴 어느 관점에서도 CRITICAL/WARNING 급 위반이 발견되지 않았다. `resume-state.schema.ts` 를 관련 spec 의 `code:` frontmatter 에 추가하는 것은 추적성 개선 차원의 선택적 제안(INFO)일 뿐 규약 위반은 아니다.

## 위험도

NONE
