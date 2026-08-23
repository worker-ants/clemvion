Rationale 연속성 검토를 마쳤다. target(`spec/5-system/14-external-interaction-api.md` §R17)·코드(`interaction.service.ts`, `node-output-allowlist.ts`)·plan(`plan/complete/nodeoutput-allowlist.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`)·CHANGELOG.md 전부를 대조했다.

### 발견사항

없음. CRITICAL/WARNING/INFO 어느 등급도 보고할 항목이 없다.

**확인한 근거**:

1. 이번 diff 는 EIA §R17 이 이미 "미구현·잔여" 로 명시해 둔 항목(`nodeOutput` 일반 키 allowlist)을 정확히 그 항목대로 해소하는 변경이다. 과거 R17 은 conversationConfig 를 제외한 일반 키 allowlist 를 "여전히 후속 하드닝 항목" 이라 못박아 뒀고(`spec/5-system/14-external-interaction-api.md` 옛 R17 마지막 불릿), 이번 변경은 그 항목을 정확히 채택했을 뿐 과거 결정을 뒤집지 않는다.

2. R17 이 확립한 핵심 원칙 — "**적용 범위는 총칭이 아니라 열거**"(3-출구 열거, `waiting nodeOutput`/`terminal result`/`terminal error`) — 를 신규 Rationale 이 표 형태로 그대로 계승했다(`spec/5-system/14-external-interaction-api.md:1786-1791`). REST 만 fail-closed 로 좁히고 SSE/fanout(`toFanoutEnvelope`)은 deny-list 로 남긴 비대칭을 "wire 형식 동일" 서술과 명시적으로 구분해 적었고("형식에 대한 것이고 필터 강도에는 적용되지 않는다"), 이 저장소가 §R17 에서 두 번 겪은 "부분 해소를 전체로 flip" 패턴(§5.5, `durationMs` 사례)의 재발을 정확히 피했다.

3. 직전 impl-prep 라운드(`review/consistency/2026/08/23/18_30_40/`)에서 rationale_continuity·plan_coherence 두 checker 가 낸 WARNING 2건(R17 범위 미명시, SSE 비대칭 plan 미등재)이 이번 라운드 target 에서 정확히 그 checker들의 제안대로 반영돼 있음을 확인했다 — `spec-sync-external-interaction-api-gaps.md` 에 SSE 잔여 항목이 신규 등재(2026-08-23)됐고, 기존 항목은 `[x]` 로 flip 되며 착수 전 프로브가 전제를 재검증한 경위까지 기록했다.

4. `spec/conventions/node-output.md` Principle 0/4.2.1 이 확립한 "`_resumeState`/`_resumeCheckpoint`/`_retryState` 3필드는 internal-only" invariant를, 신규 allowlist 가 컴파일타임 assertion(`assertAllowlistCoversHandlerContract`)으로 구조적으로 강제한다 — 오히려 과거 그 invariant 가 REST 표면에서 지켜지지 않던(`_retryState` 누출) 결함을 닫는 방향이며, `_resumeCheckpoint` 를 타입 밖 키로 정확히 문서화해 직전 라운드 INFO(과장 표현 "발명하지 않고 파생")도 컴파일타임 검증으로 해소했다.

5. R10(WebsocketService 단일 sink 정책)과는 별개 축(이벤트 발행 아키텍처 vs egress 필터링)이라 충돌 없음.

### 요약
검토 대상 diff 는 spec 자신이 사전에 "잔여" 로 등재해 둔 항목을 그 문서의 기존 설계 원칙(3-출구/열거식 범위 표기, `NodeHandlerOutput` 타입 결속)을 그대로 따라 해소한 변경이며, 남은 비대칭(SSE/fanout)은 은폐하지 않고 spec·plan 양쪽에 "잔여"로 명시 등재했다. 직전 라운드에서 checker 들이 지적한 WARNING 이 정확히 그 지적대로 반영된 것도 확인했다. Rationale 연속성 관점에서 기각된 대안의 재도입, 원칙 위반, 무근거 번복, invariant 우회 어느 것도 발견되지 않았다.

### 위험도
NONE
