# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/` (diff-base: `origin/main`, scope: 구현 완료 후 검토)
실제 변경 파일: `spec/2-navigation/4-integration.md` (및 연관 `spec/1-data-model.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`)

---

## 발견사항

- **[INFO]** `error(*)` 전이 알림 정책 서술 번복 — 새 Rationale 명시로 완결

  - target 위치: `spec/2-navigation/4-integration.md` §10.5 갱신 실패 시 행 (`- **갱신 실패 시**: ...`), Rationale `refresh 실패 시 status_reason 통일` 항
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` (origin/main) Rationale `refresh 실패 시 status_reason 통일` 항 — `"error(*) 전이는 별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 integration_action_required 등 신설 검토."`; §10.5 행 — `"integration_expired 알림은 expired 전이에만 발사하며 error(*) 전이는 UI 배지로만 표시"`
  - 상세: 기존 Rationale 은 `error(*)` 전이를 "UI 배지로만 통지" + "향후 신설 검토" 상태로 열어뒀다. target 은 이를 번복하여 `error(auth_failed/insufficient_scope/network)` 전이에 active `integration_action_required` 알림을 발사하는 정책으로 **확정**했다. 번복 자체는 `spec/1-data-model.md` (origin/main) 의 `Notification.type` 행에서 `integration_action_required` 의 "능동성" 분리 원칙이 이미 선언되어 있고, target 의 Rationale `refresh 실패 시 status_reason 통일` 항 마지막 문장에 "passive/active 분리 원칙으로 결정·구현 완료" 라고 명시되어 있어 새 Rationale 이 동행하고 있다. 따라서 "무근거 번복"은 아니며, 다만 기존 Rationale 의 "향후 신설 검토" 보류 표현이 정식 결정으로 승격된 흐름이 명확히 추적된다.
  - 제안: 해결 완료 — target 의 Rationale 에 `integration_action_required` 신설이 명문화됐으므로 추가 수정 불필요. 다만 §10.5 의 구 문장 "UI 배지로만 표시 (§11 참고)" 이 삭제되고 새 문장으로 교체된 점을 확인해 두는 수준으로 족하다.

- **[INFO]** `status_reason='unknown'` → `'unknown_error'` 슬러그 변경 — Rationale 갱신 있음

  - target 위치: `spec/2-navigation/4-integration.md` §5.4 DB 연결 테스트 행 (`error.code` 정규화 목록); `spec/1-data-model.md` §2.10 `status_reason` 컬럼 행
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` (origin/main) §5.4 — `error.code 에 정규화(auth_failed, network, unknown)`. `spec/1-data-model.md` (origin/main) — `error → ... / unknown (현행)`
  - 상세: `unknown` 에서 `unknown_error` 로 슬러그가 바뀌었다. target `spec/1-data-model.md` 에서 `unknown_error (미분류 fallback)` 로 정의가 갱신되고 "운영 알람 신호" 용도가 명시됐으며, `spec/data-flow/5-integration.md` §3.2 `status_reason 매핑` 표도 `unknown_error` 로 일치 갱신됐다. 이것이 DB 스키마·기존 행에 영향을 주는 변경인지(마이그레이션 필요 여부)는 spec 어디에도 명시되지 않았다.
  - 제안: `unknown` 슬러그가 현재 DB 행에 존재하는 값인지, 또는 pure 코드 상수 변경으로 신규 행에만 영향을 주는지 Rationale 에 한 줄 명시를 권장한다. 마이그레이션이 필요 없다면 "(기존 DB 행에는 `unknown` 값 없음 — 미구현 경로였으므로 무해)" 형태의 note 면 충분하다.

