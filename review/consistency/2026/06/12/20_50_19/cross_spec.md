# Cross-Spec 일관성 검토 — spec-draft-refactor-04-security-drift

검토 대상: `plan/in-progress/spec-draft-refactor-04-security-drift.md`
검토 일시: 2026-06-12

---

## 발견사항

### **[WARNING]** §1 CF-Connecting-IP opt-in 정책 — 데이터 모델과 설명 불일치

- **target 위치**: draft §1 "클라이언트 IP" — `TRUST_CF_CONNECTING_IP=true` 일 때만 CF-Connecting-IP 1순위(기본 off)
- **충돌 대상**:
  - `spec/5-system/1-auth.md §2.3` (클라이언트 IP 행): "Cloudflare 무료 플랜 호환: `CF-Connecting-IP` 헤더를 1순위, `X-Forwarded-For` 첫 IP, `req.ip` 순으로 추출" — opt-in 게이트 없이 무조건 1순위로 기술
  - `spec/1-data-model.md §2.18.1 RefreshToken`: `ip_address` 필드 설명 "발급 시점 클라이언트 IP (CF-Connecting-IP 우선)" — 여전히 무조건 우선으로 기술
- **상세**: draft 는 `TRUST_CF_CONNECTING_IP=true`(기본 off) env 게이트를 도입해 opt-in 화하지만, `spec/5-system/1-auth.md §2.3` 표와 `spec/1-data-model.md §2.18.1` 의 설명 모두 "CF-Connecting-IP 우선/1순위"를 env 조건 없이 기술하고 있다. draft 가 §2.3 을 정정한다고 선언하지만, `spec/1-data-model.md §2.18.1` 의 IP 설명은 draft 변경 범위에 포함되어 있지 않다. 이 상태로 두면 데이터 모델의 IP 수집 설명이 새 opt-in 정책과 불일치한다.
- **제안**: draft 가 `spec/1-data-model.md §2.18.1` `ip_address` 필드 설명도 "(CF-Connecting-IP 1순위, `TRUST_CF_CONNECTING_IP=true` 일 때만)" 으로 함께 정정한다.

---

### **[WARNING]** §2 웹소켓 §3.3 소유검증 채널 목록 — 신규 채널 누락

