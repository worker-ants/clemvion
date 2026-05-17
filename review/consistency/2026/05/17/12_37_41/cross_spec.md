# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/conventions/` (주 초점: `cafe24-restricted-scopes.md` + `cafe24-api-catalog/` 의 `restricted` 컬럼 관련 변경)
**검토 모드**: `--impl-prep` (구현 착수 전)
**검토일**: 2026-05-17

---

### 발견사항

- **[WARNING]** `requiresCafe24Approval` 교집합 범위: §1(scope 단위) vs 전체 명단
  - target 위치: `cafe24-restricted-scopes.md §4.3` — "요청한 scopes ∩ 본 명단 **§1** 의 교집합"
  - 충돌 대상: `spec/2-navigation/4-integration.md §9.4` (INSUFFICIENT_SCOPE 행) — "`missingScopes` ∩ **§1** 의 교집합"; `spec/2-navigation/4-integration.md §10.4` (Cafe24 `invalid_scope` 행) — "요청 scopes ∩ **§1** 의 교집합"; `spec/1-data-model.md §2.10` `last_error` 설명 — "§1 의 교집합"
  - 상세: 세 문서 모두 §1(scope 단위 제한 — mileage/notification/privacy) 과의 교집합만 `requiresCafe24Approval` 에 채운다고 명시한다. 그러나 §2(operation 단위 — store 의 activitylogs, menus, PG settings 등) 는 scope 레벨이 아닌 operation 레벨이므로 OAuth `invalid_scope` 에서는 이론상 scope 키가 아니라 operation 호출 시 403으로 감지된다. 따라서 §2 항목이 `requiresCafe24Approval` 에 들어가지 않는 이유가 스펙 본문에 **명시적으로 서술되어 있지 않다**. 구현자는 "왜 §1만?" 을 추론해야 한다.
  - 제안: `cafe24-restricted-scopes.md §4.3` 에 "§2(operation 단위) 는 scope 자체는 일반 승인 가능하므로 OAuth `invalid_scope` 단계에서 탐지되지 않는다 — `INSUFFICIENT_SCOPE (403)` 에서만 감지되며, 해당 시점의 `requiresCafe24Approval` 는 §1·§2 모두 포함한다" 는 한 줄 보충 권장.

- **[WARNING]** `INSUFFICIENT_SCOPE (403)` 의 `requiresCafe24Approval` 교집합 범위 불일치
  - target 위치: `cafe24-restricted-scopes.md §4.3` — "노드 실행 중 `INSUFFICIENT_SCOPE (403)`: 누락 scope ∩ 본 명단의 교집합" (명단 전체, §1·§2 모두)
  - 충돌 대상: `spec/2-navigation/4-integration.md §9.4` — "`missingScopes` ∩ **§1** 의 교집합"
  - 상세: `cafe24-restricted-scopes.md §4.3` 는 403 케이스에서 "본 명단" (§1 + §2 전체)과의 교집합을 `requiresCafe24Approval` 에 기록한다고 서술한다. 반면 `4-integration.md §9.4` 는 `missingScopes ∩ §1 의 교집합` 이라고 §1만 언급한다. 이 표현 차이가 구현 의도와 다른 동작을 낳을 수 있다(§2 operation 에 해당하는 store scopes 는 operation 레벨이어서 `missingScopes` 자체에 scope 문자열로 들어오지 않지만, 차후 §2 항목이 scope 레벨로 변경되거나 새 resource 가 §2에 추가되면 두 기술이 달리 해석된다).
  - 제안: `spec/2-navigation/4-integration.md §9.4` 의 `requiresCafe24Approval` 설명을 "§1 의 교집합" → "본 명단 §1·§2 와의 교집합 — 단, scope 기준이므로 §2(operation 단위) 항목의 scope(`mall.read_store`/`mall.write_store`)는 제한 없이 승인되므로 일반적으로 빈 교집합" 으로 보강한다.

- **[WARNING]** `oauth_invalid_scope` 상태 보존 규칙과 state machine 표현 간 기술 불일치
  - target 위치: `cafe24-restricted-scopes.md §4.3` — "status 는 `pending_install` 그대로 유지하여 사용자가 다시 시도 가능"
  - 충돌 대상: `spec/2-navigation/4-integration.md §6` 상태 전이 다이어그램 — `pending_install → pending_install (callback 실패 보존)` 행
  - 상세: 두 문서 모두 `pending_install` 보존을 명시하므로 내용 충돌은 없다. 그러나 `4-integration.md §6` 의 상태 전이 다이어그램 주석(`pending_install → pending_install` 행)이 `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired` 세 코드만 열거하고 `oauth_invalid_scope` 는 누락하고 있다(`spec/1-data-model.md §2.10` 에는 `oauth_invalid_scope` 가 추가되었으나 `4-integration.md §6` 다이어그램에는 반영 미완).
  - 제안: `spec/2-navigation/4-integration.md §6` 의 `pending_install → pending_install` 상태 전이 행에 `oauth_invalid_scope` 를 추가 열거한다.

