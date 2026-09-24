# 변경 범위(Scope) 리뷰 — jest ESM 네이티브 로드 전환 + 1라운드 리뷰 조치

## 검토 방법

리뷰 대상 39개 파일 중 실질 코드/설정 변경은 4개(`codebase/backend/jest.config.ts`,
`codebase/backend/package.json`, `codebase/backend/test/jest-e2e.json`,
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 신설)뿐이고, 나머지는
plan 문서 3건(`plan/in-progress/jest-esm-native-load.md`·`nestjs-v12-coordinated-upgrade.md`
신설, `spec-draft-nullable-notation-followups.md` 항목 추가), `PROJECT.md` 1문장 추가,
그리고 이전 라운드 리뷰/일관성-검토 산출물(`review/code/2026/09/24/14_24_10/**`,
`review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)이다. 작업 의도(막힌 dependabot PR
`#1339`이 ESM-only `@nestjs/typeorm@12`에 막혀 있었고, 해법으로 jest 를
`--experimental-vm-modules` 네이티브 ESM 로더로 전환)를 기준으로 각 변경이 그 범위 안에
있는지, 그리고 직전 라운드(`14_24_10`) RESOLUTION 이 실제로 그 라운드가 지적한 항목에만
국한됐는지를 대조했다.

## 발견사항

- **[INFO]** `test:debug` 스크립트 통일은 이 PR의 핵심 목적과 무관한 사전 존재 결함의
  동반 수정이다
  - 위치: `codebase/backend/package.json` (`test:debug` 항목, unified diff 상 `test`~`test:e2e`
    5개 스크립트가 한 hunk로 교체됨)
  - 상세: 이 PR의 실질 목적은 `transformIgnorePatterns` 허용목록 제거 + jest 네이티브 ESM
    로딩 전환이며, 그 자체는 `test`/`test:watch`/`test:cov`/`test:e2e` 4개 스크립트에
    `--experimental-vm-modules` 접두어를 다는 것으로 완결된다. `test:debug`의
    `node_modules/.bin/jest` → `./node_modules/jest/bin/jest.js` 치환은 이 PR이 만들지 않은
    기존 결함(pnpm 마이그레이션 이후 셸 래퍼가 `node`로 직접 실행되면 `SyntaxError`)의 수정이며,
    RESOLUTION.md 도 "이 PR이 만든 결함이 아니다"라고 스스로 명시하고 있다. 다만 같은 hunk 안의
    나머지 4줄과 표기를 통일하지 않으면 이 PR이 걷어내려는 "손으로 유지되는 목록이 갈라진다"는
    패턴이 스크립트 레이어에서 재현되므로, RESOLUTION.md가 근거(재현 로그 포함)와 반대 의견
    (`dependency-reviewer`)까지 함께 남기고 채택했다 — 범위 밖 변경이지만 **인접 hunk의
    일관성을 위한 최소 동반 수정**으로 판단해 정당한 스코프 확장으로 본다.
  - 제안: 조치 불요. 다만 이런 "동반 수정"은 다음에도 RESOLUTION.md 처럼 별도로 근거를 남기는
    관행을 유지할 것.

- **[INFO]** 새 가드 테스트(`esm-native-load.spec.ts`) 추가는 요청 범위를 넘어서는 것처럼
  보이나 이 PR이 도입한 불변식의 회귀 방지로 정당화된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규 파일 전체)
  - 상세: "막힌 dependabot PR 해소"라는 원 요청 자체는 신규 테스트 파일을 요구하지 않는다.
    하지만 이 PR이 만든 "플래그 + 기본 허용목록은 되돌릴 수 없는 한 쌍"이라는 불변식이
    지금까지는 `uuid`/`otplib` 등을 쓰는 비즈니스 스펙의 **우연한 커버리지**에만 의존하고
    있었다는 사실이 직전 라운드 INFO 12로 지적됐고, RESOLUTION.md가 뮤테이션 4종(M1~M4)을
    전부 예측=실측으로 실증하며 조치했다. over-engineering이 아니라 이 PR 자신이 깨뜨릴 수 있는
    상태를 이 PR 안에서 이름 붙여 고정한 것으로, 스코프 안의 방어적 조치로 판단한다.
  - 제안: 조치 불요.

