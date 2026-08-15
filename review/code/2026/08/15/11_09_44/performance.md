# 성능(Performance) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (4라운드 누적본, `11_09_44`)

## 방법론 노트

이 PR 은 이미 `09_58_24`→`10_18_38`→`10_34_51`→`10_52_08` 4라운드의 ai-review 를 거쳤고, 그중
`09_58_24/performance.md` 가 이번과 동일한 관점(성능)에서 이미 전체 파일을 정독했다. 이번 라운드의
델타는 (1) `10_18_38` W1 조치로 `resolveTerminalDurationMs` 헬퍼 경유 지점이 6곳→9곳으로 늘었고
(멀티라인 grep 누락분 전환), (2) `10_52_08` 에서 테스트 단언 2건이 채워진 것뿐 — **프로덕션 계산
로직·SQL·호출 구조는 이전 라운드 이후 바뀌지 않았다.**

프롬프트 번들에서 크기 제한으로 diff 가 생략된 `execution-engine.service.ts`/`.spec.ts`(파일 5, 6)는
`git diff origin/main -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 로
직접 열어 대조했다(게이트 숫자가 없어 실제 파일 줄 번호는 `Read`/`grep -n` 으로 확인). 프로덕션 diff
는 `git diff origin/main --stat -- codebase/` 로 9개 파일(560 insertions/55 deletions)임을 재확인했고,
이 중 성능과 실질 관련 있는 파일은 4개다:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규)
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (타입 캐스팅 폭만 변경, 런타임 영향 없음)

나머지(`*.spec.ts`, `types.ts`, `CHANGELOG.md`, `plan/**`, `review/**`, `spec/**`)는 테스트/타입/문서
변경이라 런타임 성능에 영향이 없다.

## 발견사항

- **[INFO]** `resolveTerminalDurationMs(savedExecution)` 를 같은 함수 안에서 두 번 호출하는 패턴이
  이전 라운드보다 늘었다(6곳→9곳) — 새로운 문제는 아니고 `10_18_38` W1(누락 지점 전환) 이 부작용으로
  중복 호출 지점 수를 늘렸다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2413`(대입)/`:2424`(재호출),
    `:2577`/`:2593`, `:3564`/`:3575`, `:4754`/`:4767`, `:4881`(대입)/`:4886`(재호출, `finalizeCancelledExecution`),
    `:4943`/`:4965`
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:639`(대입)/`:668`(재호출,
    `failFirstSegmentSetup`)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:714`(대입)/`:730`(재호출),
    `:896`/`:907`, `:949`/`:971`
  - 상세: `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;`
    로 확정한 값을 몇 줄 뒤 `durationMs: resolveTerminalDurationMs(savedExecution)` 로 재계산한다. 함수
    본문은 `typeof`+`Number.isFinite` 체크와 뺄셈 한 줄뿐이고(`terminal-duration.ts:32-42`), 이미 확정된
    `durationMs` 는 진입부의 `typeof row.durationMs === 'number' && Number.isFinite(...)` 분기에서 즉시
    반환되므로 결과는 동일하지만 함수 호출이 실행당 1회 더 늘어난다. 전부 실행(execution) 1건의 종결
    시점에만 실행되는 자리이고 노드 순회·배치 루프 안이 아니라 실질 비용은 무시할 수준.
  - 제안: `durationMs: savedExecution.durationMs`(또는 `execution.durationMs`)로 직접 참조. 우선순위는
    낮음(스타일/DRY 성격, 3라운드째 미채택 — `09_58_24` 부터 동일 판단 유지 중이라 신규 이슈로 취급하지
    않는다).

## 그 외 점검 결과 (문제 없음으로 판정)

- **N+1 쿼리**: `cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/
  `markQueueWaitTimeout`/`finalizeStalledExhausted` 전부 실행 1건당 1회 호출되는 종결 경로다. 유일한
  배치 호출자인 `WebChatIdleReaperService.reap()`(`codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts:88-92`)
  는 이 PR 이전부터 존재하던 `processInBatches(executionIds, REAP_CONCURRENCY, ...)` 동시성 제한 배치
  구조를 그대로 쓰고, 이번 diff 는 그 안의 개별 UPDATE 문에 `SET durationMs=…`/`RETURNING` 을 얹었을
  뿐 호출 횟수·구조를 바꾸지 않았다. `RETURNING` 도입은 오히려 UPDATE 직후 별도 SELECT 재조회를
  막아주는 방향.
- **알고리즘 복잡도**: `TERMINAL_DURATION_MS_SQL`(`CASE WHEN … THEN NULL ELSE LEAST(2147483647, EXTRACT(EPOCH FROM (…)) * 1000) END`)
  은 DB 가 `WHERE id = :id` PK 매칭 단일 행 UPDATE 문 안에서 계산 — O(1). `resolveTerminalDurationMs`/
  `toFiniteNumber` 도 분기+산술 한 줄의 순수 함수로 O(1).
  - 신규 `LEAST(2147483647, …)` int4 클램프(`terminal-duration.ts:87-90`)는 이전 라운드(`09_58_24`)
    CRITICAL 로 지적된 "24.8일 초과 시 `::int` 캐스팅 실패 → UPDATE 문 전체 실패 → 취소가 영구
    실패해 실행이 고착"을 saturate 로 방지 — 이 클램프 자체가 계산 비용을 추가하지 않으면서 실패
    모드를 제거한 형태라 성능·안정성 양쪽에 긍정적.
- **메모리 할당**: `toFiniteNumber`/`resolveTerminalDurationMs` 는 원시값만 다루고, `result.raw` 는
  단일 행(`[0]`)만 참조한다. 대규모 배열·객체 적재 없음.
- **캐싱**: `durationMs` 는 실행 1건의 종결 시점에만 계산되는 파생값이라 캐싱 대상이 아니다.
- **블로킹 I/O**: 전 경로가 기존과 동일하게 `await` 기반 TypeORM 비동기 호출. 신규 동기 I/O 없음.
- **데이터 구조**: 기존 QueryBuilder 체인에 `.setParameter()`/`.returning([...])` 를 추가한 것뿐 —
  자료구조 변경 없음.
- **지연 로딩**: 해당 없음 — 종결 시점에 필요한 값만 그 시점에 계산/조회한다(엔티티 미로드 5경로는
  의도적으로 엔티티를 로드하지 않고 SQL 로만 계산해 오히려 불필요한 SELECT 를 회피).
- **테스트 파일 mock 확장**(`execution-engine.service.spec.ts`, `retry-turn.service.spec.ts`): `setParameter`/
  `returning` mock 을 다수 query-builder 리터럴에 반복 추가했다. 프로덕션 런타임과 무관하고 테스트
  스위트 실행 비용 증가도 무시할 수준(mock 함수 객체 추가뿐).

## 요약

이번 라운드는 이미 3차례 ai-review 를 거친 브랜치의 4번째 성능 재검토다. 프로덕션 계산·SQL 로직은
직전 라운드 이후 변경되지 않았고, 계산을 SQL(`CASE`+`EXTRACT EPOCH`+`LEAST` 클램프)로 밀어넣고
`RETURNING` 으로 같은 UPDATE 문장에서 값을 되받는 설계를 유지해 추가 SELECT 왕복(N+1)을 만들지
않는다. 헬퍼(`resolveTerminalDurationMs`/`toFiniteNumber`)는 전부 O(1) 순수 함수이고 모든 호출 지점이
실행 1건당 1회뿐인 종결 경로라 노드 수·행 수에 비례하는 반복 패턴은 없다. `09_58_24` RESOLUTION 에서
조치된 int4 상한 클램프(`LEAST(2147483647, …)`)는 "장기 대기 실행의 취소 UPDATE 가 통째로 실패해
영구 고착"이라는 CRITICAL 급 가용성 결함을 성능 비용 없이 제거했다. 유일한 잔여 지적은 완료/취소
경로 9곳에서 같은 인자로 `resolveTerminalDurationMs` 를 두 번 호출하는 사소한 중복 계산(INFO)이며,
`09_58_24` 부터 3라운드째 "실질 영향 무시 가능"으로 판단이 유지되고 있어 이번에도 신규 차단 사유로
격상하지 않는다. 참고로 `duration_ms` 컬럼을 상태 필터 없이 평균 내는 소비처(대시보드/통계, 이 diff
밖 파일)가 있다는 점은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:184-185` 에 이미
별도 트래커 항목으로 등재돼 있어 이번 성능 리뷰에서 중복 지적하지 않는다. 전반적으로 성능 리스크는
낮다.

## 위험도

LOW
