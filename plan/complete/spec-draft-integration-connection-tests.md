---
title: 통합 연결 테스트 — Database · HTTP 는 실제로 접속해 본다, Google · GitHub · Webhook 은 구조 검증만이라고 적는다
status: complete
owner: project-planner
worktree: integration-testers-5c2d91
started: 2026-09-19
completed: 2026-09-19
spec_impact:
  - spec/2-navigation/4-integration.md
---

# 통합 연결 테스트 — 약속한 테스트와 실제의 간극

## 왜 지금

`entity-column-declaration-drift`(developer)의 `--impl-prep spec/2-navigation/`(`review/consistency/2026/09/19/10_58_34`)가 **BLOCK: YES**.
Critical 은 `spec/2-navigation/4-integration.md` §5.4 가 `IntegrationTestResult.code` 를 소문자(`auth_failed` · `network` · `unknown_error`)로 적어
`spec/conventions/error-codes.md` §1(UPPER_SNAKE_CASE)을 어긴다는 것이었다. 확인해 보니 더 컸다 — **§5.4 가 약속한 테스트 자체가 없다.**

`IntegrationsService.dispatchTest`(`integrations.service.ts`)는 두 단계다: ① 구조 검증(`validateCredentials`) ② 등록된 transport tester 로 실제
왕복. transport tester 는 `mcp` · `email` 둘뿐이고, entity tester(`registerEntityTester`)는 `cafe24` · `makeshop` 둘뿐이다. 나머지 다섯 —
**Google · GitHub · HTTP · Database · Webhook** — 은 구조만 맞으면 `{ success: true, message: 'Connection successful' }` 이다. 그런데 §5 는
다섯 모두에 실제 테스트(`tokeninfo` · `GET /user` · `GET base_url` · `SELECT 1` · `HEAD url`)를 약속한다. 결과: **틀린 비밀번호로도 연결 테스트가
성공하고, 테스트 성공을 조건으로 하는 자격증명 교체(rotate)가 통과한다.** SMTP 도 같은 상태였다가 `verify()` 로 고쳤다(Rationale «SMTP 연결
테스트를 `verify()` 로 구현»).

## 사용자 결정 (2026-09-19)

1. 처음: «다섯 테스터를 구현».
2. 조사 뒤 다시 물음 — **Google · GitHub · Webhook 은 그 통합을 쓰는 노드가 없다**(노드 핸들러의 `resolveIntegration` 호출처 다섯이 모두 다른
   서비스, 아웃바운드 웹훅 노드는 없다). **Google 은 토큰 갱신이 구현돼 있지 않다**(표준 전략은 `authorization_code` 만) — `tokeninfo` 테스트를
   붙이면 1시간 뒤 항상 실패로 나온다. → **«DB · HTTP 만 구현»**. 나머지 셋은 spec 을 «현재 구조 검증만» 으로 정정하고, 그 통합을 쓰는 노드가 생길 때
   테스터를 함께 만든다(트래커).

## 변경 — `spec/2-navigation/4-integration.md`

### A. §5.4 Database — 테스트 (490행)

«테스트: 연결 후 `SELECT 1` 실행. 실패 시 드라이버별 에러 메시지를 `error.code`에 정규화(`auth_failed`, `network`, `unknown_error`).» →

«테스트: 저장된(또는 입력한) 자격증명으로 **일회성 연결**을 열어 `SELECT 1` 을 실행하고 닫는다(연결 풀을 쓰지 않는다). 연결 대기는 10초.
SSL 매핑과 host 의 SSRF 가드는 Database 노드(`../4-nodes/4-integration/2-database-query.md`)와 같다. 결과:
- 성공 → `success: true`
- host 가 SSRF 가드에 차단 → `DB_HOST_BLOCKED`
- 인증 거부(PostgreSQL SQLSTATE class 28 · MySQL `ER_ACCESS_DENIED_ERROR` · `ER_DBACCESS_DENIED_ERROR`) → `DB_AUTH_FAILED`
- 그 밖(네트워크 · 타임아웃 · TLS · 없는 database 등) → `DB_CONNECT_FAILED`
메시지는 드라이버 원문을 길이 제한해 싣는다(비밀번호는 드라이버 원문에 없다). 코드는 `IntegrationTestResult.code` namespace(§5.5)다.
`DB_CONNECT_FAILED` 는 노드 런타임의 `DB_CONNECTION_ERROR`(핸드셰이크 인증 실패까지 포함)와 **모집합이 다르다** — 연결 테스트는 인증 실패를
`DB_AUTH_FAILED` 로 먼저 가른다. 이 일회성 연결은 노드 실행의 커넥션 풀과 별개이며 풀에 남지 않는다.»

