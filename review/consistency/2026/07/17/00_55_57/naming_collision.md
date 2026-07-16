# 신규 식별자 충돌 검토 — D1(⑦ Cafe24 D-2) + D2(⑧ Merge P2→P3 ADR)

### 발견사항

- **[WARNING]** 신규 Rationale 앵커 `R-adr-async-fanin` 이 기존 `R-wontdo-*` 시맨틱 접두 컨벤션을 따르지 않고 새 접두(`R-adr-`)를 도입
  - target 신규 식별자: `spec/4-nodes/1-logic/11-merge.md` §Rationale `### R-adr-async-fanin. 비동기 fan-in barrier(...) P2 → P3 격하 (ADR, 2026-07-17)` (L226, D2 변경 2-3 이 신설)
  - 기존 사용처: `spec/5-system/11-mcp-client.md:601` 이 스스로 명시한 "표기 선례" — *"절 단위 won't-do 표기(`_(비채택 won't-do — 이유)_` 인라인 + 전용 `R-wontdo-*` Rationale 절)는 [`6-websocket-protocol.md`](./6-websocket-protocol.md) §Rationale `R-wontdo-rawws-rest`(2026-07-08) 가 확립한 패턴을 따른다"*. 즉 이 프로젝트에는 "설계를 도입하지 않고 특정 트리거 조건까지 무기한 보류한다"는 결정 유형에 대해 이미 **명명 선례가 존재**한다(`R-wontdo-rawws-rest`, `R-wontdo-cached-capabilities`).
  - 상세: `R-adr-async-fanin` 의 실질 결정 구조 — "barrier 활성화를 **무기한 dormant** 로 확정, **재검토 트리거**: 엔진이 per-node 비동기 dispatch 도입으로 결정을 번복하는 경우에 한함" — 은 `R-wontdo-*` 계열의 "결정(비채택)/근거/**재개 트리거**" 구조와 사실상 동형이다. `R-wontdo-cached-capabilities` 도 "재개 트리거: ... 실측으로 문제화되면 ... 재제안" 형태로 동일 패턴을 갖는다. 그럼에도 target 은 기존 `R-wontdo-*` 를 재사용하지 않고 `R-adr-` 라는 제3의 접두를 신설했다 — ID 자체의 직접 충돌(동일 문자열 재사용)은 아니지만, "무기한 dormant + 조건부 재개" 결정을 검색할 때(`grep R-wontdo-`) 이 항목이 누락되는 **taxonomy 파편화**를 야기한다. 또한 프로젝트에는 Rationale 앵커 명명을 규율하는 정식 convention 문서가 없어(`R-N` 단순번호 / `R-<도메인>-N` 네임스페이스 / `R-wontdo-*` 시맨틱 3갈래가 전례로만 존재), 새 접두가 추가될 때마다 관례가 암묵적으로만 판별된다.
  - 제안: (a) `R-adr-async-fanin` → `R-wontdo-async-fanin` 으로 개명해 기존 선례에 합류하거나, (b) 정말 "ADR" 이라는 별도 카테고리(설계 자체의 존폐가 아니라 **다른 팀 결정(엔진 아키텍처)에 종속된 로드맵 phase 재분류**)로 구분할 실익이 있다면 그 구분 기준을 `spec/conventions/`(예: 신규 `rationale-anchors.md` 또는 `spec-impl-evidence.md` 확장)에 명문화해 향후 유사 사례가 다시 즉흥적으로 접두를 만들지 않게 한다. 어느 쪽이든 target 자체의 검토 요청 §3("`R-adr-*` 접두가 기존 `R-wontdo-*`/`R-N` 관례와 정합한가")이 이미 이 판단을 요청했으므로, 이번 PR 안에서 결정하고 넘어가는 편이 taxonomy 부채를 남기지 않는다.

### 확인했으나 충돌 없음 (참고용)

- `R-adr-async-fanin` 문자열 자체는 저장소 전체(spec/plan/codebase)에서 이번 신설 3곳(`11-merge.md` L15·L218·L226)과 이를 참조하는 `plan/complete/merge-p2-async-fanin.md`(L34·L126) 외에는 어디에도 존재하지 않음 — ID 재사용(동일 ID·다른 의미) 충돌은 없음.
- D1 이 신규 도입하는 것으로 보이는 표현들은 실제로는 전부 기존 식별자를 재참조하는 서술문이며 새 식별자가 아님: 큐명 `cafe24-token-refresh`(기존, `cafe24-token-refresh.processor.ts` 등 기 구현), `attempts: 1`(BullMQ job option 값 — 신규 식별자 아님, §11.1 의 `attempts: 3` 은 별개 job 군(`connected-expiry` 등)의 기존 값이라 값 충돌이 아니라 "같은 문서 내 다른 큐의 다른 정책"으로 이미 명확히 구분 서술됨), 테스트 라벨 `TEST-C2`(`cafe24-token-refresh.processor.spec.ts:224` 기존 주석 재참조, 타 파일에 동명 라벨 없음). 요구사항 ID·엔티티/DTO명·API endpoint·webhook/queue 이벤트명·ENV var/config key 신설은 D1·D2 어디에도 없음.
- 파일 경로: `plan/in-progress/merge-p2-async-fanin.md` → `plan/complete/merge-p2-async-fanin.md` 이동(rename) 대상 경로에 기존 파일이 없어 경로 충돌 없음. `plan/complete/` 명명 컨벤션(작업명 그대로 유지)에도 부합.
- `## Rationale` 섹션 신설(`11-merge.md`)은 CLAUDE.md 문서 컨벤션("`N-name.md` 본문 끝에 `## Rationale` 섹션")에 부합하며, 파일 내 헤더 중복(동일 `## Rationale` 앵커 slug 재사용)도 없음.

### 요약

target 이 실질적으로 새로 도입하는 식별자는 Rationale 앵커 `R-adr-async-fanin` 1건뿐이며, 이 문자열이 기존에 다른 의미로 이미 쓰이고 있는 직접적 충돌(동일 ID 재사용)은 없다. 다만 이 결정의 성격("무기한 dormant + 조건부 재개 트리거")이 이 저장소가 이미 확립한 `R-wontdo-*` 명명 선례(`spec/5-system/11-mcp-client.md:601` 이 스스로 인용)와 기능적으로 동형인데도 제3의 접두(`R-adr-`)를 새로 만들어, 향후 `grep R-wontdo-` 로 "won't-do류 결정"을 찾는 사람이 이 항목을 놓치는 taxonomy 파편화 위험이 있다. 나머지 검토 관점(요구사항 ID·엔티티/타입·API endpoint·이벤트명·ENV/config key·파일 경로)은 전부 기존 식별자 재참조뿐이라 충돌 없음.

### 위험도
LOW
