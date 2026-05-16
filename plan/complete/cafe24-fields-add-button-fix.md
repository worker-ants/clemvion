---
worktree: cafe24-fields-add-btn-d3f8a2
started: 2026-05-16
owner: developer
---

# Cafe24 노드 `fields` 추가 버튼 무동작 버그 수정

## 배경

사용자 보고 (2026-05-16): 워크플로 에디터의 Cafe24 노드 설정 패널에서 `Fields` 항목의 "추가" 버튼을 눌러도 행이 늘어나지 않는다.

## 원인

`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`:

1. `KeyValueEditor` 의 `addItem` → `onChange([...items, { key: "", value: "" }])` 로 빈 행 1개 추가.
2. `Cafe24Config` 의 onChange 콜백은 받은 items 를 object 로 변환할 때 `if (it.key) obj[it.key] = it.value` — **빈 key 행을 즉시 버린다**.
3. 다음 렌더에서 `normalizeCafe24Fields(config.fields)` 는 object 에서 다시 list 를 만드는데, 빈 key 항목은 사라진 상태이므로 새 행이 보이지 않는다.

기존 코드 주석(line 339–342) 은 "Persist BOTH the keyvalue list (for UI round-trip) and the resolved object form" 이라 적었지만 실제로는 object 만 저장 — 주석과 구현의 괴리가 버그의 원인.

## 해결 방향

`Cafe24Config` 내부에 keyvalue 편집 버퍼용 React `useState` 도입:

- 초기값: `useState(() => normalizeCafe24Fields(config.fields))` — 마운트 시 1회 props 에서 파생.
- KeyValueEditor 의 onChange 는 로컬 state 를 갱신하고, 동시에 빈 key 를 제거한 object 형태로 `config.fields` 에 반영.
- 외부 변경(undo/redo 등)으로 `config.fields` 가 우리의 마지막 출력과 다른 내용으로 들어오면 로컬 state 를 재동기화.
- 백엔드 계약 `config.fields: Record<string, unknown>` 은 그대로 보존 ([spec §1](../../../spec/4-nodes/4-integration/4-cafe24.md#1-설정-config), [conventions/cafe24-api-metadata.md](../../../spec/conventions/cafe24-api-metadata.md)).
- `SettingsTab` 이 `selectedNodeId` 로 keyed 되어 있어 노드 전환 시 컴포넌트가 unmount/remount — 다른 노드 선택으로 인한 state stale 문제 없음.

## consistency-check 결과

세션: `review/consistency/2026/05/16/09_03_04/SUMMARY.md` — **BLOCK: NO**. 5 checker 전체 NONE.

INFO 권고:
- `fields` 변수와 충돌 회피용 state 명칭은 `fieldRows` 사용 (naming_collision INFO 6).
- 구현 완료 후 spec §2 또는 §9 Rationale 에 "fields 편집 UI 는 key-value 배열로 관리, onChange 시 object 변환" 한 줄 추가 권장 (cross_spec INFO 1 + rationale_continuity INFO 2). → 본 plan 종료 시 `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md` 로 위임.

§9 절 순서 역전 (9.7/9.8) · §5 Case 번호 불연속 등 사전 존재 위배는 별도 시점 처리 (이번 PR 범위 외).

## 작업 항목

- [x] worktree 진입 (`cafe24-fields-add-btn-d3f8a2`)
- [x] 스펙 분석 (`spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`)
- [x] consistency-check (BLOCK: NO)
- [x] TDD — 추가 버튼 동작 회귀 테스트 작성
- [x] 구현 — `Cafe24Config` 에 `useState` 도입
- [x] TEST WORKFLOW (lint / unit / build)
- [x] REVIEW WORKFLOW (`/ai-review`) → RESOLUTION 작성
- [x] spec 보완 위임 plan 작성 (`plan/in-progress/spec-update-cafe24-fields-ui-buffer.md`)

## 영향 범위

- Frontend 단일 파일 수정 + 신규 unit test 1건
- 백엔드 / 스펙 본문 / 데이터 모델 변경 없음
- e2e 대상 아님 (단일 컴포넌트 UI 트윅) — `[skip-e2e]`