- **target 위치**: draft §2 "소유검증 채널 표에 `workflow:{workflowId}` + `notifications:{userId}` 추가"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §3.3` (권한 검증 단락): "`execution:` / `kb:` / `background:run:` 채널은 workspace 소유 검증 — IDOR 차단" — `workflow:` 와 `notifications:` 가 권한 검증 설명 텍스트에 없음
- **상세**: draft 는 `workflow:{workflowId}` (workspace 소유)와 `notifications:{userId}` (JWT sub 일치)를 소유검증 채널 표에 추가한다고 선언한다. 그런데 §3.3 권한 검증 단락의 괄호 안 목록 (`execution:` / `kb:` / `background:run:`)은 draft 변경 범위로 명시적으로 포함되지 않았다. 이 목록이 갱신되지 않으면 §3.2 채널 패턴 표에는 등장하는 채널인데 권한 검증 목록에는 빠진 채로 남아 불일치가 생긴다. 또한 `notifications:{userId}` 의 검증 기준(JWT sub 일치)은 `workflow:{workflowId}` (workspace 소유)와 달라 검증 분기 기준도 §3.3 에 명시돼야 한다.
- **제안**: draft 가 `spec/5-system/6-websocket-protocol.md §3.3` 권한 검증 단락의 채널 목록을 "`execution:` / `kb:` / `background:run:` / `workflow:` 채널은 workspace 소유 검증, `notifications:{userId}` 는 JWT sub 일치 검증"으로 함께 갱신한다.

---

### **[INFO]** §1 CSRF Origin allowlist 정책 — allowlist 설정 소스 미기술

- **target 위치**: draft §1 "§2.3 표: `/auth/refresh` CSRF — Origin allowlist(`isOriginAllowed`) 대조"
- **충돌 대상**: `spec/5-system/1-auth.md §2.3` (현재 CSRF 정책 미기술), `spec/0-overview.md §2.2` API Gateway CORS 관리
- **상세**: draft 가 `/auth/refresh` 전용 CSRF Origin allowlist (`isOriginAllowed`) 검증을 신설하지만, 해당 allowlist 의 설정 소스(env 변수명 또는 기존 CORS 허용 origin 목록과의 관계)가 draft 에 명시되지 않았다. 다른 spec 에서도 이 allowlist 의 정의를 찾을 수 없어 §2.3 을 읽는 사람이 설정 방법을 파악할 수 없다.
- **제안**: draft §2.3 Rationale 또는 표 항목에 allowlist 의 설정 경로(env 변수명, 또는 기존 CORS 허용 목록과 동일하다면 해당 참조)를 추가한다.

---

### **[INFO]** §3 ReDoS 정책 — if-else spec 의 기존 헬퍼명(`compileRegexCache`)과 불일치

- **target 위치**: draft §3 "단일 헬퍼 `compileUserRegex`" — filter·transform·if-else 모두 동일 헬퍼 사용
- **충돌 대상**: `spec/4-nodes/1-logic/1-if-else.md §6 각주`: "`compileRegexCache` 로 조건별 정규식을 컴파일" — draft 가 사용하는 `compileUserRegex` 와 다른 헬퍼명
- **상세**: draft 는 단일 헬퍼 `compileUserRegex` 를 사용한다고 선언하지만, 기존 if-else spec 은 `compileRegexCache` 라는 다른 이름을 언급한다. 두 이름이 같은 구현을 가리키는지, rename 된 것인지 spec 에서 불분명하다. filter·transform spec 은 헬퍼명 없이 길이 제한만 기술해 차이가 없지만, if-else 는 명시적으로 다른 이름을 쓴다.
- **제안**: draft 가 `spec/4-nodes/1-logic/1-if-else.md §6 각주`의 헬퍼명도 `compileUserRegex` 로 동기화하거나, draft 에 "기존 `compileRegexCache` wrapper/rename" 임을 명시한다.

---

### **[INFO]** §4 Swagger frontmatter code: 항목 — production-guards.ts 추가 시 main.ts 이미 언급 중

- **target 위치**: draft §4 "swagger.md §0 신설; frontmatter `code:` 에 production-guards.ts·main.ts 추가"
- **충돌 대상**: `spec/conventions/swagger.md` frontmatter `code:`: `[codebase/backend/src/common/swagger/**, codebase/backend/nest-cli.json]` — production 가드 관련 파일 미포함, 단 main.ts 는 §2-1 본문에서 이미 언급
- **상세**: 기존 swagger.md frontmatter `code:` 에 `main.ts` 가 없는데 §2-1 본문에서는 참조한다. draft 가 `main.ts` 를 frontmatter `code:` 에 추가하는 것은 일관성 향상이다. CRITICAL/WARNING 급 모순이 아닌 보완 사항.
- **제안**: draft 적용 시 `spec/conventions/swagger.md` frontmatter `code:` 에 `production-guards.ts` 경로와 `main.ts` 를 함께 추가한다.

---

## 요약

Cross-Spec 일관성 관점에서 WARNING 2건이 있다. 첫째, draft §1 의 CF-Connecting-IP opt-in 화는 `spec/5-system/1-auth.md §2.3` 뿐 아니라 `spec/1-data-model.md §2.18.1` RefreshToken `ip_address` 설명("CF-Connecting-IP 우선")도 동시 정정해야 하나 후자가 draft 변경 범위에 빠져 두 문서가 불일치한다. 둘째, draft §2 의 WebSocket 소유검증 채널 신규 추가는 `spec/5-system/6-websocket-protocol.md §3.3` 권한 검증 단락의 채널 목록 텍스트도 동시에 갱신해야 완결되나 해당 단락이 draft 범위에 없어 채널 표와 권한 설명이 불일치할 우려가 있다. 나머지 항목(CSRF allowlist 소스 미기술, `compileUserRegex`/`compileRegexCache` 헬퍼명 불일치, swagger frontmatter 보완)은 INFO 수준의 동기화 권장 사항이다. CRITICAL 모순(즉시 작동 불가 수준의 직접 충돌)은 없다.

---

## 위험도

MEDIUM
