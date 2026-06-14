### 발견사항

- **[INFO]** `extractFormFields` 단독 min 시나리오 (max 없이 min 만) 미검증
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` — `extractFormFields` describe 블록
  - 상세: `max only` 독립 동작은 `validateFormSubmission` 레벨에서 I14 fix 로 추가됐으나, `extractFormFields` 정규화 레벨에서 `min only` (max 없음) 조합에 대해 `field.min` 이 올바르게 설정되고 `field.max` 는 `undefined` 임을 단독으로 검증하는 케이스가 없다. `§6.2 field.validation.{min,max,pattern} 정규화` 케이스는 항상 min+max 함께 또는 둘 다 없는 경우만 다룬다. 논리 역전 방어 코드 `if (minV === undefined || maxV === undefined || minV <= maxV)` 에서 `minV !== undefined && maxV === undefined` 분기는 테스트로 명시적으로 커버되지 않는다.
  - 제안: `{ validation: { min: 5 } }` (max 없음) 케이스를 `extractFormFields` 단위로 추가해 `field.min === 5 && field.max === undefined` 검증.

- **[INFO]** `validateFormSubmission` — min 단독 (max 없음) + 경계 이하 값 조합 미검증
  - 위치: `form-mode.spec.ts` — `validateFormSubmission` describe 블록
  - 상세: `min only` 테스트(`§6.2 min/max — min:0 하한`)는 min=0 으로 경계 이하를 검증하지만 양의 min 단독(max 없음, min 이상 통과) 케이스가 없다. 소수점 입력(`0.5`, `-10.0`)에 대한 min 검증도 `min/max — 음수·소수 경계` 에서 max 쪽만 검증되고 min 쪽 소수 경계 위반은 미검증이다. 이는 실용적 위험은 낮지만 커버리지 완전성 측면에서 갭이다.
  - 제안: `min: 1.5` 로 `value: '1.4'` 미만 거부, `value: '1.5'` 통과 케이스 추가.

- **[INFO]** `execution-engine.service.spec.ts` — `assertFormSubmissionValid` 경로에 min/max/pattern 통합 테스트 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L1243 `describe('assertFormSubmissionValid / coerceFormValue (W-1)')`
  - 상세: `assertFormSubmissionValid` 경로는 required 누락·email 형식 오류만 통합 테스트로 커버된다. 새로 추가된 min/max 범위·pattern regex 검증이 `continueExecution` chokepoint 를 통해 실제로 `FormValidationError` 를 throw 하는지를 검증하는 통합 테스트가 없다. `validateFormSubmission` 자체는 순수 함수 단위 테스트로 충분히 커버되지만, 파이프라인 전체(formConfig → extractFormFields → validateFormSubmission → throw) 연결 정확성은 통합 레벨에서 검증되지 않는다.
  - 제안: `setupFormNodeMocks({ fields: [{ name: 'age', type: 'number', validation: { min: 18, max: 65 } }] })` 후 범위 외 값(`{ age: '10' }`) 제출 시 `FormValidationError` throw + 패턴 불일치(`{ name: 'code', type: 'text', validation: { pattern: '^[A-Z]+$' } }`) 시 throw 케이스를 각각 1건 추가.

- **[INFO]** pattern 이 `type: 'number'` 필드에 적용되는 경우 미검증
  - 위치: `form-mode.spec.ts` — `validateFormSubmission` `§6.2 pattern` 블록
  - 상세: 구현 코드(`form-mode.ts`)는 pattern 검증을 `def.pattern` 존재 시 type 무관하게 적용한다. 현재 테스트는 pattern 을 모두 `type: 'text'` 필드에서만 사용한다. `type: 'number'` 필드에 pattern 이 설정된 경우(예: 정수만 허용 패턴) 동작을 테스트하지 않아 type·pattern 교차 동작이 암묵적이다.
  - 제안: `type: 'number'` + `pattern: '^[0-9]+$'` 조합에서 `-1`(음수 — NUMBER_RE 통과, pattern 미일치) 입력이 거부되는지 테스트 1건 추가. 이는 또한 NUMBER_RE 가 음수를 허용하고 이후 pattern 이 음수를 거부할 수 있는 동작의 명확한 문서화 효과도 있다.

- **[INFO]** `pattern` 길이 경계(512자 정확히) 테스트 미포함
  - 위치: `form-mode.spec.ts` — `§6.2 pattern — 과길이 패턴(>512자)은 컴파일 skip`
  - 상세: 현재 테스트는 513자(`'a'.repeat(513)`)만 검증한다. 512자 정확히가 컴파일되어 실제 매칭에 적용되는지(MAX_PATTERN_LENGTH 이하로 정상 적용) 경계값 테스트가 없다. off-by-one 오류(`<=` vs `<`)에 취약할 수 있다.
  - 제안: `'a'.repeat(512)` 패턴이 `'b'` 입력에 대해 오류를 반환함(컴파일되어 미일치 감지)을 확인하는 케이스 추가.

- **[INFO]** 빈 문자열 공백만(`' '`) 입력의 optional pattern 필드 동작 미검증
  - 위치: `form-mode.spec.ts` — `§6.2 pattern — 빈 optional 값은 skip`
  - 상세: `isEmpty` 판정은 `value.trim().length === 0` 이다. `' '`(공백만) 입력이 pattern 검증을 skip 함을 `{ code: ' ' }` 케이스로 명시 검증하지 않는다. 현재 테스트는 `''`(빈 문자열)만 커버한다.
  - 제안: `{ code: '   ' }` 입력이 `null` 반환(pattern skip)되는 케이스 추가 — 기존 `isEmpty` 동작과 일관성 명시.

### 요약

이번 변경은 TDD 절차(테스트 선작성 → 구현)를 준수했으며, `form-mode.spec.ts` 에 추가된 +7케이스(확장 전)→최종 42케이스(resolution fix 포함)는 핵심 경로(min/max 범위, Infinity 거부, 논리 역전, pattern 일치/불일치, 방어적 통과, 길이 우선순위)를 잘 커버한다. 순수 함수 단위 테스트라 격리성과 가독성도 우수하다. 다만 (1) `extractFormFields` 레벨에서 min 단독 정규화, (2) `assertFormSubmissionValid` 통합 경로에서 min/max·pattern 기반 `FormValidationError` 연결, (3) pattern 길이 상한 정확한 경계값(512자), (4) type=number + pattern 교차 조합 등 보조 커버리지 갭이 INFO 수준으로 존재한다. 회귀 위험은 없으며, e2e 192건 포함 전 suite green 이 확인됐다.

### 위험도

LOW
