### 발견사항

target(`plan/in-progress/spec-draft-raw-query-results.md`, 개정 2)이 실제로 도입하는 신규 식별자는 소수다 — 신규 spec 파일 1개(`spec/conventions/raw-query-results.md`, `id: raw-query-results`), `node-cancellation.md` frontmatter `pending_plans:` 항목 추가 1건, 5개 spec 문서에 대한 Rationale 각주 7건, 그리고 `3-error-handling.md` §1.2 에 대한 에러 코드 카탈로그 등재 1건(`OAUTH_STATE_MISMATCH`, §C)이다. 이 중 앞 세 범주는 기존 사용처와 대조한 결과 충돌이 없다(아래 확인 내역). §C 의 카탈로그 등재에서 실질적 문제 하나를 발견했다.

- **[WARNING]** `OAUTH_STATE_MISMATCH` 등재 시 두 발행처의 의미 폭이 다르다는 사실이 누락됨
  - target 신규 식별자: §C — `spec/5-system/3-error-handling.md` §1.2 인증/인가 에러에 `OAUTH_STATE_MISMATCH`(400)를 등재하고 `data-flow/2-auth.md` 와 **단독** 상호링크
  - 기존 사용처: 코드베이스에 이 문자열을 던지는 곳이 **독립적으로 두 곳** 있다.
    - `codebase/backend/src/modules/auth/auth-oauth.service.ts:179,186` (소셜 로그인 콜백, target 이 인용하는 `data-flow/2-auth.md` §1.3 이 이 경로다) — `DELETE … RETURNING` 이 0행이면(state 가 **미존재·만료·이미 소비** 세 경우 전부 SQL `WHERE expires_at > NOW()` 필터로 뭉뚱그려짐) **그리고** provider 불일치일 때 **모두 같은 코드** `OAUTH_STATE_MISMATCH` 하나로 던진다. 형제 코드가 없다.
    - `codebase/backend/src/modules/integrations/integration-oauth.service.ts:581,598,619,627` (통합 연결 OAuth, `spec/2-navigation/4-integration.md` §9.2/§9.4 가 이미 문서화한 경로 — 동일 §9.4 표에 `OAUTH_STATE_MISMATCH (400)` 이 이미 등재돼 있다) — 여기서는 `OAUTH_STATE_MISSING`(쿼리에 `state` 자체 없음) · `OAUTH_STATE_MISMATCH`(DB row 없음/이미 소비, 또는 provider 불일치) · `OAUTH_STATE_EXPIRED`(row 는 있지만 만료) **세 코드로 세분화**돼 있다. `third-party-oauth.controller.ts:348` 의 swagger 주석도 이 3-코드 세트를 명시한다.
  - 상세: 같은 문자열 `OAUTH_STATE_MISMATCH` 가 **두 독립 서브시스템에서 서로 다른 경계(scope)**를 갖는다 — 소셜 로그인 쪽은 "missing/expired/consumed/provider-mismatch 전부"를 포괄하는 넓은 의미이고, 통합 연결 쪽은 "미존재·이미소비·provider 불일치"만이고 "만료"는 형제 코드 `OAUTH_STATE_EXPIRED` 로 분리된 좁은 의미다. `3-error-handling.md` 는 문서 서두에서 "프로젝트 전체의 에러 코드 문자열에 적용된다"고 스스로를 전역 카탈로그로 선언하는데, target 은 이 카탈로그 등재를 `data-flow/2-auth.md`(소셜 로그인, 넓은 의미) 쪽으로만 상호링크하고 이미 같은 카탈로그 대상 파일(`2-navigation/4-integration.md`)에 등재돼 있는 통합 연결 쪽(좁은 의미, 형제 코드 `OAUTH_STATE_MISSING`/`OAUTH_STATE_EXPIRED` 존재)은 언급하지 않는다. 이대로 등재되면 §1.2 표를 읽는 사람은 "OAUTH_STATE_MISMATCH = state 검증 실패 전반"으로 오독하거나, 반대로 통합 연결 쪽 좁은 정의만 알던 사람은 소셜 로그인 쪽이 missing/expired 까지 이 코드로 흡수한다는 사실을 놓친다. 기능적 버그는 아니다(두 발행처가 서로 얽히지 않는 독립 코드 경로) — 그러나 이 저장소가 이미 확립한 선례(§1.9 의 `already_a_member`/`workspace_type_mismatch` 처럼 "동일 의미·별개 wire 코드"를 **명시적으로 각주**하는 패턴, §1.2.1 의 "근접 명명 주의" 각주)와 어긋나는 **누락**이다.
  - 제안: §C 의 카탈로그 등재 문구에 "본 코드는 통합 연결 OAuth 흐름(`2-navigation/4-integration.md §9.2/§9.4`, `integration-oauth.service.ts`)에서도 동일 이름으로 쓰이지만, 그쪽은 미존재(`OAUTH_STATE_MISSING`)·만료(`OAUTH_STATE_EXPIRED`)를 형제 코드로 분리한 **좁은 의미**이고, 본 절(소셜 로그인, `auth-oauth.service.ts`)은 그 셋을 전부 포괄하는 **넓은 의미**다" 같은 한 줄 caveat 을 추가하거나, `2-navigation/4-integration.md` 쪽 링크도 함께 상호링크할 것을 권장한다. 두 코드 체계를 하나로 통합하라는 뜻은 아니다(그 판단은 이 checker 범위 밖) — 다만 카탈로그 등재 시점에 "이미 다른 좁은 의미로 같은 이름이 쓰이고 있다"는 사실 자체는 남겨야 다음 사람이 §1.2 만 보고 오판하지 않는다.

