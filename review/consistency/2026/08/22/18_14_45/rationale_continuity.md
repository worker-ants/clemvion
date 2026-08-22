STATUS=success rationale_continuity review complete
===REPORT_MARKDOWN_BELOW===
# Rationale 연속성 검토 — `plan/in-progress/spec-draft-egress-masking-convention.md`

## 검토 방법

target(plan draft, 141행)을 직접 읽고, 프롬프트에 번들된 관련 spec Rationale(주로
`spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md`
§Rationale)과 대조했다. `spec/conventions/**` 는 `--spec` 모드 예산상 번들에서 빠지는 경향이
있어(기존 교훈), `node-output.md`·`node-cancellation.md`·`execution-context.md` 는 저장소에서
직접 열어 대조했다. target 이 인용하는 코드 라인·과거 리뷰 산출물(`review/consistency/2026/08/22/
15_35_56/naming_collision.md`)도 실측으로 재확인했다.

## 발견사항

- **[CRITICAL]** 좌표계 표의 값(2·3행)이 문서 자신의 서술·코드 SoT 와 정면으로 모순
  - target 위치: `plan/in-progress/spec-draft-egress-masking-convention.md` 79-88행 "실측한
    좌표계" 표, 특히 82행(`MAX_REDACT_DEPTH`)·83행(프런트 `MAX_MASK_DEPTH` 직접 사용) 의 "값"
    열 = `= 1`
  - 과거 결정 출처(모순 대상): (1) **같은 문서 90행 자체** — *"2·4 는 값이 같고 의미가
    다르다. 둘 다 **10** 이지만 비교가 `>=` vs `>` 라 마커가 놓이는 최대 깊이가 한 칸
    다르다(각각 10, 11)"* 라고 명시하는데, 이 "2" 는 바로 82행의 `MAX_REDACT_DEPTH` 행을
    가리킨다. (2) `spec/5-system/14-external-interaction-api.md` §R17 — *"마커 집합과 깊이
    상한의 SoT 는 공유 패키지 `@workflow/masked-markers` 다"*, 즉 `MAX_REDACT_DEPTH` 는 그
    SoT 의 별칭이어야 한다. (3) 코드 실측: `codebase/packages/masked-markers/src/index.ts:81`
    `export const MAX_MASK_DEPTH = 10;`, `codebase/backend/src/shared/utils/
    sanitize-error-message.ts:128` `export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH;` —
    즉 `MAX_REDACT_DEPTH` 는 **10**이지 1이 아니다. (4) target 이 스스로 인용하는 착수 차단
    이력 `review/consistency/2026/08/22/15_35_56/naming_collision.md` 도 같은 상수를
    *"`MAX_REDACT_DEPTH`(`MAX_MASK_DEPTH` 의 지역 별칭)"* 로 값 **10**을 전제로 서술한다.
    프런트 `hasMaskedMarkerLeaf` 도 `codebase/frontend/src/lib/utils/__tests__/
    masked-markers.test.ts:95-99` 에서 깊이 10까지 감지, 11에서 미감지로 스캔 범위가
    `0..10`(N=10)임을 테스트로 고정하고 있어 83행의 "= 1" 도 동일하게 틀렸다.
  - 상세: 이 draft 전체의 존재 이유는 *"세 상한(깊이·비교연산자·소비처)의 좌표계를 사람이
    한눈에 보게 해 CRITICAL 을 냈던 그 혼동을 막는다"* 는 것이다(본문 §"이 갭이 실제로 물었다"
    가 인용하는 `naming_collision` CRITICAL 사건). 그런데 정작 이 표의 두 셀이 SoT 값(10)을
    1로 잘못 적어, 표를 그대로 신뢰하는 후속 독자가 "정밀 고정" 테스트나 새 소비처를 짤 때
    깊이 상한을 1로 오해할 위험이 있다 — 이는 이 문서가 스스로 막겠다고 선언한 바로 그 실패
    모드(잘못된 상수/경계를 겨냥한 정밀 고정)를 문서 자신이 재현하는 것이다. "기각된 대안
    재도입"은 아니지만, 문서가 명시한 검증 기준 *"좌표계 표의 모든 셀이 실측 출처를 가진다"*
    (140행)를 이 두 셀이 충족하지 못하고, R17 이 확립한 SoT 값(10) 이라는 기록된 invariant 를
    직접 위반한다.
  - 제안: 82·83행의 "값" 열을 `10`(또는 `= MAX_MASK_DEPTH(10)`)으로 정정. 90행의 "2·4 는 값이
    같다" 서술과 표를 재대조해 일치시킨 뒤 `/consistency-check --spec` 재실행. `spec/
    conventions/egress-masking.md` 실제 신설 시 이 표를 그대로 옮기지 않도록 주의(현재 오류가
    그대로 정본 문서로 승격될 위험).

## 확인된 정합 사항 (참고 — 문제 아님)

아래는 target 이 과거 Rationale 을 정확히 계승하고 있음을 확인한 항목으로, 별도 조치 불요:

- **"세 상한을 하나로 합친다" 대안의 기각 인용이 실재한다**: `codebase/packages/
  masked-markers/src/index.ts:79` 에 `"별개 불변식이므로 합치지 않는다 — 공유 프리미티브를
  넓히면 무관한 경로가 오염된다"` 문구가 그대로 존재 — 지어낸 이력이 아니다.
