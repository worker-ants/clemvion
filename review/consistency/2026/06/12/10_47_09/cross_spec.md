# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/5-system/1-auth.md`
**검토 일시**: 2026-06-12
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] 세션 강제 종료 재인증 정책 불완전 기술 — WebAuthn 및 이메일 OTP 누락

- **target 위치**: `spec/5-system/1-auth.md §2.3` 세션 정책 표, "강제 종료 재인증" 행
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §6.1` API 표 (`POST /api/users/me/sessions/:familyId/revoke`, `POST /api/users/me/sessions/revoke-others`)
- **상세**: target `§2.3` 은 세션 강제 종료 재인증을 "비밀번호 재확인 필수. OAuth-only 사용자는 등록된 2FA (TOTP 또는 WebAuthn) 또는 이메일 OTP 로 대체. 두 방식 모두 등록한 사용자는 §1.4.2 의 우선순위(WebAuthn 우선)를 따른다" 로 정의한다. 반면 `9-user-profile.md §6.1` API 표는 두 엔드포인트에 대해 "비밀번호/TOTP 재인증" 으로만 기술하여 WebAuthn 재인증 경로와 OAuth-only 이메일 OTP 대체 경로가 누락되어 있다. §1.4.2 의 WebAuthn 우선 정책과 OAuth-only 이메일 OTP 대체 경로는 UI 구현 시 프론트엔드가 참조해야 할 재인증 분기 규칙이므로, 9-user-profile 에서 축약 기술이 프론트엔드 구현 누락으로 이어질 수 있다.
- **제안**: `spec/2-navigation/9-user-profile.md §6.1` 의 해당 두 엔드포인트 설명을 "비밀번호/TOTP/WebAuthn 재인증. OAuth-only 사용자는 이메일 OTP 로 대체. 우선순위는 [인증 spec §2.3](../5-system/1-auth.md#23-세션-정책)" 으로 보완하거나, cross-reference 링크를 명시하여 SoT 가 target 임을 명기한다.

---

### [WARNING] RBAC 매트릭스 분산 기술 — 9-user-profile §4.2 가 target §3.2 의 리소스를 부분 커버

- **target 위치**: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스 (Auth Config, Auth Config Reveal, Model Config, Knowledge Base, Statistics, System Status, Audit Log, Marketplace 설치 등 포함)
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §4.2` 역할 권한 매트릭스
- **상세**: target `§3.2` 는 Auth Config (CRUD), Auth Config Reveal, Model Config (CRUD), Knowledge Base (CRUD), Statistics (R), System Status (R), Marketplace 설치, Audit Log (R) 등 8개 리소스 행을 포함하는 전체 매트릭스를 정의한다. 반면 `9-user-profile §4.2` 는 워크플로우 생성/수정/삭제, 워크플로우 조회, 워크플로우 실행, Integration 생성(Org), 멤버 관리, 워크스페이스 설정, Admin 역할 부여, 워크스페이스 삭제의 8개 행만 포함하며 Auth Config, Model Config, Audit Log, Statistics, System Status 등은 누락되어 있다. 두 매트릭스는 서로 다른 목적(전체 시스템 권한 SoT vs 워크스페이스 관리 화면 관련 권한 요약)으로 존재하는 것으로 보이나, 이 의도가 어떤 문서에도 명시되지 않아 "두 매트릭스가 각각 다른 SoT 를 의도하는지, 아니면 9-user-profile 가 불완전한지" 가 모호하다. 현재 두 문서 간 직접 모순(같은 리소스에 대해 다른 권한)은 발견되지 않는다.
- **제안**: `spec/2-navigation/9-user-profile.md §4.2` 에 "전체 RBAC 매트릭스(Auth Config·Model Config·Audit Log·Statistics 등 포함)는 [Spec 인증/인가 §3.2](../5-system/1-auth.md#3-인가-authorization) 가 SoT" 임을 명시하는 주석을 추가하여 두 매트릭스의 역할 분담을 선언한다.

---

### [INFO] `GET /api/audit-logs` 엔드포인트 정의 위치