- **[INFO]** `spec-draft-nullable-notation-followups.md`에 추가된 백로그 항목은 이 PR의
  논리적 스코프와 무관한 주제를 다룬다 (조치 자체는 없음)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 항목 "docs 가드가
    검사하는 데이터가 그 가드를 트리거하지 않는다")
  - 상세: 이 항목은 `frontend-checks.yml`의 pathspec에 `plan/**`·`spec/**`이 없어 docs 가드
    잡이 no-op으로 skip된다는, 이 PR의 jest/ESM 작업과 전혀 다른 CI 파이프라인 구조 문제를
    다룬다. 다만 실제 코드/설정 변경은 하지 않고 **기록만** 했고(RESOLUTION.md "보류·후속
    항목"에 명시), 이 파일 자체가 이 저장소에서 developer가 여러 세션에 걸쳐 다양한 주제의
    후속 항목을 등재하는 일반 백로그 문서로 이미 쓰이고 있다(파일 내 기존 항목들도 서로 다른
    리뷰 라운드·다른 주제를 담고 있음). 따라서 "무관한 파일 수정"이라기보다 정해진 절차(발견한
    구조적 갭은 고치지 말고 등재만 하고 넘어간다)를 그대로 따른 것으로 판단한다.
  - 제안: 조치 불요.

- **[INFO]** 39개 변경 파일 중 실질 코드/설정 변경은 4개뿐이고 나머지는 절차적 산출물
  (plan 문서, 리뷰/일관성-검토 산출물)이다
  - 위치: `review/code/2026/09/24/14_24_10/**`(13개), `review/consistency/2026/09/24/12_57_36/**`
    (7개), `review/consistency/2026/09/24/13_55_20/**`(8개)
  - 상세: 이 저장소는 `--impl-prep`/`--impl-done` 의무 실행과 그 산출물의 커밋을 명문화한
    워크플로를 갖고 있고(`CLAUDE.md` 정보 저장 위치 표, developer의 `review/**` 쓰기 권한),
    직전 라운드(`14_24_10`) 자신의 `scope.md`도 이 산출물들이 "요청 범위를 벗어난 부가 작업이
    아니다"라고 이미 판단했다. 이번 라운드는 그 판단에 더해, 직전 라운드가 WARNING 3으로 지적한
    "`12_57_36` 산출물이 참조되는데 커밋에 없다"는 완전성 갭까지 이번 diff에서 실제로
    커밋해 해소했다(RESOLUTION.md 조치 항목 Warning 3). 대량의 파일 수가 "의도 이상의 변경"
    처럼 보이지만 전부 절차 준수의 부산물이지 코드 스코프 이탈이 아니다.
  - 제안: 조치 불요.

## 검증한 것 (문제 없음 확인)

- `jest.config.ts`/`package.json`/`test/jest-e2e.json` diff에 `dependencies`/`devDependencies`
  버전 변경, import 추가/정리, 무관한 포맷팅 변경은 없다 — 각 hunk가 정확히 서술된 목적
  (`transformIgnorePatterns` 되돌리기 + 실행 스크립트에 플래그 추가)에만 대응한다.
  `@nestjs/typeorm`은 diff에서 `^11.0.3` 그대로다 — 실제 의존성 범프는 `nestjs-v12-coordinated
  -upgrade.md`로 명확히 분리돼 이번 PR에 섞이지 않았다.
- `nestjs-v12-coordinated-upgrade.md`의 `worktree:` 필드는 이번 diff에서 이미
  `(unstarted)`로 바로잡혀 있다 — 직전 라운드 Critical 1(레거시 placeholder)이 재발하지
  않았음을 확인했다.
- `PROJECT.md` diff는 기존 한 줄(`packages/* vitest 이행 보류` 정책)에 한 문장만 덧붙였고,
  인접 서술·다른 정책 항목은 건드리지 않았다 — 조건에 맞는 최소 범위 정정이다.

## 요약

이번 diff는 "막힌 dependabot PR을 jest 네이티브 ESM 로딩 전환으로 푼다"는 단일 목적에
정확히 수렴하는 4개 실질 파일 변경(설정 3 + 신규 가드 테스트 1)과, 그 목적을 뒷받침하는
plan/문서/리뷰 산출물로 구성돼 있다. 파일 수(39개)만 보면 광범위해 보이지만 대부분은
이 저장소가 명문화한 절차(구현 전 impl-prep, 구현 후 ai-review + resolution 커밋)의
정규 산출물이며, 이전 라운드 스스로도 같은 결론(NONE)을 냈고 이번 라운드는 그 라운드가
남긴 완전성 갭(미커밋 `12_57_36`)까지 해소했다. 발견된 것은 전부 INFO 수준의 "경계선
동반 수정"(pre-existing `test:debug` 버그 수정, 회귀 방지 가드 신설, 무관 주제 백로그 등재)
이며, 각각 RESOLUTION.md에 근거·재현·반대 의견까지 기록돼 있어 판단 과정이 투명하다.
Critical/Warning 급 범위 이탈은 없다.

## 위험도

NONE
