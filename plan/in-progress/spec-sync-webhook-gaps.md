---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# webhook — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/12-webhook.md

## 미구현 항목
- [ ] **비활성 chatChannel 트리거의 202+{ignored:true} 분기 (WH-EP-07 / §3.1 / §7 step 5)** — `HooksService.handleWebhook` 의 `isActive=false → 410 GoneException` 체크가 `config.chatChannel` 분기보다 앞서 실행되어, chatChannel 트리거도 비활성 시 410 Gone 을 반환한다. Spec 및 [Spec Chat Channel §5.5 / R-CC-12](../../spec/5-system/15-chat-channel.md) 의 목표 동작(202+{ignored:true}, silent skip — non-2xx 시 provider webhook 자동 비활성화·retry 폭주 회피)이 미구현. handleWebhook 의 chatChannel 분기를 isActive 체크보다 앞으로 이동(인증은 그대로 수행, parseUpdate 전에 isActive 미통과 인지 후 silent skip) + chat-channel e2e 의 비활성 트리거 202 케이스 추가.
- [ ] **1MB 본문 크기 통일 임계 (WH-NF-02 / §8)** — spec 은 "요청 본문 최대 1MB 초과 시 413" 을 약속하나, 현행 구현은 공개 webhook(`auth_config_id IS NULL`)에만 `PublicWebhookThrottleGuard` 의 32KB(`DEFAULT_MAX_BODY_BYTES`) 게이트가 있고 인증 webhook 에는 전역 body-parser limit 이 설정돼 있지 않다(express 기본값 적용). 1MB 통일 임계를 도입하려면 main.ts 전역 body-parser limit 설정 또는 spec 을 32KB 현행에 맞춰 재정의할지 결정 필요.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__12-webhook.md 참조.
- 항목 1 은 기존 `plan/in-progress/auth-config-webhook-followups.md §2` 에서도 동일 갭이 식별됨 (chat-channel 도메인 재검토 항목). 구현 시 통합 처리 가능.