- **[INFO]** `cafe24-api-catalog/_overview.md §4` 검증 규칙 8 — `level='scope'`/`'operation'` 매핑 표현
  - target 위치: `cafe24-api-catalog/_overview.md §4` 검증 규칙 8 — "`scope` ↔ `level='scope'`, `op` ↔ `level='operation'`"
  - 충돌 대상: `spec/conventions/cafe24-api-metadata.md §2` `category` 테이블 — 동일 내용을 훨씬 더 상세히 기술
  - 상세: 두 문서의 매핑 자체는 일치한다. 다만 `_overview.md §4` 는 `category` 필드의 의미를 전혀 언급하지 않아 메타데이터의 `restrictedApproval.category` 가 검증 대상인지 아닌지 모호하다. `catalog-sync.spec.ts` 구현 시 `category` 필드까지 검증 대상인지 판단하기 어렵다.
  - 제안: `_overview.md §4` 검증 규칙 8에 "`category` 필드는 sync 검증 대상에서 제외 (값의 의미는 `cafe24-api-metadata.md §2` 참조)" 한 줄 추가.

- **[INFO]** `cafe24-restricted-scopes.md §3` `level='program'` 카탈로그 제외 정책 — 중복 기술
  - target 위치: `cafe24-restricted-scopes.md §3` — "`restrictedApproval.level='program'` 인 row 는 catalog 의 `restricted` 컬럼 정합성 검증 대상에서 제외"
  - 충돌 대상: `cafe24-api-catalog/_overview.md §4` 검증 규칙 8 — 동일 예외 정책 기술; `cafe24-api-metadata.md §2` `restrictedApproval` 의미 항 — 동일 내용 반복
  - 상세: 동일 정책이 세 파일에 중복 기술되어 있다. 모순 자체는 없으나 한 곳을 수정할 때 다른 두 곳도 수동 동기해야 하는 유지보수 부담이 있다.
  - 제안: 정책의 canonical 위치를 `cafe24-api-catalog/_overview.md §4` 검증 규칙 8 으로 고정하고 나머지 두 문서는 해당 항 링크로 대체한다 (중요도 낮음 — 삼중 기술이라 실수가 드러나기 쉬워 즉시 수정 불요).

- **[INFO]** `cafe24-restricted-scopes.md §2` — `paymentmethods_list` / `paymentmethods_paymentproviders_list` 미확정
  - target 위치: `cafe24-restricted-scopes.md Rationale "Trade-off"` — "빈칸 유지, 향후 확인 시 갱신"
  - 충돌 대상: `spec/conventions/cafe24-api-catalog/store.md` — 동 두 operation 에 `restricted` 컬럼이 빈칸(일반 사용 가능으로 표시)
  - 상세: 모순은 없다. 단 `store.md` 주석("`paymentmethods_list` / `paymentmethods_paymentproviders_list` / `paymentmethods_paymentproviders_update_display` 는 사용자 자료에 명시되지 않아 빈칸 유지")과 `cafe24-restricted-scopes.md` Rationale의 설명이 내용상 일치하므로, `store.md` 에서 이미 해당 주석을 적고 있어 양쪽 관리가 필요한 정보가 분산된 상태다.
  - 제안: `store.md` 의 주석을 `cafe24-restricted-scopes.md §2` 로 cross-reference 로 단순화해 동기 포인트를 하나로 줄이는 것을 고려한다.

---

### 요약

`spec/conventions/cafe24-restricted-scopes.md` 는 신규 컨벤션으로 기존 `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`, `cafe24-api-catalog/_overview.md` 와의 참조가 전반적으로 잘 정합되어 있다. CRITICAL 수준의 직접 모순은 없다. 발견된 WARNING 2건은 모두 `requiresCafe24Approval` 의 교집합 범위에 대한 §1-only vs 명단-전체 표현 불일치로, 구현자가 두 문서를 동시에 읽지 않으면 잘못 구현할 가능성이 있다. 특히 `INSUFFICIENT_SCOPE (403)` 케이스에서 `4-integration.md §9.4` 가 §1만 언급한다는 점은 §2 operation들의 403 응답에서 `requiresCafe24Approval` 를 채워야 하는지 여부를 모호하게 만든다. 나머지 WARNING 1건(상태 전이 다이어그램의 `oauth_invalid_scope` 누락)과 INFO 3건은 문서 간 동기 미완 또는 중복 기술 사항으로 구현에 직접 영향은 없으나 정비를 권장한다.

---

### 위험도

MEDIUM