- **[INFO]** 그 외 신규 식별자는 충돌 없음 확인
  - `spec/conventions/raw-query-results.md` 경로/`id: raw-query-results` — `spec/conventions/` 내 동일 경로 없음, 기존 conventions 문서 22개(+ `spec-impl-evidence.md` 내부 예시 `chat-channel`/`voice-trigger` 포함)의 `id:` 값과 겹치지 않음. kebab-case 명명도 `node-cancellation.md`/`migrations.md` 와 일관.
  - `updateReturningRows` — target 이 새로 도입하는 이름이 아니라 이미 `codebase/backend/src/common/utils/update-returning-rows.ts` 에 구현·다수 호출처(`auth-oauth.service.ts`, `execution-engine.service.ts` 등)가 있는 기존 헬퍼를 문서화하는 것. 의미 충돌 없음.
  - `node-cancellation.md` frontmatter `pending_plans:` 에 `update-returning-tuple-shape.md` 추가(§D) — 같은 지시가 `spec-update-node-cancellation-shutdown-classification.md:664` 에도 있으나 target 이 이미 §D 본문에서 "값 동일, 충돌 아님. 반영 후 그쪽 항목을 소거한다"고 자체 인지·처리 방침을 명시해 두었다. 추가 조치 불요.
  - §B 각주 삽입 위치 7곳(`data-flow/2-auth.md`, `4-execution-engine.md` §1.1/§8, `8-embedding-pipeline.md` §7.3, `10-graph-rag.md`, `node-cancellation.md` §2.4/§6) — 신규 식별자를 도입하는 게 아니라 기존 섹션에 소급 각주를 다는 것이라 이 checker 의 충돌 범주(신규 ID/엔티티/endpoint/이벤트명/ENV/파일경로) 밖이다.
  - 신규 요구사항 ID·엔티티/DTO·API endpoint·webhook/queue/SSE 이벤트명·ENV var/config key 는 도입하지 않는다.

### 요약
target 이 새로 도입하는 식별자(신규 spec 파일 경로/`id`, `pending_plans` 추가, 7건의 소급 각주 위치)는 기존 `spec/`·`codebase/backend/src` 전수와 대조해도 CRITICAL 급 충돌이 없다. 다만 이번 개정에서 새로 추가된 §C(`OAUTH_STATE_MISMATCH` 카탈로그 등재)는 이미 코드베이스에 **동일 이름·다른 경계(scope)**로 쓰이는 두 번째 독립 발행처(통합 연결 OAuth, 형제 코드 `OAUTH_STATE_MISSING`/`OAUTH_STATE_EXPIRED` 보유)가 존재한다는 사실을 언급하지 않고 `data-flow/2-auth.md` 로만 단독 상호링크한다 — 기능적 버그는 아니지만 전역 카탈로그 문서의 완결성을 해치는 누락이라 WARNING 으로 남긴다.

### 위험도
LOW
