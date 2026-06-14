# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] FormModalField 인터페이스에 옵셔널 필드 추가 — 기존 호출자 영향 없음
- 위치: `codebase/backend/src/modules/chat-channel/types.ts`, `FormModalField` 인터페이스
- 상세: `min?`, `max?`, `pattern?` 세 필드가 모두 옵셔널(`?`)로 추가됐다. 기존 `FormModalField` 객체를 생성하거나 소비하는 모든 코드는 이 필드를 참조하지 않으므로 기존 동작이 변경되지 않는다. TypeScript 구조적 타이핑 상 기존 객체 리터럴에 세 필드가 없어도 타입 호환성을 유지한다.
- 제안: 추가 조치 불필요. 단, 향후 `FormModalField`를 직렬화해 외부로 전송하는 경로(예: WebSocket 이벤트 페이로드)가 있다면 새 필드가 `undefined`로 직렬화돼 `null` 없이 키가 누락되는 동작을 확인할 것.

### [INFO] extractFormFields — 신규 필드 추출 로직, 입력 원본 객체 불변
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`, `extractFormFields` 함수 내 validation 블록 (+102~+111)
- 상세: `validation.min`, `validation.max`, `validation.pattern`을 읽어 `field` 지역 객체에 프로퍼티를 추가한다. `field`는 함수 내부에서 `const field: FormModalField = { name, label, type }`로 새로 생성된 객체이므로 입력 `formConfig`나 어떤 외부 공유 상태도 변경하지 않는다. `Number.isFinite()` 가드로 NaN·Infinity·비숫자 값을 방어한다.
- 제안: 추가 조치 불필요.

### [INFO] validateFormSubmission — 순수 함수 확장, 공유 상태 변경 없음
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`, `validateFormSubmission` 함수 내 +191~+220
- 상세: 함수는 여전히 순수(pure)하다. 추가된 min/max 범위 검사와 pattern 검사 모두 입력 `fields`·`defs`만 읽고 새 객체를 반환하거나 `null`을 반환한다. 전역 변수 접근·외부 호출·파일시스템 접근이 없다.
- 제안: 추가 조치 불필요.

### [INFO] pattern 검증에서 new RegExp() 호출 — 잠재적 CPU 소비, 공유 상태 없음
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`, +203~+212
- 상세: `new RegExp(def.pattern)`은 매 `validateFormSubmission` 호출 시 컴파일된다. pattern은 필드별로 고정 문자열이므로 캐싱 미적용이 성능에 영향을 줄 수 있으나, 런타임 공유 상태를 오염시키지는 않는다. `try/catch`로 잘못된 regex에 대한 throw를 방어한다. 단, 악의적 사용자가 ReDoS(Regex DoS) 취약 패턴을 `validation.pattern`에 심을 수 없는지 확인이 필요하다 — 이 필드는 서버측 노드 config에서 추출되므로 외부 사용자 입력이 아닌 관리자/운영자가 정의한 값이어야 한다. 현재 코드 흐름상 `extractFormFields`가 `formConfig`(노드 설정)에서 읽으므로 신뢰 경계가 올바르나, 향후 외부 사용자 입력이 `pattern`으로 흘러드는 경로가 생기면 ReDoS 위험이 발생한다.
- 제안: 현재 범위에서는 문제 없음. 노드 config 작성 주체(관리자)가 신뢰 경계 안에 있음을 JSDoc 또는 주석으로 명시해 두면 향후 혼동을 방지할 수 있다.

### [INFO] execution-engine.service.ts 변경 — docstring만 수정, 로직 변경 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, +4314~+4018
- 상세: JSDoc 주석 텍스트만 변경됐다. "미적용(Planned)" 목록에서 `min`/`max`/`pattern`을 제거하고 "적용 규칙" 목록에 추가했을 뿐이다. 실행 코드가 없는 주석 변경이므로 어떤 부작용도 없다. `assertFormSubmissionValid`가 `validateFormSubmission`을 재사용하므로 EIA/WS/UI 3경로 모두 코드 변경 없이 새 검증 규칙이 자동 적용된다.
- 제안: 추가 조치 불필요.

### [INFO] plan/review 파일 변경 — 상태 추적 파일, 런타임 부작용 없음
- 위치: `plan/in-progress/form-validation-minmax-pattern.md`, `plan/in-progress/spec-sync-form-gaps.md`, `review/consistency/2026/06/14/22_22_50/SUMMARY.md` 등
- 상세: 마크다운·JSON 형태의 문서/추적 파일이다. 런타임에 로드되지 않으므로 어떤 부작용도 없다.
- 제안: 추가 조치 불필요.

## 요약

이번 변경은 `FormModalField` 인터페이스에 옵셔널 필드 세 개를 추가하고, `extractFormFields`에서 해당 필드를 추출하며, `validateFormSubmission`에 min/max 범위·pattern regex 검증 로직을 추가한 것이 전부다. 두 핵심 함수 모두 순수 함수로 유지되어 전역 상태·파일시스템·네트워크·이벤트에 대한 의도치 않은 부작용이 없다. 인터페이스 변경은 모든 필드가 옵셔널이므로 기존 호출자와 완전히 하위 호환된다. `execution-engine.service.ts`는 docstring만 변경되어 기존 동작이 전혀 바뀌지 않으며, `assertFormSubmissionValid`가 `validateFormSubmission` 재사용 구조이므로 EIA/WS/UI 3경로에 신규 검증 규칙이 추가 코드 없이 자동 전파된다는 점도 의도된 설계다. 주목할 잠재적 사항은 `new RegExp(pattern)` 호출이 매 검증마다 컴파일된다는 점이나, `pattern`이 노드 관리자 설정에서 오는 신뢰 경계 안의 값이므로 현재 범위에서는 ReDoS 위험이 없다.

## 위험도

NONE
