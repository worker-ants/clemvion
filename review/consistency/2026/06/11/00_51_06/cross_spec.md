# Cross-Spec 일관성 검토 결과

검토 대상: `spec/2-navigation/4-integration.md` + 연동 변경 파일  
검토 기준: diff vs `origin/main` (integration-expiry-fixes 브랜치)  
검토 범위: 1) `spec/1-data-model.md`, 2) `spec/2-navigation/4-integration.md`, 3) `spec/4-nodes/4-integration/4-cafe24.md`, 4) `spec/data-flow/5-integration.md`, 5) `spec/data-flow/8-notifications.md`

---

## 발견사항

### **[WARNING]** `spec/2-navigation/4-integration.md §10.5` — `error(*)` 전이 알림 기술 불일치

- **target 위치**: `spec/2-navigation/4-integration.md` 라인 928 (§10.5 "갱신 실패 시" 항목 마지막 문장)
- **충돌 대상**: 동일 파일 §11.2 (`integration_action_required` active 알림 표), `spec/data-flow/8-notifications.md` (`integration_action_required` 발사 정책 행)
- **상세**: §10.5 라인 928 은 `"error(*)` 전이는 UI 배지로만 표시 (§11 참고)"라고 기술한다. 그러나 본 PR 의 §11.2 및 `spec/data-flow/8-notifications.md` 은 `error(auth_failed)` / `error(network)` / `error(insufficient_scope)` 전이 시 **active `integration_action_required` 알림이 발사된다**고 명시한다. §10.5 의 서술이 §11.2 의 새 정책보다 이전 내용(구현 갭 수정 전)을 그대로 반영한 채 업데이트되지 않았다. `(§11 참고)` 포인터가 있어 직접 모순까지는 아니지만, 해당 절만 읽는 독자는 `error(*)` 에 알림이 없다고 오해할 수 있다.
- **제안**: `spec/2-navigation/4-integration.md §10.5` 라인 928 의 `"error(*) 전이는 UI 배지로만 표시"` 문장을 `"error(*) 전이는 active integration_action_required 알림 발사 + UI 배지 (§11.2 참고)"` 로 수정한다.

---

### **[INFO]** `spec/2-navigation/4-integration.md §3.1` `autoRefresh` 술어 — `isRefreshCapable` 확장과 동기화 필요

- **target 위치**: `spec/2-navigation/4-integration.md §3.1` attention 포함 조건 (라인 97): `AND NOT integration.autoRefresh`
- **충돌 대상**: 동일 파일 §11.1 / §9.1 `autoRefresh` 정의, `spec/1-data-model.md §2.10` `status_reason` 및 `isRefreshCapable` 정의
- **상세**: `autoRefresh=true` 는 "짧은-수명 토큰(예: cafe24 access_token 2h)의 거짓 양성 방지"를 위해 attention 배너의 만료 임박(7d) 분기에서 제외한다. 본 PR 은 `isRefreshCapable`을 cafe24·makeshop 공통으로 일반화했고, makeshop 도 짧은 access_token TTL을 가지는 refresh-capable provider다. `autoRefresh` 필드의 실제 값이 makeshop 행에서 `true` 로 설정되는지 spec이 명시하지 않아, attention 배너 술어가 makeshop 행을 올바르게 제외하는지 불분명하다. §9.1 의 `autoRefresh` 정의를 확인·갱신하거나, 명시적으로 "makeshop 도 `autoRefresh=true`" 임을 §9.1 에 기술하면 충분하다. 현행 spec 은 모순이 아니라 명시 누락.
- **제안**: `spec/2-navigation/4-integration.md §9.1` 의 `autoRefresh` 정의 행에 makeshop 도 포함됨을 한 줄 추가한다.

---

### **[INFO]** `spec/data-flow/5-integration.md §3.2` `status_reason` 매핑 표 — `NULL` 항목 정비 완료 확인

- **target 위치**: `spec/data-flow/5-integration.md §3.2` (라인 381~192 부근)
- **충돌 대상**: `spec/1-data-model.md §2.10` `status_reason` 열거, `spec/2-navigation/4-integration.md §11.1` 의사코드
- **상세**: diff 에서 `status_reason` 매핑 표의 `expired` 행이 `NULL` → `token_expired` (refresh_token 없는 provider), `install_timeout` (pending_install TTL) 두 값으로 명시적으로 갱신됐다. `spec/1-data-model.md §2.10` 와 일치한다. 추가 불일치 없음 — 정보성 확인.

---

### **[INFO]** `spec/2-navigation/4-integration.md §11.2` `integration_expired` 발사 조건 vs `spec/data-flow/8-notifications.md` — 표현 일관성

- **target 위치**: `spec/2-navigation/4-integration.md §11.2` (라인 997), `spec/data-flow/8-notifications.md`
- **충돌 대상**: 두 파일의 `integration_expired` 발사 정책 기술
- **상세**: 두 파일 모두 `integration_expired` 를 refresh_token 없는 provider 한정으로 명시하고 있으나, `spec/2-navigation/4-integration.md §11.2` 의 `integration_expired` 표 헤더 "**발사 정책**" 항에서 `(status_reason='token_expired')` 를 괄호로 명기한 반면 `spec/data-flow/8-notifications.md` 는 동일 조건을 별도 문장으로 기술한다. 내용상 동일하며 모순 없음 — 단지 표현 세분화 수준 차이. 동기화 권장 수준.

---

## 요약

본 PR(`integration-expiry-fixes`)의 spec 변경은 `isRefreshCapable` 술어의 makeshop 일반화, `status_reason='token_expired'` 추가, `unknown_error` 명칭 통일, passive/active 알림 분리 원칙 확립이라는 일관된 방향으로 진행됐다. 핵심 변경 파일 4개(`spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`)는 상호 일치한다. 단, `spec/2-navigation/4-integration.md §10.5` 의 `"error(*) 전이는 UI 배지로만 표시"` 문장이 같은 파일 §11.2 의 `integration_action_required` active 알림 정책과 표면 충돌을 일으키고 있어 독자 혼란 가능성이 있다(WARNING). `autoRefresh` 와 makeshop 의 관계, notification 표현 세부 수준은 INFO 수준이다.

## 위험도

LOW
