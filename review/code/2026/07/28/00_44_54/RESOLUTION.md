# RESOLUTION — 00_44_54 (retry-turn.service 5라운드 ai-review) — **수렴 판정**

## 판정: 이 PR 범위에서 수렴. 코드 변경 0건.

수렴 근거는 "발견 0" 이 아니라 **발견의 성격 전환**이다.

| 라운드 | 이 PR 이 바꾼 라인에서 나온 결함 |
|---|---|
| 1R | 있음 — JSDoc 고아 (+ 전제 반증된 지적 1건) |
| 2R | 있음 — 멱등 분기의 lifecycle 필드 유실 |
| 3R | 있음 — 멱등 분기가 `affected` 미확인 |
| 4R | 있음 — CANCELLED 시 `stop()` 취소 시각 오염 |
| **5R** | **없음** |

5라운드의 CRITICAL 1건과 WARNING 8건은 **전부 이 diff 밖**이다 — 같은 파일의 인접
pre-existing 코드, 또는 이미 plan 에 등재된 후속, 또는 project-planner 범위다.
`--route=all` 로 파일 전체를 검토하기 때문에 표면화된 것이지 이 PR 이 만든 것이 아니다.

reviewer 자체 판정도 이를 뒷받침한다:

- `scope` = **NONE** — "`git diff origin/main...HEAD` 전수 확인 결과 `finalizeGuarded` 신설 +
  두 종결 경로 교체 외 무관 변경 없음(포맷팅/임포트/설정 변경도 없음)".
- `database` = 신규 CRITICAL/WARNING **0건** — "guarded UPDATE 는 CAS 패턴으로 정확".
- `concurrency` 를 제외한 13개 reviewer 전원 LOW/NONE.

## CRITICAL #1 — pre-existing 확인, 이 PR 범위 밖 (defer)

`applyRetryLastTurn` 재진입 가드(`spawnedRow.status !== RUNNING`)의 비원자성.
**reviewer 의 provenance 주장을 그대로 받지 않고 직접 실측했고, 주장이 맞았다:**

1. 이 PR 의 diff hunk 는 `@@ -20`, `-414`, `-429`, `-436`, `-631`, `-640`, `-655` —
   **문제 라인(272~287)을 포함하는 hunk 가 하나도 없다.**
2. `git blame -L 272,287 origin/main` → 전 행이 `0c275dd7f0` 소유. 즉 `origin/main` 에
   이미 있던 코드다.
3. 최초 도입은 `3213a4a55` (`#361`, retry_last_turn Phase D).

처분: **defer.** 사유 — (a) 이 PR 이 겨냥한 것은 "종결 경로의 무가드 terminal 쓰기" 이고
그 축은 4라운드에 걸쳐 닫혔다, (b) 원자 claim 전환은 `claimResumeEntry` 계열 재설계 +
동시성 e2e 가 필요한 별도 작업이다, (c) 사용자가 명시적으로 이 항목(plan W1)을 이번 PR
범위에서 제외했다.

**단, 심각도를 올려 plan 에 반영한다** — 2·3·4R 에서 WARNING 이던 것이 파일 전체 검토에서
CRITICAL 로 승격됐고, 리뷰어가 구체적 트리거(BullMQ stalled-job 복구,
`CONTINUATION_WORKER_CONCURRENCY` 상향, multi-instance 중복 job)와 영향(락 없는
인스턴스-로컬 `ExecutionContext` 공유로 대화 상태 훼손, 중복 LLM 과금, Cafe24/MakeShop/MCP
등 실 부수효과 도구의 중복 실행)을 제시했다. 이 근거를 plan 에 전재한다.

## WARNING 처분

