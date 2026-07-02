### 발견사항

- **[INFO]** `z.custom<T>()` 전환은 런타임 부작용을 추가하지 않는 순수 타입 단계 변경
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:48,64-65`
  - 상세: `z.unknown()`/`z.array(z.unknown())` → `z.custom<T>()`/`z.array(z.custom<T>())` 전환은 zod v4 기준 predicate 미제공 시 identity validator(`() => true`)로 동작해 모든 값을 통과시킨다. 즉 `messages`(배열 여부만 검사, 원소 미검증)·`allPresentations`·`turnDebugHistory` 세 필드 모두 이전과 동일한 런타임 검증 강도를 유지하며, `z.infer` 타입만 sharpen 된다. 실제 코드베이스에서 이 스키마에 대한 `.parse`/`.safeParse` 호출이 0건(RESOLUTION.md 의 rationale_continuity 검증 결과)이므로, 설령 predicate 가 있었더라도 현재는 어차피 실행되지 않는다. 부작용 관점에서 이 diff 는 상태 변경·I/O·전역 변수와 완전히 무관하다.
  - 제안: 없음.

- **[INFO]** `state as ResumeState` narrowing 은 `state` 원본을 재할당하지 않는 지역 단언 — 호출자 영향 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2112`, `:2455`, `:2933` (`handleMultiTurnConditionRoute`/`processMultiTurnMessage`/`endMultiTurnConversation` 내부)
  - 상세: 세 지점 모두 `const resumeState = state as ResumeState;` 형태로 새 지역 바인딩만 생성한다. `state`(원본 파라미터)는 이후에도 그대로 참조 가능하며(`state.workspaceId`, `state.conditions` 등 이 diff 이후에도 남아 있음, `:2445-2448` 확인), mutate 되지 않는다. `as` 캐스트는 컴파일 타임 전용이라 런타임 동작·객체 identity·부작용에 아무 영향이 없다.
  - 제안: 없음.

- **[INFO]** 공개 메서드 시그니처(`endMultiTurnConversation`, `buildRetryState` 등) 파라미터 타입 불변 — 호출자 영향 없음
  - 위치: `ai-turn-executor.ts:2921-2926` (`endMultiTurnConversation(state: Record<string, unknown>, ...)`)
  - 상세: diff 는 메서드 시그니처를 전혀 바꾸지 않는다. `state` 파라미터는 여전히 `Record<string, unknown>` 이며, information_extractor 와 공유하는 공개 핸들러 인터페이스 계약이 그대로 유지된다. 메서드 반환값 shape(`buildMultiTurnFinalOutput` 의 `messages`/`allPresentations`/`turnDebugHistory` 전달 경로)도 동일 — spec §7.4/§7.9 형태 불변은 requirement 리뷰 영역이나, 부작용 관점에서도 호출자가 관찰 가능한 인터페이스 변경은 없다.
  - 제안: 없음.

- **[INFO]** `turnDebugHistory`/`allPresentations` 누적 로직(prepend+append) 자체는 diff 이전과 동일한 semantics 유지
  - 위치: `ai-turn-executor.ts:180`(`prevHistory = resumeState.turnDebugHistory || []`), `:190`(`allPresentations: [...(resumeState.allPresentations ?? []), ...presentationPayloads]`)
  - 상세: 캐스트 표현만 `(state.X as unknown[]) || []` → `resumeState.X || []` 로 바뀌었을 뿐, `||`/`??` fallback 우선순위와 배열 스프레드 순서는 그대로다. 신규 테스트(`ai-turn-executor.spec.ts` M-7 회귀 가드 2건)가 이 불변성을 실측 검증한다. 부작용 관점에서 "타입 표현만 바뀌고 데이터 흐름은 그대로"라는 behavior-preserving 주장이 코드·테스트 양쪽에서 뒷받침된다.
  - 제안: 없음.

- **[INFO]** 리뷰 산출물(`review/code/**`) 신규 파일 다수는 워크플로 산출물로 명시적 쓰기 대상 — 의도된 파일시스템 부작용
  - 위치: `review/code/2026/07/02/15_09_45/*.md`, `_retry_state.json`
  - 상세: 이번 diff 에 포함된 `SUMMARY.md`/`RESOLUTION.md`/각 카테고리별 리뷰 결과(`architecture.md`/`documentation.md`/`maintainability.md` 등)와 `_retry_state.json` 은 `/ai-review` 워크플로가 규약대로 `review/code/<날짜>/<시각>/` 에 기록하는 산출물이다. CLAUDE.md 의 "코드 리뷰 산출물" 저장 위치 규칙과 일치하며, 코드 변경과 무관한 예기치 못한 파일 생성이 아니다.
  - 제안: 없음.

- **[INFO]** type-only import 추가는 런타임 의존성·번들 부작용 없음
  - 위치: `resume-state.schema.ts:2-3` (`import type { ChatMessage } ...`, `import type { PresentationPayload } ...`)
  - 상세: 둘 다 `import type` 이므로 컴파일 후 런타임 코드에 어떤 흔적도 남기지 않는다(tree-shaking 대상도 아니고애초에 emit 되지 않음). 순환 의존·초기화 순서·모듈 사이드이펙트(top-level 실행 코드) 위험 없음.
  - 제안: 없음.

### 요약
이번 변경은 `z.unknown()`→`z.custom<T>()` 스키마 enrich 와 그에 따른 `ai-turn-executor.ts` 9곳의 `as ChatMessage[]`/`as PresentationPayload[]`/`as unknown[]` 캐스트를 지역 `const resumeState = state as ResumeState` narrowing 으로 대체한 순수 컴파일 타임 리팩터링이다. 런타임 validator 는 추가되지 않았고(zod v4 identity predicate, `.parse` 호출 0건 확인), `state` 원본은 재할당되지 않으며, 공개 메서드 시그니처·반환 shape·turnDebugHistory/allPresentations 누적 semantics 모두 diff 전후 동일하다. 전역 변수·환경 변수·네트워크 호출·이벤트/콜백과 무관하고, 신규 생성된 `review/code/**` 파일들은 워크플로 규약에 따른 의도된 산출물이다. 부작용 관점에서 위험 요소를 발견하지 못했다.

### 위험도
NONE
