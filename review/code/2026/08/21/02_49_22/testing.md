# 테스트(Testing) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (7라운드째 재검토)

## 검토 방법

`origin/main...HEAD` 누적 diff(79 파일)는 `00_03_57`~`02_29_01` 6개 라운드가 이미 CRITICAL 1건
(boolean 완전 우회) + WARNING 다수를 잡아 처분 완료한 상태다(각 라운드 RESOLUTION.md 로 확인).
이번 라운드는 그 위에 CHANGELOG·spec 정정·plan 동기화만 추가된 지점이라, 프롬프트가 diff 를
생략한 핵심 실코드 5개 파일(`reject-masked-resubmission.ts`/`.spec.ts`,
`executions-rerun.service.spec.ts`, `workflows.controller.spec.ts`,
`masked-reject-callers-guard.ts`/`masked-reject-callers.spec.ts`)을 `Read`/`git diff` 로 직접
열어 실물 대조했고, 관련 스펙 7개 스위트를 직접 실행해 **168/168 통과**를 확인했다:

```
Test Suites: 7 passed, 7 total
Tests:       168 passed, 168 total
```

## 발견사항

- **[INFO]** `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions` 에 `rawSource`
  자체가 **배열**인 케이스의 전용 단언이 없다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:313-316`
    (`'null·비객체 raw 를 안전하게 지나간다'` — `null`·문자열만 커버)
  - 상세: `findMaskedResubmissions`(`reject-masked-resubmission.ts:121`)의 `isRecord(rawSource)`
    검사는 배열도 `false`로 판정해 null/문자열과 동일한 조기 반환 경로를 타므로 실질 위험은
    낮다. 이미 `02_29_01` 라운드 미조치 INFO(#8)로 저위험 판정·보류된 항목이라 재지적이 아니라
    확인 차원으로 남긴다.
  - 제안: 조치 불요. 다음에 이 스펙을 편집할 기회가 있으면 `rejectedFields(schema, [1,2,3])`
    한 줄 추가로 경계를 명시화할 수 있다.

- **[INFO]** phase 경계 트레이드오프(①raw 검사 vs ②resolve 후 검사)가 **구조적으로만** 보장되고
  전용 회귀 테스트가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:62-72`
    (`resolveTriggerParametersRejectingMasked`)
  - 상세: "①을 통과한 뒤 무관한 필드의 진짜 타입 오류로 resolve 가 `coerce_failed` 를 던지면
    ②(JSON 문자열 안의 마커)는 실행되지 않는다"는 트레이드오프는 docstring(69~89행)에 명시돼
    있고 현재는 `resolveTriggerParameters(schema, rawSource)` 호출이 던지면 다음 줄(②)에
    자바스크립트 실행 흐름상 도달 자체가 불가능하므로 자명하게 보장된다. 다만 이 자명성은
    **현재 구현 형태에 의존**한다 — 향후 누군가 "안내를 합쳐서 던지자"며 ①/②를 try/catch 로
    묶는 리팩터를 하면(`01_15_47` testing INFO-3, `00_39_27` W2 가 실제로 "합치자"는 제안을
    받았던 지점) 이 트레이드오프가 조용히 사라지거나 반대로 `masked_value_resubmitted` 가
    `coerce_failed` 뒤에 숨는 회귀가 나도 잡아줄 테스트가 없다.
  - 제안: 조치 불요(스코프 밖). 향후 그 리팩터가 실제로 제안되면, "raw hit 없음 + resolve 중
    무관 필드 coerce_failed + JSON 문자열 안 마커" 조합을 실행해 `masked_value_resubmitted` 가
    나오지 않고 `coerce_failed` 만 나옴을 고정하는 캐너리를 함께 추가할 것.

