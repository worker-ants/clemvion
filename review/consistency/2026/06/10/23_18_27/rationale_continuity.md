STATUS: OK

# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`, scope = `spec/2-navigation/`

---

## 발견사항

---

### [CRITICAL] §11.1 note가 §11.2 확정 발사 정책(refresh-capable 알림 제외)과 직접 충돌

- **target 위치**: `spec/2-navigation/4-integration.md §11.1` — `> service_type='cafe24' Integration 은 … token_expires_at 가 만료 7일/3일/당일 임계에 도달하면 integration_expired 알림이 발사된다.` (§11 도입부 note block)
- **과거 결정 출처**: 동일 문서 `§11.2 발사 정책` — `refresh_token 없는 provider 의 token_expires_at 만료(status_reason='token_expired')에만 발사한다`; 동일 문서 Rationale "refresh 실패 시 status_reason 통일" — `expired(refresh_failed)` 분기 폐기 및 `expired` 경로를 두 케이스(refresh_token 없는 provider의 token_expires_at 만료 / install_timeout)로 한정
- **상세**: §11.2 는 refresh_token 보유 provider(cafe24·makeshop)에 대해 `integration_expired` 알림을 명시적으로 제외한다. 그런데 §11.1 note는 cafe24에 대해 7일/3일/당일 임계에서 알림이 발사된다고 서술한다. 이는 plan V-07이 채택한 "§11.2 방향 정합" 결정을 무력화하는 기술로, plan 착수 전 이미 spec 내에 있는 모순이다. 구현자가 §11.1 note를 기준으로 코드를 읽으면 cafe24에 알림을 유지하는 구현을 작성하게 된다.
- **제안**: plan V-07의 spec 정합 작업에서 §11.1 cafe24 note를 `token_expires_at 만료 임계 알림은 refresh_token 없는 provider에만 적용된다(§11.2). cafe24는 refresh-capable이므로 알림 제외` 로 수정한다. 또는 note 전체를 삭제하고 §11.2 발사 정책 설명에서 cafe24를 명시적 제외 예시로 언급한다.

---

### [WARNING] `connected-expiry` 의사코드가 makeshop을 refresh-capable로 처리하지 않음

- **target 위치**: `spec/2-navigation/4-integration.md §11.1` — `connected-expiry` 의사코드 `if service_type='cafe24' AND credentials.refresh_token 존재` 분기
- **과거 결정 출처**: 동일 문서 §11.1 MakeShop note — `credentials.refresh_token 이 유효한 makeshop 행은 expired 로 격하하지 않고, in-call proactive / reactive_401 경로가 이미 access_token 을 갱신했음을 전제한다`; plan V-01 결정 — `isCafe24RefreshCapable → isRefreshCapable 일반화 (cafe24·makeshop + credentials.refresh_token 보유)`
- **상세**: plan V-01은 `isRefreshCapable` 함수를 일반화해 makeshop도 `expired` 격하 면제 대상에 포함한다는 구현 방향을 확정했다. 그러나 §11.1 본문의 의사코드는 여전히 `service_type='cafe24'` 단일 조건만 명시하고, makeshop 처리는 note 텍스트에만 기술되어 있다. 의사코드와 note가 분리되어 있으면 구현자가 의사코드를 코드 기준으로 삼고 note를 "참고"로 오독할 수 있다.
- **제안**: plan V-01 spec 정합 시 의사코드를 아래와 같이 갱신한다.
  ```
  if isRefreshCapable(integration):  # cafe24(+enqueue) 또는 makeshop(격하 면제만)
    if service_type='cafe24':
      → cafe24-token-refresh 큐 enqueue
    → 격하 skip (worker/proactive/reactive_401 이 처리)
  else:
    → status=expired, status_reason='token_expired', 알림
  ```
  MakeShop note를 의사코드 안으로 흡수해 분기를 한 곳에서 관리한다.

---

### [WARNING] `connected-expiry` 의사코드 `remain ≤ 0d` 분기에 `+ 알림` 표기가 잔존

- **target 위치**: `spec/2-navigation/4-integration.md §11.1` — `connected-expiry` 의사코드 `→ cafe24-token-refresh 큐 enqueue (jobId=integrationId) + 알림`
- **과거 결정 출처**: 동일 문서 §11.2 발사 정책 — `refresh_token 없는 provider에만 발사`; plan V-07 채택 결정 — `§11.1 표 "cafe24 0d → enqueue + 알림" 의 "+ 알림" 제거 + 의사코드 동기`
- **상세**: plan V-07은 refresh-capable provider의 `integration_expired` 알림 제외를 명시적으로 채택하고, "의사코드 동기"를 spec 수정 항목으로 열거한다. 그러나 현재 target 문서의 의사코드는 `+ 알림`을 그대로 유지한다. 이 상태로 구현에 착수하면 구현자가 의사코드를 따라 cafe24 0d 분기에서 알림을 발사하는 코드를 유지하거나 신규 작성하게 된다. plan이 착수 전 spec 정합을 명시하고 있으므로 impl-prep 단계에서 이미 수정되어야 한다.
- **제안**: plan V-07 `spec 정합` 체크리스트 수행 시 §11.1 의사코드의 `→ cafe24-token-refresh 큐 enqueue + 알림` 을 `→ cafe24-token-refresh 큐 enqueue` 로 수정한다. 동시에 §11.1 note(`service_type='cafe24'` alim 발사 서술)도 일괄 정정한다(위 CRITICAL 항 참조).

