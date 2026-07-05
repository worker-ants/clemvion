# Cross-Spec 일관성 검토 — SSRF 차단 메시지 일반화 (HTTP Request `HTTP_BLOCKED`)

- 검토 모드: 구현 완료 후 검토 (`--impl-done`), diff-base `origin/main`
- 실제 변경 범위 (payload 스코프 `spec/4-nodes/4-integration/` 보다 좁게 실제 재확인함):
  - 코드: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (+ `.spec.ts`)
  - spec: `spec/4-nodes/4-integration/1-http-request.md` (§6 표 갱신, §8.3 신설), `spec/4-nodes/4-integration/2-database-query.md` (Rationale follow-up 문구 갱신), `spec/2-navigation/4-integration.md` (`HTTP_BLOCKED` 행에 일반화 각주 추가)
  - `spec/5-system/2-api-convention.md` 의 diff 는 앵커 링크 오탈자 수정(`#비-페이징-고정-컬렉션은-datitems-유지…` → `…-dataitems-…`)으로 본 변경과 무관 — 검토 대상에서 제외
- 비교 대상: `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query,3-send-email}.md`, `spec/2-navigation/4-integration.md`, `spec/5-system/{3-error-handling,4-execution-engine}.md`, `spec/conventions/chat-channel-adapter.md`, `spec/conventions/error-codes.md`, 그리고 코드 `codebase/backend/src/nodes/integration/{http-request,database-query,send-email,_base}/*`, `codebase/frontend/src/lib/i18n/backend-labels.ts`

## 사전 검토(impl-prep, `review/consistency/2026/07/05/12_55_17/cross_spec.md`)와의 연속성

동일 target 에 대해 구현 착수 전 cross-spec 검토가 이미 수행되어 2건의 WARNING 을 남겼다. 이번 impl-done 검토에서 그 처리 결과를 확인했다:

1. "HTTP 문서에 `HTTP_BLOCKED` 메시지 계약(예시·필드 표·Rationale)이 없다" → **해소됨**. `1-http-request.md` §6 표 갱신 + §8.3 Rationale 신설로 DB(`2-database-query.md` "DB_HOST_BLOCKED 전용 SSRF 차단 코드 신설" Rationale) 수준의 명시 문서화를 갖췄다.
2. "DB 선례가 '원본은 활동 로그에만 남는다'는 약속을 실제로 지키지 않는데 HTTP 가 그대로 미러링하면 같은 갭을 상속한다" → **HTTP 는 상속하지 않고 개선함**. 실제 diff 는 `logger.warn(...)` 을 SSRF catch 경로(preflight + redirect-hop 양쪽)에 추가해 원본 hostname/IP 를 서버 로그에 실제로 남긴다(`http-request.handler.ts` 신규 `logger` 인스턴스, `SSRF block (http-request): ${detail}` / `SSRF block (http-request redirect): ${detail}`). 테스ト도 `warnSpy` 로 이를 검증한다(`http-request.handler.spec.ts` `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('169.254.169.254'))`). 아래 발견사항 1 에서 이 비대칭(HTTP 만 서버 로그 보존, DB/Email 은 여전히 미보존)을 별도로 짚는다 — 이번 target 자체의 결함이 아니라 **DB/Email 이 상대적으로 뒤처진 상태**라는 방향의 문제이므로 INFO 로 격하했다.

## 발견사항

