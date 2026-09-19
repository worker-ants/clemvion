---
title: 통합 노드 SSRF 가드 하나로 — SMTP 가 CGNAT 를 통과시키고, HTTP · DB 가 IPv4-mapped IPv6 로 루프백 · 메타데이터에 닿았다
status: in-progress
owner: developer
worktree: smtp-ssrf-cgnat-8d41b2
started: 2026-09-19
spec_impact: none
---

# 통합 노드 SSRF 가드 하나로

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목(«SMTP SSRF 가드에 CGNAT 대역이 없는데 §5.5 는 막는다고 적는다» ·
«SMTP 가드 주석이 없는 환경변수를 가리킨다» — 같은 턴에 하라고 적혀 있다)을 닫는다. 조사하다 더 큰 구멍이 나왔다.

## 실측 (2026-09-19, `origin/main` `105d4ac56`)

가드가 둘이다 — `nodes/integration/http-request/http-safety.ts`(HTTP Request 노드 · 리다이렉트 · DB Query 노드 · DB · HTTP 연결 테스트)와
`common/utils/ssrf.util.ts`(SMTP · LLM 프로바이더 · S3 설정). 같은 입력을 나란히 돌렸다(scratch 프로브, 코드 변경 없음):

| 입력 | `http-safety` | `ssrf.util` |
|---|---|---|
| `100.64.0.1` · `100.127.255.255` (CGNAT) | 막음 | **통과** |
| `[::ffff:127.0.0.1]` → Node 가 `[::ffff:7f00:1]` 로 정규화 | **통과** | 막음 |
| `[::ffff:10.0.0.1]` · `[::ffff:169.254.169.254]` (메타데이터) | **통과** | 막음 |
| `[::]` | 막음 | **통과** |
| `0.0.0.0` · `2130706433`(→ `127.0.0.1`) | 막음 | 막음 |

**통과한 mapped 주소는 실제로 닿는다** — `127.0.0.1` 에만 바인드한 서버에 `fetch('http://[::ffff:127.0.0.1]:port/')` 가 200(macOS ·
`node:24-alpine` 둘 다). 그래서 `http-safety` 의 빈칸은 HTTP Request 노드(`none` · `custom` · `integration` 인증 모두)와 DB 노드의 **SSRF
우회**다 — 루프백 · 사설망 · 클라우드 메타데이터. DB host 필드는 괄호 없이 `::ffff:127.0.0.1` 을 받고, `dns.lookup` 이 그대로 돌려줘 해석 뒤
검사도 통과한다.

IPv4 를 품는 다른 IPv6 표기는 두 OS 모두 닿지 않았다 — IPv4-compatible `[::127.0.0.1]` · SIIT `[::ffff:0:127.0.0.1]` · NAT64
`[64:ff9b::127.0.0.1]` · 6to4 `[2002:7f00:1::]` 는 `EHOSTUNREACH`/`ENETUNREACH`. `[::]` 는 `ECONNREFUSED`(IPv6 루프백으로 간다 —
`http-safety` 는 이미 막는다).

spec 은 셋이 **같은 메커니즘**이라 적는다 — `spec/2-navigation/4-integration.md` §5.5(SMTP) · `spec/4-nodes/4-integration/3-send-email.md` §4
7번 · `2-database-query.md` §4 · `1-http-request.md` §4 8번(loopback / RFC1918 / link-local / CGNAT / IPv6 link-local · ULA). 사실은 둘이고 각자
한쪽이 비었다. `nodes/core/error-codes.ts` 주석도 «`http-safety.ts` 가 HTTP/DB/Email 공용 SoT» 라 적는다.

## 할 것 (코드를 spec 에 맞춘다 — spec 변경 없음)

1. **`http-safety` 가 IPv4-mapped IPv6 를 IPv4 로 되돌려 같은 표로 판정** — 정규화된 hex 형(`::ffff:7f00:1`)과 점 형(`::ffff:127.0.0.1`,
   괄호 없는 DB host · `dns.lookup` 결과) 둘 다. spec 이 막는다고 적은 대역을 표기만 바꿔 통과하던 것을 막는 것이라 계약은 그대로다.
