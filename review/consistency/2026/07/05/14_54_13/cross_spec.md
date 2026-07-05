# Cross-Spec 일관성 검토 — `spec/5-system/` (§1.5 초대 토큰 흐름 중심)

검토 모드: `--impl-prep` (구현 착수 전). 실제 변경 대상은
`codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` 를
auto-accept-on-mount → spec §1.5.3 (토큰 메타 조회 → 로그인 사용자 이메일 일치 시 [수락]
버튼 / 불일치 시 안내+로그아웃) 흐름으로 재작성하는 작업. spec 본문 변경 없음(코드가
기존 §1.5.3 을 따라잡는 케이스)이라는 전제 하에 다른 spec 영역과의 충돌 여부를 점검했다.

## 발견사항

- **[CRITICAL]** 초대 메일 링크가 §1.5.3 accept 페이지로 절대 도달하지 않음 — 이미 가입한 사용자도 register 페이지로만 유도됨
  - target 위치: `spec/5-system/1-auth.md` §1.5.3 (프론트엔드 "수락 페이지"가 이미 로그인된 사용자에게 [수락] 버튼을 노출한다고 서술) 및 §1.5.2 스텝 2 ("수신자가 메일의 링크 클릭 → 프론트엔드 **가입 페이지** `/auth/register?invitationToken={token}`")
  - 충돌 대상: `codebase/backend/src/modules/mail/mail.service.ts` (`sendWorkspaceInvitationEmail`, L118-122) — 초대 메일에 삽입하는 유일한 링크가 `${frontendUrl}/auth/register?invitationToken=...` 이며, 이 URL 은 항상 `/auth/register` (회원가입 페이지)로만 향한다. `codebase/frontend/src/app/(auth)/register/page.tsx` → `RegisterForm` 은 미가입자 가입 폼만 렌더링하며, 로그인 상태 감지·이메일 일치 확인·`/invitations/accept` 로의 분기 로직이 전혀 없다(grep 결과 `isAuthenticated`/`accessToken` 감지 코드 없음). `spec/5-system/1-auth.md` §1.5.3 이 전제하는 "수락 페이지"(`/invitations/accept`)로 가는 경로는 메일 어디에도 없다.
  - 상세: mail.service.ts 의 코드 주석은 "기가입자는 가입 페이지에서 로그인 상태/이메일 일치를 감지해 accept 흐름으로 분기" 라고 적혀 있으나, 실제 `RegisterForm`/`register/page.tsx` 는 그런 분기를 구현하지 않는다. 즉 **§1.5.3 흐름 전체(로그인된 기존 멤버가 다른 워크스페이스 초대를 받는 케이스)가 메일 클릭 경로로는 도달 불가능한 죽은 코드**다. `/invitations/accept?token=...` 페이지 자체는 존재하고 이번 draft 가 그 페이지를 §1.5.3 대로 재작성하지만, 실사용자는 이 URL 에 절대 도착하지 않으므로 재작성해도 실사용 시나리오를 해결하지 못한다. `/invitations/accept` 로 진입하는 유일한 경로는 사용자가 URL 을 수동 조작하는 경우뿐이다.
  - 제안: 다음 중 하나를 이번 작업 또는 후속 작업으로 결정해야 한다.
    1. **메일 링크 자체를 이원화**: 백엔드가 발송 시점에 수신자가 이미 가입돼 있는지 판별해 `/auth/register?invitationToken=...`(미가입) vs `/invitations/accept?token=...`(가입됨) 로 분기 발송. 단, 이메일 소유 여부는 초대 발송 시점과 클릭 시점 사이에 바뀔 수 있어(초대 발송 후 별도 계정으로 가입) 완전한 해법은 아님.
    2. **`/auth/register` 페이지 자체가 분기**: `invitationToken` prefetch 시 로그인 상태를 확인해 이미 로그인 && 이메일 일치면 `/invitations/accept?token=...` 로 client-side redirect. 메일 링크는 그대로 두되 register 페이지가 §1.5.3 진입점 역할을 겸함. spec §1.5.2/§2.6 문서에도 이 redirect 분기를 명시적으로 추가해야 한다(현재 §2.6 에는 "미가입자" 케이스만 기술).
    3. 최소한 이번 PR 범위에서는 `accept-invitation-content.tsx` 재작성과 **별개로** 이 gap 을 인지하는 follow-up 항목으로 plan 에 남긴다 — "코드가 §1.5.3 을 따라잡는다"는 이번 작업의 전제와 달리, §1.5.3 은 프론트 페이지 로직뿐 아니라 **거기 도달하는 경로**도 요구하므로, 경로 없이 페이지만 고치면 spec 의 실질 목표(이미 가입한 사용자의 원활한 합류)를 달성하지 못한 채 "spec 표현과 코드가 일치"하는 착시만 남긴다.