- **[INFO] `logger.warn` 원본 상세 보존이 HTTP 에만 있고 DB/Email 에는 없음 — 3-node "대칭" 서술과 실제 로깅 커버리지의 미묘한 불일치**
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` §8.3 ("원본 상세(hostname/IP)는 `logger.warn`(전 인증 방식 공통, 서버 로그 전용)에만 남긴다")
  - 충돌 대상: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` (SSRF catch, `assertSafeOutboundHostResolved` 실패 시 원본 `Error` 를 버리고 정적 문자열의 `IntegrationError('DB_HOST_BLOCKED', ...)` 로 즉시 교체 — 원본을 캡처하는 `logger.warn`/`logger.debug` 호출이 SSRF 경로에 없음, pool 관련 `logger.warn` 1건은 무관), `send-email.handler.ts` (`EMAIL_HOST_BLOCKED` 도 동일 패턴 — 정적 문자열로 즉시 교체, 원본 캡처 로그 없음)
  - 상세: target 문서(`1-http-request.md §8.3`, `2-database-query.md` Rationale 갱신 문구)는 "메시지 일반화" 자체는 DB/Email/HTTP 3-node 가 **대칭**이라고 정확히 서술하며, "HTTP 는 원본 상세를 `logger.warn`(전 인증 공통)으로도 보존한다" 고 **HTTP 만의 차별점**으로 명시해 DB/Email 이 그렇게 한다고 과잉 주장하지는 않는다 — 문서 자체는 사실과 어긋나지 않는다. 다만 결과적으로 SSRF 차단 시 서버 사이드에 원본 hostname/IP 가 감사 목적으로 남는 노드는 HTTP 뿐이고, DB/Email 은 (이번 PR 범위 밖이라) 여전히 정찰 면 축소와 함께 원본 자체가 완전히 소실되는 상태다. 보안 감사 관점에서 3-node 의 SSRF 차단 telemetry 커버리지가 불균등해졌다.
  - 제안: 필수 조치는 아니나, DB/Email 핸들러의 SSRF catch 블록에도 동일한 `logger.warn(원본 detail)` 패턴을 추가하는 후속 항목을 `plan/` 에 등록할 것을 권고. spec 갱신은 불필요(현재 문서가 이미 정확하게 HTTP 만의 동작으로 한정 서술 중).

- **[INFO] `spec/2-navigation/4-integration.md` `EMAIL_HOST_BLOCKED` 행에는 "(메시지는 host/IP 미포함 일반화)" 각주가 없어 `DB_HOST_BLOCKED`/`HTTP_BLOCKED` 두 행과 비대칭**
  - target 위치: (target 범위 밖 참고) `spec/2-navigation/4-integration.md` 에러 코드 vocabulary 표
  - 충돌 대상: 같은 표의 `DB_HOST_BLOCKED` 행("database_query 노드 `error` 포트 출력 (메시지는 host/IP 미포함 일반화)")과 이번 PR 로 갱신된 `HTTP_BLOCKED` 행("HTTP 노드 `error` 포트 출력 (메시지는 host/IP 미포함 일반화)") — 둘 다 이번 또는 이전 변경으로 각주를 얻었으나 `EMAIL_HOST_BLOCKED` 행("send_email 노드는 `error` 포트 출력 / 연결 테스트는 `result.code` 반환")은 이 각주가 없다.
  - 상세: 실제 코드(`send-email.handler.ts:182` `'SMTP host points to a private/loopback address blocked by policy.'`)는 이미 host/IP 미포함 정적 문구를 사용하므로 동작 자체는 세 노드가 동일하다 — 이는 순수 문서 표기 누락이며 이번 target 변경이 새로 만든 gap 은 아니다(이전부터 존재).
  - 제안: 문서 동기화 차원에서 `EMAIL_HOST_BLOCKED` 행에도 동일 각주 추가 권장. 차단 사유(CRITICAL/WARNING) 아님.

