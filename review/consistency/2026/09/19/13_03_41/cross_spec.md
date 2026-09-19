# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-integration-connection-tests.md`

검토 대상: `spec/2-navigation/4-integration.md` §3.3·§5.1~§5.7·§9.2·§14.1 변경안(target draft).
대조 대상: 같은 파일의 다른 절(§9.1·§10.3·§10.5), `spec/conventions/error-codes.md`,
`spec/4-nodes/4-integration/{1-http-request,2-database-query}.md`, 실제 코드
(`integrations.service.ts`, `service-registry.ts`, `standard-oauth.strategy.ts`,
`http-safety.ts`, `database-query.handler.ts`).

## 발견사항

- **[WARNING] HTTP 연결 테스트의 "redirect 미추종"이 실제 노드 실행 동작과 어긋난다 — 이 PR 의 목적(거짓 성공 방지)을 축소된 형태로 재도입할 수 있다**
  - target 위치: §5.3 HTTP/REST — 테스트 (item B), "리다이렉트는 따라가지 않고, 응답 본문은 읽지 않는다"
  - 충돌 대상: `spec/4-nodes/4-integration/1-http-request.md` §4 실행 로직 step 9 —
    "`integration` 인증인 경우 3xx 응답을 받으면 **최대 5홉까지 수동 follow** + 매 홉 SSRF 재검증.
    `none`/`custom` 인증은 3xx 를 follow 하지 않고 그대로 §5.3 으로 반환."
  - 상세: 연결 테스트가 검증하는 자격증명은 정확히 `authentication='integration'` 모드에서 쓰이는
    자격증명이다. 그런데 노드의 실제 실행은 이 모드에서 3xx 를 최대 5홉까지 따라가 최종 목적지에서
    인증을 확인하는 반면, item B 의 연결 테스트는 "3xx → success: true" 로 즉시 종료하고 따라가지
    않는다. `base_url` 이 (예: http→https 정규화, 도메인 canonicalization 등으로) 3xx 를 반환하는
    서비스라면, 실제 인증 실패가 일어나는 지점(redirect 목적지)에 연결 테스트가 도달하지 못한 채
    `success: true` 를 반환한다. 이 draft 자체의 동기(§5.4/§5.3 "틀린 비밀번호로도 연결 테스트가
    성공" 문제 해소)와 같은 클래스의 결함을 HTTP 의 redirect 경로에 한해 축소 재도입하는 셈이다.
    draft 의 Rationale 은 "4xx(401·403 외)를 성공으로 두는 이유"만 설명하고 redirect 미추종이
    만드는 이 gap 은 언급하지 않는다.
  - 제안: (a) 연결 테스트도 노드와 동일하게 최소 1홉은 follow(+SSRF 재검증)하도록 맞추거나,
    (b) 현재 설계를 유지한다면 "**한계**" 문단에 "3xx 를 최종 목적지까지 따라가지 않으므로,
    redirect 뒤에서만 인증을 거부하는 서비스는 이 테스트로 걸러지지 않는다"를 명시해 §4.3
    Rotate 문서와 함께 알려진 제약으로 기록한다.

- **[WARNING] item C 삽입 문구가 같은 문서의 §9.1/§10.3/§10.5 "Google 자동 갱신 보장" 서술과 직접 모순된다**
  - target 위치: §5.1 Google · §5.2 GitHub · §5.7 Webhook — 테스트 (item C), 삽입 문구
    "…이 통합을 쓰는 노드가 아직 없어서다(**Google 은 토큰 갱신도 없다**)…"
  - 충돌 대상: 같은 파일 §9.1 (`IntegrationDto.autoRefresh` 설명 — "현재 `service_type='cafe24'`,
    `service_type='google'`, `service_type='makeshop'`…이 `true`"), §10.3 (provider 표 —
    Google Refresh `✓`), §10.5 ("Refresh token 보유 시(provider 가 refresh_token 발급·갱신을
    보장 — 현재 `cafe24`, `google`)")
  - 상세: 코드로 확인한 결과 draft 의 주장이 사실이다 —
    `codebase/backend/src/modules/integrations/oauth-providers/standard-oauth.strategy.ts`
    는 `grant_type: 'authorization_code'` 만 구현하고 refresh 흐름이 없다(google 이 이 전략을
    사용). 반대로 §9.1/§10.3/§10.5 는 google 을 cafe24 와 동급의 "자동 갱신 보장" 서비스로
    문서화하고 있다 — 이 자체가 이미 존재하던 spec-vs-code drift 다. draft 는 이 사실을 "비대상"
    항목("§10.5 · 레지스트리 `supportsTokenAutoRefresh` 가 Google 자동 갱신을 주장하지만 갱신
    구현이 없다")으로 트래커에 넘기면서도, **정작 이번 PR 이 §5.1 Rationale 에 그 반대 사실을
    명시적으로 박아 넣는다.** 그 결과 병합 후 같은 문서 안에 "Google 은 갱신이 없다"(§5.1)와
    "Google 도 자동 갱신을 보장한다"(§9.1/§10.3/§10.5)가 동시에 존재하게 된다 — 병합 전에는
    후자만 있어 "틀렸지만 self-consistent" 했다면, 병합 후에는 "명시적으로 자기모순" 상태가 된다.
  - 제안: 최소한 §5.1 삽입문에 "(§9.1/§10.3/§10.5 의 `autoRefresh=true` 표기와 상충 — 트래커
    항목 참조)" 각주를 달아 두 서술이 같은 이슈를 가리킨다는 것을 명시한다. 이미 이번 조사로
    사실 관계(구현 부재)가 확정됐으므로, 여력이 되면 §9.1/§10.3/§10.5 의 Google 행에도 같은 PR
    에서 "문서상 지원이나 refresh 미구현" caveat 을 동시에 추가하는 편이 자기모순을 만들지 않는다.

- **[INFO] item D 의 괄호 설명이 부정확하다 — Cafe24 Private·MakeShop 은 Step 3(preview-test)를 아예 거치지 않는다**
  - target 위치: item D 아래 괄호, "(현재 OAuth 서비스 넷 — Google · GitHub · Cafe24 · MakeShop —
    모두 preview-test 가 구조 검증만이다. Cafe24 · MakeShop 의 실제 핑은 저장 뒤 `:id/test` 의
    entity tester 다.)"
  - 충돌 대상: `spec/2-navigation/4-integration.md` §3.1(상태 기계) · §3.2 (Cafe24 Private ·
    MakeShop 흐름) — 두 서비스는 `oauth/begin` 즉시 `status=pending_install` row 를 생성하고
    팝업 없이 App URL 설치 안내로 분기하며, "부모창은 Step 3 로 자동 전이" 문구가 이 두 흐름에는
    없다(Google/GitHub/Cafe24 Public 흐름에만 있음).
  - 상세: `preview-test`(Step 3)는 popup 기반 흐름(Google·GitHub·Cafe24 Public)에서만 호출된다.
    Cafe24 Private·MakeShop 은 Step 3 자체를 타지 않고 `pending_install` 로 직행하므로, 이
    괄호가 말하는 "OAuth 서비스 넷 모두 preview-test 가 구조 검증만" 은 정확히는 Google·GitHub·
    Cafe24 Public 세 곳에만 해당한다. (이 괄호가 `4-integration.md` 본문에 그대로 삽입되는 문장은
    아니고 planner 노트로 보이므로 CRITICAL 로 올리지 않음 — 다만 그대로 spec 본문에 옮겨 적힐
    경우 WARNING 이상으로 격상해야 한다.)
  - 제안: "Google·GitHub·Cafe24 Public 은 preview-test(Step 3)가 구조 검증만; Cafe24 Private·
    MakeShop 은 애초 Step 3 를 타지 않고 `pending_install` 로 직행(§3.2)" 로 정정.

