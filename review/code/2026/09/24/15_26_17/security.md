# 보안(Security) 리뷰 — jest ESM 네이티브 로드 전환 + 1라운드 RESOLUTION (deps-nestjs12-ci-4a7b2e)

## 검토 범위 요약

이번 라운드는 이전 라운드(`review/code/2026/09/24/14_24_10`)의 리뷰 결과에 대한 조치(RESOLUTION)와, 그
1라운드 산출물 자체를 저장소에 커밋하는 변경이다. 실제 실행 가능한 코드/설정 변경은 여전히 4개뿐이다:

- `codebase/backend/jest.config.ts` — `transformIgnorePatterns` 를 jest 기본값(`['/node_modules/']`)으로
  유지, 상단 docstring 을 현재 파일 목적에 맞게 갱신(1라운드 WARNING 2 조치)
- `codebase/backend/test/jest-e2e.json` — 동일하게 기본값 유지
- `codebase/backend/package.json` — `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` 5개 스크립트
  모두 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 통일(1라운드 Warning 1: `test:debug`
  가 `node_modules/.bin/jest` 셸 래퍼를 호출해 `SyntaxError` 나던 것을 수정)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규) — "플래그 + 기본
  allowlist는 한 쌍" 불변식을 지키는 repo-guard 스펙

나머지(`PROJECT.md`, `plan/in-progress/*.md` 3건, `review/code/2026/09/24/14_24_10/**` 전체,
`review/code/2026/09/24/15_26_17/_prompts/**`)는 문서·plan·이전 라운드 리뷰 산출물(markdown/json)이며
실행되는 코드가 아니다. production 런타임 코드, API 엔드포인트, 인증/DB 접근 코드는 이번 diff 어디에도
포함되지 않는다.

## 발견사항

- **[INFO]** 신규 repo-guard 스펙(`esm-native-load.spec.ts`)의 파일 읽기는 고정 상대경로만 사용 — 경로 탐색 위험 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (`path.resolve(__dirname, '../../../test/jest-e2e.json')`, `fs.readFileSync(e2eConfigPath, 'utf8')`)
  - 상세: 두 인자 모두 소스에 하드코딩된 문자열이고 사용자 입력이나 환경변수가 경로 조합에 개입하지 않는다. `JSON.parse` 대상도 저장소에 커밋된 고정 설정 파일이라 신뢰 경계를 넘는 입력이 없다. `createRequire(__filename)` 로 `uuid/package.json` 을 읽는 것도 동일하게 정적 문자열이다.
  - 제안: 없음(정보 제공).

- **[INFO]** `--experimental-vm-modules` 플래그는 여전히 테스트 스크립트에만 한정 — production 실행 경로 재확인
  - 위치: `codebase/backend/package.json` `scripts.test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`
  - 상세: 1라운드에서 이미 확인한 사실(INFO)이 이번 조치로도 그대로 유지된다. `test:debug` 수정을 포함해 5개 스크립트 전부가 이 플래그를 갖게 됐지만, `start`/`start:prod` 등 배포 실행 경로에는 추가되지 않았고 `nest build` 산출물도 diff 대상이 아니다. 배포되는 서버 프로세스의 공격 표면은 변하지 않는다.
  - 제안: 없음.

- **[INFO]** `transformIgnorePatterns` 기본값 복귀는 보안 결함 수정이 아니며 새 위험도 만들지 않음
  - 위치: `codebase/backend/jest.config.ts`(docstring 갱신 포함), `codebase/backend/test/jest-e2e.json`
  - 상세: 걷어낸 이전 정규식(`node_modules/(?!(?:\.pnpm/…)?(?:uuid|p-limit|…)/)`)은 중첩 정량자가 없어 ReDoS 소지가 없었고, 새 값 `['/node_modules/']` 는 jest 표준 기본값과 동일하다. 갱신된 docstring(`jest.config.ts:3-11`)은 1라운드 WARNING 2 를 정확히 반영해 현재 파일의 실제 존재 이유(기본값이 의도적임과 그 근거)를 서술하도록 고쳐졌고, 이전처럼 "제거된 정규식에 주석 달기 위해 존재한다"는 오래된 서술이 남아 있지 않음을 확인했다. 테스트 전용 설정이라 production 빌드/런타임 경로에 영향 없음.
  - 제안: 없음.