- **[INFO] `1-http-request.md` §6 표와 §8.3 Rationale 의 메시지 문자열이 `2-database-query.md`/`send-email.md` 의 실제 정적 문자열과 문자 그대로 다름 — "통일" 서술이 코드 레벨 literal parity 를 의미하지 않음을 명확히 할 필요**
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` §8.3 "`HTTP_BLOCKED` 의 `output.error.message` 를 host/IP 미노출 일반화 문구(`Request blocked by SSRF policy.`)로 통일한다(DB/Email 대칭)"
  - 충돌 대상: 실제 코드 — HTTP `'Request blocked by SSRF policy.'` (`http-request.handler.ts` `SSRF_BLOCKED_CLIENT_MESSAGE`) vs DB `'Database host resolves to a private/loopback address blocked by SSRF policy.'` (`database-query.handler.ts`) vs Email `'SMTP host points to a private/loopback address blocked by policy.'` (`send-email.handler.ts`) — 세 문자열이 서로 다르다.
  - 상세: "대칭"·"통일"이라는 단어가 세 노드의 **메시지 정책**(host/IP 미노출, 정적 일반화 문구)이 같다는 뜻이지 **동일한 문자열**을 공유한다는 뜻이 아님은 문맥상 읽을 수 있으나, 문서가 "통일한다"로 서술해 문자 그대로의 동일 문자열을 기대하게 할 여지가 있다. 워크플로 저자가 `output.error.message` 문자열 매칭으로 분기하는 경우(권장되지 않지만 가능) 세 노드 간 동작이 다르다.
  - 제안: 실질 위험은 낮음(엔진·chat-channel 분류·프론트 i18n 모두 `error.code` 로만 분기하며 `message` 문자열에 의존하지 않음을 이미 확인함 — 아래 요약 참조). 문서 표현을 "동일 정책(host/IP 미노출 정적 문구)으로 정렬"처럼 정책 레벨임을 명확히 하는 정도의 자구 수정을 고려할 수 있으나 필수는 아님.

## 교차 확인 결과 (충돌 없음 확인)

- `spec/conventions/chat-channel-adapter.md` §3.1 `classifyExecutionFailure` 분류표는 `error.code`(`HTTP_BLOCKED`)만 입력으로 사용하고 `error.message` 는 참조하지 않는다 — 메시지 문자열 변경은 이 분류표에 영향 없음(사전 검토의 INFO 항목이 예상한 대로).
- `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `HTTP_BLOCKED` 지역화 라벨은 `output.error.code` 키로 조회되며 `output.error.message` 를 렌더링에 사용하지 않는다 — UX 손실 없다는 §8.3 서술과 일치.
- `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md` 의 `HTTP_BLOCKED`/`DB_HOST_BLOCKED` 요약 표는 애초에 메시지 내용을 서술하지 않는 인덱스 성격이라 이번 변경으로 새로운 비일관성이 생기지 않는다.
- redirect-hop SSRF 재분류(`HTTP_TRANSPORT_FAILED`/`INTEGRATION_CALL_FAILED` 오분류 → `HTTP_BLOCKED` 정정)는 `1-http-request.md` §4.2/§6 계약과 일치하도록 구현·테스트(`blocks redirect to internal host with HTTP_BLOCKED...`, `blocks redirect chain exceeding 5 hops...`)가 모두 갱신되어 있다. 다른 spec 영역(실행 엔진 §10 Integration Handler 계약, `0-common.md` §4.2 공통 에러 코드)과도 상충하지 않는다.
- `spec/5-system/2-api-convention.md` 의 diff 는 목차 앵커 오탈자 수정으로, 본 SSRF 변경과 무관하며 데이터 모델/API 계약/RBAC/상태 전이 어느 관점에서도 충돌을 유발하지 않는다.

## 요약

이번 target 변경(HTTP Request `HTTP_BLOCKED` 의 `output.error.message` 일반화 + redirect-hop SSRF 오분류 정정)은 사전 impl-prep 검토에서 지적된 두 WARNING 을 모두 해소했으며(문서 계약 신설, 서버 사이드 원본 보존 로직 추가로 DB 의 pre-existing 갭을 그대로 상속하지 않고 개선), `error.code` 기반의 다른 영역(chat-channel 분류, 프론트 i18n, 실행 엔진 계약)과 직접 충돌하는 CRITICAL/WARNING 급 사안은 발견되지 않았다. 다만 (1) HTTP 만 SSRF 차단 원본을 `logger.warn` 으로 서버에 보존하고 DB/Email 은 여전히 원본이 완전히 소실되는 감사-커버리지 비대칭, (2) `2-navigation/4-integration.md` 표에서 `EMAIL_HOST_BLOCKED` 행만 일반화 각주가 누락된 문서 동기화 누락, (3) "통일"·"대칭" 표현이 세 노드의 실제 리터럴 메시지 문자열이 서로 다르다는 사실과 다소 어긋나 보일 수 있는 표현상 모호함 — 세 항목 모두 INFO 로, 즉시 조치가 필요한 결함은 아니다.

## 위험도

LOW — CRITICAL/WARNING 급 cross-spec 충돌 없음. 사전 검토가 지적한 두 WARNING 은 구현으로 해소·개선되었고, 남은 항목은 문서 동기화 권장(INFO) 수준이다.
