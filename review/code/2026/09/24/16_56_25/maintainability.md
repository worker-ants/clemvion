# 유지보수성(Maintainability) 리뷰

## 검토 방법

`git diff origin/main...HEAD --stat` 로 이번 changeset(93개 파일)을 전수 확인했다. 실제
코드/설정/plan 변경은 8개뿐이다: `PROJECT.md`, `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`,
`codebase/backend/test/jest-e2e.json`, `plan/in-progress/jest-esm-native-load.md`,
`plan/in-progress/nestjs-v12-coordinated-upgrade.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`.
나머지 85개는 1~4라운드 자신의 `review/code/**`·`review/consistency/**` 산출물(markdown/json
리포트)이며 함수·클래스·분기 같은 로직 코드가 아니어서 가독성/네이밍/함수 길이/중첩/매직넘버/
중복/복잡도 관점이 적용될 대상이 없다.

직전 라운드(`review/code/2026/09/24/16_29_15/maintainability.md`)는 3라운드 RESOLUTION
커밋(`eeffa4963`) 이후 실질 코드가 변경되지 않았다고 확인했는데, 이는 4라운드 자신의 fix가
아직 반영되기 **전** 시점이었다. `git diff eeffa4963..HEAD -- codebase/ PROJECT.md plan/` 로
직접 대조한 결과, 그 이후 실제로 바뀐 것은 다음 2개뿐이다:

- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` — "존재 검사(`flagIdx >= 0`)
  + 순서 검사(`flagIdx < entryIdx`)" 이중 단언을 "node 인자 구간 전체(`NODE_ARGS[name]`) + 진입점"을
  통째로 접두어 비교하는 단일 단언으로 교체.
- `plan/in-progress/jest-esm-native-load.md` — 위 교체의 근거(3라운드 이력 표, 뮤테이션
  M10~M13)를 §섹션으로 추가.

이 2개가 이번 라운드에서 처음으로 검토되는 실질 표면이다. `codebase/backend/jest.config.ts`,
`package.json`(scripts), `test/jest-e2e.json`, `PROJECT.md`는 4라운드까지 결론(LOW/NONE,
INFO만 잔존)이 유지되고 있음을 재확인했다 — 새로 지적할 사항 없음(중복 서술 4곳,
`PROJECT.md` 불릿 구조 등 기존 INFO는 상태 변화 없이 그대로).

## 발견사항

- **[INFO]** `esm-native-load.spec.ts`의 "N라운드" 이력 표가 파일 안의 다른 인용과 앵커링
  방식이 다르다
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (76~84번째 줄,
    `// 1라운드 진입점이 …` / `// 3라운드 플래그 존재만 …` / `// 4라운드 플래그 순서는 …` 표)
  - 상세: 같은 파일 위쪽(24번째 줄 부근, describe 블록 헤더 주석)은 "종전에는 이 불변식을
    …우연히 지키고 있었고"라는 주장에 `(review/code/2026/09/24/14_24_10 INFO 12)`라는 구체적
    경로 anchor를 붙여 어느 세션의 어느 발견사항인지 추적 가능하게 해 뒀다. 반면 바로 아래
    "왜 문자열 몇 개를 열거하지 않고 구간을 통째로 고정하나"의 1/3/4라운드 표는 동일한 성격의
    역사적 근거인데도 anchor가 없다 — 순번만 있고 그 순번이 가리키는 리뷰 세션/커밋을 알 수
    없다. `plan/in-progress/jest-esm-native-load.md`의 대응 섹션(같은 표 + 뮤테이션 M10~M13)은
    폐기된 M5~M9에 대해서는 `review/code/2026/09/24/{15_26_17,16_02_28}` 로 anchor를 남기지만,
    1/3/4라운드 표 자체에는 똑같이 anchor가 없다. `review/code/2026/09/24/<timestamp>/` 폴더는
    이 저장소의 세션별 산출물이라 장기 보존이 보장된 문서 체계(`spec/`·`plan/`)와 달리 향후
    정리·이관 대상이 될 수 있다 — 그 경우 이 테스트 파일에 영구히 남는 "1라운드/3라운드/4라운드"
    라는 라벨이 무엇을 가리키는지 되짚을 방법이 사라진다.
  - 제안: 표 옆에 이 히스토리를 처음 기록한 plan 문서 경로(`plan/in-progress/jest-esm-native-load.md`
    §같은 스펙의 두 번째 불변식)나 관련 커밋 SHA를 한 줄 추가해, 24번째 줄의 인용과 동일한
    수준의 추적성을 갖추는 것을 고려. blocking 은 아님 — plan 문서가 이미 같은 내용을 훨씬
    상세히 보존하고 있어 실제로 추적 불가능해질 위험은 낮다.

