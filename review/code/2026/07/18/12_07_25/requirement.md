# 요구사항(Requirement) 리뷰 — 내부 패키지 등록 목록 4곳 drift 가드

## 검증 방법
정적 분석 + 실제 저장소 상태 실측:
1. `npx vitest run .../internal-package-registration.test.ts` → **45/45 PASS** (vacuity 아님, 실제 저장소 상태 대조 성공).
2. `codebase/packages/*` 7개 실측(sdk, ai-end-reason, expression-engine, graph-warning-rules, node-summary, chat-channel-validation, web-chat-sdk→`@workflow/web-chat`) vs `INTERNAL_PACKAGES`(6개) + `packages-checks.yml`(5개, backend `@workflow/*` 직접 의존과 정확히 일치) — 모집단 분리 설계대로 정합.
3. `gh api repos/.../actions/permissions` → `enabled:false`, `gh run list --workflow=packages-checks.yml` → 0건. "Actions 꺼짐/inert" 주석 주장이 사실과 일치.
4. **재현 mutation**: `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` 에서 `"@workflow/node-summary"` 를 실제 삭제 → `cmd_lint`/`cmd_build` 등 3개 테스트가 정확히 그 패키지명을 지목하며 FAIL(#968 클래스 재현). 직후 원복 확인(`diff` 로 바이트 동일성 확인).
5. `eslint`(신규 2파일 대상) clean, `tsconfig.json` exclude(`src/**/__tests__/**`)로 두 파일이 tsc/next build 에서 실제로 제외됨을 확인(주석 주장과 일치).
6. `git log` 로 이 diff 가 이미 4회의 `/ai-review` WARNING 라운드(quote-span 제거, 명령위치 판정, 파서 모듈 분리, 인라인 비교 pure 함수 추출)를 거쳐 수렴한 최종본임을 확인 — 과거 라운드에서 지적된 이슈(주석/echo 문자열 오인식, 인라인 비교 뮤테이션 취약성)는 모두 이번 diff 에 반영·해소돼 있다.

## 발견사항

- **[INFO]** 관련 spec 문서 없음 (예상된 결과)
  - 위치: 전 4개 파일(`.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, 신규 guard/test 2파일)
  - 상세: `spec/` 전체를 grep(`test-stages`, `INTERNAL_PACKAGES`, `packages-checks`, `internal-package-registration`)했으나 매치 없음. 이 변경은 `.claude/` 하위 개발 하네스(테스트 실행 스크립트·CI 워크플로·harness 자체 회귀 가드)이며 CLAUDE.md 정보 저장 위치 표상 `spec/` 은 제품 정의·기술 명세 전용, 하네스 규약은 `.claude/docs/`·`PROJECT.md` 영역이라 spec fidelity 판단 대상 자체가 아니다.
  - 제안: 조치 불요.

- **[INFO]** `explicitFilterCalls` 의 blind 따옴표 제거는 "따옴표로 감싼 패키지명"을 지원하지 않음(설계상 한계, 문서화됨)
  - 위치: `internal-package-registration-guard.ts` `explicitFilterCalls` (라인 ~130 부근, quote-span 제거 단계)
  - 상세: `"[^"]*"` 를 통째로 `""` 로 치환하므로, 만약 미래에 실제 명령이 `pnpm --filter "@workflow/x" lint` 처럼 패키지명을 따옴표로 감싸 쓰면(현재 `test-stages.sh` 의 `cmd_*` 는 그렇게 쓰지 않음 — 변수형 `"$pkg"` 만 그렇게 씀) 그 호출이 인식되지 않아 해당 패키지가 "누락"으로 오탐(false positive, 시끄러운 방향)된다. 코드 주석이 이 경계를 명시적으로 인지하고 있고(`#970` 교훈 인용), 침묵하는 오탐(#968 급 false-pass)이 아니라 시끄러운 오탐 방향이라 안전 성질은 보존된다.
  - 제안: 조치 불요. 향후 `cmd_*` 가 따옴표로 pkg 명을 감싸는 스타일로 바뀐다면 그때 파서를 확장.

- **[INFO]** guard 두 파일(`*-guard.ts`, `*.test.ts`)이 tsconfig exclude 로 tsc/next build 컴파일타임 검증에서 제외됨(런타임 전용, 문서화됨)
  - 위치: 두 파일 헤더 주석 + `tsconfig.json` `exclude: ["src/**/__tests__/**"]` (실측 확인)
  - 상세: 타입 오류는 `vitest`(esbuild, strip-only)로도 `next build`(exclude)로도 잡히지 않는다. 다만 실제 로직은 vitest 가 import 해 실행하므로 **런타임 동작**은 45개 테스트로 검증된다 — 순수 타입 실수(예: 잘못된 제네릭)만 이 갭의 대상이며, 본 파일들은 타입 사용이 단순(string[], object literal)해 실질 위험은 낮다. 이 프로젝트에서 과거 유사 갭(PR #912)이 실제 회귀로 이어진 전례가 있어 인지해 둘 가치는 있으나, 이번 코드 자체가 이미 이 갭을 헤더에서 명시적으로 인지하고 있어 신규 결함은 아니다.
  - 제안: 조치 불요.

## 요약
`.claude/test-stages.sh`·`.github/workflows/packages-checks.yml` 헤더 주석 추가와 신규 guard(`internal-package-registration-guard.ts`)+test(`internal-package-registration.test.ts`)는 PR #968 급 회귀(신규 내부 공유 패키지가 `INTERNAL_PACKAGES`/CI 워크플로 3개 목록 중 어느 하나라도 등록 누락 시 조용히 무검증인 채 `status=PASS`)를 구조적으로 차단하려는 의도를 완전히 구현했다. 실측으로 (a) 현재 저장소 상태 기준 45/45 PASS, (b) `@workflow/node-summary` 삭제 mutation → 정확한 3개 테스트 FAIL 재현 → 원복, (c) GitHub Actions off·0-run 주장의 `gh api`/`gh run list` 실증, (d) tsconfig exclude·eslint clean 을 모두 직접 확인했다. 모집단이 서로 다른 두 목록(`INTERNAL_PACKAGES`="특수 스텝 없는" 패키지 vs `packages-checks.yml`=backend 공유 패키지)을 혼동 없이 각각 옳은 기준(3단계 커버 여부 vs backend `package.json` 파생)으로 검증하고, 파서(`fnBody`/`explicitFilterCalls`/`listAtPath`)는 휴리스틱이 깨질 수 있는 조건(중첩 브레이스·heredoc·따옴표 안 구분자·주석/로그 텍스트 오인식)을 스스로 검출해 fail-loud 하거나 합성 fixture 로 회귀를 고정해 두었다. TODO/FIXME/HACK/XXX 없음, 함수명·주석과 실제 동작 일치, 모든 경로에서 적절한 반환(`[]`/`throw`/실제 목록)을 수행한다. 이 변경 영역은 `spec/` 제품 스펙이 아니라 `.claude/` 하네스 도구라 spec fidelity 대상 문서가 없어 INFO 로만 기록했다(불일치 아님). 발견된 항목은 전부 INFO 등급의 알려진·문서화된 설계상 경계(scope)이며, CRITICAL/WARNING 급 결함은 없다. 이 diff 는 이미 4회의 `/ai-review` 라운드를 거쳐 이전 WARNING(주석/로그 오인식, 인라인 비교 뮤테이션 취약성)을 모두 해소한 수렴 상태다.

## 위험도
NONE
