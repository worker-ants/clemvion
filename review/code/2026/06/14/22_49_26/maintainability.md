# 유지보수성(Maintainability) 리뷰

## 발견사항

### form-mode.ts

- **[INFO]** `validateFormSubmission` 함수 내 `def.type === 'number'` 블록이 두 번 등장
  - 위치: `form-mode.ts` validateFormSubmission — NUMBER_RE 검증 블록(기존)과 min/max 범위 검증 블록(신규, §6.2)
  - 상세: 같은 `def.type === 'number'` 조건이 두 개의 별도 `if` 블록으로 나뉘어 있다. 구조상 흐름은 명확하고(숫자 형식 검증 → 통과 후 범위 검증) 중첩 깊이를 줄이기 위한 의도적 분리로 보이지만, 두 블록이 떨어져 있어 number 필드 관련 로직이 단일 위치에 응집되지 않는다.
  - 제안: 현재 구조를 유지하되 NUMBER_RE 검증 직후 범위 검증을 inline으로 배치하거나, `validateNumberField` 같은 헬퍼로 분리해 `validateFormSubmission`의 주 흐름을 단순화하는 방안 고려. 현 규모(추가 10줄)에서는 허용 범위.

- **[INFO]** `validateFormSubmission` 내 regex 인스턴스 루프마다 생성
  - 위치: `form-mode.ts` — `new RegExp(def.pattern)` (신규 §6.2 블록)
  - 상세: `def.pattern`이 동일한 값이라도 폼 제출 시마다(루프마다) `new RegExp()`를 새로 생성한다. 폼 필드 수가 많거나 고빈도 호출 시 불필요한 객체 생성이 발생할 수 있다. 현행 use-case(서버 단회 검증)에서는 실질적 성능 문제는 없으나, 향후 고빈도 시나리오 확장 시 캐싱이 필요할 수 있다.
  - 제안: 현 규모에서는 유지. 성능이 문제가 되면 `Map<string, RegExp>` 캐싱을 고려.

- **[INFO]** `extractFormFields` 내 `FIELD_NAME_RE` 상수 함수 내부 정의
  - 위치: `form-mode.ts` — `extractFormFields` 함수 내 `const FIELD_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;` (기존 코드, 변경 없음)
  - 상세: 이 상수는 함수가 호출될 때마다 regex 리터럴을 재평가한다(JS 엔진이 최적화할 수 있으나 명시적으로 모듈 레벨 상수로 분리하면 의도가 더 명확). 이 변경과 직접 관련은 없으나 유사한 패턴이 신규 코드에서 반복되지 않도록 주의.
  - 제안: `EMAIL_RE`, `NUMBER_RE` 처럼 모듈 레벨 상수로 이동 권장(기존 코드 개선 기회).

### form-mode.spec.ts

- **[INFO]** `§6.2 field.validation.{min,max,pattern} 정규화` 테스트 케이스의 개별 assertion이 인덱스 기반으로만 접근
  - 위치: `form-mode.spec.ts` — `expect(fields[0].min)`, `expect(fields[1].pattern)`, `expect(fields[2].min)` 등
  - 상세: `fields[0]`, `fields[1]`, `fields[2]` 인덱스에 `'age'`, `'code'`, `'bad'` 필드가 암묵적으로 대응된다. 테스트 구조 변경 시 인덱스 의미를 추적해야 한다. 기존 테스트(§3.3)도 동일 패턴을 사용하므로 이 코드베이스에서는 일관성이 있다.
  - 제안: 일관성 유지를 위해 현 패턴 수용. 개선이 필요하다면 `const age = fields.find(f => f.name === 'age')!` 형태로 이름 기반 접근을 고려.

- **[INFO]** `§6.2 pattern — 잘못된 regex 는 방어적으로 통과` 테스트가 동작 이유를 주석으로 설명하지 않음
  - 위치: `form-mode.spec.ts:121-124`
  - 상세: `pattern: '['`이 유효하지 않은 정규식임을 코드만으로는 바로 알기 어렵다. 다른 케이스에 비해 "왜 null이어야 하는가"(regex compile 실패 → 방어적 통과)가 자명하지 않다.
  - 제안: `// '[' is an invalid regex — compile failure → defensive pass` 한 줄 주석 추가.

### types.ts

- **[INFO]** `min?`/`max?` 필드와 `minLength?`/`maxLength?` 필드가 인터페이스에 혼재하여 number 필드 관련 두 쌍이 나란히 위치
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `FormModalField` 인터페이스
  - 상세: `minLength`/`maxLength`(문자열 길이용)와 `min`/`max`(숫자 범위용) 두 쌍의 구분이 JSDoc으로 명확히 기술되어 있어 혼동 가능성이 낮다. 추가된 JSDoc("서버측 검증 전용")은 유지보수 의도를 잘 전달한다.
  - 제안: 현 상태 양호. 추후 필드 수가 늘어나면 그룹 주석(`// --- 서버측 전용 검증 제약 ---`)으로 가독성 개선 가능.

### execution-engine.service.ts

- **[INFO]** docstring 변경이 한 줄 단락 리플로우로 가독성 개선됨 — 문제 없음
  - 위치: `execution-engine.service.ts:4314`
  - 상세: "미적용 (Planned)" 항목에서 min/max/pattern 제거 후 남은 file 검증만 남겨 docstring이 더 간결해졌다. `validateFormSubmission` 재사용 언급이 유지되어 독자가 구현 위치를 추적할 수 있다.

---

## 요약

이번 변경은 `validateFormSubmission`에 min/max 범위 검증과 custom regex pattern 검증을 추가하고, `FormModalField` 타입과 `extractFormFields` 정규화 로직을 대칭적으로 확장한 작업이다. 전반적으로 기존 코드베이스의 스타일(FIRST 오류 반환, 방어적 empty skip, `Number.isFinite` 사용)을 일관되게 따르고 있으며, 신규 코드의 가독성과 의도 명확성이 높다. 주요 유지보수 우려사항은 `validateFormSubmission` 내 `def.type === 'number'` 조건 블록이 두 곳으로 분리된 점이나, 이는 FIRST 오류 순서(형식 검증 → 범위 검증) 보장을 위한 의도적 배치로 허용 가능하다. 테스트는 신규 규칙의 경계 조건(음수/소수 경계, 무효 regex 방어, 우선순위 순서)을 빠짐없이 커버하며, 기존 §3.3 테스트 패턴과 일관성을 유지한다.

## 위험도

LOW