- **[INFO]** 향후 NestJS 12 동반 업그레이드의 인가 회귀 위험은 plan 문서로 계속 격리·추적됨
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C ("착수 시 반드시 검증할 것 — reflection 보안 회귀")
  - 상세: 1라운드에서 확인한 것과 동일하게, `RolesGuard`/`@WorkspaceId()` 가 Nest 비공개 API(`ROUTE_ARGS_METADATA`)에 의존하고 그 파손 방향이 fail-open(멤버십 검증이 조용히 사라짐)이라는 사실이 §C에 명시돼 있다. 이번 diff 자체는 `@nestjs/*` 버전을 올리지 않는다(`package.json` 의 `dependencies`/`devDependencies` 변경 없음 — 스크립트 섹션만 변경). 이 위험은 여전히 후속(별도) PR의 스코프이고, 이번 코드 변경 범위 안에서는 실현되지 않는다.
  - 제안: 없음(추적용 정보). 후속 PR 리뷰 시 §C 체크리스트(부트 캐너리 소비 라우트 수 비교, `workspace.decorator`/`roles.guard` 단위 스위트 검증)가 실제로 수행됐는지 재확인할 것.

- **[INFO]** 1라운드 리뷰 산출물 커밋(`review/code/2026/09/24/14_24_10/**`)에 시크릿·자격증명 없음
  - 위치: `review/code/2026/09/24/14_24_10/RESOLUTION.md`, `SUMMARY.md`, 각 reviewer `*.md`, `meta.json`, `_retry_state.json`
  - 상세: 이 라운드에서 새로 diff 에 포함된 커밋 대상은 이전 라운드의 markdown 리포트와 상태 JSON뿐이다. 내용은 PR 번호, 파일 경로, 실측 로그 경로, 테스트 명령어 등이며 API 키·비밀번호·토큰·인증서·개인식별정보 형태의 문자열은 없다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 백로그 항목(frontend-checks pathspec 갭)도 CI 워크플로 설정에 대한 서술일 뿐 자격증명을 노출하지 않는다.
  - 제안: 없음.

## 점검했으나 해당 없음

- **인젝션 취약점**: 변경분에 사용자 입력을 처리하는 런타임 코드가 없음. `package.json` 스크립트는 전부 고정 문자열이고 외부 입력을 셸에 보간하지 않는다. 신규 스펙 파일의 파일 읽기도 정적 상대경로만 사용(위 INFO 참고) — 경로 탐색 벡터 없음.
- **하드코딩된 시크릿**: 전체 diff(코드 4개·문서/plan/review 산출물 포함)에 API 키·비밀번호·토큰 문자열 없음.
- **인증/인가**: 이번 diff 는 인증/인가 코드를 전혀 건드리지 않는다. 관련 우려(§C 의 fail-open 위험)는 후속 별도 plan 으로 명시적으로 격리돼 이번 스코프 밖이다.
- **입력 검증**: 해당 없음(테스트 설정·plan 문서 변경).
- **OWASP Top 10**: 해당 사항 없음 — 애플리케이션 로직·엔드포인트 변경이 없다.
- **암호화**: 해당 없음.
- **에러 처리**: 해당 없음 — 런타임 에러 메시지 경로 변경 없음. 신규 스펙 파일의 단언 실패 메시지도 테스트 실행 로그에만 노출되며 배포 환경과 무관하다.
- **의존성 보안**: `package.json` 의 `dependencies`/`devDependencies` 버전은 이번 diff 로 바뀌지 않았다(스크립트 섹션만 변경, 1라운드 dependency reviewer 확인과 일치). 새 의존성 추가 없음.

## 뮤테이션 규약 관련

이번 세션에서는 저장소 파일에 대한 뮤테이션(수정/원복)을 수행하지 않았다 — 정적 리뷰 및 기존 파일
`Read`/`grep` 확인만 수행했다. `git status --short` 대조 불필요.

## 요약

이번 라운드는 1라운드 리뷰에서 나온 지적(Critical 1: plan worktree placeholder, Warning 1: `test:debug`
깨짐, Warning 2: 오래된 docstring, Warning 3: 커밋되지 않은 consistency 산출물 참조)에 대한 조치와 신규
repo-guard 불변식 테스트 추가, 그리고 1라운드 산출물 커밋으로 구성된다. 보안 관점에서 실행 가능한 코드
변경은 여전히 jest 테스트 러너의 ESM 네이티브 로드 전환(`jest.config.ts`/`package.json`/`jest-e2e.json`)과
그 불변식을 지키는 신규 단위 스펙뿐이며, 신규 스펙의 파일 읽기는 고정 상대경로만 사용해 경로 탐색 위험이
없다. `--experimental-vm-modules` 플래그는 여전히 테스트 스크립트에만 한정돼 배포 런타임의 공격 표면을
넓히지 않는다. 새 외부 의존성·시크릿·인증 코드 변경이 없고, 향후 NestJS 12 업그레이드가 안고 있는
reflection 기반 인가 fail-open 위험은 별도 plan(§C)으로 계속 명문화·격리돼 있다. Critical/Warning 급
보안 결함은 발견되지 않았다.

## 위험도

NONE
