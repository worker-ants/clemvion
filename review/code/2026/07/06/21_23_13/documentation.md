### 발견사항

- **[INFO]** 마이그레이션 V107 주석 문서화 — 모범 사례
  - 위치: `codebase/backend/migrations/V107__notification_background_run_id.sql`
  - 상세: 배경(선존 결함)·해소 방안·안전성(nullable + partial index → CONCURRENTLY 불요)·V047 과의 명명 유사성 비주의 사항·DOWN 마이그레이션까지 헤더에 모두 명시. `COMMENT ON COLUMN`으로 DB 레벨 문서까지 남겨 매우 충실하다. 별도 조치 불요.

- **[INFO]** `background-execution.processor.ts` 인라인 주석이 관련 spec/§ 참조를 정확히 유지
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` (dispatchFailureNotification 직전 주석, `README` 격 모듈 docstring 라인 260-273)
  - 상세: 딥링크/attribution 분리 로직 주석이 `href.ts`, `_layout.md §3.1`, migration V107 을 정확히 상호 참조한다. 다만 클래스 docstring(라인 260-273)은 WS 이벤트만 설명하고 `dispatchFailureNotification`이 만드는 in-app 알림의 딥링크/attribution 분리(신규 핵심 동작)는 언급하지 않는다 — 문서 자체가 틀린 것은 아니고 갱신 범위 밖(WS 채널 설명용)이라 CRITICAL은 아니나, 이번 변경으로 processor의 책임이 "WS emit + notification 적재(딥링크/attribution 분리)" 로 커진 만큼 docstring에 한 줄(`notification 딥링크=workflow / attribution=background_run_id, migration V107` 등) 추가를 권고.
    - 제안: 클래스 docstring 끝에 "Background 실패 알림의 resource_type/resource_id 는 딥링크(workflow)용, per-run attribution 은 `backgroundRunId`(V107)로 분리 — §2.1" 한 줄 보강.

- **[WARNING]** `NotificationsService.notify`/`createMany` JSDoc이 최신 파라미터(`backgroundRunId`)를 언급하지 않음
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts` (`notify(entry: {...})`, `createMany(entries: Array<{...}>)`) — 라인 259 근방, 271-334 근방(diff 기준)
  - 상세: 두 메서드 시그니처에 `backgroundRunId?: string` 파라미터가 신규 추가됐고 조건부 대입(`if (entry.backgroundRunId) row.backgroundRunId = ...`)까지 구현됐지만, 두 메서드 위에 이 필드의 의미·용도(딥링크와 분리된 per-run attribution 전용, REST 미노출)를 설명하는 JSDoc/주석이 없다. `findByBackgroundRun`은 새 JSDoc으로 잘 설명됐으나, 정작 이 필드를 채우는 쓰기 경로(notify/createMany)에는 설명이 없어 "왜 이 필드가 있는지"를 호출자가 `notification.entity.ts`나 processor 주석을 따로 찾아야 한다.
  - 제안: `notify`/`createMany` 파라미터 목록 주석에 "`backgroundRunId?`: Background 본문 실패 알림의 per-run attribution 전용 (REST 비노출, migration V107)" 한 줄 추가.

