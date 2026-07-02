# 요구사항(Requirement) 리뷰 — M-7 스키마 enrich (resume-state.schema.ts / ai-turn-executor.ts)

## 검증 절차 요약

- `resume-state.schema.ts` 전체 및 diff 라인별 대조, `resume-state.schema.spec.ts` 기존 unit 확인.
- `ai-turn-executor.ts` 변경 4개 hunk(모든 caller) 를 실제 파일에서 재확인 — diff 와 100% 일치.
- `spec/5-system/4-execution-engine.md` §1.3(재개 state 필드·allow-list)·§7.5(rehydration graceful-reset) 본문 대조.
- `npx tsc --noEmit -p tsconfig.json` — 대상 두 파일 관련 에러 0건 (워크트리에 pre-existing 미해결 merge-conflict-marker 에러가 cafe24 metadata / http-safety.spec / encrypt-auth-config 등 **무관 파일**에 존재하나, 본 PR 범위 밖 — grep 으로 대상 파일에 conflict marker 없음 확인).
- `npx jest ai-turn-executor.spec.ts ai-agent.handler.spec.ts resume-state.schema.spec.ts` — 25+109 테스트 전부 PASS.
- `npx eslint` 대상 2파일 — 0 error, 기존(diff 미터치 라인) warning 6건만 잔존.
- Node REPL 로 `z.custom<T>()` / `z.array(z.custom<T>())` 런타임 동작 실측 — 주석의 "런타임 미검증" 주장을 실증.

## 발견사항

- **[INFO]** `turnDebugHistory: z.custom<unknown[]>()` / `allPresentations: z.custom<PresentationPayload[]>()` 는 배열 여부조차 검사하지 않는다 (object/`{}` 도 통과) — `messages: z.array(z.custom<ChatMessage>())` 와 달리 배열-레벨 검사가 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:133-134`
  - 상세: 코드 주석(47-48행, 122행)은 "`z.array(z.custom<ChatMessage>())` 는 배열 여부만 검사(기존과 동일 강도)" 라고만 명시하며 `turnDebugHistory`/`allPresentations` 에는 이 "배열 검사" 문구를 적용하지 않는다. 실측 결과 이 두 필드는 이전 `z.unknown()` 과 완전히 동일한 pass-through 강도(배열 검사도 없음)이므로 behavior-preserving 주장과 실제로 일치 — 다만 함수/필드명(`turnDebugHistory`·`allPresentations`)이 배열을 뜻함에도 스키마가 array 제약을 전혀 강제하지 않는다는 점이 코드만 봐서는 다소 오해를 살 수 있다(“enrich” 라는 표현이 검증 강화를 연상시키나 실제로는 타입-레벨 sharpen 뿐).
  - 제안: 실제 동작 변경은 불필요(문서화된 의도와 일치, unit 오라클도 이를 요구하지 않음). 다만 향후 커밋 메시지/주석에서 `turnDebugHistory`/`allPresentations` 도 "배열 검사조차 없음(순수 타입-only)"이라고 한 줄 더 명시하면 다음 리뷰어의 혼동을 줄일 수 있다 (선택 사항, 차단 아님).

- **[INFO]** `processMultiTurnMessage` 상단의 `state.messages as ChatMessage[]` (line 2440) 캐스트가 M-7 enrich 범위에서 제외되어 잔존.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2440`
  - 상세: `resumeState` 지역 변수 선언(2453행)보다 앞서 사용되는 지점이라 이번 클러스터의 "9곳 캐스트 제거" 범위에 포함되지 않았고, 커밋 메시지(875c81782)에도 "잔존: … messages spread(2440, undefined-assert)" 로 명시적으로 disclosure 되어 있다. `resumeState.messages` 로 교체 시 스키마상 optional(`ChatMessage[] | undefined`) 이라 `?? []` 등 폴백이 추가로 필요해 별도 판단이 필요한 caveat이며, 의도적 범위 경계로 판단된다.
  - 제안: 조치 불요 — 후속 클러스터에서 다룰 사항이면 plan 에 남기는 정도로 충분.

## 관점별 점검