- **[INFO]** `isRefreshCapable` makeshop 포함 결정 — 이전 "구현 갭" 상태 해소

  - target 위치: `spec/2-navigation/4-integration.md` §11.1 `connected-expiry` 행, `isRefreshCapable` Rationale 항
  - 과거 결정 출처: `spec/data-flow/5-integration.md` (origin/main) §1.4 callout — `"해당 note 는 spec 에만 추가됐고 스캐너 코드에는 구현되지 않았다 (스캐너의 refresh-capable 판별은 isCafe24RefreshCapable 로 cafe24 한정, 'makeshop' 분기 부재)"` — 즉 이전 문서가 이 상태를 "알려진 구현 갭"으로 명시적 결함 등록
  - 상세: 이전 spec 은 makeshop 이 refresh-capable 이어야 한다는 설계 의도는 기술했으나, 코드가 그렇지 않다는 갭을 명시해 두었다. target 은 코드 수정(V-01·V-07)으로 이 갭이 해소됐음을 Rationale 에 기술하고, "이전에 기각 대안으로 명시한 makeshop expired 격하 유지 방안"을 새 Rationale 에서 다시 명시적으로 기각하고 있다. 과거 기각 대안의 재도입이 아니라 기존 설계 의도로의 복귀이므로 연속성 관점 충돌 없음.
  - 제안: 문제 없음. Rationale 신설로 완결 처리.

- **[INFO]** `cafe24` 전용이던 알림·격하 제외 로직이 `makeshop` 으로 확장 — 알림 정책 invariant 준수 여부

  - target 위치: `spec/data-flow/8-notifications.md` `integration_expired` 행 — `"refresh-capable provider … 7d/3d/0d 임계 알림에서 모두 제외"`
  - 과거 결정 출처: `spec/data-flow/8-notifications.md` (origin/main) `integration_expired` 행 — `"후보 필터는 status NOT IN (expired, error, pending_install) AND token_expires_at <= now+7d 로 provider 의 refresh_token 유무를 가리지 않는다 — refresh_token 보유 provider (cafe24 등) 도 발사 대상이며, 0d 임계의 cafe24 분기는 cafe24-token-refresh 큐 enqueue 후에도 알림을 그대로 발사한다 (사용자 가시성 유지)"`
  - 상세: 이전 spec 은 cafe24 도 7d/3d/0d `integration_expired` 알림 발사 대상으로 두었다(0d 분기에서 큐 enqueue 후에도 알림 발사). target 은 이를 번복하여 refresh-capable provider 는 모든 임계 알림에서 제외한다. 번복 이유가 target 의 `isRefreshCapable` Rationale 항에 명시되어 있다("자동 갱신으로 흡수되므로 passive '재인증' notice 가 노이즈"). 따라서 근거가 동행하는 번복이다. 다만 "사용자 가시성 유지" 라고 구 Rationale 이 명시했던 근거가 왜 더 이상 유효하지 않은지에 대한 설명이 target Rationale 에 명시되지 않았다.
  - 제안: `spec/2-navigation/4-integration.md` 의 Rationale `isRefreshCapable` 항 또는 `refresh 실패 시 status_reason 통일` 항에 "이전 spec 이 '사용자 가시성 유지'를 위해 알림을 그대로 발사하도록 기술했으나, refresh-capable provider 의 access_token 만료는 자동 갱신으로 투명하게 처리되므로 passive 알림은 실질적으로 false alarm 이다 — 이 기각 이유를 함께 기록한다" 형태로 구 근거를 명시적 반박으로 기록해 두면 Rationale 연속성이 완결된다. 현재는 이 맥락이 빠져 있어 검토자가 구 spec 을 참조해야 한다.

---

## 요약

`spec/2-navigation/4-integration.md` 및 연관 spec 변경은 전체적으로 Rationale 연속성을 잘 유지하고 있다. 주요 설계 결정 — `isRefreshCapable` 의 makeshop 포함, `error(*)` 전이에 active `integration_action_required` 알림 신설, refresh-capable provider 의 passive `integration_expired` 알림 제외 — 모두 해당 Rationale 절이 새로 추가되거나 갱신되었다. 한 가지 주의할 점은 `spec/data-flow/8-notifications.md` (origin/main) 의 `integration_expired` 행이 "cafe24 도 알림 발사 대상이며 사용자 가시성 유지" 라고 기술했는데, target 이 이를 정반대로 번복(refresh-capable 전체 제외)하면서 구 근거("사용자 가시성 유지")를 명시적으로 반박하는 설명이 Rationale 에 없다. 이 gap 은 WARNING 수준에 못 미치는 보완 제안으로, `unknown` → `unknown_error` 슬러그 변경의 DB 영향 범위 역시 Rationale 한 줄 명시로 완결할 수 있다.

---

## 위험도

LOW

---

STATUS: SUCCESS