- **target 위치**: `spec/5-system/1-auth.md §5` API 엔드포인트 표, `GET /api/audit-logs` 행
- **충돌 대상**: `spec/data-flow/1-audit.md §2.1`
- **상세**: `data-flow/1-audit.md §2.1` 은 `GET /audit-logs` 의 조회 흐름을 기술하지만 엔드포인트를 canonical 정의하는 위치는 target `§5` 이다. 두 문서가 동일 엔드포인트를 다른 목적으로 다루어 중복처럼 보이나, data-flow 는 구현 흐름 기술이고 target 은 API 계약 정의이므로 의도적 분리다. 현재 두 문서는 내용 측면에서 일치(Admin+, 워크스페이스 단위)한다.
- **제안**: 현재 상태 유지. 단, 향후 엔드포인트 변경 시 두 문서를 동시 갱신하는 관계임을 알 수 있도록 target §5 의 해당 행에 `(data-flow/1-audit.md §2.1 구현 흐름 참조)` 링크를 추가하면 동기화 누락을 예방할 수 있다.

---

### [INFO] 이메일 인증 토큰 유효 기간 표기 위치 이중화

- **target 위치**: `spec/5-system/1-auth.md §5`, `POST /api/auth/resend-verification` 행의 "24h 유효"
- **충돌 대상**: `spec/1-data-model.md §2.1` User.email_verify_token ("24h 유효"), `spec/2-navigation/10-auth-flow.md §2.4` ("인증 토큰 유효기간: 24시간")
- **상세**: 세 문서가 모두 24시간으로 일치하므로 모순은 없다. 다만 토큰 유효 기간이 세 곳에 흩어져 있어 향후 값이 바뀔 때 누락 수정 위험이 있다.
- **제안**: `spec/1-data-model.md §2.1` 의 `email_verify_token` 설명이 기본 진실(DB 스키마 SoT)이고, 나머지 문서는 "상세는 [데이터 모델 §2.1]" 참조로 연결하면 단일 진실로 수렴할 수 있다. 당장 수정 필수는 아님.

---

### [INFO] 초대 Rate Limit 참조 중복 표기

- **target 위치**: `spec/5-system/1-auth.md §1.5.1` 토큰 정책 표 "Rate Limit" 행
- **충돌 대상**: `spec/data-flow/12-workspace.md §1.2`
- **상세**: target 은 "분당 10건 (`INVITATION_THROTTLE`, `workspaces.controller.ts`) — 이메일 폭격 방지. [data-flow §1.2] 와 동일 값" 이라고 교차 참조한다. 두 문서 모두 분당 10건으로 일치한다. 모순 없음. target 이 data-flow 를 참조 SoT 로 명시하지 않고 "동일 값" 으로 표현하므로, 어느 쪽이 SoT 인지 모호하다.
- **제안**: Rate Limit 값은 코드(`INVITATION_THROTTLE`)가 실질 SoT 이므로 현재 표기가 실용적이나, 향후 값 변경 시 두 문서를 함께 수정해야 함을 인지. 현재 상태는 허용 범위.

---

## 요약

`spec/5-system/1-auth.md` 는 데이터 모델(`1-data-model.md §2.1·§2.17~§2.18·§2.21`), 인증 데이터 흐름(`data-flow/2-auth.md`), 감사 로그 데이터 흐름(`data-flow/1-audit.md`), 인증 UI(`2-navigation/10-auth-flow.md`), 사용자 프로필·워크스페이스 관리(`2-navigation/9-user-profile.md`), 설정 화면(`2-navigation/6-config.md`)과 전반적으로 일관성을 유지한다. 직접 모순(CRITICAL)은 발견되지 않았다. 두 개의 WARNING 은 모두 "다른 spec 에서 target 의 정책을 불완전하게 기술하거나 참조가 누락된 경우"로, target 자체의 정의를 변경할 사안이 아니라 참조 문서(`9-user-profile.md`)를 보완해야 하는 사안이다.

## 위험도

LOW
