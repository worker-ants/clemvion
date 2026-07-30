# RESOLUTION — 20_32_57 (retry-turn.service 원자 claim 삽입 위치 결함, 6차 라운드)

대상: `fix(engine): retry_last_turn 재진입의 비원자 가드 — 조건부 UPDATE claim 으로 교체 (#10 동반)` (`b351731f0`)
`review/code/2026/07/28/20_32_57` — Critical 2 / Warning 12.

## 조치 항목

| SUMMARY # | 분류 | 처분 | 비고 |
|---|---|---|---|
| Critical #1 (architecture/concurrency/requirement) | 코드 | 수정 | `claimSpawnedRetryRow` 호출을 "`_retryState` 부재 → FAILED" 판정보다 앞으로 이동. 그 판정 분기는 삭제, claim 실패(`affected!==1`)는 원인 구분 없이 discard 로 통일 |
| Critical #2 (side_effect) | 코드 | 수정 | claim 성공 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]` — 이후 모든 not-found 분기의 stale `save()` 가 claim 이 지운 `_retryState` 를 부활시키지 못하게 차단 |
| Warning #1 (requirement/concurrency) | 코드 | 수정 | 회귀 테스트 2건: (i) 최초 조회부터 이미 다른 delivery 가 claim 한 상태 → discard·save() 미호출, (ii) claim 성공 후 try 진입 전 예외 → FAILED 미마킹 + 재배달 시뮬레이션까지 안전 |
| Warning #2 (architecture) | plan 이관 | 코드 변경 없음 | `continuation-execution.processor.ts` 의 claim 제외 목록 타입/공유상수 강제 — 구조 변경. `retry-turn-terminal-guard.md` §코드 표 #16 신규 |
| Warning #3 (architecture/maintainability) | 코드 | 수정 | `RETRY_STATE_KEY` 상수화 — raw SQL 리터럴 4곳(신규 2 + 기존 2) + TS 프로퍼티 접근 통합 |
| Warning #4 (side_effect) | plan 이관 | 코드 변경 없음 | 크래시 트레이드오프 실제 적용 범위(일반 예외 포함) — Critical#1 수정으로 범위가 확정된 뒤 재평가 대상. `retry-turn-terminal-guard.md` §코드 표 #17 신규 |
| Warning #5 (scope) | 기록만 | 코드 변경 없음 | 무관 plan 문서 편집 2건이 이미 `b351731f0` 에 같은 커밋으로 포함됨 — 되돌리지 않음 |
| Warning #6 (maintainability) | 코드 | 수정 | claim 블록을 `private async claimSpawnedRetryRow(...): Promise<boolean>` 로 추출 (Critical#1 동반, `claimResumeEntry`/`finalizeGuarded` 네이밍 관례와 정합) |
| Warning #7 (testing/database) | plan 이관 | 코드 변경 없음 | 실 Postgres 기반 동시성 e2e 부재 — `retry-turn-terminal-guard.md` §코드 표 #3 범위를 `applyRetryLastTurn`/`claimSpawnedRetryRow` 의 2차 claim 까지 확장 |
| Warning #8 (testing) | 코드 | 수정 | `execution-engine.service.spec.ts` 통합 레벨에 claim 실패(`affected=0`) 케이스 신규 추가 + "missing `_retryState`" 케이스를 discard 로 갱신 |
| Warning #9 (documentation) | 코드 | 수정 | 클래스 docstring "책임" 문단 + `applyRetryLastTurn` "재진입 절차" 목록에 2차 claim 단계 반영 |
| Warning #10 (documentation) | 미조치 | 코드 변경 없음 | 처분표 범위 밖으로 명시 지정 — `runAiConversationLoop` stale 참조(pre-existing) |
| Warning #11 (documentation) | 미조치 | 코드 변경 없음 | 처분표 범위 밖으로 명시 지정 — `ContinuationExecutionProcessor` "처리 흐름" stale 서술(pre-existing) |
| Warning #12 (documentation) | 미조치 | 코드 변경 없음 | 처분표 범위 밖으로 명시 지정 — CHANGELOG.md 미갱신 |
| (신규) 백스톱 갭 | plan 신규 등재 | 코드 변경 없음 | discard 후 spawn row 가 RUNNING orphan 으로 영구 잔류 가능 — `failOrphanRunningNodeExecutions` 는 stale RUNNING **Execution** 재구동 경로에서만 호출돼 이 케이스(Execution 이미 `failed`)에 닿지 않음(실측). `retry-turn-terminal-guard.md` §코드 표 #15 신규 |