- **[INFO] 신규 코드 이름이 기존 노드-레벨 코드와 근접해 네임스페이스 혼동 소지**
  - target 위치: item F, 신규 5개 코드 `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` ·
    `HTTP_AUTH_FAILED` · `HTTP_CONNECT_FAILED` · `HTTP_SERVER_ERROR`
  - 충돌 대상: `spec/4-nodes/4-integration/2-database-query.md` §6.2 `DB_CONNECTION_ERROR`,
    `spec/5-system/3-error-handling.md` §1.4 `HTTP_5XX`
  - 상세: 그레핑으로 확인한 바 다섯 이름 자체는 저장소 전체에서 신규이고(0건, UPPER_SNAKE_CASE
    도 준수 — `error-codes.md` §1 위반 없음) 실질적 충돌은 없다. 다만 `DB_CONNECTION_ERROR`
    (노드 런타임, connection drop/handshake 인증 실패 포괄) 와 `DB_CONNECT_FAILED`(연결 테스트
    전용, 네트워크·타임아웃·TLS 등), `HTTP_5XX`(노드 런타임) 와 `HTTP_SERVER_ERROR`(연결 테스트
    전용) 는 이름이 매우 유사해 두 네임스페이스(노드 `output.error.code` vs
    `IntegrationTestResult.code`)를 착각하기 쉽다. item G Rationale 은 "네임스페이스가 다르다"는
    원칙만 설명하고 구체적인 근접-쌍은 나열하지 않는다.
  - 제안: item G Rationale 에 "`DB_CONNECTION_ERROR`(노드)/`DB_CONNECT_FAILED`(연결 테스트)",
    "`HTTP_5XX`(노드)/`HTTP_SERVER_ERROR`(연결 테스트)" 근접 쌍을 명시적으로 나열해 향후 혼동을
    예방한다.

