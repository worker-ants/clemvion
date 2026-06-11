# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 범위: `spec/5-system` (1-auth.md · 10-graph-rag.md · 11-mcp-client.md)

---

## 발견사항

- **[WARNING]** `password_change, 2fa_enable/disable` — Planned audit action 명명이 dot-prefix 규약 위반
  - target 위치: `spec/5-system/1-auth.md §4.1` Planned 표 — `| 인증 (워크스페이스 컨텍스트) | password_change, 2fa_enable/disable |`
  - 충돌 대상: 동 파일 §4.1 "Action naming 규약" — "`<resource>.<verb>` — resource dot-prefix 가 필수다"; `spec/data-flow/1-audit.md §1.1` 커버리지 갭 설명에서도 동일 비규약 형식(`password_change 등`) 인용
  - 상세: `workspace.create`, `member.invite`, `workflow.create` 등 다른 Planned 액션은 모두 `<resource>.<verb>` 형식을 준수하나, `password_change`·`2fa_enable/disable` 만 resource prefix 가 없다. 나아가 `2fa_enable/disable` 는 슬래시(`/`) 로 두 액션을 압축 표기했는데, 구현 시 `AUDIT_ACTIONS` union 에 어떤 문자열 리터럴을 추가해야 하는지 모호하다 (`user.password_change` 인지 `auth.password_change` 인지, `user.2fa_enabled`/`user.2fa_disabled` 인지 확정되지 않음).
  - 제안: `spec/5-system/1-auth.md §4.1` Planned 표의 해당 행을 `user.password_change, user.2fa_enabled, user.2fa_disabled` (또는 `auth.password_change` 등 팀이 선택한 resource prefix)로 명시 확정한다. 동시에 `spec/data-flow/1-audit.md §1.1` 커버리지 갭 설명도 동일 명칭으로 동기화.

- **[INFO]** `POST /auth/resend-verification` — §1.1 인라인 표에서 `/api` prefix 누락
  - target 위치: `spec/5-system/1-auth.md §1.1` 표 — `` `POST /auth/resend-verification` ``
  - 충돌 대상: 동 파일 §5 엔드포인트 표 — `POST /api/auth/resend-verification`; `spec/2-navigation/10-auth-flow.md` 라인 139·460 — `POST /api/auth/resend-verification`
  - 상세: 동일 엔드포인트가 한 곳(`§1.1 표`)에서는 `/api` prefix 없이, 다른 세 곳에서는 `/api` prefix 포함으로 표기. 코드 실제 경로는 `/api/auth/resend-verification` 이며 spec/5-system/1-auth.md §5 및 navigation spec 이 일치하므로 §1.1 표가 약칭 표기한 것으로 보이나, 일관성 관점에서 독자 혼동 가능.
  - 제안: `spec/5-system/1-auth.md §1.1` 표의 경로를 `POST /api/auth/resend-verification` 로 통일.

---

## 요약

`spec/5-system` 전체 범위(1-auth.md · 10-graph-rag.md · 11-mcp-client.md)와 다른 spec 영역(data-flow · 1-data-model · 2-navigation · 0-overview) 간에 데이터 모델·API 계약·RBAC·상태 전이·계층 책임은 전반적으로 정합하다. 발견된 문제는 두 가지로, 하나는 `spec/5-system/1-auth.md §4.1`의 Planned audit action 이름이 동 파일이 명문화한 `<resource>.<verb>` 규약을 이탈해 구현 시 `AUDIT_ACTIONS` 상수에 어떤 리터럴을 추가할지 모호한 WARNING, 다른 하나는 `§1.1` 인라인 경로 표기가 `/api` prefix 를 누락한 INFO 수준 명명 불일치다. `graph-rag.md`의 엔티티·검색 흐름 정의와 `spec/1-data-model.md §2.12.x`, MCP client의 Integration·SSRF 모델과 `spec/1-data-model.md §2.10`, auth spec의 RBAC 매트릭스와 `spec/2-navigation/6-config.md §model-configs` RBAC는 모두 일관된다.

---

## 위험도

LOW
