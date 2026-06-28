# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 범위: `spec/5-system/`
검토 일시: 2026-06-28

---

## 발견사항

### 1. [WARNING] `webhook-public-ip-failopen-hardening.md` "결정 2" — 기각된 `req.socket.remoteAddress` 폴백 재도입 위험

- **target 위치**: `plan/in-progress/webhook-public-ip-failopen-hardening.md §결정 필요 2항` — "앱 폴백: `req.socket.remoteAddress` 를 IP 폴백으로 쓸지"
- **과거 결정 출처**: `spec/5-system/1-auth.md` `## Rationale §2.3.B m-3 (클라이언트 IP 신뢰)` — "`ip_whitelist`/rate-limit 의 IP 추출이 헤더 기반(CF-gated → XFF 첫 IP)인 것은 의도된 결정이다 — `req.ip`(Express `trust proxy 1`) 를 우선/대체로 쓰자는 안은 **기각**한다: CF Tunnel 배포에서는 `req.ip` 가 cloudflared/CF edge 주소라 실제 클라이언트가 아니어서 `ip_whitelist` 를 오히려 깨뜨린다."
- **상세**: Rationale 2.3.B m-3 는 webhook/rate-limit/ip_whitelist 경로에서 `req.ip`/`socket` 폴백을 **명시적으로 기각**하고 `extractClientIpFromHeaders`(헤더 기반 전용)를 단일 경로로 확정했다. `webhook-public-ip-failopen-hardening.md` 는 IP 미식별 시 `req.socket.remoteAddress` 폴백 채택 여부를 미결 결정으로 열어두고 있다. 현재 이 plan 은 "unstarted"이고 `spec/5-system/` 본문에는 반영되지 않아 spec 자체는 아직 일치하지만, 이 결정이 Rationale 갱신 없이 구현으로 진행되면 명시 기각된 대안이 재도입된다.
- **제안**: `webhook-public-ip-failopen-hardening.md` 의 결정 2를 채택하기 전, 반드시 `1-auth.md Rationale 2.3.B m-3` 의 "req.ip/socket 기각" 항을 새 위협 모델과 근거를 포함해 명시적으로 갱신해야 한다. plan 파일 §후속 에 이미 "m-3 도 함께 개정해야 한다" 가 적혀 있으나, 이는 메모 수준이지 Rationale 공식 갱신이 아니다. 구현 착수 전 spec 갱신(project-planner 역할)이 선행되어야 한다.

---

### 2. [INFO] `spec/5-system/12-webhook.md` WH-SC-09 fail-closed — Guard fail-open 과의 용어 혼동 방지

- **target 위치**: `spec/5-system/12-webhook.md §WH-SC-09` — "클라이언트 IP 를 알 수 없으면 거부(fail-closed)"
- **과거 결정 출처**: `spec/5-system/12-webhook.md ## Rationale "공개 webhook throttle Guard — 조회 실패 시 fail-open + error 로깅"` — "본 Guard 의 책임은 rate-limit(가용성 보호)이지 인증·인가가 아니다. 기각 — fail-closed: 조회 실패 시 전부 거부하면 ... 폭발 반경이 과도하다."
- **상세**: WH-SC-09 의 fail-closed 는 `ip_whitelist` 검증(인증 레이어)에서 IP 미식별 시 거부하는 것이고, Guard Rationale 의 fail-open 은 Guard 자체 인프라 장애(DB 조회 실패/Redis 미가용) 시 rate-limit 레이어를 통과시키는 것이다. 두 컨텍스트가 다르므로 실질 충돌은 없다. 그러나 같은 "IP 미식별" 상황을 한 곳은 fail-closed, 다른 곳은 fail-open 으로 기술해 레이어 혼동 위험이 있다.
- **제안**: spec 자체는 수정 불필요. 다만 구현 시 `ip_whitelist` fail-closed(WH-SC-09, 인증 레이어)와 Guard fail-open(Rationale, rate-limit 레이어)이 서로 다른 레이어에 있음을 코드 주석에서 명확히 구분하면 오해가 줄어든다.

