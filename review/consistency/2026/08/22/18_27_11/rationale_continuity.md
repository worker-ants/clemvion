STATUS=success rationale_continuity review complete
===REPORT_MARKDOWN_BELOW===
# Rationale 연속성 검토 — `plan/in-progress/spec-draft-egress-masking-convention.md`

## 검토 방법

target(plan draft, 194행)을 전문 읽고, 번들된 관련 spec Rationale(`spec/1-data-model.md`,
`spec/5-system/6-websocket-protocol.md` §Rationale, `spec/5-system/14-external-interaction-api.md`
§R17 전문)과 대조했다. `spec/conventions/**`(`node-output.md`·`node-cancellation.md`·
`execution-context.md`·`secret-store.md`)와 `spec/1-data-model.md §2.17.2`는 저장소에서 직접
열어 확인했다. target 의 "기각한 대안" 4건이 인용하는 근거(코드 JSDoc·plan 문서·타 spec 의
SoT 분리 선례)는 실제 소스 파일을 열어 문구를 대조했다. 직전 라운드 산출물
(`review/consistency/2026/08/22/18_14_45/rationale_continuity.md`, `.../convention_compliance.md`)
을 읽어 이번 라운드가 그 지적을 실제로 반영했는지도 확인했다.

## 발견사항

이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없다. 직전 라운드가 잡은 CRITICAL 은
해소를 확인했다.

- **[해소 확인, 참고용]** 좌표계 표 값 오류(직전 라운드 CRITICAL)가 정정됨
  - target 위치: "실측한 좌표계" 표 2·3행 (현재 109-115행)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17 "마커 집합과 깊이
    상한의 SoT 는 공유 패키지 `@workflow/masked-markers` 다" + 코드
    `codebase/packages/masked-markers/src/index.ts:81`(`MAX_MASK_DEPTH = 10`)
  - 상세: 직전 라운드(`18_14_45`)는 2·3행의 "값" 열이 `= 1` 로 오기재돼 R17 이 확립한
    SoT 값(10)과 정면 모순한다고 CRITICAL 판정했다. 현재 버전은 두 행 모두 `**10**`
    (각각 "1행 재export"/"1행 그대로")로 정정돼 있고, 90행대의 "2·4 는 값이 같고 의미가
    다르다(각각 10, 11)" 서술과도 정합한다. `depth >= N`(N=10, row 2/3) vs `depth > N`
    (N=10, row 4) 비교도 코드(`sanitize-error-message.ts`, `masked-markers/src/index.ts`)와
    일치.
  - 제안: 없음 — 조치 불요.

- **[INFO]** "기계 검사 repo-guard" 기각 근거가 spec Rationale 이 아니라 plan 문서 출처
  - target 위치: "## Rationale" > "기각한 대안" 4번째 항목(현재 191-194행)
    *"이 저장소는 '유한한 문제를 무한한 문제와 바꾸지 말 것' 을 이미 등재했다"*
  - 과거 결정 출처: `plan/complete/harness-session-anchor-guards.md`,
    `plan/complete/harness-push-guard-subcommand-detection.md` — 둘 다 실재하는 문구이나
    **spec `## Rationale` 이 아니라 plan/harness 설계 결정**이다(CI 가드의 blind-regex vs
    정밀 파서 트레이드오프에 대한 결정이며, 문서 좌표계 검증 repo-guard 와는 다른 문제
    도메인).
  - 상세: 인용 자체는 지어낸 이력이 아니고(두 plan 파일에 문구가 그대로 존재, 이미 두
    라운드 전에 실측 확인됨) 유비(analogy)로서도 합리적이지만, 본 checker 의 심사 대상인
    "spec 의 `## Rationale`" 범주 밖의 출처를 spec 문서의 정식 기각 근거처럼 제시하고
    있다. 신설되는 `spec/conventions/egress-masking.md` 의 Rationale 로 그대로 옮겨 적으면
    독자가 "동일 도메인의 spec 선례"로 오독할 여지가 있다.
  - 제안: 필수 아님. 신설 문서로 옮길 때 "(harness CI 가드 설계 결정에서 원용한 유비)"
    정도의 출처 성격 명시를 덧붙이면 더 명확해진다.