- **[WARNING]** DTO(`NotificationDto`) JSDoc은 이번 커밋에서 정확히 갱신됐으나, 프론트엔드 소비 측 타입/문서(`NotificationLite`, `href.ts`)의 대응 갱신 여부가 이 payload 범위에서 확인 불가
  - 위치: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts`
  - 상세: 리뷰 대상 diff는 백엔드만 포함하고 프론트엔드 `href.ts`/`NotificationLite` 파일은 포함되어 있지 않다. consistency-check(`naming_collision.md`, `cross_spec.md`)가 이미 이 갭을 WARNING/INFO로 지적했고 develop plan(`notif-hardening-followups.md`)에도 명시적 체크리스트 항목은 없다. `resourceType`이 이제 항상 `workflow`로 고정되므로 프론트가 여전히 `background_run`/`execution` 값을 분기 처리하는 코드가 남아있다면 dead code가 되거나, 반대로 `background_run_id`를 참조하려는 시도가 있다면 REST 미노출로 실패한다.
  - 제안: 프론트엔드 `href.ts`/알림 관련 타입에 옛 `resource_type` 값(`execution`, `background_run`) 참조가 남아있는지 별도 확인하고, 남아있다면 정리 또는 주석으로 "레거시 값, 신규 데이터는 발생하지 않음" 명시.

- **[INFO]** 새 e2e 스펙(`execution-failed-notification.e2e-spec.ts`)의 파일 상단 주석이 검증 범위를 명확히 서술 — 모범 사례
  - 위치: `codebase/backend/test/execution-failed-notification.e2e-spec.ts` 1-20행
  - 상세: 무엇을 검증하는지(top-level 실행 실패 attribution, background 격리 시 중복 미발사), 왜 필요한지(기존 unit은 화이트박스만 존재), 전제조건(실 BullMQ 인프라)까지 명시. 다른 e2e 파일과 스타일이 일관된다. 조치 불필요.

- **[INFO]** `background-monitoring.e2e-spec.ts`의 회귀 방지 주석("옛 resource_id=backgroundRunId (딥링크 404) 회귀 방지")이 왜 이 assertion이 존재하는지 명확히 설명 — 양호.
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts` 라인 958-963 부근
  - 상세: 조치 불필요.

- **[INFO]** spec 갱신이 코드와 동일 PR에 포함되지 않고 별도 `plan/in-progress/spec-update-notifications-background-run-id.md`로 위임된 것은 CLAUDE.md 규약("spec/ 은 developer read-only, 변경 필요 시 project-planner 위임")을 정확히 준수한 처리이며, 갱신 대상(`8-notifications.md §1.1/§2.1`, `1-data-model.md §2.19`, `12-background.md §8.2`, Rationale)도 consistency-check WARNING을 모두 반영해 빠짐없이 열거되어 있다. 실측 확인 결과 `spec/data-flow/8-notifications.md` §1.1 `background_failed` 행과 §2.1 "리소스 attribution 조회" 행, `spec/1-data-model.md §2.19` 필드 표 모두 현재 코드(`background_run_id` 컬럼, `findByBackgroundRun`)를 아직 반영하지 않은 상태임을 직접 확인 — 이는 이미 별도 plan 문서가 정확히 포착한 known gap이며 spec 갱신은 planner 턴에서 처리될 예정이므로 본 리뷰에서 추가 조치 불요. 다만 이 갭이 남아있는 동안(다음 PR까지) `NotificationsService.findByResource` 관련 정보를 스펙 문서에서 찾는 사람은 옛 계약을 보게 되므로, spec-update PR을 지체 없이 처리할 것을 재확인 권고(이미 계획서에 "즉시 반영" 명시됨).

- **[INFO]** `executions.module.ts`의 갱신된 주석(`findByBackgroundRun()`로 정정)은 실제 코드와 일치 — 오래된 주석 없음. 조치 불필요.

### 요약

이번 변경은 알림 딥링크/attribution 분리라는 핵심 설계 변경에 대해 마이그레이션 헤더, entity 컬럼 주석, processor 인라인 주석, DTO JSDoc, e2e 스펙 주석 모두 일관되고 정확하게 갱신되었으며 spec 참조(`§3.1`, `§2.1`, `V107`)도 상호 정합하다. 다만 (1) `NotificationsService.notify`/`createMany`의 JSDoc이 신규 `backgroundRunId` 파라미터의 의미를 설명하지 않는 점, (2) processor 클래스 docstring이 신규 알림 attribution 분리 책임을 반영하지 않는 점은 경미한 보완 대상이다. spec 문서(`8-notifications.md`, `1-data-model.md §2.19`, `12-background.md §8.2`) 갱신은 developer가 직접 손댈 수 없는 영역이라 별도 plan(`spec-update-notifications-background-run-id.md`)으로 적절히 위임되어 있으며, 코드-스펙 drift 창을 최소화하기 위해 해당 spec-update가 지체 없이 처리되어야 한다는 점만 재확인이 필요하다. 전반적으로 문서화 수준은 높다.

### 위험도
LOW
