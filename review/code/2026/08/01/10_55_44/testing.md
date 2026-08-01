# 테스트(Testing) 리뷰 — TypeScript 7.0.2 → 5.x 롤백 + 회귀 가드

## 검증 방법

정적 코드 리딩에 더해, 실제로 테스트를 구동해 plan 문서(`plan/in-progress/typescript-7-rollback.md`)의 주장을 독립적으로 재현했다.

- `pnpm --filter frontend vitest run src/lib/repo-guards/__tests__/typescript-toolchain.test.ts` → **20/20 PASS** (plan 의 "20건" 주장과 일치)
- `pnpm --filter frontend test` (전체) → **5801 passed | 1 skipped (5802)** — plan 의 "5781 → 5801" 과 정확히 일치(+20)
- `pnpm --filter backend test` → 412 suites / **8360 passed | 1 skipped**
- `pnpm --filter backend build` (`nest build`) → **exit 0**, `dist/main.js` 생성 확인 — Jenkins 실패 1(`tsBinary.getParsedCommandLineOfConfigFile is not a function`)의 정확한 재현 지점이 이제 통과함을 직접 확인
- `codebase/packages/sdk`: `dist/` 삭제 후 `pnpm run prepare`(`tsc`) → **exit 0**(Jenkins 실패 2 해소 확인), `pnpm test` → 33/33 PASS
- `pnpm --filter channel-web-chat test` → 409/409 PASS
- `pnpm --filter "@workflow/{sdk,ai-end-reason,expression-engine,graph-warning-rules,node-summary,chat-channel-validation,web-chat}" test` → 전부 PASS (33/5/123/16/27/14/48)
- node 스크립트로 10개 워크스페이스 전부에서 `createRequire(...).resolve("typescript")` 직접 호출 → 전부 `5.9.3` 해소 + `createProgram` 함수 존재 확인 — 가드의 "능력 검사" 축이 실제로 전 워크스페이스를 커버하는 실행 환경임을 실측 확인

전 계층에서 회귀 없음, plan 문서의 수치 주장은 모두 실측과 일치했다.

## 발견사항

- **[INFO]** `discoverWorkspaceDirs` 자체의 fail-closed throw 분기가 synthetic 유닛 테스트로 직접 커버되지 않음
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:102-117` (throw 문: `105`-`110`)
  - 상세: `listAtPath(lines, ["packages"])` 가 `null` 이거나 빈 배열일 때 throw 하는 분기(주석: "추출 실패를 빈 목록으로 흘려보내면 가드가 통째로 vacuous 해진다")는, 실제 `pnpm-workspace.yaml` 이 파싱 가능한 상태로 유지되는 한 어떤 테스트 실행에서도 자연 발동하지 않는다. `typescript-toolchain-guard.ts` 의 나머지 순수 함수(`expandWorkspaceGlobs`, `parseMajor`, `missingCompilerApi`, `typescriptDecls`, `majorSpread`)는 전부 주입 가능한 형태라 `typescript-toolchain.test.ts` 의 "합성" describe 블록에서 직접 fixture 로 고정되는데, 이 분기만 실제 I/O(`fs.readFileSync(WORKSPACE_YAML)`)와 뒤섞여 있어 그 경로가 없다. plan 체크리스트의 mutation 표에 있는 "`discoverWorkspaceDirs` → `[]` (발견 vacuity) | 4 failed" 항목은 이 함수의 **반환값 자체를 강제로 `[]` 로 바꾼** 것이라(코드 직접 편집), 하류 vacuity 단언이 잡아내는지를 검증했을 뿐 이 throw 문 자체를 겨냥하지 않는다. 실무 위험은 낮다 — `patterns === null` 인 상태에서 `patterns.length` 접근은 JS 상 이미 `TypeError` 이므로, 예컨대 `||` 를 `&&` 로 뒤집는 뮤턴트조차 침묵 통과가 아니라 다른 형태의 예외로 fail-loud 하게 드러난다. 같은 성격의 갭이 형제 가드 `internal-package-registration-guard.ts` 의 일부 I/O 결합 함수(`discoverPackages` 등)에도 기존에 존재해 이 PR 이 새로 도입한 패턴은 아니다.
  - 제안: 필수는 아님(낮은 우선순위). 원한다면 `patterns === null || patterns.length === 0` 검증을 `validateWorkspacePatterns(patterns: string[] | null): string[]` 같은 순수 함수로 한 겹 더 분리하면 synthetic null/`[]` 입력으로 직접 커버 가능해진다.

- **[INFO]** `parseMajor`/`missingCompilerApi` 의 일부 지엽적 입력 형태 미검증
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts:130-149` (`describe("parseMajor (합성)")`), `:100-128` (`describe("missingCompilerApi (합성)")`)
  - 상세: prerelease 태그(`^5.7.3-beta.1`)나 배열 입력(`missingCompilerApi([...])`, `typeof [] === "object"` 라 REQUIRED_COMPILER_API 전부 누락으로 처리되긴 하지만 명시 테스트는 없음) 같은 형태는 다루지 않는다. 다만 `typescript-toolchain-guard.ts:54` 의 JSDoc 이 "이 저장소가 실제로 쓰는 형태만" 처리한다고 명시적으로 스코프를 좁혔고, 실측(10개 매니페스트 전부 caret/tilde 단일 range)과 일치해 실질 위험은 없다.
  - 제안: 없음(참고용). 향후 워크스페이스가 복합 range 를 쓰게 되면 그때 fixture 를 추가하면 된다 — 지금 추가하는 것은 과잉설계다.

