---
worktree: webhook-public-ip-failopen-3800c4
started: 2026-06-28
owner: developer
spec_impact:
  - spec/7-channel-web-chat/4-security.md
  - spec/5-system/12-webhook.md
  - spec/5-system/1-auth.md
  - spec/5-system/3-error-handling.md
---

# 공개 webhook IP 미식별 fail-open 강화 (D-12)

## 배경

`PublicWebhookThrottleGuard` 는 클라이언트 IP 로 미인증 공개 webhook 에 rate-limit 을 건다.
IP 를 식별하지 못하면(`if (!ip) return true`) 통과시킨다([guard:104](../../codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts)).
→ 공격자가 `X-Forwarded-For`(및 신뢰 시 `CF-Connecting-IP`) 헤더를 **제거**하면 IP 가 null 이 되어
rate-limit(분당 10·시간당 20)을 **무제한 우회**할 수 있다.

PR #763 fresh 리뷰(review/code/2026/06/28/17_16_16) INFO #15 / 권장 7 에서 중장기 항목으로 분리됨.
설계 의도(Guard 책임은 rate-limit 한정, 후행 글로벌 throttler 100 req/min 이 1차 방어)는 명확하나,
공개 진입점 brute-force 표면이므로 IP 미식별 케이스를 좁히는 강화가 바람직.

## 결정 (사용자 확정 2026-06-28)

1. **처리 레이어 — 앱 우선 + 인프라 권고 문서화**: guard 가 null-IP 를 graceful 하게 처리(아래 결정 3)하는
   portable 기준선. 추가로 "CF/WAF/Ingress 에서 XFF 강제·헤더 없는 외부 요청 차단"을 managed 배포용 강방어로
   spec 에 권고 기재. self-host 도 앱 레벨로 보호받음.
2. **socket 폴백 — 채택 안 함**: `req.socket.remoteAddress` 를 폴백으로 쓰지 않는다(headers-only 유지).
   `trust proxy=1`(`main.ts:179`) 뒤에선 socket 피어가 cloudflared/LB 주소라 전 트래픽이 단일 버킷으로
   붕괴 → 정상 사용자 false 429. Rationale 2.3.B 가 `req.ip` 를 기각한 함정과 동일.
3. **IP 미식별 시 — 완화 한도(단일 공유 버킷)**: header 없는 미식별 요청 전체를 하나의 보수적 공유 버킷
   (`UNIDENTIFIED_IP_BUCKET` sentinel)으로 묶어 기존 fixed-window 한도를 적용. 무제한 우회 → 유한 상한.
   fail-closed(거부)는 프록시 없는 직결/self-host 정상 클라이언트를 막고, 비-인증 best-effort 레이어가
   가용성을 희생하는 §4 철학과 충돌하므로 기각. graceful degradation 보존.

## 설계 (구현)

- `public-webhook-quota.service.ts`: sentinel 상수 `UNIDENTIFIED_IP_BUCKET`(비-IP 문자열, 예 `'__no_client_ip__'`)
  export. `consumeStart(ip)` 는 그대로 — sentinel 도 일반 IP 처럼 `wh:rl:min:`/`wh:rl:hour:` 키로 처리되어
  미식별 요청 전체가 단일 공유 버킷에 누적된다(별도 한도/메서드 불필요 — 단일 공유 버킷이 곧 보수적).
- `public-webhook-throttle.guard.ts`: line 104 `if (!ip) return true` 제거 →
  `const ip = extractClientIpFromHeaders(...) ?? UNIDENTIFIED_IP_BUCKET;` 후 동일 `consumeStart` 경로.
  주석으로 결정 3(완화 한도)·결정 2(socket 폴백 기각) 근거 기재.
- 글로벌 throttler(100 req/min)·Guard 책임 경계는 변화 없음 — Guard 는 여전히 공개 webhook 의 IP/공유 버킷
  rate-limit 만 담당, 후행 글로벌 throttler 가 IP 무관 1차 방어 유지(중복/공백 없음).

## Phase

