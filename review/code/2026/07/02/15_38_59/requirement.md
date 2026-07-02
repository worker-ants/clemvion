# 요구사항(Requirement) 리뷰 — M-7 스키마 enrich 클러스터 (재확인, 2026-07-02 15:38:59)

## 검증 절차

- `resume-state.schema.ts` 전체 재확인 — diff 와 실제 파일 내용 100% 일치 (`messages: z.array(z.custom<ChatMessage>())`, `turnDebugHistory: z.custom<unknown[]>()`, `allPresentations: z.custom<PresentationPayload[]>()`).
- `ai-turn-executor.ts` 의 `resumeState` 도입 3곳(`handleMultiTurnConditionRoute` L2112, `processMultiTurnMessage` L2455, `endMultiTurnConversation` L2933) 과 그 하위 캐스트 제거 지점을 grep/Read 로 실측 — diff hunk 와 정확히 일치.
- `spec/4-nodes/3-ai/1-ai-agent.md` §7.4(`_resumeState` shape·필드 표)·§7.9(`_retryState`)·§7.10(`allPresentations`/`presentations[]` echo 정책) 및 `spec/5-system/4-execution-engine.md` §7.5(rehydration graceful-reset)·§1.3(NodeHandlerOutput status) 본문 대조.
- `npx jest ai-turn-executor.spec.ts` 재실행 — **25/25 PASS** (RESOLUTION.md 의 W-1/W-2 fix 커밋 반영 확인).
- `plan/in-progress/refactor/03-maintainability.md` M-7 "스키마 enrich 클러스터" 항목과 실제 diff·검증 결과 대조.

## 발견사항

- **[INFO]** 이전 리뷰 세션(`review/code/2026/07/02/15_09_45/requirement.md`)이 spec 근거로 `spec/5-system/4-execution-engine.md §1.3/§7.5` 를 인용했으나, `_resumeState`/`allPresentations`/`turnDebugHistory` 필드 단위 계약의 실제 SoT 는 `spec/4-nodes/3-ai/1-ai-agent.md §7.4`(필드 표)·`§7.10`(`allPresentations` echo 정책)이다.
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md:704-719`(`_resumeState`/`_resumeCheckpoint`/`_retryState` 필드표·생명주기), `:1005-1010`(`allPresentations` → `presentations[]` echo 정책)
  - 상세: `4-execution-engine.md §1.3/§7.5` 는 재개 컨트랙트의 엔진 레벨(NodeHandlerOutput status·rehydration graceful-reset)을 규정하고, `1-ai-agent.md §7.4/§7.9/§7.10` 이 `_resumeState`/`_retryState` 의 실제 필드 목록·타입·behavior 를 규정한다. 두 문서 다 이번 diff 와 모순되지 않으므로 실질적 리스크는 없으나, 인용 spec 경로가 정확한 SoT 를 가리키도록 교정하는 편이 향후 감사(audit) 추적에 유리하다.
  - 제안: 코드 자체 수정 불필요. 후속 plan/PR 설명에서 spec 인용 시 `1-ai-agent.md §7.4/§7.9/§7.10` 을 1차 근거로, `4-execution-engine.md §1.3/§7.5` 를 엔진-레벨 보조 근거로 구분해 명시하면 좋음 (차단 아님).

- **[INFO]** `turnDebugHistory: z.custom<unknown[]>()` / `allPresentations: z.custom<PresentationPayload[]>()` 는 배열 여부조차 검사하지 않는 반면 `messages: z.array(z.custom<ChatMessage>())` 는 배열 검사(원소는 미검증)를 유지 — 세 필드 간 "검사 강도"가 표현 스타일에 따라 미묘하게 다름
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:49, 133-134`
  - 상세: `z.custom<T>()` 을 predicate 없이 단독 호출하면 identity validator(`() => true`)라 object/`{}` 도 통과한다. 반면 `z.array(z.custom<T>())` 는 최소한 "배열이어야 한다"는 zod 자체 array parser 제약이 남는다. 주석(L44-48)은 "`z.array(z.custom<ChatMessage>())` 는 배열 여부만 검사"라고 명시하지만, `turnDebugHistory`/`allPresentations` 에는 동일한 "배열 검사 없음" 고지가 명시적으로 붙어 있지 않아 필드명("History"/"Presentations", 복수형)이 암시하는 배열 semantics 와 실제 스키마 관대함 사이에 미세한 괴리가 있다. 다만 이는 `z.unknown()` 이었던 기존 상태와 완전히 동일한 강도이므로 회귀는 아니며, 실제 소비 코드는 모두 `?? []` / `|| []` fallback 을 갖춰 non-array 값이 들어와도 방어된다.
  - 제안: 조치 불필요(behavior-preserving 목표와 정확히 부합). 필요 시 주석에 "turnDebugHistory/allPresentations 는 배열 검사조차 없음(순수 타입-only)"을 한 줄 추가하면 다음 리뷰어 혼동 예방(선택).

