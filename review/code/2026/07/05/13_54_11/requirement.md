# 요구사항(Requirement) Review — SSRF 차단 메시지 일반화 (HTTP Request) — 통합 재검토

본 세션(`13_54_11`)의 changeset 은 실질적으로 두 그룹으로 구성된다:

1. **실 코드 변경**: `http-request.handler.ts` / `http-request.handler.spec.ts` — SSRF 차단 시
   `output.error.message` 를 host/IP 미노출 일반화 문구(`Request blocked by SSRF policy.`)로
   치환하고, redirect-hop/redirect-limit SSRF 차단도 `HTTP_BLOCKED` 로 통일 라우팅. 직전 리뷰
   라운드(`13_32_17`)의 WARNING#1(logUsage 원본 노출)을 해소한 후속 커밋(`d12ef7594`)까지 반영된
   최종 상태.
2. **산출물/문서 diff**: 직전 리뷰 세션(`13_32_17`)의 SUMMARY/RESOLUTION/각 리뷰어 output,
   그리고 그 이전 consistency-check(`12_55_17`) 산출물, spec 문서(`1-http-request.md` §8.3 신설,
   `2-navigation/4-integration.md`, `2-database-query.md` Rationale, `2-api-convention.md` 앵커
   오타) — 모두 이미 정합화가 완료된 상태로 diff 에 포함.

아래는 코드(그룹 1)를 spec 및 테스트와 line-level 로 재검증한 결과다.

## 코드-spec 일치 확인 (양호)