---

### 3. [INFO] Plan M-1 반환형 변경 — Rationale 무관, 행동 보존 확인 필요

- **target 위치**: `plan/in-progress/webhook-maint-backlog.md §M-1` — `extractClientIpFromHeaders` 반환형 `string | null` → `string | undefined`
- **과거 결정 출처**: `spec/5-system/1-auth.md Rationale 2.3.B m-3` — `extractClientIpFromHeaders` 는 헤더 기반 전용, `req.ip`/socket 폴백 없음
- **상세**: 반환형 변경은 타입 레벨 정합성 개선으로 Rationale 가 정한 "헤더 기반 전용, 폴백 없음" 행동 invariant 를 건드리지 않는다. `hooks.service.ts` 의 `?? undefined` 제거도 반환형이 이미 `undefined` 이므로 동작은 동등하다. Rationale 위반 아님.
- **제안**: 변경 후 소비처(`hooks.service.ts` `if (!ip)` 등)에서 `null`/`undefined` falsy 동등성을 유지하는지 단위 테스트로 보강하면 Rationale invariant 회귀를 방어할 수 있다. Plan M-2(테스트 갭 보강)와 병행 권장.

---

### 4. [INFO] `spec/5-system/12-webhook.md` — `endpointPath` mutable 정책, Rationale 일관성 확인

- **target 위치**: `spec/5-system/12-webhook.md ## Rationale "endpointPath 가변성"` — "Webhook 트리거의 `endpointPath` 는 의도적으로 변경 가능(mutable)"
- **과거 결정 출처**: 동일 파일 WH-SC-01 — "`endpointPath` UUID 가 사실상 비밀 키이므로 반드시 CSPRNG 로 발급한 v4 UUID 여야 한다", WH-MG-02 — "서버가 생성/수정 DTO 에서 v4 UUID 형식을 강제"
- **상세**: mutable endpointPath Rationale 에서 "변경된 값은 여전히 비밀 키 역할을 하므로(WH-SC-01) UUID 수준의 고엔트로피 값을 유지해 squatting·enumeration 을 막는 것을 전제로 한다" 고 명시하고 있어 일관성이 있다. Rationale 자체가 WH-SC-01 의 엔트로피 요건을 재확인하며 번복 없이 조건부 허용으로 정리되어 있다. 충돌 없음.
- **제안**: 구현 시 `UpdateTriggerDto` 의 `@IsUUID('4')` 검증이 수정 경로에서도 적용되는지 확인.

---

## 요약

`spec/5-system/` 현재 문서 본문은 기존 Rationale 결정들과 대체로 정합하다. 주요 위험은 문서 밖(plan 파일)에 있다: `webhook-public-ip-failopen-hardening.md` 가 1-auth Rationale 2.3.B m-3 에서 **명시적으로 기각**한 `req.socket.remoteAddress` 폴백을 미결 결정으로 다시 열어두고 있다. 이 결정이 Rationale 공식 갱신 없이 구현으로 이어지면 합의된 invariant("webhook/rate-limit/ip_whitelist 경로는 헤더 기반 전용, req.ip/socket 폴백 없음")가 무근거 번복되는 CRITICAL 위험이 된다. 현재 시점에서는 spec 본문에 반영되지 않았으므로 WARNING 으로 분류하되, `webhook-public-ip-failopen-hardening.md` 의 결정 2 진행 전 반드시 Rationale 2.3.B m-3 공식 개정이 선행되어야 한다. 나머지 발견사항(Guard fail-open/closed 용어 혼동, 반환형 변경 행동 보존, endpointPath mutable)은 모두 INFO 수준으로 구현 차단 사유가 없다.

## 위험도

MEDIUM