- **[INFO]** `ai-turn-executor.ts:2440` 부근 `state.messages as ChatMessage[]` 잔존 캐스트는 본 클러스터의 "9곳 제거" 범위에 의도적으로 미포함
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`processMultiTurnMessage` 상단, `resumeState` 지역 변수 선언 이전 사용 지점)
  - 상세: plan(`03-maintainability.md` M-7 "후속 클러스터")과 커밋 메시지 양쪽에 "2440 messages spread(undefined-assert)" 로 명시적으로 disclosure 되어 있다. 스키마상 `messages` 가 optional(`ChatMessage[] | undefined`) 이라 단순 치환 시 `?? []` 폴백 추가가 필요해 별도 판단이 요구되는 caveat 이며, 기능 결함이 아니라 범위 경계.
  - 제안: 조치 불요 — 이미 plan 에 후속 항목으로 기록됨.

## 관점별 점검

1. **기능 완전성** — 커밋 메시지가 주장하는 "3필드 enrich(`messages`/`turnDebugHistory`/`allPresentations`) + 소비처 9곳 domain 캐스트 제거"가 `resume-state.schema.ts`·`ai-turn-executor.ts` 실제 파일에서 100% 확인됨. `endMultiTurnConversation`(3곳)·`handleMultiTurnConditionRoute`(2곳)·`processMultiTurnMessage`(4곳: ragSources·turnDebugHistory·allPresentations×2) 전부 `resumeState.X` 참조로 정리되어 있고 개별 `as` 캐스트가 남아있지 않다.
2. **엣지 케이스** — `resumeState.turnDebugHistory || []`, `resumeState.allPresentations ?? []`, `resumeState.ragSources ?? []` 등 optional 필드의 기본값 fallback 이 diff 전후 정확히 동일 연산자(`||` vs `??`)로 보존됨. 빈 배열/undefined 케이스 모두 기존과 동일하게 처리. `z.custom<T>()` 가 원소를 검증하지 않으므로 malformed 원소 유입 시에도 기존과 동일하게 통과(회귀 아님, 의도된 behavior-preserving).
3. **TODO/FIXME/HACK/XXX** — 대상 두 소스 파일에 없음.
4. **의도-구현 일치** — "런타임 validator 를 추가하지 않는다"(주석) 는 실제 zod v4 `z.custom()` identity predicate 동작과 일치(파일 44-48행 주석이 정확). "state 는 재할당되지 않음" 전제도 3개 메서드 전부에서 실제로 `state` 재할당이 없음을 확인.
5. **에러 시나리오** — 본 변경은 타입-레벨 전용이라 런타임 에러 경로(§7.5 graceful-reset, `RESUME_INCOMPATIBLE_STATE`)에 영향 없음. 관련 unit 테스트(`resume-state.schema.spec.ts`) 별도 변경 없이 그대로 PASS.
6. **데이터 유효성** — 스키마가 여전히 `.parse()`/`.safeParse()` 를 프로덕션 실행 경로에서 호출하지 않는다는 정책(파일 상단 JSDoc)을 grep(`.parse(`/`.safeParse(` 호출처 확인)으로 재검증 — 실 rehydration 경로에 호출 0건.
7. **비즈니스 로직** — credential-strip allow-list(`credentialStripSubsetShape`)·3종 상태(`ResumeState`/`ResumeCheckpoint`/`RetryState`) 라이프사이클 구분은 diff 로 변경되지 않음(필드 구성 동일, 타입만 sharpen). `CREDENTIAL_CONTEXT_FIELDS` 도 불변.
8. **반환값** — `endMultiTurnConversation`/`handleMultiTurnConditionRoute`/`processMultiTurnMessage` 세 caller 모두 반환 경로의 실제 값(스프레드 결과)이 diff 전후 동일함을 신규 회귀 테스트(`ai-turn-executor.spec.ts`) 로 직접 확인 — `output.result.messages`(2건)·`output.result.presentations`(non-default)·`meta.turnDebug`(non-default) 전달, 재개 시 `turnDebugHistory` 누적(2건)·`allPresentations` 보존을 모두 단언하는 non-default 값 경로 테스트가 신설되어 이전 세션의 W-1/W-2(`?? []` fallback 경로만 커버되던 공백)가 해소됨.
9. **spec fidelity** — `spec/4-nodes/3-ai/1-ai-agent.md §7.4`(`_resumeState` 필드표, `turnDebugHistory`/`allPresentations` 정의)·`§7.9`(`_retryState`)·`§7.10`(`allPresentations`→`output.result.presentations[]` echo 정책, `metadata.allPresentations` 가 1차 accumulator) 본문과 코드가 line-level 로 부합. `spec/5-system/4-execution-engine.md §1.3/§7.5`(rehydration graceful-reset) 계약도 스키마 파일 상단 주석과 재확인 결과 불변. 코드 인라인 주석이 인용하는 spec 위치가 실제 필드-레벨 SoT(`1-ai-agent.md`)보다는 엔진-레벨 문서(`4-execution-engine.md`)를 더 자주 참조하는 점은 사소한 인용 정확도 이슈(INFO, 위 발견사항 참조)이며 spec 본문과 구현 간 실질적 불일치는 없음. SPEC-DRIFT 없음 — 코드가 spec 을 그대로 따르는 순수 리팩터.

