# Rationale 연속성 검토 — `spec/2-navigation/` (impl-prep: `integration-db-http-testers`)

대상: `plan/in-progress/integration-db-http-testers.md`(Database·HTTP 연결 테스터 구현 계획) +
그 근거인 `spec/2-navigation/4-integration.md` §5.3/§5.4/§9.2/§9.4/§14.1 · `## Rationale`
"연결 테스트 — Database · HTTP 는 실제로 접속한다"(2026-09-19, 같은 브랜치 커밋 `74087dff6`).

## 발견사항

- **[WARNING]** HTTP 연결 테스터가 SSRF 차단 메시지 일반화 원칙을 명시적으로 계승하지 않음
  - target 위치: `plan/in-progress/integration-db-http-testers.md` §설계 — Database 불릿
    "SSRF → `DB_HOST_BLOCKED`(**메시지 일반화**, 노드와 같은 문구)" vs 바로 아래 HTTP 불릿
    "SSRF → `HTTP_BLOCKED` · `fetch(redirect:'manual')` 로 최대 5홉(홉마다 SSRF, 초과 →
    `HTTP_BLOCKED`)" — HTTP 쪽엔 "메시지 일반화" 문구가 없다.
  - 과거 결정 출처: `spec/4-nodes/4-integration/2-database-query.md` `## Rationale` §"`DB_HOST_BLOCKED`
    전용 SSRF 차단 코드 신설" — "**메시지 일반화**: 클라이언트 노출 메시지는 차단된 host/IP 를
    포함하지 않는다(정찰면 축소)... 동일 원칙을 Send Email(`EMAIL_HOST_BLOCKED`)과 공유하며,
    **HTTP Request(`HTTP_BLOCKED`)도 2026-07-05 동일 일반화 완료**"라고 명시 — 즉 `HTTP_BLOCKED` 도
    이 문서가 세운 것과 **동일한 invariant**를 공유한다고 이미 못박아 두었다. 코드 상으로도
    `http-request.handler.ts` 는 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 가 던지는
    원본 메시지(`SSRF_BLOCKED: hostname "…" resolves to a restricted network range`)를 그대로 쓰지
    않고 `SSRF_BLOCKED_CLIENT_MESSAGE = 'Request blocked by SSRF policy.'` 로 치환하며, 원본은
    `logger.warn` 에만 남긴다(리다이렉트 hop 의 차단도 동일 — 452~460행). `spec/2-navigation/
    4-integration.md` §14.1 vocabulary 표의 `DB_HOST_BLOCKED`/`HTTP_BLOCKED` 두 행도 "노드 `error`
    포트 출력(메시지는 host/IP 미포함 일반화) / 연결 테스트는 `result.code` 반환" 으로 **양쪽을
    같은 문구로** 적어 대칭을 유지하고 있다.
  - 상세: 계획대로라면 새 HTTP 테스터는 노드와 같은 `assertSafeOutboundUrl`/
    `assertSafeOutboundHostResolved` 를 **직접** 재사용한다(plan §설계 "SSRF:
    `http-safety.ts` 의 `assertSafeOutboundUrl` · `assertSafeOutboundHostResolved`"). 이 두
    함수는 차단 사유에 실제 hostname/IP 를 포함한 `Error.message` 를 던진다. 노드 실행 경로는
    이를 잡아 일반화 메시지로 바꾸는 래핑을 거치지만, 계획 문서는 그 래핑을 DB 쪽에는
    명시("메시지 일반화, 노드와 같은 문구")하면서 HTTP 쪽에는 언급하지 않는다. 이 상태로
    구현되면(예: catch 한 `err.message` 를 그대로 `IntegrationTestResult.message` 에 싣는
    구현) 연결 테스트 API(`preview-test`/`:id/test`)를 호출한 인증된 사용자에게 **리다이렉트
    대상의 내부 IP/hostname**이 그대로 노출된다 — 사용자가 통제하는 `base_url` 이 외부
    서버라도 그 서버가 3xx 로 내부 주소(예: 메타데이터 엔드포인트)로 리다이렉트하면, 오늘
    계획대로는 그 내부 주소가 API 응답 메시지에 실릴 위험이 있다. 이는 DB_HOST_BLOCKED
    Rationale 이 "정찰면 축소"를 위해 세운 invariant를 HTTP 쪽에서만 우회하는 결과가 된다.
  - 제안: plan 의 HTTP 테스터 불릿에도 "SSRF → `HTTP_BLOCKED`(메시지 일반화, 노드와 같은
    `SSRF_BLOCKED_CLIENT_MESSAGE` 문구 재사용, 원본은 `logger.warn`)" 를 명시해 DB 쪽과
    대칭을 맞추거나, 만약 연결 테스트 응답은 예외적으로 원본 host 를 노출해도 된다고 판단한다면
    (예: 첫 홉은 사용자가 직접 입력한 host라 신규 정보가 아니라는 논리) 그 예외를 `spec/
    2-navigation/4-integration.md` `## Rationale` 에 **새로 명시**하고 리다이렉트 홉(사용자가
    모르는 대상)에는 그 예외가 적용되지 않음을 구분해 적어야 한다. 침묵 상태로 구현에 들어가면
    "합의된 invariant"가 조용히 갈라지는 결과가 된다.

## 요약

이번 --impl-prep 대상(Database·HTTP 연결 테스터)은 대체로 기존 Rationale 과 잘 정합한다 —
호스트 차단 코드 재사용(`DB_HOST_BLOCKED`/`HTTP_BLOCKED`, `EMAIL_HOST_BLOCKED` 선례), SSRF
플래그 재사용(`ALLOW_PRIVATE_HOST_TARGETS`, 신규 플래그 신설 기각 선례 계승), 카운터 제외
(`consecutive_network_failures`, §5.8/§5.9/§9.2 의 실제 선례 인용 — 지어낸 근거 아님), 테스터가
"던지지 않는다"는 기존 `TransportTester`/`EntityAwareTester` 계약 준수, `modules/integrations` 가
`nodes/*` 의 순수 함수를 직접 import 하는 기존 패턴(`listAllCafe24Operations` 등, 회피 대상은
Nest DI 뿐)과의 일치 등은 모두 실제 이력에 근거해 정확하다. 유일하게 발견된 문제는 SSRF 차단
메시지 일반화라는 명시적·양쪽(DB/HTTP) 공유 invariant를 계획 문서가 DB에만 재확인하고 HTTP에는
언급을 빠뜨린 것으로, 구현 단계에서 그대로 넘어가면 리다이렉트 기반 정찰 방어가 한쪽만
살아있는 비대칭이 생길 수 있다. 400 vs 422(rotate) 등 기존에 알려진 spec-code 불일치는 이미
트래커(`spec-draft-integration-connection-tests.md` "비대상")에 투명하게 등재돼 있어 번복이나
은닉이 아니다.

## 위험도

MEDIUM
