# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (04_20_10)

## 검토 범위

이번 diff 는 이미 8라운드(`00_03_57` ~ `03_14_16`)에 걸쳐 코드 리뷰·수정이 반복된 브랜치의
최종 상태다. 실질 프로덕션 코드는 다음 8개 파일이고, 나머지(CHANGELOG, plan/spec 문서,
`review/**`·`review/consistency/**` 산출물)는 이전 라운드들이 이미 검토·처분한 기록을 이번
diff 가 그대로 실은 것이라 문서 자체의 유지보수성(가독성·구조) 관점에서만 훑고 코드 발견사항
대상에서는 제외했다.

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규)
- `codebase/backend/tsconfig.build.json`

전작 리뷰가 지적했던 항목들을 실물 코드로 재확인했다: 호출부 중복(find+length+throw 3줄
복붙)은 `resolveTriggerParametersRejectingMasked` 캡슐화로 해소, `isPlainRecord` 재구현은
`to-record.ts` 의 `isRecord` 재사용으로 해소(`reject-masked-resubmission.ts:11`), `MASKED_MARKERS`
의 "freeze 했다던 `Set`" 플라시보는 `readonly string[]` + `Object.freeze` 로 실제 불변화되고
런타임 캐너리(`sanitize-error-message.spec.ts` "MASKED_MARKERS 불변성")로 고정됨을 확인했다.
`eslint`(대상 8개 프로덕션 파일)도 이슈 없이 통과한다.

## 발견사항

- **[INFO]** `findMaskedResubmissions` 가 같은 타입(`unknown`)의 두 위치 인자
  `rawSource`/`values` 를 순서로만 구분한다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:115-119`
    (`export function findMaskedResubmissions(schema, rawSource, values)`), 호출부는
    같은 파일 `:62`(`findMaskedResubmissions(schema, rawSource, rawSource)`)와 `:72`
    (`findMaskedResubmissions(schema, rawSource, resolved)`)
  - 상세: 두 인자 모두 타입이 `unknown` 이라 컴파일러가 순서 실수를 잡아주지 못한다. 함수의
    의미상 `rawSource` 는 "대상 키 선정용"(`Object.prototype.hasOwnProperty.call(rawSource,
    def.name)`), `values` 는 "값 검사용"(`hasMaskedLeaf(values[def.name], 0)`)으로 역할이
    다른데 이름만으로 구분된다. 62번째 줄 호출은 두 인자에 같은 값을 넣어 우연히 안전하고,
    72번째 줄 호출만 실제로 다른 값이 들어간다 — 두 인자를 바꿔도 타입 에러 없이 컴파일되고,
    ①(raw phase)에서는 `hasOwnProperty` 판정만 영향받아 조용히 잘못된 필드를 검사하게 된다.
    JSDoc(`:101-102`)이 "왜 둘을 따로 받는지" 근거는 충분히 남겨 두었으나, 타입 레벨 보호는
    없다.
  - 제안: 필수는 아님(테스트가 이미 정상 동작을 고정하고 있고, 함수가 module 내부에서만
    두 곳에서 호출돼 실사용 반경이 작다). 여지가 있다면 `{ rawSource, values }` 형태의 named
    옵션 객체로 바꾸면 호출부에서 인자 순서 실수가 원천 차단된다. 이번 PR 스코프에서 강제할
    사안은 아니다.

- **[INFO]** `ExecutionsService.reRun` 이 137줄(§420-556)로 이미 길고 이번 변경이 그 안의
  "입력 해석" 책임을 조금 더 무겁게 만든다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 메서드
    (§420 시작, §556 종료), 신규 마스킹 검사 호출은 §480(`resolveTriggerParametersRejectingMasked`
    호출)과 §84-97(catch 블록의 `details` 변환)
  - 상세: `reRun` 은 이미 (1) 404/권한 체크, (2) dry-run pre-flight, (3) chain depth 체크,
    (4) 입력 해석(원본 재사용 vs `inputOverride` 검증 — 이제 raw+resolve 2단계 마커 거부까지
    포함), (5) 실행 트리거, (6) audit log 기록까지 6가지 책임을 한 메서드 안에서 순차
    수행한다. 신규 로직 자체는 함수 호출 한 줄로 얇지만(전작 WARNING이 캡슐화로 해소된
    결과), 조건 분기가 계속 누적되는 구조라는 점은 그대로다. 이 구조는 이 PR 이전부터
    있었고 이번 PR 의 신규 결함은 아니다.
  - 제안: 이번 PR 스코프에서 강제할 사안 아님(이전 라운드에서도 동일하게 판단·기록됨).
    다음에 `reRun` 을 손댈 일이 생기면 입력 해석 블록(§484-519 상당)을 private 헬퍼로
    추출하는 것을 고려.

- **[INFO]** `workflows.controller.ts` 의 `execute` 메서드 안, 신규 한국어 인라인 주석과
  바로 아래 기존 영어 인라인 주석이 같은 `try/catch` 블록에 공존한다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:314-317`(신규,
    한국어 — "마스킹된 값이 그대로 재제출됐는가...") 바로 아래 `:320-322`(기존, 영어 —
    "`details` so GlobalExceptionFilter surfaces the per-field breakdown...")
  - 상세: 이 저장소 최근 커밋들은 서술형 근거 주석을 한국어로 쓰는 쪽으로 수렴하는
    추세인데(이번 diff 의 다른 신규 주석 전부 한국어), 이 블록만 언어가 섞여 다음에 이
    블록을 여는 사람이 어느 언어로 이어써야 할지 헷갈릴 수 있다. 이번 diff 가 새로 만든
    문제는 아니다(영어 줄은 컨텍스트 라인, 미변경) — 이전 라운드에서도 "이월 INFO, 이번
    diff 이탈 아님" 으로 동일 판단됨.
  - 제안: 조치 불요. 다음에 이 블록을 편집할 기회가 있으면 함께 한국어로 통일 검토.

