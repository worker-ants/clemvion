# 테스트(Testing) Review

> 이 변경셋은 이미 `/ai-review` 5라운드(`17_12_34`→`17_35_49`→`17_56_15`→`18_14_50`→`18_33_52`)를
> 거쳐 CRITICAL 0으로 수렴했고, 각 라운드의 testing 발견(참조 동일성 미검증·자매 표면 null
> 케이스 비대칭 등)은 이미 코드에 반영돼 있다. 아래는 그 상태를 전제로 소스를 직접 열어
> 독립적으로 재확인한 결과다 — 프롬프트 다이제스트가 파일 7·8·9(`executions.service.spec.ts`,
> `executions.service.ts`, `redact-stored-error.spec.ts`)의 diff 를 크기 제한으로 생략했으므로,
> `Read`/`Grep` 으로 현재 파일 전문을 직접 대조했다.

## 발견사항

- **[INFO]** `stop()` 의 `WAITING_FOR_INPUT` 분기는 "표면 전수" describe 블록에서 마스킹 값으로 직접 단언되지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:854-874` (`stopInternal` 의 `WAITING_FOR_INPUT` 분기) — 이를 실행하는 테스트는 `codebase/backend/src/modules/executions/executions.service.spec.ts:733-761`(`stop — WAITING_FOR_INPUT cancel (C-1)` describe, `732`)인데, 이 테스트는 `error` 필드를 아예 설정하지 않고 상태 전이만 단언한다. 반면 마스킹을 직접 겨냥하는 `Execution.error 응답 마스킹 — 표면 전수` describe(`857`)의 `④`/`④-b` 케이스(`928`, `955`)는 둘 다 초기 상태를 `RUNNING`으로 고정해 원자 UPDATE 분기(`affected=1`/`affected=0`)만 태운다.
  - 상세: 기능적 위험은 낮다 — `stop()`(`821-823`)이 `stopInternal()`의 반환값을 **바깥 단일 지점**(`toResponseExecution`, `994`)에서 감싸므로 `stopInternal`이 어느 내부 분기를 타든 같은 마스킹 관문을 통과한다(구조적으로 보장). 다만 `stop()`의 JSDoc(`799-803`)이 "반환 지점이 셋, 폴백 포함 여섯 가지 나갈 수 있는 객체" 를 근거로 "함수를 하나 더 두어 모든 반환이 같은 문을 통과하게 한다"는 설계를 정당화하는데, 그 여섯 가지 중 `WAITING_FOR_INPUT` 경로(`872-873`)만 유일하게 값 기반으로 검증되지 않은 채 남아 있다. 이 항목은 `17_56_15`·`18_14_50` RESOLUTION 에서 이미 "관문이 바깥 단일 지점이라 기능적 위험 낮음"으로 조치 불요 판정을 받았고, 이번 재확인에서도 그 판정을 뒤집을 근거는 찾지 못했다 — 새 코드 변경 없이 그대로 유지되고 있다.
  - 제안: 조치 불요(기존 판정 유지). 다만 향후 `stopInternal`의 분기 수가 다시 바뀌는 리팩터가 있을 때는, `waiting` 상태 fixture + `engine.cancelWaitingExecution` 성공 경로에서도 `error` 마스킹을 값으로 단언하는 케이스 하나를 곁들이면 JSDoc의 "여섯 가지 나갈 수 있는 객체" 주장과 테스트 커버리지가 정확히 일치한다.

- **[INFO]** 이번 마스킹 표면(내부 REST 4곳 + background-runs)에 대한 e2e/HTTP 레벨 검증이 없다 — unit 레벨 커버리지로만 방어
  - 위치: `git diff origin/main...HEAD --stat -- 'codebase/**'` 결과 변경 파일 8개 전부가 `*.service.ts`/`*.service.spec.ts`/`*.dto.ts`/신규 유틸 2개이고, `**e2e**` 경로 diff 는 0건.
  - 상세: `ExecutionsController`/`BackgroundRunsController`는 서비스 반환값을 그대로 응답 바디에 얹는 얇은 pass-through라 컨트롤러 계층 자체의 위험은 낮고, 기존 e2e 스위트가 "DB 원문 보존"(egress-only, `secret-store.md` §R17)을 이미 별도로 단언하며 회귀 없이 통과한다는 점이 반대편 방향의 증거로 작용한다. 다만 "HTTP 응답 JSON 에 실제로 `***` 로 마스킹된 값이 실린다"를 컨트롤러 진입점부터 검증하는 e2e는 이번 PR에도, 기존 스위트에도 없다.
  - 제안: 조치 불요(이미 `17_56_15` testing INFO 로 동일 판정, 변경 없음). 가치는 있으나 필수는 아니다 — 서비스 단 유닛 커버리지가 표면 4곳(`findById`/`findByWorkflow`/`getChain`/`stop`) + 형제 필드(`nodeExecutions[].error`)를 개별적으로 겨냥하고 있어 회귀 탐지력은 충분하다.

## 확인한 사항 (양호 — 새 발견 아님, 재검증 기록)

- `redact-stored-error.spec.ts`(전체 100줄, `Read`로 직접 확인) — happy path(URI·Bearer·중첩 details) · null/undefined 정규화 · **비변이 보장**(입력 참조 불변) · JSDoc이 약속한 레거시 문자열/숫자 통과 · **보장의 경계를 캐너리로 고정**(자격증명 없는 문자열·평범한 메시지는 무변화)까지 8개 케이스로 커버. 경계·형태보존·부작용 세 축을 모두 짚고 있어 모범적이다.
- `executions.service.spec.ts`의 `Execution.error 응답 마스킹 — 표면 전수` describe(`857-1101`) — `①`findById·`①-b`캐시 히트 경로·`②`findByWorkflow·`③`getChain·`④`/`④-b`stop 의 두 반환 분기·형제 필드 우회(`⑤`)·copy-on-change 최적화의 **참조 동일성**(`⑤-c`, `1060-1090`, `toBe`/`not.toBe`로 뮤턴트를 RED로 잡는 형태) · null 통과 대칭 케이스까지 표면별로 독립 검증한다. `⑤-c`는 값 비교만으로는 잡히지 않는 회귀(무조건 spread로 되돌리는 뮤턴트)를 참조 동일성으로 잡아내는 판별력 있는 테스트다 — RESOLUTION(`17_35_49`)의 뮤테이션 검증 주장은 `17_56_15` SUMMARY에서 독립 재현까지 됐다.
- `background-runs.service.spec.ts`에 추가된 두 케이스(자격증명 마스킹 · `error: null` 통과) — 자매 스위트(`executions.service.spec.ts`)와의 null 케이스 비대칭이 `18_14_50` 라운드에서 지적된 대로 해소됐다.
- 격리: 두 spec 파일 모두 `beforeEach`에서 mock을 새로 생성하고 `mockReturnValueOnce` 체인으로 호출 순서를 명시하므로 테스트 간 상태 누수가 없다. `buildSingleQB` 중복 정의(`17_35_49`/`18_33_52`에서 지적)는 최상위로 hoist되어 현재 단일 정의만 남아 있음을 grep으로 확인(`executions.service.spec.ts:92`).
- 회귀: `npx jest src/modules/executions/executions.service.spec.ts src/modules/executions/background-runs/background-runs.service.spec.ts src/shared/utils/redact-stored-error.spec.ts` 직접 재실행 — **3 suites / 68 tests 전부 PASS**(본 리뷰 시점 독립 재검증).
- Mock 적절성: `QueryBuilder` mock이 실제 호출 체인(`leftJoin`/`where`/`andWhere`/`orderBy`/`getOne`/`getMany`/`getRawOne` 등)을 그 메서드 이름 그대로 스텁하고 있어 실제 TypeORM 호출부와의 괴리가 적다. `engine.cancelWaitingExecution`의 기본 mock(`{queued:true}`)과 개별 테스트의 오버라이드(`{queued:false}`)도 실제 반환 형태와 일치한다.
- 테스트 용이성: `redactStoredErrorForResponse`가 순수 함수로 분리되고, `toResponseExecution`이 마스킹+relation-strip을 단일 관문으로 묶은 구조 덕분에 표면별 테스트가 서비스 내부 구현을 직접 mock하지 않고 공개 메서드 호출만으로 전부 검증 가능하다 — 의존성 주입 구조를 바꾸지 않고도 테스트 용이성이 유지된다.

## 요약

핵심 신규 로직(`redactStoredErrorForResponse` 및 4개 소비처 — `findById`/`getChain`/`stop`/`toExecutionDto`, `background-runs.service.ts`의 `toNodeExecutionDto`)에 대한 테스트는 5라운드에 걸쳐 이미 충분히 단단해졌고, 이번 독립 재확인(전체 파일 직접 Read + 대상 3개 spec 파일 68개 테스트 재실행)에서도 회귀나 새로운 커버리지 갭을 발견하지 못했다. `redact-stored-error.spec.ts`는 형태 보존·비변이·보장의 경계를 캐너리로 고정했고, `executions.service.spec.ts`의 "표면 전수" describe는 4개 독립 표면 + 형제 필드 + copy-on-change 최적화를 참조 동일성(뮤테이션 검증됨)으로 각각 겨냥한다. 유일한 잔여 갭 두 가지(`stop()`의 `WAITING_FOR_INPUT` 분기가 값 기반으로 직접 단언되지 않음, 이 표면 전체에 e2e/HTTP 레벨 검증이 없음)는 모두 이전 라운드(`17_56_15`/`18_14_50`)에서 이미 "구조적으로 위험 낮음"으로 조치 불요 판정을 받았고, 이번 코드 변경(round 5→6 사이의 diff, 즉 `executions.service.spec.ts`/`redact-stored-error.ts`/문서 정리)이 그 판정을 흔들 만한 내용을 담고 있지 않아 그대로 유지한다.

## 위험도

NONE
