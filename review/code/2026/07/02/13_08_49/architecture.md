# Architecture Review — M-7 ai-turn-executor 클러스터 (resume-state 타입화)

## 발견사항

- **[INFO]** `endMultiTurnConversation` 경계에서만 `state as ResumeState` 로 좁히고, 동일 클래스의 다른 `state` 소비 메서드는 여전히 `Record<string, unknown>` + 인라인 캐스팅 유지
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2916-2927` (신규 좁힘) vs `buildAiNodeRefFromState:611`, `threadHolderFromState` 인접부, `processMultiTurnMessage:2433`, `applyMultiTurnTurnMemory` 등(`state: Record<string, unknown>` 유지)
  - 상세: 이번 변경은 `endMultiTurnConversation`/`buildMultiTurnFinalOutput`/`buildRetryState` 체인에만 `ResumeState`/`RetryState` 도메인 타입을 적용했다. 같은 파일 안에 `state`를 다루는 다른 private 메서드들은 여전히 `Record<string, unknown>` 파라미터에 `as string`/`as ConversationThread` 등 개별 단언을 쓴다. 공개 핸들러 인터페이스(`processMultiTurnMessage` — information_extractor 와 polymorphic 공유 시그니처) 제약 때문에 진입점 파라미터는 `Record`를 유지해야 하는 것은 합리적이나, 함수 본문 내부에서 지역적으로 `ResumeState`로 좁히는 패턴을 이번에 적용한 지점과 아직 적용 안 된 지점이 파일 내에 공존해 일관성이 떨어진다.
  - 제안: 코멘트에 이미 "M-7 첫 클러스터"라고 명시된 대로 점진적 롤아웃이 의도된 것으로 보인다(커밋 이력상 `RESUME-STATE` 클러스터가 스키마 SoT 도입 → 이번 executor 클러스터로 이어지는 순차 작업). 후속 클러스터에서 `buildAiNodeRefFromState`/`threadHolderFromState`/`processMultiTurnMessage` 본문 등 나머지 `state as X` 단언 지점도 동일 패턴(`const s = state as ResumeState`)으로 정리하면 파일 전체의 타입 경계가 통일된다. 지금 단계에서 차단할 사안은 아님.

- **[INFO]** `ResumeState`/`RetryState`가 여전히 `.partial().catchall(z.unknown())` 오픈 스키마 — 컴파일타임 안전성은 "일부 필드 옵셔널화" 수준
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:81-130`
  - 상세: 설계 의도(zod `parse`/`safeParse` 런타임 검증을 하지 않고 문서화 + 타입 파생 + 단위 테스트 oracle 용도로만 사용)가 파일 최상단 주석에 명확히 기술되어 있고, behavior-preserving 리팩터 목표와 합치한다. `catchall(z.unknown())` 때문에 `ResumeState`는 사실상 `Record<string, unknown>` + 일부 필드 타입 힌트에 가까워 `s.model as string`(2937행), `source.model as string | undefined`(3149행 부근) 같은 잔여 단언이 여전히 필요하다 — 이는 결함이 아니라 명시된 trade-off다.
  - 제안: 없음(설계 의도 문서화가 충분). 다만 향후 유사 클러스터에서 "타입 안전성 확보"라는 표현을 쓸 때는 이 스키마가 런타임 비검증·`catchall` open 이라는 한계를 리뷰/PR 설명에도 함께 언급하면 오해를 줄일 수 있다.

- **[INFO]** `isRecord`/`toRecord` JSDoc 갱신 + 문서화 테스트 추가는 순수 스펙 고정(behavior 불변)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.ts:143-155`, `to-record.spec.ts:36-47`
  - 상세: `isRecord`가 plain-object 가드가 아니라 "property 접근 가능한 non-array object" 판별이라는 캐비엇을 JSDoc과 테스트로 명시적으로 고정했다. 단일 책임(런타임 형태 판별 유틸)에 충실하고, 호출부가 오용(plain-object 전용 가정)하지 않도록 계약을 명확히 문서화한 점은 추상화 경계 관리 관점에서 바람직하다. `handler-output.adapter.ts`/`execution-engine.service.ts` 두 소비처 외 이번 diff 범위에서 새 소비처는 없다.
  - 제안: 없음.

- **[INFO]** 모듈 경계 — `nodes/ai/ai-agent` → `modules/execution-engine/utils/resume-state.schema` type-only import, 순환 없음
  - 위치: `ai-turn-executor.ts:24-27` (`import type { ResumeState, RetryState } from '../../../modules/execution-engine/utils/resume-state.schema'`)
  - 상세: `nodes/` 가 `modules/execution-engine/` 를 참조하는 기존 방향(파일 내 다른 import — `conversation-thread.service`, `execution-event-emitter.service` 등도 동일 방향, 일부는 인라인 `import()` 타입으로 순환 회피 패턴 사용)과 일치한다. 이번 추가는 `import type` 이라 런타임 순환 위험이 없고, 리버스 방향(`modules/execution-engine` → `nodes/ai-agent`) import 는 확인되지 않았다. 기존에 순환 회피를 위해 인라인 `import()` 타입을 쓰던 다른 필드(`eventEmitter?: import('.../execution-event-emitter.service').ExecutionEventEmitter`)와 달리 이번 신규 타입은 파일 상단 정적 `import type`으로 추가됐는데, `resume-state.schema.ts`가 `modules/execution-engine` 자체를 역참조하지 않는 leaf 유틸이라 순환 위험이 없어 정적 import가 적절하다.
  - 제안: 없음.

## 요약

diff 범위는 이전 M-7 클러스터(#782 `toRecord` 인프라, #783 `resume-state.schema` SoT 도입)의 연장으로, `ai-turn-executor.ts`의 `endMultiTurnConversation`/`buildMultiTurnFinalOutput`/`buildRetryState` 체인에서 `Record<string, unknown>` 단언을 zod 파생 `ResumeState`/`RetryState` 도메인 타입으로 국소 치환하고, `isRecord`에 plain-object 가드가 아니라는 캐비엇을 문서화 테스트로 고정한 것이다. 스키마는 의도적으로 런타임 비검증·`catchall` open 상태를 유지해(behavior-preserving 원칙 준수) 기존 malformed-tolerant 동작을 보존하며, 모듈 경계·의존 방향(`nodes → modules`, type-only)도 기존 패턴과 일치해 순환 위험이 없다. 유일한 아쉬운 점은 같은 파일 안에서 새 타입 좁힘이 일부 메서드에만 적용되고 나머지는 예전 인라인 캐스팅 패턴을 유지해 과도기적 비일관성이 존재한다는 것인데, 이는 클러스터 단위 점진적 롤아웃이라는 프로젝트 관행(M-7 순차 클러스터)에 부합하는 것으로 판단되며 차단 사유가 아니다.

## 위험도
NONE
