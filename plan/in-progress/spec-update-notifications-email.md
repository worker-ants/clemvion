---
worktree: (unstarted)
started: 2026-07-06
owner: planner
---

# spec-update — 알림 이메일 발송 구현 반영 (Planned → 구현됨) + 템플릿 downscope

> 출처: 알림 파이프라인 PR2 (`notif-email-dispatch-9b0364`) — `MailService.sendNotificationEmail()` + `NotificationsService` 이메일 발송(`channel∈{email,both}`) + `email_sent_at` 라이프사이클 구현. developer 는 spec read-only 라 아래 배지 flip + downscope 정정을 planner 위임 (SPEC-DRIFT reflux + impl-prep rationale_continuity WARNING).
> **착수 전 `/consistency-check --spec` 이 문서 통과 의무.** [[spec-update-notifications-ws-emit]] (PR1 배지)와 별개 트랙.

## 배경

PR2 가 구현한 것:
- `codebase/backend/src/modules/mail/mail.service.ts` — `sendNotificationEmail(email, {title,message,type})` **단일 범용 템플릿**(subject=title, 본문=message + `/dashboard` CTA(전용 알림 페이지 없음 — 인증 랜딩에서 벨 팝오버로 확인)). 실패 시 throw.
- `codebase/backend/src/modules/notifications/notifications.service.ts` — `notify()`/`createMany()` 저장 후 `dispatchEmails()`: `channel∈{email,both}` row 에 User email(`In(userIds)` 배치) 발송 → 성공 시 `email_sent_at=now` UPDATE. 완전 best-effort(warn only, 재시도 없음, 실패 시 `email_sent_at` NULL 유지).

## flip / 정정 대상 (planner 편집) — `spec/data-flow/8-notifications.md`

- [ ] Overview 주의문(≈L17): "알림 이메일 발송 경로는 미구현 (Planned) … `email_sent_at` setter 도 코드에 없다" → 구현됨(`sendNotificationEmail` + `email_sent_at` 라이프사이클).
- [ ] 코드 진입점(≈L24): `MailService … 알림 이메일은 미구현 (Planned)` → 구현됨(`sendNotificationEmail`, 단일 범용 템플릿).
- [ ] §1 다이어그램 Note(≈L48-52): email send / `email_sent_at` UPDATE "미구현 (Planned)" → 구현됨. `send (template by type)` → `send (단일 범용 템플릿)`.
- [ ] §1 단계표(≈L60): "이메일 발송 + `email_sent_at` UPDATE | 미구현 (Planned)" → 구현됨(best-effort).
- [ ] §2.2 SMTP row(≈L100): "미구현 (Planned) — `MailService` 에 알림 type 템플릿·`email_sent_at` setter 없다" → 구현됨. **"type 별 이메일 템플릿" → "단일 범용 템플릿(subject=title, body=message + CTA)"** (downscope).
- [ ] §3(≈L115-117): `email_sent_at` "미구현 (Planned)" → 구현됨. **+ "발송 실패 시 `email_sent_at` 은 NULL 로 남는다" 한 문장 보강**(impl-prep INFO).
- [ ] Rationale "Email 실패는 warn 만, 재시도 없음"(≈L217-219): "발송 경로 자체가 현재 미구현 (Planned)" 단서 제거(구현됨).
- [ ] Rationale **신규 항목** "단일 범용 이메일 템플릿 채택": type별 시각 템플릿 대신 단일 템플릿 — type별 내용은 호출자가 설정한 title/message 에 이미 인코딩되어 있어 시각 분기 이득이 낮음. 향후 특정 type 이 전용 레이아웃을 요구하면 그때 분기.

## 유지 (Planned — PR3)
- 발사 소스 3종 `execution_failed`/`schedule_failed`/`team_invite` (§1.1) — 여전히 미발사.

## 완료 조건
- 위 정정 + `/consistency-check --spec` BLOCK:NO. tracker `spec-sync-data-flow-8-notifications-gaps.md` 의 이메일/email_sent_at 체크박스는 PR2 코드 PR 에서 `[x]`.
