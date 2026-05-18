# 요구사항(Requirement) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts (주석 갱신)

- **[INFO]** 주석 내용이 구현 현실을 정확히 반영하도록 갱신됨
  - 위치: 라인 4502~4507 (주석 블록)
  - 상세: 이전 주석은 `loop:no-count` warningRule 을 설계 시점 안전망으로 기술했으나, 변경 후 주석은 zod `default('1')` 가 storage 단에서 빈 값을 차단하고 런타임 예외는 레거시 데이터·직접 repo 쓰기 등 schema parsing 우회 경로에 대한 최후 안전망임을 명시. 의도와 구현 간 괴리 해소.
  - 제안: 없음. 갱신 내용이 구현 동작과 일치함.

---

### 파일 2: loop.handler.spec.ts (validate 테스트 변경)

- **[WARNING]** 빈 config 에 대한 validate 동작 변경 — zod default 의존성이 handler.validate 경계에서 명시되지 않음
  - 위치: 라인 382~385 (새 테스트 케이스)
  - 상세: 변경 전 `validate({})` 는 `valid: false` 를 반환해야 했으나, 변경 후 `{ valid: true, errors: [] }` 를 반환한다. 주석에서 "handler.validate 는 raw config 만 본다, storage layer 의 zod default 가 적용되므로 차단할 필요 없음" 이라고 기술한다. 그러나 `loop.handler.ts` 구현 자체에서 `count` 가 `undefined`/`''` 일 때 실제로 `valid: true` 를 반환하는지 테스트가 소스 파일을 직접 실행해 확인하는 것인지, 아니면 테스트 설계 전제(zod default 가 항상 적용된다)가 틀렸을 때 오탐이 발생하는 구조인지 불분명. storage layer bypass 경로(레거시 데이터, 직접 DB write)에서 `undefined` count 가 handler.validate 에 도달할 경우 해당 테스트는 허위 안전감을 줄 수 있음.
  - 제안: `handler.validate` 테스트에 `count: undefined` 를 명시적으로 전달하는 케이스도 추가해 "zod default 가 bypassed 된 경로에서도 validate 가 `valid: true` 를 반환하는지, 아니면 `valid: false` 를 반환해야 하는지" 의도를 명시. 또는 주석에 "handler.validate 는 undefined count 도 valid: true 반환 — runtime 예외는 executor 단에서 INVALID_CONTAINER_PARAM 으로 잡는다" 를 단문으로 추가해 두 계층(validate / executor)의 책임 경계를 명확히 할 것.

- **[INFO]** 테스트 커버리지 — 긍정 경로(accept) 케이스 충분
  - 위치: 라인 417~466 전체 validate describe 블록
  - 상세: numeric count, numeric string, 미해석 표현식, 빈 config, 비숫자 문자열, 0/음수, maxIterations 초과 등 주요 입력 형태를 모두 커버. 반환 값도 `{ valid, errors }` 형태로 모든 경로에서 정의됨.
  - 제안: 없음.

---

### 파일 3: loop.schema.spec.ts (warningRules 테스트 및 evaluateMetadataBlockingErrors 테스트 변경)

- **[INFO]** `warningRules: []` 를 적극적으로 검증하는 테스트로 교체 — dead rule 발화 경로 없음을 선언적으로 확인
  - 위치: 라인 596~602
  - 상세: "intentionally empty" 라는 테스트명이 의도를 명확히 서술. `warningRules` 배열이 빈 배열인지 직접 검증.
  - 제안: 없음.

- **[INFO]** `evaluateMetadataBlockingErrors({})` 가 `[]` 를 반환한다는 새 케이스 — 빈 config 정책 반영
  - 위치: 라인 641~646
  - 상세: 정책("zod default 가 count 를 채우므로 빈 config 는 통과")이 테스트로 명문화됨. `count: '0'` 을 명시적 무효값으로 여전히 차단하는 케이스(라인 654~658)도 유지되어 정책 범위가 명확함.
  - 제안: 없음.

