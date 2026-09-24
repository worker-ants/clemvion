# 변경 범위(Scope) 리뷰 — jest ESM 네이티브 로드 전환 (3라운드, 최종 상태)

## 검토 방법

`git merge-base HEAD origin/main` (`93b4ce6d3`) 대비 `HEAD`(`d184b10d2`) 전체 diff 57개
파일을 실제 저장소에서 재확인했다(`git diff --stat`로 프롬프트의 57개 파일 목록과 1:1
대조 완료 — 조립 프롬프트 밖의 숨은 변경 없음). 실질 코드/설정 변경 4개
(`jest.config.ts`, `package.json`, `test/jest-e2e.json`, `esm-native-load.spec.ts`)와
그 근거를 담은 `PROJECT.md`·plan 문서 3건, 그리고 절차 산출물(이전 2라운드 `review/code/**`,
`review/consistency/**`)로 구성된 전체를, "막힌 dependabot PR(`#1339`)이 ESM-only
`@nestjs/typeorm@12` 에 막혀 있었고 해법으로 jest 를 `--experimental-vm-modules` 네이티브
ESM 로더로 전환한다"는 원 작업 의도 기준으로 대조했다. 이전 두 라운드(`14_24_10`,
`15_26_17`) 자신의 scope.md 도 함께 읽고, 그 결론이 이번 최종 커밋(`f14d680ae`,
`d184b10d2`)에서도 유지되는지 별도로 검증했다.

## 발견사항

- **[INFO]** 핵심 코드/설정 변경 4개는 단일 목적에 정확히 수렴한다 — 스코프 이탈 없음
  - 위치: `codebase/backend/jest.config.ts`, `codebase/backend/package.json`,
    `codebase/backend/test/jest-e2e.json`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
  - 상세: `git diff 93b4ce6d3 HEAD -- codebase/backend/package.json` 를 직접 재확인한 결과
    `dependencies`/`devDependencies` 블록은 손대지 않았고 `scripts.test*` 5줄만 교체됐다
    (`@nestjs/typeorm` 은 diff 전체에서 `^11.0.3` 그대로). `jest.config.ts` 도
    `transformIgnorePatterns` 한 항목만 실질 변경이고 그 외 hunk 는 근거 주석이다.
    무관한 포맷팅·임포트 정리·버전 범프는 없다.
  - 제안: 없음.

- **[INFO]** `test:debug` 진입점 통일(사전 존재 결함의 동반 수정)은 근거가 기록된
  정당한 인접 hunk 확장이다
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: `test`~`test:e2e` 4개는 이 PR 목적(플래그 추가)만으로 완결되고 `test:debug` 의
    `node_modules/.bin/jest` → `./node_modules/jest/bin/jest.js` 치환은 이 PR 이 만들지 않은
    pnpm 마이그레이션 이후 결함의 수정이다. 다만 같은 hunk 안 5줄 중 1줄만 다른 표기로
    남기면 이 PR 이 걷어내려는 "손으로 유지되는 목록은 갈라진다" 패턴이 스크립트 레이어에서
    재현되므로, `review/code/2026/09/24/15_26_17/RESOLUTION.md` 가 반대 의견(dependency
    reviewer)까지 함께 기록하고 최소 동반 수정으로 채택한 것을 확인했다 — 범위 밖처럼
    보이나 근거가 투명하게 남아 스코프 남용이 아니다.
  - 제안: 없음.

