# 요구사항(Requirement) Review

## 리뷰 대상

`plan/in-progress/typescript-toolchain-followups.md` §1(공유 프리미티브 `_shared.ts` 분리) ·
§2(`validateWorkspacePatterns` fail-closed 순수 함수 분리 + synthetic 테스트) 의 구현. 대상 파일:

- `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (신규)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts`
- `plan/in-progress/typescript-toolchain-followups.md`

이 변경은 제품 기능이 아니라 내부 개발 도구(repo-guard 테스트 하네스)의 구조 개선이다. `spec/`
전역에서 `repo-guards`·`repoRoot`·`listAtPath`·`internal-package-registration`·
`typescript-toolchain` 키워드를 grep 했으나 매칭되는 spec 문서가 없고, plan frontmatter 도
`spec_impact: none` 을 명시하고 있어 이 선언과 실제(spec 부재)가 일치한다.

## 실측 검증

- `npx vitest run internal-package-registration.test.ts typescript-toolchain.test.ts` → 76/76 통과.
- `npx eslint .` (frontend 전체) → 13 warning / 0 error, 전부 이 diff 밖의 기존 파일(9곳) 또는 이
  diff 가 손대지 않은 기존 줄(`typescript-toolchain.test.ts:116` `_drop` 미사용, diff 밖 원래
  줄)이었다 — plan 의 "기존 warning 13, 신규 0" 주장과 일치.
- `npx tsc --noEmit` (frontend) → 에러 0.
- `_shared.ts`·`internal-package-registration-guard.ts`·`typescript-toolchain-guard.ts` 세 파일
  사이 순환 import 없음, `ROOT` 는 `_shared.ts` 에서 단 한 번만 계산되고 나머지는 그 참조를 공유
  (재계산 없음).
- `MAX_DEPTH=12`·"7단계·1.7배" 주석 claim 을 직접 노드 스크립트로 재현 — 실제로 `__tests__` 부터
  워크스페이스 루트(`pnpm-workspace.yaml`)까지 정확히 7회 반복(`i=0..6`)만에 도달함을 확인. 주석과
  실측이 일치.
- 어떤 production 코드(`src/**`, `__tests__` 제외)도 `repo-guards/__tests__` 를 import 하지
  않음 — 이 모듈들이 tsc/next build 경로에서 완전히 격리된다는 헤더 주석 claim과 일치.

## 발견사항

- **[WARNING]** `validateWorkspacePatterns` 의 에러 메시지가 여전히 옛 호출부 이름
  `discoverWorkspaceDirs:` 를 접두어로 쓴다 — §2 리팩터로 검증 로직이 별도 함수로 분리됐는데
  메시지는 분리 전 이름을 그대로 남겼다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:121-127`
    (`export function validateWorkspacePatterns` 본문, 특히 124행
    ``"discoverWorkspaceDirs: pnpm-workspace.yaml 의 packages: 목록을 읽지 못했다 — " + ...``)
  - 상세: 테스트는 부분 문자열(`/packages: 목록을 읽지 못했다/`)만 매치하므로 통과에는 영향이
    없지만, `validateWorkspacePatterns` 를 (지금은 안 그렇지만 향후) 직접 호출하는 경로가 생기면
    에러 메시지가 실제 throw 지점이 아닌 다른 함수 이름을 가리켜 디버깅 시 혼동을 준다. "의도와
    구현 간 괴리" 관점의 사소한 잔재.
  - 제안: 메시지 접두어를 `validateWorkspacePatterns:` 로 갱신하거나, 호출부에 종속되지 않도록
    접두어 자체를 제거.

- **[INFO]** `internal-package-registration-guard.ts` 의 재export 목록(`ROOT, blockRange,
  findKeyLine, listAtPath, repoRoot`) 중 `blockRange`·`findKeyLine` 은 리팩터 이전에는 **비공개**
  헬퍼(`export` 없는 `function`)였다 — 이번에 처음으로 공개 표면에 올라간다. 바로 위 주석
  "이 모듈이 이미 그 심볼들의 공개 창구였기 때문이다" 는 `ROOT`·`listAtPath`·`repoRoot`(원래
  export 됨)에는 정확하지만 `blockRange`·`findKeyLine` 두 개에는 정확하지 않다. 실제로 이
  저장소 안 어떤 파일도 `blockRange`/`findKeyLine` 을 `internal-package-registration-guard`
  경로로 import 하지 않아(둘 다 `_shared` 로 직접 옮겨졌고, 이 파일 내부용으로만 쓰인다) 기능상
  문제는 없는 죽은 공개 표면이다. 이 리팩터 자체의 동기("무관한 책임의 전체 export 표면 결합을
  끊는다")를 생각하면 굳이 넓힐 필요가 없었던 표면이다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:38-42`
  - 제안: 기능에 영향 없으므로 필수 수정은 아니나, 다음에 이 파일을 만질 때
    `blockRange`/`findKeyLine` 를 재export 목록에서 빼거나(외부 미사용 확인됨) 주석을 "일부는
    이미 공개, 일부는 새로 공개함"으로 정정하면 좋다.

