# Rationale 연속성 검토 결과

검토 대상: `spec/3-workflow-editor/3-execution.md` (구현 diff base: 1899c05e)
검토 모드: --impl-done (구현 완료 후 검토)

---

## 발견사항

발견된 CRITICAL 또는 WARNING 수준의 Rationale 위반이 없다.

### 검토 항목별 판정

**[INFO] ExecutionHistoryPanel 의 modal 오버레이 패턴 — Rationale 에 명시 없음**
- target 위치: `execution-history-panel.tsx` 라인 337 (`fixed inset-0 z-50 flex items-center justify-center bg-black/50`)
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` Rationale R-6 ("가벼운 modal (`Dialog`, 중앙 정렬)") 및 `spec/3-workflow-editor/3-execution.md §7.1` ("모달 패널")
- 상세: 구현은 Shadcn `<Dialog>` 컴포넌트 없이 raw `div.fixed.inset-0` 으로 모달을 직접 구현하고, 트리거 목록의 "호출 이력" modal (R-6) 과 동일한 "중앙 정렬 경량 modal" 패턴을 따른다. 이는 명시적으로 거부된 대안이 아니고, spec §7.1 이 "모달 패널" 이라 서술하며 UI 컴포넌트 구현 방식까지 제한하지 않으므로 원칙 위반은 아니다. 다만 Rationale R-7 에 Shadcn `<Dialog>` 대신 raw div 로 구현한 이유(aria-modal 속성 직접 부여, Shadcn Dialog 의 radix portal/focus-trap 없이 직접 제어)가 기록되어 있지 않다.
- 제안: 현 상태로 수용 가능. 향후 Shadcn `<Dialog>` 로 교체하거나 raw div 구현을 유지하는 경우, `spec/3-workflow-editor/3-execution.md` R-7 에 선택 이유 1줄을 추가하면 완전하다.

**[INFO] `drawerExpanded` 보존 정책 — 구현 코드가 spec 범위를 초과한 세부 결정을 올바르게 처리하나 Rationale 에 미기록**
- target 위치: `execution-store.ts` `startHistoryView` 내부 주석 ("drawerExpanded(UI 선호)는 의도적으로 유지 — 히스토리 로드가 드로어 펼침 상태를 강제로 바꾸지 않는다")
- 과거 결정 출처: `spec/3-workflow-editor/3-execution.md §10.10` ("실행 히스토리(§7)에서 과거 실행을 클릭하면, 해당 실행의 모든 노드 결과로 드로어를 채운다") — 드로어 펼침 상태 유지/강제 여부는 미명시
- 상세: spec §10.10 은 히스토리 적재 시 드로어 내용을 채운다고 정의하지만, 드로어가 닫혀있을(접힌 상태) 때 강제로 펼칠지 여부는 명시하지 않는다. 구현은 "사용자가 접어 둔 상태면 접힌 채로 적재" 를 선택했는데, 이는 기각된 대안이 아니라 spec 이 열어 둔 구현 공간이다. 그러나 이 결정이 코드 주석에만 있고 Rationale 에는 없다.
- 제안: 수용 가능. spec §10.10 또는 R-7 에 "히스토리 적재는 `drawerExpanded` 를 변경하지 않는다 (사용자 UI 선호 보존)" 한 줄을 추가하면 결정이 문서화된다.

---

## 요약

구현 diff (인-에디터 실행 히스토리 패널 §7) 는 `spec/3-workflow-editor/3-execution.md` Rationale R-7 과 전면 정합한다. 기각된 대안(히스토리 전용 렌더 경로, 별도 재실행 버튼, 새 백엔드 엔드포인트)을 재도입한 사례가 없고, 합의된 invariant(라이브 실행과 동일한 `applyExecutionSnapshot` hydration 경로 재사용, `executionId` 세팅으로 Re-run 연결, 전용 페이지와 중복 신설 금지)를 모두 준수한다. INFO 수준 2건은 구현 세부(modal 구현 방식, `drawerExpanded` 보존 정책)가 spec Rationale 에 기록되지 않은 것으로, 기각된 결정의 재도입이나 invariant 위반이 아닌 문서화 보완 권고다.

---

## 위험도

NONE
