# 요구사항(Requirement) 리뷰

## 검토 방법

이 PR 은 이미 한 라운드(`review/code/2026/09/24/14_24_10`)를 거쳐 Critical 1(plan frontmatter placeholder) ·
Warning 3 · INFO 다수를 조치한 뒤(`RESOLUTION.md`, 보류 0건) 다시 전체 changeset 을 fresh 로 검토받는
라운드다. 실제 애플리케이션 코드 변경은 `codebase/backend/jest.config.ts` ·
`codebase/backend/package.json` · `codebase/backend/test/jest-e2e.json` · 신규
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 4개 파일뿐이고, 나머지는
`PROJECT.md` 정책 갱신 · `plan/in-progress/*.md` 2건(신규) + 1건(기존 followups 등재) ·
이전 리뷰/consistency 라운드 산출물 커밋이다.

RESOLUTION.md 가 주장하는 조치가 실제로 반영됐는지 직접 확인했다(뮤테이션 없이):

- `codebase/backend/package.json:25` `test:debug` — RESOLUTION 이 주장한 대로 `./node_modules/jest/bin/jest.js` 로 통일돼 있음을 `Read` 로 확인.
- `codebase/backend/jest.config.ts:3-11` docstring — 옛 정규식이 아니라 현재 파일의 존재 이유(기본값이 의도적인 이유)로 갱신돼 있음을 확인.
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` `worktree:` — `(unstarted)` sentinel 로 정정돼 있음을 확인(legacy placeholder 정규식 미매치).
- 신규 가드 스펙을 실제로 실행: `node --experimental-vm-modules ./node_modules/jest/bin/jest.js repo-guards/__tests__/esm-native-load.spec.ts` → **3 tests passed**. 플래그를 뺀 동일 명령(파일 미수정, 실행 인자만 변경) → **RED**, `Must use import to load ES Module: …/uuid@13.0.2/…` — plan/RESOLUTION 이 주장한 M1 뮤테이션 결과와 일치. `node_modules/uuid/package.json` 의 `"type": "module"` 도 직접 확인해 canary 가정이 유효함을 검증.
- e2e 설정 대조 단언이 가리키는 경로(`__dirname` 기준 `../../../test/jest-e2e.json`)를 손으로 계산 — `src/repo-guards/__tests__` → `backend/test/jest-e2e.json` 로 정확히 귀결됨을 확인.
- `spec/` 전체에 `transformIgnorePatterns` 참조가 없고(`grep -rl`), `plan/` 안에는 `jest-esm-native-load.md` 자기 자신만 참조 — 옛 정규식을 서술한 stale 문서가 다른 곳에 남아있지 않음을 확인.
- `git status --short` — 검증 과정에서 저장소에 남긴 변경 없음(untracked 는 본 리뷰 산출물 디렉터리뿐).

## 발견사항

- **[INFO]** 관련 spec 문서 없음(spec fidelity 항목 9)
  - 위치: 해당 없음 — `spec/` 전체에 `jest`·`transformIgnorePatterns` 관련 언급 자체가 없음(grep 확인)
  - 상세: 이 변경은 제품 요구사항이 아니라 backend 테스트 러너의 모듈 로딩 방식(순수 tooling)이다. `CLAUDE.md`/`PROJECT.md` 규약상 이런 인프라 정책의 SoT 는 `spec/`가 아니라 `PROJECT.md` §"버전·도구 정책" 이고, 실제로 그 절이 이 PR 에서 갱신됐다(`PROJECT.md` diff, `packages/*` 이행 트리거 교차 참조 추가). spec 본문과 line-level 로 비교할 대상 자체가 없으므로 CRITICAL/WARNING 사유가 아니다.
  - 제안: 없음(정보 제공).

- **[INFO]** `PROJECT.md` 신규 문장의 사실 정합성 확인
  - 위치: `PROJECT.md` §버전·도구 정책 — "테스트 프레임워크 이원화 (정책)" 항목의 추가 문장
  - 상세: "그 트리거는 2026-09-24 backend 에서 한 번 발화했고 … 이행이 아니라 두 줄로 풀렸다" · "적용·검증된 것은 backend 뿐이고 packages/\* 에서는 아직 재지 않았다" 는 서술이 실제 코드 상태(backend 만 변경, packages/\* 미변경 — `git diff --stat origin/main...HEAD` 로 확인)와 정확히 일치한다. 과장 없이 적용 범위를 좁게 서술한 점도 확인했다.
  - 제안: 없음.

- **[INFO]** 새 repo-guard 가 별도 `-guard.ts` 파일 없이 spec 파일에 로직을 직접 담음
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (전체)
  - 상세: `repo-guards/__tests__/` 의 대다수 가드는 `<name>-guard.ts` + `<name>.spec.ts` 로 분리돼 있으나, 이 신규 가드는 로직을 spec 파일에 인라인했다. 다만 이 저장소에 이미 같은 패턴의 선례가 있다(`workspace-roles-attachment.spec.ts` — 별도 guard.ts 없이 자기완결형). 문서화된 컨벤션(README·`.claude/docs/**`)이 분리를 강제하지 않으므로 위반이 아니며, RESOLUTION.md 의 "repo-guards 선례 준수" 서술도 실제 선례와 어긋나지 않는다.
  - 제안: 없음(정보 제공, 회색지대).

## 요약

핵심 기능 변경(jest 를 `--experimental-vm-modules` 로 구동 + `transformIgnorePatterns` 기본값 복원)은 실제로 실행해 검증했을 때 의도대로 동작한다 — 신규 가드 스펙이 통과하고, 플래그 제거 시 정확히 plan 이 예측한 에러로 RED 가 재현된다. 직전 라운드(`14_24_10`)가 지적한 Critical 1(plan frontmatter placeholder) · Warning 3 은 모두 코드 상에서 실제로 조치된 상태임을 직접 대조로 확인했으며, 되돌리거나 놓친 항목은 없다. 관련 spec 문서 자체가 존재하지 않는 영역(순수 테스트 tooling)이라 spec fidelity 위반 소지는 없고, `PROJECT.md` 갱신 내용도 실제 변경 범위와 정확히 일치한다. 새로 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
