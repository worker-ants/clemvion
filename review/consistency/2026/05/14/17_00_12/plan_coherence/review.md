## Plan Coherence Check — spec-draft-cafe24-pending-polish.md

spec draft 내용을 `plan/in-progress/cafe24-pending-polish.md` 및 기타 진행 중 plan 과 대조했습니다.

---

### 발견사항

- **[WARNING]** §9.8 미포함
  - target 위치: DRAFT 2 "영향받는 연관 문서" 목록, DRAFT 2E 이후 패치 전체
  - 관련 plan: `cafe24-pending-polish.md` 변경 2 — `"spec 갱신 (spec/2-navigation/4-integration.md §9.2 / §9.4 / §9.8)"`
  - 상세: 변경 2 의 TODO 체크리스트는 §9.8 갱신을 명시하나, spec draft 의 DRAFT 2 패치 목록과 "영향받는 연관 문서"에 §9.8 이 없음. 실행 순서 0 도 `§9.2/§9.4/§10/§14.2` 만 나열하고 §9.8 을 누락 — `cafe24-pending-polish.md` 내부의 불일치가 spec draft 로 그대로 이어짐. §9.8 이 install_token 기반 라우트에 연동된 내용(예: begin 요청 응답 스키마, appUrl 형식)을 다루고 있다면 developer 가 spec 정의 없이 변경 2 를 구현하게 됨.
  - 제안: `cafe24-pending-polish.md` 의 실행 순서 0 에 §9.8 을 추가하거나, §9.8 변경이 없다면 변경 2 의 TODO 에서 §9.8 언급을 제거해 불일치를 해소. 어느 쪽인지 확인 후 spec draft 또는 plan 을 갱신.

- **[INFO]** `spec/data-flow/integration.md` §1.2 · §2.1 — 명시 범위 초과
  - target 위치: DRAFT 3C (§1.2 sub-diagram), DRAFT 3D (§2.1 Postgres schema mapping)
  - 관련 plan: `cafe24-pending-polish.md` 실행 순서 0 — `spec/data-flow/integration.md §3.2` 만 명시
  - 상세: spec draft 는 §1.2 Cafe24 Private install_token 시퀀스 다이어그램과 §2.1 스키마 컬럼 목록 갱신도 포함. 내용상 install_token 흐름과 일관적이며 enrichment 에 해당하나, plan 의 명시 범위를 넘음.
  - 제안: 내용 정합성 문제가 아니므로 차단 불필요. `cafe24-pending-polish.md` 실행 순서 0 에 §1.2·§2.1 을 추가하거나 spec draft 주석으로 "plan 범위 외 enrichment" 임을 명시하면 충분.

- **[INFO]** `spec/conventions/cafe24-api-metadata.md` 참조 확인 필요
  - target 위치: DRAFT 2H (§14.2 용어 교정), `spec/4-nodes/4-integration/4-cafe24.md:337` 패치
  - 상세: 두 위치 모두 `spec/conventions/cafe24-api-metadata.md#6-도구-allowlist` 를 인라인 링크로 삽입. 이 파일이 실제 존재하고 `#6-도구-allowlist` 앵커를 포함하는지 patch 적용 전 확인 필요. 참조 파일 부재 시 링크가 끊긴 채 spec 에 박힘.
  - 제안: 적용 전 `spec/conventions/cafe24-api-metadata.md` 존재·앵커 여부 확인. 없으면 해당 spec 파일 먼저 생성하거나 링크 제거.

---

### 요약

spec draft 는 `cafe24-pending-polish.md` 의 실행 순서 0 이 열거한 모든 섹션 (§2.2, §2.4, §3.2, §6, §9.2, §9.4, §10, §14.2, data-flow §3.2) 을 빠짐없이 포함하며, 기존 consistency-check Critical 4건 (C1~C4) 과 주요 Warning 을 정확히 해소한다. 다른 worktree 와의 spec 파일 경합도 없다. 다만 `cafe24-pending-polish.md` 변경 2 가 요구한 §9.8 이 spec draft 와 실행 순서 0 양쪽 모두에서 누락됐으며, 이 불일치를 plan 또는 draft 에서 명시적으로 해소해야 한다.

### 위험도
**LOW** (§9.8 불일치 해소 후 적용 가능)