# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] minV/maxV 임시 변수 네이밍이 약어 수준
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields` 내 §6.2 블록 (`minV`, `maxV`)
- 상세: `minV`, `maxV` 는 의도는 충분히 파악되지만, 같은 함수 안에서 `minLength`/`maxLength`(필드 결과)와 병존하므로 `normalizedMin`/`normalizedMax` 혹은 `parsedMin`/`parsedMax` 처럼 파싱 단계임을 드러내는 이름이 더 명확하다. 현재 규모(4줄)에서 허용 가능한 수준이지만, 추후 validation 블록이 확장될 경우 혼동 여지가 있다.
- 제안: `minV` → `parsedMin`, `maxV` → `parsedMax` 로 변경 (선택적 개선, 필수 아님)

### [INFO] `validateFormSubmission` 내 `type==='number'` 블록 이중 진입
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission` 함수, L818 및 L835
- 상세: `def.type === 'number'` 조건이 두 곳에서 개별적으로 체크된다. 첫 번째(L818)는 NUMBER_RE 형식 검사, 두 번째(L835)는 min/max 범위 검사다. 현재 순서(FIRST 오류 원칙)상 두 블록이 분리되어야 하는 의도는 명확하나, 함수 전체를 통독할 때 같은 타입에 대한 로직이 분산되어 보인다. JSDoc 의 FIRST 오류 순서 목록이 이를 설명하고 있어 가독성 피해는 제한적이다. 현 규모에서는 허용 범위.
- 제안: 현 구조 유지 허용. JSDoc FIRST 오류 순서 목록이 보완재 역할을 충분히 하고 있다.

### [INFO] `RegExp` 루프 내 매번 재생성
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission` 패턴 블록 (L858-L867)
- 상세: `defs` 의 각 필드마다 `new RegExp(def.pattern)` 을 호출한다. 동일 `def` 객체에 대한 반복 호출 시나리오(테스트·재검증)에서는 불필요한 재컴파일이 발생한다. 단, `validateFormSubmission` 은 요청당 1회 호출이 전제이고, 필드 수도 최대 5개(NATIVE_MODAL_MAX_FIELDS) 수준이라 성능 영향은 무시 가능하다. 이전 리뷰(SUMMARY I7)에서도 accept 결정이 내려진 사항.
- 제안: 현 구조 유지. 추후 `defs` 를 캐싱하는 구조로 변경할 경우에 WeakMap 캐시를 도입할 것.

### [INFO] 테스트 케이스 인덱스 기반 접근 (`fields[0]`, `fields[1]`, `fields[2]`)
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` — `extractFormFields` §6.2 테스트 블록
- 상세: 여러 필드를 한 케이스에 묶어 `fields[0]`, `fields[1]`, `fields[2]` 로 접근한다. 인덱스가 묵시적 순서에 의존하므로, 필드 배열 순서 변경 시 테스트가 잘못된 필드를 검증하게 될 위험이 있다. 기존 코드베이스 패턴(§3.3 테스트 등)과 일관되어 새로운 불일치는 아니다.
- 제안: 필드 수가 많은 케이스는 `fields.find(f => f.name === 'age')` 형태로 명시적 조회를 사용하거나, 케이스를 단일 필드 단위로 분리하는 것을 고려. 현재 구조에서는 인라인 주석(`// age`, `// code`, `// bad` 순서 명시)으로도 충분히 완화 가능.

### [INFO] `MAX_PATTERN_LENGTH = 512` 매직 넘버 — 문서화는 충분하나 근거 부재
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — L780
- 상세: `512` 는 JSDoc 에 "과도하게 긴 패턴은 컴파일하지 않고 skip" 이라는 의도가 명시되어 있고 상수명도 명확하다. 다만 왜 512인지(예: URL 길이 관례, 임의 선택 등) 주석에서 설명이 없다. 현 수준에서 유지보수상 큰 문제는 아니지만, 값 조정 시 판단 근거가 불투명하다.
- 제안: JSDoc 말미에 `// 임의 상한 — ReDoS 방어 목적, 실제 운영 패턴은 수십 자 수준` 수준의 1줄 주석 추가.

### [INFO] `extractFormFields` 내 `FIELD_NAME_RE` 정의 위치
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields` 함수 내부 L699
- 상세: 이전 리뷰(SUMMARY I8)에서 "inline 정의가 locality 가 높아 의도적 유지" 로 accept 된 사항이다. 단, `EMAIL_RE` / `NUMBER_RE` 는 모듈 레벨에 정의되어 있어 일관성 부재가 남는다. 함수 외부의 동일 패턴(`EMAIL_RE`, `NUMBER_RE`) 대비 규칙 불통일이 유지보수 시 혼동 여지.
- 제안: `EMAIL_RE`/`NUMBER_RE` 와 마찬가지로 모듈 레벨로 이동하면 일관성이 높아지나, 사용처가 `extractFormFields` 1곳뿐이므로 현 위치 유지도 허용 가능. 팀 컨벤션 결정 필요.

## 요약

이번 변경(`form-mode.ts` §6.2 min/max/pattern 추출·검증 + `types.ts` 타입 확장 + 테스트 추가)은 전반적으로 유지보수성이 양호하다. 함수 길이·중첩 깊이·순환 복잡도 모두 기존 패턴 범위 내에 있으며, 매직 넘버(`MAX_PATTERN_LENGTH`)도 상수화와 JSDoc 으로 충분히 문서화되었다. 중복 코드는 발견되지 않았고, 기존 `minLength`/`maxLength` 패턴을 자연스럽게 확장하여 코드베이스 일관성도 잘 유지된다. 주요 유지보수 리스크는 테스트의 인덱스 기반 필드 접근(순서 의존성)과 `FIELD_NAME_RE` 의 모듈 레벨 정의 불일치 정도이며, 모두 이전 리뷰에서 accept 또는 fix 결정이 내려진 사항이다. 신규 발견 Critical/Warning 은 없다.

## 위험도

LOW
