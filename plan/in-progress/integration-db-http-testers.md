---
title: 통합 연결 테스트 — Database · HTTP 테스터 구현
status: in-progress
owner: developer
worktree: integration-testers-5c2d91
started: 2026-09-19
spec_impact: none
---

# Database · HTTP 연결 테스터

spec 은 같은 브랜치의 planner 커밋 `74087dff6`(`spec/2-navigation/4-integration.md` §5.3 · §5.4 · §14.1, 근거
`plan/in-progress/spec-draft-integration-connection-tests.md`)이 정했다. 이 plan 은 그 구현이다.

## 현재 (main `53335867a`)

`IntegrationsService.dispatchTest` = ① `validateCredentials` ② `transportTesters.get(serviceType)` — `mcp` · `email` 만. `database` · `http` 는
①만 통과하면 `{ success: true, message: 'Connection successful' }`. rotate(`rotate()`)는 이 결과가 실패일 때만 막으므로 틀린 자격증명이 교체된다.

## 설계

- **등록 위치**: `transportTesters` 맵에 `database` · `http` 를 `email` 과 나란히 둔다. preview-test(저장 전) · `:id/test` · rotate 세 경로가 모두
  `dispatchTest` 를 지나므로 한 곳에서 셋이 같이 고쳐진다.
- **공유 로직은 노드에서 의존성 없는 모듈로 꺼낸다** — 핸들러 둘(과 `IntegrationError` 가 있는 `integration-handler-base.ts`)은
  `IntegrationsService` 를 import 한다. 통합 서비스가 핸들러를 가져오면 **순환 import** 가 되므로, 핸들러와 테스터가 함께 쓰는 것만 새 모듈로 옮긴다:
  - `nodes/integration/database-query/database-connection.ts` — `DbCredentials` · `buildPgConnection` · `buildMysqlSsl` · `DB_HOST_BLOCKED_MESSAGE`
    (노드의 일반화 문구 그대로). 핸들러는 여기서 가져온다.
  - `nodes/integration/http-request/http-credentials.ts` — `resolveHttpCredentials`(예외 대신 `{ ok: false, code, message }` 를 돌려준다).
    핸들러의 `buildHttpCredentials` 는 그 결과를 `IntegrationError` 로 바꾸는 얇은 래퍼로 남는다.
  - `http-safety.ts` 로 `SSRF_BLOCKED_CLIENT_MESSAGE` 를 옮긴다(노드 · 테스터 공용 일반화 문구, `--impl-prep` `13_21_00` WARNING 2).
  - `modules/integrations/clamp-message.ts` — `clampMessage` 를 서비스 파일에서 꺼낸다(서비스 · 테스터 공용).
- **테스터 본체**: `modules/integrations/database-connection-tester.ts` · `http-connection-tester.ts`(순수 async 함수, `IntegrationTestResult`
  반환, 던지지 않는다. `IntegrationTestResult` 는 type-only import 라 런타임 순환이 없다).
  - Database: SSRF → `DB_HOST_BLOCKED`(메시지 일반화, 노드와 같은 문구) · pg `Client`(`connectionTimeoutMillis` · `query_timeout` 각 10초) / mysql2
    `createConnection`(`connectTimeout` 10초, `SELECT 1` 도 `timeout` 10초) → `SELECT 1` → 반드시 닫는다 — 연결만 제한하면 인증 뒤 멈춘 서버에
    쿼리가 매달린다 · 인증(PG `code` 가 `28` 로 시작 · MySQL `ER_ACCESS_DENIED_ERROR` ·
    `ER_DBACCESS_DENIED_ERROR`) → `DB_AUTH_FAILED` · 그 밖 → `DB_CONNECT_FAILED` · 메시지는 `clampMessage`.
  - HTTP: `base_url` 없으면 호출 없이 성공+안내 · 형식이 틀린 `base_url` 은 `HTTP_CONNECT_FAILED`(«유효한 URL 아님» — SSRF 차단 문구로 오인시키지
    않는다) · URL 에 query 자격증명 · SSRF → `HTTP_BLOCKED`(메시지는 `SSRF_BLOCKED_CLIENT_MESSAGE`, 원문은
    `logger.warn` 에만 — 리다이렉트 홉의 내부 host 도 응답에 싣지 않는다) · `fetch(redirect: 'manual')` 로 최대 5홉(홉마다
    SSRF, 초과 → `HTTP_BLOCKED`) · 10초 `AbortSignal` · 본문은 읽지 않고 취소 · 상태 매핑(spec §5.3).

## 테스트

- unit: 두 테스터의 분기 전부(성공 · 차단 · 인증 · 연결 실패 · 타임아웃 · 4xx 안내 · 5xx · 리다이렉트 추종/초과/리다이렉트 대상 차단 · base_url
  없음 · 연결을 반드시 닫음). `dispatchTest` 가 두 service_type 에 테스터를 쓴다는 것.
- e2e: e2e 환경은 `ALLOW_PRIVATE_HOST_TARGETS` 를 켜지 않는다(`docker-compose.e2e.yml`) — 그래서 실제 접속 · 인증 분기는 unit 이 보고, e2e 는
  **배선**을 본다: preview-test · `:id/test` 가 사설 host(`postgres` 서비스 · `127.0.0.1`)의 Database · HTTP 통합에 `success:false` +
  `DB_HOST_BLOCKED` · `HTTP_BLOCKED` 를 돌려준다(main 에서는 «Connection successful» — RED). rotate 도 같은 입력을 거부한다 — 단 **상태 코드는
  단언하지 않는다**(코드 400 · spec §9.4 422 · `5-system/11-mcp-client.md` 400 이 어긋나 있어 트래커에서 정한다, `--impl-prep` `13_21_00` WARNING 1).

