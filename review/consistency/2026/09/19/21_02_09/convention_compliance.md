# 정식 규약 준수 검토 — `spec/4-nodes/4-integration/`

검토 모드: `--impl-prep` (착수 대상: `plan/in-progress/ssrf-guard-integration-unify.md`, `spec_impact: none` — 코드만 spec 에 맞춘다).
대상: `0-common.md` · `1-http-request.md` · `2-database-query.md` · `3-send-email.md` · `4-cafe24.md` · `5-makeshop.md` · `_product-overview.md`.
대조 규약: `spec/conventions/node-output.md` · `error-codes.md` · `egress-masking.md` (조립 프롬프트에서 컨텍스트 예산 초과로 절단됐기에, 세 파일 모두 워크트리에서 직접 `Read` 하여 원문 대조함 — 이 사실 자체는 기존에 알려진 `--spec`/`--impl-prep` 예산 갭이며 target 위반이 아니다).

## 발견사항

- **[WARNING]** DB Query `meta.rowCount` — 상위 규약과 개별 노드 spec 이 서로 다른 결정을 유지
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md` §5.1 (출력 필드 표 바로 아래 note) — "`rowCount`는 형식상 메트릭이지만 ... **`output`에 유지**한다 ... `meta`에 복제하지 않는다 — 같은 값이 두 곳에 있으면 일관성을 해친다."
  - 위반 규약: `spec/conventions/node-output.md` Principle 2 표 — "**DB** | `meta.durationMs`, `meta.rowCount`" (DB 노드는 `meta.rowCount`를 권장/필수 필드로 명시). 같은 target 디렉터리 안의 `0-common.md` §6 표도 "DB: `meta.rowCount` (output.rowCount 와 중복 가능 — output 은 도메인, meta 는 메트릭 측면)"라고 **아직 옛 결정을 그대로 반복**하고 있다.
  - 상세: 세 문서가 한 필드를 두고 정면으로 갈린다 — convention(`node-output.md` Principle 2)과 target 내부 문서(`0-common.md` §6)는 "`meta.rowCount` 를 둬도 된다(중복 허용)"고 적고, 정작 그 필드를 정의하는 개별 노드 spec(`2-database-query.md` §5.1)은 "중복 금지"로 명시적 반대 결정을 내렸다. `2-database-query.md`의 근거(중복이 일관성을 해친다)는 합리적이지만, 그 결정이 상위 규약과 형제 문서로 역전파(back-propagate)되지 않아 규약을 그대로 읽은 사람은 `meta.rowCount`가 있어야 한다고 오판할 수 있다.
  - 제안: (a) 이번 SSRF 통합 작업의 스코프는 아니므로 차단 사유는 아니다. 다만 후속으로 `node-output.md` Principle 2 의 DB 행에서 `meta.rowCount` 를 제거(또는 "폐기됨 — `2-database-query.md §5.1` 참조"로 각주)하고, `0-common.md` §6 표의 동일 문구도 `2-database-query.md`의 최신 결정에 맞춰 동기화할 것을 권한다. 규약 갱신이 맞는 방향(target 의 실용적 판단이 맞고, convention 의 예시 표가 stale) 으로 보인다.

- **[WARNING]** `send_email` 포트 분류 — `node-output.md` 자체 Principle 5 와 Principle 3.3 이 상충, target 은 Principle 3.3(최신 D4 결정) 쪽을 따름
  - target 위치: `spec/4-nodes/4-integration/3-send-email.md` §3.2 (출력 포트 표 — `out`/`error` 2개 포트), §5.1·§5.3 (`"port": "out"` / `"port": "error"` 명시)
  - 위반 규약: `spec/conventions/node-output.md` Principle 5 표 — "`port: undefined` | 기본 단일 출력(노드 정의상 outputs가 1개) | `transform`, `send_email`, `manual_trigger`" 로 **send_email 을 단일-출력·port 생략 카테고리에 분류**. 그런데 같은 문서 Principle 3.3 은 "반드시 `error` 포트를 갖는 노드: `http_request`, `database_query`, `send_email`, ..."라고 **send_email 에 error 포트를 의무화**하며, D4 결정(2026-05-17, Principle 3 각주)이 Integration 계열 노드의 SSRF/자격증명 실패를 throw 대신 `port:'error'` 라우팅으로 바꾼 배경도 명시한다.
  - 상세: target(`3-send-email.md`)은 §3.2/§5.1/§5.3/§5.8 전체가 Principle 3.3·D4·Principle 0(5필드)·Principle 11(케이스별 문서화)을 정확히 따르고 있고 실제로 `out`/`error` 두 포트에 `port` 값을 명시한다. 문제는 **convention 문서 내부**에 있다 — Principle 5 의 예시 표가 D4 이전(단일 출력 시절)의 send_email 을 그대로 열거해, Principle 3.3 과 모순된 채 남아 있다. target 이 규약을 어긴 것이 아니라, target 이 정확히 따르고 있는 규약(§3.3/D4)과 target 이 겉보기에 어긋나 보이는 규약(§5 표)이 같은 문서 안에서 서로 다른 사실을 말한다.
  - 제안: `node-output.md` Principle 5 표에서 `send_email`을 "port: undefined" 행에서 제거하고 "port: string" 행(`http_request`, `database_query`, `ai_agent` 등과 같은 줄)으로 옮길 것. target 문서 수정은 불필요.

- **[INFO]** `makeshop` 이 Principle 3.3 "반드시 error 포트를 갖는 노드" 열거에서 누락
  - target 위치: `spec/4-nodes/4-integration/0-common.md` §7 "출력 구조 색인" 표 — makeshop 행이 cafe24 와 동일하게 "에러 케이스(단일 경로) §5.3(error)"를 명시
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.3 의 노드 열거에 `makeshop` 이 빠짐 (`cafe24`는 있음)
  - 상세: 기능적으로 문제는 없다 — makeshop 은 Principle 3.1의 일반 분류(Runtime 에러 → `port:'error'`)를 그대로 따르고 있어 target 자체는 규약 위반이 아니다. 다만 Principle 3.3 이 "반드시 갖는 노드"를 명시 열거하는 취지라면 makeshop 이 빠진 것은 그 열거표의 완결성 문제다(cafe24 도입 시점과 makeshop 도입 시점 사이의 문서 동기화 누락으로 추정).
  - 제안: `node-output.md` Principle 3.3 열거에 `makeshop` 추가. 차단 사유 아님.

## 점검했으나 위반 없음 (양성 확인)

- **명명 규약**: 파일명(`0-common.md`~`5-makeshop.md`, `_product-overview.md`)과 frontmatter `id`가 CLAUDE.md/`project-planner` SKILL 의 `N-name.md`·`_product-overview.md` 명명 컨벤션과 정확히 일치. 에러 코드(`HTTP_BLOCKED`, `DB_HOST_BLOCKED`, `EMAIL_HOST_BLOCKED`, `DB_QUERY_FAILED`, `INTEGRATION_*` 등) 전부 `UPPER_SNAKE_CASE` + 도메인 prefix로 `error-codes.md` §1 을 만족.
- **출력 포맷 규약**: `config`/`output`/`meta?`/`port?`/`status?` 5필드 invariant(Principle 0), config echo 명시 열거·spread 금지(Principle 7 D1 — `1-http-request.md` §4 step2가 이를 그대로 인용), `meta.durationMs` 통일(§6.1), `output.requestBody`/`output.rows`/`output.messageId` 등 Principle 8.2 1차 네이밍 전부 일치.
- **문서 구조 규약**: 다중 spec 파일 영역이므로 Overview는 `_product-overview.md`(요구사항 ID `INT-*` 테이블 형식 포함)로 분리, 각 노드 문서는 본문 뒤 `## Rationale`(또는 `## N. Rationale`) 섹션으로 마감 — `project-planner` SKILL "3섹션" 컨벤션 준수.
- **금지 항목**: config echo 의 `{ ...rawConfig }` spread 사용 금지(Principle 7 D1)를 target 이 명시적으로 재확인·준수. `output.responseHeaders`/query param 의 `[REDACTED]` 리터럴은 `@workflow/masked-markers` 의 `KEY_MASK_MARKER`와 문자열이 우연히 같지만, 그 패키지 JSDoc 이 "HTTP 노드의 쿼리 파라미터·응답 헤더 가림은 이 집합과 무관하며 자동으로 결함이 아니다"라고 명시적으로 선언한 사례이므로 오탐 아님(확인 완료).
- **API 문서 규약(Swagger/OpenAPI)**: 대상 디렉터리는 워크플로 노드 실행 spec이며 REST 컨트롤러/DTO 데코레이터를 정의하지 않아 `swagger.md` 규약이 적용될 표면이 없음(N/A).

## 요약

`spec/4-nodes/4-integration/` 은 `node-output.md`·`error-codes.md`·`egress-masking.md`·문서 구조 컨벤션을 대체로 충실히 따르고 있으며, 이번에 착수하려는 `ssrf-guard-integration-unify` 플랜(코드만 spec 에 맞추는 작업, `spec_impact: none`)과 직접 충돌하는 CRITICAL 위반은 없다. 발견된 두 건의 WARNING(`meta.rowCount` 중복 여부, `send_email` 포트 분류)은 모두 **target 이 아니라 상위 규약 문서(`node-output.md`) 쪽 예시 표가 개별 노드 spec 의 후속 결정(D4, Principle 1 실용적 해석)을 따라가지 못해 생긴 stale 엔트리**로 판단되며, target 문서 자체의 수정보다는 `node-output.md` 갱신이 맞는 방향이다. INFO 1건은 열거 누락으로 기능 영향 없음. 세 건 모두 이번 SSRF 가드 통합 작업의 착수를 막을 이유는 아니다.

## 위험도

LOW
