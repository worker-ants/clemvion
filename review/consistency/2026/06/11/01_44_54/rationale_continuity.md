# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/` (--impl-done, diff-base=origin/main)  
실질 변경 파일: `spec/2-navigation/4-integration.md` (단일 파일만 변경)

---

## 발견사항

### [INFO] `error(*)` 알림 정책 번복 — Rationale 추가 완료로 연속성 보전

- **target 위치**: `spec/2-navigation/4-integration.md` §10.5 갱신 실패 시 절 (라인 928), §Rationale "refresh 실패 시 status_reason 통일" 내 알림 정책 항 (라인 1429)
- **과거 결정 출처**: 동 파일 `## Rationale` 내 "refresh 실패 시 status_reason 통일" 항 — 구 텍스트 `"error(*) 전이는 별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 integration_action_required 등 신설 검토"`
- **상세**: 구 Rationale 은 `error(*)` 전이에 대해 알림을 **발사하지 않는 것을 현재 결정**으로 기록하고 `integration_action_required` 를 "향후 신설 검토" 대안으로만 언급했다. 본 diff 는 이를 번복해 `error(auth_failed/insufficient_scope/network)` 전이 시 active `integration_action_required` 알림을 발사하는 것으로 변경했다.
- **평가**: Rationale 의 해당 구절이 **새 텍스트로 동시 교체**되어 (`"결정·구현 완료"` 명시) 새 Rationale 를 함께 작성한 번복이다. 기각 대안 재도입이 아니라 "신설 검토" 로 유보됐던 방향을 확정한 것이므로 절차적 연속성 요건은 충족된다. INFO 수준으로 기록.
- **제안**: 변경 없음. 다만 `spec/5-system/` 알림 spec (notifications spec) 이 별도 존재한다면 `integration_action_required` 타입이 거기에도 등록됐는지 확인 권장.

---

### [INFO] `isRefreshCapable` makeshop 포함 — 신규 Rationale 추가로 연속성 보전

- **target 위치**: `spec/2-navigation/4-integration.md` §11.1 `connected-expiry` 잡 정의, 의사코드 블록, §11.1 MakeShop 주석, Rationale `isRefreshCapable — makeshop 포함 결정` 항 (신규 추가)
- **과거 결정 출처**: 동 파일 구 Rationale `isRefreshCapable` 관련 항목 없음 (신규 개념). 구 §11.1 MakeShop 주석에서 `connected-expiry 의 remain ≤ 0d 분기는 makeshop 을 cafe24 와 동일한 refresh-capable provider 로 취급한다` 라는 설명이 inline 으로만 존재했음.
- **상세**: 구 Rationale 에는 `isRefreshCapable` 이라는 개념 자체가 정식 ADR 항목으로 존재하지 않았다. 신규 Rationale 항 `isRefreshCapable — makeshop 포함 결정` 이 기각 대안 `"(makeshop 을 스캐너에서 cafe24 와 다르게 취급해 expired 격하 유지 — 거짓 만료 알림·재연결 요청 유발로 기각)"` 을 명시해 추가됐다.
- **평가**: 기각 대안이 새로 명문화되어 추후 이 결정을 번복할 때 ADR 갱신 의무가 생겼다. 현재는 기각 대안 재도입 우려 없음. INFO 수준.
- **제안**: 변경 없음.

---

### [INFO] `unknown` → `unknown_error` 코드명 변경 — Rationale 없음

