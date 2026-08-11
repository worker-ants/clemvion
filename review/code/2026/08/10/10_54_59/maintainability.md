# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `validateWorkspacePatterns`로 로직을 뽑아냈는데 에러 메시지의 함수명 접두사가 옛 이름(`discoverWorkspaceDirs:`) 그대로 남았다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:124`
  - 상세: 이번 diff의 §2 조치는 `discoverWorkspaceDirs` 안에 있던 fail-closed throw 를 `validateWorkspacePatterns` 순수 함수로 추출하는 것이다(정확히 이 리팩터가 목적). 그런데 `throw new Error("discoverWorkspaceDirs: pnpm-workspace.yaml 의 packages: 목록을 읽지 못했다 — " + …)` 의 메시지 문자열은 여전히 옛 함수 이름을 접두사로 쓴다. 실제로 이 에러는 이제 `validateWorkspacePatterns` 에서 던져진다(`discoverWorkspaceDirs`는 그 결과를 소비할 뿐). 테스트는 정규식 `/packages: 목록을 읽지 못했다/`으로만 매칭해 이 드리프트를 못 잡는다. 함수명을 메시지에 박아 두는 이 저장소 관행(예: `fnBody`의 `"fnBody: ${fn} 선언을 찾지 못함…"`) 자체는 디버깅에 유용하지만, 리팩터로 던지는 위치가 바뀌었는데 문자열이 안 따라가면 향후 스택트레이스/grep 기반 추적 시 오도한다.
  - 제안: 접두사를 `"validateWorkspacePatterns: …"`로 갱신하거나, 호출부에 종속되지 않도록 접두사를 아예 빼고 "packages: 목록을 읽지 못했다" 로만 남긴다.

- **[INFO]** `_shared.ts`의 재export 목록이 손으로 나열한 심볼 리스트라, `_shared.ts`가 확장돼도 자동으로 안 따라간다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:29-42`
  - 상세: `import { ROOT, blockRange, findKeyLine, listAtPath, repoRoot, type PackageManifest } from "./_shared"` 뒤에 `export { ROOT, blockRange, findKeyLine, listAtPath, repoRoot }; export type { PackageManifest };` 로 동일 심볼을 다시 손으로 나열해 재export 한다. 주석이 이유(기존 소비처 계약 유지, 소유권만 이전)를 명확히 밝혀 두었고, `_shared.ts`가 새 export를 추가해도 이 목록이 안 따라가면 컴파일 에러로 fail-loud 하게 드러나므로(조용한 데이터 오염이 아님) 이 저장소가 경계하는 "손 유지 목록이 조용히 어긋나는" 실패 클래스와는 다르다. 다만 두 소비처(`internal-package-registration.test.ts`는 이 재export 경로로, `typescript-toolchain-guard.ts`는 `_shared.ts`를 직접)로 갈라진 상태가 영구화되면 "같은 심볼을 두 경로로 가져오는" 진입점 혼란이 남는다.
  - 제안: 과도기 조치임을 plan 문서(`typescript-toolchain-followups.md`)의 후속 항목으로 명시해 두면, 다음에 `internal-package-registration.test.ts`를 만질 때 `_shared.ts`를 직접 import 하도록 소비처를 수렴시키는 계기가 된다. 지금 당장 고칠 필요는 없다.

- **[INFO]** JSDoc 블록 바로 뒤에 스타일이 다른 plain `//` 주석 블록이 붙어 IDE 툴팁에서 누락될 수 있다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:197-207` (특히 202-206)
  - 상세: `loadTypescriptFrom`의 함수 설명은 `/** … */` JSDoc(197-202)에 있고, 반환 타입을 `unknown | null`이 아니라 `unknown`으로 둔 근거는 바로 다음 줄부터 별개의 `//` 라인 주석 블록(203-206)으로 이어진다. 두 블록이 내용상 한 함수에 대한 설명인데 주석 형식이 갈려, 에디터의 hover 문서(JSDoc만 렌더링)에서는 반환 타입 근거가 보이지 않는다. 같은 파일의 다른 곳(예: `validateWorkspacePatterns`)은 근거를 전부 JSDoc 안에 담아 일관된 패턴을 쓴다.
  - 제안: 203-206 블록을 JSDoc 안(202 `*/` 이전)으로 합치면 일관성과 툴팁 가시성이 함께 개선된다.

- **[INFO]** `validateWorkspacePatterns`가 서로 다른 두 실패(`null` = 키 부재, `[]` = 항목 부재)를 같은 문자열로 던져 원인 구분이 안 된다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:122-127`
  - 상세: 테스트(`typescript-toolchain.test.ts`)는 이 두 케이스를 "갈라서" 검증한다고 명시적으로 강조하는데("null 과 갈라 두는 이유: … 한쪽만 막으면 나머지 한쪽으로 vacuity 가 그대로 들어온다"), 정작 프로덕션 에러 메시지 자체는 두 원인에 대해 동일한 텍스트를 낸다. 테스트 통과에는 문제없지만(정규식만 매칭), 실제 저장소에서 이 throw 가 발동했을 때 메시지만으로는 `packages:` 키가 아예 없는지, 키는 있는데 항목이 비었는지 구분할 수 없다.
  - 제안: 필수는 아니지만, 두 분기에 각각 다른 문구(또는 원인 태그)를 주면 실제 사고 시 원인 파악이 빨라진다.

## 요약

이번 변경은 `internal-package-registration-guard.ts`가 소유하던 공유 프리미티브(`repoRoot`/`ROOT`/`PackageManifest`/YAML 서브셋 추출기)를 중립 모듈 `_shared.ts`로 옮겨 무관한 형제 가드 간 결합을 끊고, `validateWorkspacePatterns`를 순수 함수로 분리해 이전에 실제 I/O에 묶여 합성 입력으로 겨냥할 수 없던 fail-closed 분기를 테스트 가능하게 만든 리팩터다. 함수는 모두 짧고 단일 책임이며, 네이밍·주입 패턴(`readLines`/`readDir`/`readManifest`)이 파일 내에서 일관되고, 새 동작을 뒷받침하는 합성 fixture 테스트(인라인 주석 스트립, null/[] 구분, 호출부 뮤테이션 방어)가 함께 추가돼 회귀 방지력도 갖췄다. 실질 결함은 없고, 리팩터 과정에서 남은 사소한 텍스트 드리프트(에러 메시지의 옛 함수명 접두사)와 주석 스타일 불일치 정도만 지적할 만하다.

## 위험도

LOW
