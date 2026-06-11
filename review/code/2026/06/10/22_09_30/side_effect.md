# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `promoteRotatedNotificationSecrets` — notification config 부재 trigger 에서 `secrets.rotate` 를 호출하기 전 early-continue 하지 않으면 v2 컬럼은 클리어되지 않는 채로 남음
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `promoteRotatedNotificationSecrets` 루프 내부
- 상세: 변경 후 코드는 `notificationCfg` 가 없으면 `continue` 로 건너뛴다. 이 경우 해당 trigger 의 `notification_secret_v2` / `notification_rotated_at` 는 클리어되지 않고 DB 에 남는다. 즉 "notification config 없이 rotateNotificationSecret API 를 호출한 trigger" (이론적으로 API 가 400 을 반환하므로 정상 경로에선 불가능하지만, 직접 DB 조작·마이그레이션·레거시 데이터 등으로 v2 컬럼이 채워진 경우) 는 매 시간 cron 이 실행될 때마다 skip 되고 v2 평문이 `notification_secret_v2` 컬럼에 영구 잔류한다. 보안 영향은 제한적이나(해당 컬럼이 인증에 사용되는 건 primary 뿐), 불필요한 평문이 DB 에 잔류하는 상태 부작용이다.
- 제안: notification config 부재 skip 경로에서도 `trigger.notificationSecretV2 = null; trigger.notificationRotatedAt = null; await triggerRepo.save(trigger)` 를 수행하거나, 최소한 `continue` 전에 경고 로그를 남겨 운영 가시성을 확보한다. 단 현재 API 가 400 을 반환하므로 정상 운영 환경에서는 발현 가능성이 낮다 — 중요도 WARNING.

### [INFO] `promoteRotatedNotificationSecrets` 에서 `secrets.rotate` 가 throw 할 경우 trigger 저장 트랜잭션이 롤백되지 않고 예외가 호출자(BullMQ job)로 전파됨
- 위치: `triggers.service.ts` — `promoteRotatedNotificationSecrets` 루프
- 상세: `await this.secrets.rotate(ref, trigger.workspaceId, secretV2)` 가 실패하면 이후의 `config` 패치 및 `triggerRepository.save` 가 실행되지 않으므로 `notification_secret_v2` 는 클리어되지 않고 v2 가 남는다. 다음 cron 시도 시 동일한 ref 에 동일한 v2 로 다시 `rotate` 를 시도하므로 (이상적으로는 idempotent), 실질적으로 재시도 안전하다. 그러나 secret store rotate 실패가 전체 job 을 fail 시켜 BullMQ backoff 재시도를 발동시키는 예상된 동작인지 명시적인 문서/주석이 없다.
- 제안: 메서드 jsdoc 에 "secret store rotate 실패 시 예외를 전파해 job retry 를 유도한다" 는 의도를 명시한다.

### [INFO] `QueryAuditLogDto.userId` 필드 추가 — 기존 호출자에 미치는 영향 없음 (옵션 필드)
- 위치: `codebase/backend/src/modules/audit-logs/dto/query-audit-log.dto.ts`
- 상세: `userId` 는 `@IsOptional()` 로 선언되어 있어 기존 호출자(클라이언트 포함)는 해당 필드를 전달하지 않아도 동작이 변경되지 않는다. 부작용 없음.
- 제안: 없음.

### [INFO] `AuditLogsController` — `@Roles('admin')` 추가로 인한 기존 접근 권한 변경 (의도된 보안 강화, 부작용 아님)
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts`
- 상세: 이전까지 인증된 워크스페이스 멤버(viewer·editor) 및 비멤버(X-Workspace-Id 위조)가 접근 가능했던 엔드포인트가 admin+ 로 제한된다. 기존 viewer/editor 클라이언트 코드가 이 엔드포인트를 호출하고 있다면 403 을 받게 된다. 이는 의도된 보안 수정이지 의도치 않은 부작용이 아니다.
- 제안: 프론트엔드에서 audit-logs 를 viewer/editor 가 호출하는 경로가 있는지 별도 확인 권장.

### [INFO] `normalizeNotificationSecretRef` — `trigger.config` 를 in-place 변경 후 `triggerRepository.save` 호출 (기존 패턴과 동일, 신규 부작용 없음)
- 위치: `triggers.service.ts` — `normalizeNotificationSecretRef`
- 상세: 전달된 `Trigger` 객체의 `.config` 를 직접 교체하는 방식이다. 이는 기존에도 동일하게 동작하고 있었고 이번 변경은 이 함수를 수정하지 않으므로 신규 부작용이 아니다.

### [INFO] e2e 테스트 (`audit-logs.e2e-spec.ts`) — `beforeAll` 에서 직접 `INSERT` 로 `audit_log` 시드
- 위치: `codebase/backend/test/audit-logs.e2e-spec.ts` — `beforeAll`
- 상세: `db.query(INSERT INTO audit_log ...)` 로 테스트 데이터를 직접 삽입한다. `afterAll` 에서 `db.end()` 만 호출하고 해당 row 를 삭제하지 않는다. e2e 테스트 DB 가 격리된 환경(per-run schema/DB)이라면 문제없으나, 동일 DB 를 재사용하는 환경에서는 누적된 시드 데이터가 다른 테스트에 영향을 줄 수 있다.
- 제안: 테스트 환경이 run-per-schema isolation 이 보장되어 있다면 현재 구조로 충분하다. 아닌 경우 `afterAll` 에서 `DELETE FROM audit_log WHERE workspace_id = $1` 추가를 검토한다.

---

## 요약

이번 변경은 두 가지 보안 수정으로 구성된다. (1) `AuditLogsController` 에 `@Roles('admin')` 데코레이터를 추가해 기존에 인증된 모든 멤버가 접근 가능하던 감사 로그 조회를 Admin+ 로 제한하는 것은 의도된 접근 제한 변경이며 의도치 않은 부작용이 아니다. (2) `promoteRotatedNotificationSecrets` 의 승격 경로를 평문 쓰기에서 secret store `rotate` 경유로 교체한 것은 기존에 rotation 이 무효화되던 버그를 수정하며, 전역 상태 변경 없이 DB 와 secret store 에 대한 쓰기가 정확히 예상 범위에 한정된다. 주목할 부작용은 notification config 가 없는 trigger 에 v2 컬럼이 채워진 비정상 상태가 존재할 경우 매 cron 주기마다 skip 되어 평문이 잔류하는 경우로, 정상 운영 환경에서는 발현 가능성이 낮다. 추가된 `QueryAuditLogDto.userId` 는 옵션 필드로 하위 호환을 유지한다.

---

## 위험도

LOW