| # | 카테고리 | 처분 | 사유 |
|---|---|---|---|
| 1 | api_contract | defer + plan 신규 등재 | `EXECUTION_CANCELLED` payload 에 spec §4.1 필수 `cancelledBy` 누락. **pre-existing 확인** — 이 PR 은 `status: execution.status` → `finalStatus` 만 바꿨고 payload 에 `cancelledBy` 는 원래부터 없었다. WS 이벤트 계약 변경이라 소비자(`chat-channel.dispatcher.ts`) 영향 확인이 필요해 별도 작업 |
| 2 | architecture | defer | 멱등 분기의 driver choke point 우회. capability 승격은 구조 변경 |
| 3 | documentation | defer (기존 plan W2) | forwardRef stale 주석. 모듈 레벨 순환 실측 필요 |
| 4 | maintainability | defer + plan 신규 등재 | 멱등 분기에 2~4R 회고 주석 약 40줄 누적 > 실제 코드 6~7줄. **지적은 타당하다.** 다만 수렴 판정 규칙("Critical 0 이후 코드를 더 건드리지 않는다")에 따라 이번 턴에는 손대지 않는다 — 여기서 주석을 정리하면 리뷰가 다시 stale 이 되어 6라운드가 열린다. 안정화 후 별도 정리 |
| 5 | maintainability | defer (기존 plan W3) | `markSpawnedRowFailed` 추출 |
| 6 | testing | defer + plan 신규 등재 | `retryLastTurn` atomic-consume SQL 이 어느 계층에서도 미검증(리뷰어가 커버리지 리포트로 200행 uncovered 실측, `test/` grep 0건). pre-existing 코드 |
| 7 | testing | defer (기존 plan INFO 14) | `!nodeExec` / `retryAfterSec` fallback / 타임스탬프 부재 분기 미검증 |
| 8 | SPEC-DRIFT | **project-planner 위임** + plan 등재 | `spec/5-system/4-execution-engine.md` 자기모순 — 줄 77·1454(2026-06-06)는 "park 없이 종결되면 cancel 은 무효과", 줄 79-92(2026-07-27 #1023)는 "park 여부 무관 cancel 보존". **코드·테스트가 후자를 증명하므로 코드는 유지**하고 spec 을 정정해야 한다. developer 권한 밖 |

INFO 23건 — 조치 없음. 주요 항목은 plan 후속으로 등재.

## 이번 라운드 검증 (코드 무변경이므로 재테스트 대신 가드 실측)

**mutation 13/13 검출** (`retry-turn.service.ts` 대상, 원복은 `cp` + 절대경로):

| 뮤턴트 | 대상 가드 | 결과 |
|---|---|---|
| M1 | 3R: FAILED/COMPLETED 분기 `affected` 판정 | RED |
| M2·M3·M4 | 2R: `.set()` 의 `finishedAt`/`durationMs`/`error` | RED |
| M5 | 1R: `canTransition` 검사 | RED |
| M6 | 1R: 정본 재대입 `execution.status = live.status` | RED |
| M7 | 2R: 멱등 UPDATE 의 `andWhere` 관측상태 조건 | RED |
| M8 | row 부재 시 `false` 반환 | RED |
| N1 | 4R: CANCELLED 전용 분기 | RED |
| N2·N3 | 4R: `finishedAt`/`durationMs` COALESCE 보존 | RED |
| N4 | 4R: CANCELLED 분기 `affected` 판정 | RED |
| N5 | 4R: CANCELLED SET 절 `error` 재기록(W16 위반) | RED |

**1차 실행에서 M1·M7 이 GREEN 으로 보일 뻔했다** — 4R 이 추가한 CANCELLED 분기가 들여쓰기만
다른 동일 문자열을 만들어, 기존 앵커(6·8칸)가 신규 문자열(8·10칸)의 부분문자열로도 매칭돼
치환 대상이 2건이 됐다. 드라이버가 매칭 건수를 단언해 `TARGET_NOT_UNIQUE` 로 걸러냈고,
앵커에 개행 접두를 붙여 재실행하니 둘 다 RED 였다. 건수 단언이 없었다면 **살아있는 가드를
"미검출" 로 오판**했을 것이다.

**TypeORM raw-SQL 바인딩 정적 검증** — 4R 이 도입한 `.set({ col: () => 'COALESCE(col, :p)' })`
+ `setParameter` 는 **코드베이스에 선례가 없는 신규 패턴**이고(기존 `.set()` raw 식은 전부
`NOW()` 등 파라미터 없는 형태), 단위 테스트는 query builder 를 mock 하므로 SQL 유효성을
검증하지 못한다. TypeORM 0.3.30 소스에서 세 고리를 확인했다:

1. `UpdateQueryBuilder.createUpdateExpression()` — 메타데이터 분기가
   `escape(column.databaseName) + " = " + value()` 로 raw 식을 삽입 → `finished_at` 매핑 정확.
2. `QueryBuilder.setParameter()` → `expressionMap.parameters` 적재 (키 정규식
   `/^([A-Za-z0-9_.]+)$/` 통과).
3. `QueryBuilder.getQueryAndParameters()` → `escapeQueryWithParameters(조립된 전체 SQL, …)`
   이므로 raw 식 안의 `:newFinishedAt` 도 치환 대상.

**한계 명시**: docker 미기동으로 실 DB 실행 검증은 못 했다. 위는 정적 근거다.
플레이스홀더 타입 추론(`COALESCE(timestamp, $1)`)은 Postgres 가 컬럼 타입에서 유도하므로
문제없다고 판단하나, 이 경로를 실제 DB 로 밟는 e2e 는 없다 — plan 후속으로 등재.

TEST WORKFLOW 는 4R 커밋(`2c5930ded`) 시점에 전량 통과했고 이후 코드 변경이 없다:
backend 412 suites / 8332, frontend 281 files / 5741, `@workflow/web-chat` 3/48,
`channel-web-chat` 23 files / 409, 내부 packages 9 suites / 218, e2e backend jest 46/260 +
Playwright 51. FAIL 0. (mutation 후 원복은 `git diff` 비어있음으로 확인.)
