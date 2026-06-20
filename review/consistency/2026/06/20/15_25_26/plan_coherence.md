# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes, diff-base=origin/main)
Target: `spec/4-nodes` (0-overview.md §1.0/§4 등록 메커니즘 sync 포함)
관련 plan: `plan/in-progress/refactor-m5-node-di-layer1.md` (M-5 레이어1)
부모 plan: `plan/in-progress/refactor/02-architecture.md` (M-5 §방향 확정)

---

## 발견사항

### [INFO] `spec/4-nodes/1-logic/0-common.md §7` UUID v4 잔재 — target 갱신 미포함

- target 위치: `spec/4-nodes/0-overview.md §1.3` — 동적 포트: "slug id 를 포트 ID 로 사용 (UUID v4 는 사용하지 않는다)" 로 이미 정정됨.
- 관련 plan: `plan/in-progress/refactor-m5-node-di-layer1.md` §범위 밖 / 후속 항목 "C1+W1 동적 포트 ID drift (planner 위임)" — `1-logic/0-common.md §7`·`3-workflow-editor/1-node-common.md §1.5`·`6-presentation/1-carousel.md:429` 의 폐기된 "UUID v4" 잔재를 별도 planner 작업으로 명시 이관.
- 상세: `spec/4-nodes/1-logic/0-common.md §7` 은 여전히 "동적 포트: 생성 시 **UUID v4** 를 할당"이라고 명시하고 있어, target 의 `spec/4-nodes/0-overview.md §1.3` 이 "UUID v4 는 사용하지 않는다"고 반박하는 것과 불일치한다. 이 드리프트는 본 구현 worktree 의 plan 이 이미 "범위 밖, planner 위임"으로 명시해 의도적으로 제외한 것이므로 미해결 결정 충돌은 아니다. 단, target (`spec/4-nodes`) 의 한 파일(`0-overview.md`)이 갱신되고 같은 영역의 다른 파일(`1-logic/0-common.md §7`)이 미갱신된 채로 PR 에 포함되면 스펙 내부 불일치가 가시화되므로 추적 메모를 남긴다.
- 제안: plan 에 이미 "C1+W1 planner 위임" 추적이 있으므로 별도 대응 불요. plan 의 해당 항목이 후속 plan 으로 이관됐는지 확인하고, 이관되지 않았다면 planner 에게 `spec/4-nodes/1-logic/0-common.md §7` drift 수정을 요청하는 후속 plan 항목을 등재한다.

---

### [INFO] `marketplace-and-plugin-sdk.md §0` 미결 결정 5건 — 레이어1 진행과 충돌 없음, 레이어2/3 영향권

- target 위치: `spec/4-nodes/0-overview.md §4` — "빌트인 노드 카탈로그를 `NodeComponentsModule` → `NODE_COMPONENT` DI 토큰으로 부팅 등록 (런타임 플러그인/마켓플레이스 로딩 경로는 존재하지 않는다)" 로 갱신. §4 Planned 절은 그대로 유지.
- 관련 plan: `plan/in-progress/marketplace-and-plugin-sdk.md §0` — 단계 분할·마켓 호스팅·수익화·검증 정책·셀프호스팅 등 5건이 미결 (`[ ]`).
- 상세: target 의 `spec/4-nodes/0-overview.md §4` 갱신은 "런타임 플러그인/마켓플레이스 로딩 경로는 존재하지 않는다 (빌트인 정적 등록만)" invariant 를 **유지**하면서 부팅 등록 메커니즘만 DI 로 기술 변경했다. 이는 `marketplace-and-plugin-sdk.md §0` 의 미결 결정(단계 분할/호스팅/수익화/검증/셀프호스팅)과 충돌하지 않는다 — 미결 결정들은 마켓 운영 정책이고, 레이어1 은 registry seam 을 여는 구현 재량 영역이다. `marketplace-and-plugin-sdk.md Phase D` 는 `registerDynamic(comp, { workspaceId })` seam 을 "레이어1 registry 위에 얹는다"로 명시해 레이어1 을 전제로 인식하고 있다.
- 제안: target 또는 plan 갱신 불요. marketplace plan 의 미결 §0 결정들은 Phase D 착수 시점에 해소하면 된다 — 레이어1 이 그 결정들을 선점하거나 우회하지 않았다.

---

### [INFO] `refactor/02-architecture.md M-5 레이어2 spec 갱신` 후속 항목 미추적

- target 위치: `spec/4-nodes/0-overview.md §1.0/§4` — 레이어1 메커니즘 sync 완료.
- 관련 plan: `plan/in-progress/refactor/02-architecture.md M-5 §방향 확정` — "spec 갱신: 레이어2 = 노드 entitlement/필터 신규 절(planner). 레이어3 = §1.0 런타임 로딩 제한 개정 + §5 샌드박스(n8n 모델 명문화) — marketplace Phase D 와 한 묶음."
- 상세: 레이어2 착수 시 `spec/4-nodes/0-overview.md` 에 per-workspace entitlement/필터 절 추가가 필요하다는 항목이 부모 plan `02-architecture.md` 에 기록되어 있으나, 이를 추적하는 별도 in-progress plan 이 없다. 레이어1 구현 자체는 레이어2 spec 갱신을 건드리지 않으므로 BLOCK 아님. 단, 레이어2 착수 직전 planner 작업이 누락되면 spec 갱신 없이 구현이 선행될 수 있다.
- 제안: 현재 plan 문서(`refactor-m5-node-di-layer1.md §범위 밖`)에 "레이어2 = 별도 후속, spec 갱신 포함(planner)"이 이미 명시되어 있으므로 추가 액션 없어도 무방. 레이어2 착수 시 부모 plan 의 spec 갱신 항목을 신규 plan 으로 분리하는 것을 권장.

---

## 요약

M-5 레이어1 구현이 갱신한 `spec/4-nodes/0-overview.md §1.0/§4` 는 진행 중 plan 에서 미결로 남은 결정(marketplace §0 5건, M-5 레이어2/3 후속)과 충돌하지 않는다. `marketplace-and-plugin-sdk.md §0` 의 미결 사항들은 마켓 운영 정책이고 레이어1 은 등록 메커니즘 구현 재량 영역이라 계층이 다르다. 유일한 주목점은 `spec/4-nodes/1-logic/0-common.md §7` 의 UUID v4 잔재로, 이는 레이어1 plan 이 "범위 밖, planner 위임"으로 의도 명시한 pre-existing drift 라 이번 구현의 책임이 아니다. 모두 BLOCK 없음 수준의 INFO 추적 사항이다.

## 위험도

NONE

STATUS: OK
