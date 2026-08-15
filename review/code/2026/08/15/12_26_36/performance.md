# 성능(Performance) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (누적 diff, `origin/main` 대비)

## 방법론 노트

프롬프트 번들이 예산 초과로 다수 파일(특히 `execution-engine.service.ts`/`.spec.ts`,
`terminal-duration.ts`/`.spec.ts`)의 diff 를 생략했으므로, `git diff origin/main -- <path>`
로 직접 열어 전문 대조했다. `git diff origin/main --stat -- codebase/` 로 확인한 실제
프로덕션 코드 변경은 8개 파일(+ 대응 `*.spec.ts` 6개)이며, 성능 관점에서 실질적으로 검토할
대상은 다음이다:

- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규 헬퍼)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/dashboard/dashboard.service.ts`
- `codebase/backend/src/modules/statistics/statistics.service.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `types.ts` (타입만)

`resolveTerminalDurationMs`/`markQueueWaitTimeout`/`cancelParkedExecution` 등 신규 호출부
전수를 `grep -n`으로 찾아 각각이 배치 루프·노드 순회 안이 아니라 execution 1건당 1회 호출되는
종결 경로임을 호출부(`runExecutionFromQueue`, `admitExecutionOrDefer` 등)까지 따라가며
확인했다. 이 세션의 앞선 5차례 리뷰 라운드(`09_58_24`~`11_09_44`)가 이미 같은 changeset 을
반복 검토했고, 그중 `09_58_24/performance.md` 가 남긴 유일한 INFO(중복 호출)가 이번 라운드
시점에도 코드에 그대로 남아 있는지를 실측으로 재확인했다.

## 발견사항

- **[INFO]** `resolveTerminalDurationMs` 를 완료(completed) 경로 각각에서 같은 인자로 두 번
  호출한다 — 대입 시점과 emit 시점.
  - 위치(대입 / emit, `execution-engine.service.ts`): `:2415`/`:2426`, `:2579`/`:2595`,
    `:3566`/`:3577`, `:4756`/`:4769`, `:4884`/`:4888`, `:4945`/`:4967`
    (`:639`/`:668` 은 대입에 `if (row.startedAt)` 가드가 없는 별개 자리지만 같은 패턴)
  - 위치(대입 / emit, `retry-turn.service.ts`): `:713`-`714`/`:730`, `:895`-`896`/`:907`,
    `:948`-`949`/`:971`
  - 상세: `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` 로 값을 확정한 직후, 몇 줄 뒤 emit payload 에서
    `durationMs: resolveTerminalDurationMs(savedExecution)` 로 동일 인자를 다시 계산한다.
    헬퍼 내부는 `typeof`+`Number.isFinite` 검사 후 이미 확정된 `durationMs` 를 즉시
    반환하는 얕은 분기라 실질 비용은 무시할 수준이며(호출당 O(1), 노드 순회·루프 밖,
    execution 1건 종결당 최대 2회), 결과값도 항상 동일하다. 순수 스타일/DRY 성격이고
    이미 두 차례 리뷰 라운드(`09_58_24`, 그 계승)에서 우선순위 낮음으로 판정된 항목이
    이번 라운드 시점 diff 에도 변경 없이 남아 있음을 재확인했다.
  - 제안: `durationMs: savedExecution.durationMs`(대입 결과 재사용)로 바꾸면 중복 호출을
    없앨 수 있으나, 실질 성능 영향이 없어 이 PR 을 막을 사유는 아니다.

## 그 외 점검 결과 (문제 없음으로 판정)

- **알고리즘 복잡도**: `resolveTerminalDurationMs`/`toFiniteNumber` 모두 원시값에 대한
  O(1) 순수 함수(`terminal-duration.ts`). `TERMINAL_DURATION_MS_SQL` 도 단일 행
  `WHERE id = :id` UPDATE 문 안에서 DB 가 계산하는 O(1) 표현식이다.
