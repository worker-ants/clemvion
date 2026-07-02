# Rationale 연속성 검토 결과

대상: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 및
`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (M-7 스키마 enrich,
diff-base `origin/main`) — target spec: `spec/5-system/4-execution-engine.md`

## 특별 검증 항목: PR #783 "런타임 미검증" 결정과의 충돌 여부

PR #783(`573f52a64`, "M-7 RESUME-STATE 클러스터 — §7.4 재개상태 zod 스키마 SoT + 단언 전환")의
커밋 메시지는 다음을 명시적으로 결정했다:

> behavior-preserving (assertion-only) — §7.5 graceful-reset 의 malformed/partial 허용
> semantics 를 바꾸지 않도록 런타임 경계에서 parse 하지 않는다.

`spec/5-system/4-execution-engine.md §7.5` "Rehydration 실패 케이스" 표는 `_resumeCheckpoint`
가 "손상(schema drift 로 `buildRetryReentryState` 재구성 실패)" 인 경우에만
`RESUME_INCOMPATIBLE_STATE` 로 graceful reset 하도록 규정하며, 그 외에는 "부분 checkpoint 를
받아 기본값으로 복원"하는 permissive 계약을 전제한다. 이 계약은 스키마가 파싱을 통해
값을 거부/coerce 하지 않는다는 전제 위에 서 있다.

검증 결과, target diff 는 이 전제를 위반하지 않는다.

1. **`z.custom<T>()` 는 predicate 없이 호출되면 항상 `true` 를 반환** — zod v4 소스
   (`node_modules/zod/v4/classic/schemas.js:1339-1341`) 확인:
   ```js
   export function custom(fn, _params) {
       return core._custom(ZodCustom, fn ?? (() => true), _params);
   }
   ```
   diff 의 `z.custom<ChatMessage>()`, `z.custom<unknown[]>()`, `z.custom<PresentationPayload[]>()`
   는 모두 predicate 인자를 넘기지 않으므로 identity validator (`() => true`) 로 귀결 — 런타임에
   어떤 값도 거부하지 않는다. `z.array(z.custom<ChatMessage>())` 는 배열 여부만 검사(기존
   `z.array(z.unknown())` 와 동일 강도)하고 원소는 검증하지 않는다는 diff 주석의 주장과 일치.

2. **스키마 자체가 rehydration/retry 실제 코드 경로에서 `.parse`/`.safeParse` 로 소비되지
   않는다** — `resumeStateSchema`/`resumeCheckpointSchema`/`retryStateSchema` 를 참조하는
   파일은 `execution-engine.service.spec.ts`, `resume-state.schema.spec.ts`
   (모두 `.spec.ts`, unit test) 뿐이다. 실제 rehydration 경로
   (`retry-turn.service.ts`, `ai-turn-orchestrator.service.ts`, `execution-engine.service.ts`)
   에는 이 스키마들에 대한 `.parse`/`.safeParse` 호출이 전혀 없다 (grep 확인). 즉 이번 enrich
   이후에도 §7.5 graceful-reset 경로에서 스키마 검증이 개입할 여지 자체가 없다.

3. **`resume-state.schema.ts` 파일 헤더 doc comment (라인 11-18)** 가 이 계약을 재확인:
   > 본 스키마는 런타임 경계에서 `parse`/`safeParse` 하지 **않는다**: §7.5 rehydration 은
   > 부재/부분/미래-버전 checkpoint 에 대해 spec 이 규정한 graceful-reset 또는 기본값 보강으로
   > 대응하는데, 여기에 zod 검증을 끼우면 ... 행위가 달라진다.

4. **`ai-turn-executor.ts` 의 `const resumeState = state as ResumeState` 는 TS 컴파일타임
   단언**이며 런타임 영향이 없다. 기존에도 `const s = state as ResumeState` 형태로 동일하게
   존재했고(§7.5 관련 개별 필드 캐스트 `as ChatMessage[]`, `as unknown[]` 를 스키마 타입
   sharpening 으로 대체한 것뿐), 새 런타임 assertion/검증을 추가하지 않는다.

결론: `z.unknown()` → `z.custom<T>()` 전환은 **타입 레벨(z.infer)** 만 sharpen 하고 런타임
validator 를 추가하지 않으므로, PR #783 이 결정한 "런타임 미검증 / behavior-preserving"
원칙을 위반하거나 재도입 없이 번복하지 않는다. diff 의 주석들도 이 근거를 코드에 명시적으로
기록해 두어(라인 44-48, 77-80, 128-130) Rationale 연속성 관점에서 **모범적**이다 — 과거
결정을 뒤집는 것이 아니라 그 결정이 여전히 유효함을 코드 레벨에서 재확인·문서화했다.

## 그 외 발견사항

target 은 `spec/5-system/4-execution-engine.md` 본문을 변경하지 않는 순수 코드 리팩터링
(구조 단언 → 스키마 기반 타입)이다. 관련 spec 조항(§1.3 checkpoint allow-list, §7.5
rehydration/graceful-reset, §7.4 재개상태) 과 대조한 결과 새로운 설계 결정·정책 변경은
없으며, 기존 `## Rationale` 의 다음 항목들과도 충돌하지 않는다:

