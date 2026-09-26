# Rationale 연속성 검토 — impl-prep scope (`request-body-guard`)

## 검토 범위와 방법

- target: impl-prep scope 번들(`spec/5-system/15-chat-channel.md` 전문 · `spec/conventions/swagger.md` 전문 —
  `2-api-convention.md`/`12-webhook.md` 는 예산 초과로 생략, `spec/5-system/2-api-convention.md` ·
  `spec/5-system/12-webhook.md` 를 filesystem 에서 직접 열람해 보완) + 다수 spec 의 `## Rationale` 발췌.
- 대조: swagger.md 자신의 `## Rationale`(§1-4/§3 "신규 변경 한정" vs §2-4/§5-4-403 "소급 적용" 이분법, §1-7 "범위를
  넓히지 않는다" 원칙), chat-channel spec §5.4/§5.4.1 (rotate-bot-token 계약), `2-api-convention.md`·`12-webhook.md`
  전체 `## Rationale`(filesystem 직접 열람), `plan/in-progress/request-body-guard.md`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 항목(«요청 본문 스키마의 규칙과 가드»),
  실제 코드(`chat-channel-rotate-bot-token-request.dto.ts` 계열 커밋 `a3a418ae3`).
- 참고: 같은 spec 변경에 대해 `--spec` 단계에서 이미 한 차례 Rationale 연속성 검토가 수행됐다
  (`review/consistency/2026/09/26/18_59_58/rationale_continuity.md`, 위험도 LOW). 본 리포트는 그 결과가
  `--impl-prep` 시점(chat-channel 코드 영역까지 포함한 더 넓은 scope)에도 여전히 성립하는지, 그리고 그 리포트가
  남긴 INFO 들이 이후 커밋(`f71f5df06`)에서 실제로 반영됐는지를 재확인하는 데 집중했다.

## 발견사항

- **[INFO]** 선행 리뷰(18_59_58)의 INFO 2건은 최종 커밋에서 반영 확인됨 — 새 결함 아님, 기록 목적
  - target 위치: `spec/conventions/swagger.md` §5-4 체크리스트 4번째 항목 · Rationale
    "§5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가 (2026-09-26)"
  - 과거 결정 출처: `review/consistency/2026/09/26/18_59_58/rationale_continuity.md` 발견사항 1(`@ApiExcludeController()`
    제외 범위 누락)·발견사항 3(`schema:{}` 와 §1-4 `additionalProperties:true` 의 관계 미연결)
  - 상세: 두 지적 모두 확정 커밋에 흡수돼 있다 — 체크리스트가 `@ApiExcludeEndpoint()` 와 `@ApiExcludeController()` 둘
    다 명시하고, Rationale 이 "`schema: {}` 와 열린 map 은 다르다 … 객체는 보장되고 키만 열려 있으면 §1-4 의
    `additionalProperties: true` 다" 로 두 표기의 경계를 명시적으로 구분했다. 번복이 아니라 이전 검토 사이클의
    정상적 수렴이다.
  - 제안: 조치 불필요.

- **[INFO]** 트래커 원문의 "AST" 표기가 아직 취소선 없이 남아 있음 (재확인 — 여전히 미해소)
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` line 5150
    ("2. **가드(developer)**: AST — `@Body()` 파라미터 타입이 클래스 참조가 아니면 …")
  - 과거 결정 출처: `plan/in-progress/request-body-guard.md` §방향 및 `spec/conventions/swagger.md` §5-4 Rationale
    ("reflection 으로 센다 … 소스(AST)로는 `interface`·타입 별칭 참조가 런타임에 `Object` 가 되는 것을 클래스
    참조와 구별할 수 없다")
  - 상세: 판정 축이 AST → reflection(`design:paramtypes`) 으로 바뀐 것 자체는 **새 Rationale을 동반한 정당한
    번복**이라 위반이 아니다(criterion 3 통과). 다만 그 전환의 출처인 트래커 5141행 항목은 여전히 "AST" 라고
    적혀 있어, 이 트래커만 다시 읽는 다음 세션에게 낡은 신호를 줄 수 있다. `request-body-guard.md` 체크리스트
    마지막 항목("트래커 항목 좁히기(남는 §1-7 · 리네임) · 닫힌 부분 기록")이 이 정정을 흡수할 자리로 이미
    예정돼 있다.
  - 제안: 가드 구현을 마치고 트래커를 닫는 커밋에서 5150행 "AST" 를 취소선 처리하고
    "~~AST~~ → reflection(`design:paramtypes`) — 사유는 swagger.md §5-4 Rationale·`request-body-guard.md` 참조"
    로 정정 각주를 남긴다. 이번 --impl-prep 단계에서 BLOCK 사유는 아니다.

## 정합성 확인 (위반 없음으로 판정한 항목들)

- **"요청 DTO 승격" 기각의 일관성**: swagger.md 의 새 Rationale 은 "트래커가 처음 적었던 처방(«요청 DTO 승격»)을
  택하지 않는다"고 명시하고, 이유(전역 `CustomValidationPipe` 진입 시 `INVALID_BOT_TOKEN`→`VALIDATION_ERROR`,
  여분 키 400)를 chat-channel §5.4 의 실제 에러 코드 표(`INVALID_BOT_TOKEN` 400)와 대조해도 어긋나지 않는다 —
  지어낸 이력이 아니라 실제 커밋(`a3a418ae3`)이 택한 설계와 일치한다.
- **"문서 전용 DTO" 패턴은 신규 결정이 아니라 기존 선례(`ExecuteWorkflowDto`)의 확장**이다. swagger.md 어디에도
  "모든 `@Body()` 는 class-validator 로 검증돼야 한다" 는 상충 원칙이 없고(`5-system/*.md`·`conventions/*.md` 전수
  grep 결과 그런 전역 불변식 서술 없음), 오히려 §1-7 이 이미 "top-level 요청 바디" 개념을 다루면서도 검증 유무를
  강제하지 않는다.
- **소급 vs 신규-한정 분류의 일관성**: 요청 본문 규칙은 "광고가 실제와 맞는가" 유형(§2-4·§5-4-403 과 동류)이라
  전 라우트(78개 `@Body()`) 소급 적용을 선언하며, 이는 §1-4/§3 이 명시한 "신규 변경 한정" 예외와 서로 다른
  갈래로 이미 문서가 구분해 둔 것과 정확히 일치한다.
- **webhook 본문 스키마 표기(`@ApiBody({ schema: {} })`)와 §5.5 케이스 매트릭스의 정합**: chat-channel §5.5 는
  `POST /api/hooks/:endpointPath` 의 입력 형태를 provider 마다 다른 것으로 이미 전제하고 있고, `12-webhook.md`
  WH-EP-04/05(JSON·form-urlencoded 수신, body 전체를 그대로 전달)와도 어긋나지 않는다. `12-webhook.md`
  `## Rationale` 전문을 직접 열람했으나 "웹훅 본문을 OpenAPI 에 노출하지 않는다" 류의 상충 결정은 존재하지
  않는다.
- **`2-api-convention.md` `## Rationale` 전문 대조**: 413 분리 임계·에러 envelope·비-페이징 컬렉션 등 기존 결정
  중 요청 본문 스키마 광고 정책과 상충하는 항목 없음.
- **chat-channel 자체 Rationale(R-CC-18/21/23 등)과의 대조**: rotate-bot-token 의 workspace 검증·PATCH 비밀
  차단·setupChannel 실패 분류는 모두 요청 본문 스키마 광고 여부와 직교하는 축이며, 이번 target 변경이 그
  결정들을 재론하거나 훼손하지 않는다.
- **선행 `--spec` Rationale 연속성 리뷰(18_59_58)의 "위반 없음" 결론은 --impl-prep scope 확장(코드 영역 포함) 후에도
  유지된다** — 새로 포함된 chat-channel 본문(§5.4/§5.4.1/§5.5)과 대조해도 추가 충돌이 발견되지 않았다.

## 요약

target(impl-prep scope: `swagger.md` §5-4 신규 규칙·Rationale + `15-chat-channel.md` 관련 계약)은 기존 spec 의
Rationale 을 계승한다. "요청 DTO 승격 기각"·"문서 전용 DTO"·"소급 vs 신규-한정 이분법"·"reflection 판정 축" 은
모두 실제 커밋·코드 이력과 대조해도 지어낸 근거가 아니며, 선행 `--spec` 단계 Rationale 검토(LOW)가 지적한 INFO
2건은 최종 커밋에서 이미 반영됐다. 유일하게 남는 것은 트래커 원문("AST")이 판정 축 전환(→ reflection)을
아직 취소선으로 반영하지 않은 plan 위생 문제로, spec Rationale 위반이 아니라 가드 구현·트래커 종결 시 정정하면
되는 INFO 다. Critical·Warning 급 발견사항은 없다.

## 위험도

LOW