- **"신규 repo-guard" 대안 기각의 선례 인용도 실재한다**: `plan/complete/
  harness-session-anchor-guards.md:155`, `plan/complete/
  harness-push-guard-subcommand-detection.md:56` 에 "유한한 문제를 무한한 문제와 맞바꿨다"
  계열 문구가 실제로 있다.
- **`node-cancellation.md` ↔ `execution-context.md` SoT 분리 선례**: `spec/conventions/
  node-cancellation.md:23` 에 *"SoT 분리: … 필드 정의 SoT 는 execution-context.md §원칙 1,
  동작 계약 SoT 는 본 문서"* 로 정확히 일치하는 선례가 있다 — EIA §R17 을 확장하지 않고 별도
  conventions 문서로 분리하겠다는 target 의 판단이 이 선례와 부합한다.
- **`node-output.md` 의 기존 egress 마스킹 콜아웃과 오너십 충돌 없음**: `spec/conventions/
  node-output.md:314-323` 에 이미 2026-08-17 자 콜아웃(EIA §R17·WS §4.1 인용)이 있고, target
  은 이를 대체하지 않고 신설 문서로 재인입 포인터만 바꾸겠다고 명시 — Principle 7 "절대 echo
  금지" 원칙을 우회하지 않는다.
- **호출 순서·마스킹-once 규율**: `websocket.service.ts:406-417` 의
  `toFanoutEnvelope` JSDoc(strip → routing 첨부, 재마스킹 금지)과 `sanitize-error-message.ts:
  301-302` 의 `isMaskedMarker(v) ? v : VALUE_MASK_MARKER` 가 target 121-123행·118-120행의
  서술과 라인 단위로 일치한다.
- **`stripExternalOnlyFields` 호출부 2곳**: `interaction.service.ts:112`(`MAX_REDACT_DEPTH`)·
  `websocket.service.ts:422`(`MAX_SANITIZE_DEPTH`) 인용이 실제 코드와 정확히 일치.
- **`llmCalls` strip-only 결정 "번복되지 않았다"**: target 은 이 결정을 건드리지 않고
  그대로 전제만 참조 — WS Rationale 의 2026-08-16 보강("병존이며 번복 아님")과 모순 없음.

## 요약

target 은 Rationale 계승 관점에서 이례적으로 꼼꼼하다 — "기각한 대안" 4건 전부가 실제 코드
JSDoc·과거 plan 문서·다른 spec 의 SoT 분리 선례를 정확한 라인 단위로 인용하고 있고, 기존
결정(3-상한 비병합, `llmCalls` strip-only, node-output Principle 7)을 뒤집지 않으면서 소유권
경계만 좁게 신설한다. 다만 문서의 핵심 산출물인 "실측한 좌표계" 표 자체에서 `MAX_REDACT_DEPTH`
관련 두 셀의 값이 문서 자신의 다른 문장·R17·코드 SoT 가 모두 가리키는 10 이 아니라 1 로 잘못
기재돼 있다 — 이는 이 작업이 막으려는 바로 그 혼동을 정본화 직전 문서에 재도입하는 것과
같은 효과를 낸다. 이 한 군데를 정정하면 Rationale 연속성 관점에서 남는 리스크는 없다.

## 위험도

MEDIUM
