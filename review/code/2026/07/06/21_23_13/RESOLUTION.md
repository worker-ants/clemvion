# RESOLUTION — 알림 하드닝 ai-review (21_23_13)

## 조치 항목

| SUMMARY # | 내용 | 조치 | commit |
| --- | --- | --- | --- |
| WARNING 1 | `background_run_id` "REST 미노출" 의도-구현 괴리 (직렬화 필터 부재) | entity 컬럼에 `select: false` 추가 — 기본 SELECT 배제로 REST 미노출 강제. `findByBackgroundRun` 은 WHERE 절만 쓰므로 무관 | 656fc7cce |
| WARNING 2 | `findByBackgroundRun`/`notify`/`createMany` 의 `backgroundRunId` 직접 unit 테스트 부재 | `notifications.service.spec.ts` 에 unit 3건 추가 (findByBackgroundRun where 절 / notify·createMany 의 backgroundRunId 저장) | 656fc7cce |
| WARNING 3 | processor `resourceId: data.workflowId` 무조건 사용 전제 미검증 | `BackgroundExecutionJob.workflowId` 는 non-optional `string` (타입 보증) — no code change 필요. legacy(backgroundRunId='') 케이스는 processor.spec 이 커버 | — |
| WARNING 4 | 배포 이전 `background_failed` row backfill 없음 문서화 미흡 | spec-update draft `spec-update-notifications-background-run-id.md` Rationale 에 "backfill 없음(의도된 trade-off)" 명시 | 656fc7cce |
| WARNING 5 | `notify`/`createMany` JSDoc 이 `backgroundRunId` 파라미터 미설명 | 두 메서드 JSDoc 에 "per-run attribution 전용, REST 비노출, V107" 추가 | 656fc7cce |
| WARNING 6 | 프론트 `href.ts`/`NotificationLite` 옛 resource_type 분기 잔존 우려 | 확인: href.ts 는 `type` 으로 라우팅(resource_type 분기 없음), 프론트 `background_run` 참조는 WS 이벤트명뿐 — dead code 없음. no change | — |
| WARNING 7 | `Notification` 엔티티 컨텍스트별 전용 컬럼 누적(God-entity 초기 신호) | 현재 1개, 조치 불요 — 두 번째 attribution 키 등장 시 metadata jsonb/서브테이블 전환 트리거로 기록 | — |

## 추가 조치 — e2e 가 적발한 선존 PR3 버그 2건 (SUMMARY 범위 밖, 항목 2 e2e 의 실질 성과)

| 버그 | 근인 | 수정 | commit |
| --- | --- | --- | --- |
| A. `execution_failed` 재개 세그먼트 실패 경로 dispatch 누락 | PR3 는 초기 세그먼트 `runExecution` catch 에만 dispatch 배선. 일반 실행은 대부분 rehydration(재개) 세그먼트로 종결되며 `finalizeResumedExecutionOutcome` 가 dispatch 미호출 | 재개 종결 FAILED 분기에 `dispatchExecutionFailedNotification` 추가 | 656fc7cce |
| B. `notificationsService` @Optional undefined | `ExecutionEngineService` 가 WebsocketModule 등과 forwardRef 순환 그래프라 NotificationsModule 보다 먼저 인스턴스화 → 생성자 @Optional 주입이 undefined → dispatch guard no-op | `getNotificationsService()` 가 ModuleRef(strict:false) 로 런타임 지연 해석 (codebase 의 WebsocketService 지연해석 패턴) | 656fc7cce |

> 두 버그 모두 unit 화이트박스(mock)로는 검출 불가였고, 실 인프라 e2e + 격리 docker backend 로그 계측으로 진단. e2e 격리 실행 2/2 pass + 전체 e2e 238 pass.

## TEST 결과
- lint: 통과
- unit: 통과 (신규 notifications.service.spec 3건 포함, ExecutionEngineService DI 변경 후에도 기존 spec 통과)
- build: 통과
- e2e: 통과 — 전체 238 tests / 41 suites pass. 신규 `execution-failed-notification.e2e-spec.ts` 2/2, `background-monitoring.e2e-spec.ts` pass. (docker daemon 가용 확인 후 `.claude/tools/run-test.sh e2e` 수행)

## 보류·후속 항목
- spec 본문 반영(§2.1/§2.19/§1.1/Rationale + 12-background §8.2)은 developer 가 spec read-only 라 `plan/in-progress/spec-update-notifications-background-run-id.md` 로 planner 위임.
- 항목 3(dispatchEmails decouple) 은 분석 완료·결정 대기(사용자) — 코드 변경 없음.
- 엔진 변경분(execution-engine.service.ts)은 별도 재리뷰 세션(review/code/2026/07/06/22_42_32) + `/consistency-check --impl-done` 로 사후 검증.
