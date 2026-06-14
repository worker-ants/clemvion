# 요구사항(Requirement) Review

## 발견사항

### [SPEC-DRIFT] [WARNING] spec/4-nodes/6-presentation/4-form.md §6.2·§Rationale 가 코드 구현보다 낡음 — "Planned" 라벨 제거 누락
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md` L329, L332, L354-356
- 상세:
  - **L329**: `| validation.min/max(숫자 범위)·pattern(정규식) 위반 | 동상 — **미구현 (Planned)** ...` — 이 행은 이번 PR 이 완전히 구현한 기능인데 여전히 "미구현 (Planned)"으로 기재돼 있다.
  - **L332** (검증 지점 callout): `validation.min/max(숫자 범위)·pattern(정규식)` 과 `type: 'file'` 의 MIME/크기/개수 검증은 아직 **Planned**` — 구현 완료된 min/max/pattern 이 file 과 함께 Planned 묶음으로 남아 있다.
  - **L354-356** (Rationale): `### file 검증(MIME/크기/개수)·validation.min/max·pattern 분리 defer` 섹션 — "§6.2 표의 file 검증 행과 숫자 범위/정규식 행은 **Planned** 로 분리돼 있다" 라고 기술한다. 이제 숫자 범위/정규식은 더 이상 Planned 가 아니므로 이 섹션의 본문이 현실과 어긋난다.
  - 또한 §6.2 "검증 지점 (구현)" callout(L332)과 Rationale "검증 지점 = publisher 측 chokepoint"(L350) 도 각각 `validation.min/max/pattern` 을 누락한 채 minLength/maxLength·select/radio 까지만 구현 목록에 포함한다.
  - plan 체크리스트의 `[x] spec 동반 갱신 (form §6.2·§Rationale / EIA §5.1 / assert docstring)` 이 완료로 표시돼 있으나, 실제 spec 파일에 변경이 반영되지 않은 상태다.
  - 이는 코드가 명백히 옳고(구현 완료, 테스트 42건 통과), spec 파일 갱신만 누락된 SPEC-DRIFT 케이스다.
- 제안: 코드 유지, spec 반영 필요.
  - L329: `validation.min/max·pattern 위반` 행의 `**미구현 (Planned)**` 라벨을 제거하고 구현 완료임을 명시.
  - L332 callout: min/max/pattern 을 구현 완료 목록에 추가, "Planned" 에서 제거.
  - L354-356 Rationale: `validation.min/max·pattern` 을 `file 검증` defer 섹션에서 분리, 구현 완료 사실을 서술. Rationale "검증 지점" 섹션(L350)의 구현 규칙 목록에 min/max/pattern 추가.
  - (spec 수정 권한은 project-planner 경로)

---

### [INFO] 기능 완전성 — 구현 범위 충족 확인

plan 문서가 정의한 요구사항(A-1):
- `FormModalField` 에 `min?/max?/pattern?` 추가 → types.ts 에 반영됨 (JSDoc "서버측 검증 전용" 포함).
- `extractFormFields` 에서 `validation.min/max/pattern` 추출 → form-mode.ts 에 반영됨.
  - min/max: `Number.isFinite()` 로 유한수 필터 (NaN, Infinity/-Infinity 거부).
  - min>max 논리 역전: 두 경계 모두 무시(min==max 유효).
  - pattern: 비어있지 않은 string 만 저장.
- `validateFormSubmission` 확장: min/max(type=number, NUMBER_RE 통과 후), pattern(MAX_PATTERN_LENGTH=512 cap, try-catch 방어적 통과) → 구현 완료.
- FIRST 오류 순서: required → type(email/number) → minLength/maxLength → min/max → pattern → select/radio — plan 정의와 코드 순서 일치.
- 테스트: 기존 케이스 보존 + §6.2 신규 케이스 7개 이상 추가 (Infinity 거부, min>max 역전, max 단독, min:0 하한, pattern 미일치/빈 값/잘못된 regex/과길이, maxLength>pattern 우선 순서).

기능 완전성은 충족. 엣지 케이스(Infinity, NaN, min>max, pattern 길이 초과, regex 컴파일 실패) 모두 테스트로 커버됨.

---

### [INFO] `validation.message` 미사용 — 의도적 기존 동작 일치

spec §6.2 L327: `validation.minLength/maxLength` 행에 `"validation.message 가 있으면 그것을, 없으면 기본 메시지"` 가 명시돼 있다. 신규 min/max/pattern 검증은 항상 기본 메시지를 사용하며 `validation.message` 를 참조하지 않는다. 이는 plan 문서에서 `"메시지: FormModalField 가 message 미보유, 기존 동작 일치"` 로 명시적으로 수용된 결정이다. 단, minLength/maxLength 행이 validation.message 우선 처리를 spec 에 명시하는 반면 min/max/pattern 은 그렇지 않아 spec 내 일관성 갭이 있다. 이는 코드 결함이 아니라 spec 보강 대상 (project-planner 위임).

---

### [INFO] 반환값 — 모든 경로 정상

`extractFormFields`: 잘못된 input(null, {}, 빈 배열, name 없는 필드)은 빈 배열 반환, 정상 input 은 정규화된 배열 반환.
`validateFormSubmission`: 모든 검증 통과 시 `null`, 첫 위반 시 `{ field, message }` 반환. 빈 optional 필드는 skip. 모든 코드 경로에서 반환값 존재.

---

### [INFO] TODO/FIXME — 없음

변경된 파일(form-mode.ts, form-mode.spec.ts, types.ts, execution-engine.service.ts)에 TODO/FIXME/HACK/XXX 주석 없음.

---

## 요약

이번 변경(A-1: form validation.min/max·pattern 서버측 검증)은 기능 완전성 측면에서 완전하다. `FormModalField` 타입 확장, `extractFormFields` 추출 로직, `validateFormSubmission` 검증 로직, FIRST 오류 순서가 모두 plan 정의와 일치하며, 엣지 케이스(Infinity, NaN, min>max 역전, regex 컴파일 실패, 과길이 패턴)가 테스트로 커버된다. 코드 자체의 요구사항 충족도는 높다. 단, spec 동반 갱신이 plan 체크리스트에서 완료로 표시됐음에도 실제 `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md` §6.2 표(L329), 검증 지점 callout(L332), Rationale defer 섹션(L354-356)이 여전히 `validation.min/max/pattern` 을 "미구현 (Planned)"으로 기술하고 있다. 이는 코드가 옳고 spec이 낡은 SPEC-DRIFT 상황으로, spec 파일 갱신이 실제로 PR 에 포함되지 않은 채 체크박스만 완료로 표시된 것이다. 코드 되돌리기가 아닌 spec 반영이 필요하다.

## 위험도

LOW