---

### [INFO] `spec/1-data-model.md` 의 `INTEGRATION_STATUS_REASONS` 정의에 `token_expired` 추가 Rationale 부재

- **target 위치**: plan `integration-expiry-fixes.md` V-07 — `INTEGRATION_STATUS_REASONS union에 token_expired 추가`
- **과거 결정 출처**: `spec/2-navigation/4-integration.md` Rationale "refresh 실패 시 status_reason 통일" — `token_expired 는 일반 OAuth provider 의 expired 경로(refresh_token 없는 provider) 용으로 유지`; `spec/1-data-model.md §2.10` 참조 언급
- **상세**: `token_expired` 값은 Rationale "refresh 실패 시 status_reason 통일" 에서 이미 `expired` 사유 값으로 확정되어 있다. 다만 `INTEGRATION_STATUS_REASONS` TypeScript union에 해당 값이 실제로 포함되어 있는지 여부는 코드-spec 갭이며, spec 본문에는 현재 union 목록이 명시되지 않아 있다. V-07 구현에서 union 추가 시 `spec/1-data-model.md §2.10` 에 정의 목록을 갱신하면 Rationale 연속성이 완결된다.
- **제안**: `spec/1-data-model.md §2.10` 의 `status_reason` 허용값 목록에 `token_expired`를 명시 추가하고, "refresh_failed 제거" Rationale 아래에 한 줄 기록한다(`token_expired: refresh_token 없는 provider가 token_expires_at 도달로 expired 전이할 때 설정`).

---

### [INFO] `spec/2-navigation/4-integration.md` §11.4 사이드바 배지 카운트 술어가 `isRefreshCapable` 일반화를 반영하는지 확인 필요

- **target 위치**: `spec/2-navigation/4-integration.md §11.4` — `status IN (expired, error) OR (status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d' AND NOT integration.autoRefresh)` 술어
- **과거 결정 출처**: 동일 문서 `autoRefresh` derived 필드 Rationale — `autoRefresh=true` 행을 만료 임박 분기에서 제외; makeshop이 `autoRefresh=true` provider로 포함됨
- **상세**: `autoRefresh` derived 필드가 makeshop을 포함(service registry `supportsTokenAutoRefresh=true`)하므로, §11.4 술어의 `NOT integration.autoRefresh` 조건이 makeshop을 자동으로 배제한다. 즉 V-01 isRefreshCapable 일반화와 §11.4 술어는 이미 aligned되어 있다. 단 이 연결이 spec에 명시되지 않아 독자가 §11.1 코드 수정과 §11.4 카운트 정책이 정합한지 독립적으로 확인해야 한다.
- **제안**: §11.4 주석 또는 §11.1 MakeShop note에 `makeshop은 autoRefresh=true이므로 §11.4 주의보 카운트에서 자동 제외됨` 한 줄을 추가해 연결을 명시한다.

---

## 요약

`spec/2-navigation/` target의 핵심 Rationale 연속성 문제는 §11.1 note와 §11.2 발사 정책 사이의 직접 충돌이다. §11.2는 refresh_token 없는 provider에만 `integration_expired` 알림 발사를 확정 결정했으나, §11.1은 cafe24에 대해 7일/3일/당일 임계 알림 발사를 여전히 명시한다. 이는 명시적으로 기각된 "refresh-capable provider에도 passive 알림 발사" 정책이 spec 본문에 잔존하는 상태다. plan V-07이 해결 대상으로 열거했으나 `spec 정합` 체크리스트가 완수되기 전에 구현에 착수하면 과거 기각된 알림 발사 경로가 코드에 유지될 위험이 있다. V-01의 isRefreshCapable 일반화도 의사코드에 반영되지 않아 makeshop 면제 의도가 코드로 이어지지 않을 수 있다. 실제로 기각된 대안을 _새롭게_ 재도입하는 내용은 없으나, 이미 확정된 §11.2 정책을 무력화하는 서술이 §11.1에 잔존하므로 impl-prep 단계에서 spec 정합을 선행 완료해야 한다.

## 위험도

MEDIUM
