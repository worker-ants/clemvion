# 요구사항(Requirement) 리뷰 — `review/code/2026/09/24/16_56_25` (5라운드)

## 스코프 정리

`git diff --stat origin/main...HEAD -- codebase PROJECT.md plan` 로 재확인한 실질 기능
변경은 여전히 8개 파일이고, **직전 라운드(`16_29_15`)의 requirement 리뷰가 검증한 것과
바이트 단위로 동일하다**:

- `PROJECT.md` (정책 문구 1건)
- `codebase/backend/jest.config.ts`
- `codebase/backend/package.json` (npm scripts 5곳)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규)
- `codebase/backend/test/jest-e2e.json`
- `plan/in-progress/jest-esm-native-load.md` (신규)
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (신규 스텁)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (백로그 2항목 추가)

이번 프롬프트에 새로 포함된 나머지 파일들은 전부 `review/code/2026/09/24/16_29_15/*`
(4라운드 산출물 + RESOLUTION)과 `review/consistency/2026/09/24/{12_57_36,13_55_20}/*`
(과거 consistency-check 산출물)이며, `codebase/**` 를 전혀 건드리지 않는다 — **이번 라운드는
`codebase/**` 수정 0건**인 상태에서 도는 확인 라운드다(4라운드 RESOLUTION 이 "다음 라운드는
freshness 게이트상 어차피 필요"라고 미리 적어 둔 그 라운드).

## 직접 재검증한 내용 (4라운드 이후 변동 없음을 소스에서 직접 대조)

1. **핵심 3파일 정합** — `codebase/backend/jest.config.ts:41`
   (`transformIgnorePatterns: ['/node_modules/']`), `codebase/backend/test/jest-e2e.json:9`
   (`"transformIgnorePatterns": ["/node_modules/"]`), `codebase/backend/package.json:22-26`
   (5개 script 전부 `node --experimental-vm-modules … ./node_modules/jest/bin/jest.js`) —
   Read 로 직접 열어 값이 서로 일치함을 확인.
2. **가드 스펙(`esm-native-load.spec.ts`) 을 현재 `package.json` 과 손으로 대조** —
   `NODE_ARGS` 맵의 `test`/`test:watch`/`test:cov`/`test:e2e` = `--experimental-vm-modules`,
   `test:debug` = `--experimental-vm-modules --inspect-brk -r tsconfig-paths/register -r
   ts-node/register`. 각 script 문자열의 접두어(`node ${NODE_ARGS[name]} ${ENTRY}`)가
   실제 `package.json` 값과 글자 그대로 일치 — 4라운드에서 "형태로 고정"한 접근이 현재
   상태에서도 유효함을 재확인.
3. **plan frontmatter (Gate C)** — `jest-esm-native-load.md` · `nestjs-v12-coordinated-
   upgrade.md` 모두 `spec_impact: none` (bare scalar, 리스트 아님). `nestjs-v12-coordinated-
   upgrade.md` 의 `worktree: (unstarted)` 는 유효 sentinel(`.claude/docs/plan-lifecycle.md`
   §4 기준) — 1라운드 documentation 리뷰가 지적한 legacy placeholder(`(미정 — 착수 시
   생성)`) CRITICAL 은 현재 파일에서 이미 sentinel 로 교체된 상태.
4. **교차 참조 무결성** — `nestjs-v12-coordinated-upgrade.md` 가 인용하는
   `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증"(794행)과
   `plan/in-progress/auth-guard-reflection-hardening.md` 실재 확인(ls/grep).
5. **`spec-draft-nullable-notation-followups.md` 신규 항목의 수치 재검증** — "12개" 라는
   `frontend-checks.yml` pathspec 항목 수 주장을 `sed -n '/pathspecs: |/,/^      relevant/p'`
   로 직접 재실행해 대조 — `codebase/frontend/**` · `codebase/channel-web-chat/**` ·
   `codebase/packages/**` · `pnpm-lock.yaml` · `pnpm-workspace.yaml` ·
   `scripts/ci-paths-changed.sh` · `.github/workflows/_changed-paths.yml` ·
   `.github/actions/pnpm-workspace/action.yml` · `.github/workflows/frontend-checks.yml` ·
   `scripts/_typecheck_ratchet.py` · `scripts/check-frontend-typecheck-ratchet.py` ·
   `scripts/frontend-typecheck-baseline.json` = **정확히 12개** — 일치.
6. **TODO/FIXME/HACK/XXX** — `git diff origin/main...HEAD -- codebase PROJECT.md plan` 전체에
   `grep -inE "TODO|FIXME|HACK|XXX"` 0건.
7. **spec fidelity** — `grep -rl "transformIgnorePatterns|vm-modules|experimental-vm-modules"
   spec/` 0건. jest ESM 로딩 정책은 제품 요구사항이 아니라 CI/테스트 하니스 정책이라
   `spec/` 소관이 아니고, `PROJECT.md`(비-spec 거버넌스 문서)가 SoT — 이 문서 자체가 이번
   PR 의 변경 대상(파일 1)이라 spec 누락이 아니라 정확한 위치에 정확한 값으로 갱신됐다.
   CRITICAL/WARNING 사유 아님.

## 결론

4라운드 requirement 리뷰가 검증한 8개 파일과 이번 라운드의 동일 파일이 diff·내용 모두
동일하며, 4라운드에서 발견된 Warning 2건(가드의 순서 누락·plan 뮤테이션 표 stale)은 커밋
`00791d3c8`으로 조치되어 현재 소스에 반영된 것을 직접 대조로 재확인했다. 이번 라운드에
새로 추가된 파일은 전부 이전 라운드의 리뷰/consistency-check 산출물(`review/**`)이며
`codebase/**` 변경이 0건이므로, 기능 완전성·엣지 케이스·에러 시나리오·비즈니스 로직·반환값·
spec 정합 관점에서 재검토할 신규 표면이 없다. CRITICAL/WARNING 급 발견사항 없음.

**뮤테이션/저장소 변경**: 이번 리뷰는 Read/Grep/sed 를 통한 읽기 전용 대조만 수행했다.
`git status --short` 로 확인한 결과 이 리뷰 세션이 만든 산출물(`review/code/2026/09/24/
16_56_25/`) 외 저장소 트리 변경 없음.

## 위험도

NONE
