# Documentation Review — AiTurnExecutor 추출 (M-1 3단계)

## 발견사항

### [INFO] `multiTurnPortForEndReason` — JSDoc 블록이 중복 선언됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 라인 3075~3086
- 상세: `multiTurnPortForEndReason` static 메서드 직전에 JSDoc 블록이 두 개 연속 붙어 있다. 첫 번째 블록(라인 3075~3084)이 메서드를 설명하고, 두 번째 블록(라인 3085~3095)이 `buildRetryState` 를 설명하며 실제로는 그 다음에 위치한 `buildRetryState` private static 에 붙어야 한다. TypeScript 에서 JSDoc 은 바로 직전 블록만 해당 선언에 결합되므로, 현재 배치에서는 `multiTurnPortForEndReason` 의 JSDoc 이 `buildRetryState` 의 JSDoc 으로 덮어씌워진다. IDE 툴팁과 자동생성 문서에서 `multiTurnPortForEndReason` 의 설명이 표시되지 않고, `buildRetryState` 의 설명이 두 번 노출된다.
- 제안: `multiTurnPortForEndReason` 의 JSDoc(라인 3075~3084)을 메서드 선언(라인 3153) 바로 위로 이동하거나, `buildRetryState` 의 JSDoc(라인 3085~3095)을 `buildRetryState` 선언(라인 3096) 위에 단독 배치한다.

### [INFO] `executeSingleTurn` / `executeMultiTurn` / `processMultiTurnMessage` — 공개 메서드에 JSDoc 미부착
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — 공개(`export class AiTurnExecutor`) 메서드 세 곳
- 상세: 클래스 레벨 JSDoc(`@AiTurnExecutor`)과 constructor 파라미터 JSDoc 은 충실하다. 그러나 가장 복잡한 세 공개 메서드(`executeSingleTurn`, `executeMultiTurn`, `processMultiTurnMessage`)에는 메서드 레벨 JSDoc 이 없다. 클래스 설명에 역할이 서술되어 있으나, 각 메서드의 파라미터 의미(`_input` 가 unused 인 이유, `state` 의 출처, `options` 의 optional 의미)·반환값 형태·side effect(thread push, memory enqueue)를 별도 메서드 JSDoc 으로 분리하면 이 파일을 처음 보는 기여자의 이해 비용이 낮아진다.
- 제안: 세 메서드에 최소한 `@param`·`@returns`·side-effect 요약 JSDoc 을 추가한다. 내용은 이미 인라인 주석에 분산되어 있으므로 추출 수준으로 충분하다.

### [INFO] `buildTools` private 메서드 — 주석이 `normalTools` stub 의 현재 상태를 정확히 설명하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 라인 3314
- 상세: 인라인 주석에 "일반 도구(`tool_*`) 입력 경로는 스키마에서 제거됨 — 재작성 시 새 디자인으로 복원"이라고 서술되어 있고 `normalTools: ToolDef[] = []`로 항상 빈 배열이다. 이 주석은 정확하나, 빈 배열이 실제로 최종 반환값에 포함되어 있어 (`[...providerTools, ...normalTools, ...conditionTools]`) LLM 에 등록되는 도구가 없음을 보장한다는 사실이 명시되지 않아, 향후 `normalTools` 에 항목을 추가할 때 의도치 않은 동작이 가능하다는 경계가 불분명하다. 문서화 결함이라기보다는 코드 냄새에 가깝지만, 주석 내에 "현재 빈 배열이라 LLM 에 노출되지 않음 — 추가 시 budget 합산 의미론 spec §3.f-g 검토 필요"를 보완하면 의도가 명확해진다.
- 제안: 해당 주석에 "현재 `normalTools` 는 항상 빈 배열 — LLM 에 등록되지 않음" 문구를 보강한다.

