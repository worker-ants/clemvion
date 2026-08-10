# 변경 범위(Scope) 리뷰

대상: `plan/in-progress/typescript-toolchain-followups.md` (§1·§2·§4) 구현분 — 총 7개 파일.

## 발견사항

- **[INFO]** `repoRoot` 에 `startDir`/`exists` 주입 파라미터가 새로 생겼다 — 원 plan §1 문구("이관")보다 넓다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:40-43` (`export function repoRoot(startDir: string = __dirname, exists: (p: string) => boolean = fs.existsSync,)`)
  - 상세: §1 조치 항목은 단순 "이관"(`internal-package-registration-guard.ts` → `_shared.ts`)만 적었는데, 실제 diff 는 함수 시그니처에 의존성 주입 파라미터 2개를 추가했다. 순수 코드 이동을 넘는 동작 확장이다.
  - 판단: 같은 파일 헤더 주석(43-46번째 줄 근방)과 plan 갱신 절("2026-08-10 실측"이 아니라 §1 체크리스트 항목)에 "그쪽만 주입 가능하게 만들었을 때 리뷰가 이 비대칭을 지적했고, 지적이 옳았다"고 명시적으로 근거를 남겼다. 같은 파일의 형제 함수 `discoverWorkspaceDirs(readLines)` 와 대칭을 맞추는 목적이 문서화돼 있고, fail-closed throw 가 `__dirname` 하드코딩 때문에 이전엔 테스트 불가능했다는 구체적 결함을 고친 것이라 무단 기능 확장이 아니라 리뷰 피드백에 대한 근거 있는 대응으로 보인다. scope 위반이라기보다 "이관" 표현이 실제 작업 내용보다 좁게 적혔던 것에 가깝다.
  - 제안: 문제는 없으나, plan 본문 §1 조치 서술("이관")을 "이관 + DI 대칭화"로 갱신해두면 다음에 diff-vs-plan 대조가 더 매끈하다.

- **[INFO]** `discoverWorkspaceDirs` 에 `readLines` 주입 파라미터 추가 — §2 plan 문구("`validateWorkspacePatterns` 순수 함수로 분리 + 테스트 추가")보다 넓다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:141-145`
  - 상세: 원래 §2 는 검증 로직만 순수 함수로 뽑으라고 적혀 있었는데, 실제 diff 는 호출부인 `discoverWorkspaceDirs` 자체에도 `readLines` 주입점을 추가해 시그니처를 바꿨다.
  - 판단: 같은 파일 JSDoc(133-140번째 줄)과 plan §2 체크리스트에 "헬퍼만 뽑아 두니 `discoverWorkspaceDirs` 가 검증을 건너뛰는 뮤턴트(`?? []`)가 살아남았다"는 구체적 실측 근거가 있다. §2 의 목적("fail-closed 를 synthetic 으로 겨냥 가능하게")을 실제로 달성하려면 호출부까지 주입 가능해야 하므로, 이는 §2 목적을 완성하기 위한 자연스러운 확장이지 무관한 기능 추가가 아니다. 같은 파일의 기존 관행(`expandWorkspaceGlobs(readDir)`)과도 대칭이다.
  - 제안: 문제 없음. plan §2 조치 서술에 "호출부 주입점 포함"을 명시하면 좋다(사소).

- **[INFO]** `internal-package-registration.test.ts` 에 plan 체크리스트에 명시되지 않은 회귀 테스트 1건 추가
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:338-351` ("인라인 주석을 항목에서 떼어낸다")
  - 상세: `listAtPath` 의 인라인 주석 제거 동작에 대한 합성 fixture 테스트가 새로 추가됐다. 이 축은 §1(공유 프리미티브 이관)·§2(fail-closed 커버) 어느 plan 항목에도 명시적으로 나열되지 않았다.
  - 판단: 주석에 "이 축만 합성 커버리지가 비어 있어서 제거를 지워도 스위트가 초록이었다(뮤테이션 실측)"이라고 근거가 있다. `listAtPath` 는 이번 PR 에서 `_shared.ts` 로 이관된 바로 그 함수이므로, 이관 작업 중 발견한 커버리지 갭을 닫는 것은 §1 작업의 부산물로 정당하다. 범위 이탈이 아니라 "이관하면서 실측한 회귀 갭을 고쳤다"는 이 저장소의 관례(뮤테이션 실측 우선 관행)에 부합한다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/typescript-toolchain-followups.md` 에 §3(catalog 마이그레이션) 실측 연구 절 추가 — 코드 변경은 없고 미착수 유지
  - 위치: `plan/in-progress/typescript-toolchain-followups.md:55-87` ("2026-08-10 실측 — 셋 중 둘은 답이 났고, 하나가 착수를 막는다")
  - 상세: §3 는 이번 구현 스코프(§1·§2·§4)에 포함되지 않았는데, 착수 판단을 위한 실측 결과가 문서에 추가됐다. 체크박스는 여전히 `[ ]` 로 미착수 유지되고 있어 실제 코드에는 영향이 없다.
  - 판단: `developer` 역할은 `plan/**` 쓰기 권한이 있고, 이 절은 "착수 안 함"을 명시적으로 결론짓는 조사 기록이라 코드 스코프 이탈이 아니다. 오히려 향후 세션의 판단 비용을 줄이는 적절한 기록이다.
  - 제안: 없음.

## 요약

7개 파일(신규 `_shared.ts`/`shared.test.ts`, 리팩터된 `internal-package-registration-guard.ts`/`typescript-toolchain-guard.ts`와 대응 테스트, plan 문서) 모두 `plan/in-progress/typescript-toolchain-followups.md` 의 §1(공유 프리미티브 분리)·§2(fail-closed synthetic 커버)·§4(타입/JSDoc 정리)에 직접 대응한다. §3(catalog 마이그레이션)은 plan 대로 미착수 상태이며 추가된 것은 착수 여부 판단을 위한 조사 기록뿐이라 코드 변경이 없다. 무관한 파일·설정·포맷팅-only 변경은 발견되지 않았고, import 정리도 실제 사용처(예: `blockScalarAtPath` 가 쓰는 `findKeyLine`/`blockRange`)와 일치한다. 두 함수(`repoRoot`, `discoverWorkspaceDirs`)에 plan 문구보다 넓은 의존성 주입 파라미터가 추가됐지만, 둘 다 같은 파일 주석과 plan 체크리스트에 "리뷰 피드백 대응" 또는 "뮤테이션 실측으로 드러난 호출부 갭"이라는 구체적 근거가 남아 있어 근거 없는 기능 확장(over-engineering)이 아니라 §1/§2 의 본래 목적(테스트 가능성 확보)을 완성하기 위한 자연스러운 연장으로 판단된다. 추가된 회귀 테스트 1건도 이관 대상 함수의 실측 커버리지 갭을 닫는 것으로 범위 안에 있다.

## 위험도

LOW
