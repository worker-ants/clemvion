# Cross-Spec 일관성 검토 결과

검토 모드: impl-done  
범위: `spec/2-navigation/` (대상) + 동 PR 에서 함께 변경된 `spec/1-data-model.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`  
diff-base: origin/main

---

## 발견사항

### [WARNING] `status_reason='unknown'` → `'unknown_error'` 개명이 일부 spec 에서 미동기

- **target 위치**: `spec/1-data-model.md §2.10` (Integration.status_reason, 워크트리 변경분) + `spec/2-navigation/4-integration.md §5.4 DB 테스트 줄` (line 488)
- **충돌 대상**: `spec/2-navigation/4-integration.md` §5.4 (Database 테스트 정규화 줄, origin/main 기준 `unknown` → 워크트리에서 `unknown_error` 로 갱신 완료), 단 `spec/4-nodes/4-integration/_product-overview.md` INT-ST-01 행은 이미 `unknown_error` 를 사용하고 있어 **일관** — 문제 없음.
- **상세**: 워크트리 `spec/1-data-model.md §2.10` 은 `error` 상태의 `status_reason` 미분류 fallback 을 `unknown` → `unknown_error` 로 갱신했다. `spec/2-navigation/4-integration.md §5.4` Database 연결 테스트 에러 정규화 줄(line 488)도 동일 커밋에서 `unknown` → `unknown_error` 로 갱신됐다. 그러나 **origin/main 기준** `spec/2-navigation/4-integration.md` 에는 `unknown` 표기가 §5.4 에 잔존했으며 워크트리 diff 가 이를 수정했다 — 워크트리 최종 상태에서는 두 문서 모두 `unknown_error` 로 일치한다. 추가로 확인할 잔여 위치: `spec/5-system/` 하위 및 `spec/conventions/` 에서 `status_reason` 값 목록을 명시하는 문서가 있다면 `unknown` → `unknown_error` 갱신이 필요할 수 있다.
- **제안**: `spec/5-system/` 및 `spec/conventions/` 에서 `status_reason` 또는 `integration.*error.*code` 를 명시하는 문서를 점검해 `unknown` 잔존 여부를 확인한다. 현재 워크트리 내 확인 범위에서는 불일치가 해소됐으므로 INFO 에서 WARNING 으로 분류(추가 누락 가능성).

---

### [WARNING] `spec/2-navigation/4-integration.md §11.2 알림 정책` 변경 후 `spec/data-flow/8-notifications.md` 서술과의 완전 동기 확인 필요

- **target 위치**: `spec/2-navigation/4-integration.md §11.2` (알림 생성 — passive/active 분리, 워크트리 변경)
- **충돌 대상**: `spec/data-flow/8-notifications.md` `integration_expired` 행 (워크트리에서 함께 갱신됨)
- **상세**: 워크트리 diff 는 `spec/data-flow/8-notifications.md` 의 `integration_expired` 행을 "refresh-capable provider 는 7d/3d/0d 임계 알림에서 모두 제외" 로 갱신했다. `spec/2-navigation/4-integration.md §11.2` 와 개념 일치한다. 그러나 `spec/data-flow/8-notifications.md` 내 `integration_action_required` 행 기술(line 232)은 origin/main 에서도 `integration-action-required-notifier.service.ts:37-93` 를 참조하며 이미 `error(auth_failed/network/insufficient_scope)` 발사 조건을 정의하고 있었다. 워크트리 변경이 이 행의 내용을 수정하지 않았음을 확인했다 — 충돌 없음. 다만 `spec/2-navigation/4-integration.md §11.2 Rationale` 와 `spec/data-flow/8-notifications.md` 간에 "passive vs active 알림 발사 조건이 동일하게 기술되어 있는가" 를 추후 독립 리뷰에서 점검 권장.
- **제안**: 현 워크트리 상태에서는 두 문서가 정합적이다. 향후 알림 정책 변경 시 두 파일을 반드시 동시에 갱신하도록 plan 주석을 남기면 충분하다.

---

### [INFO] `spec/data-flow/5-integration.md §3.2 status_reason 표` 에서 `expired` 사유 `NULL` → `token_expired` 로 갱신되었으나 `spec/1-data-model.md §2.10` 과 완전히 대칭인지 확인