INFO 12건(SUMMARY 원본) — 조치 대상 아님(카운트 제외).

## 처분 근거 요약

**Critical #1** — `_retryState` 를 지우는 유일한 경로가 claim 자신이므로, RUNNING row 에서 그
값이 없다는 것은 실질적으로 100% "다른/이전 delivery 가 이미 claim 했다"는 뜻이지 손상이
아니다. 그 판정이 claim **뒤**에 있으면 살아있는(다른 delivery 가 처리 중인) row 를 FAILED
로 오마킹한다. concurrency reviewer 의 논증대로, claim 성공 후 try 진입 전 구간(Promise.all/
rehydrateContext/buildRetryReentryState/setNodeOutput/emitNode)이 try/catch 밖이라 진짜
동시성 없이도 BullMQ 기본 재시도만으로 결정적 재현이 가능했다. claim 을 최우선으로 당기고
그 판정 분기 자체를 삭제해 문제를 구조적으로 제거했다.

**백스톱 갭(리뷰어 제안과 다름 — 실측으로 확정, 반드시 남길 사실)**: 리뷰어는 "진짜
corruption 방어는 `recoverStuckExecutions` 류 backstop 에 위임"하라 했으나, 실측 결과 그
백스톱은 이 케이스에 닿지 않는다. `failOrphanRunningNodeExecutions(executionId)` 는
`recoverStuckExecutions` 의 **stale RUNNING Execution 재구동** 경로에서만 호출된다. discard
후 Execution 은 `failed`(terminal) 로 남아 재구동 대상이 아니므로, 그 spawn row 는 RUNNING
orphan 으로 영구 잔류한다. 그래도 discard 가 옳다 — 현재 코드(claim 이전 FAILED 마킹)는
살아있는 작업을 죽이고(활성 피해), discard 는 이론적 orphan row 만 남긴다(타임라인/진행률
집계 오염). 게다가 `retryLastTurn` 이 항상 `_retryState` 를 seed 하므로 "한 번도 seed 안 된
진짜 corruption"은 구조적으로 발생하지 않는다. 이 트레이드오프와 백스톱 갭을 주석
(`claimSpawnedRetryRow` JSDoc) + plan 후속(`retry-turn-terminal-guard.md` #15)으로 남겼다.

**Critical #2** — claim 은 DB `input_data` 에서만 `_retryState` 를 원자 제거하고 in-memory
`spawnedRow` 는 그대로였다. claim 성공 후 execution/node not-found 분기의 `save(spawnedRow)`
(full-entity)가 TypeORM 0.3.30 jsonb diff 로 DB 를 재-SELECT 해 stale 값과 비교, claim 이
지운 `_retryState` 를 되살릴 수 있었다(mock 기반 unit 으로는 구조적으로 검출 불가 — 리뷰어
지적대로 정적 근거로만 닫음). `delete` 한 줄로 이 메서드의 모든 하위 `save()` 호출을 함께
보호했다. not-found 분기를 targeted update 로 바꾸는 큰 변경은 지시대로 하지 않았다.

## TEST 결과

- lint  : 통과 (49s)
- unit  : 통과 — backend 412 suites/8336 tests(1 skipped), frontend 281 files/5747 tests(1
  skipped), `@workflow/web-chat` 3 suites/48, `channel-web-chat` 23 files/409, 내부 공유
  패키지 6종 합산 9 suites/218. 전 스택 0 실패.
- build : 통과 — backend/frontend/web-chat/channel-web-chat build + channel-web-chat
  typecheck + 내부 패키지 build, Dockerfile 이미지 검증 포함(backend 프로덕션 이미지 위생
  스모크: 프런트/테스트 스택 미잔존·`dist/main.js` 존재·`cron-parser` v5 해소 확인; frontend
  Dockerfile build 확인).
- e2e   : 통과 — backend jest e2e 46 suites/260 tests + Playwright 51 tests. 전부 0 실패.
  (세션 시작 시 docker daemon 미기동이었으나 Docker Desktop 기동 후 정상 진행 — 인프라
  차단 아님.)

## mutation 검증 (5/5 RED)

`retry-turn.service.ts` 대상. 각 뮤턴트는 적용 전 `grep -c`(또는 Edit 도구의 unique-anchor
요구)로 치환 앵커의 매칭 건수가 정확히 1건임을 확인했다 — 5차 라운드 RESOLUTION 이 명시한
"들여쓰기만 다른 부분문자열이 비유일 매칭을 만들어 살아있는 가드를 미검출로 오판"하는 함정
재발을 방지하기 위함. 원복은 사전 저장한 fixed 스냅샷으로 `cp`(절대경로), 매 원복 후
`diff` 로 완전 일치를 확인했다.

| 뮤턴트 | 대상 가드 | 결과 |
|---|---|---|
| (a) claim 을 손상 판정 뒤로 되돌림(pre-fix 전체, `b351731f0` 원본 복원) | Critical#1 순서 자체 | RED — retry-turn.service.spec.ts 4건 + execution-engine.service.spec.ts 1건 실패 |
| (b) in-memory `delete spawnedRow.inputData[RETRY_STATE_KEY]` 제거 | Critical#2 | RED — (d)/(e) 2건 실패 |
| (c) claim 실패 시 discard 대신 FAILED save 로 되돌림 | claim 실패 discard 불변식 | RED — (b2)/(c)/재배달 회귀 테스트 3건 실패 |
| (d) `.andWhere('status = :running', ...)` 제거 | claim SQL status CAS | RED — (b3) 1건 실패 |
| (e) `.andWhere(\`jsonb_exists(input_data, '...')\`)` 제거 | claim SQL 레이스 결정자 | RED — (b3) 1건 실패 |

원복 후 최종 상태는 `retry-turn.service.spec.ts` 41/41, `execution-engine.service.spec.ts`
436/436 재확인(GREEN).

## 보류·후속 항목

- Warning #2 — `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #16(신규): claim
  대상 제외 목록 타입/공유상수 강제.
- Warning #4 — 같은 문서 #17(신규): 크래시 트레이드오프 서술 범위 재평가.
- Warning #5 — 기록만, 이미 `b351731f0` 에 커밋됨, 되돌리지 않음.
- Warning #7 — 같은 문서 §코드 표 #3(범위 확장): 2차 claim 포함한 실 Postgres 동시성 e2e.
- Warning #10·#11·#12 — 처분표 범위 밖으로 명시 지정돼 이번 라운드 미조치. 다음
  문서-정리 턴으로 이월(같은 plan 문서에 추적 없음 — 필요 시 별도 등재 권장).
- 백스톱 갭(신규) — 같은 문서 §코드 표 #15(신규): discard 후 spawn row RUNNING orphan
  영구 잔류 가능성.

## 절대 하지 않은 것 (지시 준수 확인)

- `finalizeGuarded` / `resumeGraphAfterRetry` / `ALLOWED_TRANSITIONS` 무수정.
- claim 의 `status`/`jsonb_exists` 두 조건 모두 보존 — 뮤턴트 (d)/(e) 로 실증.
- 파일 전체 `eslint --fix`·리팩토링 drive-by 없음(diff 는 의도한 라인만; 사전 존재하던
  eslint warning 2건(`no-unnecessary-type-assertion`, 149/229행)은 손대지 않음 — 이 PR
  이전부터 있던 것으로 확인).
- not-found 분기를 targeted column update 로 바꾸는 큰 변경 없음(지시대로 `delete` 한 줄로만
  닫음).
