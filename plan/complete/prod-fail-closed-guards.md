---
worktree: prod-fail-closed-guards
started: 2026-06-11
owner: developer
status: complete
spec_impact:
  - spec/5-system/1-auth.md
  - spec/5-system/11-mcp-client.md
  - spec/5-system/7-llm-client.md
  - spec/5-system/14-external-interaction-api.md
  - spec/conventions/secret-store.md
---

# P0 — production fail-closed 가드 블록 (refactor 04 C-1·M-4·M-7)

> 출처: `plan/in-progress/refactor/04-security.md` C-1·M-4·M-7 (P0 #3, 옵션 A: 단일 가드 블록).
> spec 이 동형 secret(`INTERACTION_JWT_SECRET`)·stub(`OAUTH_STUB`/`LLM_STUB`)에 이미 명문화한
> production fail-closed 표준을 코어 `JWT_SECRET`·`ENCRYPTION_KEY`·`MCP_ALLOW_INSECURE_URL` 에도 적용.

## 핵심 de-risk
e2e 는 `NODE_ENV=test` (docker-compose.e2e.yml:117) — production-only 가드는 **e2e 무영향**.
가드는 순수 함수 `assertProductionConfig(env)` 로 분리해 전 분기 단위 테스트.

## 변경
- 신규 `common/config/production-guards.ts` — `assertProductionConfig(env)`:
  - C-1: `JWT_SECRET` 미설정/`dev-jwt-secret`/`.env.example` placeholder → throw.
  - M-4: `ENCRYPTION_KEY` 미설정/공개 예시 키(all-zero·옛 `0123…`) → throw.
  - M-7: `MCP_ALLOW_INSECURE_URL` true → throw.
  - 기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 인라인 가드도 본 함수로 응집.
- `main.ts`: 인라인 가드 2개 → `assertProductionConfig(process.env)` 1줄 + `ALLOW_PRIVATE_HOST_TARGETS`
  production warn(throw 아님 — 정당 self-host 용도, M-7 정책 분리).
- `.env.example`: `ENCRYPTION_KEY` 실 64-hex 예시 → all-zero placeholder + "MUST regenerate" 주석.
- `jwt.config.ts` 의 `|| 'dev-jwt-secret'` fallback 은 **유지** — dev/test 편의(prod 는 가드가 거부).

## Spec
- `spec/5-system/1-auth.md §2.1`: JWT_SECRET production fail-closed 노트.
- `spec/conventions/secret-store.md §3.3`: .env.example=placeholder + 예시 키 production 거부.
- `spec/5-system/11-mcp-client.md §본문`: MCP_ALLOW_INSECURE_URL production throw + ALLOW_PRIVATE_HOST_TARGETS warn 분리.

## 체크리스트
- [x] `/consistency-check --spec` BLOCK: NO (`review/consistency/2026/06/11/09_53_08/`). WARNING(plan-tracking) 반영: 04-security C-1/M-4/M-7 마감 + fallback 유지 정제 기록 + `security-jwt-secret-fallback.md` superseded→complete + README spec 목록 정리.
- [x] 단위: assertProductionConfig 전 분기(비-prod no-op / OAUTH·LLM stub / JWT_SECRET·ENCRYPTION_KEY·MCP throw / 정상 pass / private-host warn-only) — 12 tests.
- [x] TEST WORKFLOW — lint ✅ · unit ✅ (backend 6547 — 리뷰 반영 +15 신규 테스트) · build ✅ · e2e ✅ (188, NODE_ENV=test 라 가드 미발동·정상 부팅).
- [x] `/ai-review` + fix — 4세션: `10_52_27`(LOW/W3 수용) · `11_25_15`(fallback-all, MEDIUM/W10 → W3/W7+INFO 코드fix `640fba79`, 나머지 수용/draft) · `11_53_22`(LOW/W2 → fragility fix `8ae64c58`) · `12_05_01`(**LOW/W0** 종결, RESOLUTION). spec-prose/SPEC-DRIFT 는 `plan/in-progress/spec-fix-prod-guards-prose.md` (planner 후속).
- [x] `/consistency-check --impl-done` BLOCK: NO (`review/consistency/2026/06/11/10_52_27/`). sibling 1-auth.md 경합 2건은 hunk 비중첩(WARNING, 머지순서) — PR #539 본문·`plan_coherence.md` 명시.

> **운영 영향 (사용자 검토 포인트)**: 본 가드는 production 에서 미설정/예시 secret·위험 플래그 시
> **부팅을 거부**한다 — 이는 의도된 fail-closed(insecure 부팅보다 안전)이며 기존 OAUTH_STUB/
> LLM_STUB/INTERACTION_JWT_SECRET 패턴과 동형이나, 운영 배포 시 secret 미주입이면 기동 실패하므로
> PR 본문에 명시해 사용자/운영 인지하에 머지한다. (기존 `security-jwt-secret-fallback.md` 가 이
> 정책 결정을 "사용자/운영 합의 필요" 로 표기했던 항목.)

## Rationale
옵션 A — 위협이 인증 전면 우회(기본 secret 토큰 위조)·secret store 평문화·SSRF 우회라 warn 수준 불충분.
spec 이 동형 secret/stub 에 이미 throw 표준을 명문화해 정책 논쟁 없음. 3건을 단일 함수로 응집해
이후 secret 추가 시 누락 재발을 구조적으로 차단. 회귀 리스크(부팅 거부)는 e2e=NODE_ENV test 로 통제.
`jwt.config` dev fallback 유지는 단위/dev 부팅 편의 — production 은 가드가 sentinel 을 거부하므로
보안 목표(기본 secret 미사용) 달성.
