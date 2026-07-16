### 발견사항

- **[WARNING]** "~180" 수치 화석이 draft 범위 밖에 최소 2곳 잔존 — draft 적용 후에도 spec 내부에 "485"(신규)와 "~180"(잔존)이 동시에 존재하는 자기모순 상태가 됨
  - target 위치: draft D1(전체) — `4-cafe24.md:29`, `4-cafe24.md:446` 두 곳만 수정 대상으로 삼음. D2/D3/D4 는 "485"를 신규로 3곳(`1-ai-agent.md`, `11-mcp-client.md`, `0-overview.md`)에 추가
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` `## Rationale` §9.3 "노드의 Resource/Operation 메타데이터 위치" — "spec 본문에 endpoint enumeration 을 인라인하지 않는다 — **drift 방지 목적**. 본 문서는 형식·예시·18 카테고리 enum 만 명시한다."
  - 상세: 실측 결과 "~180" 화석은 spec 전역에 **최소 4곳**에 퍼져 있음을 실제로 확인함(`grep -rn "~180" spec/`):
    1. `spec/4-nodes/4-integration/4-cafe24.md:29` (§지원 범위) — draft D1 이 수정
    2. `spec/4-nodes/4-integration/4-cafe24.md:446` (§9.1 Rationale) — draft D1 이 수정
    3. `spec/2-navigation/4-integration.md:1110` (§14.2 워크플로우 에디터, "Resource × Operation = ~180") — **draft 범위 밖, 미수정**
    4. `spec/4-nodes/3-ai/0-common.md:63` (§3 MCP 서버 연결, `McpServerRef.enabledTools` 필드 설명 "Cafe24 의 경우 도구 수가 많아(~180)") — **draft 범위 밖, 미수정**

    특히 4번은 D2 가 편집하는 바로 그 주제(`enabledTools` allowlist 설명)의 config 필드 테이블이라 D2 와 가장 가까운데도 누락됐다. draft 는 스스로 "수치 화석"·"drift 방지"를 문제의식으로 내세우면서(§9.3 의 취지와 정확히 같은 문제) 정작 이 문제를 부분적으로만 해소한다 — 병합 후 독자가 `4-cafe24.md` 는 "485", `0-common.md`/`4-integration.md`는 "~180" 을 보게 되는 **spec 내부 모순**을 새로 남긴다. 또한 `catalog-sync.spec.ts` 는 카탈로그 markdown ↔ 백엔드 메타데이터 정합만 CI 로 강제하며, 카탈로그 ↔ spec 프로즈 수치 정합을 강제하는 자동 가드는 존재하지 않는다 — 즉 "485"를 여러 곳에 정확 수치로 하드코딩하는 이번 방식은 다음 카탈로그 변경 시 같은 유형의 drift 를 재발시킬 위험이 있다(오히려 근사치 "~"가 붙어 있던 종전 표현이 "이건 대략치"라는 신호를 줬던 것과 대조적으로, 정확 수치는 향후 어긋났을 때 더 눈에 띄지만 고쳐야 할 지점도 더 많다).
  - 제안: D1 범위에 `spec/2-navigation/4-integration.md:1110`, `spec/4-nodes/3-ai/0-common.md:63` 의 "~180" 정정을 포함. 장기적으로는 §9.3 의 기존 원칙(카탈로그가 SoT, spec 본문은 근사치만 유지하거나 카탈로그 문서로 링크)에 맞춰 spec 프로즈에 정확 수치를 여러 곳에 반복 하드코딩하는 대신 단일 SoT(예: `cafe24-api-catalog/_overview.md`)를 인용하는 방식도 검토 가치가 있음.

- **[INFO]** D1 변경 1-2(§9.1 Rationale 수치 정정)에 시점·출처 주석 누락 — 본문 수정(변경 1-1)과 비대칭
  - target 위치: draft "D1 … 변경 1-2 (§Rationale 단일 노드 근거, L446)"
  - 과거 결정 출처: 리포지토리 관례 — `spec/4-nodes/3-ai/1-ai-agent.md` §12.15("2026-07-06 커밋(#828…"), §12.16("2026-07-13 장애…"), `spec/2-navigation/3-schedule.md` "sort/order 쿼리 반영 — … (2026-06-10)", `spec/2-navigation/1-workflow-list.md` "태그 필터는 … 하향 (2026-07-06)" 등 — `## Rationale` 프로즈 안에서 사실이 갱신될 때는 시점·근거를 인라인으로 동반하는 패턴이 일관되게 관찰됨. `spec/0-overview.md` Rationale 서두도 "본문은 latest-only 사실을 기술하고 … Rationale 은 왜 그렇게 결정됐는지를 별도로 참조" 한다고 명시해, Rationale 이 본문과 분리되어 단독으로 읽힐 것을 전제함.
  - 상세: 변경 1-1(본문 §지원 범위)은 "(2026-07-17 실측 — 카탈로그 `supported` 행 = 백엔드 metadata operation, `catalog-sync.spec.ts` 가 양방향 강제)" 로 출처·시점을 명시하지만, 변경 1-2(§9.1 Rationale)는 "~10"→"~27", "~180개"→"485개" 로 순수 치환만 하고 동일 주석이 없다. §9.1 만 단독으로 읽는 독자는 이 수치가 언제·왜 갱신됐는지 알 수 없다 — 결정 자체의 번복은 아니지만(오히려 결정을 강화) Rationale 갱신 관례상 근거 부재.
  - 제안: 변경 1-2 문구 끝에 "(2026-07-17 실측 — §지원 범위 참조)" 정도의 짧은 인라인 주석을 추가해 본문·Rationale 양쪽의 provenance 를 대칭화. 새 하위 항목(별도 `###`) 신설까지는 불필요 — 순수 수치 정정이라 기존 문장 내 인라인 주석으로 충분.

### 요약
target draft 는 Rationale 연속성 관점에서 매우 신중하게 작성되어 있다 — D1(카탈로그 수치 정정)은 `4-cafe24.md §9.1`의 "endpoint 당 도메인 노드는 캔버스를 무너뜨린다" 단일 노드 결정을 뒤집지 않고 오히려 강화하며, D2/D3("allowlist 사실상 필수")는 `1-ai-agent.md §12.15`의 #828 Rationale(bytes 1차·count 2차 sanity)과 `§4.2`의 "COUNT_MAX 초과 시 hard 와 동일 취급" 규정을 실제로 대조 검증한 결과 수학적으로 필연적인 결론이며, "allowlist 는 선택적" 류의 상반된 과거 합의도 spec 어디에도 존재하지 않아 결정 번복이 아니다. `AI_AGENT_TOOL_COUNT_MAX` 기본값을 건드리지 않는다는 "비포함" 결정도 관련 plan(`ai-agent-tool-payload-budget-guardrail.md`)의 백로그와 정합한다. 다만 실측 결과 draft 가 고치려는 "~180" 화석이 spec 전역에 4곳 존재함을 확인했는데 draft 는 2곳만 다루고 있어(특히 D2 와 주제적으로 가장 가까운 `0-common.md`의 `enabledTools` 필드 설명조차 누락), 병합 후에도 spec 내부에 "485"(신규)와 "~180"(잔존)이 공존하는 모순이 새로 생긴다 — 이는 `§9.3`의 drift-방지 취지와 거리가 있는 완결성 결함이다. 이 외 Rationale 내 수치 갱신 시 시점 주석을 동반하는 관례와의 경미한 비대칭(INFO)도 확인됐다.

### 위험도
MEDIUM