- **[INFO]** spec fidelity — 이 변경 영역(`repo-guards/__tests__/**`)을 규정하는 spec 문서가
  `spec/` 에 없다(전수 grep 결과 0건). plan frontmatter `spec_impact: none` 과 일치하므로 spec
  drift 는 아니며, 단지 spec 적용 대상 밖(내부 개발 하네스)임을 확인.

- 그 외 §1(공유 프리미티브 이관)·§2(fail-closed 순수 함수 분리 + `readLines` 주입) 는 로직
  변경 없이 순수 이동이거나(§1: `repoRoot`/`blockRange`/`findKeyLine`/`listAtPath`/
  `PackageManifest` 바디가 diff 상 1자도 안 바뀌고 위치만 이동), 기존 동작을 그대로 보존하면서
  테스트 가능하게 뽑아낸 것(§2: `validateWorkspacePatterns`)으로 — 함수 시그니처·에러 조건
  (`null` vs `[]` 분기)·기본 파라미터(`readLines` 기본값이 실제 `WORKSPACE_YAML` 을 읽는 원래
  동작과 동일)가 모두 의도와 일치한다. `loadTypescriptFrom` 반환 타입 `unknown | null` →
  `unknown` 변경도 TS 상 동치 정리일 뿐 런타임 동작 변화가 없다(호출부는 여전히
  `!== null` 비교로 정상 동작, `tsc --noEmit` 통과로 확인). TODO/FIXME/HACK/XXX 주석 없음.
  vacuity 방지 단언(파싱 결과 길이 > 0)·fail-closed throw(패턴 없음/빈 배열 갈라서 커버)·
  호출부 테스트(`discoverWorkspaceDirs` 가 `validateWorkspacePatterns` 를 실제로 태우는지)까지
  plan 이 서술한 "헬퍼 테스트 ≠ 호출부 테스트" 교훈을 실제로 코드화했음을 직접 실행으로 확인.

## 요약

`typescript-toolchain-followups` plan §1·§2 구현은 순수 이동/추출 리팩터로 동작 변화가 없고,
`vitest`(76/76 통과)·`eslint`(신규 warning 0)·`tsc --noEmit`(에러 0)·순환 import 부재·
production 코드 격리·MAX_DEPTH 주석 정확성을 모두 직접 실행/검증해 확인했다. 발견된 문제는
에러 메시지의 옛 함수명 잔재 하나(WARNING, 기능 영향 없음)와 재export 표면이 주석 서술보다
약간 넓다는 점(INFO, 기능 영향 없음)뿐이며, 둘 다 차단 사유가 아니다. 이 변경 영역을 규정하는
spec 문서는 없고 plan 이 `spec_impact: none` 으로 정확히 선언했으므로 spec fidelity 이슈도
없다. §3(catalog 마이그레이션)은 plan 체크박스가 미착수(`[ ]`)로 정직하게 남아 있고 본문의
실측 근거(대상 범위·lockstep 축 붕괴·dependabot 미확인 사실)도 리뷰 대상 코드와 모순되지 않는다.

## 위험도

LOW
