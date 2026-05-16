# Plan Coherence Review — Phase 2 of cafe24-node-resource-operation-ux

Session: 2026/05/16/12_08_11
Target: Phase 2 of `plan/in-progress/cafe24-node-resource-operation-ux.md`
Worktree: `cafe24-node-ux-impl-9d3e1a` (branch: `claude/cafe24-node-ux-impl-9d3e1a`)

---

### 발견사항

- **[INFO]** Phase 1 선행 PR (#78) 미병합 상태에서 Phase 2 착수
  - target 위치: plan §Phase 2 체크리스트 전체 (plan line 35~55)
  - 관련 plan: `cafe24-node-resource-operation-ux.md` §Phase 1 (worktree: `cafe24-node-ux-catalog-4b8f2c`)
  - 상세: Phase 1 (PR #78, MERGEABLE) 이 아직 main 에 병합되지 않은 상태에서 Phase 2 PR 이 진행 중이다. Phase 2 의 `catalog-sync.spec.ts` 확장 항목은 Phase 1 이 생성한 `spec/conventions/cafe24-api-catalog/` MD 파일들을 파싱 대상으로 한다. Phase 2 branch 가 Phase 1 branch 를 base 로 stacked 되어 있으면 문제없으나, Phase 1 branch 가 아직 main 에 없으므로 Phase 2 가 독립적으로 PR 을 올릴 경우 catalog MD 파일이 병합 후 main 에 없을 수 있다. 호출자는 PR #78 이 MERGEABLE 임을 명시했으므로 stacked PR 구조임을 확인할 필요가 있다.
  - 제안: plan 문서에 "Phase 2 는 PR #78 (Phase 1) merge 이후 또는 stacked 구조로 진행" 을 명시하고, Phase 2 PR description 에 depends-on #78 을 기재하여 순서 의존성을 문서화한다.

- **[WARNING]** `marketplace-and-plugin-sdk.md` 의 NodeComponentRegistry 동적 등록 항목이 `NodeComponent` 인터페이스 안정성에 미선언 의존
  - target 위치: Phase 2 — `backend/src/nodes/core/node-component.interface.ts` (`NodeComponent.extras?` 추가)
  - 관련 plan: `plan/in-progress/marketplace-and-plugin-sdk.md` §Phase D — "SDK 패키지 — NodeComponent 인터페이스를 외부 개발자가 사용할 수 있도록 export", "런타임 등록 — NodeComponentRegistry 에 동적 등록" + 주석 "ai-agent-tool-connection-rewrite.md 의 결정이 NodeComponent 인터페이스에 의존하면 SDK 안정성에 직접 영향"
  - 상세: `marketplace-and-plugin-sdk.md` 는 `NodeComponent` 인터페이스를 미래의 외부 SDK 공개 계약으로 명시한다. Phase 2 는 이 인터페이스에 `extras?: () => unknown` 옵셔널 메서드를 추가한다. marketplace plan 이 결정 보류 중인 "SDK 안정성" 항목과 충돌하지는 않지만, marketplace plan 에서 NodeComponent 인터페이스 변경 시 별도 검토를 요구하는 의존 관계가 미등록 상태다. marketplace plan 이 Phase D 에 진입할 때 extras 메서드의 존재를 인지하고 SDK export 범위를 결정해야 한다.
  - 제안: `marketplace-and-plugin-sdk.md` §Phase D 의 "NodeComponent 인터페이스 export" 항목에 "extras?: () => unknown 포함 여부 결정 필요 (cafe24-node-ux-impl-9d3e1a PR 에서 추가됨)" 추적 메모를 추가한다. 이 PR 에서는 조치 불필요.

- **[INFO]** `cafe24-pending-polish.md` 의 미체크 항목(변경 1~5)이 `cafe24.component.ts` 를 잠재적으로 터치할 수 있음
  - target 위치: Phase 2 — `backend/src/nodes/integration/cafe24/cafe24.component.ts` (`extras()` 구현)
  - 관련 plan: `plan/in-progress/cafe24-pending-polish.md` worktree: `cafe24-pending-polish-7fdb7e` — 변경 2~4 는 `createPrivatePendingIntegration` / `handleCallback` 등 cafe24 서비스 레이어를 수정하며 `cafe24.component.ts` 에는 직접 닿지 않음. `cafe24-data-model-strengthen.md` (worktree: `cafe24-data-model-strengthen-464de9`) 는 모든 체크박스가 완료되어 있고 코드도 cafe24 integration service/entity 레이어이지 component 레이어가 아님.
  - 상세: `cafe24.component.ts` 는 Phase 2 에서 `extras()` 메서드만 추가하며, `createPrivatePendingIntegration` / TTL 스캐너 등 `cafe24-pending-polish.md` 의 대상 메서드와 파일 수준에서는 겹치지 않는다. 직접 충돌 위험은 낮음. 단, `cafe24-pending-polish.md` 가 완료되지 않은 채로 worktree `cafe24-pending-polish-7fdb7e` 가 살아있으므로 병합 순서가 불분명하다.
  - 제안: 추적 메모 수준. `cafe24-pending-polish.md` 의 구현 착수 전 `cafe24.component.ts` 의 `extras` 메서드가 main 에 있는지 확인하도록 해당 plan 에 메모 추가를 권장하지만 강제는 아님.

- **[INFO]** `node-output-redesign/cafe24.md` 는 "변경 없음" 결론 — Phase 2 와 비충돌 확인
  - target 위치: Phase 2 전반
  - 관련 plan: `plan/in-progress/node-output-redesign/cafe24.md` (worktree 명시 없음, 분석용 plan)
  - 상세: `node-output-redesign/cafe24.md` 는 `spec/conventions/node-output.md` 11 원칙 검토 결과 "잔여 권고 없음 (변경 없음)" 으로 결론. Phase 2 가 추가하는 `extras` 필드는 node output 컨트랙트(`config/output/meta/port/status` 5필드) 와 직교하므로 충돌 없음.
  - 제안: 없음.

- **[INFO]** Phase 2 plan 의 `frontend/src/lib/stores/node-definitions-store.ts` 변경 — 다른 plan 에서 동 파일 터치 없음 확인
  - target 위치: Phase 2 체크리스트 `node-definitions-store.ts` (plan line 54 정도)
  - 관련 plan: `plan/in-progress/**` 전체 검색 — `node-definitions-store`, `node-definitions/types` 를 언급하는 plan 은 `marketplace-and-plugin-sdk.md` 뿐이며, 그것도 Phase D 이후로 결정 보류 중임.
  - 상세: 현재 활성 worktree 중 `frontend/src/lib/node-definitions/` 을 동시 수정하는 다른 worktree는 없음. 경합 없음.
  - 제안: 없음.

- **[INFO]** Phase 2 체크리스트에 `consistency-check (impl-prep)` 항목이 있으나 아직 미체크
  - target 위치: plan Phase 2 체크리스트 마지막 항목 (line 55)
  - 관련 plan: 없음 (절차 항목)
  - 상세: `developer` 역할은 구현 착수 전 `consistency-checker --impl-prep` 의무 호출 규약이 있다. 본 review 세션(12_08_11) 이 해당 impl-prep 세션의 일부일 수 있으나, plan 체크리스트에 이를 체크하는 갱신이 아직 이루어지지 않았다면 착수 직전 갱신이 필요하다.
  - 제안: 본 consistency-check 세션 완료 후 plan 의 해당 체크박스를 체크한다.

---

### 요약

Phase 2 의 핵심 변경 파일 (`node-component.interface.ts`, `node-component.registry.ts`, `node-response.dto.ts`, `cafe24.component.ts`, `node-definitions/types.ts`, `node-definitions-store.ts`) 에 대해 현재 활성 worktree 간 직접적인 경합은 발견되지 않았다. `cafe24-data-model-strengthen.md` 는 모든 체크박스가 완료 상태이고 수정 대상도 service/entity 레이어에 국한되어 component 레이어와 교집합이 없다. `cafe24-pending-polish.md` 는 미완 항목이 있지만 worktree가 별도(`cafe24-pending-polish-7fdb7e`)이고 `cafe24.component.ts` 와 직접 교차하지 않는다. 미해결 결정 우회나 동시 worktree CRITICAL 충돌은 없다. 주의할 사항은 두 가지다: (1) Phase 1 (PR #78) 의 catalog MD 파일이 Phase 2 sync test 의 전제 조건임을 plan 에 명시적으로 기록해야 하며, (2) `marketplace-and-plugin-sdk.md` Phase D 진입 시 `NodeComponent.extras` 메서드의 SDK export 여부를 인지하도록 추적 메모가 필요하다.

### 위험도

LOW
