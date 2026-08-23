# 테스트(Testing) Review — masking-gate-consolidation (재검토, 14_46_46)

## 검토 범위 메모

이전 라운드(`14_23_44`)의 testing 리뷰가 WARNING 2건 — (1) 신설 헬퍼
`redactStoredFieldsForResponse`/`redactNodeExecutionRow` 의 co-located 유닛 테스트
부재, (2) `maskIfPresent` 의 `undefined` 방어 분기 미검증 — 을 냈고, 이번 diff 는
`redact-stored-error.spec.ts` 에 두 신규 `describe` 스위트(+12 케이스, 29 케이스로)를
추가해 그 WARNING 을 직접 겨눈다. 아래는 그 추가분을 재검증한 결과다.

**실제로 코드를 실행해 검증**했다(`Read` 만이 아니라):
- `npx jest src/shared/utils/redact-stored-error.spec.ts` — 29/29 GREEN.
- `npx jest src/modules/executions/executions.service.spec.ts src/modules/executions/background-runs/background-runs.service.spec.ts` — 71/71 GREEN (회귀 없음).
- plan 이 보고한 뮤테이션 M1(컬럼 마스킹 누락)·M2(identity 보존 파기)를 `redact-stored-error.ts` 에
  직접 재현해 이 spec 파일 단독으로 돌렸다 — M1 **2 RED**, M2 **2 RED**, 둘 다 `tsc --noEmit`
  클린. plan/WARNING #1 이 보고한 수치와 정확히 일치한다.
- plan 이 언급한 M3(두 헬퍼를 뭉개는 회귀 — 노드 헬퍼가 부재를 `null` 로 정규화)도 재현 —
  **1 RED**, `tsc` 클린. 보고 수치와 일치.
- 뮤테이션은 전부 `cp` 백업 후 적용, 검증 뒤 `cp` 로 원복(파일 diff 0 확인, `git status` 로
  워크트리 오염 없음 확인).

## 발견사항

- **[WARNING]** `maskIfPresent` 의 `value == null` (loose equality) 방어 분기 중 **`null` 쪽
  절반이 어떤 테스트로도 실행되지 않는다** — 신설 스위트가 `undefined` 만 주입한다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:127`(`maskIfPresent` 선언),
    `:131`(`return value == null ? value : (mask(value) ?? value);`) /
    `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:289`(`redactNodeExecutionRow`
    "부재 컬럼을 `null` 로 정규화하지 않는다" 테스트 — `undefined` 만 주입)
  - 상세: 직접 뮤테이션으로 확인했다 — `value == null` 을 `value === undefined` 로 좁혀도
    (즉 `null` 값에 대한 방어를 제거해도) 이 spec 파일의 29개 테스트와
    `executions.service.spec.ts`+`background-runs.service.spec.ts` 의 71개 테스트 **총 100개
    전부 GREEN** 을 유지했다(`tsc --noEmit` 도 클린). docstring(게이트 118~121, 124~125)은
    "TypeORM 이 런타임에 `undefined` 를 줄 수 있는 경로에 대한 방어"라고 `undefined` 만
    명시하므로 의도된 범위 밖일 수 있으나, 코드 자체는 `null` 도 같은 분기로 처리하도록
    작성돼 있고(loose equality), 이 PR 이 "신설 SoT 헬퍼의 판별력을 직접 고정한다"고
    명시적으로 선언한 파일이라 그 약속의 절반(코드가 실제로 방어하는 두 값 중 하나)이
    캐너리 없이 남아 있다. 이 파일이 막으려는 결함 클래스("한쪽만 검증하면 다른 쪽이
    조용히 갈린다", 게이트 111~112 자신의 원칙)와 정확히 같은 형태의 잔여 갭이다.
  - 제안: 기존 `redactNodeExecutionRow` "부재 컬럼 보존" 테스트 옆에 `inputData: null`(또는
    `error: null`) 케이스를 하나 추가하거나, `it.each([[undefined], [null]])` 로 두 값을
    한 번에 파라미터화한다. 위험도는 낮다(엔티티가 non-null 로 선언돼 정적으로는 도달
    불가) — 머지 차단 사안은 아니다.

- **[INFO]** (양성 확인) 이전 라운드 WARNING #1·#2 는 이번 diff 에서 실제로 해소됐다 —
  실행으로 재확인
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:183`
    (`describe('redactStoredFieldsForResponse', ...)`), `:243`
    (`describe('redactNodeExecutionRow', ...)`)
  - 상세: `grep` 만이 아니라 `jest` 를 직접 돌려 29/29 GREEN 을 확인했고, plan 이 보고한
    M1/M2 뮤테이션 수치(각 2 RED)도 이 파일 단독 실행으로 재현해 일치를 확인했다. 두
    스위트 모두 (a) 컬럼별 개별 마스킹(`it.each`), (b) 세 컬럼 동시 마스킹, (c) 부재→`null`
    정규화(`redactStoredFieldsForResponse`) vs 부재 보존(`redactNodeExecutionRow`) 대비를
    각각 전용 케이스로 고정해, 이 PR 이 없애려던 "회귀가 여러 호출부에 흩어진 테스트를
    거쳐야만 드러난다"는 문제를 테스트 층에서도 실제로 해소했다.
  - 제안: 없음(참고 기록).