- **[INFO]** 신규 가드 스펙(`esm-native-load.spec.ts`)은 이 PR이 만든 되돌릴 수 없는
  불변식의 회귀 방지이지 기능 확장이 아니다
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (전체, 99줄)
  - 상세: `find codebase/backend/src/repo-guards/__tests__` 로 확인한 결과 이 디렉터리는
    이미 `swagger-dto-contract`, `redis-fail-open-catalog`, `eslint-unicorn-peer` 등 30개
    이상의 선례 가드 스펙이 있는 기존 컨벤션이다 — 새 아키텍처 개념을 도입한 것이 아니라
    기존 패턴을 따랐다. 스펙 내용(canary 로 uuid 로드, 5개 npm script 텍스트 대조, e2e
    설정 대조)도 전부 "플래그+기본 허용목록은 한 쌍" 이라는 이 PR 이 만든 불변식만 지키며,
    round 2 수정(`f14d680ae`, W1)에서 script 텍스트까지 검사가 확장된 것도 "값만 검사하면
    접두어 없는 새 script 가 조용히 추가되는 경로가 열려 있다"는 같은 라운드 자체 뮤테이션
    실측(M7)에 대한 직접 대응이다 — over-engineering 이 아니라 이 PR 자신이 깨뜨릴 수 있는
    상태를 좁게 이름 붙여 고정한 것.
  - 제안: 없음.

