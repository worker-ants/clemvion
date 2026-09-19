# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-prep, 연결 테스트 Database·HTTP 구현 착수 전)

검토 대상: `spec/2-navigation/4-integration.md` (특히 §5.3 HTTP · §5.4 Database · §9.2 · §9.4 ·
§14.1 · Rationale "연결 테스트 — Database · HTTP 는 실제로 접속한다…", 2026-09-19 커밋 `74087dff6`).
대조 대상: `spec/4-nodes/4-integration/{1-http-request,2-database-query}.md`, `spec/5-system/11-mcp-client.md`,
`spec/5-system/2-api-convention.md §6`, `spec/1-data-model.md §2.10`, `spec/conventions/error-codes.md`,
`spec/data-flow/1-audit.md`, `spec/5-system/4-execution-engine.md §10`.

## 발견사항

- **[WARNING] `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 문서 3곳에서 서로 다르다 — 이번 PR 이 그대로 e2e 로 굳히려는 지점**
  - target 위치: `spec/2-navigation/4-integration.md` §9.4 — `INTEGRATION_TEST_FAILED (422) — 연결 테스트 실패`
  - 충돌 대상:
    1. `spec/5-system/11-mcp-client.md:539` — "이미 저장된 Integration 의 credential rotate 경로(`POST /api/integrations/:id/test` 후 갱신)는 테스트 실패 시 `INTEGRATION_TEST_FAILED`(**`BadRequestException`, HTTP 400**)를 던진다" — 같은 코드·같은 endpoint(`rotate`)를 **400**으로 명시.
    2. `spec/5-system/2-api-convention.md §6` (HTTP 상태 코드 선택의 SoT) — `400 Bad Request`="잘못된 요청(유효성 검증 실패)", `422 Unprocessable Entity`="비즈니스 로직 오류". "저장된 자격증명으로 재테스트했더니 인증이 거부됐다"는 input validation 이 아니라 정확히 이 표가 422 에 배정한 "비즈니스 로직 오류" 유형이다 — 즉 **cross-cutting 컨벤션은 422 쪽을 지지**하는데, 실제 코드·mcp-client.md 는 400 을 쓴다.
  - 상세: 세 문서가 삼각으로 어긋난다 — (a) 4-integration.md §9.4 = 422, (b) mcp-client.md = 400(실측 기반 서술 — "BadRequestException" 이라는 구체적 구현 타입까지 적혀 있어 코드를 보고 쓴 문장으로 읽힌다), (c) api-convention.md §6 의 일반 원칙 = 422 가 의미상 맞음. `plan/in-progress/integration-db-http-testers.md` 는 "rotate 가 틀린 비밀번호를 거부(400 `INTEGRATION_TEST_FAILED`, spec 은 422 — 트래커)"라고 이미 이 gap 을 알고 있고, e2e 테스트를 **400 을 기대값으로** 작성할 계획이다. 이전 라운드 컨시스턴시 체크(`review/consistency/2026/09/19/13_03_41`)의 draft 노트에도 이 400/422 불일치가 있었지만 어느 리포트도 mcp-client.md 쪽 근거(같은 코드가 이미 다른 서비스에서 400 으로 확정 서술돼 있다는 점)를 인용하지 않았다 — 즉 "언젠가 고칠 트래커 항목"으로만 남아 있었고, 그 트래커 항목이 실은 api-convention.md 의 일반 원칙과도 어긋난다는 사실은 아직 어디에도 적혀 있지 않다.
  - 왜 지금 문제인가: 이번 PR 이 Database·HTTP rotate 실패 경로(`DB_AUTH_FAILED`/`HTTP_AUTH_FAILED` 등)를 처음으로 **같은 `rotate` → `INTEGRATION_TEST_FAILED` 예외 경로**에 태우고, 그 위에 400 을 기대하는 e2e 를 새로 추가한다. 이는 400 을 "코드가 아직 못 따라간 값"에서 "e2e 로 고정된 계약"으로 승격시켜, 이후 §9.4 를 422 로 바로잡는 비용을 키운다(e2e 회귀 발생).
  - 제안: 이번 PR 범위에서 결정을 내리지 않더라도 최소한 (1) `plan/in-progress/integration-db-http-testers.md` 의 트래커 언급에 `spec/5-system/11-mcp-client.md:539` 와 `spec/5-system/2-api-convention.md §6` 두 근거를 함께 적어 "그냥 코드가 안 따라간 것"이 아니라 "spec 3곳이 서로 다르다"는 사실을 명시하고, (2) `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 `INTEGRATION_TEST_FAILED`(400, `4-integration.md`/`api-convention.md` 는 422 로 서술) 행을 추가해 이번 PR 의 e2e 가 그 값을 고정하는 근거로 삼거나, (3) 이 참에 `preview-test`/`:id/test`(200+success:false) 와 마찬가지로 rotate 도 예외를 던지지 않는 방향으로 통일해 400/422 논쟁 자체를 없애는 안을 검토(§5.6 MCP·§5.5 Email·이번 §5.3/§5.4 는 모두 200+result shape 이며, rotate 만 예외를 던지는 것 자체가 인접 코드 경로와 비대칭이다 — Rationale "연결 테스트 endpoint 의 `pending_install` 가드" 가 이미 `:id/test` 에 대해 같은 논지로 예외를 기각했다).

