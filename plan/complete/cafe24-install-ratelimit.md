---
worktree: cafe24-install-ratelimit-2891d1
started: 2026-06-02
owner: developer
type: implementation
parent: plan/in-progress/cafe24-backlog-residual.md (A-3)
---

# A-3 — Cafe24 install endpoint rate limiting 강화

## 출처

`cafe24-backlog-residual.md` 의 A-3 항목 (ai-review W7): install endpoint IP 기반 rate
limiting layer 추가 — token oracle enumeration 방어 강화. 현재는 `@Throttle({ limit: 30,
ttl: 60_000 })` (pod별 메모리 IP throttle) 만 존재.

사용자 결정 (2026-06-02): **Redis 분산 throttle + 실패 페널티** 방향.

## 설계 (확정)

- **Layer 1 — Redis 분산 throttle store (DEFERRED — 별 infra PR)**: 사용자 결정(2026-06-02):
  `@nestjs/throttler` storage 는 전역 단일 설정이라 install 외 모든 throttled 엔드포인트에 영향 +
  새 의존성/커스텀 storage 필요 → blast radius 가 install 범위를 넘는다. 본 PR 에서는 **구현하지 않고**
  기존 `@Throttle({ limit: 30, ttl: 60_000 })` (pod별 in-memory) 를 그대로 둔다. 분산화는 후속
  infra PR (cafe24-backlog-residual.md 후속 항목으로 등록).
- **Layer 2 — 실패 시도 페널티**: install_token 조회/HMAC 검증 **실패**(404 INVALID_TOKEN /
  403 INVALID_HMAC) 시에만 `INCR cafe24:install:fail:{ip}` (EX window). 성공 302 redirect 는
  카운트하지 않는다. 임계치(threshold/window) 초과 시 추가 처리 없이 차단(429 또는 404 유지로
  oracle 노출 최소화). 정상 사용자(유효 토큰·소수 요청)는 무영향, enumeration(대량 실패)만 정조준.
- **Layer 3 (deferred)**: 전역 endpoint cap (`cafe24:install:global`) — botnet 분산 enumeration
  상한. 본 PR 범위 밖, 필요 시 후속.

### 상수 (코드 + spec 동기)

| 상수 | 값(초기) | 의미 |
|---|---|---|
| `INSTALL_FAIL_THRESHOLD` | 10 | window 내 허용 실패 횟수 |
| `INSTALL_FAIL_WINDOW_SEC` | 600 (10분) | 실패 카운터 TTL |
| fail key | `cafe24:install:fail:{ip}` | IP별 실패 카운터 |

### consistency-check 확정 사항 (review/consistency/2026/06/02/00_56_06, BLOCK: NO)

- **W2 → Layer 2 차단 응답**: `429 CAFE24_INSTALL_RATE_LIMITED`. Layer 1 throttle(429)과 일관하고,
  실패 직후라 토큰 유효성을 새로 노출하지 않는다 (이미 실패한 IP 에게 "느려져라" 신호일 뿐).
- **W3 → degradation 차등**: Layer 1(throttle store)은 Redis 실패 시 **in-memory store 로 fallback**
  (pod별이지만 보호 유지). Layer 2(fail-penalty)·nonce-cache 는 **fail-open(skip)** — in-memory
  등가물이 없는 순수 강화라, Redis 부재 시 차단을 끄고 기존 정책으로 회귀하는 게 안전 (정상 install 차단 방지).
- **W6 → spec 갱신 주체**: orchestrator 직접 (본 PR step 4 documentation). project-planner 별 위임 안 함.
- **W4·W5 (out-of-scope)**: `send_email` 포트 id / `database_query` SSRF 에러코드 불일치는 A-3 무관
  기존 노드 컨벤션 이슈 → `cafe24-backlog-residual.md` 후속으로 분리 (본 PR scope 혼입 금지).

## 단계 체크리스트

- [x] 1. 스펙 분석 (§9.8 / §9.6, install endpoint throttle)
- [x] 2. 모호성 해소 (설계 확정 — 위 + consistency-check 확정 사항)
- [x] 3. consistency-check --impl-prep (BLOCK: NO — review/consistency/2026/06/02/00_56_06)
- [x] 4. DOCUMENTATION — spec 갱신 (§9.8 Rate limiting note + 상수 테이블 + Rationale, §9.2/§10.3 에러코드 CAFE24_INSTALL_RATE_LIMITED). A-2 README 는 별 항목으로 분리.
- [x] 5. 테스트 선작성 (Cafe24InstallRateLimitService unit + controller lockout/recordFailure 분기)
- [x] 6. 구현 (fail-penalty service + controller 연동 + 모듈 등록). Layer 1 분산 store 는 deferred.
- [x] 7. 테스트 보강 (서비스 13 + 컨트롤러 7 케이스, targeted jest 52 pass)
- [x] 8. TEST WORKFLOW — lint PASS · unit PASS(5409) · build PASS(docker) · e2e PASS(140). (구현 무관 base 깨짐 replay-rerun frontmatter 별 커밋 보정)
- [x] 9. REVIEW WORKFLOW — /ai-review (12/14 reviewer, HIGH) → SUMMARY 판독 → 수동 fix + RESOLUTION.md. Critical 1=false positive(spec 이미 갱신), 진짜 이슈 W7(상수명)·W2(IP 가드)·W6(분류 메서드 추출)·테스트 보강 fix. W1(trust proxy 기설정)·W3(pre-existing)·W4/5(codebase 패턴)·INFO14(anti-abuse 비사용자) 보류(근거 RESOLUTION). 재테스트 lint/unit(5418)/build/e2e(140) PASS.
- [x] 10. plan complete — `git mv` to plan/complete/. Layer 1·A-2 README 후속은 cafe24-backlog-residual.md 에 등록.

## Spec 갱신 (정식 phase — 외부 위임 아님)

- `spec/4-nodes/4-integration/4-cafe24.md` §9.8 "보안 추가 조치" 에 실패 페널티 layer + Redis
  분산 throttle 명시 + "관련 코드 상수" 테이블에 `INSTALL_FAIL_THRESHOLD` /
  `INSTALL_FAIL_WINDOW_SEC` 추가.
- `spec/2-navigation/4-integration.md` §9 install endpoint 행에 IP throttle + 실패 lockout 한 줄.
- developer 는 spec read-only — 본 갱신은 spec-update 제안으로 작성 후 project-planner 적용
  (또는 orchestrator 가 직접). 상세 변경안은 본 PR 안에서 확정.
