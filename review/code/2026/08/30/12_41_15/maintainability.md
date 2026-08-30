# 유지보수성(Maintainability) Review

## 리뷰 범위

코드 변경(유지보수성 관점 실질 검토 대상):
- `codebase/backend/src/common/__test-utils__/source-scan.ts` — `hasRawUpdateReturning` 신설
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 발견형 구조 가드 `describe` 신설
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` — 타입 인자 정정 + 주석 보강
- `plan/in-progress/update-returning-tuple-shape.md` — plan 서술(코드 아님, 보조 검토)

`review/consistency/2026/08/30/12_17_21/*`(파일 5~12)는 별도 워크플로가 생성한 신규 산출물(리포트 md/json)이라 애플리케이션 코드가 아니므로 본 관점 리뷰에서는 대상 밖으로 처리한다.

뮤테이션 검증은 수행하지 않았다(정적 리딩만으로 충분히 판정 가능한 규모).

### 발견사항

- **[WARNING]** `discover()` (전체 `src/**` 재귀 스캔 + 파일별 정규식 판정, 813개 이상 파일)가 같은 스펙 파일 안에서 캐시 없이 3번 반복 호출된다
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:193`, `:208`, `:220` (각각 `discover()` 호출 지점), 정의는 `:184`
  - 상세: `discover()` 자체가 `listSources(SRC)` 로 재귀 디렉터리 탐색 후 각 파일을 `readFileSync` + `hasRawUpdateReturning` 정규식 검사한다. 이 전체 스캔이 `it()` 세 곳(발견-미가드 검증·죽은 allowlist 검증·vacuity 검증)에서 각각 새로 실행돼, 동일한 고비용 작업이 그대로 3배가 된다. 첫 번째 테스트는 내부에서 `discover()` 로 얻은 각 파일을 다시 `readFileSync` 해 `countCalls` 를 계산하므로 발견된 파일에 한해 I/O 가 한 번 더 겹친다.
  - 제안: `beforeAll(() => { discovered = discover(); })` 로 한 번만 계산해 세 `it()` 가 공유하게 하면 테스트 스위트 실행 시간과 코드 중복을 동시에 줄인다. (자매 파일 `assert-row-array.spec.ts` 도 같은 패턴이면 함께 검토할 가치가 있다.)

- **[INFO]** `SRC` 상수가 같은 파일 안에서 두 `describe` 블록에 동일하게 재선언된다
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:54`(기존, 이번 diff 밖) 와 `:136`(이번 diff 신설)
  - 상세: 두 값 모두 `join(__dirname, '..', '..')` 로 완전히 동일하다. 파일-스코프 상수 하나로 합칠 수 있는 사소한 중복이다. 다만 자매 파일 `assert-row-array.spec.ts:55` 도 같은 지역 선언 패턴을 쓰고 있어(파일 간 중복은 기존 컨벤션), 이번 지적은 "같은 파일 내" 중복에 한정된다.
  - 제안: 급하지 않음. 세 번째 `describe` 가 생기는 시점에는 파일 상단으로 hoist 를 고려.

- **[INFO]** allowlist 사유 최소 길이 `20` 이 이름 없는 리터럴이다
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:215` (`why.trim().length < 20`)
  - 상세: 테스트 설명(`'허용목록의 모든 항목에 사유가 적혀 있다'`)이 의도를 충분히 전달하긴 하지만, `20` 이라는 임계값 자체의 근거는 코드에 없다. 다른 팀원이 이 값을 조정할 때 "왜 20인가"를 재구성해야 한다.
  - 제안: `const MIN_REASON_LENGTH = 20;` 로 이름을 붙이면 의도가 코드에 남는다. 우선순위는 낮음.

- **[INFO]** 새로 추가된 문서(JSDoc/인라인 주석)가 코드 본문보다 훨씬 길다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:61-92`(`hasRawUpdateReturning`, 문서 32줄 vs 함수 본문 12줄), `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:29-35`(주석 7줄 vs 변경 코드 1줄)
  - 상세: 이 저장소는 이미 같은 파일의 `stripComments`/`countCalls` 에도 동일하게 "왜"를 장문으로 남기는 컨벤션을 확립해 두고 있다(과거 회귀를 근거로 든 표·이력 인용). 이번 추가는 그 기존 패턴을 그대로 따른 것이라 **일관성 위반은 아니다**. 다만 순수 가독성만 보면 함수 하나를 이해하려 30줄 이상의 배경 설명을 읽어야 하는 진입 장벽은 존재한다.
  - 제안: 조치 불요(기존 컨벤션 준수). 향후 이 컨벤션 자체를 논의한다면 "판정 축"·"의도적으로 안 보는 것" 같은 상위 개념만 남기고 이력 서술은 plan 문서 링크로 대체하는 방향도 검토 가능.

- **[INFO]** `plan/in-progress/update-returning-tuple-shape.md` 의 완료 배너가 매우 길지만(약 35줄), 이 저장소의 plan 문서는 이미 예측/실측 표·뮤턴트 표·postmortem 을 항목마다 남기는 확립된 관례를 따른다. 신규 이탈 없음. 조치 불요.

## 요약

리뷰 대상 코드(신규 `hasRawUpdateReturning`, 신규 발견형 구조 가드 `describe`, `kb-stats.helper.ts` 타입 정정)는 네이밍·함수 길이·중첩 깊이·순환 복잡도 면에서 모두 양호하다 — 각 함수는 단일 책임을 가지며 10줄 안팎이고, 조건 분기도 얕다. 기존 파일(`source-scan.ts`)이 이미 확립한 "장문 JSDoc + 짧은 함수" 컨벤션과 파일별 `SRC`/`UPPER_SNAKE` 정규식 네이밍 관례를 그대로 따라 일관성도 유지된다. 유일하게 실질적인 개선 여지는 신설된 구조 가드 스펙이 비용이 큰 전체 저장소 스캔(`discover()`)을 캐싱 없이 3회 반복 호출하는 부분으로, 기능상 문제는 없으나 테스트 스위트 실행 비용과 코드 중복 양쪽에서 `beforeAll` 캐싱으로 쉽게 개선할 수 있다. `review/consistency/**` 하위 8개 파일은 워크플로 산출 리포트라 애플리케이션 코드 유지보수성 평가 대상이 아니어서 제외했다.

## 위험도
LOW
