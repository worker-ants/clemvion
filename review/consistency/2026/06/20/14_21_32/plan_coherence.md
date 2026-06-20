# Plan 정합성 검토 — M-5 레이어1 (정적 배열 → DI multi-provider)

검토 모드: 구현 착수 전 (`--impl-prep`)
Target: `spec/4-nodes`
Plan: `plan/in-progress/refactor-m5-node-di-layer1.md` + 부모 `plan/in-progress/refactor/02-architecture.md`

---

## 발견사항

### **[WARNING]** `refactor/README.md` 의사결정 표가 M-5 방향 확정을 반영하지 않음
- target 위치: `plan/in-progress/refactor-m5-node-di-layer1.md` 전체 (2026-06-20 생성)
- 관련 plan: `plan/in-progress/refactor/README.md` line 80 ("02 M-5 정적 노드 배열" 행)
- 상세: README 의사결정 표 line 80은 M-5 권고를 "카테고리 spread 경량안(spec 무변), DI 전환은 마켓플레이스 plan 묶음"으로 기록하며, 2026-06-10 사용자 결정 목록(line 70: "04 m-4, 03 M-6, 03 m-2, 06 M-5, 06 M-1")에 **02 M-5 는 포함되지 않았다**. 그런데 `02-architecture.md` M-5 §방향 확정(2026-06-20)에서 Option B(DI multi-provider 3-레이어)가 채택되고 레이어1 plan 이 생성된 상태다. README 표는 "결정 대기 — 착수 금지" 관리 규칙을 선언하고 있는데(line 117), 해당 행이 "결정됨"으로 갱신되지 않은 채 레이어1 구현이 착수되면 README 의 운영 규칙과 실제 진행 상황이 불일치한다.
- 제안: `plan/in-progress/refactor/README.md` line 80의 "02 M-5" 행에 "✅ 방향 확정(2026-06-20): Option B(DI multi-provider) — `refactor-m5-node-di-layer1.md` 추적"을 추기하고, 사용자 결정 요약(line 70)에도 반영. 단 레이어1 자체 체크리스트에 이 갱신이 포함되어 있지 않으므로 plan 쪽 갱신이 필요.

---

### **[WARNING]** spec §1.0 개정이 "착수 전" 선행 조건인데 체크리스트 미해소 상태에서 target spec 을 분석 대상으로 삼음
- target 위치: `spec/4-nodes/0-overview.md §1.0` (현행: "정적 배열로 부팅 시 부트스트랩, ALL_NODE_COMPONENTS", "런타임 플러그인 로딩 경로는 존재하지 않는다")
- 관련 plan: `plan/in-progress/refactor-m5-node-di-layer1.md` 체크리스트 2번째 항목 "spec §1.0/§4 등록 메커니즘 기술 갱신 (planner 위임 — "정적 배열"→"DI 부팅 등록") + `/consistency-check --spec` BLOCK:NO"
- 상세: 현행 `spec/4-nodes/0-overview.md §1.0`은 "서버 부팅 시 `NodeBootstrapService.onModuleInit`이 `NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)`을 호출"로 정적 배열을 명시 기술한다. 레이어1 구현은 이 메커니즘을 DI multi-provider 로 교체하는 것인데, 구현 전 spec 갱신이 선행 조건임을 체크리스트가 명시하고 있다. 본 consistency-check 시점(`--impl-prep`)은 구현 착수 전이므로 spec 갱신이 아직 수행되지 않은 것이 정상이나, **체크리스트 1번(--impl-prep) 완료 후 체크리스트 2번(spec planner 위임)이 반드시 선행**되어야 체크리스트 3~7번(구현·테스트·리뷰)을 진행할 수 있다. 이 순서가 plan 에 명시되어 있어 정합은 되어 있으나, 체크리스트가 순서 의존을 명시하지 않으면 동시 진행 오판 위험이 있다.
- 제안: 체크리스트 2번(spec 갱신)에 "(구현 3~7번 착수 전 필수 선행)" 주기를 추가해 순서 의존을 명시. 또는 체크리스트를 단계 블록으로 분할하여 "Phase 1 — spec 갱신 승인"과 "Phase 2 — 구현"을 구분. 현재 구조에서 INFO 수준이지만 체크리스트 순서 위반이 발생하면 WARNING 수준 정합 충돌이 된다.

---