- **target 위치**: `spec/data-flow/5-integration.md §3.2` status_reason 매핑 표 (워크트리 변경)
- **충돌 대상**: `spec/1-data-model.md §2.10` Integration.status_reason 정의
- **상세**: 워크트리 diff 에서 `spec/data-flow/5-integration.md §3.2` 표의 `expired` 행이 `NULL` → `install_timeout` / `token_expired` 로 갱신됐다. `spec/1-data-model.md §2.10` 도 동일하게 `token_expired` 를 추가했다. 두 문서가 동기화됐다. `spec/data-flow/5-integration.md` 의 Rationale 섹션도 "구현 갭 해소" 로 갱신되어 일관성 있다.
- **제안**: 추가 조치 불필요.

---

### [INFO] `spec/4-nodes/4-integration/4-cafe24.md §buildTools` 근거 문구가 `isCafe24RefreshCapable` → `isRefreshCapable` 로 갱신됨 — `spec/4-nodes/4-integration/5-makeshop.md` 와 대칭 확인 권장

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §buildTools (워크트리 변경)
- **충돌 대상**: `spec/4-nodes/4-integration/5-makeshop.md`
- **상세**: cafe24 spec 의 buildTools 근거 문구는 `§11.1 connected-expiry scanner 의 isRefreshCapable 분기` 로 갱신됐다. MakeShop spec(`spec/4-nodes/4-integration/5-makeshop.md`)에서도 스캐너 관련 서술이 있다면 동일 용어(`isRefreshCapable`)를 쓰는지 확인 필요하다. 워크트리 diff 에는 makeshop spec 변경이 없어 makeshop spec 이 `isCafe24RefreshCapable` 같은 구 표기를 참조하고 있을 가능성이 있다.
- **제안**: `spec/4-nodes/4-integration/5-makeshop.md` 에서 `isCafe24RefreshCapable` 또는 스캐너 관련 구 서술 잔존 여부를 점검하고 필요 시 `isRefreshCapable` 로 동기화한다.

---

### [INFO] `spec/2-navigation/4-integration.md §11.1 스캐너 잡 표` 에서 `integration_expired` 알림 발사 주체 문구 변경 — `_product-overview.md` 요구사항 ID 와 충돌 없음 확인

- **target 위치**: `spec/2-navigation/4-integration.md §11.1` (워크트리 변경)
- **충돌 대상**: `spec/2-navigation/_product-overview.md` (NAV-IN-* 요구사항 ID)
- **상세**: 알림 발사 대상 축소(refresh-capable 제외)는 `spec/2-navigation/_product-overview.md` 내 NAV-IN-* 요구사항 ID 와 직접 충돌하지 않는다 — NAV-IN-* 요구사항은 "알림 발사" 자체를 의무로 명시하지 않고 통합 상태 표시와 갱신 가능 여부를 정의한다. 워크트리에서 `_product-overview.md` 는 변경되지 않았으며, 현 상태에서 요구사항 ID 충돌은 발견되지 않는다.
- **제안**: 추가 조치 불필요.

---

## 요약

이번 PR(`integration-expiry-fixes-1d7c7d`)은 `spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`, `spec/4-nodes/4-integration/4-cafe24.md` 에 걸쳐 (1) `isRefreshCapable` 일반화(cafe24 → cafe24+makeshop), (2) `status_reason` `unknown` → `unknown_error` 개명 + `token_expired` 명시화, (3) passive/active 알림 발사 정책 분리의 세 가지 연동된 변경을 수행했다. 주요 spec 파일들은 서로 잘 동기화되어 있으며 CRITICAL 급 모순은 발견되지 않았다. 잔여 주의 사항은 두 가지: (a) `spec/5-system/` 및 `spec/conventions/` 에서 `status_reason` 에 `unknown` 구 표기가 잔존할 가능성이 있어 추가 점검이 권장되고, (b) `spec/4-nodes/4-integration/5-makeshop.md` 에서 `isCafe24RefreshCapable` 구 용어 잔존 여부를 확인해야 한다.

---

## 위험도

LOW
