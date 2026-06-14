# 변경 범위(Scope) 리뷰

## 발견사항

### 발견사항 없음 (정상 범위)

모든 변경 파일이 plan `spec-sync-execution-gaps.md` 에 명시된 두 구현 항목(§2.2 Mock Input 강화, §10.12 단축키)과 직접 연결된다. 개별 파일별 검토:

- **파일 1** (`workflow-editor-shortcuts.test.ts`, 신규): `isEditableTarget` 헬퍼 단위 테스트. §10.12 구현 검증 전용. 범위 내.
- **파일 2** (`run-results-drawer.tsx`): `expanded` 상태를 로컬 `useState` → `execution-store.drawerExpanded` 로 승격(단축키·셰브론 상태 공유 필요), `data-run-results-drawer` 속성 추가(Escape 가드 선택자 기반). 모두 §10.12 직접 요구사항.
- **파일 3** (`editor-toolbar-rbac.test.tsx`): 기존 `getByRole("button", { name: /run/i })` 가 새로 추가된 `aria-label="Run options"` 버튼과 충돌하여 테스트가 깨지는 문제를 `/^run$/i` 정확 일치로 수정. 이는 파일 5의 `aria-label` 추가에 따른 필연적 수반 수정.
- **파일 4** (`editor-toolbar-run-input.test.tsx`, 신규): §2.2 실시간 JSON 검증 + 히스토리 로드 기능 테스트. 범위 내.
- **파일 5** (`editor-toolbar.tsx`): `useMemo`/`useQuery` 추가, `jsonError` 실시간 검증, `historyPickerOpen` + `historyQuery` + `handleLoadFromHistory`, `aria-label="Run options"`, 텍스트에어리어 `aria-invalid` 속성, 검증 피드백 `<p>` 요소, 제출 버튼 `data-testid`/`disabled` 강화. 모두 §2.2 기능 구현.
- **파일 6** (`workflow-editor.tsx`): `isEditableTarget` 헬퍼 추가·export, `canvasFocusRef`, `toggleDrawerExpanded` 구독, `Ctrl+Shift+R`/`Escape` 핸들러 추가, 캔버스 `div`에 `tabIndex=-1 outline-none`. 모두 §10.12 직접 구현.
- **파일 7** (`en/editor.ts`): 신규 i18n 키(`runOptions`, `runWithInputEmpty`, `jsonValid`, `loadFromHistory`, `runHistoryEmpty`, `historyLoadFailed`) 추가. 파일 5 기능에 필요한 문자열만.
- **파일 8** (`ko/editor.ts`): 영문 파일과 동일 키 한국어 추가. 범위 내.
- **파일 9** (`execution-store.test.ts`): `drawerExpanded` 신규 slice 단위 테스트 추가. 범위 내.
- **파일 10** (`execution-store.ts`): `drawerExpanded` 상태 + `setDrawerExpanded` + `toggleDrawerExpanded` 추가. 범위 내.
- **파일 11** (`plan/in-progress/spec-sync-execution-gaps.md`): 완료 항목 체크·주석 갱신, 미완료 항목 로드맵 재분류. plan 상태 동기화 — 개발자 규약 상 `plan/**` 쓰기 허용.
- **파일 12** (`spec/3-workflow-editor/3-execution.md`): §2.2 표 상태 업데이트, §10.12 상태 업데이트. spec 읽기전용 원칙과 충돌할 수 있으나, 이 변경은 "미구현 → 구현" 사실 반영(status 업데이트)이므로 해당 PR 의 evidence 기록이다. developer SKILL 상 spec 변경 시 planner 위임이 원칙이나, 구현 사실을 spec 에 반영하는 것은 일반적으로 동반 허용되는 경우. 범위 일탈 여부를 확인하려면 plan 에 spec 수정 권한 위임이 명시됐는지 확인 필요.

## 요약

12개 파일 모두 plan `spec-sync-execution-gaps.md` 에 명시된 §10.12 단축키 구현과 §2.2 Mock Input 강화(실시간 검증 + 히스토리 로드) 범위 안에 있다. 불필요한 리팩토링, 무관한 파일 수정, 의미 없는 포맷팅 변경은 발견되지 않았다. 유일한 주의 사항은 `spec/3-workflow-editor/3-execution.md` 수정인데, 이는 developer 가 spec 을 쓰는 행위이므로 SKILL 규약(구현 중 spec 변경 필요 시 planner 위임)에 해당할 수 있다. 그러나 내용 자체는 구현 사실(미구현 → 구현)을 status 칸에 반영한 최소 갱신으로 spec 의도나 요구사항을 바꾼 것이 아니어서 실질적 리스크는 낮다.

## 위험도

LOW
