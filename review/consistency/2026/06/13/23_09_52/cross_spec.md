# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=fcd1d594)
Target: `spec/5-system/1-auth.md` (§4 감사 로그 / `user.*` 인증 감사 액션 중심)

---

## 발견사항

### [INFO] `spec/1-data-model.md §2.18 AuditLog.ip_address` — nullable 표기 누락

- **target 위치**: `spec/5-system/1-auth.md` §4.1, data-flow §1.1 Schema 매핑
- **충돌 대상**: `spec/1-data-model.md §2.18 AuditLog` 표 (`ip_address | String | 요청 IP`)
- **상세**: `spec/1-data-model.md §2.18` 의 AuditLog 표는 `ip_address` 를 `String`(nullable 표시 없음)으로 기재하나, 실제 entity(`audit-log.entity.ts`)는 `nullable: true`, data-flow `spec/data-flow/1-audit.md §4.1` Schema 매핑도 `ip_address?`(선택)로 기재한다. `AuditLogsService.record({ ipAddress? })` 도 optional 파라미터다. 데이터 모델 spec 이 실제 nullable 제약을 반영하지 못하고 있다.
- **제안**: `spec/1-data-model.md §2.18` AuditLog 표의 `ip_address` 타입을 `String?`(optional)로 정정. 코드·data-flow spec 과 일치. 기능 영향 없음(문서 정정만).

---

### [INFO] `spec/5-system/1-auth.md §4.1` 구현 액션 표 — `webauthn.controller` 명칭 표기

- **target 위치**: `spec/5-system/1-auth.md §4.1` "인증 (워크스페이스 컨텍스트)" 행, `webauthn.controller` 명시
- **충돌 대상**: `spec/5-system/1-auth.md §1.4.H` Rationale ("컨트롤러 host 위치 — AuthModule"), `data-flow/1-audit.md §1.1` 표 작성자 컬럼
- **상세**: `spec/5-system/1-auth.md §4.1` 의 구현 액션 분류 주석은 기록 위치를 "`users.controller`·`auth.controller`·`webauthn.controller`"로 표기한다. `data-flow/1-audit.md §1.1` 표는 writer module 을 `auth/webauthn/webauthn.controller.ts`로 기재한다. 코드상으로는 `webauthn.controller.ts`가 `AuthModule.controllers[]`에 등록되어 있으나 파일 경로는 `auth/webauthn/` 서브폴더다. 두 표기 모두 사실이지만 참조 방식이 다르다. Rationale 1.4.H 는 "컨트롤러 host 는 AuthModule" 이라고 명시한다.
- **제안**: spec/5-system/1-auth.md §4.1 주석의 `webauthn.controller` 를 `auth/webauthn/webauthn.controller` 로 명확화하거나, data-flow §1.1 표기와 통일. 의미 모순은 없으며 명명 일관성 차원의 INFO.

---

### [INFO] `spec/2-navigation/9-user-profile.md §4.2` 권한 매트릭스 — Audit Log 항목 부재

- **target 위치**: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스 ("Audit Log | R | R | — | —")
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §4.2` 역할 권한 매트릭스 (8행 매트릭스 — Audit Log 항목 없음)
- **상세**: `spec/5-system/1-auth.md §3.2` 의 권한 매트릭스에는 "Audit Log — R(Admin+만 조회)" 행이 명시되나, `spec/2-navigation/9-user-profile.md §4.2` 의 화면별 권한 매트릭스에는 Audit Log 항목이 없다. 두 spec 은 서로 다른 관점(시스템 RBAC vs 화면별 권한)이지만, Audit Log 접근 권한이 navigation spec 에도 동기화되면 일관성이 높아진다.
- **제안**: navigation spec §4.2 에 "감사 로그 조회 | Admin+ | — | — | —" 행 추가를 검토. 단, 두 spec 의 scope(인증 시스템 정의 vs UI 매트릭스)가 다르므로 의무적 업데이트는 아님. INFO 수준.

---

## 요약

`spec/5-system/1-auth.md` §4 감사 로그 영역(특히 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 인증 감사 액션)은 `spec/1-data-model.md`, `spec/data-flow/1-audit.md`, `spec/2-navigation/9-user-profile.md`, 코드 구현 전반과 구조적 모순 없이 일관된다. `data-flow/1-audit.md §1.1` 이 구현 현황 SoT로서 `spec/5-system/1-auth.md §4.1` 목표 커버리지와 명확히 분리돼 있으며, `audit_log.workspaceId` non-nullable 설계·`user.*` 액션의 세션 workspace 귀속·controller 경계 기록 등 핵심 설계 결정이 세 문서에 걸쳐 일관되게 반영됐다. 발견된 세 건은 모두 INFO 등급(코드 동작·보안에 영향 없는 문서 표기 비일관)이며, `ip_address` nullable 표기 누락이 `spec/1-data-model.md` 단독 정정으로 해소 가능한 가장 구체적인 항목이다.

## 위험도

LOW
