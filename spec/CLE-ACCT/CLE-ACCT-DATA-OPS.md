---
id: "CLE-ACCT-DATA-OPS"
title: "계정과 워크스페이스 데이터 흐름 — 테이블 쓰기 · 배치 · 외부 의존"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-DATA"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-DATA"]
area: "CLE-ACCT"
content_hash: "752966967ffb319a2380eb500674d8b5946d1689ff6bb39fc36ab85859bbd4c2"
read_as: "approved_fallback"
task: "CLE-T-Q6E11N"
source_paths: []
mirror_sha256: "9ffef55fb3ce89dd5d103392ed8d357aea892dcab10dc593fbac6660ec00e7b3"
etag: "sha256-5c30e6b8837b8078fe43b383f727c37ca83ba09ee169b02a1dfcd4c55e1196f8"
---
## 개요

이 문서는 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 의 하위 문서로 흐름별 테이블 쓰기 컬럼 매핑, 이 영역의 BullMQ 배치 · Redis 키 · 요청 빈도 제한, 외부 의존(SMTP · OAuth 제공자 · 감사 로그)을 정한다. 흐름의 순서는 [인증 흐름](CLE-ACCT-DATA-AUTH.md) 과 [워크스페이스 데이터와 흐름](CLE-ACCT-DATA-WS.md), 컬럼 정의는 [사용자 · 인증 엔티티](CLE-ACCT-DATA-MODEL.md) 에 있다.

## 테이블 쓰기 매핑

흐름에서 읽고 쓰는 컬럼만 모았다.

