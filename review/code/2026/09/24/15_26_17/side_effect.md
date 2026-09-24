# 부작용(Side Effect) 리뷰

## 검토 방법

이번 changeset(39개 파일)의 실질 코드/설정 변경은 5개뿐이다 — `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`(scripts), `codebase/backend/test/jest-e2e.json`,
신규 `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`, `PROJECT.md`(문서).
나머지(`plan/in-progress/*.md` 3개, `review/code/2026/09/24/14_24_10/**` 15개,
`review/consistency/2026/09/24/{12_57_36,13_55_20}/**` 16개)는 이전 라운드의 산출물을 이번
커밋에 정식 편입한 것으로, 실행 코드가 아니라 텍스트 산출물이다.

저장소 뮤테이션은 수행하지 않았다(파일 열람·`grep`·`git log`·`git show`만 사용). 종료 시
`git status --short` 에는 이 세션이 새로 만든 `review/code/2026/09/24/15_26_17/` 하나만 있다.

이 changeset 은 같은 코드에 대한 **두 번째** `/ai-review` 라운드다 — 1라운드
(`review/code/2026/09/24/14_24_10`)의 side_effect 리뷰가 이미 `test:debug` `SyntaxError`
WARNING 을 냈고, `RESOLUTION.md` 가 커밋 `815d2e180` 에서 그것을 고쳤다고 주장한다. 이번
리뷰는 그 주장을 **실측으로 재확인**하는 것과, 1라운드가 다루지 않은 새 각도를 찾는 것에
집중했다.

## 발견사항

