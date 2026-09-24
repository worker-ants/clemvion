# 유지보수성(Maintainability) 리뷰

## 검토 방법

이번 changeset(origin/main 대비 75개 파일)의 실제 코드/설정 변경은 이전 라운드와 동일한
8개뿐이다: `PROJECT.md`, `codebase/backend/jest.config.ts`, `codebase/backend/package.json`,
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`,
`codebase/backend/test/jest-e2e.json`, `plan/in-progress/jest-esm-native-load.md`,
`plan/in-progress/nestjs-v12-coordinated-upgrade.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`.

직접 실측 확인: `git diff eeffa4963..HEAD -- codebase/ PROJECT.md plan/` 는 **빈 출력**이다
— 즉 직전 라운드(`review/code/2026/09/24/16_02_28`, 3라운드 RESOLUTION 커밋
`eeffa4963`) 이후 이 8개 파일에 **한 글자도 바뀌지 않았다.** 이번 라운드의 diff에 새로
등장한 나머지 67개 파일은 전부 1~3라운드의 `review/code/**`·`review/consistency/**`
산출물(RESOLUTION·SUMMARY·개별 reviewer report·meta.json 등)이며, 함수·클래스·분기 같은
로직 코드가 아니라 이 워크플로 자체가 생성한 리뷰 텍스트다 — 가독성/네이밍/함수 길이/중첩
깊이/매직넘버/중복 코드/순환 복잡도 관점이 적용될 대상이 없다.

실제 소스 파일을 다시 열어(assembled 프롬프트 대신 원본을 직접 `Read`) 이전 라운드가 잡은
사항들이 여전히 유지되고 있음을 재확인했다:

- `codebase/backend/package.json:22-26` — `test`/`test:watch`/`test:cov`/`test:debug`/
  `test:e2e` 5개 스크립트 전부 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`
  형태로 통일. (1라운드 WARNING "`test:debug`만 `node_modules/.bin/jest` 잔존" 조치 유지.)
- `codebase/backend/jest.config.ts:3-11` — 상단 docstring이 "허용목록이 사라졌고 지금
  무엇을 주석해야 하는지"로 갱신된 상태 그대로. (1라운드 WARNING "stale docstring" 조치 유지.)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:83-104` —
  `flagIdx >= 0`/`entryIdx >= 0` 존재 단언과 `flagIdx < entryIdx` 순서 단언이 모두 남아
  서로를 떠받치는 구조 그대로. (3라운드 WARNING "존재 검사만으로는 순서 회귀를 못 잡는다"
  조치 유지.)
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` — `worktree: (unstarted)` sentinel
  그대로. (1라운드 documentation CRITICAL "legacy placeholder" 조치 유지.)

## 발견사항

새로 발견된 Critical/Warning 없음. 실질 코드가 3라운드 이후 변경되지 않았으므로 새로운
코드 표면 자체가 없다.

이전 라운드(16_02_28)가 이미 INFO로 남긴 관찰 셋은 이번에도 유효하며 상태 변화가 없다 —
재지적하지 않고 존재만 확인한다(조치 불요 판단도 그대로 유지):

- 동일 메커니즘("허용목록 제거 + `--experimental-vm-modules` 는 한 쌍") 설명이
  `PROJECT.md`·`jest.config.ts` 주석·`esm-native-load.spec.ts` 헤더 주석·
  `jest-esm-native-load.md` 4곳에 중복 서술된 상태 유지.
- `PROJECT.md`의 "테스트 프레임워크 이원화 (정책)" 불릿이 정책 문장 뒤에 개별 발동 사건
  서술을 계속 이어붙이는 구조 유지.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`가 5,100줄대 단일 누적
  파일로 유지(이번 라운드에서 추가 증분 없음).

## 요약

3라운드(`16_02_28`) RESOLUTION 커밋(`eeffa4963`) 이후 실질 코드/설정/plan 파일 8개는
`git diff`로 직접 대조한 결과 전혀 변경되지 않았다. 이번 라운드의 diff에 새로 등장한
67개 파일은 모두 1~3라운드 자신의 리뷰 산출물(markdown/json 리포트)이며, 이 관점이 겨냥하는
로직 코드가 아니다. 원본 소스를 직접 열어 재확인한 결과 1라운드·3라운드가 지적해 조치된
사항(`test:debug` 스크립트 통일, `jest.config.ts` docstring 갱신, 존재+순서 이중 단언,
plan frontmatter sentinel)이 모두 그대로 유지되고 있으며 재발이 없다. 새로운
Critical/Warning 급 유지보수성 결함은 없다.

## 위험도

NONE — 이번 라운드에서 검토 대상 코드에 변경이 없었고, 기존 조치도 모두 유지되고 있음을
직접 재확인했다.
