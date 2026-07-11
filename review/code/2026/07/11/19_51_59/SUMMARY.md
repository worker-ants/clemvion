# Code Review 통합 보고서

대상: EIA-RL-07 공개 웹채팅 위젯 idle-wait execution 회수 reaper — `WebchatIdleReaperService` +
`ExecutionEngineService.markWebchatIdleTimeout` + `InteractionTokenService.findIdleWebchatExecutionIds`
및 관련 모듈 배선·env·spec/plan 동기화 문서.

## 전체 위험도

**MEDIUM** — CRITICAL 없음. 다만 `markWebchatIdleTimeout` 의 비-트랜잭션 2단계 DB UPDATE 가 부분 실패 시
상태 불일치(emit/cleanup/routing 누락, NodeExecution 영구 잔류)를 남긴다는 지적을 side_effect·concurrency·
database 3개 리뷰어가 독립적으로 수렴 확인했고, DB 리뷰어는 이 reaper 가 §7.4 의 유일한 backstop 인
경로가 trigger 삭제 시 조용히 우회되는 재현 가능한 edge case 도 추가로 발견했다. 두 건 모두 기존 패턴을
계승한 것이라 신규 결함은 아니나, 무인·자동·대량 반복(매분 최대 500건) 경로로 노출 표면이 확대됐다는
점에서 WARNING 등급 유지가 타당하다. 설계 전반(멱등 조건부 UPDATE, 배치 상한, bounded concurrency,
TOCTOU 안전성, spec-코드 동기화)은 여러 리뷰어가 견고하다고 확인했다.

