### 발견사항

- **[WARNING]** D1(cafe24-token-refresh 에러 격리 정책)이 2026-06-02 defer 결정을 번복(재개)하면서 전용 `## Rationale` 항목을 신설하지 않음
  - target 위치: D1 절, `spec/2-navigation/4-integration.md §10.5` 본문(`cafe24-token-refresh` 큐 서술)에 "(2026-07-17 명문화)" 인라인 note 로만 추가
  - 과거 결정 출처: `plan/complete/cafe24-backlog-done.md` 계열 이력을 이어받은 `plan/in-progress/cafe24-backlog-residual.md` D-2 — "현재는 프레임워크(NestJS Logger) 에러 로그 출력으로 충분 — 별도 관측 도구(Sentry/Datadog 등) 선정 및 spec 명시는 관측 인프라를 추후 일괄 도입할 때 함께 진행" (2026-06-02 defer)
  - 상세: D1 은 "defer 전제(관측 인프라 일괄 도입) 가 OTel(#594, dc24f047d)로 충족됐다" 는 논거로 defer 를 해제하고 spec 을 명문화한다. 이 논거 자체는 타당하지만(원 defer 가 명시한 "Sentry/Datadog 등" 리터럴 도구가 아니라 OTel 이라는 *대체* 관측 스택으로 전제를 만족시킨다는 재해석 — 실측: `dc24f047d`/#594 가 2026-06-14 도입, `NF-OB-02/03/07` ✅ 확인), 그 defer→해제 논거가 spec 의 durable SoT 인 `## Rationale` 에는 없고 **plan 파일(`cafe24-backlog-residual.md`, transient 작업 추적 문서)에만** 존재한다. `spec/0-overview.md` 의 Rationale 전문("본문은 latest-only 사실을 기술하고 '왜 이 선택인가' 는 본 절을 참조한다... 현재 어떻게 동작하는가 와 왜 그렇게 결정됐는가 를 섞지 않도록 분리")과 `spec/2-navigation/0-dashboard.md` Rationale 의 code-sync 전용 선례(대안비교형이 아닌 "코드 현실 정합 근거" 도 Rationale 에 정식 기록)에 비춰볼 때, D1 도 같은 패턴(defer 사유 + 해제 근거)이라 Rationale 에 남기는 것이 정합적이다. 현재 형태는 §10.5 본문에 "how(정책 내용)" 와 "why now(defer 해제 근거의 축약)" 가 섞여 있고, plan 이 향후 `plan/complete/archive/`(1회성·역사 문서 보관, CLAUDE.md 상 신규 생성 금지 대상)로 이동/정리되면 defer→해제의 배경이 spec 상에서 추적 불가능해질 위험이 있다.
  - 제안: `spec/2-navigation/4-integration.md ## Rationale` 에 짧은 항목(예: "`cafe24-token-refresh` 에러 격리 정책 — D-2 defer 해제 (2026-07-17)")을 신설해 (a) 2026-06-02 defer 사유, (b) OTel 도입으로 전제 충족, (c) 코드가 이미 re-throw 를 구현 중이었다는 사실을 근거로 명시하고, §10.5 본문에서는 그 Rationale 앵커만 참조하도록 정리. (D2 는 이미 `R-adr-async-fanin` 을 신설해 이 패턴을 올바르게 따르고 있어 D1 과 대비된다.)

- **[INFO]** `R-adr-*` Rationale 앵커 접두사가 저장소 기존 관례와 다른 신규 패턴
  - target 위치: D2 절, `spec/4-nodes/1-logic/11-merge.md ## Rationale` 신설 항목 `### R-adr-async-fanin`
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md #R-wontdo-rawws-rest`, `spec/5-system/11-mcp-client.md #R-wontdo-cached-capabilities` — 저장소 전역에서 "영구 비채택(won't-do) + 명시적 재검토 트리거" 구조에 이미 `R-wontdo-*` 접두 관례가 확립돼 있음(두 문서가 서로를 "선례"로 명시 교차 참조)
  - 상세: `R-adr-async-fanin` 은 구조상(barrier 활성화를 무기한 dormant 로 유지 + 기각한 대안 2건 명시 + "엔진이 결정을 번복하면" 이라는 명확한 재검토 트리거) `R-wontdo-*` 패턴과 거의 동형이다. 그러나 접두를 새로 `R-adr-`로 발급했다. 저장소 검색 결과 `R-adr-` 접두는 이 항목이 유일하며 다른 문서에 선례가 없다 — naming collision 은 없으나(신규 식별자 1건, 기존 앵커와 충돌 없음 확인), 향후 spec-coverage/grep 기반 tooling 이 "won't-do 부류 결정"을 `R-wontdo-` 로 찾을 경우 이 항목이 누락될 수 있다.
  - 제안: 의도적으로 "ADR(신규 아키텍처 결정 기록)" 성격을 강조하려는 것이라면 현행 유지 가능. 다만 `R-wontdo-*` 관례와의 관계를 Rationale 본문에 한 줄로 명시(예: "본 항목은 `R-wontdo-*` 패턴과 동형이나, 엔진 아키텍처 차원의 조건부 재검토가 명확해 ADR 로 표기")하거나, 일관성을 우선한다면 `R-wontdo-merge-async-fanin` 류로 재명명을 검토.

- **[INFO]** target 문서가 기술하는 변경사항이 이미 저장소에 전량 반영되어 있음(리뷰 시점 기준 "draft" 아님)
  - target 위치: D1·D2 전체
  - 과거 결정 출처: 해당 없음(사실 확인)
  - 상세: `spec/2-navigation/4-integration.md §10.5`(D1), `spec/4-nodes/1-logic/11-merge.md §1/§6/`##Rationale``(D2), `plan/complete/merge-p2-async-fanin.md`(ADR 배너 포함 전문), `plan/in-progress/cafe24-backlog-residual.md` D-2 체크박스, `plan/complete/eia-distributed-seq-counter.md:83-89`(dead-link 해소 note) 모두 target 이 서술한 내용과 **문자 그대로 일치**하는 상태로 이미 커밋되어 있다(실측 확인). Rationale 연속성 관점의 실질 검토는 이미 반영된 실제 spec/plan 텍스트를 대상으로 수행했으며 두 결정(D1/D2) 모두 과거 결정을 무근거로 뒤집거나 기각된 대안을 재도입하지 않았음을 확인했다. 다만 이 draft 자체가 사후 문서화 성격이라면(이미 적용된 변경의 재기술), orchestrator 가 별도 spec-diff 를 적용할 필요는 없다는 점만 확인 차 기록한다.
  - 제안: 없음(정보 공유 목적).

### 요약

D1(cafe24-token-refresh 에러 격리 정책 명문화)과 D2(Merge P2→P3 dormant 격하 + `R-adr-async-fanin` 신설) 모두 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다. D2 는 실행 엔진 §4/§Rationale "per-node → execution-level intake 큐" invariant 를 정확히 인용하며 그 결정을 우회하지 않고 오히려 그 결정에 순응해 Merge barrier 활성화를 무기한 dormant 로 조정했고, 기각한 대안(Merge 전용 부분 비동기·Background 동기 대기)과 재검토 트리거를 명시해 CLAUDE.md 3섹션 구성·Rationale 관례를 정확히 준수한다. `merge-p2-async-fanin.md` 의 D3 fallback 조항("PoC 불가 시 별도 plan 분리")과 그 plan 자신의 수용 기준("PoC 결과 비현실적이면 ADR 로 마감")이 커밋 히스토리(9f7971e5d → d16dcc03e)상으로도 일관되게 이어져 온 것으로 확인되어, P2→P3 격하는 번복이 아니라 사전에 설계된 분기의 자연스러운 종착점이다. D1 은 defer 전제(관측 인프라 일괄 도입) 가 실제로 충족됐음(OTel #594, NF-OB-02/03/07 ✅)을 근거로 defer 를 해제하는 것으로 논리 자체는 견고하나, 그 defer→해제의 배경 논거를 spec 의 durable `## Rationale` 이 아니라 plan(추후 archive 이동 대상인 transient 문서)에만 남겨 두어 D2 대비 Rationale 배치 정합성이 다소 떨어진다(WARNING). `R-adr-*` 명명은 신규 접두이나 충돌은 없으며 기존 `R-wontdo-*` 패턴과의 관계를 한 줄 명시하면 더 일관적이다(INFO). 전반적으로 두 변경 모두 Rationale 연속성 관점에서 구조적 문제는 없다.

### 위험도
LOW
