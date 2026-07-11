# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` (--impl-prep, scope=spec/5-system/)
대조 규약: `spec/conventions/**` (audit-actions.md, error-codes.md, node-output.md, swagger.md, spec-impl-evidence.md 등) + 이들이 SoT 위임한 `spec/5-system/2-api-convention.md`·`3-error-handling.md`

## 방법

프롬프트에 번들된 발췌(1-auth.md 전문, 10-graph-rag.md 일부, audit-actions.md, cafe24-api-catalog 문서)뿐 아니라 실제 리포지토리의 `spec/conventions/*.md`(error-codes.md, node-output.md, swagger.md, spec-impl-evidence.md) 및 `spec/5-system/2-api-convention.md`·`3-error-handling.md`·`6-websocket-protocol.md` 원문을 직접 대조했다. cafe24-api-catalog 관련 규약은 target(auth/graph-rag)과 도메인이 무관해 실질 대조 대상에서 제외했다.

## 발견사항

- **[WARNING]** 딥 RPC-style 경로가 `api-convention §2.2` 의 명시 예외 형태와 불일치
  - target 위치: `1-auth.md §5` API 엔드포인트 표 — `POST /api/auth/2fa/webauthn/register/options`, `.../authenticate/verify`, `.../recovery-codes/regenerate`, `POST /api/users/me/email-change/verify` 등 (auth.md 가 참조하는 인접 엔드포인트 포함)
  - 위반 규약: `spec/5-system/2-api-convention.md §2.2` — "중첩은 2단계까지 / 3단계 이상은 최상위로 분리" 원칙과, 그 예외로 명시된 "`/api/{resource}/{id}/{channel}/{action}` 형태의 RPC-style sub-channel action" 조항
  - 상세: 위 엔드포인트들은 `/api/auth` 기준 4~5 세그먼트로 중첩되어 있고, 예외 조항이 요구하는 `{id}` 세그먼트(리소스 식별자)가 없다 — 인가는 JWT/challengeToken 등 바디·헤더로 이뤄지고 경로에 리소스 id 가 없는 "self/session-scoped 다단 action" 형태다. `§2.2` 의 예외 문구는 `{resource}/{id}/{channel}/{action}` 형태만 명시적으로 커버하므로, 문자 그대로 읽으면 이 부류의 경로는 예외 조항에도 들어맞지 않는다.
  - 다만 이 패턴은 `1-auth.md` 만의 신규 일탈이 아니라 `/api/users/me/email-change/*`, `/api/auth/oauth/:provider/callback` 등 시스템 전역에 걸쳐 이미 정착된 형태이며, 오랫동안 안정적으로 유지돼 왔다. 즉 **target 이 규약을 어겼다기보다 규약(§2.2) 의 예외 조항 문구가 실제 관행을 다 포섭하지 못하는** 쪽에 가깝다.
  - 제안: target 수정보다는 `api-convention.md §2.2` 의 예외 조항을 "resource/id 하위 sub-channel action" 뿐 아니라 "인증된 주체(JWT)에 암묵적으로 스코프된 다단 action 경로(`/api/{feature}/{sub-feature}/{action}`, id 세그먼트 생략 가능)" 까지 포괄하도록 갱신 검토를 권고. 규약 갱신 전까지는 현 상태를 CRITICAL 로 보지 않음(기존 광범위 선례와 정합, 새 invariant 위반 없음).

- **[INFO]** `node-output.md §3.2` 를 HTTP API 에러 코드 표기 근거로 교차 인용
  - target 위치: `1-auth.md §1.5.4` 하단 "명명 — historical-artifact 예외" 각주
  - 위반 규약: 없음(정보성) — `spec/conventions/node-output.md §3.2` (node 핸들러 `output.error.code` 표기 규율) vs `spec/conventions/error-codes.md §1` (프로젝트 전체 에러 코드 명명 규율)
  - 상세: 각주는 `invitation_*`/`forbidden`/`rate_limited` 코드가 "`node-output.md` Principle 3.2 · `error-codes.md §1` 의 `UPPER_SNAKE_CASE` 규약과 달리 `lower_snake_case`" 라고 설명한다. 그러나 `node-output.md §3.2` 는 문서 scope 상 **노드 핸들러의 `output.error.code`** (실행 엔진 도메인) 전용 규율이고, 여기서 문제되는 코드들은 HTTP API 응답(`error.code`, `api-convention §5.3`) 도메인이다. `error-codes.md` 자체가 "적용 범위: 프로젝트 전체의 에러 코드 문자열" 이라고 명시해 이미 이 케이스를 단독으로 커버하므로, `node-output.md §3.2` 교차 인용은 불필요하게 두 SoT 를 섞은 参照다.
  - 제안: 인용 정확도를 높이려면 `node-output.md §3.2` 언급을 제거하거나 "동일 원칙을 노드 output 레이어에서도 공유" 정도의 문구로 완화. 다만 실질 결론(양쪽 모두 `UPPER_SNAKE_CASE` 를 요구)은 바뀌지 않으므로 낮은 우선순위.

