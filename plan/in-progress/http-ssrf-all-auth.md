---
worktree: http-ssrf-all-auth
started: 2026-06-11
owner: developer
---

# P0 — HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)

> 출처: `plan/in-progress/refactor/04-security.md` C-3 (P0 #1). 사용자 결정(2026-06-11): 옵션 A 진행.
> 현재 SSRF 가드는 `authentication='integration'` 일 때만 적용 — `none`/`custom` 인증은 무가드라
> 클라우드 IMDS(`169.254.169.254`)·내부망 직접 타게팅이 열려 있다. 코드 주석의 정당화("none may
> legitimately target internal services")는 어느 spec 에도 근거 없음(키워드 0건). 그 용도는 이미
> `ALLOW_PRIVATE_HOST_TARGETS` opt-out 으로 충족된다.

## spec 내부 모순 (해소 선행)
- `§4 step 8`: "SSRF 가드 (`authentication='integration'` 일 때만)".
- `§105 노트`: "기본은 차단(secure-by-default) … **이 플래그는 통합 노드 전반의 SSRF 가드를 공통
  제어한다**" — step 8 의 integration 한정과 정면 모순.
- 해소: step 8 을 **전 인증 방식 적용**으로 수정 → §105 secure-by-default 와 정합. DB/Email/MCP 의
  일관 posture·NF-SC-05(OWASP) 와도 일치.

## 핵심 de-risk
opt-out 인프라가 **이미 가드 함수 내부에 배선**돼 있다 (`http-safety.ts` `isPrivateHostsAllowed()` →
`ALLOW_PRIVATE_HOST_TARGETS`). 즉 게이트만 제거하면 정당한 내부 접근은 기존 플래그로 그대로 처리된다.
none/custom 은 현재도 redirect 를 follow 하지 않으므로(§4 step 9) redirect-SSRF 표면이 없다 — 초기
URL 가드(step 8)만 ungate 하면 충분. redirect-follow 동작은 변경하지 않는다(기능 불변).

## 변경

### spec (project-planner 위임)
- `spec/4-nodes/4-integration/1-http-request.md`:
  - §4 step 8: `(authentication='integration' 일 때만)` 제거 → "전 인증 방식. `ALLOW_PRIVATE_HOST_TARGETS=true` 로만 사설망 허용".
  - §105 노트: "위 step 8 의 SSRF 가드(전 인증 공통)" 로 정합화.
  - §4.2 Usage 로깅은 integration 한정 유지(none/custom 은 활동 로그 미생성) — SSRF 차단 시 error 포트 HTTP_BLOCKED 는 전 인증 공통, Usage 로그만 integration.
  - `## Rationale`: C-3 모순 해소 근거 + **운영 영향(breaking)**: none/custom 으로 사설망 호출하던 self-host 는 `ALLOW_PRIVATE_HOST_TARGETS=true` 설정 전까지 HTTP_BLOCKED. 마이그레이션 = 기존 플래그 1개.
  - `/consistency-check --spec` BLOCK 없음.

### 구현 (developer)
- `http-request.handler.ts`:
  - step 8 가드 블록(`if (authentication === 'integration')` line~325)을 **무조건 실행**으로. catch 의
    Usage 로그(`if (integrationId)`)는 integration 한정 유지, error 포트 반환은 전 인증 공통(기존 구조).
  - 주석(line 317-319)의 무근거 정당화 제거 → "전 인증 SSRF 가드, 내부 접근은 `ALLOW_PRIVATE_HOST_TARGETS`".
  - redirect follow 루프(line~391 integration 한정)는 불변 — none/custom 은 3xx 미follow(SSRF 표면 없음).

### 테스트
- 단위: `authentication='none'` 으로 `169.254.169.254`·`localhost`·`10.x` → port error·HTTP_BLOCKED.
  `custom` 동일. 기존 integration 차단 테스트 무변경 통과. ALLOW_PRIVATE_HOST_TARGETS=true 시 통과(public mock fetch 도달).
- e2e: none 인증으로 IMDS/사설 IP 차단 + 플래그 on 시 통과(가능 범위) — dockerized.

## 체크리스트
- [x] `/consistency-check --spec` — 3회: `22_28_10`(Critical: config-echo spread §4 step2 — 선재, 명시 열거로 fix) → `22_39_51`(Critical: node-output 3.1 SSRF-throw 예시·INTEGRATION_NOT_FOUND 허상 — 둘 다 선재, fix) → `22_50_38` **BLOCK: NO**. 잔여 WARNING(HTTP_BLOCKED enum 등재)도 반영.
- [x] spec 반영 — `1-http-request §4 step2(spread→열거)/step8(전 인증)/§5.8/§6/§8.2 Rationale·opt-out callout`, `node-output.md Principle 3.1(SSRF/credential→Runtime port, D4)`, `0-common §4.2(INTEGRATION_SERVICE_UNAVAILABLE 등재)`, `3-error-handling §1.4(HTTP_BLOCKED)`, `error-codes.ts(HTTP_BLOCKED enum)`.
- [x] 가드 ungate(`authentication==='integration'` 제거 → 전 outbound) + 무근거 주석 정정 + config-echo spread→명시 열거(Principle 7 D1) + 테스트(none/custom 차단·opt-out 통과·credential-leak 가드 +4)
- [x] TEST WORKFLOW — lint ✅ · unit ✅ (backend 6620) · build ✅ · e2e ✅ (188)
- [x] `/ai-review` — 2세션: `23_00_44`(전체, MEDIUM/0C/7W → fix `961f79a5`: i18n·주석·INTEGRATION D4) → `23_14_40`(증분, MEDIUM/0C/3W → RESOLUTION: W1/W2/W3 선재·documented). Critical 0. 후속 = `http-ssrf-all-auth-followups.md`.
- [x] `/consistency-check --impl-done` — `23_00_44`(Critical: 2-navigation §14.1 선재 D4, fix) → `23_14_40`(Critical: 2-code.md "node:vm 되돌림" — **stale-base FP**, origin/main #546 머지로 해소) → **`23_30_30`**: stale-base FP 소멸(Cross-Spec NONE). 잔여 Critical(node-output 3.1 SSRF분류)은 **main-baseline FP** — 내 branch 는 이미 SSRF 를 Runtime 포트 행으로 이동·D4 노트 추가(429d32d5, 3-dot diff 입증). checker 가 origin/main 옛 버전 읽음. 실 Critical 0. WARNING(HTTP_TIMEOUT 카탈로그·INTEGRATION_AUTH_UNSUPPORTED·anchor·status)은 선재/후속.
- [x] origin/main 머지(#546 isolated-vm/#545/#547) — 브랜치 현행화로 stale-base FP 해소. isolated-vm 재설치, backend-labels 충돌 해소. 머지 후 TEST WORKFLOW 재검: lint✅·unit✅(6610)·build✅·e2e✅(188).

> **⚠️ 운영 영향 (사용자 검토 포인트)**: 본 변경 후 `authentication=none`/`custom` HTTP Request 가
> 사설/loopback/link-local/CGNAT 대상이면 **기본 차단(HTTP_BLOCKED)**. none 으로 사내 API 를 호출하던
> 기존 self-host 워크플로는 `ALLOW_PRIVATE_HOST_TARGETS=true`(외부 egress 방화벽 전제) 설정 전까지
> 실패한다. 이는 의도된 secure-by-default 이며 §105 가 이미 명문화한 정책이나, breaking 이므로 PR 본문·
> 릴리스 노트에 명시해 운영 인지하에 머지한다.

## Rationale
옵션 A — none 무가드를 둘 이유가 "이미 `ALLOW_PRIVATE_HOST_TARGETS` 로 충족" 이라는 게 spec 대조 결론.
전체 적용 + 기존 opt-out 단일화가 위협(IMDS·내부망 SSRF) 차단과 spec(§105) 정합을 동시 만족하는
유일한 안. opt-out 이 이미 가드에 배선돼 회귀면이 좁고(게이트 1줄), 마이그레이션은 기존 env 1개.
