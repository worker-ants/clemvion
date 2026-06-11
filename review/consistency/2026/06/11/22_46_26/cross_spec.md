# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system` (구현 완료 후 검토, diff-base=origin/main)
검토 관련 영역: `spec/1-data-model.md`, `spec/0-overview.md`, `spec/2-navigation/4-integration.md`, `spec/2-navigation/9-user-profile.md`, `spec/data-flow/1-audit.md`, `spec/5-system/13-replay-rerun.md`

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` §4.1 Planned 액션 목록과 `spec/data-flow/1-audit.md` §1.1 간 표현 차이

- **target 위치**: `spec/5-system/1-auth.md` §4.1 Planned 표 — `인증 (워크스페이스 컨텍스트) | password_change, 2fa_enable/disable`
- **충돌 대상**: `spec/data-flow/1-audit.md` §1.1 — `인증(password_change 등) 액션은 모두 미구현` (슬러그 `2fa_enable/disable` 이 명시되지 않고 `등` 으로 축약)
- **상세**: 1-auth.md §4.1 은 Planned 액션으로 `password_change`, `2fa_enable/disable` 을 명시하지만, data-flow/1-audit.md §1.1 은 이들을 `password_change 등` 으로 뭉뚱그려 나열한다. 슬러그 자체는 충돌하지 않으나, `2fa_enable` 과 `2fa_disable` 의 명시적 열거가 data-flow 에는 없어 향후 구현 시 데이터 흐름 spec 이 SoT 로 기능하는 데 gap 이 있다.
- **제안**: `spec/data-flow/1-audit.md` §1.1 Planned 섹션에 `password_change`, `2fa_enable`, `2fa_disable` 을 명시적으로 열거하도록 동기화. (단, `auth` 영역이 SoT 이고 data-flow 는 커버리지 추적용이므로 현행 운영 차단 없음.)

---

### [INFO] `spec/5-system/1-auth.md` §3.2 `Integration (Org): Editor=R` 과 `spec/2-navigation/9-user-profile.md` §4.2 매트릭스 커버리지 차이

- **target 위치**: `spec/5-system/1-auth.md` §3.2 — `Integration (Org) | CRUD | CRUD | R | R`
- **충돌 대상**: `spec/2-navigation/9-user-profile.md` §4.2 — `Integration 생성 (Org) | ✅ | ✅ | ❌ | ❌`
- **상세**: 1-auth.md §3.2 는 Integration (Org) 의 Editor 권한을 `R` (조회만) 로 기술한다. 9-user-profile.md §4.2 는 "생성" 측면만 열거하고 "조회/수정/삭제" 행이 없다. 두 표는 상호 모순은 아니지만 (Editor 가 조회는 가능하되 생성·수정·삭제는 불가) 9-user-profile.md 가 통합 CRUD 관점의 전체 행을 누락하고 있다. `spec/0-overview.md` 는 이 관계를 "상보 관계(모순 아님)" 로 명시적으로 인정하고 있어 운영 위험은 없다.
- **제안**: 9-user-profile.md §4.2 에 `Integration 조회 (Org): Owner✅/Admin✅/Editor✅/Viewer✅`, `Integration 수정·삭제 (Org): Owner✅/Admin✅/Editor❌/Viewer❌` 행 추가로 매트릭스를 완성하면 외부 독자가 auth spec 없이도 전체 그림을 파악할 수 있다.

---

### [INFO] `spec/5-system/1-auth.md` §4.1 audit action naming 규약에서 `2fa_enable/disable` 이 `<resource>.<verb>` 규약을 준수하지 않는 표기

- **target 위치**: `spec/5-system/1-auth.md` §4.1 Planned 표 — `인증 (워크스페이스 컨텍스트) | password_change, 2fa_enable/disable`
- **충돌 대상**: `spec/5-system/1-auth.md` §4.1 Action naming 규약 — `<resource>.<verb>` (resource dot-prefix 필수)
- **상세**: 같은 §4.1 안에서 naming 규약은 `<resource>.<verb>` (dot-prefix 필수) 를 명시하고 있지만, 동일 절의 Planned 표에는 `2fa_enable` / `2fa_disable` 처럼 dot-prefix 가 없는 슬러그가 사용됐다. 구현 시 이를 `totp.enabled` / `totp.disabled` 또는 `mfa.enabled` / `mfa.disabled` 등으로 바꿔야 하는지 명확하지 않다. `password_change` 도 마찬가지 (`user.password_changed` 형태가 규약에 부합).
- **제안**: §4.1 Planned 표의 슬러그를 미리 규약 형태로 정정하거나, "구현 시 `AUDIT_ACTIONS` 에 추가할 때 dot-prefix 규약을 적용한다" 는 한 줄 주석을 추가해 향후 작업자의 혼란을 방지한다.

---

## 요약

`spec/5-system` 전반(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)과 다른 spec 영역 사이에서 CRITICAL·WARNING 수준의 충돌은 발견되지 않았다. 데이터 모델(`spec/1-data-model.md`)·API 계약·상태 전이·RBAC 구조는 일관되게 정렬돼 있다. 주요 개정 사항인 audit action rename(`re_run_initiated` → `execution.re_run`)과 `auth_config.*` 액션 naming 은 1-auth.md, data-flow/1-audit.md, 13-replay-rerun.md 전반에서 일치한다. `ModelConfig` 단일화(V088–V092) 역시 1-data-model.md, 0-overview.md, 1-auth.md §4.1 Planned 표가 `model_config.*` 로 통일돼 있다. 발견된 세 건은 모두 INFO 등급으로, Planned 액션 슬러그의 dot-prefix 미준수 표기와 권한 매트릭스 커버리지 gap 이다 — 운영 차단이나 구현 충돌 없이 동기화 작업으로 해소 가능하다.

## 위험도

LOW
