# RESOLUTION — 공개 위젯 idle-wait reaper (EIA-RL-07, PR-2)

`/ai-review --branch origin/main` (SUMMARY.md, risk MEDIUM, Critical 0, Warning 7 + testing 리뷰어 journal 복구 2건) 조치. 모든 fix 는 **본 REVIEW WORKFLOW 커밋**에 담긴다.

## 조치 항목

| # | Sev | 발견 | 조치 |
|---|-----|------|------|
| W1 | WARNING (concurrency/side_effect/database 수렴) | `markWebchatIdleTimeout` 의 Execution→NodeExecution 2단계 UPDATE 가 비-트랜잭션 → 첫 커밋 후 둘째 실패 시 NodeExecution 영구 WAITING 잔류 + emit/routing 누락 + 다음 tick(status=waiting 필터) 재선정 불가(복구 경로 없음) | **FIX**: Execution+NodeExecution UPDATE 를 `dataSource.transaction` 으로 원자화(형제 `claimResumeEntry` 패턴). 롤백 시 execution 이 waiting 으로 남아 다음 tick 재시도. emit/cleanup/routing 은 커밋 후 best-effort 유지. + 에러경로 테스트(tx throw→false·DB 롤백 / emit reject→true·cancel durable). `execution-engine.service.ts` markWebchatIdleTimeout |
| W2 | WARNING (database) | `INNER JOIN e.trigger` 가 trigger 삭제(SET NULL) execution 을 reaper 후보에서 영구 배제 | **문서화(의도적 보수)**: INNER JOIN 은 `auth_config_id IS NULL`(익명 위젯) **확인 가능한** execution 에만 회수 적용 — trigger-less 는 익명성 증명 불가라 비-위젯 오회수 위험이 있어 위젯 reaper provable 범위 밖(별개 관심사=trigger 삭제 cascade/가드). 코드 주석 추가. `interaction-token.service.ts` findIdleWebchatExecutionIds |
| W3 | WARNING (architecture/maintainability) | 4개 conditional-cancel 메서드(cancelParked/markExecutionCancelled/markQueueWaitTimeout/markWebchatIdleTimeout) 골격 중복 | **DEFER(후속 리팩터)**: `conditionallyCancelExecution` 공통 private 헬퍼 추출은 4개 engine 메서드의 behavior-preserving 리팩터라 회귀 위험. 리뷰어 "백로그로 충분, 이번 PR 강제 아님". 별 리팩터 plan/후속 |
| W4 | WARNING (architecture/maintainability) | reconciler↔reaper sweep 스캐폴딩 + 청크 루프 중복 | **DEFER(후속 리팩터)**: `MinuteRepeatableSweepWorker` 추상 클래스 / `processInBatches` 헬퍼 추출은 EIA-RL-06·07 양쪽 동반 리팩터라 회귀 위험. 백로그 |
| W5 | WARNING (documentation) | `external-interaction.module.ts` 클래스 JSDoc Wire-up 목록이 WebchatIdleReaperService 누락(형제 reconciler 는 존재) | **FIX**: reconciler bullet 아래 reaper bullet 추가 |
| W6 | WARNING (testing/requirement) | markWebchatIdleTimeout 에러 경로(UPDATE throw→false, emit reject→true) 미검증 | **FIX**: 두 케이스 테스트 추가(W1 fix 와 함께) |
| W7 | WARNING (scope) | impl-prep 산출물(19_12_18)이 무관 graph-rag/auth 분석 포함(worktree 명 편향) | **조치 불요**: SUMMARY 가 이미 self-triage(실제 PR-2 는 EIA-RL-07 뿐). graph-rag CRITICAL 은 별건 task(`task_29ab68ff`) flag 완료 |
| T1 | WARNING (testing, journal 복구) | findIdleWebchatExecutionIds batchLimit 하한(0/음수→1) 미검증(sibling 비대칭) | **FIX**: 하한 clamp 테스트 추가(sibling reconcile 동형) |
| T2 | WARNING (testing, journal 복구) | reap REAP_CONCURRENCY(10) 청크 경계 집계 미검증(최대 2건만) | **FIX**: 12건(2청크) 전량 처리 + 성공분만 revoke 테스트 추가 |

**INFO(다수) 처리**: 확인만/저위험 — I1(engine 재검증 defense-in-depth: JSDoc 에 "사전검증 executionId 만" 경고는 W2 주석으로 부분 커버), I2(execution_token per_execution 암묵의존: 코드 주석 문서화됨), I3(N+1: REAP_CONCURRENCY 완화·1분/500건 상한상 저위험, 조치 불요), I4(engine God-Service 채널 어휘 유입: 기존 컨벤션 연장, 백로그), I5(RECONCILE_BATCH_MAX 이름 재사용: 기능 무해). 대부분 백로그/조치 불요.

## TEST 결과

- **lint**: 통과
- **unit**: 통과 (backend 8090+ — reaper/token/engine 신규·에러경로·clamp·chunk 테스트 포함)
- **build**: 통과
- **e2e**: 통과 (253 tests; `PASS test/webchat-idle-reaper.e2e-spec.ts` 51.5s — reaper 실 Postgres 판정쿼리 + W1 트랜잭션 cancel 재검증, 만료→회수/미만료→유지)

## impl-done SPEC-CONSISTENCY 게이트 (`review/consistency/2026/07/11/20_25_42/`, BLOCK: NO)

journal 복구로 5/5 checker Critical 0 확정. 반영:
- **WARNING(cross_spec·convention 수렴)**: 신규 큐 `webchat-idle-reaper` 가 `system-status-api.md §1` 큐 표 미등재(PROJECT.md 매핑 필수 위치) → **행 추가**(terminal-revoke 미러).
- **INFO(convention)**: EIA-RL-07 행에 `WEBCHAT_IDLE_REAP_GRACE_MS`(기본 3600000ms) 명시 + §10 파일 트리에 reaper 2파일 추가 → 반영.
- **WARNING(naming_collision)**: 신규 식별자군 `Webchat*`(WebchatIdleReaperService·markWebchatIdleTimeout 등)가 코드베이스 기존 `WebChat*`(WebChatAppearanceDto·WebChatCorsModule) casing 과 불일치 → **DEFER**: feature 는 #916-locked `WEBCHAT_IDLE_TIMEOUT`(wire error.code)와 내부 일관(`webchat`/`WEBCHAT`)이고, 코드베이스 `WebChat`/`web-chat` 정렬은 파일명·큐 문자열·미러문서 전반 wide 리네임(wire error.code 는 불변)이라 별 후속(`task_6e435243` DRY 리팩터에 병합)으로 이관. 비차단·wire/behavior 무영향.
- **INFO(1-data-model §2.13/§2.14)**: 예시 열거·cancelled 정의 문구 보완 — 별도 정리 작업(저우선).

## 보류·후속 항목

- **W3/W4 DRY 리팩터** — `conditionallyCancelExecution` 헬퍼(4 engine 메서드) + `MinuteRepeatableSweepWorker`/`processInBatches`(EIA-RL-06·07 sweep). behavior-preserving 리팩터라 별 후속 plan 으로 이관(이번 PR 강제 아님, 리뷰어 백로그 권고).
- **graph-rag KB 토큰 통계 spec-impl 갭**(impl-prep CRITICAL, 무관) — 별건 `task_29ab68ff` flag 완료.