(적용 때 위 경로는 링크 `[Database 노드](../4-nodes/4-integration/2-database-query.md)` 로 쓴다 — 실재 확인함.)

### B. §5.3 HTTP/REST — 테스트 (476행)

«테스트: `base_url` 존재 시 `GET base_url`(혹은 사용자가 지정한 `test_path`) 200 기대. 미지정이면 테스트 단계를 건너뛰고 경고 배너.» →

«테스트: `base_url` 이 있으면 HTTP Request 노드와 **같은 방식으로 자격증명을 붙여** `GET base_url` 을 보낸다. 리다이렉트는 노드와 같이 최대
5홉 따라가며 홉마다 SSRF 를 다시 검사한다(`[HTTP Request §4](../4-nodes/4-integration/1-http-request.md#4-실행-로직)` step 9 — 리다이렉트 뒤에서
인증을 거부하는 서비스도 잡힌다). 판정은 마지막 응답으로 한다. 응답 본문은 읽지 않는다. 대기는 10초. host 의 SSRF 가드는 노드와 같다
(`ALLOW_PRIVATE_HOST_TARGETS` opt-out). 결과:
- 2xx(또는 `Location` 없는 3xx) → `success: true`
- 401 · 403 → `HTTP_AUTH_FAILED` — 서버가 자격증명을 거부했다
- 그 밖의 4xx(404 · 405 등) → `success: true` 이지만 메시지로 «서버에는 닿았지만 `base_url` 이 이 요청을 처리하지 않아 자격증명은 확인하지
  못했다» 고 알린다 — `base_url` 은 대개 API 의 뿌리라 그 자체가 자원이 아니다. 이것을 실패로 두면 맞는 자격증명의 교체(rotate)도 막힌다
- 5xx → `HTTP_SERVER_ERROR`
- host(첫 요청 또는 리다이렉트 대상)가 SSRF 가드에 차단되거나 리다이렉트가 5홉을 넘음 → `HTTP_BLOCKED`
- 네트워크 · 타임아웃 · TLS → `HTTP_CONNECT_FAILED`
`base_url` 이 비어 있으면(노드가 URL 전체를 적는 통합) 호출하지 않고 `success: true` 에 «`base_url` 이 없어 연결을 확인하지 않았다» 는 메시지를
돌려준다. **한계**: 자격증명 거부를 알 수 있는 것은 `base_url` 이 401 · 403 을 돌려줄 때뿐이다.»

(`test_path` 는 서비스 레지스트리에 없는 필드라 뺀다 — 아래 «비대상».)

### C. §5.1 Google · §5.2 GitHub · §5.7 Webhook — 테스트 (429 · 449 · 560행)

각 «테스트 …» 문장 →

«테스트: 현재는 **필드 구조 검증만** 한다 — 실제 호출은 없다. 이 통합을 쓰는 노드가 아직 없어서다(Google 은 토큰 갱신 경로도 구현돼 있지
않다 — §10.3 · §10.5 주석). 노드가 생길 때
<원래 약속한 테스트>를 함께 만든다(Rationale «연결 테스트 — Database · HTTP 는 실제로 접속한다»).»

`<원래 약속한 테스트>` 자리에 각각 «`tokeninfo` 핑» · «`GET https://api.github.com/user`» · «`url` 에 대한 프로브» 를 적어 의도를 보존한다.

### D. §3.3 Step 3 연결 테스트 (236행)

«- OAuth의 경우 팝업에서 이미 토큰 교환이 완료되었으므로 실제 API 핑(`/me` 또는 서비스별 동등 엔드포인트)» →
«- OAuth 는 팝업에서 이미 토큰 교환이 끝났으므로 사전 테스트는 필드 구조만 검증한다(서비스별 테스트 범위는 §5.x · §9.2 표)»

(Google · GitHub · Cafe24 Public 은 preview-test 가 구조 검증만이다. Cafe24 Private · MakeShop 은 Step 3 를 거치지 않고 곧바로 `pending_install`
로 생성된다(§3.2). Cafe24 · MakeShop 의 실제 핑은 연결 뒤 `:id/test` 의 entity tester 다.)

### E. §9.2 `preview-test` 행 (810행) — 서비스별 외부 호출 여부