## 강점 (참고)

- **비-vacuous 성 자가검증**: plan 문서가 4종 mutation(로크스텝 위반·능력 위반·발견 vacuity·능력검사 vacuity)의 결과를 기록했고, 본 리뷰에서 코드를 직접 추적해 재계산한 예상 실패 개수(1/1/4/1)가 문서의 실측치와 정확히 일치했다 — 문서화된 mutation-testing 결과가 신뢰할 만하다.
- **실측(측정) vs 합성(fixture) 분리가 명확**: `typescript-toolchain.test.ts` 는 실제 저장소 상태를 보는 `describe("... (실측)")` 블록과, 주입된 fake(`readDir`, `readManifest` 클로저)로 파서/판정 로직만 고정하는 `describe("... (합성)")` 블록을 분리했다. 이 조합 덕분에 "실측 테스트가 우연히 통과"(현재 저장소가 마침 정상이라 vacuous)와 "로직 자체가 틀림"을 서로 다른 테스트가 따로 잡는다.
- **Mock 미사용이 오히려 적절**: vi.mock 등 모듈 모킹을 쓰지 않고 실제 `fs`/`require`/`createRequire` 를 그대로 태운다. 이 가드가 잡으려는 결함 클래스(모듈이 실제로 무엇을 export 하는가)는 정확히 mocking 이 감춰버리는 지점이라, 이 선택은 프로덕션 사고를 재현하는 데 필수적이다. 반대로 순수 로직(`parseMajor`·`expandWorkspaceGlobs` 등)은 모킹 프레임워크 대신 가벼운 클로저 주입으로 테스트해 무거운 mock 셋업 없이 결정론적이다.
- **테스트 용이성(DI) 우수**: `expandWorkspaceGlobs(patterns, readDir)`, `typescriptDecls(dirs, readManifest)` 는 fs 접근을 인자로 분리해 순수 함수로 구성했고, `discoverWorkspaceDirs`/`readManifestAt`/`loadTypescriptFrom` 같은 실 I/O 래퍼는 얇게 유지했다. 형제 가드(`internal-package-registration-guard.ts`)와 동일한 분리 규약을 재사용해 저장소 전체 일관성도 지켰다.
- **회귀 방지 설계**: 버전 숫자가 아니라 "능력"(JS compiler API 심볼 존재)을 검사해, 정당한 향후 major 상향을 막지 않으면서 이번 사고 클래스(API 표면 이전)만 정확히 막는다 — 과잉 제약(버전 상한 고정)도 과소 제약(버전 무관 통과)도 아니다.
- **테스트 격리**: 새 테스트 파일은 파일 시스템을 읽기 전용으로만 사용하고(쓰기 없음), 다른 테스트와 공유 상태가 없어 병렬 실행 시 충돌 위험이 없다. `.only`/`.skip` 잔존 없음.
- **회귀 테스트 유효성**: 이번 실측 검증(전 워크스페이스 jest/vitest 스위트 + `nest build`)에서 기존 테스트 어느 것도 typescript 5.9.3 롤백으로 깨지지 않았다 — 5.9.3 은 `#1047` 이전에 이미 검증됐던 버전으로의 순수 복귀이므로 예상된 결과다.

## 요약

TypeScript 7.0.2 → 5.x 롤백 자체는 순수 버전 복귀라 회귀 위험이 낮고, 이를 실측(frontend 전체 5801/5801, backend 8360/8360, channel-web-chat 409/409, 내부 패키지 7종 전부, `nest build` exit 0)으로 직접 재현해 확인했다. 핵심 산출물인 신규 회귀 가드(`typescript-toolchain-guard.ts` + `typescript-toolchain.test.ts`, 20 케이스)는 실측 테스트와 합성 fixture 테스트를 명확히 분리하고, 순수 로직은 의존성 주입으로 격리하고, mock 프레임워크 대신 실제 모듈 해소를 그대로 태워 이번 사고 클래스(compiler API 표면 이전)를 정확히 재현·검증한다. plan 문서가 주장한 mutation-testing 결과(4종 뮤턴트의 실패 개수)를 코드 추적으로 독립 재계산해 정확히 일치함을 확인했고, 이는 "GREEN 이 곧 증거는 아니다"라는 이 저장소의 반복된 교훈에 대해 이 PR 이 스스로 검증 절차를 거쳤다는 뜻이다. 남은 갭은 `discoverWorkspaceDirs` 의 fail-closed throw 분기가 synthetic 테스트로 직접 겨냥되지 않는다는 것과 파서의 극히 지엽적인 입력 형태(prerelease range, 배열 입력) 미검증뿐이며, 둘 다 실무 위험이 낮고 형제 가드에도 이미 존재하는 기존 패턴이라 이 PR 이 새로 도입한 결함이 아니다. 나머지 변경 파일(package.json ×9, pnpm-lock.yaml, dependabot.yml, plan 문서)은 설정/의존성/문서 변경으로 테스트 대상 코드가 아니다.

## 위험도

LOW
