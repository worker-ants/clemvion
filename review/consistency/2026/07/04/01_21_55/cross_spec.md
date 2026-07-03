# Cross-Spec 일관성 검토 — impl-done (spec/5-system/4-execution-engine.md §7.1/§7.2/§7.3/§7.5, PR3)

## 검토 모드
--impl-done, diff-base=origin/main, target spec=`spec/5-system/4-execution-engine.md`
구현 변경: `recoverStuckExecutions` 를 "stale RUNNING 일괄 FAILED 마킹" → "started_at 원자 re-claim + §7.5 case B rehydration re-drive" 로 전환 (PR3, 2026-07-04). 신규 test-only 엔드포인트 `POST /_test/recover-stuck-executions` 추가.

## 발견사항

검토 결과 CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았다. 아래는 확인 과정에서 점검한 항목과 그 결과(모두 정합)다.

- **[INFO]** 에러 코드·데이터 모델·상태 전이 문구가 이미 선제 동기화됨
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 표("attempts 소진"), §7.5 "case B 원자 re-claim"
  - 대조 대상: `spec/1-data-model.md` §2.13 (Execution.error 필드 설명), `spec/5-system/3-error-handling.md` §1.4, `spec/conventions/error-codes.md` (`WORKER_HEARTBEAT_TIMEOUT` 행), `spec/data-flow/3-execution.md` (상태 다이어그램 주석)
  - 상세: 이번 target 변경(PR3: "일괄 FAILED" → "제어된 re-drive")과 관련해 `WORKER_HEARTBEAT_TIMEOUT` 코드의 "PR3 기간 미발동, PR4 예약" 문구가 4개 spec 파일(data-model, error-handling, error-codes, data-flow/3-execution) 모두에서 동일하게 이미 갱신되어 있다. 상태 다이어그램(`data-flow/3-execution.md`)도 "WORKER_HEARTBEAT_TIMEOUT 은 PR4 stalled 예약 — PR3 미발동" 주석을 포함해 상태 전이 문서와 어긋나지 않는다.
  - 제안: 없음 (이미 정합). 참고로만 기록.

- **[INFO]** `§2.13 동기화` 상호 참조 정합성 확인
  - target 위치: `spec/5-system/4-execution-engine.md` L827, L1461 ("§2.13 동기화")
  - 대조 대상: `spec/1-data-model.md` §2.13 Execution
  - 상세: target 이 언급하는 "§2.13" 은 동일 파일 내 번호가 아니라 `spec/1-data-model.md` §2.13(Execution 엔티티)을 가리키는 cross-file 참조다. 실제로 그 절의 `error` 필드 설명이 PR3/PR4 상태를 정확히 반영하고 있어 참조가 유효하다.
  - 제안: 없음.

- **[INFO]** RBAC — 신규 test-only 엔드포인트 권한 모델
  - target 위치: `codebase/backend/src/modules/executions/executions.controller.ts` 신규 `POST _test/recover-stuck-executions` (`@Roles('owner')`)
  - 대조 대상: 동일 컨트롤러의 기존 `@Roles('editor')`(`re-run` 등), `spec/5-system/1-auth.md` 의 owner/editor/viewer 3-tier RBAC 모델
  - 상세: 새 권한 구조를 도입하지 않고 기존 가장 제한적 role(`owner`)을 재사용했으며, 추가로 `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이팅 + `@ApiExcludeEndpoint()` 로 프로덕션 표면 차단을 문서화했다(코드 주석에 ai-review security 대응 근거 명시). 기존 RBAC 모델과 충돌 없음.
  - 제안: 없음.

- **[INFO]** 라우트 경합 여부
  - target 위치: `executions.controller.ts` 라우트 등록 순서 — `:id/stop`, `:id/continue`, `_test/recover-stuck-executions`, `:id/re-run`, `:id/chain`
  - 상세: 신규 라우트는 파라미터 세그먼트가 없는 정적 경로(`_test/recover-stuck-executions`)이므로 `:id/...` 동적 라우트와 세그먼트 수·리터럴이 달라 매칭 경합이 없다.
  - 제안: 없음.

- **[INFO]** §8 active-running 추적 재사용 확인
  - target 위치: `reclaimStuckRunningExecution` 내 `recordRunningSegmentStart` 호출(§8 tracking baseline 재사용 주석)
  - 대조 대상: `spec/5-system/4-execution-engine.md` §8, `claimResumeEntry` 콜사이트의 동일 메서드 사용
  - 상세: 신규 개념이 아니라 기존 §8 active-running 타임아웃 추적에 쓰이던 `recordRunningSegmentStart` 를 case B 진입점에도 동일하게 적용한 것 — 코드 검증(`git grep`) 결과 pre-existing 메서드 재사용이 맞다. §8 spec 변경 불필요.
  - 제안: 없음.

- **[INFO]** 옛 "자식 RUNNING NodeExecution cascade FAILED" 문구의 spec 잔존 여부
  - target 위치: `spec/5-system/4-execution-engine.md` 전체
  - 상세: 코드에서 제거된 "recoverStuckExecutions 가 직접 자식 NodeExecution 을 cascade FAILED" 로직에 대응하는 옛 문구가 spec 본문에 잔존하는지 확인했으나 없음 — target 문서가 이미 새 책임 분할(re-drive 진입 시 `failOrphanRunningNodeExecutions` 로 이관)을 반영해 갱신되어 있다.
  - 제안: 없음.

## 요약
target 은 `recoverStuckExecutions` 의 동작을 "stale RUNNING 일괄 FAILED" 에서 "원자 re-claim + §7.5 case B rehydration re-drive" 로 전환하는 PR3 변경이며, 코드·target spec·연관 spec(`1-data-model.md` §2.13, `5-system/3-error-handling.md`, `conventions/error-codes.md`, `data-flow/3-execution.md`)이 모두 `WORKER_HEARTBEAT_TIMEOUT` 코드의 "PR3 미발동/PR4 예약" 상태 전이 서술로 이미 동기화되어 있다. 신규 test-only 엔드포인트는 기존 owner/editor RBAC 3-tier 모델을 그대로 재사용하고, 라우트·데이터 모델·상태 머신·요구사항 ID·계층 책임(engine 내부 orphan-cascade 이관) 어느 관점에서도 다른 spec 영역과의 직접 모순이나 정의 중복이 발견되지 않았다.

## 위험도
NONE