### [INFO] `AI_RETRY_STATE_TTL_MINUTES` 환경변수 — 중앙 env 문서에 미등록
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 라인 608~622 (`resolveRetryStateTtlMinutes`)
- 상세: `AI_RETRY_STATE_TTL_MINUTES` 환경변수가 새로 도입됐다. 코드 상에는 `DEFAULT_RETRY_STATE_TTL_MINUTES = 60` 과 fallback 로직, 그리고 JSDoc 으로 상세히 설명되어 있으나, 프로젝트에 환경변수 목록을 관리하는 별도 문서(`.env.example`, deployment 가이드, spec 설정 문서 등)가 있다면 거기에 추가해야 한다. spec 참조(`spec/4-nodes/3-ai/1-ai-agent.md §7.9`)는 코드에 있으나 해당 spec 문서에 이 환경변수가 기재됐는지 확인이 필요하다.
- 제안: 운영 환경변수 목록 관리 문서(`.env.example` 또는 해당 spec 섹션)에 `AI_RETRY_STATE_TTL_MINUTES` (기본값 60분, 양의 정수, 미설정 시 60 fallback)를 등록한다.

### [INFO] `capFormDataBytes` — `export` 되는 공개 유틸 함수지만 예제 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 라인 709~778
- 상세: `capFormDataBytes` 와 관련 상수(`FORM_SUBMITTED_MAX_BYTES`, `FORM_SUBMITTED_GUIDANCE_MESSAGE`)는 `export` 되어 있어 외부에서 직접 import 가능하다. JSDoc 이 잘 작성되어 있으나, 실제 입력/출력 예제가 없어 `capped` 객체와 `formDataTruncation` 메타의 관계를 처음 보는 기여자가 파악하는 데 시간이 걸린다. 테스트 파일(`ai-turn-executor.spec.ts`)에서 이 함수를 직접 테스트하지 않아 동작 예제가 어디에도 없다.
- 제안: JSDoc 의 `@example` 태그로 "cap 초과 시 truncate 발생" 케이스와 "cap 미만 시 formDataTruncation = undefined" 케이스 최소 2개를 추가한다.

### [INFO] `re-export` 패턴 — 핸들러의 의도 설명이 충분하나 downstream 소비자 탐색 비용 존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 18~24
- 상세: `FORM_SUBMITTED_GUIDANCE_MESSAGE` / `FORM_SUBMITTED_MAX_BYTES` 의 re-export 목적이 인라인 주석("기존 import 경로(`./ai-agent.handler`)를 쓰는 테스트·외부 소비자가 깨지지 않도록 re-export")으로 명확히 서술되어 있다. 문서화 자체는 적절하나, 이 re-export 가 임시(backward-compat shim) 인지 영구 public API 인지 의도를 주석에 명시하면 향후 정리 여부를 결정하는 데 도움이 된다.
- 제안: 주석에 "(backward-compat shim — 향후 소비자가 import 경로를 직접 `./ai-turn-executor` 로 변경하면 제거 가능)" 문구를 추가한다.

## 요약

이번 변경(M-1 3단계 AiTurnExecutor 추출)은 전반적으로 문서화 품질이 높다. 클래스 레벨 JSDoc, constructor 파라미터 주석, 핵심 상수(KB guidance, presentation guidance, retry TTL)의 규격 참조, 내부 인라인 주석이 모두 충실하다. 테스트 파일의 describe 블록 도입부 주석도 추출 배경과 격리 검증 의도를 명확히 설명한다. 발견된 항목은 JSDoc 블록 중복 배치로 인한 IDE 툴팁 오결합(라인 3075~3086), 세 핵심 공개 메서드의 메서드 레벨 JSDoc 부재, 신규 환경변수(`AI_RETRY_STATE_TTL_MINUTES`)의 외부 문서 등록 필요성, export 되는 유틸 함수의 예제 부재 등이며 모두 INFO 수준이다. 기능 동작이나 스펙 준수에는 영향이 없다.

## 위험도

LOW
