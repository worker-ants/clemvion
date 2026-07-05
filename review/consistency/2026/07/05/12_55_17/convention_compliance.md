# 정식 규약 준수 검토 — `spec/4-nodes/4-integration/`

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/4-nodes/4-integration/0-common.md`, `1-http-request.md`, `2-database-query.md`, `3-send-email.md`, `4-cafe24.md`(부분)
대조 규약: `spec/conventions/node-output.md`, `spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/swagger.md`, `spec/conventions/cafe24-api-metadata.md`, `spec/conventions/cafe24-api-catalog/**`
참고 코드: `codebase/backend/src/nodes/integration/http-request/{http-request.handler.ts,http-safety.ts}`, `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`, `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts`, `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts`

## 발견사항

### [WARNING] SSRF 차단 메시지 "일반화" 원칙이 HTTP Request 노드에서만 어긋남 (DB Query/Send Email과 비대칭)

- target 위치: `spec/4-nodes/4-integration/1-http-request.md` §Rationale 8.2 ("클라이언트 노출 메시지는 차단 host/IP 를 포함하지 않는 일반화 문구") 및 `2-database-query.md` §Rationale ("메시지 일반화: 클라이언트 노출 메시지는 차단된 host/IP 를 포함하지 않는다")
- 위반 규약: `spec/conventions/node-output.md` §3.2 (`output.error` 표준 envelope — `message` 는 "사람이 읽는 메시지"이되, 동일 카테고리(Integration) 3형제 노드는 §3(D4)에 의해 동일 posture 로 통일되어야 함) 및 target 문서 스스로 선언한 SSRF posture 통일 원칙(`0-common.md` §4.1 step 8 콜아웃 — "이 플래그는 통합 노드 전반의 SSRF 가드를 공통 제어한다")
- 상세: target 문서는 HTTP Request·Database Query·Send Email 세 노드가 "동일 메커니즘·동일 플래그(`ALLOW_PRIVATE_HOST_TARGETS`)"로 SSRF 를 방어하며, 특히 **DB Query 의 Rationale(§`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설, 2026-06-12)** 은 "클라이언트 노출 메시지는 차단된 host/IP 를 포함하지 않는다. 차단 상세(원본 host)는 `logUsage` 서버 활동 로그에만 남긴다. **동일 원칙을 HTTP/Email SSRF 메시지 일반화 follow-up 과 공유한다**"라고 명시한다. 실제 코드를 대조하면:
  - `database-query.handler.ts` (line 227-230): `DB_HOST_BLOCKED` 는 고정 일반화 문구 `'Database host resolves to a private/loopback address blocked by SSRF policy.'` 사용 — spec 약속과 일치.
  - `send-email.handler.ts` (line 180-183): `EMAIL_HOST_BLOCKED` 도 고정 일반화 문구 `'SMTP host points to a private/loopback address blocked by policy.'` 사용 — spec 약속과 일치.
  - `http-request.handler.ts` (line 345-376) + `http-safety.ts` (`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`): `HTTP_BLOCKED` 는 `err.message` 를 **가공 없이 그대로** `output.error.message` 에 싣는다. `http-safety.ts` 의 실제 throw 메시지는 `` SSRF_BLOCKED: hostname "169.254.169.254" resolves to a restricted network range `` / `` SSRF_BLOCKED: hostname "x" resolves to restricted IP "y" `` 형태로 **차단된 hostname/IP 원문을 그대로 포함**한다. `sanitizeMessage`(비밀 토큰 마스킹, password/Bearer/base64 blob 패턴만 대상)도 이 경로에는 적용되지 않는다(`buildPreflightErrorOutput` 은 `toLogError` 를 거치지 않고 `err.message` 를 직접 씀).
  - 즉 DB Query·Send Email 은 "일반화 문구"를 실제로 구현했지만, **HTTP Request 만 정찰 면(reconnaissance surface)을 그대로 노출**하는 상태다. target 문서가 세 노드의 SSRF posture 를 "일관"으로 서술(§Rationale 8.2, `0-common.md` §4.1)하는 것과 실측이 어긋난다.
- 제안: (a) target spec 을 갱신해 HTTP Request 의 §8.1/§Rationale 8.2 에 "현재 코드는 hostname/IP 를 그대로 노출한다"는 구현 현황(Planned/갭)을 명시하거나, (b) `http-request.handler.ts` 의 SSRF catch 블록에서 DB/Email 과 동일하게 고정 일반화 메시지로 치환하고 원본 상세는 `logUsage`(activity log)에만 남기도록 구현을 정합화한다. 후자가 3형제 노드 posture 통일이라는 spec 의도에 부합한다. 본 worktree 이름(`ssrf-error-generalize`)상 이 정합화가 이번 작업 범위일 가능성이 높다.

### [WARNING] Redirect-hop SSRF 차단이 spec 표(§4.2/§6)의 `HTTP_BLOCKED` 약속과 달리 `HTTP_TRANSPORT_FAILED` 로 흐를 가능성

- target 위치: `spec/4-nodes/4-integration/1-http-request.md` §4.2 Usage 로깅 매트릭스("SSRF 차단 / redirect 한도 초과 → `failed` / `HTTP_BLOCKED`") 및 §6 에러 코드 표(`HTTP_BLOCKED` 조건: "...redirect 한도·비-http(s) 프로토콜")
- 위반 규약: `spec/conventions/node-output.md` §3.2 표준 envelope의 `code` 의미 정합성(코드가 실제 조건을 정확히 반영해야 함) 및 §3.2.2("클라이언트는 코드의 의미로 분기") / `spec/conventions/error-codes.md` §1("에러 코드 이름은 조건의 의미를 기술")
- 상세: `http-request.handler.ts` 의 초기 SSRF 가드(요청 전, line 345-376)는 catch 되어 명시적으로 `ErrorCode.HTTP_BLOCKED` 로 매핑된다. 그러나 **manual redirect follow 루프 안**(line 407-426, `assertSafeOutboundUrl(next)`/`assertSafeOutboundHostResolved(parsedNext.hostname)`)에서 발생하는 SSRF 차단은 이 loop 를 감싸는 바깥 `try` 블록(line 407)의 **일반 catch**(line 490-)로 떨어지며, 그 catch 는 무조건 `code: 'HTTP_TRANSPORT_FAILED'` 로 고정한다. 즉 redirect 5홉 중 어느 hop 이 사설망을 가리켜 차단되더라도, 실제 `output.error.code` 는 spec 표가 약속한 `HTTP_BLOCKED` 가 아니라 `HTTP_TRANSPORT_FAILED` 로 나갈 개연성이 높다(코드상 두 경로가 분리되어 있지 않음). 워크플로우 저자가 `output.error.code === 'HTTP_BLOCKED'` 로 SSRF 차단을 분기하려 해도 redirect 경유 차단은 그 분기에 잡히지 않는다.
- 제안: 본 항목은 spec 문서 자체의 conventions 위반이라기보다 **spec-impl 정합성 갭**(spec-coverage 트랙 소관)에 더 가깝다. 다만 target 문서(§4.2/§6)가 스스로 명시한 "redirect 한도 초과 = `HTTP_BLOCKED`" 서술이 구현 착수 시점에 실제로 지켜지지 않을 위험을 --impl-prep 단계에서 미리 표시해 둔다. 구현 시 redirect loop 안의 SSRF 예외를 별도로 catch 해 `HTTP_BLOCKED` 로 분기하거나, spec 표를 실측대로 정정할지 결정이 필요하다.

### [INFO] `0-common.md` 에 `## Rationale` 섹션 부재 (자매 노드 문서들과의 형식 비일관)

- target 위치: `spec/4-nodes/4-integration/0-common.md` 전체 (§1~§7 로 종료, Rationale 없음)
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" (권장). 같은 디렉토리의 `1-http-request.md`(§8 Rationale), `2-database-query.md`(§Rationale), `3-send-email.md`(§8 Rationale) 은 모두 Rationale 섹션을 갖는다.
- 상세: `0-common.md` 본문에는 D4 결정·SSRF 통일 결정(§4.2 콜아웃) 등 근거성 서술이 산문 형태로 각 절에 흩어져 있으나, 별도 `## Rationale` 섹션으로 분리돼 있지 않다. 강제 규약이라기보다 "권장" 수준이라 CRITICAL 은 아니지만, 같은 디렉토리 자매 문서들과 구조가 다르다.
- 제안: 필수 사항은 아니므로 우선순위 낮음. 다음 개정 시 D4·SSRF 통일 배경 서술을 `## Rationale` 로 이동하면 디렉토리 내 형식 일관성이 개선된다.

### [INFO] `node-output.md` §3.2.1 `retryable`/`retryAfterSec` 필드가 Integration 노드 SSRF/에러 코드 표에 언급 없음

- target 위치: `1-http-request.md` §6 에러 코드 표, `2-database-query.md` §6.2 에러 코드 표, `3-send-email.md` §6
- 위반 규약: `spec/conventions/node-output.md` §3.2.1 (`retryable`/`retryAfterSec` 는 "LLM 계열 노드 필수, 기타 노드는 선택(점진 채택)")
- 상세: 위반은 아니다 — 비-LLM 노드는 선택 사항이므로 미기재 자체는 규약 준수 범위 내다. 다만 `HTTP_TRANSPORT_FAILED`/`DB_CONNECTION_ERROR` 처럼 명백히 일시적(transient) 성격의 코드에 `retryable` 을 아직 명시하지 않은 점은, 향후 §3.2.1 점진 채택 관점에서 개선 여지로만 남긴다(강제 아님).
- 제안: 강제 규약이 아니므로 현 상태 유지 가능. 개선 원할 시 후속 논의.

## 검토 범위 밖 확인 (문제 없음 — 참고용)

- **명명 규약**: `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`/`INVALID_PARAMETERS`/`INTEGRATION_*` 등은 모두 `UPPER_SNAKE_CASE` + 도메인 의미 기반 명명으로 `error-codes.md` §1 원칙에 부합한다. `DB_HOST_BLOCKED` 신설(코드 rename 아닌 신설)도 `error-codes.md` §2 안정성 정책("의미가 분기되면 새 코드를 신설")에 부합한다.
- **frontmatter 규약**: 확인된 target 문서(`0-common.md` status:partial+pending_plans, `1-http-request.md`/`2-database-query.md`/`3-send-email.md` status:implemented)는 `spec-impl-evidence.md` §2 스키마를 준수한다.
- **5필드 invariant / config echo (Principle 0, 1.1, 7)**: 세 노드 문서 모두 `{config, output, meta?, port?, status?}` 5필드 구조·명시 열거(D1) echo 패턴을 정확히 서술하고 있으며 `node-output.md` Principle 7 의 "spread 금지" 원칙도 명시 인용한다.
- **Cafe24/MakeShop 의 SSRF 비적용 논리**: `5-makeshop.md` 는 고정 호스트(`connect.makeshop.co.kr`)라 `assertSafeOutboundHostResolved` 가드가 불필요하고 `shop_uid` path-segment 형식 검증(`MAKESHOP_INVALID_SHOP_UID`)으로 충분하다고 서술하며, 실제 `makeshop.handler.ts` 도 이와 일치한다 — 자기 일관적.
- **API 문서 규약(swagger.md)**: target 문서는 노드 핸들러 계약만 다루고 REST controller/DTO 데코레이터를 다루지 않아 해당 규약은 스코프 밖(N/A).

## 요약

Target 문서(`spec/4-nodes/4-integration/*`)는 5필드 invariant·config echo·에러 코드 명명·frontmatter 스키마 등 핵심 conventions 를 대체로 정확히 준수한다. 가장 눈에 띄는 문제는 **SSRF 차단 메시지 "일반화" 원칙이 세 자매 Integration 노드(HTTP/DB/Email) 중 HTTP Request 에서만 어긋난다**는 점이다 — DB Query·Send Email 은 spec 이 약속한 고정 일반화 문구를 실제로 구현했지만 HTTP Request 는 raw hostname/IP 를 그대로 노출한다. 이는 target 문서가 스스로 선언한 "3노드 동일 posture" 서술과 불일치하며, redirect-hop 경유 SSRF 차단이 `HTTP_BLOCKED` 대신 `HTTP_TRANSPORT_FAILED` 로 잘못 분류될 개연성과 함께 이번 `ssrf-error-generalize` 작업의 핵심 타깃일 가능성이 높다. 문서 구조(Rationale 섹션 유무)는 INFO 수준의 사소한 비일관에 그친다.

## 위험도

MEDIUM
