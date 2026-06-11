## 발견사항

- **[WARNING]** Planned action 에 `<resource>.<verb>` dot-prefix 규약 미적용
  - target 위치: `spec/5-system/1-auth.md §4.1` Planned 표 (라인 364)
  - 과거 결정 출처: `spec/5-system/1-auth.md §4.1` Action naming 규약 ("resource dot-prefix 가 필수다"), `spec/data-flow/1-audit.md ## Rationale` "naming 규약은 resource dot-prefix 필수 + verb 는 도메인 관례"
  - 상세: 구현된 액션은 모두 `<resource>.<verb>` 형식(예: `integration.created`, `execution.re_run`, `auth_config.create`)을 준수한다. 그런데 Planned 표의 "인증 (워크스페이스 컨텍스트)" 행에 기재된 `password_change`, `2fa_enable/disable` 는 resource dot-prefix 없이 flat 이름이다. `2fa_enable/disable` 는 슬래시로 두 이름을 표기한 것으로 보이나, 이 형식 자체로도 `<resource>.<verb>` 규약과 맞지 않는다. 합의된 규약을 Planned 항목에 적용하지 않으면, 구현 시점에 `AUDIT_ACTIONS` 에 규약 위반 action 이 추가될 위험이 있다.
  - 제안: `password_change` → `user.password_change` (또는 auth_config 스타일에 맞춰 `user.password_changed`), `2fa_enable/disable` → `user.2fa_enabled` / `user.2fa_disabled` (또는 현재형 `user.2fa_enable` / `user.2fa_disable`) 로 수정. auth_config 계열처럼 현재형과 과거분사 중 어느 형태를 채택할지도 이 기회에 Rationale 에 명시적으로 추가하는 것이 좋다.

- **[INFO]** Planned action 의 verb 형태(현재형 vs 과거분사)에 명시적 근거 부재
  - target 위치: `spec/5-system/1-auth.md §4.1` Planned 표 (라인 365-370)
  - 과거 결정 출처: `spec/5-system/1-auth.md §4.1` naming 규약 문단, `spec/data-flow/1-audit.md ## Rationale`
  - 상세: 구현된 액션은 integration 계열(과거분사 `created`/`updated`/`deleted`)과 auth_config 계열(현재형 `create`/`update`/`delete`) 두 스타일이 공존한다. data-flow Rationale 은 "integration 계열 과거분사형은 audit 가 발생 사건을 기록한다는 의미상 의도된 표기로 유지"하며 auth_config 은 "reveal·regenerate 처럼 과거분사가 부자연스러운 동사가 섞여 현재형으로 통일"한다고 설명한다. 그런데 Planned 항목 `workspace.create/update/delete`, `member.invite/role_change/remove`, `workflow.create/update/delete/execute`, `trigger.create/update/delete`, `schedule.create/update/delete`, `model_config.*` 는 모두 현재형이다. 이것이 auth_config 스타일을 의식적으로 선택한 것인지, 아니면 아직 미결정 상태인지 spec 에 설명이 없다. `integration.created` 와 동일한 CRUD 의미를 가진 `workspace.create` 가 현재형인 것은 일관성 의문을 유발한다.
  - 제안: §4.1 naming 규약 문단에 "Planned action 의 verb 형태는 auth_config 스타일(현재형)로 통일한다" 또는 "integration 과 동일하게 과거분사를 사용한다" 중 하나를 결정해 한 줄 추가한다. 결정 근거도 Rationale 에 단락을 하나 추가하는 것을 권장한다.

- **[INFO]** `workspace.transfer_ownership` 의 verb 형태가 현재 naming 규약 어느 스타일에도 명시적으로 귀속되지 않음
  - target 위치: `spec/5-system/1-auth.md §4.1` 구현된 액션 표, 워크스페이스 행 (라인 356)
  - 과거 결정 출처: `spec/5-system/1-auth.md §4.1` naming 규약 문단
  - 상세: `workspace.transfer_ownership` 은 현재형 복합 동사다. integration 스타일(과거분사)도, auth_config 스타일(단일 동사 현재형)도 아닌 혼합 형태다. `transfer_ownership` 이라는 복합 동사가 과거분사나 단순 현재형보다 의미 전달이 더 명확한 도메인 이유가 있을 수 있으나, 이에 대한 Rationale 이 spec 에 없다. 기각된 대안(`workspace.ownership_transferred` 등)과의 비교 설명도 없다.
  - 제안: Rationale 에 "복합 동사 현재형(`transfer_ownership`)을 택한 이유" 한 줄을 추가하거나, Planned 표에 이 action 을 포함해 "단일 동사로 대체 가능 여부" 를 명시한다.

---

## 요약

`spec/5-system/1-auth.md §4.1` 의 감사 로그 명명 규약 자체는 과거 결정(`spec/data-flow/1-audit.md` Rationale, cross-audit G-01·G-02 정정 이력)과 정합하며, 구현된 action 목록도 dot-prefix 원칙을 준수한다. 그러나 Planned action 의 `password_change`·`2fa_enable/disable` 가 dot-prefix 없이 기재되어 합의된 invariant 인 "resource dot-prefix 필수"를 위반하고 있으며(WARNING), Planned 전체와 `workspace.transfer_ownership` 의 verb 형태 선택에 명시적 Rationale 이 없어 구현 시점에 혼재가 재발할 여지가 있다(INFO 2건). 기각된 대안의 재도입이나 중대한 invariant 직접 위반은 발견되지 않았으나, Planned action 의 규약 이탈이 방치되면 향후 `AUDIT_ACTIONS` 추가 시 일관성이 깨질 수 있다.

---

## 위험도

LOW
