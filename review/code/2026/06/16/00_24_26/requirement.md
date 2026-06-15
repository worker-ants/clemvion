# Requirement Review — 인-에디터 실행 히스토리 패널 (§7)

리뷰 대상: exec-history-panel 구현 (파일 1~9)

---

## 발견사항

### [WARNING] [SPEC-DRIFT] spec/3-workflow-editor/3-execution.md §7 헤더·본문이 구현 이전 상태를 기술
- **위치**: `/Volumes/project/private/clemvion/spec/3-workflow-editor/3-execution.md` §7 (line 252~254, 256~258)
- **상세**: spec §7 헤더는 `_(인-에디터 진입점·오버레이 미구현 — 계획)_` 이고, §7 본문 callout은 "에디터 더보기(⋮) 메뉴는 현재 Version History / Export / Delete 만 제공하며 '실행 히스토리' 항목이 없다(`editor-toolbar.tsx`)…"로 코드가 이를 구현하지 않았다고 명시한다. 하지만 이번 변경으로 `editor-toolbar.tsx`에 "실행 히스토리" 메뉴 항목과 `ExecutionHistoryPanel` 컴포넌트가 완전히 구현됐다. spec §7.1 헤더의 `_(계획)_` 태그와 Rationale 섹션(line 746) `§7 인-에디터 실행 히스토리(⋮ 진입점·캔버스 오버레이·재실행)` 미구현 목록도 갱신 필요.
- **제안**: 코드 유지 + spec 반영. 갱신 대상:
  - `spec/3-workflow-editor/3-execution.md` §7 헤더 제목에서 `_(인-에디터 진입점·오버레이 미구현 — 계획)_` 제거 및 구현 완료 상태로 수정
  - §7 본문 callout (line 254) 내용을 구현 사실 반영으로 교체
  - §7.1 헤더 `_(계획)_` 제거
  - Rationale 섹션(line ~740~746) 미구현 항목 목록에서 `§7 인-에디터 실행 히스토리` 제거
  - frontmatter `partial` 여부도 재확인 필요

---

### [INFO] spec §7.3에 명시된 "엣지에 전달된 데이터 미리보기" 미구현
- **위치**: `spec/3-workflow-editor/3-execution.md` §7.3 (line 278), `execution-history-panel.tsx`
- **상세**: spec §7.3은 "엣지에 전달된 데이터 미리보기 가능"을 항목으로 나열한다. 이번 구현은 항목 클릭 시 `loadHistoricalExecution`으로 드로어·캔버스 오버레이를 채우는 핵심 경로는 구현했으나, 엣지 데이터 미리보기는 별도 캔버스 오버레이 레이어 기능으로 `applyExecutionSnapshot`에도 현재 구현돼 있지 않다. spec §7.3 bullet 3("엣지에 전달된 데이터 미리보기 가능")은 이번 PR 범위를 넘는 후속 구현 항목으로 보인다.
- **제안**: INFO로 분류(이번 PR 의도에 부합). 향후 구현 시 spec 본문 및 plan 갱신.

---

### [INFO] spec §7.3 "이 입력으로 다시 실행" — Re-run 버튼은 드로어 헤더에서 제공 (구현 일치)
- **위치**: `execution-history-panel.tsx`, `spec/3-workflow-editor/3-execution.md` §7.3·§10.14
- **상세**: spec §7.3은 "이 입력으로 다시 실행 버튼 제공"을 명시하고, 주석(line 368)에서 "재실행은 드로어 헤더의 Re-run(§10.14)이 담당한다"고 설명한다. `loadHistoricalExecution`이 `executionId`를 세팅하므로 드로어 헤더의 Re-run 버튼(`run-results-drawer.tsx` `allowReRun` 조건)이 자연스럽게 활성화된다. 구현 방식이 spec 의도와 일치.

---