1. **기능 완전성** — 커밋 메시지가 명시한 "9곳 domain 캐스트 제거"가 diff 4개 hunk 전부에서 확인됨: `endMultiTurnConversation`(messages/allPresentations/turnDebugHistory 3곳), `handleMultiTurnConditionRoute`(turnDebugHistory/allPresentations 2곳), `processMultiTurnMessage`(ragSources/turnDebugHistory/allPresentations×2 4곳). 실제 코드 검색 결과 이 필드들에 대한 개별 `as` 캐스트는 모두 제거되고 `resumeState` 단일 지역 변수로 narrow 되어 있다. 완전.
2. **엣지 케이스** — `resumeState.turnDebugHistory || []` / `resumeState.allPresentations ?? []` / `resumeState.ragSources ?? []` 형태로 optional 필드에 대한 기본값 처리가 diff 전후 동일하게 유지됨(빈 배열 fallback 유지). `z.custom<T>()` 가 원소를 검증하지 않으므로 malformed 원소가 들어와도 기존과 동일하게 통과 — 회귀 없음.
3. **TODO/FIXME** — 대상 두 파일에 TODO/FIXME/HACK/XXX 없음.
4. **의도-구현 일치** — 주석("런타임 validator 를 추가하지 않는다", "배열 여부만 검사") 을 Node REPL 실측으로 검증한 결과 정확히 일치. 커밋 메시지의 "9곳 제거" 주장도 grep 으로 실제 대응 확인됨.
5. **에러 시나리오** — 본 변경은 타입-레벨 전용이라 런타임 에러 경로에 영향 없음. §7.5 graceful-reset(`RESUME_INCOMPATIBLE_STATE`) 계약이 그대로 유지됨(§9.5 unit 테스트 `resumeStateSchema.safeParse({})` PASS 로 빈 객체 허용 확인).
6. **데이터 유효성** — 스키마는 여전히 `parse`/`safeParse` 를 런타임 경계에서 호출하지 않는 정책(파일 상단 클래스 주석)을 유지 — M-7 변경이 이 정책을 깨지 않음.
7. **비즈니스 로직** — credential-strip allow-list(§1.3)·라이프사이클 구분(ResumeState/ResumeCheckpoint/RetryState) 은 diff 로 변경되지 않음 (필드 목록·구조 동일, 타입만 sharpen). `CREDENTIAL_CONTEXT_FIELDS` 등 관련 오라클 unit 테스트 전부 PASS.
8. **반환값** — 각 caller(`endMultiTurnConversation`/`handleMultiTurnConditionRoute`/`processMultiTurnMessage`) 의 반환 경로는 캐스트 방식만 바뀌었을 뿐 반환 값 자체(각 배열의 spread 결과)는 diff 전후 동일.
9. **spec fidelity** — `spec/5-system/4-execution-engine.md §1.3`(재개 state 필드 목록·`_resumeCheckpoint`/`_retryState` allow-list) 및 `§7.5`(rehydration graceful-reset, `RESUME_INCOMPATIBLE_STATE`) 본문과 스키마 파일의 필드 구성·행위 계약이 line-level 로 일치. 코드 주석이 인용하는 "§7.5 graceful-reset 의 런타임 미검증 계약(#783)" 표현도 §7.5 본문("`_resumeCheckpoint` 손상 시 안전 재구성 불가로 graceful `RESUME_INCOMPATIBLE_STATE`", "누락 필드를 기본값으로 보강해 backward-compatible 재구성")과 부합. spec 본문 자체의 결함이나 spec-drift 는 발견되지 않음(코드가 spec 을 그대로 따르는 순수 리팩터링).

## 요약

`z.custom<T>()` 를 이용한 타입-전용 enrich(런타임 검증 미도입) 로, 소비처(`ai-turn-executor.ts`) 의 `as ChatMessage[]`/`as PresentationPayload[]`/`as unknown[]` 계열 domain 캐스트 9곳을 제거하는 behavior-preserving 리팩터링이다. diff 내용이 커밋 메시지·주석의 주장과 정확히 일치하며, `z.custom<T>()` 의 "모든 값 통과" 특성을 Node REPL 로 실측 검증한 결과도 주석 내용과 일치한다. `spec/5-system/4-execution-engine.md §1.3/§7.5` 의 재개 상태 allow-list·graceful-reset 계약과도 line-level 로 부합하며, 관련 unit 테스트(schema oracle + ai-turn-executor + ai-agent handler, 총 134개)가 모두 PASS, tsc/eslint 도 대상 파일 기준 클린하다. 발견된 두 건은 모두 INFO 수준(스키마 문서화 뉘앙스, 의도적으로 disclosure 된 범위 경계)으로 기능적 결함이나 spec 불일치가 아니다.

## 위험도

NONE
