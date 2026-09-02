# Cross-Spec 일관성 검토 — `spec-draft-api-convention-status-and-password-codes.md`

## 검토 범위 및 방법

target 문서는 `spec/5-system/2-api-convention.md`(§6·§5.3)·`spec/conventions/error-codes.md`(§3)·
`spec/5-system/3-error-handling.md`(§1.2)에 걸친 5곳 변경안이다. 프롬프트 번들은 컨텍스트 예산
초과로 `spec/conventions/error-codes.md`(spec_impact 대상 파일 자신)를 포함해 대부분의 타 영역
문서가 절단되어 있었다(`⚠️ 본문 생략됨` 표시, 예: `spec/0-overview.md`·`spec/1-data-model.md`·
`spec/5-system/1-auth.md` 전량). 이 절단은 알려진 시스템적 갭(`--spec` 모드 기본 예산이
`conventions/`를 통째로 떨어뜨림)이므로, 번들 대신 저장소의 실제 파일을 직접 `Read`/`grep`으로
열어 교차검증했다 — 아래 발견사항은 번들이 아니라 `origin` 워크트리의 실제 `spec/**` 파일 기준이다.

교차검증 대상: `spec/conventions/error-codes.md`(전문) · `spec/5-system/1-auth.md`(관련 절) ·
`spec/5-system/3-error-handling.md`(전문, 번들에 포함) · `spec/5-system/12-webhook.md` ·
`spec/5-system/14-external-interaction-api.md` · `spec/5-system/15-chat-channel.md` ·
`spec/data-flow/10-triggers.md` · `spec/data-flow/2-auth.md` · `spec/1-data-model.md` ·
`spec/2-navigation/9-user-profile.md` · `spec/4-nodes/7-trigger/providers/{slack,discord,telegram}.md`.

## 발견사항

없음 — CRITICAL·WARNING 대상 충돌을 찾지 못했다. 아래는 INFO 수준 관찰 2건이다.

- **[INFO]** `3-error-handling.md` Overview 의 "API 규약 §5.3 기본 코드를 override" 서술이 410 에는
  느슨하게 들어맞는다
  - target 위치: 결정② (§5.3 에 "410 은 매핑이 없다" 명시)
  - 충돌 대상: `spec/5-system/3-error-handling.md` Overview 문단 — "이 중 외부 표면(EIA §1.6·webhook
    §1.7)은 API 규약 기본 코드(API 규약 §5.3)를 의도적으로 override 하는 항목이다"
  - 상세: 결정②가 §5.3 에 "410 은 기본값이 없다"를 명시하면, EIA §1.6 의 `EXECUTION_TERMINATED`(410)·
    webhook/트리거 도메인의 `TRIGGER_INACTIVE`(410)를 "§5.3 기본값의 override"라 부르는 기존 문구가
    부정확해진다 — override 하려면 override 대상 기본값이 있어야 하는데 410 은 애초에 기본값이 없다.
    이 문구는 draft 이전부터 있던 서술이고 400/401/403/404/409/413/422/429/5xx 처럼 실제 기본값이
    있는 코드들에는 정확히 들어맞으므로, draft 가 만든 결함이 아니라 draft 가 노출하는 기존 문서의
    사소한 정밀도 갭이다.
  - 제안: target 범위 밖이라 이번 draft 에서 고칠 필요는 없다. 후속 소정정 시 "기본값이 있는 코드는
    override, 410 처럼 기본값이 없는 코드는 explicit-only" 로 한 구절 갈라 적으면 결정②와 완전히
    정합해진다.

- **[INFO]** §6 표에 추가될 `410 Gone` 행의 일반화 설명("리소스가 있었으나 소멸·비활성")이 chat-channel
  예외를 담지 않음
  - target 위치: 변경안 표 #2 (`410 Gone` 행 추가)
  - 충돌 대상: `spec/5-system/12-webhook.md` WH-EP-07 · `spec/5-system/15-chat-channel.md` R-CC-12
  - 상세: `config.chatChannel` 트리거는 비활성이어도 410 이 아니라 202(`{executionId:'ignored'}`)를
    반환하는 명시적 예외가 있다. §6 캐논 표가 이 예외를 생략하는 것 자체는 결함이 아니다 — §6 은
    cross-cutting 요약이고 이미 다른 행들(429·503 등)도 "도메인 spec 링크로 상세 위임" 패턴을 쓰며,
    target 도 결정①에서 "발행처 3모듈과 각 코드를 도메인 spec 링크로 지목"이라고 명시해 같은 위임
    패턴을 쓰기로 했다.
  - 제안: 실제 반영 시 §6 410 행에도 다른 행들과 동일하게 도메인 spec(12-webhook·15-chat-channel)
    링크를 붙이면 이 관찰은 소멸한다 — target 의 결정①이 이미 그렇게 하기로 선언했으므로 별도
    조치는 불필요, 반영 시 확인만 하면 된다.

## 실측 근거 (교차검증 상세)

1. **202/410 캐논 테이블 갭이 실재함**: 현재 `spec/5-system/2-api-convention.md` §6 표에는 실제로
   200·201·204·400·401·403·404·409·413·422·429·500·503 만 있고 202·410 이 없다(직접 확인). 반면
   `spec/5-system/12-webhook.md`(WH-EP-07·WH-RS-01)·`14-external-interaction-api.md`(EIA-NF-04·
   EIA-IN-12·R16)·`15-chat-channel.md`(R-CC-12)·`data-flow/10-triggers.md`(§1.2·§1.5)·
   `4-nodes/7-trigger/providers/{slack,discord,telegram}.md`·`conventions/swagger.md`(`ApiAcceptedWrappedResponse`)
   전부 `202 Accepted`/`410 Gone` 을 기정 사실로 참조한다. 즉 target 이 §6 에 두 행을 추가하는 것은
   기존에 이미 광범위하게 정착된 다영역 합의를 캐논 표에 **동기화**하는 것이며, 새 개념 도입이 아니다.
   충돌 없음.

