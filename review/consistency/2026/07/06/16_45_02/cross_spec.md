### 발견사항

- **[INFO]** `spec/data-flow/2-auth.md` §5 외부 의존 SMTP 항목이 알림 이메일을 아직 나열하지 않음
  - target 위치: `spec/data-flow/8-notifications.md` §2.2 (SMTP sink), §5 (외부 의존)
  - 충돌 대상: `spec/data-flow/2-auth.md` §5 외부 의존 표 — `SMTP (MailService) | 이메일 인증·비밀번호 reset·초대 메일·이메일 변경 확인(신규 주소)·변경 통지(옛 주소)` (5종만 열거, 알림 이메일 없음)
  - 상세: `MailService`는 여러 데이터 흐름 영역(auth, workspace, notifications)에서 공유되는 단일 서비스다. 이번 PR로 `sendNotificationEmail` 이라는 6번째 발송 종류가 추가됐으나, `2-auth.md` 의 열거형 목록은 auth 도메인 자체 발송 항목만 나열하는 문서라 직접 모순은 아니다. 다만 `MailService` 전체 발송 목록을 한눈에 보려는 독자에게는 이 표가 불완전해 보일 수 있다.
  - 제안: CRITICAL/WARNING 아님 — auth 문서는 auth 도메인 관점의 목록이라 그대로 두어도 무방. 필요 시 `MailService` 전체 발송 카탈로그를 한 곳(예: `mail.service.ts` 파일 docblock 또는 `0-overview.md`)에 모으는 것을 향후 고려.

- **[INFO]** target 문서 자체가 아직 "미구현 (Planned)" 배지를 유지 중이나 코드는 이미 구현됨 — 이미 별도 plan 으로 추적됨
  - target 위치: `spec/data-flow/8-notifications.md` Overview 주의문(L14-18), §1 다이어그램/단계표(L48-60), §2.2(L100), §3(L115-117), Rationale "Email 실패는 warn 만"(L217-224)
  - 충돌 대상: 없음 (cross-spec 충돌 아님, spec-code 정합성 이슈)
  - 상세: 이번 diff(`0ebcb92fd`, `04190538a`)는 이메일 발송 경로 + `email_sent_at` 라이프사이클을 실제로 구현했지만 `spec/data-flow/8-notifications.md` 본문은 여전히 "미구현 (Planned)" 로 서술한다. 다만 이는 cross-spec 영역 간 충돌이 아니라 target 자체의 self-consistency(spec-vs-code) 이슈이며, 이미 `plan/in-progress/spec-update-notifications-email.md` 로 planner 위임이 명시적으로 기록되어 있고 프로젝트 규약("구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임")을 정확히 따른 정상 흐름이다.
  - 제안: 없음(추가 조치 불필요) — planner 세션에서 해당 plan 체크리스트대로 flip 하면 해소됨. cross-spec 검토 관점에서는 차단 사유 아님.

- **[INFO]** CTA 링크 `/dashboard` 목적지와 네비게이션 spec 의 벨 팝오버 위치 정합성 확인
  - target 위치: `mail.service.ts` `sendNotificationEmail` — CTA `${frontendUrl}/dashboard`
  - 충돌 대상: `spec/2-navigation/_layout.md` L112 "알림 벨 아이콘 (... 사용자 영역 옆 또는 사이드바 하단)"
  - 상세: 벨 팝오버는 사이드바 공통 레이아웃 요소로 전 페이지에서 접근 가능하고, `/dashboard` 는 실재하는 인증 랜딩 라우트(`codebase/frontend/src/app/(main)`)다. CTA 를 `/dashboard` 로 보내는 설계는 "전용 알림 페이지 없음" 전제와 일치하며 모순 없음. 정보성으로만 기록.
  - 제안: 없음.

### 요약

이번 PR(`notif-email-dispatch-9b0364`)은 `MailService.sendNotificationEmail` 신설과 `NotificationsService.dispatchEmails`(`channel∈{email,both}` 발송 + `email_sent_at` UPDATE, best-effort)를 구현했다. 데이터 모델(`Notification.email_sent_at`, `channel` enum)은 `spec/1-data-model.md` §2.19 에 이미 정의돼 있어 필드 신규 도입 충돌은 없고, `NotificationsModule` 의 `MailModule`/`User` 직접 import 는 기존 순환-의존성 회피 아키텍처 결정(WebsocketModule 은 ModuleRef 지연 해석)과 상충하지 않으며 코드 내 주석으로 그 이유(“MailModule 은 순환 무관”)를 명시해 계층 책임 분할도 일관적이다. 호출자 계약(`createMany`/`notify` 시그니처, §11.2 알림 생성 소스들)은 변경되지 않아 다른 영역(통합·알림 규칙 등)과의 API 계약 충돌도 없다. 유일하게 눈에 띄는 점은 target spec 문서 자체가 아직 "미구현 (Planned)" 배지를 구현 반영 이전 상태로 유지하고 있다는 것인데, 이는 cross-spec 충돌이 아니라 spec-vs-code self-consistency 이슈이며 이미 `plan/in-progress/spec-update-notifications-email.md` 로 planner 위임이 정확히 기록돼 있어 프로젝트 규약을 준수한 정상 진행 상태다. 다른 영역 spec(auth, workspace, integration, navigation)과의 직접적 데이터 모델·API·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다.

### 위험도
NONE
