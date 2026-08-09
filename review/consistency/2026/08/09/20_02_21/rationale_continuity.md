# Rationale 연속성 검토 보고서

## 검토 범위·방법 (중요 — 판정 해석 시 참고)

target 은 `spec/5-system/` 디렉토리 전체(18개 파일, 코드 diff 아님 — 현재 커밋된 spec 원문 전체를 --impl-prep bundle 로 받음)였고, 대조 대상은 나머지 spec 전 영역(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/**`, `spec/3-workflow-editor/**`, `spec/4-nodes/**`, `spec/data-flow/**`, `spec/7-channel-web-chat/**` 등 70+ 문서)의 `## Rationale` 전문이었다. 프롬프트 페이로드가 15,571줄(약 1.6MB)에 달해 전 조합을 라인 단위로 전수 대조하는 것은 이번 세션 예산 내에서 불가능했다. 따라서:

1. target 18개 파일 각각의 자체 `## Rationale` 절(17개 파일에 존재)을 확인.
2. target 과 도메인이 직접 겹치는 `spec/0-overview.md`·`spec/1-data-model.md`·`spec/data-flow/{0,1,3,7,11,12,2,4,5,6,8,9,10,13,14,15}-*.md` 의 Rationale 전문을 정독.
3. target 전체(11,303줄)에서 "기각/폐기/번복/철회/채택하지 않" 마커가 붙은 100여 개 결정 문장을 grep 으로 추출해 각각이 "새 근거 없이 조용히 재도입"된 패턴이 아니라 명시적 근거를 동반하는지 확인.
4. RBAC 매트릭스(§3.2), MCP credential 암호화(§3.2), webhook `endpointPath`, EIA 대기 표면 매트릭스 등 과거 세션에서 반복 오탐이 있었던 영역을 표본 점검.

즉 본 보고서는 **전수 대조가 아니라 광범위 표본 검토**다. CRITICAL/WARNING 없음이 "완전 무결"을 의미하지는 않으며, 아래 요약을 참고할 것.

## 발견사항

표본 검토 범위 내에서 CRITICAL/WARNING 급 — 기각된 대안의 무근거 재도입, 합의 원칙 위반, 근거 없는 결정 번복 — 은 발견되지 않았다.

- **[INFO]** 대조 커버리지 한계 고지
  - target 위치: `spec/5-system/` 전 18개 파일
  - 과거 결정 출처: 해당 없음 (방법론 고지)
  - 상세: target 이 `spec/5-system/` 전체(diff 아님)로 지정되고 대조군도 전체 spec 트리로 지정되어, 이번 1회 세션에서 18×70 조합을 완전 전수 대조하지 못했다. 표본은 (a) target 자신의 Rationale 절, (b) 도메인이 직접 겹치는 `0-overview`/`1-data-model`/`data-flow/*` Rationale, (c) target 내 "기각/번복/철회" 마커 문장 전수(약 139건)로 구성했다. `2-navigation/**`·`3-workflow-editor/**`·`4-nodes/**`·`7-channel-web-chat/**` 의 Rationale 은 표제만 확인하고 본문 정독은 생략한 항목이 있다.
  - 제안: 이 검토가 diff-scope 없이 전체 디렉토리로 재트리거되는 경우, 향후에는 실제로 변경되는 파일/섹션만으로 target 범위를 좁혀 요청하면 대조가 더 tractable 해진다. (구조적으로는 orchestrator 의 `--impl-prep` 페이로드 조립 로직이 실제 diff 대신 전체 디렉토리를 번들링하고 있는지 확인해볼 가치가 있다.)

- **[INFO]** 관찰 — 강한 Rationale 연속성 관행이 이미 확립되어 있음
  - target 위치: `spec/5-system/4-execution-engine.md#rationale`, `spec/5-system/1-auth.md#rationale`, `spec/5-system/14-external-interaction-api.md#rationale`, `spec/5-system/6-websocket-protocol.md#rationale` 등 대부분의 target 파일
  - 과거 결정 출처: 각 파일 자체 Rationale + `spec/data-flow/3-execution.md`, `spec/data-flow/11-workflow.md`, `spec/0-overview.md`, `spec/1-data-model.md` 의 Rationale
  - 상세: 표본에서 확인한 모든 "결정 번복" 사례가 예외 없이 "번복 배경" 또는 "번복 사유" 절을 동반하고 있었다 — 예: 실행 엔진의 `waiting_for_input → failed` 전이 추가가 과거 "WFI→running→failed 2단계 기각"과 정면으로 부딪히는 것처럼 보이지만, 해당 절이 "위 소절이 기각한 …과의 관계 (정면 대응)"이라는 제목으로 두 결정이 왜 다른 조건(원자 claim 유무)에서 성립하는지 명시적으로 정리해 두었다. `_resumeState` in-memory-only 결정("WARN #6")이 영속 저장으로 번복된 사례, `waiting_for_input → running → failed` 재진입 전이("park 도달 후 발효" 번복) 등도 동일 패턴이다. `per-node task queue` 기각은 실행 엔진 §Rationale 에 SoT 로 고정되어 있고, `0-overview.md`·`data-flow/3-execution.md` 양쪽에서 일관되게 그 SoT 를 인용만 하고 재정의하지 않는다.
  - 제안: 없음(교정 불필요) — 이 관행이 유지되도록 향후 편집 시에도 "번복 시 새 Rationale 동반" 규율을 그대로 따르면 된다.

## 요약

target(`spec/5-system/` 18개 문서, diff 없이 전체 번들)이 대조군(spec 나머지 영역의 `## Rationale`)과 충돌하는 지점은 표본 검토 범위 내에서 발견하지 못했다. 오히려 이 스펙 코퍼스는 "기각된 대안"을 결정문 옆에 명시적으로 남기고, 결정을 번복할 때는 반드시 "번복 배경/번복 사유" 절을 동반하며, 크로스 도메인 인용(예: 실행 엔진 큐 아키텍처를 `0-overview.md`·`data-flow/3-execution.md`·`data-flow/11-workflow.md` 세 곳이 SoT 하나만 가리키고 재정의하지 않는 방식)을 일관되게 유지하는 등 이례적으로 강한 Rationale 연속성 규율을 이미 갖추고 있었다. 다만 이번 검토는 15,571줄·70+ 문서 규모의 전체 스펙을 diff 없이 1회 세션에서 다뤘기 때문에 표본 검토였다는 방법론적 한계가 있고(특히 `2-navigation/**`·`3-workflow-editor/**`·`4-nodes/**`·`7-channel-web-chat/**` 는 얕게만 훑음), 이는 CRITICAL/WARNING 부재를 "완전 무결"로 해석하면 안 되는 이유다.

## 위험도

LOW