2. **결정③ `INVALID_PASSWORD` 등재는 이미 도메인 spec 이 증언하는 사실과 정확히 일치**:
   `spec/5-system/1-auth.md:339` — *"`POST /users/me/change-password` 의 현재 비밀번호 재확인
   실패(미설정 OAuth-only·불일치)는 `INVALID_PASSWORD`(401, `users.service.changePassword`)를
   반환한다 — 재인증 `PASSWORD_INVALID`·`login_history.failure_reason` 동명 감사값과 별개 wire
   코드다"* — target 의 "두 조건(미설정/불일치)에 같은 코드" 주장과 **정확히 일치**한다.
   `spec/5-system/3-error-handling.md:50`(§1.2 카탈로그)에도 이미 동일 내용이 등재돼 있다. target 이
   추가하려는 것은 이 카탈로그(§1) 항목이 아니라 `conventions/error-codes.md` §3(명명 부정확성
   예외 레지스트리)의 신규 행이며, 실제로 `error-codes.md` 전문을 읽어 §3 에 `INVALID_PASSWORD` 행이
   **아직 없음**을 확인했다 — 등재 대상이 비어 있다는 target 의 전제가 맞다. 두 문서(카탈로그 vs
   명명규율 예외부)의 책임 경계는 `error-codes.md` Overview 가 이미 명시적으로 분리해 뒀고("본
   문서가 유일하게 소유하는 것: … ③ historical-artifact 예외 레지스트리"), §3 자체가 "**기존** 코드를
   등록한다" 고 범위를 선언하므로 이미 구현·문서화된 `INVALID_PASSWORD` 를 신규가 아니라 예외로
   등재하는 것도 정합적이다. 충돌 없음.

3. **3중 근접 명명 구분이 실제로 3개 레이어에 대응**: `PASSWORD_INVALID`(401, 재인증/2FA 재확인,
   `1-auth.md:337·521`) · `INVALID_PASSWORD`(401, 비밀번호 변경, `1-auth.md:339`) ·
   `login_history.failure_reason='INVALID_PASSWORD'`(감사값, `data-flow/2-auth.md:76` ·
   `1-data-model.md:710`) — target 의 "근접 명명은 3중이다" 절과 정확히 같은 3분류다. 어느 레이어도
   target 의 서술과 모순되지 않는다.

4. **발행처 수치의 코드 스팟체크** (spec 정합성 판단 보조용, 완결 검증은 별도 impl-conformance
   리뷰어 소관): `grep -rl "HttpCode(HttpStatus.ACCEPTED)" codebase/backend/src` → workflows·
   external-interaction·schedules·knowledge-base(×2)·hooks(×2)·executions = 7개 컨트롤러 파일,
   target 의 "7개 컨트롤러" 주장과 일치. `grep -rl "GoneException" codebase/backend/src`(스펙 제외) →
   external-interaction·workspaces·hooks = 3개 모듈, target 의 "3개 모듈" 주장과 일치. 두 수치 모두
   cross-spec 관점에서 draft 근거의 신뢰도를 뒷받침한다(다른 도메인 spec 이 언급하는 발행처 모듈
   목록과도 일치 — 위 1번 항목).

5. **§5.3 "410 매핑 없음" 이 다른 영역 문서의 관측과 상충하지 않음**: EIA(`14-external-interaction-api.md`)
   §5.1 은 410 에 `EXECUTION_TERMINATED` 를 명시 코드로 못박고, `data-flow/10-triggers.md` 는 410 에
   `TRIGGER_INACTIVE` 를 명시한다 — 즉 다른 모든 영역이 이미 "410 은 항상 명시 코드로 발행한다"는
   실무를 따르고 있고, 어느 영역도 "410 이 기본값 `INTERNAL_ERROR` 로 떨어져도 된다"는 전제에 기대지
   않는다. target 의 결정②(기본값을 만들지 않고 "명시 필수"만 적음)는 이 기존 실무와 정합한다.

## 요약

target draft(5곳 변경안: §6 테이블 202/410 추가, §5.3 "410 매핑 없음" 명시, `error-codes.md` §3
`INVALID_PASSWORD` 등재, `3-error-handling.md` §1.2 역참조)를 `spec/conventions/error-codes.md`·
`spec/5-system/1-auth.md`·`spec/5-system/12-webhook.md`·`spec/5-system/14-external-interaction-api.md`·
`spec/5-system/15-chat-channel.md`·`spec/data-flow/10-triggers.md`·`spec/data-flow/2-auth.md`·
`spec/1-data-model.md` 등 실제 타 영역 spec 원문과 대조했다(프롬프트 번들이 예산 절단으로 이 파일들
대부분을 담지 못해 파일시스템에서 직접 확인). 모든 항목이 이미 다영역에 정착된 실무·코드 발행
패턴과 정확히 일치하며, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도
CRITICAL/WARNING 급 모순을 찾지 못했다. draft 자체가 지적하는 "§6 이 §11.3/§11.4 본문과 자기모순"
문제는 실측대로 실재하는 갭이며, 제안된 수정이 그 갭을 정확히 메운다. INFO 2건은 target 범위를 벗어난
기존 문서의 사소한 정밀도 여지이며 target 의 정합성 판단에 영향을 주지 않는다.

## 위험도

NONE