«외부 호출 여부는 service_type 별로 다름 — **Email(SMTP)**: 실제 `verify()` 외부 호출 (§5.5), **Cafe24**: 구조 검증만 (§5.8), 그 외: §5.x 각 정의» →
«외부 호출 여부는 service_type 별로 다름 — **실제 호출**: Email(`verify()`, §5.5) · MCP(§5.6) · HTTP(§5.3) · Database(§5.4). **구조 검증만**:
Cafe24(§5.8) · MakeShop · Google · GitHub · Webhook. (Cafe24 · MakeShop 은 저장 뒤 `:id/test` 에서 entity tester 가 실제로 호출한다.)»

### F. §14.1 «에러 코드 vocabulary» 표

- 기존 `DB_HOST_BLOCKED` · `HTTP_BLOCKED` 행의 «영향» 칸에 «연결 테스트는 `result.code` 반환» 을 더한다(`EMAIL_HOST_BLOCKED` 행과 같은 형식).
- 새 행 다섯(모두 «**연결 테스트 전용** — `IntegrationTestResult.code` namespace (노드 런타임 `ErrorCode` enum 과 별개)» — `EMAIL_CONNECT_FAILED`
  행과 같은 형식): `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` · `HTTP_AUTH_FAILED` · `HTTP_CONNECT_FAILED` · `HTTP_SERVER_ERROR`. «원인» 칸은 A · B 의
  조건을 옮긴다. 이름이 가까운 노드 런타임 코드와의 대비를 적는다 — `DB_CONNECT_FAILED` ↔ `DB_CONNECTION_ERROR`(모집합이 다르다) ·
  `HTTP_SERVER_ERROR` ↔ `HTTP_{status}` · `HTTP_CONNECT_FAILED` ↔ `HTTP_TRANSPORT_FAILED`. 저장소 전체에서 다섯 이름 모두 grep 0건이다(충돌 없음).

### G. `## Rationale` 맨 위 — «연결 테스트 — Database · HTTP 는 실제로 접속한다, 나머지 셋은 구조 검증만 (2026-09-19)»

위 «왜 지금» · «사용자 결정» 요약, HTTP 4xx 처리 근거(뿌리 URL 은 자원이 아니다 · rotate 를 막지 않는다), 코드 이름 규칙(차단 코드는 노드와
공유 — `EMAIL_HOST_BLOCKED` 선례, 나머지는 연결 테스트 전용, 이름이 가까운 노드 코드와의 대비), §5.4 소문자 코드 철회, HTTP 리다이렉트 추종
(노드와 같게 — 뒤에서 거부하는 서비스), **preview-test «외부 호출 없음» 의 범위 갱신**(Cafe24 · MakeShop 은 설계상 — 토큰이 막 발급됐거나
`pending_install`, Google · GitHub · Webhook 은 구현 범위 — 쓰는 노드가 없다), 연결 테스트 실패는 `consecutive_network_failures` 에 합산하지
않는다(연결 테스트 endpoint 카운터 제외 선례의 확장).

### H. Google 자동 갱신 서술에 사실 주석 (§10.3 표 · §10.5 첫 bullet)

- §10.3 provider 표 Google 행 «Refresh ✓» → «✓(발급) — 갱신 경로 미구현(§10.5 주석)».
- §10.5 «Refresh token 보유 시 (… — 현재 `cafe24`, `google`)» → «(… — 현재 `cafe24`. `google` 은 refresh_token 을 받지만 갱신 경로가 구현돼
  있지 않고, 이 통합을 쓰는 노드도 없다 — 서비스 레지스트리의 `supportsTokenAutoRefresh` 는 true 라 `autoRefresh` 가 true 로 나간다(트래커))».

### I. 옛 Rationale «SMTP 연결 테스트를 `verify()` 로 구현» 의 «preview-test 의 "외부 호출 없음" 원칙은 Cafe24 한정» 문장 뒤에 날짜 주석

«(2026-09-19 갱신: 구조 검증만인 서비스는 이제 Cafe24 외에도 MakeShop · Google · GitHub · Webhook 이다 — Cafe24 · MakeShop 은 설계상, 나머지 셋은
구현 범위다. Rationale «연결 테스트 — Database · HTTP 는 실제로 접속한다» 참조.)» — 옛 문장은 지우지 않는다.

### J. §9.4 `INTEGRATION_TEST_FAILED` 행 옆 주석