- **[INFO] §4.3/§9.4 rotate 설명에 HTTP 4xx 성공 처리 한계에 대한 상호 참조가 없다**
  - target 위치: item B 의 Rationale("HTTP 의 4xx 를 성공으로 두는 이유") vs 기존 §4.3 Security
    탭 "Rotate credentials" 설명, §9.4 `INTEGRATION_TEST_FAILED`
  - 상세: item B 는 "자격증명 거부를 알 수 있는 것은 `base_url` 이 401·403 을 돌려줄 때뿐이다"라는
    한계를 스스로 명시하지만, 이 한계는 `4-integration.md` §4.3(Rotate credentials — "내부적으로
    연결 테스트 → 성공 시에만 commit")이나 §9.4 어디에도 교차 참조되지 않는다. §4.3 만 읽는
    사용자는 "테스트 성공 = 자격증명이 실제로 유효함이 확인됨"으로 오해할 수 있다.
  - 제안: §4.3 Rotate 설명 또는 §9.4 `INTEGRATION_TEST_FAILED` 행에 "HTTP 통합은 `base_url` 이
    401/403 을 반환하는 경우에만 자격증명 거부를 검출한다(§5.3)"는 한 줄 각주 추가.

## 요약

target draft 의 핵심 사실 주장(`dispatchTest` 두 단계 구조, `transportTesters` 가 `mcp`/`email`
둘뿐이라는 것, entity tester 가 `previewTest` 경로에서 쓰이지 않는다는 것, `service-registry.ts`
의 `http`/`database` 필드 구성, `standard-oauth.strategy.ts` 가 `authorization_code` grant 만
구현한다는 것, 신규 코드 5개의 grep 0건)은 모두 코드 대조로 검증되며 정확했다. `error-codes.md`
UPPER_SNAKE_CASE 규약·`IntegrationTestResult.code` 를 노드 `output.error.code` 와 별개
namespace 로 취급하는 기존 선례(`EMAIL_CONNECT_FAILED`)와도 정합한다. 다만 두 가지는 명시적으로
짚어야 한다 — ① HTTP 연결 테스트가 redirect 를 따라가지 않아 노드의 실제 실행 동작(최대 5홉
follow)과 갈라지는 것이 이 PR 이 막으려는 문제의 축소판을 재도입할 수 있고, ② item C 가 삽입할
"Google 은 토큰 갱신이 없다"는 문장이 같은 파일 §9.1/§10.3/§10.5 의 "Google 도 자동 갱신을
보장한다"는 기존 서술과 병합 후 명시적으로 충돌한다(둘 다 서로 참조가 없다). 나머지는 INFO 수준의
정밀화·상호참조 보강 권고다.

## 위험도

MEDIUM
