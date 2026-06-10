# 요구사항(Requirement) 리뷰

## 발견사항

### **[INFO]** `getNotifResourceIds` 헬퍼 — `createMany` 다중 호출 시 첫 번째 호출만 검사
- 위치: `integration-expiry-scanner.service.spec.ts` L49–52, `getNotifResourceIds` 함수
- 상세: 헬퍼는 `mock.calls[0][0]` (첫 번째 `createMany` 호출의 첫 번째 인수)만 검사한다. 실제 구현의 `run()` 에서 `notificationsService.createMany` 는 루프 종료 후 단 1회 배치 호출되므로 현재 코드에서는 결함이 없다. 그러나 향후 여러 batch 호출로 분리될 경우 두 번째 호출 이후의 resourceId 를 놓치게 된다.
- 제안: 현재 구현 패턴(단일 배치)에서는 무해하므로 INFO 처리. 구현 변경 시 헬퍼도 갱신 필요.

### **[INFO]** `hasSavedExpired` 헬퍼 — 첫 번째 `save` 호출만 검사
- 위치: `integration-expiry-scanner.service.spec.ts` L61–67, `hasSavedExpired` 함수
- 상세: `integrationRepository.save` 가 여러 차례 호출될 경우 `mock.calls[0][0]` 만 확인한다. 현재 `run()` 구현은 `integrationsToUpdate` 를 모아 단 1회 `save` 를 호출하므로 실용상 문제없다.
- 제안: 현재 구현과 일치. 변경 시 주의 필요.

### **[INFO]** 수신자 0명 시 `0d` 격하 후 알림 미발사 — 스펙 명시 없는 엣지케이스
- 위치: `integration-expiry-scanner.service.ts` L413–420
- 상세: `threshold === '0d'` 에서 `status='expired'`, `statusReason='token_expired'` 로 격하는 수행되지만 `recipients.length === 0` 인 경우 알림은 발사되지 않는다. 즉 통합을 소유한 사용자 정보가 없으면(이탈/삭제 등 엣지케이스) 격하는 되지만 알림은 없다. spec §11.2 는 수신자 조건에 대해 `personal → 소유자 / organization → Admin 전원` 을 명시하고 있어 "수신자 없음" 케이스는 침묵한다.
- 제안: 현재 동작이 합리적(알림 대상 없으면 알림 불필요). spec 에서 명시적으로 다루도록 INFO 기록.

### **[INFO]** `makeshop + refresh_token 보유` 가 7d/3d 임계에서 `claimThreshold` 를 생성하지 않는 설계 — spec `§11.2` 발사정책과 일치
- 위치: `integration-expiry-scanner.service.ts` L369–402 (`continue` 경로)
- 상세: refresh-capable provider 는 7d/3d 임계에서도 claim(dedup 키) 을 생성하지 않는다. spec §11.2 가 "refresh_token 없는 provider 에만 발사"라고 명시하므로 claim 자체를 생성 안 하는 것이 올바르다. 단, 향후 makeshop 이 refresh-capable 에서 제외될 경우 기존에 발행되지 않은 dedup 키가 없어 7d/3d 알림이 즉시 발사되는 점은 의도된 동작인지 확인 권장.
- 제안: spec 의도와 일치. INFO 처리.

### **[INFO]** `spec/2-navigation/4-integration.md` §11.2 표 — "재인증 실패" 행 조건 불명확
- 위치: `spec/2-navigation/4-integration.md` §11.2, `integration_expired` 표 4번째 행 `재인증 실패 → Reauthorization failed`
- 상세: 이 행은 이번 변경과 직접적 연관이 없지만, 본 PR 에서 `integration_action_required` 가 `error(auth_failed)` 시 active 알림을 담당한다고 명시됐음에도 `integration_expired` 표에 `재인증 실패` 행이 남아 있어 두 알림 타입 간 책임이 모호하다. 코드 구현에서 `reauthorization_failed` 케이스의 발사 경로가 불명확.
- 제안: 코드에서 직접적인 결함은 아니나, spec 일관성 관점에서 `project-planner` 가 §11.2 표의 `재인증 실패` 행 책임을 명확히 할 것을 권장.