### [INFO] `startHistoryView` 함수 — spec 본문에 함수명 정의 없음
- **위치**: `execution-store.ts`, `apply-execution-snapshot.ts`
- **상세**: spec에 `startHistoryView`라는 함수명·시그니처 정의가 없다. 코드 주석에서 spec §7.3/§10.10을 참조하고 있으나 spec 본문이 구체적인 store 메서드 인터페이스를 기술하지 않는 영역이다. spec이 침묵하는 구현 세부사항이므로 INFO.

---

### [INFO] `allExecutions` i18n 키 (editor.allExecutions) — 기존 키 재사용
- **위치**: `execution-history-panel.tsx` (line 438), `en/editor.ts` (line 2218)
- **상세**: `editor.allExecutions: "All Executions"` 키는 이번 변경에서 신규 추가된 것이 아니라 기존에 존재하는 키를 재사용한다. i18n 계층에 충돌 없음.

---

### [INFO] 메뉴 아이콘 — `<Play>` vs `<History>` 의미론
- **위치**: `editor-toolbar.tsx` §7 메뉴 버튼 (line 1841)
- **상세**: "실행 히스토리" 메뉴 항목에 `<Play size={14} />` 아이콘을 사용한다. Version History 메뉴는 `<History>` 아이콘을 사용하며, `<Play>`는 "실행"을 연상시키므로 약간 모호하나 spec에 아이콘 명세가 없으므로 INFO.

---

## 기능 완전성 평가

| 기능 | spec 근거 | 구현 여부 |
|------|-----------|----------|
| ⋮ 메뉴 → "실행 히스토리" 진입 (§7.1) | line 258 | 완료 |
| 최근 20건 목록 조회 (`GET /executions/workflow/:id`, §7.2) | line 330 | 완료 |
| 목록 항목: 상태·소요시간·트리거·시간 표시 (§7.2 wireframe) | line 266-271 | 완료 |
| 항목 클릭 → `GET /executions/:id` → `loadHistoricalExecution` (§7.3) | line 274-279 | 완료 |
| 패널 닫기 (항목 선택 후) | line 279 | 완료 |
| 빈 목록 empty state | 관행 | 완료 |
| 목록 조회 실패 에러 상태 | 관행 | 완료 |
| 상세 조회 실패 → 에러 토스트, 패널 유지 | 관행 | 완료 |
| "전체 실행" 링크 (`/workflows/:id/executions`) | 코드 주석 | 완료 |
| workflowId 없을 때 버튼 disabled | 방어 | 완료 |
| Re-run (§7.3 / §10.14) | executionId 세팅으로 간접 충족 | 완료 |
| 엣지 데이터 미리보기 (§7.3 bullet 3) | line 278 | 미구현 (후속 scope) |

---

## 요약

이번 변경은 spec/3-workflow-editor/3-execution.md §7에서 "계획(미구현)"으로 표시된 인-에디터 실행 히스토리 패널을 완전히 구현했다. 핵심 기능(⋮ 메뉴 진입점, 목록 조회, 항목 클릭 → 드로어·캔버스 오버레이 적재, 패널 닫기, 에러 상태)을 spec §7.1~§7.3 설계 의도에 부합하게 구현했으며, `loadHistoricalExecution`이 기존 `applyExecutionSnapshot` 경로를 재사용함으로써 spec §10.10("실행 히스토리에서 과거 실행을 클릭하면, 해당 실행의 모든 노드 결과로 드로어를 채운다")도 충족한다. 엣지 데이터 미리보기(§7.3 bullet 3)는 이번 범위 밖으로 보이나 spec §7 헤더·본문·Rationale이 여전히 "미구현" 상태를 기술하므로 spec 갱신이 필요하다(SPEC-DRIFT). 코드 자체의 기능 완전성과 엣지 케이스(null `triggerLabel`, 빈 목록, 조회 실패, `open=false` 비렌더) 처리는 적절하다.

---

## 위험도

LOW
