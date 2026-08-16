# 테스트(Testing) Review

## 컨텍스트

본 changeset(`origin/main...HEAD`, 8 커밋)은 EIA 내부 REST/WS 읽기 경로 `Execution.error` /
`NodeExecution.error` egress 마스킹을 도입한 작업이며, 이미 같은 diff 에 대해 **4라운드**
(`17_12_34`→`17_35_49`→`17_56_15`→`18_14_50`)의 code review 가 수행되어 CRITICAL 0 · WARNING
6→3→1→1 로 수렴했고 전부 조치됐다. 현재 `HEAD`(`95e7a56e8`)는 4라운드 fix 커밋 그대로이며, 이번
(5라운드, `18_33_52`) 검토 대상 코드는 4라운드 이후 **추가 코드 변경이 없다**(`git diff` 로 실측 —
round 4 커밋 = 현재 HEAD). 즉 실질 코드는 이미 4차례 독립 testing reviewer 가 정밀 검토한 상태다.

이 보고서는 그 이력을 반복 나열하지 않고, 실제 소스(`executions.service.ts` 전체 diff,
`executions.service.spec.ts` 전체 diff, `background-runs.service.ts`/`.spec.ts`,
`redact-stored-error.ts`/`.spec.ts`)를 직접 `Read`/`git diff origin/main...HEAD` 로 재확인해
**독립적으로** 도출한 결과다(diff 가 프롬프트 크기 제한으로 생략된 파일 2개 — `executions.service.ts`,
`executions.service.spec.ts` — 는 저장소에서 직접 열람했다).

## 발견사항

- **[INFO]** `stop()` 의 `WAITING_FOR_INPUT` 분기가 마스킹된 `error` 값으로 직접 단언되지 않는다
  (기존 라운드에서 이미 검토·수용된 갭 — 재확인만)
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` `stop — WAITING_FOR_INPUT cancel (C-1)` describe 블록(`eW-ok` 케이스, `baseFake`에 `error` 미지정 → `null`)
  - 상세: `stopInternal` 의 세 `return` 문 중 `WAITING_FOR_INPUT` 분기(`updated ?? execution`)를 실제 `error` 값이 있는 fixture 로 통과시키는 테스트가 스위트에 없다. 반면 `④`/`④-b` 는 `RUNNING`→원자 UPDATE 경로의 두 반환 지점(`affected=1`/`affected=0`)을 각각 `LEAKY`/`MASKED` 로 직접 단언한다. 기능적 위험은 낮다 — 마스킹 관문이 `stop()` 한 자리(`toResponseExecution`)로 모든 반환을 감싸므로 `stopInternal` 내부에서 어느 분기를 타든 같은 문을 지난다. `17_56_15` RESOLUTION 이 이 갭을 이미 검토하고 "분기 자체는 기존 테스트가 덮고, 기능적 위험이 낮다"는 근거로 무조치 처리했다.
  - 제안: 새 조치를 요구하지 않는다. 다만 "표면 전수" 를 표방하는 `Execution.error 응답 마스킹 — 표면 전수` describe 블록의 취지(④가 "stop — 취소 응답"만 커버)와 JSDoc 이 명시한 "return 문 셋" 이 정확히 일치하려면, `WAITING_FOR_INPUT` + `error` 있는 fixture 조합 케이스 하나를 저비용으로 추가할 수 있다(우선순위 낮음).

- **[INFO]** `background-runs.service.ts` `toNodeExecutionDto` 는 필드별 재조립(entity-spread 아님)이라 `executions.service.ts` `findById` 의 copy-on-change 최적화·그 검증(참조 동일성 뮤테이션 테스트 `⑤-c`)이 원래부터 적용 대상이 아니다 — 결함 아님, 확인 차원의 기록
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `toNodeExecutionDto`(각 필드를 `row.xxx` 로 직접 나열)
  - 상세: `executions.service.ts` `findById` 의 `nodeExecutions` 마스킹은 **엔티티 배열의 얕은 복제**(`{...ne, error: ...}`)라 무조건 spread 시 성능 회귀(1라운드 WARNING)가 있었고, 그래서 참조 동일성 뮤테이션 테스트(`⑤-c`)로 고정했다. `background-runs.service.ts` 는 애초에 매 행 새 plain object 를 조립하므로 "무조건 vs 조건부 복제" 개념 자체가 성립하지 않는다 — 새 `error: null` 대칭 테스트(파일 3) 는 값 검증만으로 충분하고 참조 동일성 테스트가 필요 없다는 뜻이다. 다른 리뷰어(`18_14_50` testing INFO)가 이미 이 대칭 테스트를 요구·반영시켰고, 이번 확인은 그 판단이 정확했음을 뒷받침한다.
  - 제안: 조치 불필요.

- **[INFO]** 테스트 격리·가독성 — 신규 `describe('Execution.error 응답 마스킹 — 표면 전수', ...)` 블록과 `redact-stored-error.spec.ts` 는 견고하다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` (①~⑤-c), `codebase/backend/src/shared/utils/redact-stored-error.spec.ts`
  - 상세: (1) `beforeEach` 마다 `executionRepo`/`nodeExecutionRepo`/`engine` mock 객체를 새로 만들어 재대입하므로 테스트 간 상태 누수가 없다(`jest.fn()` 재생성, 전역 mock 아님). (2) `redact-stored-error.spec.ts` 는 null/undefined 정규화, 비변이(입력 불변) 보장, JSDoc 이 약속한 레거시 string/number 통과, 그리고 "보장의 경계"(자격증명 없는 연결 문자열·평범한 에러 메시지는 무변화)를 **캐너리**로 명시적으로 고정해 `deepRedactSecrets` 패턴이 조용히 넓어지는 것을 막는다 — 의도가 주석에 명확히 설명돼 있어 가독성도 높다. (3) `①-b` (캐시 히트 후에도 마스킹 유지)·`⑤`(형제 필드 `nodeExecutions[].error` 우회 차단)·`⑤-c`(copy-on-change 참조 동일성, 뮤테이션으로 실제 RED 검증됨 — `RESOLUTION.md` 기록)까지, "한 헬퍼를 한 번만 검증하면 자매 하나가 빠져도 초록"이라는 이 저장소의 반복 결함 형태를 정확히 겨냥한 설계다.
  - 제안: 조치 불필요 — 모범 사례로 기록.

