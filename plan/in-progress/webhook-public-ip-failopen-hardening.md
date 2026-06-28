---
worktree: (unstarted)
started: 2026-06-28
owner: developer
---

# 공개 webhook IP 미식별 fail-open 강화

## 배경

`PublicWebhookThrottleGuard` 는 클라이언트 IP 로 미인증 공개 webhook 에 rate-limit 을 건다.
IP 를 식별하지 못하면(`if (!ip) return true`) 통과시킨다([guard:108](../../codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts)).
→ 공격자가 `X-Forwarded-For`(및 신뢰 시 `CF-Connecting-IP`) 헤더를 **제거**하면 IP 가 null 이 되어
rate-limit 을 우회할 수 있다.

PR #763 fresh 리뷰(review/code/2026/06/28/17_16_16) INFO #15 / 권장 7 에서 중장기 항목으로 분리됨.
설계 의도(Guard 책임은 rate-limit 한정, 후행 글로벌 throttler 100 req/min 이 1차 방어)는 명확하나,
공개 진입점 brute-force 표면이므로 IP 미식별 케이스를 좁히는 강화가 바람직.

## 결정 필요 (사용자/보안)

1. **인프라 레벨 vs 앱 레벨**: 신뢰 프록시(Cloudflare·LB)가 XFF 를 항상 채우도록 강제하고
   XFF 없는 외부 요청을 인프라(WAF/Ingress)에서 차단할지, 앱에서 처리할지.
2. **앱 폴백**: `req.socket.remoteAddress` 를 IP 폴백으로 쓸지. (trust-proxy 설정과의 상호작용 —
   직결 IP 가 프록시 IP 가 되어 전체 트래픽이 한 버킷에 묶일 위험 검토.)
3. **fail-closed 전환 여부**: IP 미식별 시 통과 대신 보수적으로 별도(완화) 한도 적용 또는 거부.
   (가용성 영향 — 정상 트래픽 오탐 위험 평가.)

## 후속

- 결정 확정 후 spec(`12-webhook.md` §6·WH-SC-05·Rationale) 반영 → 구현.
- 글로벌 throttler·Guard 책임 경계 재확인(중복/공백 없게).
- **`1-auth.md §2.3` "클라이언트 IP" 행이 현재 webhook/rate-limit/ip_whitelist 경로를 "헤더 전용·`req.ip`/socket 폴백 없음" 으로 기술**한다(`extractClientIpFromHeaders`). 결정 2(`req.socket.remoteAddress` 폴백)·3(fail-closed) 채택 시 **해당 §2.3 행도 함께 갱신** 필요.
- **(추적) `webhook-spec-pointer-cleanup` 단위 1(P-3) 로 `1-auth Rationale 2.3.B m-3` 에 함수명 `extractClientIpFromHeaders` 가 명시되고 `12-webhook §7e·§8b` 에 역참조가 추가됐다**. 본 단위 2 의 §2.3 행 갱신은 그 위에서 진행하며, m-3 의 "헤더 기반·폴백 없음 = 의도된 결정" 서술과 결정 2/3 가 충돌하면 Rationale 2.3.B m-3 도 함께 개정해야 한다(merge-time 충돌 위험은 낮음 — 같은 행 덮어쓰기 아님).