2. **SMTP 가드를 `http-safety` 로** — `smtp-host-guard.ts` 가 `ssrf.util` 대신 `http-safety` 의 판정(리터럴 + DNS 해석 뒤 재검사)을 쓴다.
   CGNAT · `[::]` 가 막힌다. DNS 실패는 지금처럼 통과(fail-open — 두 구현이 같다). `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 도 같다.
3. **주석 정정** — `integrations.service.ts`(`testEmailTransport`) · `send-email.handler.ts` 의 «`SMTP_BLOCK_PRIVATE_HOSTS` opt-in» → 실제
   `ALLOW_PRIVATE_HOST_TARGETS=true` 가 아니면 막는 opt-out. `error-codes.ts` 주석은 이 변경으로 참이 된다(확인만).
4. 테스트 — `http-safety.spec` mapped 두 형 × 대역 · 공인 mapped 는 통과(대조군) / `smtp-host-guard.spec` CGNAT · `[::]` · mapped · opt-out /
   뮤턴트로 판별력 확인.

## 비대상

- **`ssrf.util`(LLM 프로바이더 · S3)** — `spec/5-system/7-llm-client.md` 의 SSRF 목록은 `ssrf.util` 을 그대로 적는다(IPv4-mapped 있음 ·
  CGNAT 없음). CGNAT 를 더하면 Tailscale(100.64/10) 너머의 비-`local` 프로바이더가 막힐 수 있고 LLM 쪽엔 opt-out 플래그가 없다 — 제품
  판단이라 트래커에 올린다(`[::]` 누락 포함). 두 분류기를 하나로 합치는 것도 그 결정 뒤다.
- NAT64 · 6to4 등 — 이 환경에서 닿지 않았다(위 실측). NAT64 게이트웨이가 있는 망에서만 의미가 있다.
- DNS rebinding 2차(연결 시점 재해석) — 기존 한계 그대로(spec 에 적혀 있다).

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/19/21_02_09`(scope `spec/4-nodes/4-integration/` + 보정 블록) BLOCK: NO. WARNING 5 중
  넷은 이 변경과 무관한 기존 spec drift(execution-engine §10.1 `logUsage` 시그니처 · chat-channel-adapter §3.1 분류표 · node-output
  Principle 2 `meta.rowCount` · Principle 5 `send_email` 포트) — planner 항목으로 트래커에 등재한다. 다섯째(plan_coherence)는 트래커를
  닫을 때 «spec 문언이 이미 맞아 planner 턴이 필요 없다» 는 근거를 남긴다. INFO 7 은 참고(LLM 은 세 번째 메커니즘 · DNS fail-open 명문화 등).
- [x] 테스트 선작성 (RED 17 — 예측대로: http-safety mapped 14 · SMTP CGNAT 2 · `::` 1) → 구현 (GREEN) — `a14fb8f8f`.
  SMTP 가드는 `nodes/integration/send-email/` 로 옮겼다(`common` → `nodes` 역방향 import 를 만들지 않으려고). 뮤턴트 다섯 모두 RED:
  mapped 무시 · 정규화 제거 · 옥텟 뒤바꿈 · SMTP 가 모든 오류를 «막힘» 으로 · SMTP 를 옛 동작(CGNAT · `::` 통과)으로.
  e2e `integration-connection-test` B2(HTTP `[::ffff:127.0.0.1]:3011` · DB `::ffff:127.0.0.1` · Email `100.64.0.1`) — `6a7d70ce8`.
  옛 코드에서의 결과는 **예측만**(돌리지 않았다): HTTP 는 백엔드 자신의 health 에 닿아 성공, DB 는 `DB_CONNECT_FAILED`, Email 은 연결 시도.
- [x] TEST WORKFLOW (lint · unit · build · e2e 364) — build 의 타입체크 ratchet 이 `http-safety.spec` 3 → 4 를 잡았다(`lookup` mock 이
  단일 주소 오버로드). mock 타입을 `{ all: true }` 오버로드로 맞춰 4 → 0, baseline 197 → 194 — `1e07cf5cf`
- [ ] `/ai-review` 수렴
- [ ] `--impl-done`
- [ ] 트래커 두 항목 해소 + `ssrf.util` 항목 등재 · 이 plan `plan/complete/` 로