- **[WARNING]** `validateLoopConfig` 의 `count: undefined` / `count: null` 경계 케이스 테스트 부재
  - 위치: `describe('validateLoopConfig (imperative)')` 블록 (라인 605~638)
  - 상세: `validateLoopConfig` 함수는 `if (count !== undefined && count !== null && count !== '')` 조건으로 빈 값을 건너뜀. 그러나 테스트는 `count: '0'`(0 문자열), `count: 'abc'`, `count: 200` 등 명시적 값만 검증하고, `count: undefined` / `count: null` / `count: ''` 각각의 반환값이 `[]` 임을 명시적으로 확인하는 케이스가 없음. "빈 값은 통과" 라는 로직이 spec §8 정책의 핵심 전제인데 테스트가 이를 직접 검증하지 않음.
  - 제안: 아래 케이스를 `validateLoopConfig` describe 블록에 추가:
    ```ts
    it('returns [] when count is undefined (bypassed zod default)', () => {
      expect(validateLoopConfig({ count: undefined })).toEqual([]);
    });
    it('returns [] when count is null', () => {
      expect(validateLoopConfig({ count: null })).toEqual([]);
    });
    it('returns [] when count is empty string', () => {
      expect(validateLoopConfig({ count: '' })).toEqual([]);
    });
    ```

---

### 파일 4: loop.schema.ts (warningRules 제거, 주석 갱신)

- **[INFO]** `warningRules: []` 로 변경 — dead rule 제거. 주석이 설계 의도를 충분히 설명
  - 위치: 라인 866~872
  - 상세: 제거된 `loop:no-count` rule 은 `when: '!count'` 조건이므로 zod `default('1')` 이 빈 값을 채우는 한 절대 발화하지 않는 dead rule 이었음. 주석에서 이유(zod default로 발화 경로가 닫혀 있음)와 spec 참조(§8 Rationale)를 함께 기록.
  - 제안: 없음.

- **[INFO]** `loopParseNumeric` / `loopLooksLikeExpression` 함수 — 타입 경계 처리 검토
  - 위치: 라인 804~817
  - 상세: `loopParseNumeric` 은 `number`, `string`, 기타 타입을 처리하며 `string` 이 아닌 타입(예: `boolean`, `object`) 에 대해서는 `null` 을 반환. `loopLooksLikeExpression` 도 동일. `validateLoopConfig` 내부에서 `count !== undefined && count !== null && count !== ''` 가드 이후 두 함수를 호출하므로 실질적으로 boolean/object 가 통과될 수 있으나 `loopParseNumeric` 이 `null` 을 반환해 `'count must be a number or expression'` 에러를 발생시킴. 이는 올바른 동작이나 테스트에 명시적 케이스가 없음.
  - 제안: `validateLoopConfig({ count: true })` 또는 `validateLoopConfig({ count: {} })` 에 대한 테스트를 추가해 비숫자/비문자열 입력의 에러 처리를 명시적으로 확인하면 요구사항 완전성이 높아짐.

- **[WARNING]** `validateLoopConfig` 의 cross-field 검증 — `count` 가 숫자형일 때만 적용, 숫자 문자열인 경우 누락
  - 위치: 라인 843~851
  - 상세: cross-field 검증 조건이 `typeof count === 'number'` 를 요구함. `count: '200'` (숫자 문자열), `maxIterations: 100` 인 경우 `loopLooksLikeExpression` 이 false 를 반환하고 `parsedMax` 계산은 진행되지만, `count > parsedMax` 비교에서 `typeof count === 'number'` 가 false 이므로 cross-field 에러가 발생하지 않음. `count: 200, maxIterations: 100` (숫자 리터럴) 케이스만 잡는다. 기존 테스트(`rejects count > maxIterations cross-field`)도 `count: 200` (숫자형)으로만 확인하고 있어 `count: '200'` (문자열) 경우를 누락.
  - 제안: `validateLoopConfig({ count: '200', maxIterations: 100 })` 케이스를 테스트에 추가하고, 에러가 발생해야 한다면 cross-field 비교 로직을 `const parsedCount = loopParseNumeric(count); if (parsedCount !== null && parsedCount > parsedMax)` 형태로 수정. 에러 미발생이 의도된 동작이라면 spec §8 또는 `validateLoopConfig` JSDoc 에 "count 가 문자열 형태의 숫자일 때는 cross-field 비교를 생략한다" 라고 명시.