- **[WARNING]** `/invitations/accept` 진입 시 사용하는 query param 이름(`token`)과 §2.6/mail 서비스의 `invitationToken` 이름이 문서상 명시적으로 연결되지 않음
  - target 위치: `spec/5-system/1-auth.md` §1.5.3 스텝 1 ("메일 링크 클릭 → 프론트엔드가 토큰 메타 조회") — 이 페이지의 URL·query param 이름을 spec 이 규정하지 않는다.
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md` §2.6 은 register 페이지의 param 을 `invitationToken` 으로 명시. 반면 현재 `accept-invitation-content.tsx` 는 `searchParams.get("token")` 을 읽고, `workspacesApi.acceptInvitation` 의 API body 필드명도 `token` 이다.
  - 상세: API body 필드명(`token`)과 페이지 query param 이름이 우연히 일치하지만, spec 어디에도 "`/invitations/accept` 페이지는 `?token=` 쿼리를 받는다"는 명시가 없다. §1.5.3 재작성 시 이 이름을 그대로 유지한다면 문제 없으나, 결정이 spec 문서에 없다는 것 자체가 향후 재구현자·리뷰어가 임의로 param 이름을 바꿔 §1.5.3 스텝 1(메타 조회)이 깨질 위험을 남긴다.
  - 제안: 이번 draft 작업에서 `accept-invitation-content.tsx` 를 재작성할 때 §1.5.3 본문(또는 §1.5.1 표)에 "수락 페이지 URL: `/invitations/accept?token={token}`" 한 줄을 추가해 SoT 를 명확히 하는 것을 권장. 코드만 바꾸고 spec 에 반영하지 않으면 문서상 여전히 gap 으로 남는다(다만 "spec 본문 변경 없음" 전제와 상충하므로, 이 한 줄 추가가 "정정" 범주인지 "신규 결정" 범주인지는 project-planner 판단 필요).

- **[INFO]** `invitationsApi` 상단 주석이 register 흐름(§2.6)만 언급, §1.5.3 accept 페이지 사용처 누락
  - target 위치: 구현 예정 코드 `accept-invitation-content.tsx` 가 신규로 `invitationsApi.getByToken` 을 호출
  - 충돌 대상: `codebase/frontend/src/lib/api/invitations.ts` L13-19 doc 주석 — "회원가입 페이지가 `?invitationToken=...` 처리 시 ... prefill 하기 위해 사용한다" 고만 적혀 있어 accept 페이지에서의 재사용을 언급하지 않는다.
  - 상세: 기능 충돌은 아니며 `getByToken` 의 응답 shape(`InvitationMeta`)은 §1.5.2/§1.5.3 양쪽에 그대로 재사용 가능(동일 `GET /api/invitations/:token`). 다만 주석이 단일 소비처만 서술하고 있어 이번 구현으로 두 번째 소비처가 생기면 주석이 stale 해진다.
  - 제안: 구현 시 doc 주석에 accept 페이지 사용처를 추가.

## 요약

이번 draft 가 다루는 `spec/5-system/1-auth.md` §1.5.3 자체는 인접 영역(§4.1 감사, §3 RBAC, §2 세션, `spec/2-navigation/9-user-profile.md` §4.1/§4.1.1, `spec/2-navigation/10-auth-flow.md` §2.6)과 데이터 모델·API 계약·에러 코드·권한 수준에서 직접 모순되지 않는다 — `getByToken` 응답 shape, `POST /api/workspaces/invitations/accept` 요청/응답, `invitation_email_mismatch` 등 에러 코드 모두 문서 간 일치한다. 다만 구현 착수 전 검토에서 더 근본적인 문제를 발견했다: 초대 메일이 실제로 발송하는 링크(`mail.service.ts`)는 항상 `/auth/register?invitationToken=...` 이며 이 페이지에는 로그인 상태 감지·accept 리다이렉트 로직이 없으므로, §1.5.3 이 기술하는 "이미 가입한 사용자" 시나리오에 실사용자가 도달할 경로가 현재 없다. `accept-invitation-content.tsx` 를 §1.5.3 그대로 재작성하는 것 자체는 안전하지만, 그것만으로는 spec 이 의도하는 사용자 흐름을 실제로 완성하지 못한다 — "코드가 spec 을 따라잡는다"는 이번 작업 전제가 페이지 내부 로직에는 맞지만 페이지 도달 경로에는 적용되지 않는다는 점을 프로젝트가 인지해야 한다.

## 위험도

MEDIUM — CRITICAL 항목은 spec-문서 간 직접적 "모순"이라기보다 spec 의 의도(§1.5.3)와 실제 도달 경로(mail.service.ts + register 페이지) 사이의 간극이라 즉시 코드 작동 불가를 유발하지는 않는다(페이지 자체는 URL 을 알면 정상 작동). 그러나 사용자가 실제로 이 흐름에 도달하지 못한다는 점에서 방치 시 기능적으로 유명무실해지므로 별도 트래킹이 필요해 CRITICAL 로 표기했다. 전체 위험도는 MEDIUM 으로 판단 — 이번 draft(페이지 내부 로직 재작성) 자체를 막을 이유는 없으나, 병행하여 "메일 링크 → accept 페이지 도달 경로" 결정을 project-planner 에게 별도 안건으로 넘길 것을 권고한다.
