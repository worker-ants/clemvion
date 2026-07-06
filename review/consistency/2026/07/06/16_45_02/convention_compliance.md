# 정식 규약 준수 검토 — spec/data-flow/8-notifications.md (impl-done, PR2 이메일 발송)

## 검토 범위 확인

본 PR(diff origin/main...HEAD)은 `codebase/backend/src/modules/mail/mail.service.ts`,
`mail.service.spec.ts`, `notifications/notifications.service.ts`,
`notifications.service.spec.ts`, `notifications.module.ts` 만 변경한다. **컨트롤러·DTO·API
엔드포인트 변경은 없다** — 순수 서비스 계층(내부 이메일 발송 + `email_sent_at` 라이프사이클)
추가다. 따라서 `spec/conventions/swagger.md`(API 문서 규약), 응답 envelope 관련 조항은 이번
diff 표면에 직접 적용되지 않는다(신규 endpoint·DTO 없음).

## 발견사항

- **[INFO]** spec 본문의 "미구현 (Planned)" 배지가 구현 완료 코드와 어긋나 있으나 정식 위임 경로로 이미 추적됨
  - target 위치: `spec/data-flow/8-notifications.md` Overview 주의문(L14-18), §1 다이어그램·표(L31-60), §2.2(L100), §3(L115-117), Rationale "Email 실패는 warn 만"(L217-219)
  - 위반 규약: 직접적인 conventions 위반은 아님. CLAUDE.md "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 절차의 적용 대상
  - 상세: 이번 diff(`MailService.sendNotificationEmail` + `NotificationsService.dispatchEmails`/`sendOneEmail`)가 spec 이 "미구현 (Planned)"이라 서술하는 이메일 발송 경로·`email_sent_at` 라이프사이클을 실제로 구현했다. spec 문서 자체는 이번 diff 에서 변경되지 않아 코드-스펙 간 순간적 drift 가 존재한다.
  - 제안: 이미 `plan/in-progress/spec-update-notifications-email.md` (owner: planner, worktree: unstarted)로 정확한 flip 대상 라인·downscope 근거까지 위임돼 있고, `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` 트래커도 이번 커밋에서 해당 체크박스를 `[x]`로 갱신했다 — CLAUDE.md 가 요구하는 "developer 는 멈추고 planner 위임" 절차를 정확히 따른 것이므로 규약 위반이 아니라 **정상적인 임시 drift**다. 추가 조치 불요, planner 착수 시 위 plan 대로 flip 하면 종결.

- **[INFO]** 단일 범용 이메일 템플릿 채택은 spec의 "type 별 템플릿" 서술과 downscope 관계
  - target 위치: `spec/data-flow/8-notifications.md` §2.2(L100) "type 별 이메일 템플릿"
  - 위반 규약: 해당 없음(설계 결정 문서화 이슈)
  - 상세: 코드는 `sendNotificationEmail(email, {title, message, type})` 단일 범용 템플릿(subject=title, body=message+CTA)만 구현했고, spec 은 여전히 "type 별 이메일 템플릿"이라 쓰여 있다. 새 코드 JSDoc 은 이 downscope 를 명확히 알린다(`mail.service.ts` L128-131: "단일 범용 템플릿 — type 별 시각 템플릿은 downscope … spec 정정은 spec-update-notifications-email plan/planner").
  - 제안: 위와 동일하게 `spec-update-notifications-email.md` 플랜의 "downscope" 항목이 이미 이 정정을 포함하므로 별도 조치 불요.

## 요약

이번 diff 는 컨트롤러·DTO·API 응답 형식을 전혀 건드리지 않는 내부 서비스 계층 추가(`MailService.sendNotificationEmail` + `NotificationsService` 이메일 dispatch/`email_sent_at` 라이프사이클)이며, 신규 코드는 기존 `mail.service.ts` 의 명명·구조 패턴(`frontendUrl`/`MAIL_TRANSPORT_CONSOLE`/`escapeHtml`/`buildXHtml`+`buildXText` 쌍)과 `notification.entity.ts` 의 컬럼 명명(camelCase TS ↔ snake_case DB, `emailSentAt`/`email_sent_at`)을 정확히 따른다. 새 에러 코드·API endpoint·DTO 도 도입하지 않아 `swagger.md`·`error-codes.md` 위반 소지가 없다. target spec 문서(`8-notifications.md`) 자체는 이번 커밋에서 갱신되지 않아 "미구현 (Planned)" 서술과 실제 구현 사이에 순간적 drift 가 남아 있으나, 이는 CLAUDE.md 가 규정한 "구현 중 spec 변경 필요 시 developer 정지 → project-planner 위임" 절차를 정확히 밟은 결과다(`plan/in-progress/spec-update-notifications-email.md` 신규 생성 + `spec-sync-data-flow-8-notifications-gaps.md` 트래커 체크박스 동기 갱신). 정식 규약 관점에서 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