## 확인된 정합 항목 (참고용 — 위반 아님)

아래는 실제로 대조했고 규약과 **정확히 일치**함을 확인한 항목이다(허위 음성 방지를 위해 기록):

- `1-auth.md §1.5.4`·`§2.3`·`§5` 의 모든 에러 코드가 `UPPER_SNAKE_CASE`(`error-codes.md §1`) 이거나, `invitation_*`/`forbidden`/`rate_limited` 처럼 `error-codes.md §3` historical-artifact 레지스트리에 정확히 등재된 예외임.
- `1-auth.md §4.1` 감사 액션 카탈로그(`user.*`/`auth_config.*`/`workspace.*`/`member.*`/Planned `workflow.*`·`trigger.*`·`schedule.*`·`model_config.*`)가 `audit-actions.md §3` 도메인 레지스트리와 1:1 대응.
- `GET /api/auth/2fa/webauthn/credentials` 의 `{ data: { items: [...] } }` 비-페이징 고정 컬렉션 응답이 `api-convention.md §5.2`·`swagger.md §2-5/§6` 과 일치.
- `GET /api/auth/2fa/webauthn/availability` 의 논리 payload `{ enabled }` → wire `{ data: { enabled } }` 래핑 서술이 `TransformInterceptor`/`api-convention §5.1` 과 일치.
- `Rationale 1.4.H` 의 WebAuthn DTO 배치(`auth/webauthn/dto/webauthn.dto.ts`, `auth/webauthn/dto/responses/webauthn-response.dto.ts`)가 `swagger.md §5-1` (`dto/responses/` 서브디렉토리 규약, PR #914) 과 일치하며 실제 코드(`codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts`)와도 일치.
- `1-auth.md`/`10-graph-rag.md` frontmatter(`id`/`status`/`code`/`pending_plans`) 가 `spec-impl-evidence.md §2-§3` 스키마·라이프사이클을 충족 (`status: partial` + `pending_plans` 존재, `status: implemented` + `pending_plans` 부재).
- `10-graph-rag.md §5.1` 의 `KB_REEXTRACT_IN_PROGRESS`(409, UPPER_SNAKE_CASE)와 `§6` WS 이벤트(`document:graph_*`)가 각각 `3-error-handling.md §1.8`, `6-websocket-protocol.md §4.3` 공용 카탈로그에 정확히 등재·상호 참조됨(`document:graph_error` 부재 사실까지 양쪽 문서가 동일하게 서술).
- `10-graph-rag.md` 구조가 Overview(§Overview) → 본문(§1~§8, §1~§8 재번호 포함) → `## Rationale` 3섹션 컨벤션을 충족 (디스크 원본 기준 `## Rationale` at L587).
- `1-auth.md`/`10-graph-rag.md` 의 `id:` 값이 리포지토리 내 다른 spec 과 충돌하지 않음.

## 요약

`spec/5-system/1-auth.md`·`10-graph-rag.md` 는 정식 규약(`spec/conventions/**` 및 그 위임처 `2-api-convention.md`/`3-error-handling.md`/`swagger.md`/`audit-actions.md`)과 매우 높은 수준으로 정합돼 있다. 에러 코드 명명(UPPER_SNAKE_CASE + historical-artifact 예외 등재), 감사 액션 명명(dot-prefix + 시제 3분류), 응답 봉투/비-페이징 컬렉션 형식, 응답 DTO 서브디렉토리 배치, WS 이벤트 카탈로그, spec frontmatter 라이프사이클을 모두 실제 규약 문서·코드와 교차 검증했고 불일치를 찾지 못했다. 유일하게 남는 것은 (1) 일부 딥 RPC-style 엔드포인트가 `api-convention §2.2` 예외 조항의 문자 그대로의 형태(`{resource}/{id}/{channel}/{action}`)를 벗어나 있다는 점(다만 시스템 전역의 오래된 선례이며 규약 문구 쪽이 실무를 따라가지 못한 것으로 판단) — WARNING, (2) 에러 코드 명명 근거 각주가 도메인이 다른 두 SoT(`node-output.md`/`error-codes.md`)를 교차 인용한 사소한 참조 정확도 이슈 — INFO. 두 건 모두 target 자체의 무단 이탈이 아니라 규약 문서 쪽 갱신을 고려할 만한 경계 사례에 가깝다.

## 위험도

LOW
