### 발견사항

- **[INFO]** 스키마를 "형태 문서화용 SoT" 로 두고 `z.custom<T>()` 로 타입만 sharpen 하는 접근은 적절한 추상화 수준 선택
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:41-153` (`credentialStripSubsetShape.messages`, `resumeStateSchema.turnDebugHistory`/`allPresentations`)
  - 상세: `z.custom<T>()` 는 런타임 validator 를 추가하지 않고 `z.infer` 타입만 도메인 타입으로 좁힌다. 파일 상단 주석(L84-91)이 "왜 zod 로 실제 파싱/검증하지 않는가"(§7.5 graceful-reset 의 malformed-tolerant 계약)를 명확히 설명하고 있어, 향후 리뷰어가 "왜 검증 안 하나" 로 재의심할 여지를 남기지 않는다. 스키마가 실행 시 `parse`/`safeParse` 되지 않는 "타입 전용 SoT" 라는 계약이 앞뒤로 일관되게 지켜진다.
  - 제안: 없음 (양호).

- **[INFO]** 동일한 `const resumeState = state as ResumeState;` 캐스트가 클래스 내 3개 메서드에 반복 등장 (경미한 중복, 응집도 이슈 아님)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2112`, `:2455`, `:2933` (`AiTurnExecutor` 세 개의 다른 메서드 각각의 로컬 스코프)
  - 상세: `state: Record<string, unknown>` 파라미터를 받는 메서드 시그니처를 유지하면서, 각 메서드 본문 초입에서 개별적으로 `ResumeState` 로 narrowing 한다. 세 곳 모두 동일한 패턴(`state as ResumeState`)이라 로직 중복이라기보단 "공개 파라미터 타입은 넓게, 메서드 내부에서만 도메인 타입으로 좁힌다" 는 의도된 boundary 관례(파일 3의 주석에 명시)로 보인다. `NodeHandlerOutput`/`processMultiTurnMessage` 공유 계약이 `Record<string, unknown>` 을 요구하는 제약 하에서는 합리적인 절충.
  - 제안: 필요 시 `private narrowResumeState(state: Record<string, unknown>): ResumeState { return state as ResumeState; }` 같은 1줄 헬퍼로 추출해 캐스트 지점을 단일화할 수 있으나, 가독성/이득 대비 강제할 만큼의 문제는 아니다. 선택 사항.

- **[INFO]** 레이어 책임 분리 유지 — 스키마(schema) 레이어가 도메인 타입(`ChatMessage`, `PresentationPayload`) 을 import 하지만 방향은 여전히 하위 유틸리티 → 도메인 인터페이스로 순방향
  - 위치: `resume-state.schema.ts:2-3` (`import type { ChatMessage } from '../../llm/interfaces/llm-client.interface'`, `import type { PresentationPayload } from '../../../shared/conversation-thread/conversation-thread.types'`)
  - 상세: `type`-only import 이므로 런타임 의존성/번들 결합은 발생하지 않는다. `execution-engine/utils` 가 `llm` 모듈과 `shared/conversation-thread` 모듈의 인터페이스 타입을 참조하는 구조인데, 두 대상 모두 이미 `ai-turn-executor.ts` 가 직접 import 하던 것과 동일한 타입이라 신규 결합이 아니라 기존 결합을 스키마 레이어로 "선언적으로 승격"한 것에 가깝다. 순환 의존 가능성을 확인했으나 `llm-client.interface`/`conversation-thread.types` 양쪽 다 `execution-engine`을 역참조하지 않아 순환은 없다.
  - 제안: 없음. 다만 이 스키마 파일이 향후 더 많은 도메인 타입을 흡수하며 "여러 모듈의 타입 집합소"가 되지 않도록, 순수 형태 문서화 목적을 벗어나는 필드 추가 시엔 별도 판단 필요.

- **[INFO]** `ai-turn-executor.ts` 내 캐스트 제거가 일관되게 적용되지 않은 지점 존재 (behavior-preserving 범위 밖이라 의도적으로 보임)
  - 위치: `ai-turn-executor.ts:2440` (`const messages = [...(state.messages as ChatMessage[])];`) vs 같은 파일의 새로 정리된 `resumeState.messages ?? []` 패턴(L2934)
  - 상세: L2440 은 이번 diff 범위 밖(수정되지 않음)이라 여전히 구식 `as ChatMessage[]` 캐스트를 사용한다. 동일 필드(`messages`)에 대해 한 파일 안에 "레거시 캐스트"와 "M-7 이후 스키마 기반 캐스트 제거"가 공존하게 되어 일관성이 다소 떨어진다. 기능적 문제는 아니며 M-7 클러스터가 점진적으로 파일 전체를 정리하는 중이라는 커밋 메시지("첫 클러스터")와도 부합한다.
  - 제안: 후속 M-7 클러스터에서 L2440 도 `resumeState.messages ?? []` 패턴으로 통일 대상에 포함시킬 것을 권장 (이번 PR 블로킹 사유 아님).

### 요약
이번 변경은 `resume-state.schema.ts` 를 "런타임 미검증·타입 전용 SoT" 로 유지하면서 `z.custom<T>()` 를 활용해 `messages`/`turnDebugHistory`/`allPresentations` 세 필드의 `z.infer` 타입만 도메인 타입으로 sharpen 하고, 그 결과 `ai-turn-executor.ts` 여러 지점의 `as ChatMessage[]`/`as PresentationPayload[]` 캐스트를 제거했다. 스키마가 실제 검증 강도를 바꾸지 않는다는 계약(§7.5 graceful-reset, #783)을 주석으로 명확히 재확인하고 있어 "행위 보존(behavior-preserving)" 원칙이 코드와 문서 양쪽에서 일관되게 지켜진다. 레이어 경계(스키마→도메인 인터페이스 type-only import), 순환 의존 부재, 기존 아키텍처 패턴(무상태 collaborator, 단방향 위임)과의 정합성도 문제없다. 발견된 사항은 모두 정보성(INFO) 수준으로, 동일 캐스트 패턴의 경미한 반복과 정리 범위가 파일 전체로 아직 확산되지 않은 점 정도이며 아키텍처적 결함이나 리스크는 없다.

### 위험도
NONE
