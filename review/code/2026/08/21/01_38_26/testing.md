# 테스트(Testing) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (라운드3, `01_38_26`)

## 검토 범위 및 사전 확인

실질 코드 변경 8개 파일(+621/-10 규모, 이전 두 라운드 `00_03_57`·`00_39_27`에서 이미 심층
검토됨). 이번 라운드는 그 두 라운드가 지적한 CRITICAL 1(`boolean` 완전 우회)·WARNING 다수가
실코드로 해소됐는지 재검증하는 성격이다.

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`(신규)
  + `reject-masked-resubmission.spec.ts`(신규) 를 `Read` 로 전문 열람.
- `executions-rerun.service.spec.ts`, `workflows.controller.spec.ts` 신규 테스트 diff 확인.
- `trigger-parameter.types.ts`(REASON_TO_DETAIL 매핑 1행 추가), `sanitize-error-message.ts`
  (`isMaskedMarker`/`MASKED_MARKERS` export 승격 + `Object.freeze`) 확인.
- 직접 실행: `npx jest reject-masked-resubmission executions-rerun.service.spec.ts
  workflows.controller.spec.ts` → **3 suites / 68 tests 전부 PASS**(1.15s) — 정지된 캐시가
  아니라 실제로 도는 테스트임을 실측 확인.

## 발견사항

- **[INFO]** 새로 `export` 로 승격된 `isMaskedMarker`/`MASKED_MARKERS`(+`Object.freeze` 하드닝)를 직접 겨냥한 단위 테스트가 없다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (함수 `isMaskedMarker`,
    상수 `MASKED_MARKERS` — 게이트 150·162 부근); 대응 spec 은
    `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (`isMaskedMarker`/
    `MASKED_MARKERS`/`freeze` 문자열 전무 확인, grep 0건)
  - 상세: 이번 PR 은 이 상수·함수를 module-private 에서 `export` 로 승격하고 `Object.freeze`
    로 감쌌다(라운드3 직전 `01_15_47` 리뷰 side_effect INFO 채택분). 그런데 승격 전후 동작을
    직접 검증하는 테스트는 없다 — `isMaskedMarker`는 `reject-masked-resubmission.spec.ts`(및
    `hasMaskedLeaf`)를 통해서만 **간접** 호출된다. 만약 누군가 나중에 `Object.freeze(...)`
    래핑을 무심코 제거하거나(`MASKED_MARKERS as Set<string>).add(...)` 같은 타입 우회로
    변형이 들어와도, 그걸 잡아 줄 캐너리가 코드베이스에 없다. 이 Set 은 egress 마스킹
    (`isMaskedMarker` 자체)과 재제출 거부(`hasMaskedLeaf`) 두 판정기가 **동시에 공유**하는
    싱글턴이라, 변형되면 두 판정기가 같이 조용히 무너진다는 점에서 (이미 side_effect 리뷰가
    지적한) 파급 범위가 넓은 값이다. freeze 자체의 런타임 효과(strict mode 에서
    `.add()` 시도 시 `TypeError`)를 고정하는 캐너리는 저비용으로 이 회귀를 영구히 막는다.
  - 제안: 필수는 아님(freeze 코드 자체는 이미 들어가 있고 즉각적 결함이 아님). 다음에 이
    파일을 손댈 기회에 `sanitize-error-message.spec.ts` 에
    `expect(() => (MASKED_MARKERS as Set<string>).add('x')).toThrow()`(strict mode 전제) 류의
    캐너리 1건을 추가하면 이 하드닝의 회귀를 코드로 고정할 수 있다.

- **[INFO]** `findMaskedResubmissions` 의 `isRecord(rawSource)` 가드 중 "배열이 rawSource 로 들어오는" 분기는 직접 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    함수 `findMaskedResubmissions` (게이트 121 `if (!isRecord(rawSource) || !isRecord(values))
    return [];`); 대응 spec `reject-masked-resubmission.spec.ts` 의 `'null·비객체 raw 를
    안전하게 지나간다'` (게이트 313~316)는 `null`과 문자열 `'nope'` 두 경우만 다룬다.
  - 상세: `isRecord`(`to-record.ts`, 이 PR 이 새로 만든 게 아니라 재사용하는 기존 유틸)는
    배열을 `!Array.isArray(value)` 로 걸러 record 가 아닌 것으로 판정한다. 이론상
    `resolveTriggerParametersRejectingMasked(schema, [1,2,3])` 같은 호출도 안전하게 `[]`(빈
    hit 목록)을 돌려줘야 하는데, 이 정확한 입력 형태(배열 자체가 rawSource)를 겨냥한 케이스가
    없다. `isRecord` 자체가 다른 곳에서 이미 검증된 공유 유틸이라 실질 위험은 낮지만, 이
    가드가 "record 가 아닌 모든 것"을 한 조건으로 묶고 있어 null/string 두 케이스만으로는
    배열 분기가 실제로 같은 코드 경로를 타는지(다른 실패 모드로 새지 않는지)를 이 spec 파일
    스스로는 증명하지 못한다.
  - 제안: 필수 아님. `it.each([null, 'nope', [1,2,3], 42])` 형태로 비-record 케이스를 파라미터화하면 한 줄 추가로 이 분기까지 명시적으로 덮을 수 있다.

CRITICAL/WARNING 급 발견 없음. 이전 두 라운드가 지적한 항목들(검사 시점·타입별 우회·과잉
차단·깊이 경계·스택 안전성·마스커↔판정기 왕복·phase 경계에서의 `coerce_failed` 혼입 방지·
`errors`→`details` 회귀)은 전부 이름이 붙은 캐너리/회귀 테스트로 코드에 고정돼 있고, 방금
실행으로 전부 GREEN 임을 확인했다.

## 관점별 평가

1. **테스트 존재 여부** — 핵심 신규 로직(`reject-masked-resubmission.ts`)에 전용 spec 18개
   케이스, 두 호출부(`executions-rerun.service.spec.ts`/`workflows.controller.spec.ts`)에
   통합 캐너리 각 3건씩 추가됨. 갭 없음.
2. **커버리지 갭** — 위 INFO 2건 외에는 라인/브랜치 수준 갭이 보이지 않는다. `throwIfAny`·
   `hasMaskedLeaf`·`findMaskedResubmissions`·`resolveTriggerParametersRejectingMasked` 모든
   분기가 최소 1개 이상 테스트로 exercised.
3. **엣지 케이스** — 정확 일치 vs 부분 포함, 깊이 상한 경계(`k`/`k+1`), 배열/객체 혼합 중첩,
   스택 안전성(depth 5000), `defaultValue` 과잉 차단 방지, null/비객체 raw 까지 이름 붙은
   캐너리로 明시적으로 다룬다. 매우 높은 수준.
4. **Mock 적절성** — `executions-rerun.service.spec.ts`/`workflows.controller.spec.ts` 모두
   `resolveTriggerParametersRejectingMasked` 자체는 mock 하지 않고 실제 함수를 통해
   통합적으로 검증한다(레포지토리 계층만 mock). `reject-masked-resubmission.spec.ts` 는
   순수 함수 테스트라 mock 이 전혀 없다 — 실제 마스커(`deepRedactSecrets`)를 그대로 태우는
   왕복 통합 테스트까지 포함해 mock 과 실제 동작의 괴리가 매우 낮다.
5. **테스트 격리** — `executions-rerun.service.spec.ts` 는 `beforeEach` 에서 매번 새
   `ExecutionsService` 인스턴스를 생성하므로 `jest.spyOn(service, 'findById')` 가 테스트 간
   누수되지 않는다(인스턴스 자체가 매번 새로 만들어짐). `workflows.controller.spec.ts` 도
   `Test.createTestingModule` 을 통해 매 테스트 독립 모듈을 구성한다. 순수 함수 spec 은
   전역 상태가 없어 격리 문제 자체가 발생할 수 없는 구조.
6. **테스트 가독성** — `[캐너리]`/`[경계]`/`[회귀]`/`[통합]` 태그로 각 테스트가 "무엇을 왜
   막는지"를 이름과 docstring 에 명시한다(어느 라운드의 어떤 리뷰 지적을 고정하는지까지
   주석에 추적 가능). 가독성이 매우 높다.