- **N+1 쿼리/호출**: 새로 도입한 raw UPDATE 5경로(`cancelParkedExecution`,
  `markWebChatIdleTimeout`, `markExecutionCancelled`, `markQueueWaitTimeout`,
  `finalizeStalledExhausted`)는 전부 `.returning(['id', 'duration_ms'])` 로 **같은 UPDATE
  문장 안에서** 값을 되받는다 — 값을 다시 읽기 위한 별도 SELECT 왕복을 추가하지 않는다.
  호출부(`runExecutionFromQueue`→`admitExecutionOrDefer`→`markQueueWaitTimeout` 등)를
  추적한 결과 전부 execution 1건당 1회 호출되는 BullMQ job-핸들러 경로이며, 여러
  execution 을 순회하는 배치 루프 안에서 호출되는 자리는 없다.
- **메모리 할당**: 대규모 배열·객체 적재 없음. `result.raw` 는 단일 행(`[0]`)만 참조한다.
- **캐싱**: `durationMs` 는 실행 1건의 종결 시점에만 계산되는 파생값이라 캐싱 대상이 아니다.
- **블로킹 I/O**: 전부 기존과 동일한 `await` 기반 TypeORM 비동기 호출. 신규 동기 I/O 없음.
- **불필요한 연산**: `dashboard.service.ts:96`/`100`, `statistics.service.ts:92-98`/
  `220-226` 에 추가된 `AND e.status = :completedStatus`(또는 FILTER 절)는 기존 단일
  집계 쿼리 안의 조건 하나를 추가한 것으로, 쿼리 왕복 횟수·스캔 범위를 늘리지 않는다
  (오히려 이전엔 `duration_ms IS NOT NULL` 만으로 우연히 필터링됐던 것을 명시화한
  것뿐이고, 기존 `w.workspace_id`/`started_at` 조건과 함께 `idx_execution_status`,
  `idx_execution_workflow_started` 등 기존 인덱스로 충분히 커버된다). 새 인덱스가
  필요한 변경이 아니다.
- **데이터 구조**: 기존 QueryBuilder 체인에 `setParameter`/`returning`/`FILTER` 조건을
  추가한 것뿐, 자료구조 변경 없음.
- **지연 로딩**: 해당 없음.
- **테스트 파일(`*.spec.ts`) mock 확장**: `setParameter`/`returning`/`groupBy` 등 mock 을
  다수 QueryBuilder 리터럴에 반복 추가했다. 프로덕션 런타임과 무관하고, 테스트 스위트
  실행 비용 증가도 무시할 수준(mock 함수 객체 몇 개 추가)이다.

## 요약

이번 changeset(origin/main 대비 누적 diff)은 종결 이벤트(`completed`/`failed`/`cancelled`)
payload 에 `durationMs` 를 채우는 배관 작업으로, 계산을 가능한 한 SQL(`GREATEST`→이후
`LEAST`+`EXTRACT EPOCH` 클램프)로 밀어넣고 `RETURNING` 으로 같은 UPDATE 문장에서 값을
되받는 설계를 유지해 추가 SELECT 왕복(N+1)을 만들지 않는다. 신규 헬퍼
(`resolveTerminalDurationMs`/`toFiniteNumber`)는 O(1) 순수 함수이고, 호출 지점 전부가
execution 1건당 1회뿐인 종결 경로라 노드 수·행 수에 비례하는 반복 호출 패턴이 없다.
`dashboard`/`statistics` 서비스의 집계 쿼리 필터 추가도 기존 단일 쿼리에 조건 하나를
얹은 것으로 왕복·스캔 비용을 늘리지 않는다. 유일하게 지적할 점은 완료 경로 다수에서 같은
인자로 `resolveTerminalDurationMs` 를 두 번 호출하는 사소한 중복 계산(INFO)이며, 실질
성능 영향은 무시할 수준이고 이미 앞선 리뷰 라운드에서 우선순위 낮음으로 판정된 채 이번
라운드 diff 에도 변화 없이 남아 있다. 전반적으로 성능 리스크는 낮다.

## 위험도

LOW