## 확인된 정합 사항 (참고 — 문제 아님)

- **"세 상한 비병합" 결정 재확인**: `masked-markers/src/index.ts:79` JSDoc *"별개 불변식이므로
  합치지 않는다 — 공유 프리미티브를 넓히면 무관한 경로가 오염된다"* 를 정확히 인용, 기각
  대안으로 재도입하지 않고 오히려 그 결정을 존속 근거로 삼는다.
- **`node-cancellation.md`/`execution-context.md` SoT 분리 선례**: `node-cancellation.md:23`
  *"필드 정의 SoT 는 execution-context.md §원칙 1, 동작 계약 SoT 는 본 문서"* 와 정확히
  일치하는 선례 — target 이 EIA §R17 을 확장하지 않고 별도 conventions 문서로 분리하는
  판단의 근거로 유효하게 원용.
- **`AuthConfig.config` 비대상 콜아웃 형식 선례**: `secret-store.md:40` 의 "비대상 —
  `AuthConfig.config`" 콜아웃 및 `1-data-model.md §2.17.2`(*"본 §2.17.2 가 AuthConfig 마스킹
  정책의 단일 진실"*)와 target 의 서술(96-100행)이 SoT 소재를 정확히 일치시킨다 — 필드 단위
  정책 vs egress 값-패턴 마스킹의 경계를 새로 긋는 것이 아니라 기존 경계를 재확인.
- **`node-output.md` egress 마스킹 콜아웃과 충돌 없음**: `node-output.md:314-323`(2026-08-17
  결정, Principle 7 "절대 echo 금지" 의 backstop)의 EIA §R17·WS §4.1 인용 포인터를 target 은
  대체하지 않고 신설 문서로 갱신만 예고 — Principle 7 우회 없음.
- **`toFanoutEnvelope` 마스킹-once 순서**: `websocket.service.ts` 실측 —
  `maskWireEnvelope`(271/345행) → `toFanoutEnvelope` 내부 `stripExternalOnlyFields`(422행) →
  `attachRoutingContext`(426행) 순서가 target 143-146행 서술과 라인 단위로 일치, JSDoc
  (413-415행)도 "순서는 strip → routing 첨부다. 재마스킹하면 attachRoutingContext 가 붙인
  마커를 덮는다"로 동일 규율을 명시.
- **`llmCalls` strip-only 결정 불변**: EIA Rationale 361행 갱신 노트("적용 대상이 명확해졌을
  뿐 번복되지 않았다")와 target 은 이 결정을 건드리지 않고 전제로만 참조 — 모순 없음.
- **WS §4.1 신규 인입 포인터는 추가일 뿐 충돌 없음**: `spec/5-system/6-websocket-protocol.md`
  에는 현재 `MAX_SANITIZE_DEPTH` 언급이 전혀 없어(실측, grep 0건) target 의 "인입 포인터
  3곳" 계획은 기존 서술을 뒤집는 것이 아니라 빈 자리를 채우는 additive 변경.

## 요약

이 target 은 Rationale 연속성 관점에서 이례적으로 꼼꼼하다. "기각한 대안" 4건 중 3건은
spec/코드/plan 의 실제 문구를 라인 단위로 정확히 인용하며, 어느 것도 과거에 명시적으로
기각된 결정을 근거 없이 재도입하지 않는다. `llmCalls` strip-only·node-output Principle 7
echo 금지·EIA §R17 egress-only 원칙·`MAX_MASK_DEPTH`/`MAX_SANITIZE_DEPTH` 비병합 결정 등
기존 Rationale 이 박아 둔 invariant 를 모두 우회 없이 계승하고, 신설 문서는 그 위에 "주인
없던 좌표계"만 좁게 소유권을 신설한다. 직전 라운드(`18_14_45`)가 잡은 유일한 CRITICAL(표
값 `1`↔`10` 오기재)은 이번 버전에서 정정을 확인했다. 유일한 잔여 지적은 INFO 수준으로,
"기계 검사 repo-guard" 기각 근거가 spec Rationale 이 아니라 plan/harness 문서에서 원용한
유비라는 출처 성격 표기 문제이며 차단 사유는 아니다.

## 위험도

NONE