**참고**: `testing` 리뷰어는 매니페스트상 `status=success` 로 보고됐으나 `testing.md` 출력 파일이 디스크에
존재하지 않았고, 세션 저널(jsonl)·백그라운드 태스크 출력에서도 원문을 복구할 수 없었다(disk-write 갭).
따라서 본 리포트는 testing 리뷰어의 발견사항 없이 나머지 10개 리뷰어(architecture, concurrency, database,
documentation, maintainability, performance, requirement, scope, security, side_effect)만으로 집계됐다 —
테스트 커버리지 관점 검증은 사실상 공백이며 재실행 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/부작용/DB | `markWebchatIdleTimeout` 의 Execution→NodeExecution 2단계 UPDATE 가 단일 트랜잭션이 아님. 첫 UPDATE 커밋 후 두 번째 UPDATE·`finalizeRehydrationCleanup`·`emitExecution`·`releaseExecutionRouting` 구간에서 예외가 나면 outer catch 가 흡수해 `false` 반환하지만 Execution 은 이미 `cancelled` 로 커밋된 상태. 결과: NodeExecution 이 `waiting_for_input` 로 영구 잔류(형제 메서드 `cancelParkedExecution` 이 명시한 불변식 위반), `EXECUTION_CANCELLED` emit 누락으로 SSE/WS 클라이언트 미통지, `WebsocketService.executionRouting` Map 엔트리 영구 누수, 다음 tick 후보(`status=waiting_for_input` 필터)에서도 영구 제외되어 재시도 경로 없음. 토큰 자체는 EIA-RL-06 reconciler 가 별도로 self-heal 하나 그 외 부수 상태는 복구 경로가 없다. 무인·매분·최대 500건 자동 반복 경로라 기존 1회성 사용자 취소 대비 노출 빈도·감지 지연이 커진다(side_effect·concurrency·database 3개 리뷰어 독립 수렴). | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:981-1058`(`markWebchatIdleTimeout`) | `claimResumeEntry`(1066행 이하)가 이미 사용 중인 `this.dataSource.transaction(...)` 패턴으로 Execution+NodeExecution UPDATE 를 단일 트랜잭션으로 묶어 부분 실패 창을 제거. emit/cleanup/routing-release 는 커밋 후 best-effort 로 유지. 부분 실패 시나리오 unit 테스트 추가. |
| 2 | 데이터베이스 | `findIdleWebchatExecutionIds` 의 `INNER JOIN e.trigger` 가 trigger 삭제(`execution.trigger_id ON DELETE SET NULL`) 시 해당 execution 을 reaper 후보 집합에서 영구 배제한다. 이 reaper 가 §7.4/§R19 상 "park 는 engine recovery scanner 대상 아님"의 유일한 backstop 인데, trigger 가 살아있는 `waiting_for_input` execution 도중 삭제되면(가드 미확인) 토큰이 전량 만료돼도 회수되지 않고 DB row 가 무기한 잔존한다. | `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` (`findIdleWebchatExecutionIds`) | `LEFT JOIN e.trigger` + `(t.authConfigId IS NULL OR t IS NULL)` 로 완화하거나, 의도적 범위 제외라면 spec §R19 에 근거를 명시하고 trigger/workflow 삭제 시 활성 `waiting_for_input` execution 존재를 막는 가드 검토. |
| 3 | 아키텍처/유지보수성 | `ExecutionEngineService` 의 "조건부 status-guard UPDATE → affected 체크 → guarded emit → outer try/catch" 골격이 `cancelParkedExecution`/`markExecutionCancelled`/`markQueueWaitTimeout`/신규 `markWebchatIdleTimeout` 4곳에 거의 동일하게 복제됐다. 신규 메서드의 JSDoc 은 두 형제의 "합성"이라 명시하지만 실제 구현은 호출/합성이 아니라 처음부터 다시 타이핑된 독립 사본 — 문서(합성)와 코드(복제)가 어긋난다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:910-964, 981-1058, 2622-2694, 2702-2745` | `conditionallyCancelExecution(executionId, { fromStatuses, code, message, cancelledBy, cancelNodeExecution, releaseRouting })` 형태의 공통 private 헬퍼로 추출, 4개 메서드를 얇은 래퍼로 축소(백로그 항목으로 충분, 이번 PR 강제 아님). |
| 4 | 아키텍처/유지보수성 | BullMQ repeatable-sweep 워커 스캐폴딩(`@Processor`+`OnModuleInit`+`upsertJobScheduler`+fail-open try/catch)과 bounded-concurrency 청크 처리 루프(`Promise.allSettled` 청크 → 성공/실패 분기)가 기존 `TerminalRevokeReconcilerService`(EIA-RL-06)와 신규 `WebchatIdleReaperService` 사이에 거의 동일하게 중복 작성됐다. 한쪽만 고치고 다른 쪽을 놓치는 회귀(fail-open 누락, opts 불일치 등) 위험. | `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts` vs `terminal-revoke-reconciler.service.ts`; 청크 루프는 `interaction-token.service.ts:397-412` vs `webchat-idle-reaper.service.ts:929-946` | Template Method 패턴의 공통 추상 클래스(예: `MinuteRepeatableSweepWorker`) 또는 `processInBatches<T,R>(items, concurrency, fn, onError)` 공용 헬퍼로 추출. |
| 5 | 문서화 | `external-interaction.module.ts` 모듈 클래스 JSDoc 의 "Wire-up" bullet 목록이 신규 `WebchatIdleReaperService` 를 누락 — 형제인 `TerminalRevokeReconcilerService` 항목은 이미 존재해 누락이 더 두드러지며, 이 docblock 을 SoT 요약으로 신뢰하는 리더가 "reaper 미배선"으로 오판할 수 있다. | `codebase/backend/src/modules/external-interaction/external-interaction.module.ts`(파일 상단 `@Module` 직전 클래스 docblock, diff 미포함 구간) | `TerminalRevokeReconcilerService` 항목 바로 아래에 `WebchatIdleReaperService (EIA-RL-07 — 공개 위젯 idle-wait execution 회수, BullMQ repeatable)` bullet 추가. |
| 6 | 테스트/요구사항 | `markWebchatIdleTimeout` 의 에러 경로 — Execution UPDATE 자체가 throw(→ `false` 반환)와 emit 이 reject 해도 cancel 은 유지되고 `true` 반환하는 두 시나리오 — 가 신규 유닛 테스트에서 미검증. 현재는 성공 2분기(affected:0/affected:1)만 커버되며, 동일 파일의 형제 메서드(`cancelParkedExecution` 등)는 이미 다수 에러 분기를 테스트하고 있어 커버리지 갭이 상대적으로 두드러진다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:218-280`, `execution-engine.service.spec.ts:2732-2820` | `execute()` 를 reject 시키는 mock 과 `emitExecution` 을 reject 시키는 mock 두 케이스를 추가해 (a) DB 예외 시 `false`+로그, (b) emit 실패해도 `true`(cancel 유지)를 고정. |
| 7 | 스코프 | impl-prep consistency-check 산출물(`review/consistency/2026/07/11/19_12_18/**`, 6개 파일)이 이번 PR 의 실제 변경 영역(EIA §14 reaper)과 무관한 `spec/5-system/1-auth.md`(WebAuthn), `spec/5-system/10-graph-rag.md`(KB 토큰 통계 CRITICAL 등)를 광범위하게 분석한 내용을 diff 노이즈로 포함시킨다. SUMMARY 자신이 "worktree 명이 타겟 선정을 편향시켜 `spec/5-system/` 전체가 딸려옴 — 실제 PR-2 는 EIA-RL-07 reaper 뿐" 이라고 self-triage 로 명시. | `review/consistency/2026/07/11/19_12_18/SUMMARY.md`, `convention_compliance.md`, `naming_collision.md`, `plan_coherence.md`, `meta.json`(`target_path: spec/5-system/`) | 재작업 불요(이미 self-triage 완료). 향후 `--impl-prep` 호출 시 `target_path` 를 실제 착수 spec(`spec/5-system/14-external-interaction-api.md`)으로 좁혀 무관 산출물 혼입을 줄일 것. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `markWebchatIdleTimeout` 이 engine 계층에서 "공개 위젯(anonymous)" 자격을 재검증하지 않고 호출자(reaper)의 사전 필터링에 전적으로 의존 — 현재 유일 호출자라 악용 경로 없음, 향후 다른 호출자가 재사용하면 정상 대기 execution 이 검증 없이 취소될 위험. | `execution-engine.service.ts:981-1043` | JSDoc 에 "사전검증된 executionId 만 호출" 경고 명시하거나 engine 쪽에도 `trigger.authConfigId IS NULL` join 조건 추가(defense-in-depth). |
| 2 | 보안 | `findIdleWebchatExecutionIds` 가 `execution_token` row 존재 자체를 per_execution 접근 증거로 암묵 의존(EIA-AU-04 invariant, 코드 주석에 문서화됨) — 향후 per_trigger 토큰도 같은 테이블에 기록되도록 스키마가 바뀌면 인증 트리거의 정상 대기가 조기 취소될 가용성 리스크. | `interaction-token.service.ts:548-572` | 스키마 변경(예: `token_family` 필드 추가) 시 본 쿼리도 함께 갱신하도록 spec/코드 상호 참조 유지. |
| 3 | 성능 | `reap()` 의 per-execution 순차 DB 왕복(execution UPDATE→node_execution UPDATE→revoke SELECT/DELETE, N+1 형태) — `REAP_CONCURRENCY=10` 청크 병렬로 완화되며 1분 주기+500건 상한상 실사용 트래픽에서 병목 가능성 낮음. | `webchat-idle-reaper.service.ts:922-956`, `execution-engine.service.ts:217-279` | 현재 조치 불요. 향후 포화 징후 시 벌크 UPDATE 2단계화 또는 concurrency 상향 고려(system-status 큐 모니터링으로 조기 신호 확보됨). |
| 4 | 아키텍처 | `ExecutionEngineService`(~8,000줄 God-Service)에 채널(webchat) 특화 어휘·하드코딩 에러코드(`WEBCHAT_IDLE_TIMEOUT`)가 채널-불가지론적이어야 할 코어 엔진 계층에 유입 — 기존 컨벤션(`markExecutionCancelled` 의 resume 전용 code union)의 연장이라 신규 위반은 아님. | `execution-engine.service.ts:981-1058` | 장기적으로 엔진은 범용 `cancelWaitingExecution` primitive 만 노출하고 채널별 상수는 호출측(EIA 모듈)이 주입하는 방향 검토(백로그, 즉시조치 불요). |
| 5 | 유지보수성/아키텍처/문서화 | `RECONCILE_BATCH_MAX` 상수(EIA-RL-06 "reconcile" 전용으로 명명)가 EIA-RL-07 `findIdleWebchatExecutionIds` 의 batchLimit clamp 상한으로도 재사용되어 이름이 실제 용도보다 좁다. 값·의도(과대입력 방어)는 두 sweep 에 맞아 기능상 문제는 없음. | `interaction-token.service.ts:54, 381, 440` | `SWEEP_BATCH_MAX` 등 중립적 이름으로 리네임하거나 정의부 주석에 "EIA-RL-06/07 공용" 명시. |
| 6 | 요구사항 | `findIdleWebchatExecutionIds` 쿼리가 `LIMIT` 을 쓰면서 `ORDER BY` 가 없어 후보가 batchLimit(기본 500, 상한 1000) 초과 시 매 tick 선택 순서가 Postgres 플랜상 보장되지 않음(이론상 row 기아 가능) — 형제 `reconcileTerminalRevocations` 의 기존 패턴을 그대로 답습한 것으로 신규 결함 아님. | `interaction-token.service.ts:443-456` | 필요 시 `ORDER BY et."executionId"` 추가로 결정적 순서 보장(형제 메서드와 동시 처리하는 후속 항목으로 충분). |
| 7 | 부작용 | reaper 도입으로 이전엔 `waiting_for_input` 로 무기한 침묵 잔존하며 어떤 terminal 이벤트도 만들지 않던 익명 위젯 세션이, 매분 스윕마다 새로 `EXECUTION_CANCELLED`(`cancelledBy:'timeout'`)를 emit — 조직에 webhook 알림이 설정돼 있다면 "취소됨" 알림 볼륨 증가 가능(§R19 의도된 backstop 동작, 버그 아님). | `execution-engine.service.ts:252-260` | 조치 불요. 배포 후 notification-webhook 큐 볼륨 관찰 권장. |
| 8 | 부작용 | 신규 BullMQ 큐 등록(`WEBCHAT_IDLE_REAPER_QUEUE`)으로 `onModuleInit` 이 실패(예: Redis 장애)하면 Nest 모듈 부팅 자체가 fail-fast — 형제 `TerminalRevokeReconcilerService`(EIA-RL-06)와 완전히 동일한 선례 패턴이라 신규 리스크 유형은 아님. | `external-interaction.module.ts:16,55`, `webchat-idle-reaper.service.ts:32-46` | 조치 불요 — 기존 규약 준수. 배포 런북 반영 여부만 확인. |
| 9 | 문서화 | EIA §3.4 EIA-RL-07 행/§R19 가 grace 값을 제어하는 실제 env 변수명(`WEBCHAT_IDLE_REAP_GRACE_MS`)·기본값(1h)을 spec 본문에 명명하지 않음 — 유사 개념(admission 큐 대기 타임아웃)은 타 spec 문서에서 변수명+기본값을 직접 병기하는 기존 컨벤션과 불일치(`.env.example`/CHANGELOG 에는 정확히 문서화돼 있음). | `spec/5-system/14-external-interaction-api.md` §3.4/§R19 | EIA-RL-07 행 또는 R19 본문에 "`WEBCHAT_IDLE_REAP_GRACE_MS`(기본 `3600000`ms/1h)" 1회 병기. |
| 10 | 데이터베이스 | `execution_token.exp_at` 에 별도 인덱스 없음 — `waiting_for_input` 활성 집합이 작게 유지되는 현재 규모에서는 문제 없음(기존 `idx_execution_status`/`idx_execution_token_execution_id` 로 충분). | `migrations/V060__execution_token_jti_tracking.sql`, `interaction-token.service.ts` (`HAVING MAX(et.expAt) < threshold`) | 조치 불요 — 플랫폼 전체 `waiting_for_input` 볼륨이 크게 늘어나는 경우에 대한 장기 관찰 포인트로만 기록. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | INFO 2건 — engine 계층 자격 재검증 부재(호출자 pre-filter 전적 의존), `execution_token` per_execution invariant 암묵 의존. 둘 다 현재 악용 경로 없음. |
| performance | LOW | INFO 4건 — per-execution 순차 DB 왕복(N+1, concurrency 로 완화), 인덱스 정합 확인, Redis 왕복 사실상 no-op, `execution_token` 장기 누적 완화 긍정 효과. |
| architecture | LOW | WARNING 2건 — "조건부 cancel+emit" 4중 복제, BullMQ sweep 워커 스캐폴딩 복제. INFO 2건(채널 어휘 유입, 상수명 재사용). 모듈 경계·순환의존 없음은 긍정 확인. |
| requirement | LOW | WARNING 1건 — `markWebchatIdleTimeout` 에러 경로 unit 테스트 갭. INFO 1건(비결정적 LIMIT, 기존 패턴). SPEC-DRIFT 없음 — spec 5문서 flip 이 코드와 라인 단위로 일치함을 직접 확인. |
| scope | LOW | WARNING 1건 — impl-prep 산출물에 PR 과 무관한 auth/graph-rag 분석 혼입(self-triage 완료). 핵심 코드 변경은 EIA-RL-07 단일 목적에 정확히 스코핑됨. |
| side_effect | MEDIUM | WARNING 1건 — 비트랜잭션 2단 UPDATE 부분 실패 시 emit/cleanup/routing 누락(자동·대량 스윕이라 노출 빈도 확대, 토큰 자체는 self-heal). INFO 4건(알림 볼륨 증가 가능성, 부팅 fail-fast 확대 등). |
| maintainability | LOW | WARNING 2건 — cancel+emit 4중 복제, 청크 동시성 루프 중복. INFO 4건(reconciler 와 책임분리 불일치, `RECONCILE_BATCH_MAX` 재사용, REAPER/REAP 네이밍 비대칭, CHANGELOG 가독성). 신규 파일 자체 품질은 양호. |
| testing | 재시도 필요 | `testing.md` 출력 파일이 디스크에 없음(status=success 로 보고됐으나 disk-write 갭). 세션 저널·백그라운드 태스크 출력에서도 원문 복구 불가 — 테스트 커버리지 관점 검증 공백. |
| documentation | LOW | WARNING 1건 — 모듈 JSDoc "Wire-up" 목록에 신규 서비스 누락(stale). INFO 2건(spec 본문에 env 변수명 미기재, 상수 재사용 주석 부재). 그 외 spec 5문서 동기화는 모범적으로 평가. |
| database | LOW(부분 WARNING) | WARNING 1건 — trigger 삭제 시 reaper 후보에서 영구 배제(backstop 우회). INFO 2건(비트랜잭션 2단 UPDATE — 신규 리스크 아님, exp_at 인덱스 부재 — 현재 문제 없음). |
| concurrency | LOW | WARNING 1건 — 2단 UPDATE 비트랜잭션 부분 실패(side_effect/database 와 동일 근본 원인, 메커니즘 상세 확인). INFO 2건 — 조건부 UPDATE 기반 경합 처리 견고함, bounded concurrency/중복실행 방지 설계 적절함(긍정 확인). |

## 발견 없는 에이전트

없음 — testing 을 제외한 10개 에이전트 전원이 최소 INFO 이상 발견사항을 보고했다.

## 권장 조치사항

1. (최우선) `markWebchatIdleTimeout` 의 Execution+NodeExecution UPDATE 를 `dataSource.transaction()` 으로 원자화 — side_effect·concurrency·database 3개 리뷰어가 독립 수렴한 최다 지적 사항이며, 부분 실패 시 emit/cleanup/routing 누락과 재시도 불가라는 실질 운영 리스크가 있다. 부분 실패 unit 테스트도 함께 추가.
2. `findIdleWebchatExecutionIds` 의 `INNER JOIN e.trigger` 를 `LEFT JOIN` + `(t.authConfigId IS NULL OR t IS NULL)` 로 완화하거나, trigger 삭제 edge case 를 spec §R19 에 의도적 배제로 명시 — 이 reaper 가 유일한 backstop 인 경로가 조용히 우회되지 않도록.
3. `testing` 리뷰어를 재실행 — output 파일이 디스크·세션 로그 어디에서도 복구되지 않아 이 PR 의 테스트 커버리지 관점 검증이 사실상 누락돼 있다.
4. `markWebchatIdleTimeout` 의 에러 경로(DB 예외 시 `false`, emit 실패해도 `true`) unit 테스트 추가.
5. `external-interaction.module.ts` 클래스 JSDoc "Wire-up" 목록에 `WebchatIdleReaperService` 항목 추가.
6. (백로그, 비긴급) "조건부 cancel+emit" 4중 복제와 BullMQ repeatable-sweep 워커 스캐폴딩 중복을 공통 헬퍼/추상 클래스로 통합하는 리팩터링 항목 등재.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (11명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 소스 코드/spec/.env 변경에 대해 상시 강제 적용되는 카테고리)
  - **제외**: 3명 — 구체적 라우터 사유 텍스트는 매니페스트에 포함되지 않았으며(라우터가 관련성 낮음으로 판단한 것으로 추정), 재요청 시 `_routing_decision.json` 원문 확인 필요.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단상 이번 diff 와 관련성 낮음(신규 외부 의존성 없음 — 다른 리뷰어들도 동일하게 확인) — 구체 사유 텍스트 미제공 |
  | api_contract | 라우터 판단상 이번 diff 와 관련성 낮음(신규 REST 엔드포인트 없음, 순수 백그라운드 BullMQ backstop — 다른 리뷰어들도 동일하게 확인) — 구체 사유 텍스트 미제공 |
  | user_guide_sync | 라우터 판단상 이번 diff 와 관련성 낮음(사용자 대면 UI/가이드 변경 없음, 순수 백엔드 backstop) — 구체 사유 텍스트 미제공 |