- **target 위치**: `spec/2-navigation/4-integration.md` §5.4 PostgreSQL (라인 485 부근) — `error.code` 정규화 값 목록에서 `unknown` → `unknown_error` 로 변경
- **과거 결정 출처**: 동 파일 구 본문 `error.code에 정규화(auth_failed, network, unknown)` — 명시적 Rationale 항목은 없었으나 코드 목록의 일부였음
- **상세**: `unknown` → `unknown_error` 코드명 변경에 대한 별도 Rationale 항목이 추가되지 않았다. `unknown_error` 통일의 이유(다른 spec 과 코드명 일치 등)는 Rationale 에 기록되지 않았다.
- **평가**: 코드명 단순 표준화이고 이 값을 명시적으로 기각한 이전 Rationale 결정은 없다. WARNING 이 아닌 INFO — 다만 구현·테스트에서 `unknown` 대신 `unknown_error` 를 참조해야 하는 변경이므로 코드베이스 grep 확인 권장.
- **제안**: Rationale 에 한 줄 추가 권장: `"§5.4 PostgreSQL error.code — unknown → unknown_error 로 통일 (다른 provider 의 fallback 코드명과 일관성 확보)"`.

---

### [INFO] cafe24의 `integration_expired` passive 알림 완전 제거 — 구 본문 기술과 번복

- **target 위치**: `spec/2-navigation/4-integration.md` §11 cafe24 비고 blockquote (구 `token_expires_at 가 만료 7일/3일/당일 임계에 도달하면 integration_expired 알림이 발사된다` → 새 텍스트로 대체됨)
- **과거 결정 출처**: 동 파일 구 §11 cafe24 비고 — `token_expires_at 가 만료 7일/3일/당일 임계에 도달하면 integration_expired 알림이 발사된다`
- **상세**: 구 본문은 cafe24 에도 임계치 알림(`integration_expired`)이 발사된다고 명시했으나, 새 텍스트는 `isRefreshCapable` 분기로 passive 알림이 발사되지 않음을 명시한다. Rationale `isRefreshCapable — makeshop 포함 결정` 항의 `(a) 거짓양성 격하 방지` 설명이 이 번복의 근거를 제공한다.
- **평가**: Rationale 이 번복 근거를 함께 제공하므로 "무근거 번복"은 아니다. 단, Rationale 의 "기각 대안" 목록이 `makeshop 을 expired 격하 유지` 쪽에 집중되어 있고 `cafe24 의 임계치 알림 제거` 자체를 독립적으로 설명하지 않는다. 구 본문 기술이 "발사된다" 였으므로 명확하게 `"cafe24 는 refresh-capable 이므로 7d/3d/0d passive 알림 대상에서 제외. 이전 기술 정정"` 한 문장을 Rationale 에 추가하면 더 명확해진다.
- **제안**: Rationale `isRefreshCapable — makeshop 포함 결정` 항에 cafe24 임계치 알림 제거에 대한 명시적 설명 추가 권장 (현재는 makeshop 기각 대안에 집중되어 cafe24 측 정책 번복이 묻혀있음).

---

## 요약

`spec/2-navigation/` 영역 내 이번 diff 의 변경 범위는 `4-integration.md` 단일 파일이다. 핵심 변경은 세 가지: (1) `error(*)` 전이에 passive 알림 없음 → active `integration_action_required` 발사로 번복, (2) `isRefreshCapable` 판별에 makeshop 추가, (3) cafe24 의 passive `integration_expired` 임계치 알림 제거. 이 세 가지 모두 과거 Rationale 에서 명시적으로 기각된 대안을 이유 없이 재도입하거나 합의된 invariant 를 우회하는 경우에 해당하지 않는다. `error(*)` 알림 번복은 구 Rationale 의 "향후 신설 검토" 방향을 확정한 것이고, `isRefreshCapable` 확장과 cafe24 passive 알림 제거는 새 Rationale 항목이 근거를 함께 제공한다. `unknown` → `unknown_error` 코드명 변경은 Rationale 기록이 없으나 기각 이력도 없는 단순 통일이다. 다른 `spec/2-navigation/` 파일들(0-dashboard, 1-workflow-list, 10-auth-flow, 11-error-empty-states, 13-user-guide, 14-execution-history, 15-system-status, 16-agent-memory, 2-trigger-list 등)은 이번 브랜치에서 변경되지 않아 기존 Rationale 와의 충돌 위험이 없다.

## 위험도

LOW
