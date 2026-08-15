STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `finalizeCancelledExecution` 의 새 재조회(`findOneBy`)가 실패 시나리오(에러 시나리오)를 정의하지 않는다 — 예외가 나면 "fail-closed skip" 이 아니라 catch 블록 밖으로 전파된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 함수 `finalizeCancelledExecution` (`!persisted` 분기, `const live = await this.executionRepository.findOneBy({ id: savedExecution.id })` 줄)
  - 상세: 이번 diff 는 guarded UPDATE 가 0행이면 "DB 가 실제로 뭐라고 하는가" 를 다시 물어보려고 `findOneBy` 를 추가로 호출한다. 그런데 이 호출은 try/catch 로 감싸여 있지 않다. 자매 헬퍼 `emitCancellationEvent` 는 "emit 실패가 cancel 자체를 무효화해선 안 된다" 는 원칙으로 자체 try/catch(warn 흡수)를 갖고 있는데(`execution-engine.service.ts` 1101행 부근), 이번에 새로 추가된 재조회 지점에는 같은 원칙이 적용되지 않았다. `findOneBy` 가 일시적 DB 장애로 reject 되면, `finalizeCancelledExecution` 전체가 throw 하고, 그 예외는 `runExecution`/`finalizeResumedExecutionOutcome` 의 `catch (err instanceof ExecutionCancelledError)` 분기 내부에서 발생하므로 그대로 호출자(워커 job 처리 루프)까지 전파된다 — 사용자가 누른 Stop 이 이번엔 "DB 미영속" 이 아니라 "재조회 자체가 실패" 로 무음이 될 수 있는 새로운 경로다. 세 회귀 테스트((a)/(b)/(c))는 모두 `findOneBy` 가 정상적으로 resolve 하는 경우만 다루고, reject 하는 경우는 다루지 않는다.
  - 제안: `findOneBy` 를 try/catch 로 감싸 실패 시 (예: warn 로그 후 skip, 또는 emit 은 하되 값은 방어적으로) 명시적 동작을 정의하고, DB 장애 시나리오에 대한 회귀 테스트를 추가할 것. 실제 발생 확률은 낮고(동일 함수 내 `updateExecutionStatus` 자체도 이미 DB 왕복이라 완전히 새로운 실패 표면은 아님) 워커 job 재시도로 자연 복구될 가능성이 있어 severity 는 WARNING 으로 제한한다.

### 확인한 사항 (문제 없음)

