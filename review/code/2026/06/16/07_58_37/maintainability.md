# 유지보수성(Maintainability) 리뷰

리뷰 대상: `authentication/page.tsx` RBAC 가드 통합 + 연관 테스트 파일 변경
리뷰 일시: 2026-06-16

---

## 발견사항

### 파일 1: authentication-form.test.tsx

- **[INFO]** `MUTATION_BUTTON_NAMES` 상수 선언 위치가 `describe` 블록 최상단이 아닌 `it` 블록 사이에 삽입됨
  - 위치: diff 기준 라인 38-45 — `beforeEach` 블록 이후, 두 번째 `it` 직전
  - 상세: `const MUTATION_BUTTON_NAMES` 가 `describe` 본문 최상단이 아니라 기존 `it` 블록 삭제 자리에 인라인 삽입되어 있다. `describe` 내부의 다른 `beforeEach`/`afterEach`/헬퍼 함수들은 블록 상단·하단에 배치되는 컨벤션인데, 이 상수만 `it` 블록과 같은 레벨에서 `it` 사이에 끼여 있어 눈에 잘 띄지 않는다.
  - 제안: `const existing = ...` 선언 바로 뒤(또는 앞)로 이동해 "상수 선언 → beforeEach → it 블록들" 의 읽기 흐름을 유지할 것.

- **[INFO]** 두 `it` 케이스에서 `MUTATION_BUTTON_NAMES` 루프 순회 패턴이 matcher 하나만 다르게 반복됨
  - 위치: diff 기준 라인 56-58, 65-67
  - 상세: `for (const name of MUTATION_BUTTON_NAMES) { expect(...).not.toBeInTheDocument(); }` 와 `for (const name of MUTATION_BUTTON_NAMES) { expect(...).toBeInTheDocument(); }` 는 matcher 하나만 다르다. 현 상태에서는 중복이 경미하고 추출 시 오히려 가독성이 낮아질 수 있어 허용 수준이나, 버튼 목록이 자주 바뀔 것으로 예상되면 헬퍼 함수 추출(`assertMutationButtonsVisible(expected: boolean)`)이 미래 수정 부담을 줄인다.
  - 제안: 즉각 수정 강제 아님. 버튼 목록 변화 빈도에 따라 헬퍼 추출 고려.

- **[INFO]** `MUTATION_BUTTON_NAMES` 에 `Deactivate` 만 있고 `Activate` 는 없음
  - 위치: diff 기준 라인 41, 주석 `// isActive=true 행의 토글 라벨`
  - 상세: 목 데이터 `existing.isActive = true` 이므로 토글 버튼 라벨이 `Deactivate` 인 것은 올바르고 주석도 명시적으로 설명하고 있다. 그러나 미래 독자가 "왜 Activate 는 없지?" 혼동할 가능성이 있다.
  - 제안: 현행 주석 허용. 필요하다면 "isActive=false 시에는 Activate로 바뀌나 목 데이터 고정이므로 Deactivate만 검증" 수준으로 보강 가능.

---

### 파일 2: authentication/page.tsx

- **[INFO]** 단일 `{isAdmin && (...)}` 가드로 통합 — 중복 제거 + 의도 명확성 개선
  - 위치: diff 라인 `@@ -496,26 +499,30 @@`
  - 상세: 이전에는 Toggle 버튼 밖에 두고 Reveal/Edit 버튼 각각에 `{isAdmin && (...)}` 를 달던 구조였다. 변경 후에는 액션 셀 전체를 단일 가드로 감싸 중복 내부 가드를 제거했다. 향후 버튼이 추가될 때 개별 가드를 빠뜨릴 위험도 사라졌다. 긍정적 변경.
  - 제안: 없음.