- **[INFO]** `redactNodeExecutionRow` 의 "각 컬럼이 독립적으로 복제를 유발한다" 는
  `it.each` 로 3개 컬럼을 각각 겨누는데, 그 대칭인 "각 컬럼이 독립적으로 `undefined` 를
  보존한다" 는 `it.each` 화되지 않고 `inputData`+`error` 를 한 테스트에 동시 주입한다
  (`outputData` 의 단독 `undefined` 케이스는 없음)
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:276`(`it.each` "leak
    → 복제" 3케이스) vs `:289`(단일 `it`, `inputData`/`error` 동시)
  - 상세: 위 컬럼별 복제 판정 테스트가 "한 컬럼만 보면 나머지 둘이 copy-on-change 판정에서
    빠져도 통과한다"는 이유로 `it.each` 를 명시적으로 택했는데(주석 274~275줄), 그 반대
    분기(부재 보존)에는 같은 논리를 적용하지 않아 `outputData` 만 단독으로 `undefined` 인
    경우가 커버되지 않는다. `maskIfPresent` 가 컬럼마다 독립 호출되므로 실질 위험은
    낮지만, 파일 자신의 "각각 단언한다" 원칙과 스타일이 갈린다.
  - 제안: 급하지 않음 — 위 WARNING 수정과 함께 `it.each([['inputData'], ['outputData'],
    ['error']])` 형태로 통일하면 두 갭을 한 번에 메울 수 있다.

- **[INFO]** Mock 사용 없음 — 적절하다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` 전체
  - 상세: 대상이 순수 함수(부작용 없음, 외부 의존성 없음)라 mock/stub 이 전혀 필요 없고
    실제로 쓰이지 않는다. `redactStoredDataForResponse`/`redactStoredErrorForResponse` 를
    실제 구현으로 호출해 통합 동작까지 함께 검증하므로 mock 사용에 따른 실동작 괴리
    문제도 없다.
  - 제안: 없음.

- **[INFO]** 테스트 격리 — 문제 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:245`
    (`row = (over = {}) => ({...})` 팩토리)
  - 상세: 공유 mutable fixture 대신 매 테스트가 `row()` 팩토리로 새 객체를 만든다.
    `beforeEach`/`afterEach`/모듈 스코프 `let` 이 전혀 없어 테스트 간 상태 누출이
    구조적으로 불가능하다. `it.each` 도 각 케이스가 독립된 입력을 받아 순서 의존성이
    없다(직접 실행으로 확인 — 순서 무관하게 29/29 GREEN).
  - 제안: 없음.

## 회귀 테스트 (기존 테스트 유효성)

- `executions.service.spec.ts`/`background-runs.service.spec.ts` 의 표면별(findById·
  findByWorkflow·getChain·stop·toNodeExecutionDto) leaky-value 캐너리와 copy-on-change
  참조 동일성 단언은 헬퍼 추출 이후에도 **직접 실행으로 71/71 GREEN** 확인 — 4개 호출부
  교체가 동작을 바꾸지 않았다는 이전 라운드 판단이 이번에도 재확인된다.
- `redactStoredErrorForResponse`/`redactStoredDataForResponse` 의 기존 describe 블록(캐너리
  포함)은 diff 로 손대지 않았고 그대로 GREEN.

## 테스트 용이성 (구조)

신설 헬퍼 둘 다 순수 함수로 `redact-stored-error.ts` 라는 leaf 유틸 모듈에 export 돼
있어 DI·mock 없이 직접 호출 가능하다 — 통합 시도가 서비스 레이어 안에 인라인 헬퍼로
남았더라면 강제됐을 TypeORM/QueryBuilder mock 부담이 이번 추출로 사라졌다. 이 리팩터
자체가 테스트 용이성을 개선한 사례다.

## 요약

이전 라운드 testing WARNING 2건은 실행 검증(29/29 GREEN, 71/71 회귀 GREEN, M1/M2/M3
뮤테이션 재현 — 각 2/2/1 RED, `tsc` 클린)으로 실제 해소를 확인했다. 다만 재검증 과정에서
그 신설 스위트 자체에 좁지만 실재하는 새 갭을 하나 직접 뮤테이션으로 찾았다 —
`maskIfPresent` 의 `value == null` 방어가 `undefined`/`null` 두 값을 같은 분기로 처리하는데
테스트는 `undefined` 만 주입해 `null` 쪽 방어를 좁혀도(`=== undefined` 로) 100개 테스트
전부 GREEN 을 유지한다. 엔티티가 non-null 타입이라 정적으로는 도달 불가능한 경로라
위험도는 낮으나, "한쪽만 검증하면 다른 쪽이 조용히 갈린다"는 이 파일 자신의 설계
원칙이 정확히 이 지점에서 절반만 지켜졌다는 점에서 기록할 가치가 있다. 그 외 mock
적절성·테스트 격리·회귀·테스트 용이성 전 항목에서 결함을 발견하지 못했다.

## 위험도

LOW
