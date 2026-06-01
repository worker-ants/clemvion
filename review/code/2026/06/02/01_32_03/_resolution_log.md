# Resolution Log — channel-web-chat-followups ai-review

2026-06-02T00:00:00Z item=SUMMARY#W6 type=code action=fix file=public-webhook-throttle.guard.ts measureBodyBytes returns maxBodyBytes+1 on serialize fail
2026-06-02T00:00:00Z item=SUMMARY#W7 type=code action=fix file=public-webhook-quota.service.ts INCR+EXPIRE via pipeline (atomic, single RTT)
2026-06-02T00:00:00Z item=SUMMARY#W15 type=code action=fix file=public-webhook-quota.service.ts pipeline combines INCR+EXPIRE, reduces 4 RTT → 2 RTT
2026-06-02T00:00:00Z item=SUMMARY#W4 type=code action=documented file=public-webhook-quota.service.ts JSDoc explains @Optional() DI pattern (mirrors ChannelConversationService)
2026-06-02T00:00:00Z item=SUMMARY#W9 type=code action=resolved-as-consistent GlobalExceptionFilter already unwraps { error: { code, message } } nested shape; guard format is consistent
2026-06-02T00:00:00Z item=SUMMARY#W10 type=code action=fix file=hooks.controller.ts @ApiTooManyRequestsResponse + @ApiPayloadTooLargeResponse schema+example added
2026-06-02T00:00:00Z item=SUMMARY#W11 type=test action=add file=public-webhook-throttle.guard.spec.ts null/string/serialize-fail/object branches + W6 circular ref test
2026-06-02T00:00:00Z item=SUMMARY#W13 type=code action=doc file=.env.example publicWebhook.* config section added
2026-06-02T00:00:00Z item=SUMMARY#W14 type=code action=fix file=public-webhook-throttle.guard.ts attach trigger to req.__publicWebhookTrigger; export PublicWebhookReqExtension type
2026-06-02T00:00:00Z item=SUMMARY#W1 type=documented file=public-webhook-throttle.guard.ts accepted-risk: XFF trust is infra/trust-proxy responsibility; rate-limit is best-effort
2026-06-02T00:00:00Z item=SUMMARY#W3 type=documented file=public-webhook-throttle.guard.ts accepted-risk: fail-open IP bypass per spec graceful degradation intent
2026-06-02T00:00:00Z item=SUMMARY#W2 type=spec action=draft file=plan/in-progress/spec-fix-public-webhook-security.md fixed-window bursting note
2026-06-02T00:00:00Z item=SUMMARY#W5 type=spec action=draft file=plan/in-progress/spec-fix-public-webhook-security.md concurrent cap deferred note
2026-06-02T00:00:00Z item=Info#10 type=code action=fix file=public-webhook-quota.service.ts export makeMinKey/makeHourKey constants; spec updated in tests
2026-06-02T00:00:00Z item=Info#11 type=test action=add file=public-webhook-quota.service.spec.ts hourlyNewMax config override test
2026-06-02T00:00:00Z item=Info#12 type=test action=add file=public-webhook-quota.service.spec.ts onModuleDestroy quit normal + exception cases
2026-06-02T00:00:00Z item=Info#13 type=test action=add file=public-webhook-throttle.guard.spec.ts XFF multi-IP, empty cf-connecting-ip, empty XFF edge cases
2026-06-02T00:00:00Z item=Info#14 type=test action=add file=public-webhook-throttle.guard.spec.ts maxBodyBytes config override: over+under limit cases
2026-06-02T00:00:00Z item=Info#15 type=test action=add file=bridge.spec.ts applyResize state-missing → dataset.wcState unchanged
2026-06-02T00:00:00Z item=Info#16 type=test action=add file=loader.spec.ts installGlobal boot-throw → replay continues
2026-06-02T00:00:00Z item=Info#17 type=test action=add file=loader.spec.ts off-before-boot → no throw
2026-06-02T00:00:00Z item=Info#18 type=doc action=fix file=README.md off()/unsubscribe example added
2026-06-02T00:00:00Z item=Info#19 type=doc action=fix file=bridge.ts applyResize JSDoc explains iframe cross-origin resize reason
2026-06-02T00:00:00Z item=Info#20 type=doc action=fix file=types.ts Unsubscribe re-export note added
2026-06-02T00:00:00Z item=Info#21 type=doc action=fix file=loader-entry.ts document.currentScript IIFE timing note
2026-06-02T00:00:00Z item=Info#25 type=code action=fix file=public-webhook-quota.service.ts MINUTE_WINDOW_SEC/HOUR_WINDOW_SEC named constants exported
2026-06-02T00:00:00Z item=Info#8 type=spec action=draft file=plan/in-progress/spec-fix-public-webhook-security.md off() spec §1 note
2026-06-02T00:00:00Z item=Info#9 type=spec action=draft file=plan/in-progress/spec-fix-public-webhook-security.md message 4KB layer note
2026-06-02T00:00:00Z backend tests: 60 passed (was 37+existing)
2026-06-02T00:00:00Z web-chat-sdk tests: 40 passed lint+typecheck+build clean