- **[INFO]** 헤더의 "Add Config" 버튼 가드와 행 액션 가드가 250줄 이상 떨어진 두 곳에 분산
  - 위치: diff 라인 `@@ -260,10 +260,13 @@` (Add Config) vs `@@ -496,26 +499,30 @@` (행 액션)
  - 상세: `isAdmin` 값은 훅 한 곳에서 파생되므로 동작에는 문제가 없다. 그러나 `authentication/page.tsx` 가 600줄을 넘는 구조에서 두 가드 변경점이 멀리 떨어져 있어 미래에 RBAC 정책이 바뀔 때 둘 다 수정해야 한다는 것을 파악하기 어렵다.
  - 제안: 단기적으로 현행 유지 허용. 중기적으로 God Component 추가 분리 시 행 액션 셀을 별도 컴포넌트로 추출하고 `isAdmin` 을 prop 으로 전달해 가드 진입점을 단일화할 것.

- **[INFO]** 액션 셀 `<td>` 내부의 JSX 주석이 4줄로 장문화
  - 위치: 변경 후 `{/* Auth Config 변경 액션(활성 토글·reveal·편집·재발급·삭제)은 모두 Admin+ 만 ... */}` 블록
  - 상세: JSX 내부 블록 주석으로서는 다소 길다. spec 참조·백엔드 강제 여부·드로어 읽기 예외 설명까지 담고 있어 렌더 코드를 읽는 흐름이 끊긴다. 동일 내용이 `isAdmin` 선언부 주석(라인 559-562)에도 이미 기술되어 있어 중복이다.
  - 제안: JSX 주석은 "왜 이 가드가 존재하는가" 한 줄(예: `{/* Admin+ 전용 — 非admin 의 403 방지, spec §3.2 */}`)로 축약하고 상세 설명은 `isAdmin` 선언부 주석 단일 SoT 로 집중. 즉각 수정 강제 아님.

- **[INFO]** 비-admin 시 `<td>` 내부가 `null` 이 되어 `stopPropagation` 핸들러도 제거됨
  - 위치: 변경 후 `<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>`
  - 상세: 이전 구조에서도 같은 `<div>` 에 `stopPropagation` 이 있었으므로 이 변경이 신규 도입한 이슈가 아니다. 비-admin 일 때 `{isAdmin && (...)}` 가 `null` 이 되면 `<td>` 는 비어 있고 이벤트 버블링 방지도 제거된다. 이로 인해 비-admin 이 `<td>` 를 클릭하면 이벤트가 `<tr>` 로 버블링되어 드로어가 열린다. 이는 "비-admin 은 usage 드로어(읽기)는 허용" 명세와 일치하므로 동작상 올바르다.
  - 제안: 없음. 동작이 의도와 일치함을 확인.

---

### 파일 3: plan/in-progress/spec-sync-config-gaps.md

- **[INFO]** plan 파일 완료 표기 및 맥락 기술이 충분히 상세함 — 추적성 양호
  - 위치: diff 라인 1260-1264
  - 상세: `[x]` 완료 표기와 함께 RBAC 가드 범위(Toggle 포함 근거), spec 참조, 테스트 게이트 결과까지 기술되어 있어 나중에 이 변경을 되짚을 때 충분한 맥락을 제공한다.
  - 제안: 없음.

---

## 요약

이번 변경의 핵심인 "행 액션 셀 전체를 단일 `{isAdmin && (...)}` 로 감싸 Reveal/Edit 개별 내부 가드를 제거" 한 것은 유지보수성 관점에서 명확한 개선이다. 중복 가드 제거로 RBAC 적용 범위를 한눈에 파악할 수 있고, 버튼이 추가될 때 개별 가드를 달지 않아도 되는 구조로 바뀌었다. 테스트 파일도 `MUTATION_BUTTON_NAMES` 상수를 단일 정의로 관리하는 방향으로 개선되어 버튼 목록 변경 시 수정 지점이 최소화되었다. 발견된 이슈는 모두 INFO 등급으로, 상수 선언 위치(describe 블록 내 it 사이 삽입), JSX 주석 장문화 및 내용 중복, 분산된 두 가드 위치 등 사소한 가독성·정리 여지이며 동작 정확성 및 RBAC 정책 일관성에는 이상이 없다.

## 위험도

LOW
