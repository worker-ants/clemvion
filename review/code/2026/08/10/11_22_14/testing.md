# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `blockRange`/`findKeyLine` 가 `_shared.ts` 의 공개 export 로 승격됐지만 직접 유닛 테스트는 없다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:74`(`blockRange`), `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:87`(`findKeyLine`)
  - 상세: 종전엔 `internal-package-registration-guard.ts` 의 비공개 헬퍼였고 `listAtPath`/`blockScalarAtPath` 를 통한 간접 커버리지만 있었다. 이관 후에도 여전히 간접 커버리지만 있다(`internal-package-registration.test.ts` 의 `listAtPath`/`blockScalarAtPath` describe 블록, `shared.test.ts` 는 `repoRoot` 만 다룸). 두 가드가 공유하는 공개 표면이 된 이상, 예를 들어 `findKeyLine` 의 "리스트 항목(`- name: x`)은 건너뛴다" 분기나 `blockRange` 의 "key 자신의 들여쓰기와 같은 줄에서 멈춘다" 경계를 겨냥한 직접 fixture 가 있으면 두 가드 어느 한쪽의 조합 테스트가 우연히 그 경로를 덮지 못하게 되는 미래 드리프트에도 안전하다.
  - 제안: 필수는 아니다(동작 자체는 이관 전과 동일하고 간접 커버리지가 이미 존재) — 여유가 있으면 `_shared.ts` 전용 fixture(`shared.test.ts` 확장 또는 신설)로 두 헬퍼를 직접 겨냥하는 것을 고려.

- **[INFO]** `discoverWorkspaceDirs(readLines)` 의 주입 테스트는 fail-closed(throw) 경로만 겨냥하고, 주입된 성공 경로(synthetic happy path)는 없다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts:210`(`discoverWorkspaceDirs 가 실제로 그 검증을 태운다` 테스트)
  - 상세: 새로 추가된 호출부 테스트(§2 커버리지 갭 대응)는 `readLines` 가 null/빈 배열을 내는 두 실패 케이스만 확인한다. `validateWorkspacePatterns` 통과 후 `expandWorkspaceGlobs` 로 이어지는 성공 조합은 오직 실제 저장소를 읽는 "실측" describe 블록(`typescript-toolchain.test.ts:47` 부근)에서만 검증된다. 고정 경로(글롭 없는 `packages:` 항목, 예: `["packages:", "  - 'codebase/backend'"]`)라면 `expandWorkspaceGlobs` 가 `readDir` 콜백을 타지 않으므로 실제 파일시스템 접근 없이 `discoverWorkspaceDirs(readLines)` 의 성공 경로만 합성 입력으로 고정하는 테스트도 작성 가능하다.
  - 제안: 선택 사항. 현재도 실측 테스트가 성공 경로 조합을 덮고 `expandWorkspaceGlobs` 자신은 별도 fixture(`readDir` 주입)로 고정돼 있어 실질적 위험은 낮다.

- **긍정 관찰**: `repoRoot(startDir, exists)` 의 대칭 주입 — 이전 리뷰가 지적한 `discoverWorkspaceDirs(readLines)` 대비 비대칭을 바로잡았고, `shared.test.ts` 가 fail-closed throw(메시지에 `startDir` 포함 여부까지)·최근접 marker 우선·filesystem-root 조기 종료(부모==자신)·`MAX_ROOT_SEARCH_DEPTH` 정확한 소진 횟수(`toBe`, 상한 미만이 아니라 정확히 일치)까지 경계값을 촘촘히 고정했다. `MAX_ROOT_SEARCH_DEPTH` 를 export 해 매직넘버 하드코딩 없이 테스트가 상수를 직접 참조하는 점도 좋다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/shared.test.ts:17`~`:79`
- **긍정 관찰**: `internal-package-registration.test.ts` 의 "인라인 주석을 항목에서 떼어낸다" 신규 테스트는 뮤테이션 실측으로 발견된 진짜 커버리지 공백(주석 제거 로직이 지워져도 기존 스위트가 green 이었다)을 정확히 겨냥해 닫는다. 따옴표 있는 항목/없는 항목 둘 다 한 번에 확인해 실제 저장소 형태(§9줄 근거 주석 컨벤션)를 반영한다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:338`
- **긍정 관찰**: `validateWorkspacePatterns` 분리 + 테스트(`typescript-toolchain.test.ts:185`)가 `null`(키 부재)과 `[]`(항목 부재)을 **별도** 케이스로 갈라 검증한 것이 좋다 — `listAtPath` 가 실패를 두 가지 다른 값으로 표현하는데 한쪽만 막으면 나머지로 vacuity 가 그대로 새는 실제 취약점을 정확히 겨냥한다. 통과 경로에서 입력을 변형하지 않는지("값을 바꾸지 않는다")까지 별도로 단언한 점도 꼼꼼하다.

## 요약

이번 변경은 신규 기능이 아니라 repo-guard 테스트 인프라 자체의 리팩터(중립 모듈 `_shared.ts` 로 공유 프리미티브 이관)와, 이전 리뷰가 지적한 두 가지 실제 결함(① `repoRoot` 가 `__dirname` 하드코딩 때문에 테스트 불가능했던 fail-closed 분기, ② `discoverWorkspaceDirs` 의 vacuity 가드가 헬퍼로 분리된 뒤에도 호출부에서 우회될 수 있었던 뮤턴트 생존)을 의존성 주입으로 해소하고 합성 fixture 로 고정하는 작업이다. 테스트 존재 여부·엣지 케이스·격리·가독성 모두 높은 수준을 보이며, 특히 각 신규 테스트가 "왜 이 케이스가 이 파일이 생긴 이유인가"를 주석으로 명시해 의도가 명확하다. mock 대신 순수 함수 + 페이크 주입(`exists`, `readLines`, `readDir`)을 일관되게 쓴 것도 실제 동작과의 괴리 위험을 낮춘다. 회귀 측면에서도 기존 "실측" describe 블록은 그대로 유지되고 재export 로 소비처 계약이 보존돼 있어 기존 테스트가 무효화될 위험은 없다. 위에서 지적한 두 가지는 모두 INFO 수준의 선택적 보강이며 현재 상태로도 실질적 커버리지 공백은 없다고 판단한다.

## 위험도

LOW
