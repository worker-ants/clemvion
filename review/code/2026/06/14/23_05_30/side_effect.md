# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 1. 인터페이스 변경 — FormModalField 에 옵셔널 필드 추가

- **[INFO]** `FormModalField` 인터페이스에 `min?`, `max?`, `pattern?` 세 필드가 추가됨.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/types.ts` (diff 내 FormModalField)
  - 상세: 세 필드 모두 옵셔널(`?`)로 선언돼 기존 코드가 `FormModalField` 객체를 생성하거나 소비하는 위치에서 추가 키를 제공하지 않아도 컴파일 오류 없이 동작한다. TypeScript 구조적 타이핑 상 기존 모든 할당·구조 분해·스프레드가 하위 호환된다.
  - 제안: 별도 조치 불요. 하위 호환 확장.

### 2. extractFormFields — 반환 객체에 새 키 추가 (의도적 상태 변경)

- **[INFO]** `extractFormFields` 가 반환하는 `FormModalField` 객체에 `min`, `max`, `pattern` 키가 조건부로 추가됨.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L104-L148 구간(diff 기준)
  - 상세: 반환 배열 내 각 `FormModalField` 객체에 `validation.min`/`max`/`pattern` 이 유효한 경우에만 키가 추가된다. 함수 자체는 순수(pure) — 입력을 변이하지 않으며 새 객체를 구성해 반환한다. 기존 호출자가 반환 객체를 `Object.keys()` 순서나 키 유무로 분기하는 경우 새 키가 존재함으로써 동작이 바뀔 수 있으나, 이는 수용 가능한 의도된 확장이다. 검토된 코드베이스 범위 내 호출자(`assertFormSubmissionValid` 등)는 명시적 프로퍼티 접근을 사용하므로 영향 없음.
  - 제안: 별도 조치 불요.

### 3. validateFormSubmission — 검증 순서 변경 (기존 호출자 영향 없음)

- **[INFO]** `validateFormSubmission` 내부에 `minLength`/`maxLength` 블록 직후 `min`/`max`(number range), `pattern` 검증 블록이 추가됨.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` L205-L250 구간(diff 기준)
  - 상세: 함수 시그니처(`(fields: Record<string, string>, defs: FormModalField[]) => { field: string; message: string } | null`)는 변경 없다. 기존에 `min`/`max`/`pattern` 이 없던 `FormModalField` 정의를 넘기는 호출자는 새 블록이 `undefined` 체크(`typeof def.min === 'number'`)를 통과하지 못하므로 추가 오류를 생성하지 않는다. 신규 필드가 정의된 경우에만 추가 검증이 실행되는 가산(additive) 변경이다.
  - 제안: 별도 조치 불요.

### 4. 모듈 레벨 상수 추가 — MAX_PATTERN_LENGTH

- **[INFO]** `MAX_PATTERN_LENGTH = 512` 상수가 모듈 스코프에 추가됨.
  - 위치: `form-mode.ts` (모듈 레벨, `EMAIL_RE`/`NUMBER_RE` 인근)
  - 상세: 읽기 전용 상수(`const`)로 전역 변경 없음. 같은 파일 내 `validateFormSubmission` 에서만 참조되며 export 되지 않아 외부 노출 없음. 모듈 초기화 시점에 메모리에 올라오는 단순 숫자 리터럴이므로 부작용 없음.
  - 제안: 별도 조치 불요.

### 5. 동적 RegExp 생성 — 런타임 부작용 없음

- **[INFO]** `validateFormSubmission` 내부에서 `new RegExp(def.pattern)` 를 필드별로 생성함.
  - 위치: `form-mode.ts` validateFormSubmission 내 pattern 검증 블록
  - 상세: `try/catch` 로 컴파일 실패를 방어하고 `re = null` 로 처리해 throw 가 상위로 전파되지 않는다. `MAX_PATTERN_LENGTH` 상한으로 과도한 패턴 컴파일을 사전 차단한다. `RegExp` 인스턴스는 함수 호출 스택 내에만 존재하며 외부 캐시·전역 상태에 저장되지 않는다. 루프 내 매 호출마다 새 인스턴스를 생성하는 점은 성능 상 미세한 비용이지만 부작용(side effect) 범주는 아님.
  - 제안: 별도 조치 불요. (성능 개선이 필요하다면 호출자 레벨에서 캐싱 고려 가능하나 현 규모에서 불필요.)

### 6. execution-engine.service.ts — JSDoc 갱신만, 동작 변경 없음

- **[INFO]** `execution-engine.service.ts` 변경은 `assertFormSubmissionValid` 메서드의 JSDoc 주석 문자열만 수정됨(diff L4314-L4322).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - 상세: 런타임 코드(`const`/`let`, 함수 호출, 분기 등) 변경 없음. 문서 문자열 교체이므로 컴파일 결과물·런타임 동작·호출 계약에 영향 없다.
  - 제안: 별도 조치 불요.

---

## 요약

이 변경은 `FormModalField` 인터페이스에 옵셔널 필드 3개를 추가하고, `extractFormFields`(정규화)와 `validateFormSubmission`(검증) 두 순수 함수를 가산적으로 확장한 것이다. 두 함수 모두 전역 상태·파일시스템·네트워크·이벤트를 변경하지 않으며, 기존 시그니처를 그대로 유지한 채 새 `FormModalField` 필드가 존재할 때만 추가 로직을 실행하므로 기존 호출자에게 의도하지 않은 부작용을 일으키지 않는다. `execution-engine.service.ts` 는 JSDoc 만 수정됐다. 전체적으로 부작용 위험은 없다.

## 위험도

NONE