## spec fidelity 점검

### 핵심 변경 — `isRefreshCapable` 일반화 (V-01)

**spec 근거**: `spec/2-navigation/4-integration.md` §11.1 표, §11.1 의사코드, Rationale `isRefreshCapable — makeshop 포함 결정`.

| spec 조건 | 코드 구현 | 일치 여부 |
|---|---|---|
| `service_type ∈ {cafe24, makeshop}` AND `credentials.refresh_token` 존재 | `isRefreshCapable`: `serviceType !== 'cafe24' && serviceType !== 'makeshop'` + `typeof rt === 'string' && rt.length > 0` | 일치 |
| `remain ≤ 0d` AND cafe24 → cafe24-token-refresh 큐 enqueue | `threshold === '0d' && integration.serviceType === 'cafe24'` 분기 | 일치 |
| makeshop → enqueue 없음 (in-call proactive / reactive_401) | makeshop 분기 없이 `continue` | 일치 |
| refresh_token 없는 provider → `status=expired, status_reason=token_expired` | L413–416 | 일치 |

### `token_expired` status_reason 추가 (V-07 일부)

**spec 근거**: `spec/1-data-model.md` §2.10 `status_reason` 컬럼 정의, `spec/data-flow/5-integration.md` §3.2 표.

| spec 조건 | 코드 구현 | 일치 여부 |
|---|---|---|
| `expired → token_expired` (refresh_token 없는 provider) | `integration.statusReason = 'token_expired'` | 일치 |
| `INTEGRATION_STATUS_REASONS` union 에 `token_expired` 추가 | `integration-status-reason.ts` L996 | 일치 |

### `MONITORED_QUEUES` 동기 (V-15)

**spec 근거**: `spec/5-system/16-system-status-api.md` §1 큐 레지스트리, `spec/data-flow/0-overview.md` §4 BullMQ 큐 카탈로그.

| spec 조건 | 코드 구현 | 일치 여부 |
|---|---|---|
| `makeshop-token-refresh` 큐 모니터링 포함 | `MAKESHOP_REFRESH_QUEUE, group: 'integration', concurrency: 1` 추가 | 일치 |
| e2e EXPECTED_QUEUE_NAMES 갱신 | `system-status.e2e-spec.ts` 에 `makeshop-token-refresh` 추가 | 일치 |

### passive 알림 정책 (V-07)

**spec 근거**: `spec/2-navigation/4-integration.md` §11.2 "발사 정책": **refresh_token 없는 provider 에만 발사**.

코드의 `isRefreshCapable` 분기에서 `continue` 로 즉시 빠져나가 claim/알림을 모두 건너뛰는 구현이 spec 의 7d/3d/0d 전 임계 제외 요건과 정확히 일치한다.

## 요약

이번 변경은 V-01(makeshop expired 오격하), V-07(§11.2 passive 알림 정책 채택), V-15(큐 레지스트리 동기) 세 가지 결함을 수정한다. `isCafe24RefreshCapable` → `isRefreshCapable` 일반화로 makeshop 이 올바르게 refresh-capable provider 로 분류되고, refresh_token-less 경로에 `statusReason = 'token_expired'` 가 추가됐으며, spec §11.2 의 "passive 알림은 refresh_token 없는 provider 전용" 정책이 7d/3d/0d 모든 임계에 대해 구현됐다. 관련 spec 문서(`spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`)도 코드와 line-level 로 일치하도록 동기화됐다. 발견된 INFO 사항들은 모두 현재 구현 패턴에서 무해하며, 요구사항 누락·로직 오류·spec 위반에 해당하는 Critical/Warning 은 없다.

## 위험도

NONE