### **[INFO]** `marketplace-and-plugin-sdk.md` Phase D 가 레이어1 산출물(`registerDynamic` seam)을 가정하나 레이어1 scope 에 미포함
- target 위치: `plan/in-progress/refactor-m5-node-di-layer1.md` (범위: 레이어1 만)
- 관련 plan: `plan/in-progress/marketplace-and-plugin-sdk.md` Phase D (line 78-82) — "본 Phase D 의 '런타임 등록'은 그 registry seam(`registerDynamic(comp, { workspaceId })`) 위에 얹는다"
- 상세: `marketplace-and-plugin-sdk.md` Phase D 가 `registerDynamic()` seam 의 존재를 전제하고 있으나, `refactor-m5-node-di-layer1.md` 의 범위는 명시적으로 "레이어1 만 (모듈 격리 + 핫스팟 제거, behavior-preserving)"이고 `registerDynamic` 은 레이어3(Phase D) 책임으로 분리되어 있다. `02-architecture.md` 레이어 설계(line 246-248)도 "레이어3 — 진짜 3rd-party 커스텀 노드 (marketplace Phase D; §1.0 제한이 실제로 무는 지점). 레이어1 registry 가 seam(`registerDynamic(comp, { workspaceId })`) → 같은 Map 에 테넌트 태그"로 seam 이 레이어3 구현 시점에 추가됨을 명시한다. 따라서 marketplace plan 의 전제(`registerDynamic` seam 의 존재)는 레이어1 완료로 충족되지 않는다. 다만 이는 already-known 의존 관계이며 marketplace plan 이 Phase D 를 미착수(`worktree: (unstarted)`) 상태로 유지하고 있어 현재 충돌은 없다. 후속 착수 시 혼란 방지를 위해 레이어1 plan 에 추적 메모가 권장된다.
- 제안: `refactor-m5-node-di-layer1.md` 에 "레이어3(`registerDynamic` seam)은 `marketplace-and-plugin-sdk.md` Phase D 가 담당 — 레이어1 scope 밖" 메모 한 줄 추가.

---

### **[INFO]** `02-architecture.md` M-5 §방향 확정이 spec §1.0 을 "provisional(미구현/Planned 미래 예약)" 로 해석하나 `spec/4-nodes/0-overview.md §1.0` 본문은 현행 기술 방식으로 작성됨
- target 위치: `spec/4-nodes/0-overview.md §1.0` ("서버 부팅 시 … `ALL_NODE_COMPONENTS`"), `§4` ("구현 상태: 본 절은 **아직 구현되지 않은 계획**", "현재 노드는 전부 빌트인이며 `nodes/index.ts` 의 `ALL_NODE_COMPONENTS` 정적 배열로 부팅 시 부트스트랩된다")
- 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-5 §spec 대조(A 판정) — "spec §1.0/§4 가 정적 배열을 **미구현/Planned 플러그인 인터페이스의 전 단계로 명시 예약**"
- 상세: spec §4 (노드 플러그인 인터페이스 — 미구현/Planned)는 정적 배열이 임시 상태임을 간접 명시하나, §1.0 본문은 정적 배열을 현행 운영 메커니즘으로 기술한다. M-5 레이어1 의 spec 갱신 방향("Rationale 번복이 아님")이 올바로 설정되어 있어 충돌은 없다. 다만 spec 갱신(체크리스트 2번) 수행 시 §4 의 "런타임 플러그인/마켓플레이스 로딩 경로는 존재하지 않는다" 기술이 레이어1 완료 후에도 레이어2·3 미완료 상태에서 **여전히 사실**이므로 §4 의 해당 문구를 갱신 범위에서 오조정하지 않도록 주의가 필요하다. 추적 메모 권장.
- 제안: spec 갱신 시 §1.0 의 "정적 배열 → DI 부팅 등록" 교체만 하고 §4 의 "런타임 로딩 경로 없음" 제한은 그대로 유지해야 함을 planner 위임 메모에 명시.

---

## 요약

M-5 레이어1 plan(`refactor-m5-node-di-layer1.md`)은 부모 `02-architecture.md` 의 방향 확정(2026-06-20)을 충실히 계승하고 있으며, 미해결 결정(레이어2·3)과 충돌하는 일방적 결정은 존재하지 않는다. 발견된 주요 정합 이슈는 두 건의 WARNING이다: (1) `refactor/README.md` 의 M-5 행이 2026-06-10 "결정 대기 — 착수 금지" 상태로 남아 있어 2026-06-20 방향 확정과 불일치하므로 갱신이 필요하다. (2) 체크리스트 상 spec 갱신(planner 위임)이 구현 착수의 명시적 선행 조건인데, 순서 의존 표기가 없어 동시 진행 오판 위험이 있다. INFO 항목은 marketplace Phase D 와의 seam 소유권 명시(추적 메모 권장)와 spec §4 "런타임 로딩 경로 없음" 제한 유지 주의사항이다. 전반적으로 spec 대조 판정 A(기술적으로 spec 에 현행 명시됨)에 해당하나 갱신 계획이 체크리스트에 이미 포함된 상태이므로, 계획 자체의 정합성은 양호하다.

## 위험도

LOW