«연결 테스트가 무엇을 확인하는지는 서비스마다 다르다 — §9.2 표 · §5.x. HTTP 는 `base_url` 이 401 · 403 을 돌려줄 때만 자격증명 거부를 안다(§5.3).»

## 비대상 — 트래커에 올린다 (조사 중 드러난 어긋남)

- rotate 가 테스트 실패를 `INTEGRATION_TEST_FAILED` 로 **400** 을 던지는데 §9.4 는 **422** 라고 적는다.
- SMTP SSRF 가드(`smtp-host-guard.ts` → `ssrf.util.ts`)에 **CGNAT 대역이 없는데** §5.5 는 CGNAT 을 막는다고 적는다. `nodes/core/error-codes.ts`
  주석은 HTTP 가드를 Email 가드의 SoT 라 적지만 실제로는 다른 구현이다.
- §5.3 필드 표의 `none` 인증 · `default_headers` 가 서비스 레지스트리의 `http` 항목에 없다(`test_path` 는 테스트 문장에만 있었다).
- 레지스트리 `supportsTokenAutoRefresh: true` 라 Google 통합의 `autoRefresh` 가 true 로 나가 UI 가 «Auto-renews» 를 보인다 — 갱신 구현이 없다
  (spec 쪽은 이 PR 의 H 가 주석으로 사실을 적는다. 코드는 결정 필요: 갱신 구현 · 플래그 false).
- (교차참조) 같은 엔드포인트 `/api/integrations/:id/test` 의 응답 DTO 는 트래커의 기존 항목 «MCP 전용 응답 필드 3종이 미선언 + 계약 검증자
  미배선» · «`PreviewTestResultDto` 도 `code` 를 미선언» 이 겨눈다. 이 PR 의 구현이 `code` 를 새로 돌려주므로 developer 턴이 그 두 항목을 확인한다.
- Google `account_email` · GitHub `login` 이 레지스트리에서 필수인데, 토큰 응답 본문에서만 뽑는다 — 실제 응답에 없으면 저장이 막힐 수 있다(미확인).
- Google · GitHub · Webhook 테스터 — 그 통합을 쓰는 노드가 생길 때.

## Rationale

- **다섯 중 둘만인 이유(사용자 결정)**: 쓰는 곳이 있는 둘에 피해가 몰린다. 쓰는 곳이 없는 셋에 테스트를 붙여도 확인할 대상이 없고, Google 은 갱신이
  없어 테스트가 곧 거짓 실패가 된다.
- **HTTP 의 4xx 를 성공으로 두는 이유**: `base_url` 은 API 의 뿌리라 404 · 405 가 흔하다. 실패로 두면 맞는 자격증명의 교체가 막힌다. 대신 메시지로
  «확인하지 못했다» 를 분명히 한다. 401 · 403 만 거부로 본다.
- **§5.4 의 소문자 코드**: 세 값은 통합 상태의 `statusReason`(`integration-status-reason.ts`, 소문자 닫힌 값)과 철자가 같다 — 다른 층의 값이다.
  연결 테스트 코드는 §5.5 가 정한 대로 UPPER_SNAKE_CASE `IntegrationTestResult.code` namespace 다.

## 체크리스트

- [x] `--spec` 이 draft — `review/consistency/2026/09/19/13_03_41` **BLOCK: NO** (Critical 0 · WARNING 5 · INFO 7). 반영: WARNING 1(리다이렉트
      미추종) → B 를 노드처럼 5홉 추종으로 · WARNING 2(Google 자동 갱신 자기모순) → C 주석 + H · WARNING 3(«Cafe24 한정» 옛 문장) → G + I ·
      WARNING 4(같은 엔드포인트의 트래커 항목) → 비대상 교차참조 · WARNING 5(`DB_CONNECT_FAILED` ↔ `DB_CONNECTION_ERROR`) → A · F 대비 문장 ·
      INFO 1 → D 괄호 · INFO 2 → F · INFO 3 → J · INFO 4 → A · INFO 5 → G. INFO 6(번들 절단) · 7(원인 칸) 은 조치 불요
- [x] spec 반영 (planner 커밋 `74087dff6`)
- [x] 구현 — `--impl-prep` · 테스터 둘 · 테스트 · 가이드 한 줄 (developer, 같은 PR — `plan/complete/integration-db-http-testers.md`)
- [x] 트래커 등재(위 «비대상» 여섯) · 이 draft `plan/complete/` 로
