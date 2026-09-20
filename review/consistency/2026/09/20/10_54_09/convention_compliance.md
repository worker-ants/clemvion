# 정식 규약 준수 검토 — SSRF catch instanceof (impl-done)

대상: `spec/4-nodes/4-integration/` (scope 델타 0개 파일 — 이 PR 은 코드 전용) + 구현 diff 10개 파일/594줄
(`http-safety.ts` 소비부 4곳의 catch 를 `instanceof SsrfBlockedError` 로 가르는 변경).

`SsrfBlockedError` 클래스 자체는 이 PR 이전(`origin/main`, PR #1361 계열)에 이미 존재하며 `http-safety.ts` 는
이번 diff 에 포함되지 않는다 — 이번 변경은 그 클래스를 **소비하는 4곳**(`http-request.handler.ts` ·
`http-redirect.ts` `outboundBlockReason` · `database-query.handler.ts` · `database-connection-tester.ts` ·
`http-connection-tester.ts`)의 catch 를 "가드가 던진 것은 무엇이든 차단" 에서 "판정(`SsrfBlockedError`)과
가드 자체 고장(그 외 오류)을 구분" 으로 바꾼다.

## 발견사항

- **[WARNING] `1-http-request.md` frontmatter `code:` 가 이번에 실질적으로 손댄 `http-redirect.ts` 를 누락**
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` (4개 항목:
    `http-request.handler.ts` · `http-request.schema.ts` · `http-safety.ts` · `sanitize-response-headers.util.ts`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — `code:` 는 "본 spec 이 약속한 surface 의 구현
    경로" 를 가리켜야 한다.
  - 상세: `http-redirect.ts` 는 §4 step 9(리다이렉트 5홉 + 홉마다 SSRF 재검증)와 §5.8/§6 이 명시하는
    "redirect 대상·한도 초과 SSRF 차단 → `HTTP_BLOCKED`" 를 구현하는 파일인데 `code:` 목록에 없다. 이번
    PR 은 그 파일의 판정 분기 로직을 바꾸고 신규 테스트 파일 `http-redirect.spec.ts` 를 처음으로 추가했음에도
    frontmatter 는 갱신되지 않았다(scope 델타 0 — spec 파일 자체를 이 PR 이 건드리지 않았으므로 당연한 결과).
  - 확인: `spec-code-paths.test.ts` 빌드 가드는 "≥1 매치" 만 요구해 이 gap 으로 깨지지 않는다(다른 3개 경로가
    존재) — 사람이 갱신해야 하는 완결성 문제.
  - **이미 등재됨** — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 커밋에서
    planner 항목으로 새로 추가됐다("`1-http-request.md` frontmatter `code:` 에 `http-redirect.ts` · 세
    에러 표에 «가드의 고장» 트리거", 2026-09-20 등재, `--impl-prep review/consistency/2026/09/20/09_06_34`
    convention WARNING 2 인용). `developer` 는 `spec/` 을 직접 못 고치므로(§자기-반증형 소정정의 좁은 예외에도
    해당 안 함 — "증거 목록 누락" 은 예고 정정이 아니다) planner 위임이 올바른 처리다.
  - 제안: 신규 조치 불요(planner 턴에서 흡수). 이 항목은 "새로 발견"이 아니라 **HEAD 시점에도 여전히 열려 있는
    상태를 재확인**한 것 — 다음 planner 턴에서 `code:` 에 `http-redirect.ts` 를 추가할 것.

- **[WARNING] 에러 코드 표에 신규 "가드 고장" 트리거(`INTEGRATION_CALL_FAILED`)가 미등재**
  - target 위치: `0-common.md` §4.2(공통 에러 코드), `1-http-request.md` §6(에러 코드), `2-database-query.md`
    §6(에러 코드)
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — `output.error` 표준 형태 및 코드 enum 이
    노드별 spec 문서에 정의돼야 한다는 전제(§3.2.2 "details 의 노드별 선택 스키마"와 동일한 결의 — 표가 실제
    발행 가능한 코드 전부를 나열해야 예측 가능성이라는 설계 목표를 만족).
  - 상세: 이번 PR 이 `http-request.handler.ts` / `database-query.handler.ts` / `database-connection-tester.ts`
    에 새로 추가한 분기("SSRF 가드가 `SsrfBlockedError` 가 아닌 오류를 던지면 차단이 아니라 `INTEGRATION_CALL_FAILED`
    /`DB_CONNECT_FAILED` 로 승격")는 코드 값 자체는 기존 §4.2/§6 표에 이미 있는 코드를 재사용하므로 **envelope
    형식 위반은 아니다** — 다만 그 코드가 발행되는 **새 조건**(가드 자체 고장)이 표에 한 줄로 반영돼 있지 않다.
  - **이미 등재됨** — 같은 planner 항목이 "(2) `0-common.md` §4.2 · `1-http-request.md` §4.2 · `2-database-query.md`
    §6.2 의 에러 코드 표에 «SSRF 가드가 판정 아닌 오류를 던진 경우 → `INTEGRATION_CALL_FAILED`» 를 한 줄씩" 을
    같은 항목에 함께 적어 뒀다.
  - 제안: 신규 조치 불요. planner 턴에서 위 항목과 함께 처리.

- **[INFO] 같은 근본 원인(가드 "고장")이 HTTP Request 노드 안에서 호출 지점에 따라 다른 코드로 나간다**
  - target 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (preflight
    catch) vs `http-redirect.ts` `followRedirectsSafely`(리다이렉트 홉 catch, 코드는 diff 밖)
  - 위반 규약: `spec/conventions/error-codes.md` §1 (의미 기반 명명) — 같은 조건에는 같은 이름이 대응해야
    "이름만으로 분기 의미가 드러난다".
  - 상세: preflight 단계에서 가드가 판정 아닌 오류를 던지면 `INTEGRATION_CALL_FAILED`(이번 PR 이 신설한 분기)로
    가지만, 리다이렉트 홉 단계의 동일 오류는 `followRedirectsSafely` → 전송 catch 를 거쳐 `HTTP_TRANSPORT_FAILED`
    로 나간다(이번 PR 은 그 경로를 승격하지 않았다). 두 코드 각각은 자기 맥락에서는 의미가 맞지만, "가드가
    고장났다" 라는 같은 사건이 시점에 따라 다른 `error.code` 로 관측된다.
  - 각주: `error-codes.md` §1 원칙에 대한 엄밀한 위반이라기보다 **일관성 설계 질문**에 가깝고, `/ai-review`
    3라운드가 이미 이 정확한 지점을 W1/W2 로 지적·수렴 예외 처리했다(`review/code/2026/09/20/10_38_57`
    RESOLUTION §종결 판정). 오늘 가드가 낼 수 있는 유일한 비판정 오류(`isBlockedHostname` 의 `TypeError`)는
    `validateCredentials` 가 그 입력을 API 단에서 거절해 **실제로 도달 불가**함이 실측됐다.
  - 제안: 현행 처분(등재·수렴)을 유지. 재작업 불요 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 두 해법 후보(홉 승격 통일 / spec 표에 두 코드 명시)와 함께 기록돼 있다.

- **[INFO] 가드 "고장" 메시지는 `sanitizeMessage`(자격증명 패턴 정규식)만 거치고, 차단 **판정**과 같은
  host/IP 일반화 문구를 쓰지 않는다**
  - target 위치: `http-request.handler.ts` / `database-query.handler.ts` / `database-connection-tester.ts`
    의 신규 `if (!(err instanceof SsrfBlockedError))` 분기
  - 위반 규약: `spec/conventions/egress-masking.md` 는 "깊이 상한 기반 마스커" 좌표계만 소유하므로 엄밀히는
    본 문서의 SoT 범위 밖이다(`sanitizeMessage` 는 그 좌표계 표에 행이 없다 — 별개의, 더 오래된 정규식 기반
    마스커). 다만 인접 원칙인 `1-http-request.md` §8.3 Rationale(정찰 면 축소, CWE-209)의 취지와는 비대칭이다
    — 판정은 host/IP 를 완전히 빼는 고정 문구를 쓰지만, 고장 메시지는 자격증명류 패턴만 가리고 원문(예:
    TypeError 메시지)을 그대로 낸다.
  - 상세: 오늘 가드가 던질 수 있는 유일한 비판정 오류에는 host/IP 가 들어있지 않아 실질 유출은 없음이
    실측됐다(같은 plan 항목). 구조적으로는 "판정 분기와 비대칭" 이라는 지적이 맞다.
  - **이미 등재됨** — `plan/in-progress/spec-draft-nullable-notation-followups.md` ("가드 «고장» 메시지에는
    host/IP 마스킹이 없다 — 판정 분기와 비대칭", 2026-09-20 등재, `/ai-review review/code/2026/09/20/10_09_56`
    WARNING 1 · INFO 11 인용).
  - 제안: 신규 조치 불요. 고칠 때 "세 곳을 고정 문구로 바꿀지 vs `sanitizeMessage` 에 host/IP 패턴 추가" 결정은
    이미 등재된 대로 후속 턴에서.

- **[INFO] (참고, 본 검토 범위 밖) `plan/in-progress/spec-draft-nullable-notation-followups.md` 가
  `plan/complete/ssrf-catch-instanceof.md` 를 인용하지만 실제 경로는 `plan/in-progress/ssrf-catch-instanceof.md`
  (frontmatter `status: in-progress`)**
  - 이는 `spec/conventions/**` 준수 문제가 아니라 plan 위생(`plan-lifecycle.md`) 사안이라 본 checker 의
    1차 판단 범위 밖이나, 다른 관점 없이 지나치면 참조가 착지하지 않으므로 기록만 남긴다. `spec_impact: none`
    이고 어떤 spec frontmatter 도 이 경로를 `pending_plans:` 로 참조하지 않아 `spec-pending-plan-existence.test.ts`
    가드는 깨지지 않는다.

## 명명 규약 / 출력 포맷 규약 / 문서 구조 규약 / API 문서 규약 — 위반 없음

- **명명**: 신규·재사용 코드값(`INTEGRATION_CALL_FAILED` · `DB_CONNECT_FAILED` · `HTTP_CONNECT_FAILED`)
  모두 `UPPER_SNAKE_CASE`(node-output.md §3.2)이고, `error-codes.md` §1 "의미 기반 명명" 에 부합 —
  `INTEGRATION_CALL_FAILED` 는 이미 "IntegrationError 가 아닌 throw 의 기본 코드(분류되지 않은 실패)"
  로 정의돼 있고(`0-common.md` §4.2), 가드 자체 고장이 그 정의에 정확히 포섭된다. `DB_CONNECT_FAILED` 도
  기존 JSDoc이 "그 밖(네트워크·타임아웃·TLS·없는 database 등)" 이라는 광의 fallback 범주로 이미 정의해 뒀다.
  `SsrfBlockedError` 클래스명은 wire `error.code` 가 아니라 내부 판별자라 error-codes.md 적용 대상이 아니다.
- **출력 포맷**: `output.error.{code,message,details}` envelope 형태 불변, `config/output/meta/port` 5필드
  불변. 새 분기 모두 기존 envelope 을 재사용(`buildPreflightErrorOutput`).
- **문서 구조(Overview/본문/Rationale)**: 이번 PR 은 spec 파일을 건드리지 않아 구조 위반 소지가 없다.
- **API 문서 규약(swagger/OpenAPI)**: 컨트롤러·DTO 변경 없음 — 해당 없음.
- **금지 항목**: `spec/5-system/3-error-handling.md` §6.3.1 C2(원본 객체를 `cause` 로 붙이지 말 것)를
  코드 주석이 명시적으로 인용하며 준수(`database-query.handler.ts` 신규 주석). egress-masking.md 의
  "마스킹은 한 번" 원칙과 상충하는 재마스킹 패턴 없음.

## 요약

이번 diff(SSRF 가드 소비자 4곳의 catch 를 `instanceof SsrfBlockedError` 로 가르는 변경)는 코드 레벨에서
`spec/conventions/error-codes.md`(의미 기반 명명) · `node-output.md`(envelope 불변) · 기존 마스킹 관행을
충실히 따른다. 발견된 두 WARNING(§`1-http-request.md` frontmatter `code:` 의 `http-redirect.ts` 누락,
에러 코드 표의 "가드 고장" 트리거 미등재)은 `spec/conventions/spec-impl-evidence.md` 관점에서는 실재하는
현재 상태의 gap 이 맞지만, 이미 이번 커밋 안에서 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 planner 담당 항목으로 정확히 등재돼 있어 **신규 발견이 아니라 재확인**이다 — developer 가 spec 을 직접
고치지 않고 위임한 것은 CLAUDE.md 의 쓰기 경계를 올바르게 지킨 처리다. 세 INFO 항목(코드-분기별 비대칭
error code, 가드 고장 메시지의 부분적 마스킹, plan 경로 참조 stale)도 모두 `/ai-review` 3라운드 수렴 예외로
이미 처분·등재된 것의 재확인이며, 오늘 시점에는 실제 도달 불가함이 실측돼 있다. 신규 CRITICAL 은 없다.

## 위험도

LOW
