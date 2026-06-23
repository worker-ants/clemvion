# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] plan 문서에 "후속(별건)" 항목 추가 — 범위 내 문서화
- 위치: `plan/in-progress/refactor/02-architecture.md` M-8 2단계 항목
- 상세: plan 에 "후속(별건, M-8 외):" 라인으로 향후 작업 후보(`useCreateTriggerForm`, `lib/mappers`, `TriggerDetailView` 개칭, `unwrap` 통일, `onDeleted?` 콜백)가 명시됐다. 이 항목들은 현 커밋에서 실제로 구현되지 않고 메모 수준으로만 등록되어 있다. 범위 밖 작업이 코드로 실현된 것은 아니므로 SCOPE 위반이 아니나, 향후 범위 불명확성의 씨앗이 될 수 있다.
- 제안: "후속" 항목은 별도 plan 항목(예: M-8 3단계 또는 신규 항목)으로 분리하거나, 현행처럼 메모로 유지하되 이번 PR 에서 구현하지 않음을 명확히 표기한다. 현재는 명확히 "별건" 으로 표기되어 있어 허용 수준.

### [INFO] consistency check 산출물 및 plan 갱신 포함 — 정상 범위
- 위치: `review/consistency/2026/06/23/09_47_27/` 전체 (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md 등)
- 상세: consistency check 산출물은 개발자 SKILL 규약상 구현 착수 전 의무 실행 결과이며, 동일 커밋에 포함되는 것은 워크플로 정상 패턴이다. plan 갱신(02-architecture.md) 역시 2단계 완료 상태 반영으로 의도된 범위 내 변경이다.
- 제안: 없음.

### [INFO] `useCardEditToggle` 훅 신설 — 범위 내 최소 추상화
- 위치: `codebase/frontend/src/components/triggers/hooks/use-card-edit-toggle.ts`
- 상세: 커밋 메시지에 명시된 범위(hooks 2파일 추출) 내 신설이다. 15줄의 최소 훅으로 과도한 추상화에 해당하지 않는다. 4개 카드가 동일 패턴을 공유하므로 범위 내 DRY 처리로 정당하다.
- 제안: 없음.

### [INFO] `trigger-detail-drawer.tsx` 에서 `invalidateAfterSave` → `invalidate` 함수명 변경
- 위치: `trigger-detail-drawer.tsx` 패치, 각 카드의 `onSaved={invalidate}` 전달부
- 상세: 함수명이 `invalidateAfterSave` 에서 `invalidate` 로 단축됐다. 기능 동작은 동일하고, 이름 변경은 새로 추출된 `useTrigger` hook 의 반환값 이름(`invalidate`)과 정렬하기 위한 것이다. 사소한 이름 변경이지만 의도된 범위(hook 추출 + drawer 교체)에 부수적으로 수반된다. 범위 위반 아님.
- 제안: 없음.

### [INFO] `OverviewCard` 의 `cancelEdit` 구현 미세 변경
- 위치: `codebase/frontend/src/components/triggers/cards/overview-card.tsx` L1231
- 상세: 기존 drawer 내 `cancelEdit()` 는 `setNameValue(trigger.name); setEditing(false)` 두 줄을 직접 호출했다. 신규 파일에서는 `cancelEdit(() => setNameValue(trigger.name))` 으로 `useCardEditToggle.cancelEdit(onReset)` 패턴을 사용한다. 동작 결과는 동일하다. 커밋 메시지에서 "Overview 의 nameValue-reset startEdit 은 로컬 유지"라고 명시했으므로 의도된 범위 내 변경이다.
- 제안: 없음.

## 요약

변경 범위는 커밋 메시지와 plan 에 명시된 목표(god-component 파일 분리 + hooks 추출)에 충실하게 제한되어 있다. 모든 변경은 `trigger-detail-drawer.tsx` 의 구조적 재편(cards/ 5파일 + hooks/ 2파일 추출)과 그에 따른 plan 상태 갱신, consistency check 의무 산출물로 구성된다. 요청하지 않은 기능 추가, 무관한 파일 수정, 의미 없는 포맷팅 변경, 불필요한 임포트 조작은 식별되지 않았다. `useCardEditToggle` 훅은 4개 카드가 공유하는 편집 토글 패턴의 최소 추상화로 범위 내 정당하다. plan 에 기록된 "후속(별건)" 항목은 코드 구현 없이 메모 수준으로만 등록되어 있어 허용 범위에 해당한다.

## 위험도

NONE

STATUS: OK