- **[INFO]** `PROJECT.md` 자기-반증형 소정정은 조건에 맞게 한 문장에 국한됐으나,
  `취소선` 표기는 쓰지 않았다
  - 위치: `PROJECT.md:82`
  - 상세: `git show a8d1aceb4 -- PROJECT.md` 로 확인한 결과 원래 문장("packages/* 의 vitest
    이행은 … 트리거 전까지 보류한다")은 삭제 없이 그대로 남아 있고, 그 뒤에 실측 결과를
    담은 굵은 글씨 문장이 이어붙여졌다 — 인접 서술(버전 핀 정책 등 다른 항목)은 건드리지
    않아 CLAUDE.md §자기-반증형 소정정 조건 4("정정은 그 문장에 국한된다")의 실질(scope
    최소화)은 지켰다. 다만 같은 조건이 명시하는 형식("원문은 취소선으로 남기고")은 문자
    그대로는 따르지 않았다 — 원문이 "아직 유효한 전제"처럼 그대로 읽혀서, 뒤에 붙은 정정문을
    읽지 않으면 "트리거가 왔는데도 여전히 보류 상태"로 오독할 여지가 있다. 이 항목은 scope
    이탈은 아니고(오히려 최소 개입), 형식 준수 여부는 documentation/consistency 관점에
    가깝다.
  - 제안: 필수는 아니나, 원문 사실 부분(vitest 이행 보류 조건)에 `~~...~~` 를 씌워 "이 조건은
    이미 한 번 발화해 처리됐다"는 것을 시각적으로도 드러내면 다음 사람이 재차 헷갈릴 여지가
    줄어든다.

- **[INFO]** `spec-draft-nullable-notation-followups.md` 신규 항목 2건은 파일 제목(nullable
  표기)과 무관한 주제이지만, 저장소가 이미 확립한 범용 백로그 관행을 따른 것이다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:5080-5131`
  - 상세: 새 항목("docs 가드가 검사하는 데이터가 그 가드를 트리거하지 않는다",
    "CHANGELOG 「해당 없음」 판정에 성문 근거가 없다")은 `frontend-checks.yml` pathspec 갭과
    CHANGELOG 정책 갭을 다루며, 이 PR 의 jest/ESM 작업과 논리적으로 무관한 주제다. 다만
    frontmatter title("nullable 표기 후속 3건")과 달리 이 파일은 이미 5000줄 넘게 여러
    세션·주제의 developer 후속 항목을 누적해 온 범용 트래커로 실제 쓰이고 있어(파일 내
    기존 항목들도 서로 다른 리뷰 라운드·주제), 코드/설정 변경 없이 "발견했으나 이 PR
    스코프에서는 처리하지 않는다"를 기록만 한 이 추가는 새로운 위반이라기보다 기존 관행의
    연장이다. round 2 자체 수정(`f14d680ae`, W2)에서 "8개뿐이다"라는 처음 서술이 실제 12개로
    반증돼 전수로 정정된 이력도 같은 파일 안에서 확인했다 — 이 파일이 실질적 스코프 밖
    관찰의 공식 착지점으로 기능하고 있음을 보여준다.
  - 제안: 조치 불요. 다만 파일명이 실제 내용을 더는 반영하지 못하는 상태이므로(제목은
    "nullable 표기 후속 3건"인데 항목은 훨씬 넓다), 이 PR 스코프는 아니지만 언젠가
    범용 백로그 파일로 이름을 바꾸거나 분리하는 것을 고려할 여지는 있다.

- **[INFO]** 대량의 파일 수(57개)는 대부분 이 저장소가 명문화한 절차의 정규 산출물이다
  - 위치: `review/code/2026/09/24/14_24_10/**`(13개), `review/code/2026/09/24/15_26_17/**`(15개),
    `review/consistency/2026/09/24/12_57_36/**`(7개), `review/consistency/2026/09/24/13_55_20/**`(8개)
  - 상세: `CLAUDE.md` 의 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 조항과
    developer 의 `review/**` 쓰기 권한에 따른 정규 산출물이다. 이전 두 라운드의 scope.md
    가 이미 같은 결론(NONE)을 냈고, round 2 는 round 1 이 WARNING 으로 지적한 미커밋
    `12_57_36` 완전성 갭까지 이번 changeset 에 커밋해 해소했다. 파일 수가 많아 보이는 것은
    절차 준수의 부산물이지 코드 스코프 이탈이 아니다.
  - 제안: 없음.

## 검증한 것 (문제 없음 확인, 재실측)

- `git diff --stat 93b4ce6d3 HEAD` 전체 57개 파일 = 프롬프트 파일 목록 57개와 정확히 일치
  (숨겨진 diff 없음).
- `codebase/backend/package.json` diff 는 `scripts` 블록에만 국한 — dependency 버전 변경 0건.
- `nestjs-v12-coordinated-upgrade.md` 의 `worktree:` frontmatter 는 최종 상태에서
  `(unstarted)` sentinel 로 정상 — round 1 이 지적한 legacy placeholder CRITICAL 은 최종
  changeset 에 재발하지 않았다.
- `codebase/backend/src/repo-guards/__tests__` 디렉터리는 이 PR 이전부터 존재한 확립된
  컨벤션(30여 개 선례 가드) — 새 파일 추가가 새 아키텍처를 발명한 것이 아님을 `find`/`git log`
  로 확인.

## 요약

최종 상태(57개 파일, 3라운드 리뷰·수정 누적)를 재검증한 결과 이 changeset 은 여전히
"막힌 dependabot PR 을 jest 네이티브 ESM 로딩 전환으로 푼다"는 단일 목적에 수렴한다.
실질 코드/설정 변경은 4개 파일(jest 설정 3 + 신규 가드 테스트 1)뿐이고 dependency 버전·
무관한 리팩터링·포맷팅·불필요한 임포트는 발견되지 않았다. round 2 의 fix 커밋
(`f14d680ae`)이 추가한 script-텍스트 대조 로직·pathspec 전수 정정·CHANGELOG 백로그
항목도 모두 그 라운드 자신의 리뷰 발견사항(W1·W2·INFO10)에 대한 직접 대응이며, 이 저장소가
명문화한 RESOLUTION 워크플로를 벗어나지 않는다. `PROJECT.md` 자기-반증형 소정정은 한 문장에
국한돼 인접 서술을 건드리지 않았으나 취소선 표기를 문자 그대로 쓰지 않은 점, 그리고
`spec-draft-nullable-notation-followups.md` 에 주제가 다른 백로그 2건이 추가된 점은 이
저장소의 기존 관행(범용 백로그 파일, 근거 기록 후 미처리 유보)과 일치해 새로운 위반으로
보기 어렵다. Critical/Warning 급 범위 이탈은 발견되지 않았다.

## 위험도

NONE
