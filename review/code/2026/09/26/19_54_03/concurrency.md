# 동시성(Concurrency) 리뷰 — request-body-guard

## 발견사항

- **[INFO]** 검증-스킵 목록이 지역 변수 → 모듈 top-level export 상수로 승격됐으나 `Object.freeze` 로 불변화되어 동시 요청 간 공유에 안전
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts` — `UNVALIDATED_METATYPES` 선언(18번째 줄 부근), 소비처 `toValidate()`(92번째 줄 부근)
  - 상세: `CustomValidationPipe` 는 `@Injectable()`(scope 미지정 → Nest 기본 singleton)이라 애플리케이션 전역에서 인스턴스 하나를 모든 요청이 공유한다. 이전에는 `toValidate()` 호출마다 지역 배열을 새로 만들어 매 요청이 완전히 독립적이었는데, 이번 diff 는 그 배열을 모듈 스코프 `export const` 로 승격했다 — 여러 동시 요청(Node 이벤트 루프에서 `await validate(...)` 구간마다 인터리빙 가능)이 **동일한 배열 객체**를 참조하게 된다. 다만 `Object.freeze()` 로 얼려져 있고 소비 코드는 `.includes()` 읽기만 하므로, 실제로 동시 접근에 의한 경쟁 조건이나 오염 경로는 없다. 타입 단언으로 `.push()` 해 우회하는 경우도 `Object.freeze` 는 strict mode 에서 던지므로 조용한 손상은 아니다.
  - 제안: 조치 불요 — 이미 `Object.freeze` 로 방어됨(리뷰 1R 조치, 커밋 `8bc7e8f19`). 동시성 관점에서 추가로 요구할 것 없음.

- **[INFO]** `CustomValidationPipe.transform()` 은 인스턴스 필드를 쓰지 않는 순수 async 메서드 — 동시 요청 간 상태 오염 경로 없음
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts` `transform()`, `flattenErrors()`
  - 상세: singleton 파이프임에도 `transform()`/`flattenErrors()`/`joinPath()` 모두 인자와 지역 변수(`object`, `errors`, `details`, `out`)만 사용하고 `this.xxx` 형태의 가변 인스턴스 상태를 두지 않는다. `await validate(...)` 로 인해 여러 요청의 `transform()` 호출이 이벤트 루프에서 인터리빙되어도 서로 간섭할 공유 가변 상태가 없다. `await` 누락도 없다.
  - 제안: 조치 불요 — 현행 무상태(stateless) 설계 유지 권장.

- **[INFO]** 신설 가드(`scanRequestBodyAdvertised` 등)는 동기 함수이며 호출마다 지역 변수로 결과를 누적 — 스레드/이벤트 루프 경합 표면 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` `scanRequestBodyAdvertised()`(로컬 `violations`/`checked`/`unschematized`), `codebase/backend/src/shared/testing/swagger-probe.ts` `bodyArgIndexes()`
  - 상세: reflection 메타데이터를 읽기만 하는 순수 동기 로직이고, 모든 누적 변수가 함수 로컬이라 재진입·동시 호출에도 안전하다. 테스트 쪽(`request-body-advertised.spec.ts`)의 `beforeAll(async () => { ... }, 120_000)` 도 컨트롤러 로드를 정상적으로 `await` 하고, Jest 는 같은 `describe` 블록의 `it` 을 `beforeAll` 완료 후 순차 실행하므로 `routes`/`controllerCount` 에 대한 레이스는 없다.
  - 제안: 조치 불요.

- **[INFO — 프로세스/환경 관측, 코드 결함 아님]** 리뷰 시점에 워킹트리 파일이 이 diff 가 반영하는 커밋 상태와 다르게 **미커밋 상태로 변형**되어 있음을 관측
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts` (git status: `M`, 미커밋)
  - 상세: 프롬프트에 첨부된 unified diff(커밋 히스토리 기준)는 `UNVALIDATED_METATYPES` 가 `String, Boolean, Number, Array, Object` 5개 원소를 담고 있으나, 이 세션이 파일을 직접 `Read` 했을 때 디스크 상태는 `Number` 가 빠진 4개 원소(`String, Boolean, Array, Object`)였다(`git diff` 로 확인, `-  Number,` 한 줄 제거된 미커밋 변경). 본 리뷰는 이 파일을 직접 고치지 않았고 어떤 mutation 도 만들지 않았다 — 병렬 fan-out 규약이 경고한 대로 다른 reviewer(또는 동시 프로세스)가 같은 워크트리에서 가설 검증용으로 만든 미커밋 변경으로 추정된다. 이 자체는 동시성 코드 결함이 아니라 **리뷰 인프라의 공유 워크트리 오염** 사례이므로 그대로 보고한다 — 되돌리지 않았다(`git checkout`/`restore` 금지 규약, 그리고 이 변경을 만든 주체가 아니므로 임의로 `cp` 복구도 하지 않았다).
  - 제안: 통합 SUMMARY/orchestrator 가 이 세션 종료 후 `git status --short`(특히 `codebase/backend/src/common/pipes/validation.pipe.ts`)로 워크트리가 committed 상태와 일치하는지 재확인 권장. 실제 파일 판정(예: 다른 reviewer 의 "Number 대조군" 관련 서술)은 이 미커밋 상태의 영향을 받을 수 있다.

## 요약

이번 diff 의 실질 코드 변경은 (1) `CustomValidationPipe` 의 검증-스킵 타입 목록을 지역 배열에서 `Object.freeze` 된 모듈 export 상수로 승격한 순수 리팩터, (2) 순수 동기 reflection 기반 정적 가드(`request-body-advertised-guard.ts`)와 그 테스트, (3) 기존 `bodyParamDesignType` 에서 `bodyArgIndexes` 를 추출한 헬퍼 리팩터, (4) 문서/plan/spec 산출물이다. async/await, 락, 스레드 풀, 커넥션 풀, 이벤트 루프 블로킹에 관련된 코드 변경이 없고, 유일하게 "여러 요청이 공유하는 전역 상태"에 해당하는 `UNVALIDATED_METATYPES` 는 `Object.freeze` 로 불변화되어 있어 동시 요청 간 경쟁 조건 위험이 없다. `CustomValidationPipe` 는 singleton 이지만 인스턴스 가변 상태를 두지 않는 무상태 설계를 유지한다. 신설 가드/헬퍼는 Jest 단일 프로세스에서 동기 실행되는 정적 분석 코드로 스레드 안전성 문제와 무관하다. 다만 리뷰 도중 `validation.pipe.ts` 가 diff 가 기술하는 committed 상태와 다르게 미커밋 변형(`Number` 원소 누락)되어 있음을 관측했다 — 이는 이 PR 의 동시성 결함이 아니라 병렬 리뷰 fan-out 특유의 공유 워크트리 오염 신호이므로 별도로 보고한다.

## 위험도

NONE
