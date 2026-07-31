# 요구사항(Requirement) 리뷰 — retry_last_turn 2차 claim 삽입 위치 결함 수정 (`414550a1d`)

리뷰 대상 diff: `HEAD~1..HEAD` (`414550a1d`, 직전 `b351731f0` 의 후속 수정).
변경 파일: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`,
`retry-turn.service.spec.ts` (+ 참고: `execution-engine.service.spec.ts`,
`plan/in-progress/retry-turn-terminal-guard.md`).

## 검증 방법

코드 정독 외에 다음을 직접 실행해 주장을 재확인했다 (프로젝트 관례 — "측정했다" 주장은 실측
필요):
- `npx jest retry-turn.service.spec.ts` → 41 passed / 41 total (RESOLUTION.md 주장과 일치)
- `npx jest execution-engine.service.spec.ts` → 436 passed / 436 total (RESOLUTION.md 주장과 일치)
- `npx eslint retry-turn.service.ts retry-turn.service.spec.ts` → 0 errors, pre-existing warning
  2건(149/229행, `no-unnecessary-type-assertion`)만 — RESOLUTION.md "손대지 않음" 주장과 일치
- `git diff HEAD~1..HEAD` 로 실제 변경 범위를 diff 레벨에서 재대조 (프롬프트의 "전체 파일
  컨텍스트" 게이트 숫자가 실제 소스 줄 번호와 일치함을 `Read` 로 재확인)

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` spec Rationale 의 backstop 커버리지 서술이 이번 PR 자체가
  실측으로 반증한 내용과 어긋난다 — 코드(및 investigation)가 맞고 spec 문구가 낡았다.
  - 위치: `spec/5-system/4-execution-engine.md:1387-1389` (Rationale § "retry 재진입의 원자
    claim — spawn 단계 원자성만으로는 불충분하다") vs
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:502-513`
    (`claimSpawnedRetryRow` JSDoc "알려진 백스톱 갭" 문단)
  - 상세: spec 은 "크래시로 중단된 턴의 BullMQ 재배달도 함께 막힌다 … 복구는
    `recoverStuckExecutions`(stale RUNNING Execution 재claim, §7.5 case B) 백스톱이 담당한다"
    라고 명시적으로 단언한다. 그런데 이번 PR 이 실측(개발자 자신의 investigation, RESOLUTION.md
    및 `plan/in-progress/retry-turn-terminal-guard.md` 코드 표 #15 로 등재)으로 확인한 바에
    따르면, discard 이후 spawn 된 NodeExecution row 가 RUNNING orphan 으로 남는 상황에서
    Execution 자체는 이미 `failed`(terminal) 이므로 `recoverStuckExecutions`/
    `failOrphanRunningNodeExecutions` 의 "stale RUNNING **Execution**" 재구동 경로에 걸리지
    않는다 — 즉 spec 이 안전망으로 지목한 그 백스톱은 **이 케이스에 닿지 않는다**. 코드 쪽은
    이 사실을 정확히 반영해 JSDoc 에 "리뷰어 제안과 다름 — 실측으로 확정" 이라 명시하고 plan
    후속(#15, P2)으로 등재했으나, spec 본문의 Rationale 문장 자체는 갱신되지 않아 "복구는 그
    백스톱이 담당한다"는 이제는 틀린 주장이 그대로 남아 있다.
  - 제안: 코드/plan 변경 불필요(이미 올바름) — `project-planner` 가
    `spec/5-system/4-execution-engine.md:1387-1389` 문장을 "discard 후 Execution 이 이미
    terminal(`failed`) 인 경우 `recoverStuckExecutions` 백스톱이 닿지 않아 spawn row 가 RUNNING
    orphan 으로 잔류할 수 있다(실측 확인, 후속 트래킹: `retry-turn-terminal-guard.md` #15)"
    방향으로 정정.

- **[WARNING]** claim 성공 후 "in-memory `_retryState` 부재" 방어 분기(구조적으로 도달
  불가능하다고 스스로 문서화한 코드)가 두 spec 파일 어디에서도 테스트되지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:337-348`
    (`if (!retryState) { … FAILED 마킹 없이 ack-and-discard … }`)
  - 상세: 이 분기는 이번 커밋이 고친 Critical#1("살아있는 row 를 손상으로 오판해 FAILED 로
    덮어씀")과 **같은 성격의 버그가 다른 형태로 재도입**되는 것을 막기 위한 안전장치로,
    주석 자체가 "이론상 도달 불가능" 이라 밝힌다. 그런데 `retry-turn.service.spec.ts` 의 (c)
    케이스는 claim 을 `affected:0`(=`!claimed`) 으로 무장해 **바로 위** 분기만 태우고, 새로
    추가된 "claim 성공 후 try 진입 전 예외" 회귀 테스트도 claim 을 `affected:1` 로 성공시킨 뒤
    바로 rehydrateContext 를 reject 시켜 이 분기를 건너뛴다.
    `execution-engine.service.spec.ts` 의 신규 두 케이스(16868/16889행)도 각각 `affected:0`
    만 사용한다. 즉 "`claimed === true` 인데 in-memory `retryState` 는 falsy" 조합은 유닛
    레벨 mock 으로 얼마든지 구성 가능함에도 어느 테스트에도 없다 — 향후 이 분기가 실수로
    (혹은 "정리" 목적으로) FAILED 마킹으로 되돌아가도 현재 스위트가 RED 를 내지 못한다.
    RESOLUTION.md 의 mutation 5종에도 이 분기를 표적으로 한 뮤턴트가 없다.
  - 제안: `claimSpawnedRetryRow` 호출을 mock 하는 대신, `createQueryBuilder().execute()` 를
    `{affected:1}` 로 두고 `spawnedRow.inputData` 를 `{}` (키 없음)로 구성하는 케이스를
    `retry-turn.service.spec.ts` 의 "applyRetryLastTurn — early-exit guards" describe 에
    추가해 "discard, FAILED 미마킹, save() 미호출"을 고정할 것.

- **[INFO]** `delete spawnedRow.inputData[RETRY_STATE_KEY]` 가 두 줄 위의 `seededInput =
  spawnedRow.inputData ?? {}` 와 달리 nullish 가드 없이 `spawnedRow.inputData` 를 직접
  역참조한다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:356`
    (cf. `:312` 의 `spawnedRow.inputData ?? {}`)
  - 상세: `spawnedRow.inputData` 가 (엔티티 컬럼 타입상 기대되지 않지만) 만약 `null`/`undefined`
    라면 이 `delete` 는 TypeError 를 던진다. 다만 이 라인 직전의 `claimed === true` 는 그
    순간 DB 의 `jsonb_exists(input_data, …)` 가 true 였음을 뜻하므로 구조적으로
    `input_data` 자체가 non-null jsonb 여야 하고, 설령 이 경로가 뚫려 예외가 나더라도 그
    지점은 아직 `try` 블록 진입 전이라 "claim 성공 후 try 진입 전 예외 → 그대로 throw →
    BullMQ 재배달 시 claim 실패로 안전 discard" 패턴(이미 회귀 테스트로 고정됨)으로 흡수된다
    — 즉 실질 위험은 낮다. 그래도 바로 위에서 확립한 `?? {}` 방어 관례와 이 줄만 어긋나는
    점은 눈에 띈다.
  - 제안: (선택) `delete (spawnedRow.inputData ?? (spawnedRow.inputData = {}))[RETRY_STATE_KEY]`
    또는 `seededInput` 재사용 등으로 일관성 있게 방어. 우선순위 낮음.

## 정합성 확인 (문제 없음으로 판단된 항목)

- **Critical#1 재발 방지**: claim(`claimSpawnedRetryRow`) 호출이 옛 "`_retryState` 부재 →
  FAILED" 판정보다 앞으로 이동했고, 그 판정 분기 자체가 삭제됐다 — 직전 라운드
  (`review/code/2026/07/28/20_32_57`) 의 3개 독립 reviewer(concurrency/architecture/
  requirement) 수렴 지적과 RESOLUTION.md 처분이 코드에 정확히 반영됨을 라인 단위로 확인.
- **Critical#2 재발 방지**: claim 성공 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]`
  (`:356`)가 이 메서드의 하위 `save(spawnedRow)` 호출 2곳(`:373`, `:385`) **모두**보다 앞에
  위치 — TypeORM jsonb diff 로 인한 `_retryState` 부활 경로가 라인 순서상 차단됨을 확인.
  이 delete 이후 다른 `save(spawnedRow)` 호출은 파일 내에 없음(grep 으로 확인).
  `buildRetryReentryState` 등 downstream 로직은 delete 이전에 캡처한 `retryState` 지역
  변수를 쓰므로 delete 로 인한 데이터 유실 없음.
  - 회귀 테스트: `retry-turn.service.spec.ts` (d)/(e) 케이스가 `save()` 에 전달된 엔티티의
    `inputData._retryState` 가 `undefined` 인지 명시적으로 단언 — 실행 결과 GREEN.
- **claim SQL**: `claimSpawnedRetryRow` 의 `UPDATE … SET input_data = input_data - '_retryState'
  WHERE id=:id AND status='running' AND jsonb_exists(input_data, '_retryState')` 가
  `spec/5-system/4-execution-engine.md:1378-1381` 의 채택 SQL 과 line-level 로 일치.
- **`RETRY_STATE_KEY` 상수화**: raw SQL 리터럴 2곳 + `retryLastTurn` 의 기존 2곳 + TS 프로퍼티
  접근이 모두 동일 상수를 참조 — 리터럴 drift 위험 해소(Warning #3 정확히 반영).
- **claim 제외 목록과의 정합**: `continuation-execution.processor.ts:93` 의
  `type !== 'cancel' && type !== 'retry_last_turn'` 제외가 "`applyRetryLastTurn` 자체 원자
  claim 수행" 전제와 여전히 부합 — 이번 diff 가 그 전제(claim 순서)를 실제로 강화했으므로
  프로즈-only 결합(Warning #2, plan #16 로 defer)이 당장 깨지진 않음.
- **테스트 커버리지 대칭성**: 통합 레벨(`execution-engine.service.spec.ts`)에 claim
  실패(affected=0) 케이스가 신규 추가돼(Warning #8 해소) unit/integration 양 계층에서
  "다른 delivery 선점" 시나리오가 고정됨. 재배달 시뮬레이션 테스트(같은 spawned row 를
  fresh 조회해 claim 실패 discard 로 안전 종료됨을 확인)까지 포함해 concurrency reviewer 가
  요구한 "실제 발생 가능한 유일한 경로" 를 닫음.
- **반환값/에러 시나리오**: `applyRetryLastTurn` 의 모든 조기 return 경로가 `Promise<void>`
  계약을 지키고, claim ~ try 진입 전 구간의 예외는 의도적으로 미포착(rethrow)되어 BullMQ
  재배달에 안전하게 위임됨 — 전용 회귀 테스트로 고정.
- **TODO/FIXME/HACK/XXX**: 변경 파일 2곳 모두에서 검색 결과 없음.

## 요약

`b351731f0` 이 도입한 2차 원자 claim(`applyRetryLastTurn` 재진입 가드) 의 삽입 위치 결함
2건(Critical#1: claim 보다 먼저 실행되는 낡은 "부재→FAILED" 판정이 claim 이 만들어내는
정상 상태를 손상으로 오판, Critical#2: claim 이 지운 `_retryState` 가 stale in-memory
`save()` 로 부활)을 정확히 겨냥해 고쳤다. 고친 순서(claim 을 최우선으로 당기고 그 판정
분기를 삭제, delete 로 in-memory 동기화)는 직전 ai-review 라운드(3개 독립 reviewer 수렴)의
요구와 line-level 로 일치하며, 회귀 테스트(재배달 시뮬레이션 포함)와 mutation
검증(5/5 RED, 본 리뷰에서 재실행한 41/41·436/436 GREEN 으로 재확인)으로 뒷받침된다.
spec(`4-execution-engine.md` §Rationale)의 SQL/설계 서술과도 line-level 로 부합한다. 다만
그 Rationale 이 단언하는 backstop 커버리지 문장 자체는 이번 PR 의 실측으로 반증됐음에도
갱신되지 않아 spec 정정이 필요하고(SPEC-DRIFT), 새로 추가된 "claim 성공 후 in-memory
retryState 부재" 방어 분기는 스스로 "이론상 도달 불가능" 이라 말하는 만큼 테스트로 잠기지
않아 향후 조용한 재도입에 취약하다 — 둘 다 코드 fix 를 막는 수준은 아니다.

## 위험도

LOW