- **[INFO]** `.only`/`.skip`/`xdescribe`/`xit` 등 의도치 않은 테스트 배제 없음 — 확인 완료
  - 위치: `executions.service.spec.ts`, `background-runs.service.spec.ts`, `redact-stored-error.spec.ts` 전체 grep
  - 상세: 세 파일 모두 스캔했으나 해당 패턴 0건.
  - 제안: 조치 불필요.

## Mock 적절성 · 테스트 용이성

- `stop()`/`findById`/`getChain`/`findByWorkflow` 각각의 신규 마스킹 관문 테스트는 실제 서비스 코드 경로(엔티티 조회 → `toResponseExecution`/`toExecutionDto`)를 그대로 타므로, mock 은 DB 왕복만 대체하고 마스킹 로직 자체는 실제 `redactStoredErrorForResponse`(진짜 `deepRedactSecrets` 위임)를 그대로 실행한다 — 마스킹 함수 자체를 mock/stub 하지 않아 실제 동작과의 괴리가 없다.
- 새로 도입된 `ResponseExecution`/`ResponseNodeExecution` 명시 타입은 (round 1~2 에서 지적된) null-hiding 캐스트를 제거하는 방향으로, 테스트 용이성 관점에서도 컴파일러가 `.error` null-check 누락을 잡아줄 수 있게 해 향후 회귀를 컴파일 타임에 드러낸다.

## 회귀 테스트

- 기존 `stop()` 테스트의 `expect(result).toBe(afterCancel)` → `toMatchObject` + `not.toMatchObject` 전환은 반환 계약 변경(엔티티 참조 → 마스킹 복사본)에 따른 필연적 수정이며, 원 단언의 의도("stale 최초 lookup 이 아니라 cancel 후 재조회 결과")를 값 비교로 정확히 보존한다 — 약화가 아닌 등가 교체로 판단.
- `background-runs.service.spec.ts` 의 신규 `error: null` 케이스는 `executions.service.spec.ts` 의 대칭 케이스와 짝을 맞춰, 두 자매 스위트 사이의 커버리지 비대칭을 해소했다(선행 라운드 INFO 반영 확인).

## 요약

핵심 신규 로직(`redactStoredErrorForResponse` 와 4개 소비처 — `findById`/`findByWorkflow`/`getChain`/`stop`, `background-runs.service.ts` `toNodeExecutionDto`)에 대한 테스트는 표면 전수·형제 필드 우회·copy-on-change 참조 동일성·null 정규화·비변이·레거시 타입 보존·보장 경계(캐너리)까지 이미 4라운드에 걸쳐 정밀하게 다져졌고, 이번 독립 재확인에서 코드·테스트 정합성에 새로운 결함을 발견하지 못했다. 유일하게 남는 지점은 `stop()` 의 `WAITING_FOR_INPUT` 분기가 마스킹 값으로 직접 단언되지 않는다는 것인데, 이는 이미 이전 라운드(`17_56_15`)가 "단일 관문이라 기능적 위험 낮음"으로 검토·수용한 사안이라 재차 WARNING 으로 올리지 않는다. Mock 은 DB 계층만 대체하고 실제 마스킹 함수를 그대로 실행해 실동작과의 괴리가 없으며, 테스트 간 상태 공유·`.only`/`.skip` 잔존 등 격리·위생 문제도 없다.

## 위험도

NONE
