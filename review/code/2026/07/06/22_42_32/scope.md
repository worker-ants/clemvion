# 변경 범위(Scope) Review

## 리뷰 대상
커밋 `656fc7cce1ef8480a38f97744966e2a1d85491db` — "fix(execution-engine): execution_failed 실제 미발사 2건 수정 (e2e 적발) + 리뷰 반영"

## 발견사항

- **[INFO]** 코드 변경은 커밋 메시지가 명시한 두 버그(A: 재개 세그먼트 dispatch 누락, B: notificationsService @Optional undefined)와 정확히 1:1 대응
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - 상세: (1) `ModuleRef` import + `getNotificationsService()` 지연 해석 헬퍼 추가, (2) 재개 세그먼트 FAILED 종결 분기에 `dispatchExecutionFailedNotification` 호출 1줄 추가, (3) 기존 `dispatchExecutionFailedNotification` 내부에서 `this.notificationsService` 직접 참조를 `getNotificationsService()` 호출로 치환. 세 변경 모두 커밋 메시지가 서술한 근인(circular DI 인스턴스화 순서, dispatch 배선 누락)과 정확히 대응하며, 그 외 로직 변경(리팩토링·구조 변경)은 없음.
  - 제안: 없음. 스코프 적절.

- **[INFO]** `background-execution.processor.ts` 변경은 JSDoc 주석 3줄 추가뿐 — 커밋 메시지의 "#16 processor docstring" 항목과 일치
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:41-46`
  - 상세: `notifyOnFailure` 관련 클래스 docstring 에 `background_failed` 타입명·`background_run_id` 컬럼 참조를 명시적으로 덧붙인 순수 문서 보강. 코드 로직 변경 없음.
  - 제안: 없음.

- **[INFO]** `notification.entity.ts` 의 `select: false` 추가는 이전 SUMMARY(21_23_13) WARNING #1 의 직접 후속 조치이며 스코프 내
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:264-271`
  - 상세: 이전 리뷰가 "REST 미노출" 의도-구현 괴리를 지적했고, 이번 커밋이 `select: false` 로 실제 강제. 주석도 이유·영향 범위(`findByBackgroundRun` 은 WHERE 절만 사용하므로 무관)를 정확히 설명. 요청 범위(리뷰 반영) 내.
  - 제안: 없음.

- **[INFO]** `notifications.service.spec.ts` 신규 테스트 3건은 SUMMARY WARNING #2 의 직접 후속 조치
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.spec.ts:293-480`
  - 상세: `findByBackgroundRun` where절 검증 1건 + `notify`/`createMany` 의 `backgroundRunId` 반영 검증 2건. 기존 describe 블록 사이에 삽입되었고 기존 테스트 변경 없음 — 순수 추가.
  - 제안: 없음.

- **[INFO]** `notifications.service.ts` 변경은 JSDoc 2단락 추가뿐 (SUMMARY WARNING #5 후속)
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:262-267, 295-301`
  - 상세: `notify`/`createMany` 메서드 JSDoc 에 `resourceType`/`resourceId` vs `backgroundRunId` 역할 구분 설명 추가. 로직 변경 없음.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/notif-hardening-followups.md`, `plan/in-progress/spec-update-notifications-background-run-id.md` 변경은 진행상황 기록·backfill 노트 추가로 실제 작업 내용과 일치
  - 위치: 두 파일 모두
  - 상세: 항목 2 섹션에 버그 A/B 서술과 체크박스 갱신, spec-update draft 에 "backfill 없음" 노트 추가(SUMMARY WARNING #4 후속). 실제 코드 변경 사실을 정확히 반영하며 plan 라이프사이클 규약에 부합.
  - 제안: 없음.

- **[INFO]** `review/code/2026/07/06/21_23_13/*` (SUMMARY, _retry_state.json, 각 관점별 리뷰 .md 12개) 커밋 포함은 이 저장소의 기존 관례와 일치
  - 위치: `review/code/2026/07/06/21_23_13/**`
  - 상세: 직전 "feat" 커밋(`797488494`)도 자신의 `/consistency-check` 산출물(`review/consistency/2026/07/06/20_58_46/**`)을 동일 커밋에 포함시킨 선례가 있음 — 구현 커밋에 그 구현을 검토한 리뷰 산출물을 같은 커밋(또는 바로 다음 fix 커밋)에 묶어 커밋하는 것이 이 프로젝트의 확립된 패턴. 이번 fix 커밋이 그 리뷰(SUMMARY 21_23_13)의 findings 를 실제로 반영하는 커밋이므로, 리뷰 산출물을 같이 포함시킨 것은 "무관한 파일"이 아니라 동일 작업 단위(review→fix 사이클)의 자연스러운 산출물. 다만 이 review 디렉터리 자체는 이번 fix 작업이 "생성"한 것이 아니라 "이전 세션이 생성했고 이번 커밋 시점에 처음 git add 된 것"으로 보이며, git 이력상 별도 커밋으로 분리할 수도 있었던 파일들이 이번 fix 커밋에 합쳐졌다는 점은 커밋 단위의 응집도 관점에서 사소한 논쟁거리가 될 수 있음(코드 fix 커밋과 "이전 리뷰 산출물 커밋"이 하나로 묶임).
  - 제안: 문제 삼을 수준은 아님. 향후에도 review 산출물은 그것이 대상으로 한 구현 커밋 직후(또는 그 리뷰를 반영하는 fix 커밋)와 함께 커밋하는 현재 관례를 유지하면 됨.

- **[INFO]** 포맷팅/임포트/주석 관련 이상 없음
  - 위치: 전체 diff
  - 상세: 불필요한 공백/줄바꿈 변경, 미사용 임포트, 무관한 주석 수정 없음. 유일한 신규 import(`ModuleRef` from `@nestjs/core`)는 실제로 코드에서 사용됨.
  - 제안: 없음.

## 요약
이번 커밋은 커밋 메시지가 명시한 두 버그(재개 세그먼트 dispatch 누락, notificationsService circular-DI undefined)의 수정과, 직전 코드 리뷰(SUMMARY 21_23_13)의 WARNING 5건(#1, #2, #4, #5, #16) 반영이라는 두 가지 명확한 목적에 모든 diff hunk 가 1:1 로 대응한다. 의도 이상의 리팩토링, 요청하지 않은 기능 확장, 무관한 파일 수정, 포맷팅 잡음은 발견되지 않았다. 리뷰 산출물 디렉터리(`review/code/2026/07/06/21_23_13/**`)를 코드 fix 와 같은 커밋에 포함시킨 점은 이 저장소가 이전 feat 커밋에서도 사용한 기존 관례와 일치하므로 스코프 이탈로 보지 않는다.

## 위험도
NONE
