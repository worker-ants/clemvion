# 요구사항(Requirement) 리뷰 — jest ESM 네이티브 로드 전환 (3라운드)

## 검토 방법

이 changeset(총 57개 파일, 실제 코드/설정 변경은 4개: `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`, `codebase/backend/test/jest-e2e.json`,
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`)은 이미 2라운드의
`/ai-review`(`review/code/2026/09/24/14_24_10`, `15_26_17`)를 거쳐 Critical 1건·Warning 3건이
전부 조치됐다고 RESOLUTION 이 주장한다. 이번 3라운드는 그 주장을 재검증하고, 요구사항
충족·spec 정합 관점의 새 발견사항이 있는지 독립적으로 확인했다.

저장소를 뮤테이션하지 않고 다음을 직접 실행/대조했다(트리 변경 없음, 종료 시
`git status --short` 로 확인 — 이 세션 자신의 output 디렉터리 외 변경 없음):

- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --testPathPatterns=esm-native-load`
  → **PASS (4/4)** — 신규 가드 스펙이 실제로 통과함을 독립 재현.
- `codebase/backend/package.json` 의 5개 `test*` script 전문 대조 → `test:debug` 도
  다른 4개와 동일하게 `./node_modules/jest/bin/jest.js` 를 가리키도록 이미 수정돼 있음
  (1라운드 Warning 1 조치, `815d2e180` 반영 확인).
- `codebase/backend/jest.config.ts` 상단 독스트링 대조 → 제거된 정규식을 더 이상 존재
  이유로 서술하지 않고, 현재 파일의 실제 목적(기본값 회귀가 의도적인 이유)으로 갱신돼
  있음(1라운드 Warning 2 조치 확인).
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md` frontmatter → `worktree: (unstarted)`
  — `.claude/docs/plan-lifecycle.md` §4 sentinel 규약 준수 확인(1라운드 Critical 1 조치 확인).
- `grep -rn "transformIgnorePatterns\|jest" spec/` → 0건. 이 변경 영역(jest 테스트 러너
  모듈 로딩 설정)을 정의하는 `spec/` 문서가 애초에 존재하지 않음을 확인.
- `codebase/backend/src/repo-guards/__tests__/` 디렉터리 대조 → `workspace-roles-attachment.spec.ts`
  가 이미 `<name>-guard.ts` 없이 spec 단독으로 존재하는 선례임을 확인(2라운드 RESOLUTION
  INFO 9 판단 근거 재검증).
- `pnpm-workspace.yaml`/`pnpm-lock.yaml` 의 `uuid` 항목 대조.

## 발견사항

- **[INFO]** 신규 가드 스펙(`esm-native-load.spec.ts`)이 실제로 통과함을 독립 재현
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (전체)
  - 상세: RESOLUTION 이 주장하는 뮤테이션 결과(M1~M7)를 전부 재실행하지는 않았으나,
    무수정 상태에서 해당 파일만 targeted 실행한 결과 `Test Suites: 1 passed, 1 total /
    Tests: 4 passed, 4 total` 로 실측 확인했다. 스펙 헤더가 서술하는 의도(트립와이어
    import, 공허성 가드, script 텍스트 대조, e2e 설정 대조)와 실제 코드가 line-level 로
    일치한다 — 함수명·주석과 구현 간 괴리 없음.
  - 제안: 없음(검증 완료, 조치 불요).

- **[INFO]** 관련 spec 본문 없음 — 이 변경 영역은 애초에 `spec/` 관할이 아니다
  - 위치: 해당 없음(`spec/` 전체 grep 0건)
  - 상세: 점검 관점 9 에 따라 `spec/` 을 grep 했으나 `jest`·`transformIgnorePatterns`·
    ESM 로딩 관련 문서가 없다. 이는 갭이 아니라 설계상 당연한 결과다 — `CLAUDE.md` 의
    정보 저장 위치 표에 따르면 `spec/` 은 "제품 정의·기술 명세"이고, 테스트 러너의
    모듈 로딩 방식 같은 빌드/CI 도구 정책은 `PROJECT.md`(버전·도구 정책) 와
    `plan/in-progress/jest-esm-native-load.md` 가 정본이다. 두 문서와 실제 코드
    (`jest.config.ts`, `package.json` scripts, `test/jest-e2e.json`)를 대조한 결과
    line-level 로 일치한다(예: `PROJECT.md` 가 인용하는 "두 방향 실측과 불변식 가드는
    …esm-native-load.spec.ts 헤더에 있다" 는 실제로 그 헤더에 존재).
  - 제안: 없음(spec 누락이 아니라 해당 영역이 spec 관할 밖).

- **[INFO]** `uuid` 선언 버전과 실제 설치 버전의 불일치 — 이 PR 과 무관한 pre-existing override, 가드/plan 의 실측과는 정합
  - 위치: `codebase/backend/package.json:91` (`"uuid": "^14.0.1"`) vs
    `codebase/backend/node_modules/uuid/package.json` (`"version": "13.0.2"`) vs
    `pnpm-workspace.yaml:49` (`uuid: ^13.0.2`, overrides 블록)
  - 상세: package.json 은 `^14.0.1` 을 선언하지만 워크스페이스 전역 `overrides` 가
    `uuid` 를 `^13.0.2` 로 강제하고 있어 실제 설치본은 13.0.2 다. 이 override 는 이번
    diff 의 변경 대상이 아니고(diff 는 `package.json` scripts 블록만 건드림) 사전에
    존재하던 상태다. plan(`jest-esm-native-load.md`)과 가드 스펙 주석이 "measured with
    uuid@13"·"uuid@13.0.2" 로 적은 실측치는 실제 설치본(13.0.2)과 정확히 일치하므로
    이 PR 의 결론 자체에는 영향이 없다. 다만 `package.json` 의 표시 범위(`^14.0.1`)만
    보고 "uuid 14 에서 실측했다"고 오독할 여지는 남는다.
  - 제안: 조치 불필요(이 PR 스코프 밖). 다만 이 override 가 향후 해제되어 uuid 14.x 가
    실제로 설치되는 시점에는 `esm-native-load.spec.ts` 의 canary 가정(`type: module`)이
    여전히 유효한지 재확인이 필요하다 — uuid 14.x 도 ESM-only 로 알려져 있어 위험은
    낮지만, 그 시점의 담당자가 참고할 수 있도록 언급만 남긴다.

- **[INFO]** 2라운드 RESOLUTION 이 주장한 조치가 코드에 실제로 반영돼 있음을 재확인
  - 위치: `codebase/backend/package.json:22-26`, `codebase/backend/jest.config.ts:1-11`,
    `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5`
  - 상세: RESOLUTION.md(`14_24_10`, `15_26_17`) 두 건이 서술하는 "조치했다"는 주장을
    각각 diff 가 아니라 현재 저장소 파일 상태로 직접 대조했고 전부 일치했다(위 "검토
    방법" 절 참조). 문서(RESOLUTION)와 실제 구현 간 괴리 없음.
  - 제안: 없음.

## 요약

핵심 요구사항("막힌 dependabot PR `#1339` 를 CJS jest 로는 못 넘는 ESM-only 의존성
문제를 풀되, NestJS 12 동반 업그레이드는 별도 PR 로 분리한다")은 코드·plan·가드 스펙이
line-level 로 정확히 수렴해 구현돼 있다. 이미 2라운드에 걸쳐 Critical 1건(placeholder
worktree)·Warning 3건(test:debug 드리프트·오래된 docstring·untracked 참조)이 실측 재현과
함께 조치됐음을 이번 라운드에서 코드 상태·독립 테스트 실행으로 재확인했다 — RESOLUTION
문서의 주장과 실제 구현 사이 괴리는 없다. 신규 가드 스펙(`esm-native-load.spec.ts`)은
무수정 상태에서 직접 실행해 4/4 PASS 를 확인했고, 헤더 주석이 서술하는 보증 범위(script
경유 호출만 커버, IDE/`npx jest` 직접 호출은 불변식 밖)도 정직하게 명시돼 있다. `spec/`
문서는 이 영역을 다루지 않지만 이는 설계상 당연하다 — 관련 정책은 `PROJECT.md`·
`plan/in-progress/jest-esm-native-load.md` 가 정본이고 코드와 정합한다. TODO/FIXME/HACK/XXX
잔존 없음, 반환값·에러 시나리오·데이터 유효성 항목은 이 변경이 테스트 인프라 설정이라
해당 사항이 원천적으로 없다(테스트로 검증되는 대상이지 비즈니스 로직 자체가 아님).
발견된 것은 이 PR 과 무관한 pre-existing `uuid` override 표시 불일치뿐이며 결론에는
영향이 없다. Critical/Warning 급 결함은 발견되지 않았다.

## 위험도
NONE
