# 요구사항(Requirement) 리뷰 결과

## 발견사항

### **[WARNING] [SPEC-DRIFT] spec/4-nodes/6-presentation/4-form.md §6.2 표 line 329 + "검증 지점" 주석 line 332 — 구현 완료됐으나 여전히 "Planned"**
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md` L329, L332
- 상세: 코드는 `validation.min`/`max`(숫자 범위)·`pattern`(정규식) 검증을 완전히 구현했다. `form-mode.ts` `validateFormSubmission` 에 min/max 범위 비교 + regex pattern try/catch 방어 경로가 추가됐고, `extractFormFields` 에서 `Number.isFinite` 가드로 min/max, 비빈 string 가드로 pattern 을 정규화한다. `FormModalField` 타입에도 `min?`/`max?`/`pattern?` 이 추가됐다. 그러나 spec §6.2 표 L329 는 여전히 `**미구현 (Planned)**, plan/in-progress/spec-sync-form-gaps.md 추적` 이라 기술하고, L332 "검증 지점 (구현)" 주석도 구현 목록에 min/max/pattern 을 포함하지 않고 "아직 **Planned**" 라 명시하고 있다. 이 동기화는 plan 파일(`form-validation-minmax-pattern.md`) 체크리스트 "spec 동반 갱신" 항목(`[x]`)에서 완료로 표시됐으나 실제로는 반영되지 않았다. 코드 구현이 옳고 spec 갱신이 누락된 상태이다.
- 제안: 코드 유지. spec 갱신 필요:
  - `spec/4-nodes/6-presentation/4-form.md` L329: `**미구현 (Planned)**` 제거 → 구현 완료로 표기.
  - L332 "검증 지점 (구현)" 주석: 검증 목록에 `validation.min`/`max`(숫자 범위)·`pattern`(정규식) 추가, "아직 Planned" 문구 삭제.
  - `## Rationale` `### file 검증(MIME/크기/개수)·validation.min/max·pattern 분리 defer` 절 (L354–L356): `validation.min`/`max`·`pattern` 은 구현 완료됐으므로 해당 언급 제거 또는 "file cluster 와 독립적으로 완료" 로 갱신.

### **[WARNING] [SPEC-DRIFT] spec/5-system/14-external-interaction-api.md §5.1 표 line 313 — EIA 400 VALIDATION_ERROR 행에 min/max/pattern 여전히 "Planned"**
- 위치: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` L313
- 상세: EIA §5.1 `400 VALIDATION_ERROR` 행 마지막 문장이 "`validation.min`/`max`·`pattern` 과 `type: 'file'` MIME/크기/개수 검증은 별도 **Planned**" 라 기술한다. 코드 구현은 이미 완료됐으므로 이 문장이 현실을 반영하지 않는다. 이 spec 도 plan 파일 "spec 동반 갱신 (EIA §5.1)" 항목에서 갱신 완료로 표시됐으나 실제로는 갱신되지 않았다.
- 제안: 코드 유지. `spec/5-system/14-external-interaction-api.md` L313 에서 `validation.min`/`max`·`pattern` 의 "Planned" 언급을 구현 완료 사실로 갱신. `type:'file'` MIME/크기/개수는 여전히 Planned 이므로 해당 부분은 유지.

### **[INFO] form §6.2 Rationale 절 — "검증 지점 = publisher 측 chokepoint" 목록에 min/max/pattern 미포함**
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md` L350 `### 검증 지점 = publisher 측 continueExecution chokepoint (3 경로 공통)`
- 상세: 이 Rationale 절 첫 문장은 "필수·`type`(email/number)·`validation.minLength`/`maxLength`·select/radio 선택지 검증을..." 라며 구현 검증 목록을 열거하는데, min/max/pattern 이 이제 구현됐으므로 목록에 포함돼야 한다. 오독 위험 낮음(INFO 수준)이나 spec 갱신 시 함께 수정하면 좋다.
- 제안: spec 갱신 시 L350 목록에 `validation.min`/`max`(숫자 범위)·`pattern`(정규식)` 추가.

### **[INFO] plan 파일 체크리스트 "spec 동반 갱신" 항목 상태 불일치**
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/plan/in-progress/form-validation-minmax-pattern.md` L71 (`[x] spec 동반 갱신`)
- 상세: plan 체크리스트가 spec 갱신 완료(`[x]`)로 표시됐으나, 위 두 spec 파일(form §6.2, EIA §5.1)이 실제로 갱신되지 않았다. 코드 구현 자체에는 영향 없으나, plan 상태가 실제를 반영하지 않는다. spec 갱신 후 체크박스 상태는 정합된다.
- 제안: spec 갱신 완료 후 자동 해소. spec 갱신 전까지 plan 항목을 `[ ]` 로 되돌리는 것이 일관성상 정확하다 (코드 버그 아님).