### A. spec 반영 (planner)
- [x] **S-1** `7-channel-web-chat/4-security.md §4` (정책 SoT): per-IP vs 미식별 공유 버킷 명확화 + 결정 1
  인프라 권고 blockquote(I-7).
- [x] **S-2** `7-channel-web-chat/4-security.md` 신규 `### R6` (rationale SoT): 3 결정 근거 명문화
  ("무제한 → 유한 상한 강화" 명기) + R3 에 R6 포인터.
- [x] **S-3** `5-system/12-webhook.md §6·§8·WH-SC-05`: guard 불릿 sentinel 공유 버킷 + 4-security forward-ref;
  WH-SC-05 에 WH-SC-09(인증 ip_whitelist fail-closed) 경계 한 줄(I-3).
- [x] **S-4** `5-system/1-auth.md Rationale 2.3.B m-3`: socket/req.ip 폴백 기각 + 공유 버킷 cross-ref(R6).
- [x] `/consistency-check --spec` — `review/consistency/2026/06/28/20_18_33` **BLOCK:NO** (LOW). W-1→R6 분리·W-2→branch 제거 반영.
- [x] **(impl-prep 후속)** W-1: `3-error-handling.md §1.7` 두 에러코드 설명에 공유 버킷 케이스 추가;
  I-2: `1-auth.md §2.3` 표 "클라이언트 IP" 셀에 공유 버킷 완화 한도 한 줄 추가.

### B. 구현 (developer, SDD+TDD)
- [x] `/consistency-check --impl-prep spec/5-system/` — `review/consistency/2026/06/28/20_32_34_d12` **BLOCK:NO** (LOW). W-1·I-2·I-6 반영, I-3~I-5 pre-existing 이월. (세션 dir 은 origin/main 의 m1-integration `--spec` 세션과 같은 초 충돌해 `_d12` suffix 로 보존 — rebase 해소.)
- [x] **I-1** quota service `UNIDENTIFIED_IP_BUCKET` 상수 export + unit 테스트(sentinel 키/IPv4·IPv6 비충돌/consumeStart/hourly).
- [x] **I-2** guard null-IP → `|| UNIDENTIFIED_IP_BUCKET` 공유 버킷 라우팅 + guard.spec(미식별 consumeStart 호출/분당·시간당 429/W14 trigger 첨부).
- [x] TEST WORKFLOW lint·unit·build 통과. **e2e 보류(사용자 취소 → PR CI 위임)** — docker.io `flyway:10-alpine` manifest fetch `DeadlineExceeded`(레지스트리 인프라, 빌드 5회+직접 pull+classic-builder 우회+사용자 이미지 pull 후 재시도 모두 동일; 이미지 layer 는 로컬 캐시·registry root 도달·node 이미지는 로드됨 → flyway namespace 특정 차단). 코드 무관. 사용자 "e2e는 취소하고 이후 진행" 결정 → PR CI 가 e2e 독립 실행.
- [x] `/ai-review` (`review/code/2026/06/28/21_09_41`) **RISK:LOW, Critical 0, Warning 2** → W1(plan 체크박스)·W2(sentinel hourly 테스트) + INFO 7(`??`→`||`)·8(IPv6 단언)·9(W14 단언) 반영. RESOLUTION.md 작성.
- [x] `/consistency-check --impl-done spec/5-system/` — 병합 게이트 통과 (PR #770)
- [x] push + PR — PR #770 (`d2342b40c`) merged

## 범위 경계
- 동시 ≤3 캡(대화 종료 신호 연동)은 여전히 비목표(4-security §4) — 본 작업 밖.
- 인프라(WAF/Ingress) 구성 자체는 코드 범위 밖 — spec 권고로만 기재(결정 1).

## Followup 이월 (ai-review INFO, 본 PR 범위 밖)
- INFO 1: `wh:rl:min:__no_client_ip__` 키 스파이크 모니터링/알람 → 인프라 운영 가이드.
- INFO 6: 공유 버킷 한도 별도 튜닝(config 배율 `publicWebhook.unidentifiedBucketMultiplier`) — 레거시/직결 클라이언트 다수 환경 대비. 결정 3은 "동일 한도"가 기본이므로 필요 시 별도 결정.