7. **회귀 테스트** — `errors`→`details` 선존 버그 회귀, `coerce_failed` 혼입 방지 회귀,
   깊이 상한 스택 안전성 회귀 등 세 층위 회귀가 각각 이름 붙은 테스트로 고정됨. 기존 391줄
   짜리 `executions-rerun.service.spec.ts` 스위트(F2 결정 관련 기존 테스트 다수)는 이번 diff
   가 컨텍스트만 건드리고 로직을 바꾸지 않아 유효성 유지.
8. **테스트 용이성** — `resolveTriggerParametersRejectingMasked(schema, rawSource)` 가 순서를
   함수 내부로 캡슐화해(이전 라운드 WARNING 이 지적한 "호출부 복붙" 해소) 두 호출부는 이제
   함수 호출 한 줄 + 봉투별 `catch` 만 남았다 — 새 Manual 경로가 추가돼도 이 함수 하나만
   부르면 되므로 테스트 대상이 한 곳에 집중돼 있다.

## 요약

핵심 신규 유틸(`reject-masked-resubmission.ts`)과 그 spec, 그리고 두 소비처 통합 캐너리
모두 이번 라운드에 새로 발견할 CRITICAL/WARNING 급 테스트 갭이 없을 만큼 성숙하다 — 3라운드에
걸쳐 CRITICAL 1건(boolean 우회)·WARNING 다수(과잉 차단·phase 혼입·자매 발산 등)가 순차적으로
잡히고 매번 이름 붙은 캐너리로 고정돼 왔고, 이번에 직접 실행(`npx jest`)으로 68개 테스트 전부
GREEN 임을 재확인했다. 남은 것은 이번 라운드에 새로 승격된 `isMaskedMarker`/`Object.freeze`
하드닝을 직접 겨냥한 캐너리 부재, 그리고 `isRecord` 비-record 가드의 배열 케이스 미테스트 —
둘 다 실질 위험이 낮은 INFO 수준의 마감 작업이다.

## 위험도

NONE
