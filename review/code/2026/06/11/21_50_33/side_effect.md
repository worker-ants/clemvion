# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `create`/`update`/`regenerate`/`remove` 시그니처 변경 — 호출자 영향
- 위치: `auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove` 메서드
- 상세: 4개 메서드 모두 `userId: string` (필수) + `ipAddress?: string` (선택) 파라미터가 추가되어 함수 시그니처가 변경됐다. NestJS DI 범위에서는 controller 만이 이 메서드를 직접 호출하며, controller 도 동일 PR 에서 `@CurrentUser('sub')` + `@Req()` 전파로 함께 수정됐다. 테스트 파일도 `USER` 상수를 추가해 일괄 반영했다. 현재 코드베이스 안에서 누락된 호출자는 확인되지 않는다.
- 제안: 특이사항 없음. 단, 추후 이 service 를 다른 service 에서 직접 import 해 사용하는 경우(예: batch/cron 경로) `userId` 를 어디서 가져올지 컨벤션을 정해 두는 것이 좋다.

### [INFO] `auditLogsService.record` 호출 — save 이후 best-effort 비동기 호출
- 위치: `auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove` 각 메서드 말미
- 상세: DB save 완료 후 `await this.auditLogsService.record(...)` 를 호출한다. JSDoc 에 명시된 대로 `AuditLogsService.record` 는 내부에서 오류를 swallow 하므로 audit DB 장애가 주 CRUD 트랜잭션을 롤백하지 않는다. 즉, save 성공 → audit 실패 조합이 가능하다. 이는 의도된 설계(best-effort)이며 spec 과 일치한다.
- 제안: 특이사항 없음.

### [INFO] `remove` — 엔티티 삭제 후 감사 기록 순서
- 위치: `auth-configs.service.ts:1750–1758`
- 상세: `authConfigRepository.remove(config)` 로 레코드를 DB 에서 삭제한 **후** `auditLogsService.record(...)` 를 호출한다. `remove` 가 성공하고 `record` 가 실패하면 삭제 이벤트가 감사 로그에 기록되지 않는다. `record` 의 best-effort 계약 내에서는 허용 범위지만, 삭제의 특성상 `remove` 이전에 감사 로그를 먼저 기록하는 방향이 더 안전하다(감사 기록 후 삭제 실패 시 false positive 발생 우려는 있으나, 삭제 후 기록 실패보다 감사 추적 관점에서 덜 위험함). 현재 설계는 best-effort 정책과 일관성이 있어 blocking 이슈는 아니다.
- 제안: 엄격한 감사 추적이 요구될 경우 `remove` 이전에 `record` 를 호출하는 것을 고려.

### [INFO] `AUDIT_ACTIONS` 상수 추가 — `AuditAction` union 타입 확장
- 위치: `audit-action.const.ts` — `AUTH_CONFIG_CREATE`, `AUTH_CONFIG_UPDATE`, `AUTH_CONFIG_DELETE`, `AUTH_CONFIG_REGENERATE` 추가
- 상세: `as const` 객체에 4개 값이 추가되면 `AuditAction` union 타입이 확장된다. 기존 exhaustive switch 나 타입 좁히기(`action === 'auth_config.reveal'` 식의 직접 비교)는 영향 없다. 새 값을 기존 switch/filter 가 처리하지 않으면 fallthrough 처리되는데 이는 union 확장의 일반적인 결과이므로 의도하지 않은 부작용으로 보기 어렵다.
- 제안: `AuditAction` union 을 소비하는 코드(예: 프론트엔드 감사 로그 필터 enum 등)가 있다면 신규 값 처리 여부를 확인할 것.

### [INFO] controller — `req.ip` 사용 (프록시 환경 주의)
- 위치: `auth-configs.controller.ts` — `create`, `update`, `regenerate`, `remove` 핸들러
- 상세: `req.ip` 는 Express 의 `trust proxy` 설정에 따라 달라진다. `reveal` 핸들러도 동일한 패턴으로 이미 구현되어 있어 이번 변경이 새로운 부작용을 추가한 것은 아니다. 단, `trust proxy` 가 설정되지 않으면 프록시 뒤 배포 시 모든 IP 가 프록시 IP 로 기록될 수 있다.
- 제안: spec §2.3 세션 정책의 `CF-Connecting-IP → X-Forwarded-For → req.ip` 우선순위 정책이 감사 로그 IP 추출에도 일관되게 적용되는지 확인. `reveal` 과 CRUD audit 간 IP 추출 방식이 달라지지 않도록 주의.

---

## 요약

이번 변경은 `AuthConfigsService` 의 CRUD 4개 메서드에 `userId`/`ipAddress` 파라미터를 추가하고, 각 메서드 말미에 `auditLogsService.record(...)` best-effort 호출을 삽입했다. 함수 시그니처 변경은 controller 와 테스트 파일이 함께 수정되어 기존 호출자 범위 내에서 누락이 없다. 전역 변수·파일시스템·환경 변수·외부 네트워크 호출·이벤트 콜백의 의도치 않은 변경은 발견되지 않는다. `AUDIT_ACTIONS` 상수 추가는 union 타입 확장이며 기존 exhaustive 소비 코드가 없는 한 breaking 변경이 아니다. `remove` 후 audit 기록 순서 및 `req.ip` 직접 사용은 기존 `reveal` 구현과 동일 패턴이므로 이번 변경으로 새로 도입된 위험은 없다.

## 위험도

LOW
