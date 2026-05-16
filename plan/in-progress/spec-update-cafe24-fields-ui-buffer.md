---
worktree: (none — project-planner 진입 시 새 worktree)
started: 2026-05-16
owner: project-planner (다음 진입자)
---

# Spec Update: Cafe24 `fields` UI 편집 버퍼 분리 원칙 기록

## 배경

`plan/in-progress/cafe24-fields-add-button-fix.md` 의 구현 과정에서 Cafe24 노드 설정 UI 의 `fields` 항목은 다음 두 가지 표현 사이를 왔다갔다 한다:

- **저장된 config 표현** — `Record<string, unknown>` (백엔드 계약, [spec/4-nodes/4-integration/4-cafe24.md §1](../../spec/4-nodes/4-integration/4-cafe24.md#1-설정-config), [conventions/cafe24-api-metadata.md](../../spec/conventions/cafe24-api-metadata.md))
- **UI 편집 버퍼** — `Array<{key: string; value: string}>` (React state 안에서만 존재)

두 표현 사이 변환:
- 저장 → 편집: 컴포넌트 마운트 시 `Object.entries` 로 행 배열로 펼침
- 편집 → 저장: `onChange` 시 빈 key 행을 제거(객체 표현 불가)한 뒤 `Object.fromEntries` 로 저장

이 분리가 spec/Rationale 에 명시되어 있지 않다 — 같은 패턴이 향후 다른 노드(e.g. KeyValueEditor 를 fields=object 로 노출하는 모든 케이스)에 재발할 수 있어 한 줄 기록 권장.

## consistency-check 출처

`review/consistency/2026/05/16/09_03_04/SUMMARY.md` INFO 1 + INFO 2 (cross_spec · rationale_continuity).

## 제안 변경

`spec/4-nodes/4-integration/4-cafe24.md` 의 §2 (설정 UI) 또는 §9 Rationale 에 다음 한 줄 추가:

> **Fields 편집 UI**: 내부적으로 `Array<{key, value}>` 편집 버퍼를 React state 로 관리한다. `onChange` 시 빈 key 행을 제거하고 `Record<string, unknown>` 로 변환해 `config.fields` 에 저장한다. 비어있는 key 행이 즉시 사라지는 것을 막아 "추가" 버튼이 행을 즉시 보여주도록 한다.

§9.5 (5필드 invariant 준수) 직후나 §2 (설정 UI) 마지막 단락이 자연스러운 위치.

## 작업 항목

- [ ] `project-planner` 가 spec/4-nodes/4-integration/4-cafe24.md 에 한 줄 추가
- [ ] (선택) 별도 시점 — §9 Rationale 절 순서 정리 (9.7/9.8 역전) + §5 Case 번호 연속화. SUMMARY.md INFO 3·4 참고

## 영향 범위

spec 본문 1~2 줄 추가. 코드/API/데이터모델 변경 없음.
