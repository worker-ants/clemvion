# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** 중복 키 입력 시 마지막 값으로 덮어쓰기 — 명세 미기록
  - 위치: `integration-configs.tsx` — `fieldRowsToObject` 함수 (라인 301~309)
  - 상세: `for (const it of rows)` 루프에서 동일한 key를 가진 행이 여럿 존재할 때 나중 행이 앞 행을 묵묵히 덮어씀. 이 동작이 의도인지 에러로 처리해야 하는지 spec(`spec/4-nodes/4-integration/4-cafe24.md`)에 정의되어 있지 않음. 현재는 UI에서 중복 키 행을 막는 검증도 없음.
  - 제안: 중복 키 행에 대해 (1) UI 레벨에서 경고 표시 또는 (2) "마지막 값 우선" 정책을 spec Rationale에 명시. 최소한 주석으로 의도 기록 권장.

- **[INFO]** `objectsEqual` 의 단방향 키 비교 — 논리적 허점
  - 위치: `integration-configs.tsx` — `objectsEqual` 함수 (라인 311~322)
  - 상세: `aKeys` 를 순회하며 `b[k]` 를 검사하지만, `b` 에만 있는 키는 검사하지 않음. `aKeys.length !== bKeys.length` 가 앞서 걸러주므로 실제로는 정확하게 동작하지만, 코드만 보면 단방향 비교처럼 읽혀 이후 유지보수자가 `length` 체크를 제거하거나 함수를 재사용할 때 버그를 유발할 수 있음.
  - 제안: `for (const k of aKeys)` 앞에 `if (!(k in b)) return false;` 를 추가해 함수 자체가 완결된 양방향 비교임을 명시적으로 표현.

- **[INFO]** 렌더 중 `setFieldRows` / `setLastPropagated` 호출 — strict mode 이중 실행 주의
  - 위치: `integration-configs.tsx` — `Cafe24Config` 컴포넌트 본문 (라인 349~355)
  - 상세: React Strict Mode 는 개발 환경에서 렌더 함수를 두 번 실행한다. `if (!objectsEqual(...)) { setFieldRows(...); setLastPropagated(...); }` 패턴은 React 공식 문서가 권장하는 "이전 렌더 정보 저장" 패턴이어서 실제 버그는 없으나, 첫 렌더 사이클에서 setState 가 두 번 예약될 수 있음. 현재 테스트는 Strict Mode 없이 실행되므로 이 경로가 검증되지 않음.
  - 제안: 테스트 환경에도 `<React.StrictMode>` 래퍼를 적용하거나, 해당 패턴이 Strict Mode에서 안전함을 주석으로 명시.

- **[INFO]** `normalizeCafe24Fields` — `config.fields` 가 `null` 인 경우 처리 경로 누락 가능성
  - 위치: `integration-configs.tsx` — `normalizeCafe24Fields` 함수 (라인 280~294 추정)
  - 상세: `externalFields` 계산 시 `config.fields && typeof config.fields === "object" && !Array.isArray(config.fields)` 조건이 `null` 을 걸러냄(JS에서 `null` 은 falsy). 그러나 `normalizeCafe24Fields` 내부에서 `raw` 가 `null` 일 때 어느 분기를 타는지 diff 상 명확하지 않음. `normalizeCafe24Fields(config.fields)` 로 직접 호출하는 초기화 경로(`useState` lazy initializer)에서 `config.fields` 가 `undefined` 또는 `null` 이면 안전하게 `[]` 를 반환하는지 확인 필요.
  - 제안: `normalizeCafe24Fields` 첫 줄에 `if (!raw) return [];` 가드를 명시적으로 두거나, 기존 가드가 충분함을 주석으로 표기.

- **[INFO]** 테스트 — 제거 버튼 탐색 로직이 취약함
  - 위치: `cafe24-config.test.tsx` — "removes a row" 테스트 (라인 202~223)
  - 상세: `row.querySelector("button:not([data-state])")` 로 버튼을 찾되, 실패 시 `candidateButtons[candidateButtons.length - 1]` 를 fallback으로 사용함. `removeButton ?? targetButton` 는 DOM 구조에 강하게 결합되어 있어, KeyValueEditor 의 버튼 구조가 변경되면 이 테스트가 잘못된 버튼을 클릭하고도 통과할 수 있음.
  - 제안: 버튼에 `data-testid="remove-row"` 또는 `aria-label` 을 부여해 테스트가 의미 기반으로 버튼을 탐색하도록 KeyValueEditor 를 개선. 단기적으로는 fallback 경로를 사용할 경우 명시적 경고를 남기거나 `expect(removeButton).not.toBeNull()` 를 추가해 null 탐색이 발생했을 때 테스트가 즉시 실패하도록 수정.

- **[INFO]** plan 문서 — 체크박스 전체 완료 후 `complete/` 이동 항목 누락
  - 위치: `plan/in-progress/cafe24-fields-add-button-fix.md`
  - 상세: 작업 항목 체크박스가 모두 `[x]` 로 완료 처리되어 있으나 파일이 여전히 `plan/in-progress/` 에 위치함. CLAUDE.md 규약에 따르면 모든 항목이 완료된 순간 `git mv` 로 `plan/complete/` 로 이동해야 함.
  - 제안: 이 PR merge 전 또는 직후 `git mv plan/in-progress/cafe24-fields-add-button-fix.md plan/complete/cafe24-fields-add-button-fix.md` 실행.

- **[INFO]** `spec-update-cafe24-fields-ui-buffer.md` — `worktree` frontmatter 값이 `(none)`
  - 위치: `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md` (라인 2)
  - 상세: `worktree: (none — project-planner 진입 시 새 worktree)` 는 규약(`plan/in-progress/` frontmatter 에 실제 worktree 이름 기록)을 충족하지 않음. `consistency-checker` 의 `plan_coherence` 가 이 파일을 orphan plan 으로 감지할 수 있음.
  - 제안: project-planner 가 실제 worktree 를 생성한 뒤 이 값을 갱신하거나, 이 plan 자체를 planner 가 새 worktree 에서 처음부터 작성하는 방식으로 변경.

## 요약

이번 변경은 Cafe24 노드 설정 패널에서 Fields "추가" 버튼이 빈 행을 즉시 삭제하던 버그를 React 로컬 state 버퍼 도입으로 정확히 해결하고 있다. 핵심 비즈니스 로직(빈 key 행을 UI에는 유지하되 백엔드 계약인 `Record<string, unknown>` 형태로 전달)이 구현과 일치하며, 5개 회귀 테스트로 주요 시나리오를 모두 커버한다. CRITICAL 또는 WARNING 수준의 요구사항 위배는 없다. 발견된 사항은 모두 INFO 수준으로, 중복 키 정책 미명세, `objectsEqual` 단방향 순회의 가독성 문제, Strict Mode 미검증, 삭제 버튼 탐색 취약성, plan 파일 상태 관리 미완 등이다. 기능 완전성과 에러 시나리오 처리는 이 변경 범위(단일 컴포넌트 UI 트윅) 내에서 적절히 구현되어 있다.

## 위험도

LOW