| 테이블 | 흐름 | 읽기·쓰기 컬럼 | 인덱스·제약 |
| --- | --- | --- | --- |
| `user` | 가입 | INSERT `email, password_hash, name, locale, theme, email_verify_token, email_verify_expires_at, created_at` | `email UNIQUE`(V001) |
| `user` | 프로필 수정 | UPDATE `name, avatar_url, locale, theme`. `theme` 이 `light`·`dark`·`system` 밖이면 API 가 먼저 400 `VALIDATION_ERROR` 로 막는다 | `chk_user_theme` |
| `user` | 로그인 실패 | UPDATE `login_attempts, locked_until` | 없음 |
| `user` | OAuth 첫 연결 | UPDATE `oauth_provider, oauth_provider_id` | 없음 |
| `user` | TOTP 켜기·끄기 | UPDATE `two_factor_enabled, two_factor_secret, two_factor_setup_started_at, totp_recovery_codes`. 설정 시작은 비밀번호를 확인한 뒤 `two_factor_secret` 과 `two_factor_setup_started_at = now` 를 `two_factor_enabled = false` 조건부 UPDATE 하나로 쓴다. 활성화 검증은 `two_factor_secret` 이 코드를 확인한 secret 과 같다는 조건을 더한 조건부 UPDATE 로 `two_factor_enabled=true` 와 `totp_recovery_codes` 를 쓰고 `two_factor_setup_started_at` 을 NULL 로 비운다. 끄기는 비밀번호와 코드(6자리 TOTP 코드나 TOTP 복구 코드)를 모두 확인한 뒤 `two_factor_enabled` 를 `false` 로, 나머지 세 컬럼을 NULL 로 바꾼다. 활성화 검증에서 그 사이 secret 이 바뀌었거나 끄기의 코드가 틀리면 401 `TOTP_INVALID` 이고 컬럼은 그대로다. 코드 확인 실패는 로그인 이력에 쓰지 않는다. 상태별 결과와 에러 코드(409 `TOTP_ALREADY_ENABLED`, 401 `TOTP_INVALID`, 400 `TOTP_NOT_INITIALIZED`)와 만료 비우기 조건은 [인증 흐름 「TOTP 대기 secret」](CLE-ACCT-DATA-AUTH.md#totp-대기-secret-usertwo_factor_setup_started_at) | 없음 |
| `user` | Passkey 복구 코드 발급·소진·재발급 | UPDATE `webauthn_recovery_codes` | 없음 |
| `user` | 이메일 변경 | UPDATE `pending_email, email_change_token, email_change_expires_at`, 확정 때 `email, email_verified`. `pending_email` 은 앞뒤 공백을 지운 소문자로 저장하고 확정 때 그 값을 `email` 로 옮긴다 | `email UNIQUE`, `LOWER(email)`(V101) |
| `webauthn_credential` | 등록·이름 변경·삭제·인증 | INSERT(등록 검증), UPDATE `counter, last_used_at, device_name`, DELETE(개별 삭제, 서명 검증을 통과한 응답의 counter 역행) | `credential_id UNIQUE`, `(user_id)` |
| `refresh_token` | 로그인·갱신 | INSERT `user_id, token_hash, family_id, is_revoked=false, expires_at, remember_me, device_label, user_agent, ip_address` | `token_hash UNIQUE`, `(user_id, family_id) WHERE is_revoked=false`(V040) |
| `refresh_token` | 토큰 회전 | 옛 행 UPDATE `is_revoked=true, last_used_at, last_used_ip`, 새 행 INSERT(옛 행의 `remember_me` 를 이어받는다) | 없음 |
| `refresh_token` | 재사용 감지 | 같은 `family_id` 전체 UPDATE `is_revoked=true` | 없음 |
| `auth_oauth_state` | OAuth 시작 | INSERT `state, provider, mode, remember_me, expires_at = now+10m` | `state UNIQUE`(V013) |
| `auth_oauth_state` | OAuth 콜백 | DELETE `WHERE state=? AND expires_at > now RETURNING`(원자적 1회 소비) | 없음 |
| `login_history` | 모든 이벤트 | INSERT `user_id, email, event, ip_address, user_agent, device_label, family_id, failure_reason, created_at` | `(user_id, created_at DESC)`, `(email, created_at DESC)`(V040) |
| `workspace` | 가입(이메일 인증 단계)·팀 생성 | INSERT `name, type, owner_id, slug, settings={}, created_at` | `slug UNIQUE`(V001), `uq_workspace_personal_owner`(V109) |
| `workspace` | 소유자 이양 | UPDATE `owner_id` | 없음 |
| `workspace` | 설정 변경 | UPDATE `settings`(부분 병합), `updated_at` | 없음 |
| `workspace` | 삭제 | DELETE(같은 트랜잭션에서 `workspace_invitation`·`workspace_member` 를 먼저 명시 삭제) | 없음 |
| `secret_store` | 워크스페이스 삭제 | 커밋 뒤 트리거마다 DELETE `ref LIKE 'secret://triggers/<id>/%'` | FK 없음(V063) |
| `workspace_member` | 가입·초대 수락·직접 추가 | INSERT `workspace_id, user_id, role, invited_at, joined_at` | `(workspace_id, user_id) UNIQUE`, `(user_id)`(V129) |
| `workspace_member` | 역할 변경 | UPDATE `role` | 없음 |
| `workspace_member` | 멤버 제거·나가기 | DELETE | 없음 |
| `integration` | 멤버 제거·나가기 | 멤버십 DELETE 와 같은 트랜잭션에서 그 멤버의 개인 통합을 DELETE(조건은 [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md#멤버가-나가거나-제거될-때)) | 없음 |
| `workspace_invitation` | 발급 | INSERT `workspace_id, email, role, token, invited_by, expires_at, created_at`. 대기 초대가 있으면 그 행 UPDATE | `token UNIQUE`(V017), `(email)`, `(workspace_id)`, 부분 UNIQUE `(workspace_id, email) WHERE accepted_at IS NULL` |
| `workspace_invitation` | 재발송 | UPDATE `token, invited_by, expires_at` | 없음 |
| `workspace_invitation` | 수락 | UPDATE `accepted_at, accepted_by`(`WHERE accepted_at IS NULL`) | 없음 |
| `workspace_invitation` | 취소·만료 정리 | DELETE(취소 물리 삭제, `pruneExpired`) | 없음 |

## Redis 와 배치

이 영역은 BullMQ 반복 작업 큐 두 개를 등록한다. 큐 전체 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 있다.

| 큐 | 일정 | 동작 |
| --- | --- | --- |
| `login-history-pruner` | 매일 03:00 Asia/Seoul(`upsertJobScheduler` pattern `0 3 * * *`, 명시적 tz) | 180일이 지난 `login_history` 행을 배치 루프로 지운다(`login-history.service.ts` 의 `pruneOlderThanRetention`, `RETENTION_DAYS=180`). `auth.module.ts` 의 `BullModule.registerQueue`, `jobs/login-history-pruner.service.ts` |
| `workspace-invitations-pruner` | 매일 04:00 Asia/Seoul | 만료되고(`expires_at < now`) 수락되지 않은(`accepted_at IS NULL`) 초대 행을 지운다(`WorkspaceInvitationsPrunerService`, 비즈니스 로직은 `WorkspaceInvitationsService.pruneExpired(now)`). `MONITORED_QUEUES` 에 등재 |

두 큐 모두 멀티 인스턴스에서도 전역 1회만 돈다.

BullMQ 내부 키 말고 이 영역이 직접 만드는 Redis 키에는 Passkey 인증 챌린지 기록 `auth:webauthn-auth-challenge:<challenge>` 가 있다. 챌린지 기록은 TTL 로 사라지므로 정리 배치가 없다. 이 기록의 보존 기간 · 용도 · 실패 정책은 [가입과 로그인 「Passkey 등록·인증 흐름」](CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름) 이 정한다. 이 영역이 만드는 키의 목록은 [비동기 큐와 Redis 키 목록 「다른 모듈의 키」](../CLE-PLAT/CLE-PLAT-QUEUE.md#다른-모듈의-키) 가 정본이다.

요청 빈도 제한은 Redis 가 아니라 `@nestjs/throttler` 의 in-memory 카운터로 구현했다. 집계 키는 전역 가드 `UserThrottlerGuard` 가 정한다. 인증한 HTTP 요청은 사용자(`user:<sub>`)로 세고 인증 없이 받는 `@Public` 라우트는 클라이언트 IP 로 센다. 그래서 라우트의 집계 기준은 그 라우트가 JWT 인증을 요구하는지로 정해진다.

서명 참조가 있는 채팅 채널 트리거 요청(`POST /api/hooks/:endpointPath` 가운데 트리거 설정에 `config.chatChannel.provider` 와 `config.chatChannel.inboundSigningRef` 가 모두 있는 요청)은 전역 한도로 세지 않는다. 이 라우트는 `@DeferGlobalThrottle()` 로 전역 가드 `UserThrottlerGuard` 가 넘기고, `PublicWebhookThrottleGuard` 뒤의 라우트 가드 `HookTriggerThrottlerGuard` 가 그 가드가 조회한 트리거로 면제 여부를 판정(`isSignedChatChannelTrigger`)해 전역 가드와 같은 한도 · 저장소 · 집계 키로 센다. 서명 참조가 없는 채팅 채널 트리거, 트리거가 없거나 조회에 실패한 요청은 센다. 정책과 근거는 [채팅 채널 「인바운드 관문 순서」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-관문-순서) 와 [HTTP API 규약 §7](../CLE-API/CLE-API-CONV.md#7-요청-빈도-제한) 이 정한다.

한도 수치는 [HTTP API 규약 §7](../CLE-API/CLE-API-CONV.md#7-요청-빈도-제한) 의 사본이다. 이 표는 집계 키와 구현 위치의 정본이다.

| 범위 | 한도 | 집계 키 | 위치 |
| --- | --- | --- | --- |
| 전역 (모든 HTTP API) | 분당 100회 | 인증 요청은 사용자, `@Public` 라우트는 IP | `app.module.ts` 의 `ThrottlerModule.forRoot`, `common/guards/user-throttler.guard.ts`(`UserThrottlerGuard`, `@DeferGlobalThrottle()`), `common/utils/http-context.ts`, `common/utils/throttler-skip.ts`(`shouldSkipThrottle`). `POST /api/hooks/:endpointPath` 는 `modules/hooks/hook-trigger-throttler.guard.ts`(`HookTriggerThrottlerGuard`)와 면제 판정 `modules/chat-channel/chat-channel-secret-refs.ts`(`isSignedChatChannelTrigger`) |
| `register`·`login` | 분당 10회 | IP | `auth.controller.ts` 의 `@Throttle` |
| `forgot-password`·`resend-verification`·`check-email` | 분당 5회 | IP | `auth.controller.ts` |
| `2fa/setup` | 분당 10회 | 사용자 | `auth.controller.ts`(`SENSITIVE_ACTION_THROTTLE`) |
| `2fa/verify` | 분당 10회 | 사용자 | `auth.controller.ts`(`SENSITIVE_ACTION_THROTTLE`) |
| `2fa/disable` | 분당 10회 | 사용자 | `auth.controller.ts`(`SENSITIVE_ACTION_THROTTLE`) |
| `2fa/webauthn/register/options`·`2fa/webauthn/recovery-codes/regenerate`·`2fa/webauthn/credentials/:id/delete` | 분당 10회 | 사용자 | `webauthn/webauthn.controller.ts`(`SENSITIVE_ACTION_THROTTLE`) |
| 이메일 변경 `request`·`resend` | 분당 5회 | 사용자 | `users.controller.ts` |
| `auth/sessions/:familyId/revoke`·`auth/sessions/revoke-others` | 분당 10회·5회 | 사용자 | `sessions.controller.ts` |
| 초대 발급·재발송 | 분당 10건 | 사용자 | `workspaces.controller.ts`(`INVITATION_THROTTLE`, 값은 `SENSITIVE_ACTION_THROTTLE`) |
| 공개 초대 메타 조회 | 분당 30건 | IP | `invitations.controller.ts` |

전역 한도를 건너뛰는 조건은 [HTTP API 규약 「요청 빈도 제한」](../CLE-API/CLE-API-CONV.md#7-요청-빈도-제한) 이 정한다.

초대 발송 · provider probe · 2단계 인증 설정 시작 · 활성화 검증 · 끄기 · Passkey 등록 옵션 · Passkey 복구 코드 재발급 · Passkey 삭제는 `SENSITIVE_ACTION_THROTTLE` 상수를 공유하고 카운터는 라우트마다 따로 센다. `verifyPasswordForUser` 로 계정 비밀번호를 다시 확인하는 라우트(2단계 인증 설정 시작 · 끄기, Passkey 등록 옵션 · 복구 코드 재발급 · 삭제)에 이 상수가 모두 걸려 있는지는 단위 테스트로 고정한다. 검사 대상은 테스트에 적어 둔 라우트 목록뿐이라 목록에 없는 새 라우트는 이 테스트에 걸리지 않는다.

`register`·`login` 의 IP 단위 요청 빈도 제한은 계정 잠금(5회 실패, 10분)과 별개의 이중 방어다. 한 IP 가 여러 계정을 도는 credential stuffing 은 요청 빈도 제한이 먼저 막는다. 여러 IP 에서 한 계정을 노리는 공격은 계정 잠금이 막는다.

## 외부 의존

| 의존 | 방향 | 쓰임 |
| --- | --- | --- |
| SMTP (`MailService`, `codebase/backend/src/modules/mail/mail.service.ts`, 전송기 `mail.transporter.ts`) | 내부에서 외부로 | 이메일 인증, 비밀번호 재설정, 초대 메일, 이메일 변경 확인(새 주소), 변경 통지(옛 주소). 알림 메일은 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) 이 같은 `MailService` 로 보낸다. 시스템 전역 SMTP 만 쓴다. `MAIL_TRANSPORT` 가 `console` 이 아니면(보통 `smtp`) `MailService` 가 보내는 모든 메일을 암호화한 연결로만 보낸다(`MAIL_SECURE` 가 `true` 가 아니면 STARTTLS 를 강제하고 `MAIL_REQUIRE_TLS=false` 로만 끈다). 워크스페이스 SMTP 통합(Send Email 노드)은 이 설정과 무관하고 [서비스별 인증 방식과 자격 증명](../CLE-INT/CLE-INT-AUTH.md) 의 `secure` 를 따른다 |
| OAuth 제공자 (Google, GitHub) | 외부에서 내부로(콜백) | authorize, token, userinfo(`auth-oauth.service.ts`). 셀프 호스팅용 LDAP·SAML 은 미구현(Planned)이다([가입과 로그인](CLE-ACCT-SIGNIN.md)) |
| 감사 로그 | 내부 참조 | 워크스페이스 컨텍스트가 있는 동작은 `audit_log`, 사용자 인증 이벤트는 `login_history`. 워크스페이스·멤버 액션(`workspace.transfer_ownership`, `workspace.created`, `workspace.updated`, `member.invited`, `member.role_changed`, `member.removed`)은 `workspaces.service.ts` 와 `workspace-invitations.service.ts` 가 남긴다. [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) |

## Rationale

### 보존 배치를 BullMQ 반복 작업으로 돌린다

예전 `@Cron` 인메모리 타이머는 replica 마다 따로 돌아 중복 실행됐다. 그래서 BullMQ Redis 중앙 스케줄로 옮겨 멀티 인스턴스에서도 전역 1회만 돌게 했다. 초대 정리 배치도 같은 패턴이다.

### 시스템 SMTP 는 STARTTLS 를 기본으로 강제한다

2026-10-04 결정이다(NERV Task `CLE-T-67BNAZ`). 아래 세 안 가운데 사람이 첫 안을 골랐다. 시스템 SMTP 로 나가는 메일에는 이메일 인증, 비밀번호 재설정, 초대 링크가 들어 있고 연결에는 SMTP 자격 증명이 실린다. 예전 전송기는 `MAIL_SECURE` 가 `true` 가 아닐 때(기본 포트 587) 서버가 STARTTLS 를 알릴 때만 암호화했다. 그래서 능동 중간자가 EHLO 응답에서 STARTTLS 를 지우면 링크와 자격 증명이 평문으로 나갔다. `@nestjs-modules/mailer` 를 쓰던 때도 같았다.

| 안 | 채택·기각 이유 |
| --- | --- |
| 기본 강제, 설정으로 끄기 | 채택. `MAIL_SECURE` 가 `true` 가 아니면 nodemailer `requireTLS` 를 켠다. STARTTLS 를 지원하지 않는 서버를 쓰는 운영자만 `MAIL_REQUIRE_TLS=false` 로 끈다. 값이 `false` 가 아니면(빈 값 포함) 강제한다 |
| 설정만 더하고 기본은 끄기 | 기각. 운영자가 켜지 않으면 보호가 없고 지금 배포의 기본 동작이 그대로 남는다 |
| 지금 동작 유지 | 기각. 위험을 문서로만 알리고 막지 않는다 |

이 결정은 [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 의 전송 구간 암호화 요구(TLS 1.2 이상)를 시스템 메일에 적용한 것이다. Node 의 기본 최소 TLS 버전이 1.2 라 STARTTLS 업그레이드도 그 하한을 지킨다. `MAIL_REQUIRE_TLS=false` 는 STARTTLS 를 지원하지 않는 서버를 쓰는 셀프 호스팅 운영자 몫의 예외다.

범위는 시스템 메일(`MailService`)뿐이다. 워크스페이스 SMTP 통합의 `secure`(`none`, `starttls`, `tls`)는 통합마다 사용자가 고르고 이 결정이 바꾸지 않는다.

`MAIL_REQUIRE_TLS=false` 는 정당한 용도가 있는 완화 플래그라 부팅을 거부하지 않는다. 운영(`NODE_ENV=production`)에서 SMTP 전송인데 강제를 끄고 부팅하면 경고만 남긴다. [세션과 토큰](CLE-ACCT-SESSION.md) 의 운영 환경 가드 기준(정당한 용도가 있으면 throw 가 아니라 warn)과 같다.

STARTTLS 를 지원하지 않는 SMTP 서버로 보내던 배포는 이 결정 뒤 발송이 실패하므로 `MAIL_REQUIRE_TLS=false` 를 명시해야 한다. 이 실패(nodemailer 코드 `ETLS`)는 일시적인 실패가 아니라 설정을 고칠 때까지 모든 발송에서 난다. 실패가 드러나는 방식은 메일마다 다르고 기존 발송 실패 규칙을 그대로 따른다.

- 가입 인증 메일과 이메일 변경 확인 메일은 요청이 에러로 끝난다. 가입은 미인증 사용자 행이 남아 인증 메일 재발송으로 복구한다. 이메일 변경은 [가입과 로그인](CLE-ACCT-SIGNIN.md) 이 정한 대로 대기 중 변경 정보를 지운다.
- 비밀번호 재설정, 초대, 이메일 변경 통지, 알림 메일은 사용자에게 드러나지 않고 서버 로그에만 남는다. 알림 메일은 `email_sent_at` 이 비어 있다.

배포 뒤에는 `Failed to send … email` 로그의 stack 에 `Error upgrading connection with STARTTLS` 가 있는지 본다. `ETLS` 는 에러 객체의 코드라 로그 문자열에는 나오지 않는다. `console` 전송(로컬, e2e)은 SMTP 를 쓰지 않아 영향이 없다.

### 요청 한도의 집계 기준을 코드에 맞췄다

2026-10-10 정리다(NERV Task `CLE-T-ERAJ7P`). 세션 종료 한도와 전역 한도를 «IP 당» 으로 적었던 것을 코드에 맞췄다. 코드의 `UserThrottlerGuard` 는 인증한 요청을 사용자(`user:<sub>`)로 세고 IP 는 인증 없는 `@Public` 라우트에만 쓴다. 세션 종료 두 라우트는 JWT 인증 라우트라서 사용자 기준이다. 전역 한도도 같은 가드를 지나므로 인증 요청은 사용자 기준이다. 이것으로 미결 «전역 요청 한도의 집계 기준» 을 닫았다.

코드를 예전 문서에 맞춰 모든 요청을 IP 로 세는 안은 기각했다. 사무실처럼 한 IP 를 여러 사용자가 함께 쓰면 서로의 한도를 깎는다. 한 사용자가 IP 를 바꿔 가며 한도를 피할 수도 있다. `register`·`login` 처럼 인증 전 라우트는 사용자를 알 수 없어 IP 로 센다.

### 전역 요청 빈도 제한이 HTTP 요청만 센다고 적었다 (2026-10-22)

NERV Task `CLE-T-A3W8B8` 에서 고쳤다. NestJS 12 부터 전역 가드가 WebSocket 게이트웨이 핸들러에도 붙는다. 고치기 전에는 소켓에 `user` · `ip` 가 없어서 전역 `UserThrottlerGuard` 가 모든 사용자의 WebSocket 명령을 한 버킷(`unknown`)으로 셌다. 이제 이 가드는 HTTP 요청이 아닌 호출(NestJS `ExecutionContext.getType()` 이 `'http'` 가 아닌 호출. 판정은 `isHttpContext`)을 건너뛴다. WebSocket 명령의 요청 빈도 제한은 소켓당 `WsRateLimitGuard` 하나가 맡는다. 그래서 요청 빈도 제한 표의 전역 행 범위를 HTTP API 로 적고 건너뛰는 조건은 [HTTP API 규약 「요청 빈도 제한」](../CLE-API/CLE-API-CONV.md#7-요청-빈도-제한) 으로 넘겼다.

2026-10-10 [「요청 한도의 집계 기준을 코드에 맞췄다」](#요청-한도의-집계-기준을-코드에-맞췄다) 의 집계 기준은 HTTP 요청에 그대로 유효하다. 기각한 대안은 [HTTP API 규약 「전역 요청 빈도 제한이 HTTP 요청만 센다고 적었다 (2026-10-22)」](../CLE-API/CLE-API-CONV.md#전역-요청-빈도-제한이-http-요청만-센다고-적었다-2026-10-22) 에 있다. 경위는 [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md#ack-이벤트-wire-와-http-전용-전역-enhancer-를-바로잡은-경위-2026-10-22) 의 Rationale 「ack 이벤트 wire 와 HTTP 전용 전역 enhancer 를 바로잡은 경위 (2026-10-22)」 에 있다.

### TOTP 켜기 쓰기를 조건부 UPDATE 로 바꾸고 설정 시작에 요청 한도를 걸었다 (2026-11-01)

NERV Task `CLE-T-94FTMV` 에서 바꿨다. 규칙과 근거, 기각한 안은 [가입과 로그인 「TOTP 켜기는 비밀번호를 다시 확인하고 켜진 계정을 거부한다」](CLE-ACCT-SIGNIN.md#totp-켜기는-비밀번호를-다시-확인하고-켜진-계정을-거부한다-2026-11-01) 에 있다. 이 문서에는 테이블 쓰기와 요청 한도만 적는다.

- 그 전에는 TOTP 가 켜진 계정에서도 설정 시작이 `two_factor_secret` 을 새 값으로 바꿨고 활성화 검증이 `totp_recovery_codes` 를 다시 발급했다. 이제 둘 다 켜진 계정을 409 `TOTP_ALREADY_ENABLED` 로 거부하고 컬럼을 쓰지 않는다.
- 켜짐 여부를 읽은 뒤 저장하기 전에 다른 요청이 TOTP 를 켤 수 있다. 조건 없이 쓰는 `UsersService.update` 로 쓰면 막 켜진 계정의 secret 과 복구 코드를 덮어쓴다. 그래서 두 쓰기를 조건부 UPDATE 로 바꾸고 `TotpService` 가 `User` 저장소로 직접 쓴다. 판정을 DB 단일 UPDATE 의 원자성에 맡기는 것은 [인증 흐름 「토큰 회전은 트랜잭션과 조건부 UPDATE 로 원자화한다」](CLE-ACCT-DATA-AUTH.md#토큰-회전은-트랜잭션과-조건부-update-로-원자화한다) 와 같다.
- 설정 시작의 조건은 `two_factor_enabled = false` 하나라서 영향 행이 0 이면 바로 409 다. 활성화 검증은 `two_factor_secret` 도 조건에 넣는다. 확인한 코드가 그 사이 다른 설정 시작이 바꾼 secret 과 맞지 않을 수 있기 때문이다. 영향 행이 0 이면 다시 읽어 켜져 있으면 409, 아니면 401 `TOTP_INVALID` 로 가른다.
- 끄기는 바꾸지 않았다. 비밀번호와 코드를 확인한 뒤 조건 없이 세 컬럼을 비운다. 2026-11-02 부터는 `two_factor_setup_started_at` 도 함께 비운다.
- 설정 시작은 계정 비밀번호를 bcrypt 로 대조하는 경로가 됐다. 그래서 TOTP 끄기와 같은 `SENSITIVE_ACTION_THROTTLE`(사용자당 분당 10회)을 걸었다. 활성화 검증 등 나머지 비밀번호 재확인 라우트의 한도는 2026-11-02 사람 결정으로 맞췄다(아래 「TOTP 대기 secret 에 10분 수명을 두고 2단계 인증 라우트의 요청 빈도 제한을 맞췄다 (2026-11-02)」).

### TOTP 대기 secret 에 10분 수명을 두고 2단계 인증 라우트의 요청 빈도 제한을 맞췄다 (2026-11-02)

NERV Task `CLE-T-FRCRF7` 의 사람 결정이다. 규칙과 근거, 기각한 안은 [가입과 로그인 「Passkey 등록에도 비밀번호 재확인을 두고 TOTP 대기 secret 은 10분 뒤 버린다 (2026-11-02)」](CLE-ACCT-SIGNIN.md#passkey-등록에도-비밀번호-재확인을-두고-totp-대기-secret-은-10분-뒤-버린다-2026-11-02) 에 있다. 이 문서에는 컬럼과 테이블 쓰기, 요청 빈도 제한만 적는다.

- 그 전에는 대기 secret 에 수명이 없었다. 수명을 재려고 `user.two_factor_setup_started_at`(timestamptz, NULL 허용)을 더했다. 설정 시작이 secret 과 같은 조건부 UPDATE 로 쓰므로 secret 과 시각이 따로 바뀌지 않는다. 켜기와 끄기는 시각을 비운다.
- 만료된 대기 secret 을 비우는 UPDATE 는 `two_factor_enabled = false` 이고 `two_factor_secret` 이 읽은 값 그대로일 때만 쓴다. 그 사이 다른 설정 시작이 쓴 새 secret 과 시각을 지우지 않기 위해서다. 판정을 DB 단일 UPDATE 에 맡기는 방식은 「TOTP 켜기 쓰기를 조건부 UPDATE 로 바꾸고 설정 시작에 요청 한도를 걸었다 (2026-11-01)」 와 같다.
- 마이그레이션은 기존 행을 바꾸지 않는다. 컬럼을 더하기 전에 설정 시작한 대기 secret 은 시각이 NULL 이라 활성화 검증이 만료로 보고 비운다. 사용자는 설정 시작부터 다시 하면 된다.
- 이 컬럼은 응답에 싣지 않는다. 비밀이 아니라서 [「응답에 싣지 않는 민감 컬럼 7개」](CLE-ACCT-DATA-MODEL.md#응답에-싣지-않는-민감-컬럼-7개) 에는 넣지 않았다.
- 활성화 검증, Passkey 등록 옵션, Passkey 복구 코드 재발급에 `SENSITIVE_ACTION_THROTTLE`(사용자당 분당 10회)을 걸었다. 세 라우트 모두 로그인한 사용자만 부르므로 사용자 기준으로 센다. 수치의 정본은 [HTTP API 규약 §7](../CLE-API/CLE-API-CONV.md#7-요청-빈도-제한) 이다.