- **[INFO]** 새 `NODE_ARGS` 맵에서 동일 플래그 문자열이 4번 반복
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (88~95번째 줄,
    `NODE_ARGS` 객체 리터럴)
  - 상세: `'--experimental-vm-modules'`가 `test`/`test:watch`/`test:cov`/`test:e2e` 4개 키에
    리터럴로 반복된다(`test:debug`는 그 값을 접두어로 포함해 5번째). 이는 검증 대상인
    `package.json`의 동일한 5중 반복(4라운드 이전부터 이미 INFO로 등재·"현 규모에서 조치
    불필요"로 defer됨)을 그대로 미러링한 것이라 새로운 종류의 결함은 아니다. 다만 상수
    (`const VM_MODULES_FLAG = '--experimental-vm-modules'`) 하나로 묶으면 이 파일 안에서도
    동일 트레이드오프를 줄일 수 있었다.
  - 제안: 없음(조치 불요) — 이미 defer된 것과 같은 클래스이고, 검증 코드가 검증 대상의 반복
    구조를 그대로 반영하는 편이 오히려 "무엇을 지키는지" 읽기 쉽게 만드는 면도 있다.

- **[INFO]** 세 번째 `it()` 블록이 약 55줄로 길다 (설정 로드 + 명단 대조 + for 루프 내 이중
  `expect`)
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:61-116`
  - 상세: 테스트 하나가 pkg 로드, `jestScripts` 필터링, 명단(census) 대조, 각 스크립트별 접두어
    비교까지 한 함수에 담겨 있다. 다만 이번 라운드가 교체한 형태는 이전(존재+순서 이중 단언)
    보다 오히려 단순해졌고, 각 단계에 그 단계가 왜 필요한지 설명하는 주석이 붙어 있어(76~87번째
    줄) 실질적으로 읽기 어렵지는 않다. 3~4라운드에 걸쳐 반복적으로 뚫린 이력이 있는 가드라
    "형태를 통째로 하나의 단언으로 고정"하는 현재 설계 자체가 분리보다 유리한 측면도 있다
    (분리하면 두 단언 사이에 다시 회귀 여지가 생긴 전례가 있음).
  - 제안: 없음(현 상태 유지 권장) — 강제 분리는 과거 실패 패턴(자리별 부분 단언)으로 되돌아갈
    위험이 있다.

## 요약

이번 라운드에서 실제로 새로 검토 대상이 된 코드는 `esm-native-load.spec.ts`의 가드 단언을
"존재+순서 이중 검사"에서 "node 인자 구간 전체 접두어 비교"로 교체한 부분과 그 근거를 기록한
plan 문서 추가분뿐이며, 나머지 6개 실질 파일은 4라운드까지의 결론(LOW/NONE)이 그대로
유지된다. 새 코드는 과거 세 라운드에 걸쳐 재발한 "자리별 부분 단언" 패턴을 "형태 전체 고정"으로
설계 자체를 바꾼 것이라 오히려 퇴행 여지를 줄였다. Critical/Warning 급 유지보수성 결함은
발견되지 않았다. 유일하게 새로 남기는 관찰은 같은 파일 안에서 역사적 근거를 인용하는 두 자리
중 한 곳(1/3/4라운드 표)만 추적 가능한 anchor가 빠져 있다는 점이며, plan 문서가 같은 내용을
상세히 보존하고 있어 실무적 위험은 낮다.

## 위험도

NONE — 새로 검토된 코드 표면은 개선(퇴행 위험 감소) 방향이며, 남은 관찰은 전부 INFO 수준이다.
