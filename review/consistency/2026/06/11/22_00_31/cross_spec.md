# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/5-system` (구현 완료 후 검토, diff-base=origin/main)
**검토 일시**: 2026-06-11
**검토자**: Cross-Spec 일관성 checker

---

## 발견사항

### **[WARNING]** `spec/2-navigation/4-integration.md §14.3` 감사 로그 목록에서 `integration.updated` 누락

- **target 위치**: `spec/5-system/1-auth.md §4.1 기록 대상 액션 — Integration 카테고리`
- **충돌 대상**: `spec/2-navigation/4-integration.md §14.3 감사 로그(AuditLog)` / `spec/data-flow/1-audit.md §1.1 표`
- **상세**: `spec/5-system/1-auth.md §4.1` 과 `spec/data-flow/1-audit.md §1.1` 은 모두 `integration.updated` 를 구현된 감사 액션으로 열거한다. 그러나 `spec/2-navigation/4-integration.md §14.3` 의 감사 로그 설명은 "action 은 `integration.created`, `integration.deleted`, `integration.rotated`, `integration.reauthorized`, `integration.scope_changed`" 5개만 나열하고 `integration.updated` 를 빠뜨렸다. `data-flow/1-audit.md §1.1 표`는 `integrations.service.ts` 가 `integration.updated` 를 실제로 기록한다고 명시한다.
- **제안**: `spec/2-navigation/4-integration.md §14.3` 에 `integration.updated` 를 추가한다. 예: "action 은 `integration.created`, `integration.updated`, `integration.deleted`, `integration.rotated`, `integration.reauthorized`, `integration.scope_changed`".

---

### **[WARNING]** Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 `<resource>.<verb>` 규약 미준수

- **target 위치**: `spec/5-system/1-auth.md §4.1 Planned 카테고리 표 — "인증 (워크스페이스 컨텍스트)"`
- **충돌 대상**: `spec/5-system/1-auth.md §4.1` 의 동일 섹션 상단 Action naming 규약 ("resource dot-prefix 가 필수", `<resource>.<verb>`)
- **상세**: 동일 섹션에서 명시한 naming 규약 `<resource>.<verb>` 에 따르면 구현된 액션은 모두 `integration.created`, `auth_config.create`, `execution.re_run` 등 dot-prefix 를 준수한다. 그러나 바로 아래의 Planned 표에서 `password_change`, `2fa_enable/disable` 는 resource 부분이 없는 flat 형태로 기술됐다. `data-flow/1-audit.md §1.1` 은 커버리지 갭을 기술할 때도 이 이름을 그대로 사용해 non-conformant 명칭이 양쪽에 전파된 상태다. 실제 구현 시 `AUDIT_ACTIONS` 에 이 형태로 추가되면 규약 위반이 된다.
- **제안**: Planned 표의 이름을 규약에 맞게 재명명한다 — 예: `password_change` → `user.password_change` 또는 `auth.password_change`, `2fa_enable`/`2fa_disable` → `auth.2fa_enable` / `auth.2fa_disable`. `data-flow/1-audit.md §1.1` 의 커버리지 갭 기술도 동기화한다.

---

### **[INFO]** `spec/5-system/1-auth.md §1.5.1` 의 cross-reference 앵커 누락

- **target 위치**: `spec/5-system/1-auth.md §1.5.1 Rate Limit` 행의 링크 `[data-flow §1.2](../data-flow/12-workspace.md)`
- **충돌 대상**: `spec/data-flow/12-workspace.md §1.2 멤버 초대 발급`
- **상세**: 링크 텍스트는 "data-flow §1.2" 로 `§1.2` 섹션을 지칭하지만 URL 에 앵커(`#12-멤버-초대-발급` 등)가 없어 `data-flow/12-workspace.md` 문서 최상단으로 연결된다. 참조 대상 파일과 값 자체(분당 10건, `INVITATION_THROTTLE`)는 일치하며 충돌이 아니라 링크 정밀도 문제다.
- **제안**: 링크를 `[data-flow/12-workspace.md §1.2](../data-flow/12-workspace.md#12-멤버-초대-발급)` 또는 동등한 앵커를 포함한 형태로 수정한다.

---

### **[INFO]** `spec/5-system/1-auth.md §4.1` 구현된 액션 표와 `spec/5-system/13-replay-rerun.md §11` 의 감사 로그 정의 분산

- **target 위치**: `spec/5-system/1-auth.md §4.1 기록 대상 액션`
- **충돌 대상**: `spec/5-system/13-replay-rerun.md §11 감사 로그`
- **상세**: `auth.md §4.1` 은 `execution.re_run` 을 구현된 액션 표에 열거한다. `13-replay-rerun.md §11` 은 독립적으로 동일 액션과 필드 매핑(`originalExecutionId`, `chainId`, `dryRun`, `inputModified`)을 상세 정의한다. 두 문서 간 명시적 정방향 상호 참조(cross-ref)가 없어 미래 수정 시 동기화 누락 위험이 있다. 현재는 값이 일치하므로 충돌이 아니다.
- **제안**: `auth.md §4.1` 의 `execution.re_run` 행에 `[§13 Replay/Re-run 상세](./13-replay-rerun.md#11-감사-로그)` 참조 각주를 추가하거나, `13-replay-rerun.md §11` 에 "audit SoT 는 `auth.md §4.1`" 을 명시한다.

---

### **[INFO]** RBAC 매트릭스: `spec/2-navigation/9-user-profile.md §4.2` 와 `spec/5-system/1-auth.md §3.2` 의 Audit Log 행 비대칭

- **target 위치**: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스 — Audit Log 행`
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §4.2 역할 권한 매트릭스`
- **상세**: `auth.md §3.2` 는 `Audit Log | R | R | — | —` 를 명시(Owner/Admin R, Editor/Viewer 없음)한다. 반면 `user-profile.md §4.2` 의 매트릭스는 Audit Log 행 자체가 없다. 두 매트릭스는 관심사 범위가 다르므로(auth spec 은 시스템 전체, user-profile spec 은 워크스페이스 UI 기능) 이는 의도된 범위 차이로 보이나, Audit Log 조회 권한이 UI 설명에서 누락됐을 가능성이 있다.
- **제안**: `user-profile.md §4.2` 에 Audit Log 행을 추가하거나, 두 매트릭스의 scope 차이를 노트로 명시해 독자가 `auth.md §3.2` 를 SoT 로 인식하게 한다.

---

## 요약

`spec/5-system` (주로 `1-auth.md`) 은 전반적으로 다른 영역 spec 과 잘 정합된다. 데이터 모델·API 계약·상태 전이·RBAC 구조에서 직접적인 모순은 발견되지 않았다. 가장 실질적인 불일치는 `spec/2-navigation/4-integration.md §14.3` 의 감사 로그 목록에서 `integration.updated` 가 빠진 것(WARNING)과, Planned 감사 액션 `password_change` / `2fa_enable/disable` 이 동일 섹션에서 선언한 `<resource>.<verb>` 규약을 위반한 것(WARNING)이다. 두 경우 모두 현재 구현에 직접 영향을 주지는 않으나, Planned 액션이 `AUDIT_ACTIONS` 에 추가될 때 규약 위반 또는 누락이 그대로 코드에 반영될 수 있어 사전 정정이 필요하다. 나머지는 링크 앵커 누락과 cross-ref 보완 수준의 INFO 항목이다.

## 위험도

LOW

---

STATUS: SUCCESS