- **[INFO]** 이번 기능 전용 e2e/supertest 스모크 부재 — 이미 트래킹된 이월 항목, 상태 변화 없음 확인
  - 위치: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`,
    `codebase/backend/src/modules/workflows/workflows.controller.spec.ts` (둘 다 unit, `nodeRepo`/
    `engine`/`GlobalExceptionFilter` 는 각각 목)
  - 상세: 컨트롤러/서비스 unit 스펙이 예외 throw 와 응답 바디(`code`/`details[]`) 구성까지는
    직접 단언하지만, 실제 `GlobalExceptionFilter` 를 통과한 HTTP 왕복(요청→400 바디)을 검증하는
    e2e 는 없다. `01_15_47` RESOLUTION 미조치 목록(#1)에서 "선택, 필수 아님"으로 이미 판정된
    항목이며, 이번 라운드까지 상태 변화가 없어 재확인만 한다.
  - 제안: 조치 불요.

## Mock 적절성 · 테스트 격리 · 가독성 (긍정 확인)

- `executions-rerun.service.spec.ts`/`workflows.controller.spec.ts` 신규 3~4개 테스트 모두 파일
  최상단 `beforeEach` (각각 큐/목 재초기화, `Test.createTestingModule` 재컴파일)를 그대로
  따라 테스트 간 상태 누수가 없다. 기존 관례(`getOneQueue` 시딩, `nodeRepo.findOne.mockResolvedValue`)와
  일관돼 새 테스트가 기존 스타일에서 튀지 않는다.
- `reject-masked-resubmission.spec.ts` 는 `nestObj`/`nestArr` 같은 **모델 기반** 경계 테스트와
  `deepRedactSecrets` 실제 산출물을 그대로 먹이는 **왕복 통합 테스트**(239~262행)를 함께 갖춰,
  마스커↔판정기 재귀 구현이 각자 진화해도(상수만 공유) 발산을 잡는다 — mock 이 아니라 실제 협력
  모듈을 태우는 선택이 적절하다.
- `masked-reject-callers.spec.ts` 의 세 번째 캐너리(72~95행)는 "가드가 위반 0을 보고하는 것"이
  "가드가 실제로 탐지 능력이 있는 것"과 다르다는 점을 정확히 짚어, `os.tmpdir()` 에 합성
  위반/정상 파일을 만들어 실제 탐지 여부를 검증한다 — vacuous-pass 를 스스로 방지하는 드문
  좋은 패턴이다(리뷰 히스토리에 "가드가 항상 GREEN 인 이유가 탐지를 멈춰서"였던 반증 사례가
  이미 있었고, 그 교훈이 이 테스트에 반영돼 있다).
- `reject-masked-resubmission.spec.ts` 의 각 `it` 블록·JSDoc 주석이 "왜 이 케이스가 존재하는가"
  (어느 라운드의 어느 CRITICAL/WARNING 을 고정하는지)를 명시해 의도가 코드만으로 읽힌다.

## 회귀 테스트

- `errors` → `details` 봉투 교정은 `executions-rerun.service.spec.ts` 의 신규 회귀 테스트
  (`'[회귀] 거부 응답이 details[] 로 필드별 코드를 싣는다 (errors 키 아님)'`)가
  `body.errors` 를 `toBeUndefined()` 로 명시적으로 부정 단언해, "필드가 있으면 통과"가 아니라
  "옛 키가 사라졌는지"까지 고정한다.
- boolean 완전 우회(00_03_57 CRITICAL)를 되돌리는 리팩터가 나와도 `'[캐너리] boolean 필드의
  마커도 거부한다'`(65~71행)가 즉시 RED 를 내도록 구성돼 있다.
- 기존 `resolveTriggerParameters` 자체 스펙(`resolve-trigger-parameters.spec.ts`)은 로직 변경
  없이 매핑 테이블 케이스 1건만 추가돼 기존 스위트가 여전히 유효함을 실행으로 확인했다.

## 요약

핵심 신규 로직(`reject-masked-resubmission.ts`)과 그 캐너리 가드(`masked-reject-callers-guard.ts`)
모두 경계값(정확 일치·깊이 상한·상한+1·혼합 중첩)·타입별 우회 회귀(boolean/number)·왕복 통합
(실제 마스커 산출물)·가드 자기 탐지력(합성 fixture)까지 다층으로 커버돼 있고, 두 Manual 진입점
(`executions.service.ts`/`workflows.controller.ts`)의 unit 스펙도 신규 예외 경로·에러 봉투
(`errors`→`details`)·legacy `input.parameters` 접기 경로를 각각 캐너리로 고정한다. 관련 7개
스펙 스위트를 직접 실행해 168/168 통과를 확인했고, mock 은 기존 파일 패턴을 그대로 따르며 매
테스트가 `beforeEach` 로 격리돼 있다. 6라운드에 걸쳐 CRITICAL 1건·WARNING 다수가 이미 실코드
재대조로 해소 확인된 상태이고, 이번 라운드에서 내가 직접 대조한 결과도 그 결론과 일치한다.
남은 갭은 전부 이미 이전 라운드가 저위험으로 판정·보류한 항목(배열 rawSource 케이스, phase
트레이드오프의 구조적 보장, 전용 e2e 부재)이며 재지적이 아니라 확인 차원의 INFO 로만 남긴다.

## 위험도

NONE