- `spec/4-nodes/4-integration/1-http-request.md` §8.3(신설)이 규정하는 계약과 구현이 정확히 일치한다.
  - 일반화 문구: spec `Request blocked by SSRF policy.` == 코드 `SSRF_BLOCKED_CLIENT_MESSAGE`
    (`http-request.handler.ts:34`).
  - "원본 상세는 `logger.warn`(서버 로그 전용)에만, Usage 로그도 일반화" — preflight catch
    (`:358-390`)에서 `logger.warn(`SSRF block (http-request): ${detail}`)` 로 원본 보존 후
    `logUsage` 에는 `SSRF_BLOCKED_CLIENT_MESSAGE` 만 기록(`:372-380`). 이는 직전 리뷰
    (`13_32_17` SUMMARY WARNING#1)가 지적한 "Usage 로그에 원본이 실려 Activity API 로 노출"
    문제를 실제로 해소한 상태이며, JSDoc(`:27-33`)도 "usage 로그에도 이 일반화 문구를 기록한다"로
    정확히 갱신되어 spec §8.3 문구와 완전히 합치한다 (더 이상 문서-구현 불일치 없음).
  - redirect 대상 재검증 실패(`:447-459`)·redirect 5-hop 초과(`:429-441`) 모두
    `IntegrationError(ErrorCode.HTTP_BLOCKED, SSRF_BLOCKED_CLIENT_MESSAGE)` throw →
    바깥 catch(`:531-550`)의 `err instanceof IntegrationError` 분기로 code/message 보존
    → `buildPreflightErrorOutput` 경유 반환. spec §4.2/§6 계약("redirect 한도·대상 SSRF =
    HTTP_BLOCKED")과 일치하며, 종전 오분류(`HTTP_TRANSPORT_FAILED`)가 해소됨.
  - `spec/2-navigation/4-integration.md` `HTTP_BLOCKED` 행 각주("메시지는 host/IP 미포함
    일반화", "redirect 대상·한도 초과 SSRF 포함")도 구현과 일치.
- 신규 테스트 2건(redirect-to-internal-host, redirect-5-hop-exceeded)이 각각 302→내부 IMDS,
  5회 연속 302 시나리오에서 `port==='error'`, `code==='HTTP_BLOCKED'`, message 일반화,
  `not.toContain('169.254')`, `Logger.prototype.warn` spy 로 원본 host/IP 서버 로그 보존,
  redirect-hop `logUsage` 도 일반화 메시지임을 모두 단언한다 — 실행 결과 74/74 통과 확인
  (`npx jest http-request.handler.spec.ts`, 로그 상 `logger.warn` 원본 hostname 실제 출력
  확인).
- 정찰 면 축소 목적(CWE-209) 달성: `output.error.message` 어디에도 차단 host/IP 가 노출되지
  않음을 6곳(기존 4 + 신규 2)의 단언이 커버.
- 에러 시나리오: preflight SSRF·redirect 재검증 SSRF·redirect 한도초과 SSRF 세 경로 모두
  동일 `HTTP_BLOCKED` + 일반화 message 로 수렴 — 분기 누락 없음.
- 반환값: `IntegrationError` 승격 분기를 포함해 모든 catch 경로가 `NodeHandlerOutput`
  5필드(config/output/meta/port + error) 계약을 만족하며 빠짐없이 반환.
- TODO/FIXME/HACK/XXX 주석 없음.
- 엣지 케이스: hop count 정확히 5(한도 이내 정상 통과, 기존 테스트) vs 5(한도 도달,
  신규 테스트 `mockResolvedValue`로 무한 302 시뮬레이션 후 5회째에서 차단) 경계값이
  구현(`if (hops >= 5)`)과 정확히 일치. redirect 응답에 `location` 헤더가 없는 경우
  while 조건(`res.headers.get('location')`)이 false 가 되어 루프 탈출 — 기존 로직 무변경.

## 발견사항

- **[INFO]** DB Query 핸들러의 "원본은 서버 로그에 남는다" 주석/spec 서술이 실제로는 지켜지지
  않는 pre-existing 갭 — 본 diff 의 결함 아님, 재확인만
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:222-229`
    (`catch { throw new IntegrationError('DB_HOST_BLOCKED', <static message>) }` — caught error
    를 바인딩 없이 완전히 버림), `spec/4-nodes/4-integration/2-database-query.md:1132-1138`
  - 상세: DB catch 블록은 원본 `err` 를 폐기하고 정적 문자열로만 재throw 하므로, 그 이후
    `logUsage`(`toLogError`)가 남기는 것도 이미 일반화된 `IntegrationError` 뿐이다 — 원본
    hostname/IP 는 DB 쪽 어디에도 남지 않는다. 반면 HTTP 는 이번 diff 로 `logger.warn` 에
    실제 원본을 남긴다(런타임 로그로 확인). `2-database-query.md` 갱신 Rationale 은 "HTTP 도
    2026-07-05 동일 일반화 완료 — HTTP 는 원본 상세를 logger.warn 으로도 보존한다"고만 서술해
    HTTP/DB 비대칭 자체는 정확히 반영했으나, DB 자신의 "원본은 logUsage 서버 로그에 남는다"는
    구식 주장은 그대로 남아 있다. 직전 리뷰(`13_32_17/requirement.md`)에서 이미 동일하게
    INFO 로 식별·스코프아웃된 사안이며 이번 diff 가 새로 만든 결함이 아니다.
  - 제안: 이번 PR 스코프 아님. 후속 트랙(`http-ssrf-all-auth-followups` 또는 신규 plan,
    RESOLUTION.md 에 이미 동일하게 기록됨)에서 DB catch 에 `logger.warn` 원본 보존을
    추가하거나 spec 문구를 실제 동작에 맞게 정정.

- **[INFO]** redirect 5-hop 한도초과 시 `logger.warn` 태그가 preflight 와 동일한 접두어를
  재사용해 redirect 재검증 케이스(`redirect`)와 다르게 표기됨 — 사소한 로그 가독성 이슈
  - 위치: `http-request.handler.ts:432-434`
    (`` logger.warn('SSRF block (http-request): redirect chain exceeded 5 hops') ``, redirect
    재검증 케이스는 `:452`에서 `` `SSRF block (http-request redirect): ${detail}` `` 로 접두어가
    다름)
  - 상세: 기능·spec 정합에는 영향 없음(순수 로그 문자열). maintainability 리뷰(`13_32_17`)에서
    이미 동일하게 INFO 로 지적됨 — requirement 관점에서도 중복 확인.
  - 제안: 필수 아님. 태그를 `SSRF block (http-request redirect-limit)` 등으로 통일하면
    서버 로그만으로 preflight/redirect-limit/redirect-target 세 경로를 구분하기 쉬워진다.

- **[INFO]** redirect-following 자체가 `authentication === 'integration'` 에만 적용되는
  기존 게이트(본 diff 무관, 사전 존재)
  - 위치: `http-request.handler.ts:429` (`while (authentication === 'integration' && ...)`)
  - 상세: `none`/`custom` 인증은 애초에 redirect 를 따라가지 않으므로 redirect-hop SSRF
    재검증 로직도 적용되지 않는다. 신규 테스트 2건 모두 `authentication: 'integration'` 을
    사용해 이 경로를 정확히 커버하고 있어 테스트 갭은 없다. 이 게이트는 이번 diff 가 만든
    것이 아니라 기존 로직 그대로이므로 spec 불일치 여부는 이번 changeset 리뷰 범위 밖이다.
  - 제안: 조치 불필요 (정보 제공 목적).

## 요약

이번 changeset 은 직전 리뷰 라운드(`13_32_17`)에서 발견된 WARNING(#1: SSRF 차단 원본
host/IP 가 `logUsage`→Activity API 경유로 workspace 사용자에게 노출)을 해소한 후속 커밋과
그 결과물(RESOLUTION/SUMMARY 등 리뷰 산출물, spec §8.3 갱신)을 함께 담고 있다. 코드
(`http-request.handler.ts`)를 spec(`1-http-request.md` §8.3, `2-navigation/4-integration.md`)과
line-level 로 대조한 결과 완전히 일치하며, 직전 라운드에서 지적된 코드-JSDoc-spec 3중 불일치도
모두 "Usage 로그도 일반화, 원본은 logger.warn 서버 로그 전용"으로 정합화되어 더 이상 남아있지
않다. 신규 테스트 2건(redirect 대상 SSRF, redirect 5-hop 초과)이 새 동작을 정확히 커버하고
74/74 전체 통과를 재확인했다. 유일한 잔여 사항은 DB Query 핸들러의 pre-existing 비대칭
(원본 로그 미보존)으로, 이번 diff 의 결함이 아니고 이미 RESOLUTION.md 에도 별도 후속 트랙으로
명시되어 있다. requirement 관점에서 기능 완전성·에러 시나리오·반환값·spec fidelity 모두 양호.

## 위험도

LOW
