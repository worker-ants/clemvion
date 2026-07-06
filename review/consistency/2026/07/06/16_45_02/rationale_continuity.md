### 발견사항

- **[INFO]** 단일 범용 이메일 템플릿 채택은 Rationale 미기재 상태로 구현되었으나 이미 후속 plan 으로 위임됨
  - target 위치: `codebase/backend/src/modules/mail/mail.service.ts` `sendNotificationEmail`/`buildNotificationHtml` (신규), `notifications.service.ts` `dispatchEmails`/`sendOneEmail`
  - 과거 결정 출처: `spec/data-flow/8-notifications.md` §1 다이어그램(L51) `send (template by type)`, §1 단계표(L60), §2.2 SMTP row(L100) `type 별 이메일 템플릿(실패 알림, 만료 알림 등)`
  - 상세: spec 본문(§1, §2.2)의 "to-be 설계"는 `channel IN ('email','both')` 발송 시 **type 별 템플릿**을 전제로 서술돼 있다. 그러나 이번 구현은 subject=title, body=message+CTA 하나로 통일한 **단일 범용 템플릿**을 채택했다 — type 별 시각 분기를 downscope. 이 서술은 `## Rationale` 절에 있는 "채택 vs 기각 대안" 형식의 확정 결정이 아니라 미구현 상태의 예비 설계 placeholder였다는 점에서, `spec/2-navigation/1-workflow-list.md §4`의 태그 필터 하향("최초 확정이지 결정의 번복이 아니다") 선례와 유사한 성격이다. 다만 spec 본문 문구 자체는 아직 "type 별 템플릿"으로 남아 있어, 이 상태로 두면 문서상 미정합이 지속된다.
  - 제안: 이미 `plan/in-progress/spec-update-notifications-email.md` 가 이 downscope를 `## Rationale` 신규 항목("단일 범용 이메일 템플릿 채택")으로 명시 기록하도록 planner에게 위임돼 있다(항목 27번). 해당 plan이 실행되어 spec §1/§2.2 문구와 Rationale이 갱신되기 전까지는 spec-code 간 서술 불일치가 남아 있음을 인지할 것 — 코드 자체는 문제 없으나 spec 갱신이 완료돼야 Rationale 연속성이 닫힌다.

- **[INFO]** "Email 실패는 warn 만, 재시도 없음" Rationale 의 Planned 단서 제거 필요
  - target 위치: `notifications.service.ts` `dispatchEmails`/`sendOneEmail` (per-row `Promise.allSettled` + catch 후 `logger.warn`, 재시도 없음)
  - 과거 결정 출처: `spec/data-flow/8-notifications.md` `## Rationale` "Email 실패는 warn 만, 재시도 없음 (Planned)" (L217-223)
  - 상세: 구현은 이 Rationale의 의도를 정확히 따른다 — `MailService.sendNotificationEmail`은 throw 계약을 유지하고(단위 책임 명확), 호출자인 `NotificationsService.sendOneEmail`이 catch하여 warn만 남기고 `email_sent_at`을 NULL로 유지한다(재시도 없음, per-row 격리로 배치 중 일부 실패가 나머지에 전파되지 않음 — 코드 주석이 "spec §3 Rationale"을 직접 인용). 원칙 위반은 없다. 다만 Rationale 헤더의 "(Planned)" 표기와 본문의 "발송 경로 자체가 현재 미구현" 단서가 이제는 stale하다.
  - 제안: 위와 동일한 `spec-update-notifications-email.md` plan 항목(L26)이 이 Planned 단서 제거를 이미 커버하고 있음 — 별도 조치 불요, 해당 plan 실행 확인만 하면 됨.

### 요약
검토 대상 diff(`MailService.sendNotificationEmail` + `NotificationsService.dispatchEmails`)는 `spec/data-flow/8-notifications.md`의 `## Rationale` 항목들 — 특히 "Email 실패는 warn 만, 재시도 없음"(에러 처리 경계: MailService throw / caller catch-warn) 과 "채널 계산은 호출자 책임" 경계 — 를 정확히 따른다. 유일하게 문서 정합이 아직 안 닫힌 지점은 spec 본문(Rationale 절이 아닌 §1/§2.2 "to-be 설계" 서술)이 전제했던 "type 별 이메일 템플릿"을 이번 구현이 "단일 범용 템플릿"으로 downscope한 것인데, 이는 기각된 Rationale 대안의 재도입이나 원칙 위반이 아니라 미확정 placeholder의 최초 확정에 가깝다(선례: workflow-list 태그 필터 하향). 개발자가 이미 이를 인지해 `plan/in-progress/spec-update-notifications-email.md`에 Rationale 신규 항목 작성 + 관련 문구 갱신을 planner에게 명시 위임해 두었으므로, 프로세스 상 문제는 없고 해당 plan의 실행 완료 여부만 추적하면 된다.

### 위험도
LOW
