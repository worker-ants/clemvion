# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `create`/`update`/`regenerate`/`remove` 시그니처 변경 — 호출자 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove` 메서드
- 상세: 4개 메서드 모두 `userId: string`(필수) + `ipAddress?: string`(선택) 파라미터가 추가되어 함수 시그니처가 변경됐다. NestJS DI 범위 내에서 이 서비스를 직접 호출하는 코드는 controller 단일이며, controller 도 동일 변경에서 `@CurrentUser('sub')` + `@Req()` 전파로 함께 갱신됐다. 테스트 파일도 `USER` 상수로 일괄 반영했으므로 현재 코드베이스 안에서 누락된 호출자는 확인되지 않는다. 이번 변경이 새로운 breaking 부작용을 추가한 것은 아니다.
- 제안: 향후 batch/cron 등 비 HTTP 경로에서 이 서비스를 직접 호출할 경우 `userId` 출처 컨벤션을 별도로 정의해 두는 것이 좋다.

---

### [INFO] `auditLogsService.record` — save 이후 best-effort 비동기 호출, 전역 상태 변경 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove` 각 메서드 말미
- 상세: 주 DB 저장 성공 후 `await this.auditLogsService.record(...)` 를 추가로 호출한다. JSDoc에 명시된 대로 `AuditLogsService.record` 는 내부에서 오류를 swallow 하므로 audit DB 장애가 주 CRUD 트랜잭션을 롤백하지 않는다. 전역 변수·파일시스템·환경 변수·외부 네트워크 호출·이벤트 콜백에 대한 의도치 않은 부작용은 없다. 이는 기존 `reveal` 메서드의 동일 패턴을 확장한 것이며 의도된 설계다.
- 제안: 특이사항 없음.

---

### [INFO] `remove` — 엔티티 삭제 후 감사 기록 순서 (best-effort 범위 내 known trade-off)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `remove` 메서드
- 상세: `authConfigRepository.remove(config)` 로 레코드를 삭제한 **후** `auditLogsService.record(...)` 를 호출한다. `record()` 가 실패하면 삭제 이벤트가 감사 로그에 기록되지 않는다. best-effort 계약 내에서는 허용 범위이며, JSDoc에 "롤백 없음" 이 명시되어 있다. 직전 리뷰 세션(`21_50_33`, `22_12_03`)에서도 동일 패턴이 INFO 수준으로 확인됐으며, 이번 변경으로 새로 도입된 위험은 없다.
- 제안: 엄격한 감사 추적이 요구될 경우 `remove` 이전에 `record` 를 먼저 호출하는 방향을 고려할 수 있으나 현재 설계 범위 내에서 blocking 이슈 아님.

---

### [INFO] `AUDIT_ACTIONS` 상수 추가 — `AuditAction` union 타입 additive 확장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/audit-logs/audit-action.const.ts` — `AUTH_CONFIG_CREATE`, `AUTH_CONFIG_UPDATE`, `AUTH_CONFIG_DELETE`, `AUTH_CONFIG_REGENERATE` 추가
- 상세: `as const` 객체에 4개 값이 추가되면 `AuditAction` union 타입이 확장된다. 이 객체는 export된 읽기 전용 상수로, 추가는 전역 상태 변경이 아니다. 기존 exhaustive switch/case 나 직접 문자열 비교를 사용하는 소비 코드가 없는 한 breaking 변경이 아니다. 감사 로그 조회 API 또는 프론트엔드 필터 UI가 action 값을 열거형 화이트리스트로 엄격 검증하는 경우 신규 4종 값 인지가 필요하나, 이는 additive change 의 일반적인 결과이므로 의도치 않은 부작용으로 보기 어렵다.
- 제안: `AuditAction` union 을 소비하는 외부 코드(프론트엔드 enum 등)가 있다면 신규 값 처리 여부를 확인할 것.

---

### [INFO] `AUTH_CONFIG_RESOURCE_TYPE` 모듈 스코프 상수 도입 — 기존 `reveal` 인라인 리터럴 대체
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 라인 29
- 상세: `'auth_config'` 문자열을 `AUTH_CONFIG_RESOURCE_TYPE` 상수로 추출하고 기존 `reveal` 의 인라인 리터럴도 이 상수로 대체했다. 이 상수는 모듈 스코프 `const` 이며 export 되지 않으므로 외부 상태 오염이 없다. 기존 `reveal` 동작에 런타임 변경은 없다.
- 제안: 현행 유지.

---

### [INFO] `reveal` 테스트 내 `audit.record.mockClear()` 추가 — 테스트 격리 개선
- 위치: `auth-configs.service.spec.ts` — `reveal` describe 블록 내 음성 테스트 케이스
- 상세: `create` 호출 단계에서 `auth_config.create` audit 기록이 이미 남아 있기 때문에, reveal 실패가 audit 를 기록하지 않음을 독립적으로 검증하기 위해 `mockClear()` 를 추가했다. 이는 신규 CRUD audit 도입에 따른 필수 보정이며 부작용 없음. 다른 테스트에 영향을 주지 않는 `beforeEach` 스코프 내 격리다.
- 제안: 특이사항 없음.

---

### [INFO] 컨트롤러 `req.ip` 직접 사용 — 기존 `reveal` 패턴 확장, 신규 부작용 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` — `create`, `update`, `regenerate`, `remove` 핸들러
- 상세: `req.ip` 를 `ipAddress` 로 전달하는 패턴은 기존 `reveal` 핸들러에 이미 적용되어 있으며, 이번 변경은 동일 패턴을 4개 핸들러에 확장한 것이다. 이번 변경으로 새로운 환경 변수 접근, 외부 네트워크 호출, 파일시스템 부작용은 없다. `req.ip` 는 Express의 `trust proxy` 설정에 의존하며 감사 로그 정확성에 영향을 줄 수 있으나, 이는 기존 `reveal` 과 동일한 수준의 known trade-off 다.
- 제안: spec §2.3 의 IP 추출 정책(`CF-Connecting-IP → X-Forwarded-For → req.ip`)을 공통 헬퍼로 추출해 `reveal` 포함 모든 핸들러에 일관 적용하는 것은 `auth-config-webhook-followups.md §3` 후속 작업으로 추적 중.

---

## 요약

이번 변경은 `AuthConfigsService` 의 `create/update/regenerate/remove` 4개 메서드에 `userId`(필수) + `ipAddress?`(선택) 파라미터를 추가하고 각 CRUD 성공 후 best-effort 감사 로그를 기록하는 것이 핵심이다. 시그니처 변경은 controller 와 테스트 파일이 함께 갱신되어 기존 호출자 범위 내에서 누락이 없으며, 빌드·단위·e2e 테스트 통과가 이를 뒷받침한다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 의도치 않은 접근, 외부 네트워크 호출, 이벤트/콜백 변경은 없다. `AUDIT_ACTIONS` 상수 확장은 additive 이며 breaking 변경이 아니다. `AUTH_CONFIG_RESOURCE_TYPE` 상수 도입은 기존 `reveal` 인라인 리터럴을 대체하는 DRY 정리로 런타임 동작 변경 없음. `remove` 후 감사 기록 순서 및 `req.ip` 직접 사용은 기존 `reveal` 구현과 동일 패턴이며, 이번 변경으로 새로 도입된 위험은 없다.

## 위험도

LOW