- `finalizeCancelledExecution` 의 0행 분기 판정 로직(`live?.status !== ExecutionStatus.CANCELLED` → skip, `=== CANCELLED` → DB 정본값으로 `durationMs`/`finishedAt` 을 맞춰 emit)이 CHANGELOG·plan(`eia-db-wire-invariant.md` §①)·spec(`node-cancellation.md` §2.4 매트릭스 신규 행, `spec/5-system/14-external-interaction-api.md` §6.5 해소 노트)과 line-level 로 일치한다. 자매 `finalizeFailedExecution` 과 극성이 반대(무조건 skip vs 재조회 후 조건부 발행)라는 점도 양쪽 함수 JSDoc·인라인 주석에 명시적 상호 참조로 기록돼 있어 "다음 사람이 복사해 같은 실수를 반복"하는 것을 구조적으로 막는다(직전 라운드에서 실제로 발생했던 실수 — `13_58_27` RESOLUTION W3).
- `updateExecutionStatus` 의 persisted===true 경로는 같은 SQL 문 안에서 `execution.durationMs`/`finishedAt` 을 그대로 쓰므로 "DB=wire" 가 자동으로 성립한다(별도 재조회 불요) — false 경로에서만 재조회가 필요하다는 설계가 정확하다.
- `retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기의 `.returning(['duration_ms', 'finished_at'])` 되읽기가 `toFiniteNumber`/`toPersistedDate` 로 방어적으로 파싱되고, `(result.affected ?? 0) > 0` 가드 뒤에서만 `row` 를 읽어 0행(동시 선점) 케이스에 undefined 접근이 없다. `retry-turn.service.spec.ts` 의 회귀 테스트가 "로컬 T2(600000) vs 영속 T1(1234)" 가 실제로 갈리는 fixture 로 이 결함 클래스를 판별력 있게 고정한다(직접 실행해 gate 라인 대조 확인).
- REST `durationMs` (`interaction.service.ts`/`execution-status-response.dto.ts`) — `execution.durationMs ?? null` 로 재계산 없이 영속 컬럼을 그대로 실어 push 계열(webhook/SSE/WS)과 값이 일치한다. `0` 을 `null` 로 뭉개지 않음(테스트로 확인), 종결 전 `null`(키 present, §5.4 부재 표현 규약 준수), `STATUS_PROJECTION_COLUMNS`/`BASE_COLUMNS` 양쪽에 `'durationMs'` 가 추가돼 정확집합(exact-set, `.sort()` 비교) 가드도 갱신됨을 직접 확인했다.
- `execution-status-response.dto.ts` 의 `durationMs?: number | null` + `@ApiPropertyOptional({ nullable: true })` 는 형제 필드(`currentNode`/`result`/`error`)와 동일한 패턴이고, `execution-status-response.dto.spec.ts` 의 §5.4 회귀 가드 목록에도 `'durationMs'` 가 추가돼 `nullable` 제거 뮤턴트를 잡는다.
- `spec/5-system/14-external-interaction-api.md` EIA-IN-04 표·§5.3 응답 예시·§6.5 "알려진 예외 1건" 해소 노트, `spec/conventions/node-cancellation.md` §2.4 매트릭스 신규 행·Rationale 정정이 모두 실제 구현과 line-level 로 일치한다(코드가 spec 을 따라간 것이 아니라 이번 PR 이 spec 자체를 구현에 맞춰 정정한 케이스 — SPEC-DRIFT 아님, 정상적 spec 갱신).
- 새 헬퍼 `toPersistedDate`(`terminal-duration.ts`)는 자매 `toFiniteNumber` 와 동형으로 Date/문자열/그 외(null·빈문자열·Invalid Date·숫자·객체) 를 정확히 `null` 로 좁히며, 11개 케이스 테스트(`terminal-duration.spec.ts`)가 전부 존재를 확인했다.
- diff 범위 내에서 신규 TODO/FIXME/HACK/XXX 주석은 발견되지 않았다(grep 확인).
- 프런트엔드 사용자 안내 문서(`triggers.mdx`/`.en.mdx`)에 재조회 응답의 `durationMs` 필드 안내가 추가되어, 직전 라운드(`13_58_27`)의 user_guide_sync WARNING(10번 항목)이 실제로 해소됐음을 확인했다.

### 요약

이 PR 은 CHANGELOG·plan(`eia-db-wire-invariant.md`)·spec 이 서술하는 세 항목(① `finalizeCancelledExecution` 의 guarded UPDATE 결과 미확인으로 인한 사후 오시그널, ② retry-turn CANCELLED 재진입 시 DB≠emit `durationMs`, ③ REST 재조회에 `durationMs` 부재)을 실제 코드에서 정확히 닫는다. 직전 두 리뷰 라운드(`13_58_27`, `14_47_14`)가 지적한 문제(반증된 첫 수정으로 Stop 이 무음이 됨, 자매 주석의 극성 캐비엇 누락, 손으로 고른 테스트 목록 미포함 등)도 소스를 직접 열어 대조한 결과 실제로 반영돼 있다. 함수 시그니처·필드명·기본값(`?? null`)·에러 로그·상태 전이 조건이 spec/CHANGELOG 서술과 line-level 로 일치하며, 0행/0값/DB 재조회 실패 등 엣지 케이스도 대부분 테스트로 판별력 있게 고정돼 있다. 유일한 잔여 갭은 `finalizeCancelledExecution` 이 새로 추가한 `findOneBy` 재조회 호출에 대한 방어적 에러 처리와 회귀 테스트가 없다는 점으로, WARNING 하나로 기록한다.

### 위험도

LOW
