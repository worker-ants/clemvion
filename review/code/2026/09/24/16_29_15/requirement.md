# 요구사항(Requirement) 리뷰 — `review/code/2026/09/24/16_29_15`

## 스코프 정리

`git diff --stat origin/main...HEAD` 기준 실제 기능 변경은 7개 파일뿐이다:

- `PROJECT.md` (정책 문구 1건 갱신)
- `codebase/backend/jest.config.ts`
- `codebase/backend/package.json` (npm scripts 5곳)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규)
- `codebase/backend/test/jest-e2e.json`
- `plan/in-progress/jest-esm-native-load.md` (신규)
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (신규 스텁)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (백로그 2항목 추가)

나머지 ~68개 파일은 `review/code/2026/09/24/{14_24_10,15_26_17,16_02_28}/*` ·
`review/consistency/2026/09/24/{12_57_36,13_55_20}/*` — 이전 3라운드 리뷰/일관성 검토
산출물이며, 각 라운드의 `RESOLUTION.md` 가 전부 "**보류 0건**"으로 종결했음을 확인했다.
이 라운드는 그 위에서 도는 최종 확인 라운드다.

## 변경 의도

`@nestjs/typeorm@12`(`import.meta.url` 사용, CJS downlevel 불가)를 jest(unit/e2e)가 로드하지
못해 막힌 dependabot PR(#1339)을 풀기 위해, 손으로 유지하던 `transformIgnorePatterns`
허용목록 방식을 버리고 jest 를 `node --experimental-vm-modules` 로 띄워 ESM 을 네이티브로
로드하게 전환.

## 검증 내용

1. **핵심 파일 3종 정합** — `jest.config.ts`(`transformIgnorePatterns: ['/node_modules/']`),
   `test/jest-e2e.json`(동일 값), `package.json` 5개 script(`test`/`test:watch`/`test:cov`/
   `test:debug`/`test:e2e`) 전부 `--experimental-vm-modules` + `./node_modules/jest/bin/jest.js`
   조합으로 일치. `esm-native-load.spec.ts` 가 이 세 파일을 구조적으로 교차검증한다(파일을
   직접 읽어 대조 완료).
2. **`test:debug` 순서 버그 실물 수정 확인** — 변경 전
   `node --inspect-brk … node_modules/.bin/jest --runInBand` (쉘 shim 스크립트를 `node` 에
   직접 넘겨 syntax error, 2026-03-30 이래 방치— 스펙 헤더 자기 신고). 변경 후
   `node --experimental-vm-modules --inspect-brk … ./node_modules/jest/bin/jest.js --runInBand`
   로 진입점이 `.js` 파일로 바뀌고 플래그가 진입점 앞에 온다 — `esm-native-load.spec.ts` 의
   `flagBeforeEntry`/`hasFlag`/`hasEntry` 3중 단언 통과 확인.
3. **CI/e2e 실제 진입점이 고쳐진 script 를 실제로 타는지** — `.github/workflows/backend-checks.yml`
   unit 잡은 `pnpm --filter backend test` (→ 고쳐진 `test` script), `docker-compose.e2e.yml` 209행은
   `pnpm run test:e2e` (→ 고쳐진 `test:e2e` script). 두 실제 진입점 모두 우회 경로 없이
   고쳐진 문자열을 탄다 — 가드 헤더가 스스로 적은 "CI·e2e 진입점은 script 를 경유하므로
   안전" 이라는 경계 주장이 실측과 일치한다.
4. **가드 스펙의 뮤테이션 내구성** — plan 문서(`jest-esm-native-load.md` §D)에 M1~M4 4종
   뮤테이션 예측=실측 표가 있고, `review/code/2026/09/24/16_02_28` 라운드에서 리뷰어가
   지적한 "존재 검사만 하고 순서는 안 본다"(M8/M9) 결함도 커밋 `a49b62108`로 조치된 상태를
   현재 코드에서 직접 확인(`hasFlag`/`flagBeforeEntry` 이중 단언, 92·101행 부근).
5. **frontmatter 규약** — 신규 plan 2건 모두 `spec_impact: none` (bare, 리스트 아님, Gate C
   요건 충족), `nestjs-v12-coordinated-upgrade.md` 의 `worktree: (unstarted)` 는
   `.claude/docs/plan-lifecycle.md` §79행이 명시한 유효 sentinel(placeholder 아님) — 이 PR
   자신이 §8 백로그에 기록한 "legacy placeholder violation" 사례와는 다른 정상 케이스다.
6. **교차 참조 무결성** — `nestjs-v12-coordinated-upgrade.md` 가 인용하는
   `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증"과
   `plan/in-progress/auth-guard-reflection-hardening.md` 존재를 grep/ls 로 확인 — 실재.
7. **TODO/FIXME/HACK/XXX** — 핵심 7개 파일 diff 전체에서 grep 0건.
8. **CHANGELOG 미기재** — 빌드/테스트 도구 변경이라 항목 없음. `spec-draft-nullable-notation-
   followups.md` 백로그가 이 판정 기준 자체의 미문서화를 이미 별도 항목으로 등재해 뒀다
   (이 PR 의 결함이 아니라 이미 추적 중인 후속 과제).

## 발견사항

- **[INFO]** spec fidelity — `spec/` 아래에 jest 설정/테스트 프레임워크 도구 정책을 정의하는
  문서가 없다(`grep -rl "transformIgnorePatterns|vm-modules|ESM" spec/` 무관 결과 2건뿐).
  - 위치: 해당 없음(문서 부재 자체가 발견사항)
  - 상세: 이 변경은 제품 요구사항이 아니라 CI/테스트 하니스 정책이라 `spec/`  범위 밖이고,
    대신 `PROJECT.md`(비-spec 거버넌스 문서)가 SoT 다. `PROJECT.md:82`(게이트 숫자 기준)이
    같은 커밋에서 함께 갱신됐고 문구도 실측(472/9946 unit, 380 e2e PASS, `@nestjs/typeorm@12`
    로드 성공)과 일치한다. spec 누락이 아니라 "이 변경 영역은 원래 spec 소관이 아님" 이 맞는
    분류다 — CRITICAL/WARNING 사유 아님, 참고 목적 INFO.
  - 제안: 조치 불요.

- **[INFO]** `test:debug` script 는 순서 텍스트만 정적으로 검증되고, 실제 실행(디버거 attach)
  경로는 어떤 자동화도 밟지 않는다는 사실을 스펙 헤더가 스스로 명시(53행 부근 "CI·Makefile·
  `.claude/test-stages.sh`·docker-compose 어디서도 실행되지 않는다").
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (57~60행 주석)
  - 상세: 감춰진 갭이 아니라 개발자가 보증 경계를 정직하게 명시한 것 — 문서화된 보장이
    구현보다 넓게 말하지 않는다(`feedback_documented_guarantee_wider_than_built` 교훈과 일치하는
    방향). 결함 아님.
  - 제안: 조치 불요.

CRITICAL/WARNING 급 발견사항 없음.

## 요약

핵심 기능 변경(jest ESM 네이티브 로드 전환)은 `jest.config.ts`·`test/jest-e2e.json`·
`package.json` 5개 script 전 지점에서 값이 서로 일치하고, 신규 가드 스펙
(`esm-native-load.spec.ts`)이 그 정합을 존재+순서 이중 단언으로 구조적으로 고정하며, 실제
CI unit 잡과 e2e docker-compose 진입점이 고쳐진 npm script 를 우회 없이 그대로 타는 것까지
확인했다. plan 문서 2건의 frontmatter·교차참조도 검증됐고 이전 3라운드 리뷰가 지적한 항목은
모두 커밋(`a49b62108` 등)으로 반영된 상태다. TODO/FIXME 없음, 에러 시나리오·엣지 케이스(플래그
누락·허용목록 복원·canary CJS 회귀·e2e 설정 발산)는 4종 뮤테이션 테스트로 실측 검증됐다.
CRITICAL/WARNING 없음.

## 위험도

NONE