## 회귀 테스트 검증

`npx jest ai-turn-executor.spec.ts` 재실행 결과 **25/25 PASS** — RESOLUTION.md(`review/code/2026/07/02/15_09_45/RESOLUTION.md`) 가 기록한 W-1(`endMultiTurnConversation` non-default 값 전달 회귀 가드)·W-2(`processMultiTurnMessage` 재개 누적 회귀 가드) fix 가 실제로 적용되어 있고 테스트가 통과함을 직접 확인했다. 두 신규 테스트 모두 이번 diff 로 캐스트가 제거된 정확한 필드(`messages`/`turnDebugHistory`/`allPresentations`)를 non-default 값으로 세팅해 실제 값 경로(fallback 이 아닌)를 검증하므로 요구사항 관점에서 커버리지 공백이 해소되었다.

## 요약

`z.custom<T>()` 를 이용한 타입-전용 enrich(런타임 검증 미도입)로 `ai-turn-executor.ts` 의 domain 캐스트 9곳을 제거하는 behavior-preserving 리팩터링이며, 실제 파일 내용이 diff·커밋 메시지·plan 서술과 정확히 일치한다. `z.custom<T>()` 의 "모든 값 통과"(predicate 없으면 identity validator) 특성이 §7.5 graceful-reset "런타임 미검증" 계약과 배치되지 않음을 코드·스키마 양쪽에서 확인했고, 관련 필드 단위 spec SoT(`spec/4-nodes/3-ai/1-ai-agent.md §7.4/§7.9/§7.10`)와도 line-level 로 부합한다. 이전 세션에서 지적된 회귀 가드 공백(W-1/W-2)은 신규 non-default 값 경로 테스트로 해소되었고 재실행 결과 25/25 PASS 를 직접 확인했다. TODO/FIXME 없음, 반환값 누락 없음, 에러 시나리오 영향 없음. 유일한 지적 사항은 인라인 주석의 spec 인용 경로가 필드-레벨 SoT(`1-ai-agent.md`)보다 엔진-레벨 문서(`4-execution-engine.md`)를 더 자주 가리킨다는 사소한 인용 정확도 이슈뿐이며, 이는 기능적 결함도 SPEC-DRIFT 도 아닌 INFO 수준 참고사항이다.

## 위험도

NONE