- **[INFO]** 1라운드 WARNING("`test:debug` 가 pnpm shell shim 을 `node` 에 직접 넘겨
  `SyntaxError`")이 실제로 해소됐음을 diff 로 재확인
  - 위치: `codebase/backend/package.json` — `test:debug` 스크립트 (파일 3, 게이트 25)
  - 상세: 현재 diff(`origin/main` 대비)에서 `test:debug` 는
    `"node --experimental-vm-modules --inspect-brk -r tsconfig-paths/register -r ts-node/register ./node_modules/jest/bin/jest.js --runInBand"`
    로, 나머지 4개 스크립트와 동일하게 `./node_modules/jest/bin/jest.js` 진입점을 직접
    가리킨다. `git show --stat 815d2e180` 로 해당 커밋이 정확히 이 줄만 고쳤음을 확인했고,
    `git log --oneline -- review/consistency/2026/09/24/12_57_36`(RESOLUTION 이 주장한
    "그 산출물을 커밋에 포함") 도 동일 커밋에 포함됨을 확인했다. 새로 도입된 회귀는 없다.
  - 제안: 없음(확인 완료).

- **[INFO]** `--experimental-vm-modules` 플래그가 `package.json` 의 5개 스크립트 문자열에만
  존재하고 `jest.config.ts` 에는 없다 — package.json 스크립트를 우회하는 호출 경로는
  이 불변식 밖에 남는다
  - 위치: `codebase/backend/package.json:22-26`(스크립트 5개) vs
    `codebase/backend/jest.config.ts:41`(`transformIgnorePatterns`)
  - 상세: 이 변경의 핵심 불변식("플래그 + 기본 `transformIgnorePatterns` 는 한 쌍")을 성립시키는
    두 반쪽 중 `transformIgnorePatterns` 는 jest 가 어떻게 호출되든 항상 적용되는 설정 파일에
    있지만, `--experimental-vm-modules` 는 Node 프로세스 기동 시점의 CLI 플래그라 jest 설정
    파일에 넣을 수 없고 **오직 이 5개 npm script 문자열을 통해서만** 전달된다. CI(`backend-checks.yml`
    → `pnpm --filter backend test`)와 e2e(`docker-compose.e2e.yml:209` → `pnpm run test:e2e`)는
    둘 다 이 스크립트를 경유하므로 안전함을 실측 확인했다(`grep` 로 저장소 전역에서 jest 바이너리를
    스크립트 밖에서 직접 호출하는 지점 0건). 다만 이 스크립트들을 우회하는 임의 호출 —
    예: `npx jest <file>`, `pnpm exec jest`, 또는 IDE(VSCode Jest 확장 등)의 "Run Test" 클릭이
    구성하는 자체 jest 커맨드라인 — 은 플래그 없이 실행되고, 그 경로에서는 `uuid`/`otplib`/`p-limit`
    등 ESM-only 패키지를 쓰는 스펙이 `Must use import to load ES Module` 로 실패한다(1라운드
    testing.md 의 "플래그만 제거" 재현과 동일 실패 모드). 이 저장소에 `.vscode/` 등 커밋된 IDE
    설정이 없어(실측: `find . -iname ".vscode"` 0건) 지금 당장 숨은 우회 경로는 없지만, 향후
    개발자가 로컬 IDE 로 개별 스펙을 돌리면 이 실패를 만날 수 있다. CI/Docker 경로는 안전하므로
    등급을 INFO 로 둔다 — 이미 신설된 `esm-native-load.spec.ts` 캐너리가 "왜 실패하는지"를
    스택 대신 이름 있는 스펙으로 알려주므로 오진단 비용도 낮다.
  - 제안: 필수 아님. `README`/`CONTRIBUTING` 류에 "개별 스펙을 IDE 러너로 직접 돌릴 때는
    `pnpm test -- -t <pattern>` 을 쓸 것(직접 `jest` 바이너리 호출 금지)"을 한 줄 남기면
    다음 사람이 이 실패를 "회귀"로 오인해 파고드는 시간을 아낄 수 있다.

- **[INFO]** 신규 가드 스펙(`esm-native-load.spec.ts`)의 유일한 파일시스템 접근은 읽기 전용이고
  스코프가 정확하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:46-55`
  - 상세: `fs.readFileSync(e2eConfigPath, 'utf8')` 한 곳뿐이며 쓰기·삭제는 없다. 경로는
    `path.resolve(__dirname, '../../../test/jest-e2e.json')` 로 계산되는데, 실제 디렉터리
    구조(`src/repo-guards/__tests__/` → 3단계 상위 → `codebase/backend/test/jest-e2e.json`)와
    대조해 정확히 그 파일을 가리킴을 확인했다. 프로세스 전역 상태·환경 변수·네트워크 호출도
    없다.
  - 제안: 없음.

- **[INFO]** `transformIgnorePatterns` 를 기본값으로 되돌리는 변경은 `codebase/backend`
  범위에만 격리돼 있다 — 다른 워크스페이스로 새는 부작용 없음
  - 위치: `codebase/backend/jest.config.ts:41`, `codebase/backend/test/jest-e2e.json`
  - 상세: `grep -rn "jest" --include="*.yml" --include="Makefile" --include="*.sh"` 로 저장소
    전역을 확인한 결과 `.claude/test-stages.sh`·`.claude/tools/run-test.sh`·
    `backend-checks.yml`·`web-chat-checks.yml`·`packages-checks.yml` 만 jest 를 언급하고,
    각각 자기 워크스페이스의 독립 jest 설정/스크립트를 쓴다(`pnpm --filter backend test` 처럼
    필터링됨) — 이번 diff 가 `frontend`·`packages/*`·`channel-web-chat` 의 jest/vitest 실행에
    영향을 주는 공유 진입점은 없다.
  - 제안: 없음.

- **[INFO]** 신규 파일시스템 산출물(plan 문서·review 아티팩트)은 프로젝트 규약이 요구하는
  정규 산출물이며 예상 밖의 쓰기가 아니다
  - 위치: `plan/in-progress/jest-esm-native-load.md`(신규), `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(신규),
    `review/code/2026/09/24/14_24_10/**`(15개), `review/consistency/2026/09/24/{12_57_36,13_55_20}/**`(16개)
  - 상세: `CLAUDE.md` "정보 저장 위치" 표가 명시한 위치(`plan/in-progress/`, `review/code/**`,
    `review/consistency/**`)에 정확히 대응하는 신규 파일이며, 애플리케이션 코드·설정을 건드리지
    않는다. RESOLUTION.md 가 스스로 밝힌 "커밋되지 않은 산출물을 인용하다 발각돼 거둔 사례"(§주의)
    도 이번 diff 시점에는 해소된 상태로 확인했다(`review/consistency/2026/09/24/12_57_36` 이
    `815d2e180` 에 포함됨).
  - 제안: 없음.

## 점검했으나 해당 없음

- **함수/메서드 시그니처 변경**: 이번 diff 에 애플리케이션 함수·클래스·public API 시그니처
  변경 없음(신설 스펙 파일은 `describe`/`it` 블록뿐).
- **전역 변수 도입/수정**: 없음.
- **환경 변수**: `NODE_OPTIONS` 등 환경 변수를 읽거나 쓰는 코드 없음 — CLI 플래그는 npm script
  문자열에 직접 박혀 있어 환경 변수 경로를 타지 않는다(저장소 전역 `NODE_OPTIONS` grep 0건).
- **네트워크 호출**: 없음(테스트 하네스/설정 변경뿐).
- **이벤트/콜백**: 없음.

## 요약

핵심 변경(jest 를 `--experimental-vm-modules` 로 네이티브 ESM 로더로 전환 + `transformIgnorePatterns`
기본값 복귀)은 `codebase/backend` 테스트 하네스에 격리돼 있고, CI·e2e·다른 워크스페이스로 새는
부작용은 실측(grep 전수 대조)으로 확인되지 않았다. 1라운드 리뷰가 지적한 유일한 실측 결함
(`test:debug` 스크립트의 `SyntaxError`)은 커밋 `815d2e180` 에서 정확히 그 지점만 고쳐 해소됐음을
diff 로 재확인했다. 새로 발견한 것은 하나뿐이다 — 이 변경의 핵심 불변식("플래그+기본 허용목록은
한 쌍")의 "플래그" 절반이 Node CLI 인자라 jest 설정 파일이 아니라 5개 npm script 문자열에만
존재하므로, 그 스크립트들을 우회하는 임의 호출(IDE 러너·`npx jest` 직접 실행)은 이 불변식 밖에
남는다는 것이다. CI/Docker 경로는 전부 스크립트를 경유해 안전함을 확인했고, 신설된
`esm-native-load.spec.ts` 캐너리가 그런 우회로 인한 실패를 "알 수 없는 에러"가 아니라 이름 붙은
실패로 드러내므로 실질 위험은 낮다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