## 실측 — 뮤턴트 (2026-09-19, 커밋 `9e91352d8` 기준, 예측을 먼저 적고 실행)

| 대상 | 뮤턴트 수 | 예측 | 실측 |
|---|---|---|---|
| `database-connection-tester.ts` | 10 (인증 판별식 · MySQL 코드 하나 빼기 · 드라이버 분기 반전 · 닫기 둘 제거 · 쿼리 대기 둘 제거 · SSRF 건너뛰기 · 기본 드라이버 · clamp 제거) | 전부 RED | 전부 RED |
| `http-connection-tester.ts` | 14 (403 · 5xx 경계 · 4xx 안내 · 홉 상한 off-by-one · 리다이렉트 SSRF 제거 · `follow` · 헤더 병합 순서 · 상대 Location · 타임아웃 분기 · 빈 base_url · URL 형식 · Location 없는 3xx · DNS 가드 제거 · query 빈 객체 검사 약화) | 13 RED · 1 GREEN | 13 RED · 1 GREEN |
| `integrations.service.ts` 배선 · `PreviewTestResultDto.code` | 3 | 전부 RED | 전부 RED |

생존 1 = «query 빈 객체 검사 약화»(`!query || keys.length === 0` → `!query`) — 빈 객체면 `new URL(base).toString()` 을 거쳐 **URL 정규화만** 달라진다
(경로 없는 base_url 에 `/` 가 붙는다). 같은 자원을 가리키므로 동치 뮤턴트다. 원복은 원본 바이트 되쓰기(`git checkout` 아님), 매 뮤턴트 뒤 바이트 일치 단언.

## 기존 e2e 에 준 영향

`integration-cache-invalidate.e2e-spec.ts` A(회전 뒤 broadcast)는 `base_url: https://api.example.com` 인 HTTP 통합을 회전한다 — 이제 rotate 가
그 주소로 실제 `GET` 을 보낸다. DNS 가 안 풀리면 가드는 통과시키고(fail-open) fetch 가 실패해 `HTTP_CONNECT_FAILED` → rotate 거부 → **RED**.
테스트 대상은 broadcast 라 fixture 에서 `base_url` 을 뺐다(테스터가 호출하지 않는다). 다른 e2e 중 `:id/test` · `preview-test` · rotate 를
부르는 것은 없다(backend `test/` · frontend `e2e/` grep).

## e2e 첫 실행 RED — 내 술어가 틀렸다

새 파일의 D(rotate 거부 뒤 교체 안 됨)가 `last_rotated_at` 이 null 이 아니라서 RED 였다. rotate 는 `INTEGRATION_TEST_FAILED` 로 **제대로 거부됐다**
(같은 테스트의 코드 단언은 통과) — **생성**(`create()`)이 `lastRotatedAt` 을 채우기 때문이다. «null» 은 회전 여부를 가르지 못하는 술어였다.
«회전 전과 같다»(`last_rotated_at` + 암호문 — 저장마다 `randomBytes` IV 라 저장이 있으면 암호문이 바뀐다)로 바꿨다. A · B · C 는 첫 실행에서
통과했다 — 사설 host(`postgres` 서비스) · loopback 이 실제 컨테이너에서 가드에 막힌다.

## 체크리스트

- [x] `--impl-prep spec/2-navigation/` — `review/consistency/2026/09/19/13_21_00` **BLOCK: NO** (Critical 0 · WARNING 3 · INFO 8). WARNING 1(400 ·
      422 불일치를 e2e 로 굳히지 말 것) → 상태 코드 미단언 + 트래커 · WARNING 2(SSRF 메시지 일반화) → 설계 · WARNING 3(DTO `code`) → 체크리스트.
      INFO 7(파일명) → 설계. INFO 1 · 6(§6 의 `§9.3` 오기 · `HTTP_{status}` 표기)은 spec 이라 트래커
- [x] 테스트 선작성 → 구현 — 테스터 spec 두 개(42) RED → GREEN, `dispatchTest` 배선 5건(preview · `:id/test` · rotate)
- [x] `PreviewTestResultDto.code?` 선언 + preview 실패 경로 계약 검증 배선(트래커 «`PreviewTestResultDto` 도 `code` 를 미선언» 을 닫는다)
- [x] 가이드 한 줄(연동 관리 — 서비스별 연결 테스트 범위) — `0aec343e4`, user-guide-writer 위임 뒤 «운영자가 허용한 설치는 예외» 로 한 구절 좁힘 · frontmatter `code:` 에 테스터 둘
- [x] TEST WORKFLOW (lint · unit · build · e2e) + 백엔드 타입체크 ratchet — lint PASS · unit PASS(backend 9,803 · frontend 6,597 외) ·
      build PASS(ratchet 포함) · e2e PASS(backend 352 · Playwright 51, 커밋 `00e244de6` 기준. 첫 실행의 D RED 는 위 «내 술어가 틀렸다»)
- [ ] `/ai-review`
- [ ] `--impl-done spec/2-navigation/`
- [ ] 트래커 반영(«비대상» 여섯 등재) · 이 plan 과 spec draft **둘**(`spec-draft-integration-connection-tests.md` · `spec-draft-integration-db-test-waits.md`) `complete/` 이동