---

### 파일 5: backend-labels.ts (i18n 매핑 제거)

- **[INFO]** `WARNING_KO` 에서 `"Count must be entered."` 항목 제거 — warningRule 삭제에 따른 연동 조치 완료
  - 위치: 라인 894 (삭제)
  - 상세: warningRule 삭제와 동일 commit 에서 처리되어 i18n Principle 3 준수. 삭제된 키는 이제 발화 경로가 없으므로 번역 테이블에 불필요한 dead entry 를 남기지 않음.
  - 제안: 없음.

---

### 파일 6: plan/in-progress/loop-count-policy.md (신규 plan)

- **[INFO]** plan 문서로서의 구조적 완전성 양호
  - 위치: 파일 전체
  - 상세: 배경, 결정 근거, 작업 항목(체크리스트), 후속 분리 사안, 관련 문서 링크를 모두 포함. `worktree` frontmatter 가 실제 디렉토리명과 일치(consistency-check W-2 처리 완료로 동작상 OK 확인).
  - 제안: 없음.

- **[INFO]** 미완 항목(`[ ]`) 3건 — `/ai-review`, PR + merge, `git mv` — 이 명시되어 있어 plan 상태가 `in-progress/` 에 올바르게 분류됨
  - 위치: 라인 1537~1539
  - 상세: 정책 준수.
  - 제안: 없음.

---

### 파일 7: plan/in-progress/node-config-required-defaults-sweep.md (follow-up 마킹)

- **[INFO]** loop 관련 두 follow-up 항목이 `loop-count-policy` plan 으로 올바르게 이관 마킹
  - 위치: 라인 1634, 1642
  - 상세: 취소선(`~~`)과 링크로 분리 결정을 기록. 신규 follow-up(`loop output.count 3중 문서 정합화`)도 추가되어 식별된 사안이 누락 없이 추적됨.
  - 제안: 없음.

---

### 파일 8-9: consistency-check SUMMARY.md / _retry_state.json

- **[INFO]** consistency-check 결과 문서 및 상태 파일로, 코드 동작에 직접 영향을 미치지 않음. BLOCK 없음, WARNING 2건 모두 본 PR 에서 처리 방침 결정 완료.
  - 위치: 파일 전체
  - 상세: 리뷰 산출물 자체이므로 요구사항 관점 분석 대상에서 제외.
  - 제안: 없음.

---

## 요약

이번 변경의 핵심 요구사항("최소 반복 1회 정책" 명문화 + dead warningRule 제거 + i18n 연동 정리)은 전반적으로 잘 구현되었다. `loop.schema.ts` 에서 warningRule 제거, `backend-labels.ts` 에서 대응 i18n 항목 삭제, 그리고 테스트 코드 갱신이 단일 변경 단위로 묶여 빌드 중간 단계에서 깨지는 경로를 방지했다. 주석과 구현의 일치도도 높고 plan 문서도 현재 상태를 정확히 반영한다. 다만 두 가지 요구사항 관점의 약점이 식별되었다: (1) `validateLoopConfig` 의 cross-field 검증이 `count` 가 숫자 문자열(예: `'200'`)일 때 의도적으로 생략되는지 아닌지가 스펙과 코드 어디에도 명시되지 않아 비즈니스 로직 의도와 구현 간 괴리 가능성이 있고, (2) `validateLoopConfig` 의 `count: undefined/null/''` 경계 케이스가 핵심 정책 전제임에도 직접 테스트되지 않아 기능 완전성 측면에서 허점이 있다.

## 위험도

LOW
