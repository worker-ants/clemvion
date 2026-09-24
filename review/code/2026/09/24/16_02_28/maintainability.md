# 유지보수성(Maintainability) 리뷰

## 검토 방법

이번 changeset(origin/main 대비 57개 파일)에서 실제 코드/설정 변경은 5개뿐이다:
`PROJECT.md`, `codebase/backend/jest.config.ts`, `codebase/backend/package.json`,
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`(신규),
`codebase/backend/test/jest-e2e.json`. 이 5개는 이전 두 라운드
(`review/code/2026/09/24/14_24_10`, `review/code/2026/09/24/15_26_17`)에서 이미
`maintainability` 관점으로 리뷰됐고, 이번 라운드의 diff 내용은 그때와 **동일**하다
(`git diff origin/main...HEAD` 로 직접 대조 — 이번 라운드에서 추가로 바뀐 것은 없다).
실제 파일을 다시 열어 이전 WARNING 2건(`test:debug` 스크립트의 `node_modules/.bin/jest`
잔존, `jest.config.ts` 상단 docstring 의 stale 서술)이 여전히 조치된 상태로 남아 있음을
재확인했다 — 재발 없음.

새로 추가/수정된 것은 두 plan 문서다: `plan/in-progress/nestjs-v12-coordinated-upgrade.md`
(신규, 73줄), `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 백로그 2건
추가(53줄). 나머지(`plan/in-progress/jest-esm-native-load.md`, `review/code/2026/09/24/{14_24_10,15_26_17}/**`,
`review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)는 plan 본문 또는 이전 라운드
산출물의 사후 커밋으로, 함수·클래스·분기 등 본 관점(가독성/네이밍/함수 길이/중첩/매직넘버/
중복/복잡도)이 겨냥하는 로직 코드가 아니다.

## 발견사항

- **[INFO]** 동일 메커니즘 설명이 4곳에 각기 다른 상세도로 중복 서술됨
  - 위치: `PROJECT.md`(버전·도구 정책, "테스트 프레임워크 이원화" 항목) ·
    `codebase/backend/jest.config.ts:19-40`(`transformIgnorePatterns` 주석) ·
    `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:6-23`(파일 헤더 주석) ·
    `plan/in-progress/jest-esm-native-load.md`(§A~§C)
  - 상세: "손으로 유지하던 ESM 허용목록을 걷고 `--experimental-vm-modules` 로 네이티브 로드한다",
    "게이트는 Node 버전이 아니라 그 플래그다", "두 변경(플래그+허용목록 제거)은 한 쌍이라
    하나만 되돌리면 깨진다" 는 같은 세 가지 사실이 네 문서에 걸쳐 반복 서술된다. 상세도는
    문서마다 다르지만(예: 노드 버전 관련 세부 실측은 `jest.config.ts` 주석에만, 두 방향
    에러 문구는 spec 헤더에만) 핵심 불변식 자체는 동일하다. 이 메커니즘이 나중에 바뀌면
    (예: Node 가 해당 플래그를 표준화해 제거) 네 곳을 전부 찾아 갱신해야 하는데, 그것을
    강제하는 장치가 없다 — `jest.config.ts` 자신의 docstring 이 "JSON 은 주석을 못 담으니
    근거를 여기 옮겨 적는다"며 사실상 단일 진실 지점을 자처하고 있으므로, 다른 문서들은
    그 파일을 가리키는 참조로 축약할 여지가 있다. 다만 이전 라운드 documentation 리뷰가
    `PROJECT.md → esm-native-load.spec.ts` 참조 자체는 끊기지 않았음을 이미 확인했고, 이
    관찰은 그 연장선의 유지보수 비용 관찰이지 새 결함은 아니다.
  - 제안: 조치 불필요(blocking 아님). 다음에 이 메커니즘을 수정할 일이 생기면, 네 곳을 동시에
    갱신하는 대신 `jest.config.ts` 를 SoT 로 두고 나머지 문서는 "근거는 `jest.config.ts` 참조"
    형태로 축약하는 리팩터를 고려.

- **[INFO]** `PROJECT.md` 정책 항목이 정책 문장 + 개별 사건 서술 + 참조를 한 불릿에 계속 이어붙이는 구조
  - 위치: `PROJECT.md`(버전·도구 정책, "테스트 프레임워크 이원화 (정책)" 항목)
  - 상세: 원래 정책 문장("packages/* 의 vitest 이행은 … 트리거 전까지 보류한다") 뒤에 굵게 강조된
    개별 사건 서술("그 트리거는 2026-09-24 backend 에서 한 번 발화했고 …")이 같은 문장에
    이어붙었다. 정책 자체와 그 정책이 실제로 발동한 사례 로그가 분리되지 않고 한 문단·한
    불릿에 누적되는 구조라, 같은 트리거가 다시 발화하면(예: packages/* 에서도 벽에 부딪히면)
    같은 방식으로 계속 이어붙여질 가능성이 있다 — 정책 문서가 changelog 처럼 자라는 형태다.
  - 제안: 조치 불필요(blocking 아님). 유사 사례가 한 번 더 쌓이면 정책 문장은 현재 상태만
    유지하고, 발동 이력은 별도 각주나 `CHANGELOG.md`/이력 섹션으로 분리하는 편이 정책 문서의
    스캔 가능성을 지킨다.

- **[INFO]** 백로그 파일이 이번 PR로 5,100줄을 넘는 단일 누적 파일로 계속 확장
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(이번 PR +53줄, 현재
    5,133줄+)
  - 상세: 이 파일은 이 PR 이 만든 문제가 아니라 기존 관행(체크리스트 항목을 계속 append)이지만,
    단일 마크다운 파일이 이 규모로 계속 자라면 특정 항목을 찾거나 리뷰할 때 탐색 비용이
    커진다. 이번에 추가된 두 항목 자체는 각각 잘 구조화돼 있다(실측 표, 처방 후보 비교 등
    파일의 기존 스타일과 일관).
  - 제안: 지금 당장 조치 불필요. 파일 크기가 계속 문제가 되면(예: grep/리뷰 시간 증가) 완료된
    항목을 별도 아카이브로 덜어내는 정리 작업을 고려할 시점.

## 재확인(이전 라운드 대비 재발 없음)

- `codebase/backend/package.json` 5개 `test*` 스크립트가 전부 `./node_modules/jest/bin/jest.js`
  형태로 통일돼 있다(14_24_10 WARNING "test:debug 잔존" 조치 확인, 직접 파일 열람).
- `codebase/backend/jest.config.ts:3-11` 상단 docstring 이 "허용목록이 사라졌고 지금 무엇을
  주석해야 하는지"로 갱신돼 현재 파일 내용과 일치(14_24_10 WARNING 조치 확인).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 pathspec 열거가 8개→12개
  전체로 갱신돼 "뿐이다" 주장이 이제 실제와 일치한다(15_26_17 documentation WARNING 조치
  확인). 이 항목은 유지보수성보다 문서 정확성 관점이라 여기서는 재확인만 하고 별도로 카운트
  하지 않는다.

## 요약

실질 코드/설정 변경 5개 파일은 이전 두 라운드에서 이미 상세히 검토됐고 이번 라운드에서
diff 내용에 변화가 없어(직접 대조 확인) 새로운 코드 표면이 없다 — 로직 코드(함수·클래스·분기)를
사실상 포함하지 않는 tooling 변경이라 가독성·네이밍·함수 길이·중첩 깊이·순환 복잡도 관점의
결함은 여전히 발견되지 않는다. 이전 라운드가 잡은 WARNING 2건은 실제 파일을 열어 재확인한
결과 모두 조치된 채 유지되고 있다. 이번 라운드에서 새로 살펴본 것은 plan 문서 2건(신규
`nestjs-v12-coordinated-upgrade.md`, 백로그 추가분)뿐이며, 둘 다 기존 문서 스타일과 일관되고
구조가 명확하다. 남은 관찰은 전부 INFO로 — (1) ESM 네이티브 로드 메커니즘 설명이 4개 문서에
중복 서술돼 있어 향후 변경 시 다중 갱신 부담이 있다는 점, (2) `PROJECT.md` 정책 항목이 정책과
사건 로그를 한 불릿에 계속 이어붙이는 구조라는 점, (3) 누적 백로그 파일이 5,100줄을 넘어
계속 커지고 있다는 점이다. 셋 다 즉각 조치가 필요한 결함이 아니라 향후 규모가 더 커질 때
재검토할 관찰이다. Critical/Warning 급 유지보수성 결함은 발견되지 않았다.

## 위험도

LOW