- **[INFO] §6 "상태 전이" 표 아래 캐비엇의 `§9.3` 참조가 실제로는 `§9.2` 를 가리킨다**
  - target 위치: `spec/2-navigation/4-integration.md:742` — "(연결 테스트 endpoint 는 별도로 `INTEGRATION_INCOMPLETE` 반환 — §9.3.)"
  - 충돌 대상: 같은 파일 §9.2 (`POST /api/integrations/:id/test` 행, line 814) — `INTEGRATION_INCOMPLETE` pending_install 가드가 실제로 서술된 자리. §9.3 은 "사용처·활동"(usages/activity) 절로 이 가드와 무관.
  - 상세: 이번 커밋이 만든 문장은 아니지만(사전 존재), 같은 `--impl-prep` 스코프 안에서 개발자가 §5.4/§5.3 Database·HTTP 연결 테스트를 구현하며 pending_install 가드·`INTEGRATION_INCOMPLETE` 분기를 함께 다룰 가능성이 있어 잘못된 절 번호가 탐색 비용을 늘린다.
  - 제안: `§9.3` → `§9.2` 로 정정 (사소한 문서 정합성이라 이번 PR 필수는 아니나 손대는 김에 한 줄 수정 권고).

- **[INFO] 신규 5개 연결 테스트 코드는 grep 0건으로 재확인됨 — 이전 라운드 우려는 해소**
  - target 위치: §14.1 에러 코드 vocabulary — `DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_AUTH_FAILED`/`HTTP_CONNECT_FAILED`/`HTTP_SERVER_ERROR`
  - 상세: `spec/` 전체 grep 재확인 결과 이 5개 문자열은 `spec/2-navigation/4-integration.md` 바깥에 전혀 나타나지 않는다 — 노드 런타임 `DB_CONNECTION_ERROR`/`HTTP_5XX`/`HTTP_TRANSPORT_FAILED` 와 이름은 근접하지만 값 자체는 충돌하지 않으며, 문서가 "노드 런타임 ErrorCode enum 과 별개 namespace"임을 매 행 명시한다. `status_reason` 컬럼(소문자 `auth_failed`/`network`/`unknown_error`, `spec/1-data-model.md:315`)과의 이전 CRITICAL(entity-column-declaration-drift, `review/consistency/2026/09/19/10_58_34`)도 UPPER_SNAKE_CASE 로 전환되며 해소됐다. 새 결함 없음 — 참고용 기록.
  - 제안: 없음 (확인용 INFO).

## 요약

이번 target(§5.3 HTTP·§5.4 Database 연결 테스트 실장 및 §14.1 에러 코드 vocabulary 확장)은 SSRF 가드 재사용(`ALLOW_PRIVATE_HOST_TARGETS`)·redirect 추종 범위(`authentication='integration'` 모드 전용과 일치)·에러 코드 네임스페이스 분리(node runtime vs `IntegrationTestResult.code`)·`status_reason` 컬럼과의 철자 충돌 해소 등 다른 spec 영역(HTTP Request·Database Query 노드, 데이터 모델)과 정합적이며, 직전 라운드(`13_03_41`)에서 지적된 WARNING 들도 모두 반영된 상태다. 다만 §9.4 의 `INTEGRATION_TEST_FAILED (422)` 는 `spec/5-system/11-mcp-client.md` 가 명시하는 실제 rotate 동작(400, `BadRequestException`)및 `spec/5-system/2-api-convention.md §6` 의 HTTP 상태 코드 일반 원칙(422=비즈니스 로직 오류) 사이에서 세 방향으로 어긋나 있고, 이번 PR 이 그 정확한 경로(Database·HTTP rotate 실패)를 처음으로 e2e 로 굳히려 한다는 점에서 우선순위 결정이 필요하다. 이 외에 발견된 것은 사전 존재하는 사소한 절 번호 오기재(INFO) 뿐이다.

## 위험도

MEDIUM