- `Multi-turn 재시작 재개 — _resumeCheckpoint 보존 (옛 "WARN #6 미영속" 번복)` — 이번 diff 는
  이 항목이 정의한 "credential-free runtime 값만 allow-list 에 포함" 원칙을 그대로 따른다
  (credential/context-binding 필드는 diff 이후에도 `z.unknown()` 유지 — 라인 55-62, 114-135).
- `continuation publish 실패 동기 surface 통일 (C-1·M-7)` — 별개 M-7 항목(seq/publish 관련)이라
  본 diff 와 무관.

### 발견사항
- **[INFO]** M-7 스키마 enrich 관련 Rationale 신규 항목 부재 (선택적 보완)
  - target 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts`
    (라인 44-48, 77-80, 128-130 주석), `spec/5-system/4-execution-engine.md ## Rationale`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` 의 M-7 관련 기존 항목
    (`continuation publish 실패 동기 surface 통일 (C-1·M-7)`) 및 PR #783 커밋 메시지의
    "behavior-preserving (assertion-only)" 결정
  - 상세: 이번 변경은 §7.5 계약을 위반하지 않고 오히려 강화하는 안전한 확장이지만, spec
    Rationale 절에는 이 "타입 sharpening vs 런타임 검증 분리" 원칙이 아직 명문화되어 있지
    않다. 코드 주석에는 충분히 기록되어 있으나, spec 자체에는 향후 유사한 필드 enrich
    (예: 나머지 `z.unknown()` 필드들의 향후 sharpening) 시도 시 참조할 SoT 항목이 없다.
  - 제안: 필수는 아니나, 향후 M-7 클러스터가 완결되는 시점에 `## Rationale` 에
    "resume-state 스키마 enrich — 타입 sharpening 과 런타임 검증의 분리" 같은 항목을 추가해
    "z.custom<T>() 는 타입 파생 전용이며 §7.5 graceful-reset 계약(#783)을 변경하지 않는다"는
    원칙을 spec 레벨에서도 고정해 두면, 이후 이 파일을 만지는 사람이 실수로 `.refine()`/
    predicate 를 추가해 런타임 검증을 끼워 넣는 회귀를 방지하는 데 도움이 된다. 코드 주석만으로도
    현재는 충분히 안전하므로 이 제안은 강제 사항이 아니다.

## 요약

target diff(`resume-state.schema.ts` 의 `z.unknown()` → `z.custom<T>()` enrich, 및
`ai-turn-executor.ts` 의 이를 소비하는 domain 캐스트 제거)는 PR #783 이 확립한 "재개상태
스키마는 타입 문서화·파생 목적일 뿐 런타임 경계에서 parse/validate 하지 않는다"는 결정을
번복하지 않는다. zod v4 소스 확인 결과 `z.custom<T>()` 를 predicate 없이 호출하면 항상
통과하는 identity validator 이며, 해당 스키마들은 실제 rehydration/retry 코드 경로에서
`.parse`/`.safeParse` 로 전혀 소비되지 않고 unit test 의 drift-guard oracle 로만 쓰인다.
따라서 `spec/5-system/4-execution-engine.md §7.5` 의 graceful-reset permissive semantics
(부분/손상 checkpoint 를 거부하지 않고 기본값으로 보강)는 그대로 보존된다. diff 의 주석들이
이 근거를 코드에 명시적으로 남겨 두어 Rationale 연속성 측면에서 오히려 모범적인 처리다.
그 외 spec 본문·다른 Rationale 항목과의 충돌도 발견되지 않았다.

## 위험도

NONE
