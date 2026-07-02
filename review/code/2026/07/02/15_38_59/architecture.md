### 발견사항

- **[INFO]** `z.custom<T>()` 를 "타입 전용 SoT" 로 활용하는 추상화 선택이 명확하고 일관됨
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:41-48`, `:64-65`, `:117-121`
  - 상세: `messages: z.array(z.custom<ChatMessage>())`, `turnDebugHistory: z.custom<unknown[]>()`, `allPresentations: z.custom<PresentationPayload[]>()` 는 zod의 런타임 validator 계층을 우회하고 `z.infer` 타입만 sharpen한다. 파일 상단 모듈 JSDoc(L4-28)이 "왜 실제 parse/validate 를 하지 않는가"(§7.5 graceful-reset의 malformed-tolerant 계약, #783)를 명시적으로 설명하고 있어, 스키마가 "실행되는 검증 로직"이 아니라 "타입 문서화 도구"라는 의도된 역할이 코드와 주석 양쪽에서 일관되게 유지된다. 이는 과도한 추상화(런타임 검증을 억지로 끼워 넣는 것)를 피하면서도 타입 안전성을 확보한 합리적 절충이다.
  - 제안: 없음(양호).

- **[INFO]** 스키마 레이어가 도메인 인터페이스 타입(`ChatMessage`, `PresentationPayload`)을 import — 방향은 순방향, 순환 없음
  - 위치: `resume-state.schema.ts:2-3` (`import type { ChatMessage } from '../../llm/interfaces/llm-client.interface'`, `import type { PresentationPayload } from '../../../shared/conversation-thread/conversation-thread.types'`)
  - 상세: `type`-only import이므로 런타임 의존성/번들 결합은 없다. `execution-engine/utils` → `llm` 모듈, `shared/conversation-thread` 모듈로의 참조 방향인데, 두 모듈 모두 `execution-engine`을 역참조하지 않아 순환 의존은 발생하지 않는다. 기존에 `ai-turn-executor.ts`가 이미 동일 타입을 직접 import해 캐스트에 사용하던 것을, 스키마 레이어로 "선언적으로 승격"한 것에 가까워 신규 결합이 아니다.
  - 제안: 없음. 다만 이 스키마 파일이 향후 여러 모듈의 도메인 타입을 계속 흡수하며 "타입 집합소"가 되어가는 경향은 필드 추가 시마다 재점검할 가치가 있음(현재는 문제 아님).

- **[INFO]** `state as ResumeState` 캐스트 패턴이 `AiTurnExecutor` 클래스 내 3개 메서드(약 L2112, L2455, L2933)에서 동일하게 반복
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (조건-라우트 헬퍼 / continue 루프 / `buildMultiTurnFinalOutput` 진입부 각각의 로컬 스코프)
  - 상세: 공개 핸들러 시그니처(`information_extractor`와 공유하는 `Record<string, unknown>` 파라미터)를 넓게 유지하면서, 메서드 내부에서만 개별적으로 `ResumeState`로 narrowing 하는 의도된 boundary 패턴이다(주석에 명시). 로직 중복이라기보다 "공개 계약은 넓게, 내부 구현은 좁게"라는 일관된 원칙의 반복 적용이라 결합도/응집도 문제는 아니다.
  - 제안: 4번째 지점이 생길 경우 `private narrowResumeState(state): ResumeState` 헬퍼로 캐스트 근거 주석을 단일화하는 것을 고려할 수 있으나, 현재 3곳 규모에서는 강제할 정도의 이슈가 아니며 선택 사항이다.

- **[INFO]** 동일 필드(`messages`)에 대해 파일 내 신/구 캐스트 스타일 공존 (diff 범위 밖, 의도적 점진 리팩터)
  - 위치: `ai-turn-executor.ts:2440` 부근(`state.messages as ChatMessage[]`, 이번 diff 미포함) vs `resumeState.messages ?? []`(L2934, 이번 diff로 정리됨)
  - 상세: L2440은 이번 클러스터 범위 밖이라 여전히 레거시 캐스트를 사용해 일시적으로 스타일이 혼재한다. 기능 결함은 아니며, plan(`03-maintainability.md`)이 "후속 클러스터"로 명시적으로 잔여 작업을 추적하고 있어 계획된 점진적 리팩터의 중간 상태로 판단된다.
  - 제안: 후속 M-7 클러스터에서 통일 대상에 포함(이미 plan에 반영됨, 이번 PR 블로킹 사유 아님).

### 요약
이번 변경은 `resume-state.schema.ts`의 `z.unknown()`/`z.array(z.unknown())` 일부 필드를 `z.custom<T>()`로 enrich하여 런타임 검증 강도를 바꾸지 않으면서(§7.5 graceful-reset 계약 불변) `z.infer` 타입만 도메인 타입으로 sharpen하고, 그 결과로 `ai-turn-executor.ts`의 여러 지점에서 `as ChatMessage[]`/`as PresentationPayload[]` 류 도메인 캐스트를 제거한 좁고 명확한 범위의 타입 레벨 리팩터다. 스키마 레이어의 역할("실행되지 않는 타입 전용 SoT")이 코드·주석·plan 문서 전반에서 일관되게 유지되며, 레이어 경계(스키마→도메인 인터페이스 type-only import), 순환 의존 부재, 기존 boundary 패턴(공개 파라미터는 넓게·내부 로직은 좁게)과의 정합성 모두 문제가 없다. 발견된 사항은 전부 INFO 수준의 경미한 반복(narrowing 캐스트 3곳, 레거시 캐스트와의 일시적 스타일 혼재)이며, 아키텍처적 결함이나 리스크는 발견되지 않았다.

### 위험도
NONE
