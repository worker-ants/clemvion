# 요구사항(Requirement) Review — SSRF 차단 메시지 일반화 (HTTP Request)

## 발견사항

- **[INFO]** DB 선례("차단 상세는 활동 로그에만 남긴다")가 실제로는 지켜지지 않는 pre-existing 갭 — 이번 PR 이 spec 에 "HTTP=DB 대칭 완료" 를 서술하며 그 비대칭을 은연중 고착화
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:222-230` (SSRF catch, `catch { throw new IntegrationError('DB_HOST_BLOCKED', '<static message>') }`) 및 `spec/4-nodes/4-integration/2-database-query.md:1127-1130` (금번 갱신된 Rationale 문구)
  - 상세: HTTP 는 이번 변경으로 `logger.warn` 에 원본 hostname/IP 를 실제로 남긴다(코드 확인·테스트 로그로 검증 완료 — `SSRF block (http-request): SSRF_BLOCKED: hostname "169.254.169.254" ...`). 반면 DB Query 의 catch 블록은 caught error 를 완전히 버리고 정적 문자열로 재-throw 하므로, 그 뒤 `logUsage`(`toLogError(err)`) 가 로깅하는 `err` 는 이미 일반화된 `IntegrationError`다 — 원본 host/IP 는 DB 어디에도 남지 않는다. 그런데 이번 PR 이 갱신한 `2-database-query.md` Rationale 은 "HTTP 는 원본 상세를 `logger.warn`... 으로도 보존한다"는 문장으로 대칭을 서술할 뿐, DB 자신의 comment(`handler.ts:220-221` "원본 상세는 logUsage 의 toLogError 로 서버 로그에만 남는다")가 실제로는 거짓이라는 점은 여전히 미수정·미문서화 상태다.
  - 이 갭은 이번 diff(`http-request.handler.ts`/`.spec.ts`)가 만든 신규 결함이 아니고, consistency-check 단계(`cross_spec.md`)에서 이미 pre-existing gap 으로 식별·SUMMARY 항목 4("검토")로 스코프 아웃된 사안이라 CRITICAL 로 격상하지 않는다. 다만 spec 문구가 "이제 대칭이다"라고 확정 서술하는 순간 이 잔여 비대칭이 문서에서 숨겨지는 부작용이 있다.
  - 제안: 후속 작업(project-planner 트랙)에서 DB Query catch 블록도 원본 caught error 를 `logger.warn`(또는 동등 sink)으로 먼저 남기도록 정합화하거나, `2-database-query.md` 의 "원본은 서버 로그에 남는다" 서술을 실제 동작에 맞게 정정할 것. 이번 PR 스코프는 아니므로 코드 변경 요구는 아님.

## 코드-spec 일치 확인 (양호)

- `spec/4-nodes/4-integration/1-http-request.md` §8.3 신설 내용(일반화 문구 `Request blocked by SSRF policy.`, 원본은 `logger.warn`+Usage 로그, redirect 대상/한도초과 SSRF 도 `HTTP_BLOCKED` 라우팅)과 `http-request.handler.ts` 구현이 line-level 로 정확히 일치한다.
  - `SSRF_BLOCKED_CLIENT_MESSAGE = 'Request blocked by SSRF policy.'` (line 34) — spec §8.3 문구와 동일.
  - Preflight catch(line 358-390): `logger.warn` 으로 원본 보존 → Usage 로그(integration 한정, code=`HTTP_BLOCKED`, message=원본 detail) → client output 은 `SSRF_BLOCKED_CLIENT_MESSAGE`. spec §4.2 Usage 매트릭스·§8.3 과 일치.
  - Redirect 한도 초과(hops>=5, line 429-437)·redirect 대상 재검증 실패(line 447-457) 모두 `IntegrationError(HTTP_BLOCKED, SSRF_BLOCKED_CLIENT_MESSAGE)` throw → 별도 `if (err instanceof IntegrationError)` 분기(line 531-550)로 승격 보존 → `buildPreflightErrorOutput` 이 `err.code`/`err.message` 그대로 사용. 종전 WARNING(redirect-hop SSRF 가 `HTTP_TRANSPORT_FAILED` 로 오분류)이 이 PR 로 해소됨 — spec §4.2/§6·2-navigation 표 갱신과 코드가 일치.
  - `spec/2-navigation/4-integration.md` `HTTP_BLOCKED` 행 각주("메시지는 host/IP 미포함 일반화", "redirect 대상·한도 초과 SSRF 포함") — 코드와 일치.
- 신규 테스트(`blocks redirect to internal host with HTTP_BLOCKED + generalized message`)가 302→내부 IMDS 리다이렉트 시나리오에서 `port==='error'`, `code==='HTTP_BLOCKED'`, message 일반화, `169.254` 미노출을 모두 단언 — 실제 `npx jest` 실행 결과 73/73 통과, 로그 확인으로 `logger.warn` 원본 보존도 런타임 검증됨.
- 정찰 면 축소 목적(CWE-209) 달성: `output.error.message` 에서 차단 host/IP 완전 배제. 4개 기존 message 단언 + 신규 `not.toContain('169.254')` 단언 모두 정확.
- 에러 시나리오: preflight SSRF·redirect 재검증 SSRF·redirect 한도초과 SSRF 세 경로 모두 동일 `HTTP_BLOCKED`+생성화 message 로 수렴 — 코드 분기 누락 없음.
- 반환값: 모든 catch 경로(`IntegrationError` 분기 포함)가 `NodeHandlerOutput` 5필드 계약을 만족하며 빠짐없이 반환.
- TODO/FIXME/HACK/XXX 주석 없음.
- consistency-check(SUMMARY/cross_spec/convention_compliance 등)가 --impl-prep 단계에서 지적한 두 WARNING(HTTP만 raw host 노출 비대칭, redirect-hop 오분류)은 본 구현으로 모두 해소됐고, 그 해소가 같은 PR 내 spec 갱신(§8.3, 2-navigation 각주, DB Rationale cross-reference)에도 반영돼 spec-코드 정합이 유지된다.

## 요약

이번 변경은 HTTP Request 노드의 `HTTP_BLOCKED` 클라이언트 메시지를 DB Query(`DB_HOST_BLOCKED`)·Send Email(`EMAIL_HOST_BLOCKED`)과 대칭인 host/IP 미노출 일반화 문구로 통일하고, redirect-hop SSRF 차단을 `HTTP_TRANSPORT_FAILED` 오분류에서 `HTTP_BLOCKED` 정분류로 정정했다. 코드·테스트·spec(`1-http-request.md` §8.3, `2-navigation/4-integration.md`, `2-database-query.md` Rationale)이 모두 같은 PR 안에서 상호 일치하게 갱신되었으며, 사전 consistency-check 가 지적한 두 WARNING(3-node 비대칭, redirect 오분류)이 실제로 해소됐음을 코드 리딩과 테스트 실행(73/73 통과, `logger.warn` 원본 보존 런타임 확인)으로 검증했다. 유일한 잔여 사항은 DB Query 의 "원본은 서버 로그에 남는다"는 pre-existing 미이행 약속으로, 이번 diff 의 결함은 아니나 새로 갱신된 spec 문구가 그 미이행을 부각하지 않고 넘어간다는 점이다 — 별도 후속 트랙(INFO)으로 남긴다.

## 위험도

LOW