## 요약

핵심 신규 모듈(`reject-masked-resubmission.ts`, 91줄)은 책임이 하나이고(raw→resolve 2단계
검사를 캡슐화), 순환 복잡도가 낮으며(중첩 최대 2단, `hasMaskedLeaf` 재귀도 얕은 분기),
매직 넘버 없이 기존 `MAX_REDACT_DEPTH` 상수를 재사용한다. `trigger-parameter.types.ts` 의
신규 열거값·매핑 추가는 기존 3항목과 동일한 네이밍 컨벤션(`snake_case` reason ↔
`UPPER_SNAKE_CASE` code)을 그대로 따르고 `coerce_failed` 를 재사용하지 않기로 한 이유를
doc comment 로 남겨 향후 오분기를 막았다. 전작 리뷰가 지적한 두 건의 실질 유지보수성
결함 — 두 호출부의 3줄 복붙, `isPlainRecord` 재구현 — 은 이번 상태에서 실코드로 재확인 시
모두 해소되어 있다(`resolveTriggerParametersRejectingMasked` 캡슐화 / `isRecord` 재사용).
신규 repo-guard(`masked-reject-callers-guard.ts`)는 정규식에서 AST 파서 기반으로 전환해
판정 로직이 오히려 더 단순해졌고(식별자 위치 + element-access 문자열 두 갈래), 소비
spec 과 순수 로직이 분리돼 있어 가독성이 좋다. 테스트(신규 3개 spec 파일)는 경계값·회귀·
왕복 통합까지 캐너리 태그로 의도를 명시해 다루므로 가독성이 높고, 8라운드에 걸친 리뷰
이력이 코드 안에 근거로 남아 있어 "왜 이렇게 짰는가" 를 다음 사람이 추적하기 쉽다. 이번
독립 재검토에서 새로 발견한 것은 인자 순서 혼동 여지가 있는 동일-타입 위치 인자 하나뿐이며
(INFO, 필수 아님), 이는 실사용 반경이 작고 테스트로 이미 뒷받침된다. CRITICAL/WARNING 은
없다.

## 위험도

LOW
