# 문서화(Documentation) 리뷰 결과

### 발견사항

- **[INFO]** `missingCompilerApi` JSDoc의 "이 경로" 지시어가 실제 분기와 어긋나게 읽힌다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:42-43` (`missingCompilerApi` 함수 JSDoc, `export function missingCompilerApi` 직전)
  - 상세: 42번 줄이 "비-객체(스텁이 아예 함수·null·undefined 인 경우)는 전부 누락으로 친다 — fail-closed" 라며 non-object 분기(`mod === null || typeof mod !== "object"`)를 설명한 직후, 43번 줄이 "TS7 의 `require('typescript')` 는 `{version, versionMajorMinor}` **객체**라 이 경로로 3건을 낸다" 라고 이어진다. "이 경로" 가 문장 순서상 바로 앞의 non-object 분기를 가리키는 것처럼 읽히지만, `{version, versionMajorMinor}` 는 `typeof === "object"` 이므로 실제로는 **두 번째 분기**(`REQUIRED_COMPILER_API.filter((key) => typeof m[key] !== "function")` — 객체이되 필요한 함수 키가 없어 걸러지는 경로)를 탄다. `typescript-toolchain.test.ts`의 "TS7 의 실제 형태를 잡는다" 테스트(`missingCompilerApi({ version: "7.0.2", versionMajorMinor: "7.0" })`)가 실제로 검증하는 것도 이 filter 경로다. 두 분기가 우연히 같은 3개 항목을 반환해 코드·테스트 자체는 정확하지만, 문서 서술만 두 분기를 혼동시킨다 — 향후 다른 실패 형태(예: null/함수를 반환하는 신버전)를 다루는 사람이 "어느 분기가 어떤 입력을 처리하는지" 오판할 여지가 있다.
  - 제안: "이 경로" 를 "아래 filter 경로"처럼 명시하거나, "TS7 은 객체이므로 non-object 분기가 아니라 filter 분기를 타지만 결과는 동일하게 3건이다" 식으로 두 분기를 명확히 갈라 쓴다.

- **[INFO]** major-version dependabot ignore 정책이 PROJECT.md 의존성 거버넌스 섹션에 반영되지 않음
  - 위치: `PROJECT.md:47-48` (§버전 핀 정책 / §의존성 취약점 audit·핀 거버넌스) — 신규 정책 자체는 `.github/dependabot.yml:47-73`
  - 상세: 이번 변경은 "TS major 는 전 빌드 툴체인의 계약이라 자동 bump 대상에서 제외한다"는 **세 번째 의존성 거버넌스 축**(major-version 자동승격 차단, `ignore:` + `update-types: ["version-update:semver-major"]`)을 도입했다. `dependabot.yml` 자체 주석과 `plan/in-progress/typescript-7-rollback.md` 는 이 결정을 매우 상세히 기록했지만(사고 경위·재발 조건·되살릴 조건 전부 포함), `PROJECT.md` 는 기존 두 축(caret/exact 핀 정책, audit 수용 거버넌스)만 캐논으로 문서화하고 있어 이 세 번째 축은 `dependabot.yml` 내부 주석에서만 발견 가능하다. `codebase/*/package.json` 의 `"//pin"` 필드들이 전부 `PROJECT.md §버전 핀 정책`을 가리키도록 관례화된 것과 대비된다 — 향후 다른 "툴체인-critical" 의존성(예: node, eslint, nestjs core)에 같은 판단이 재발할 때 이 선례를 찾으려면 `dependabot.yml` 전체를 읽어야 한다.
  - 제안: `PROJECT.md` §의존성 취약점 audit·핀 거버넌스 불릿 근처에 "major-version 자동 bump 차단(`dependabot.yml` `ignore`)" 한 줄과 이번 typescript 사례를 근거 포인터로 추가하면 향후 유사 판단의 발견성이 높아진다. 필수는 아니며, 현재도 `dependabot.yml` 주석만으로 이번 결정 자체는 완전히 추적 가능하다.

### 검증 후 문제 없음으로 판단한 항목 (참고)

- `typescript-toolchain-guard.ts` 의 모든 공개 함수/상수(`REQUIRED_COMPILER_API`·`missingCompilerApi`·`parseMajor`·`typescriptRangeOf`·`expandWorkspaceGlobs`·`discoverWorkspaceDirs`·`typescriptDecls`·`readManifestAt`·`majorSpread`·`loadTypescriptFrom`)에 근거·형태·예외까지 담은 JSDoc이 있고, 코드·테스트와 대조해도 정확하다(`parseMajor` 의 "받는 형태"/"null 이 되는 형태" 정규식 케이스, `expandWorkspaceGlobs` 의 글롭 처리 분기 등 모두 실제 동작과 일치).
- `dependabot.yml` 의 `ignore` 주석이 인용하는 에러 메시지(`tsBinary.getParsedCommandLineOfConfigFile is not a function`)·워크스페이스 소비자 목록·`plan/in-progress/deps-guard-hardening.md §3` 교차참조는 모두 대상 파일을 직접 열어 대조한 결과 정확하다.
- `plan/in-progress/typescript-7-rollback.md` 의 실측 수치(매니페스트 10건, 가드 테스트 20건, `pnpm-workspace.yaml` 의 고정 3개 + `packages/*` 구조)는 실제 리포지토리 상태(package.json 10개 파일, `it(` 20개, `pnpm-workspace.yaml` 내용)와 일치한다.
- CHANGELOG.md·README·API 문서: 이 변경(빌드 인프라 복구, 사용자 비가시)의 성격상 본 저장소의 기존 CHANGELOG.md 관례(spec 연계 product 동작 변경만 등재, 모든 기존 항목이 `spec/`+`plan/` 포인터를 동반)에 비추어 갱신이 불필요하다고 판단. 신규 환경변수 없음, API 엔드포인트 변경 없음.

### 요약

`typescript 7.0.2 → 5.x` 롤백 PR은 문서화 관점에서 매우 높은 수준을 보인다 — 신규 가드 모듈(`typescript-toolchain-guard.ts`)의 모든 공개 함수·상수에 근거·형태·예외 케이스까지 담은 JSDoc이 있고, `dependabot.yml`의 `ignore` 규칙에는 사고 경위·원인·되살릴 조건이 인라인 주석으로 상세히 남아 있으며, `plan/in-progress/typescript-7-rollback.md`가 실측 원인·미검증 위험·mutation 검증 결과까지 기록해 코드-문서-계획 3자가 서로 정확히 대응한다(버전 문자열·에러 메시지·워크스페이스 개수·테스트 개수 등 실측 수치를 원본 파일과 대조해 전부 확인). 발견된 두 건은 모두 INFO 수준으로, 하나는 한 docstring 문장의 지시어("이 경로")가 실제 코드 분기와 다르게 읽힐 수 있다는 서술 정밀도 문제이고, 다른 하나는 이번에 도입된 새 거버넌스 축(major-version dependabot ignore)이 PROJECT.md 캐논 문서에는 아직 반영되지 않아 향후 유사 사례의 발견성이 다소 떨어진다는 점이다. 둘 다 기능·안전성에 영향이 없고 즉시 조치가 필요하지 않다.

### 위험도
LOW