### **[INFO] `validation.message` — min/max/pattern 에 미사용 (spec 상 요구 없음, 단 minLength/maxLength 와 동작 불일치)**
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` (validateFormSubmission 내 min/max/pattern 오류 반환 경로)
- 상세: `validation.minLength`/`maxLength` 행은 spec L327 에서 "validation.message 가 있으면 그것을, 없으면 기본 메시지" 라 명시한다. 그러나 min/max/pattern 검증 오류는 코드에서 항상 하드코딩된 기본 메시지만 반환하며 `validation.message` 를 참조하지 않는다. plan 파일도 이를 "FormModalField 가 message 미보유, 기존 동작 일치" 라며 의도적 결정으로 명시했다. 그러나 `FormModalField` 는 `message` 필드를 보유하지 않는 반면, formConfig `ValidationRule` 에는 `message?: String` 이 있어(`spec §1` L61) 만약 미래에 message 를 `FormModalField` 에 전파하면 min/max/pattern 만 우회될 수 있다. 스펙 상 현재 명시적 요구는 없으므로 INFO 수준이다.
- 제안: 현재 구현 유지. 향후 `validation.message` 를 `FormModalField` 에 추가할 때 min/max/pattern 오류 메시지 경로도 함께 고려할 것.

### **[INFO] 테스트 — min=0 경계값 검증 케이스 부재**
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts`
- 상세: `extractFormFields` 테스트는 `min: 0` 이 허용(`Number.isFinite(0) === true`)됨을 검증하나, `validateFormSubmission` 에서 `min=0` 경계(정확히 0 입력 시 통과, -0.1 입력 시 오류)를 직접 검증하는 케이스가 없다. `min: -10, max: 0` 케이스(`temp: '-10'` 통과 + `0.5` 초과)로 음수·소수는 커버됐고, `min=0` 이면 `Number.isFinite(0)` 이 true 이므로 코드 경로상 동작에는 문제가 없다. 완전성 관점의 경미한 갭이다.
- 제안: 현재 구현 유지. 추가 케이스(`validateFormSubmission({ n: '-1' }, [field({ name:'n', type:'number', min:0 })])` → 오류, `0` → null)를 보완하면 이상적이나 차단 사유는 아니다.

---

## 요약

핵심 기능 구현(extractFormFields의 min/max/pattern 정규화, validateFormSubmission의 숫자 범위 + regex 방어 검증, FormModalField 타입 확장)은 완전하고 정확하다. 검증 우선순위(required → type → minLength/maxLength → min/max → pattern → select/radio)는 plan 명세 및 테스트와 일치한다. `Number.isFinite` 로 0·음수 min/max 경계를 올바르게 수용하고, NaN/비숫자 min 은 거부한다. regex 실패 시 방어적 통과, 빈 optional 값 skip, FIRST 오류만 반환 — 모두 구현 완료됐다. 주요 문제는 코드가 아니라 **spec 갱신 누락**이다: plan 파일이 "spec 동반 갱신" 을 `[x]` 로 표시했음에도 `spec/4-nodes/6-presentation/4-form.md §6.2` 표와 "검증 지점" 주석, `spec/5-system/14-external-interaction-api.md §5.1` VALIDATION_ERROR 행이 여전히 min/max/pattern 을 "미구현 (Planned)" 으로 기술하고 있다. 이는 코드 버그가 아니라 spec 갱신 누락(SPEC-DRIFT)이며, project-planner 경로로 spec 본문을 갱신해야 한다.

## 위험도

LOW
