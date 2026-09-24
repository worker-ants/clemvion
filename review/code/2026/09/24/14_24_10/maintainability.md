# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `package.json` 의 5개 test 스크립트가 jest 실행 경로를 두 가지 다른 방식으로 표기 — 일관성 결여
  - 위치: `codebase/backend/package.json:22-26` (`scripts` 블록, `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`)
  - 상세: `test`(22)·`test:watch`(23)·`test:cov`(24)·`test:e2e`(26) 는 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 jest 진입점을 **직접 경로**로 호출하는 반면, `test:debug`(25) 만 `node_modules/.bin/jest` (bin 심볼릭 링크)를 그대로 쓴다. 둘은 (대개) 같은 파일로 귀결되긴 하지만, 다섯 줄 중 한 줄만 다른 표기를 쓰는 이유를 설명하는 주석이 없다. `jest.config.ts` 는 이번 PR 에서 "손으로 유지하던 목록이 두 곳(unit/e2e)에서 이미 어긋나 있었다"는 것을 정확히 문제로 지적하고 고쳤는데(`plan/in-progress/jest-esm-native-load.md` D절), 같은 PR 이 package.json 안에서는 5곳 중 1곳만 다른 표기로 남겨 유사한 종류의 사소한 드리프트를 새로 만들었다. 다음 사람이 "왜 test:debug 만 다르지" 의문 없이 임의로 통일(또는 반대로 나머지 4개를 `.bin/jest` 로 되돌림)하다 `-r` 훅 순서를 깨뜨릴 여지가 있다.
  - 제안: 5개 스크립트 모두 같은 표기(`./node_modules/jest/bin/jest.js` 권장 — 나머지 4개와 맞춤)로 통일하거나, `test:debug` 만 다른 이유(예: `-r` 플래그와의 결합 순서 제약)가 있다면 그 이유를 스크립트 옆 또는 plan 문서에 한 줄 남길 것.

- **[INFO]** `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 접두어가 4개 스크립트에 그대로 반복
  - 위치: `codebase/backend/package.json:22-24,26`
  - 상세: `test`·`test:watch`·`test:cov`·`test:e2e` 네 줄이 동일한 15단어 접두어를 문자 그대로 반복한다. `package.json` scripts 필드의 관용적 패턴이라 심각한 문제는 아니지만, jest 바이너리 경로나 플래그가 바뀌면 4곳(사실상 5곳, WARNING 항목의 `test:debug` 포함)을 동시에 고쳐야 한다.
  - 제안: 현재 형태를 유지해도 무방하나, 향후 이 접두어를 변경할 때는 5개 스크립트 전부(특히 표기가 다른 `test:debug` 포함)를 함께 확인할 것.

- **[INFO]** `jest.config.ts` 의 신규 주석(약 22줄)이 `plan/in-progress/jest-esm-native-load.md` 의 서사(허용목록 역사·게이트 정체·두 변경의 페어링·otplib/uuid 사례)와 상당 부분 중복
  - 위치: `codebase/backend/jest.config.ts:17-38` (신규 주석 블록) vs `plan/in-progress/jest-esm-native-load.md` §A~C
  - 상세: 파일 상단 docstring(`jest.config.ts:3-9`)이 "JSON 은 주석을 못 담으니 여기 옮겨 적는다"고 이미 밝히고 있어 의도된 선택이지만, 결과적으로 같은 근거(왜 기본값으로 돌아갔는지, 두 변경이 왜 쌍인지)가 코드 주석과 plan 문서 두 곳에 독립적으로 존재한다. 이 PR 이 지적한 원래 문제(단위/e2e 두 곳의 허용목록이 이미 어긋나 있었다)와 같은 종류의 리스크 — 한쪽만 갱신되고 다른 쪽이 stale 해질 여지 — 가 코드 주석 vs plan 문서 사이에도 남는다.
  - 제안: 코드 주석은 "무엇을·왜"의 핵심 결론(플래그가 게이트라는 것, 두 변경이 쌍이라는 것)만 간결히 유지하고, 실측 표·시행착오 서사는 plan 문서를 단일 진실로 참조하는 방식도 고려할 수 있음. 다만 plan 이 `complete/`로 이동·archival 될 수 있음을 감안하면 현재처럼 코드에도 핵심 근거를 남기는 것 자체는 합리적 트레이드오프임 — 낮은 우선순위.

## 긍정적으로 눈에 띈 점 (참고)

- `transformIgnorePatterns` 가 손으로 유지하던 복잡한 lookahead 정규식(`node_modules/(?!(?:\.pnpm/[^/]+/node_modules/)?(?:uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble)/)`)에서 표준 기본값(`['/node_modules/']`)으로 단순화되어 가독성이 크게 개선됨 — 매직 문자열/정규식 유지보수 부담이 사라짐.
- `codebase/backend/test/jest-e2e.json` 도 동일 원칙으로 함께 정리되어 unit/e2e 두 설정이 다시 일치하게 됨.
- 변경 배경·시행착오·실측이 `plan/in-progress/jest-esm-native-load.md` 에 상세히 기록되어 있어, 향후 이 설정을 다시 건드릴 사람이 "왜 이렇게 되어 있는지" 재추적할 필요가 없음.

## 요약

이번 변경은 손으로 유지하던 ESM 허용목록 정규식을 제거하고 jest 를 `--experimental-vm-modules` 로 네이티브 ESM 로딩하도록 전환한 인프라/설정 변경으로, 실제 로직 코드(함수·클래스)는 포함하지 않는다. 설정값 자체는 복잡한 정규식에서 표준 기본값으로 단순화되어 가독성이 개선되었고 근거 문서화도 충실하다. 다만 `package.json` 의 5개 test 스크립트 중 `test:debug` 하나만 jest 호출 경로 표기가 달라 일관성이 약간 깨졌고(WARNING), 이 표기가 나머지 4곳에서 반복되는 점, 그리고 코드 주석과 plan 문서 사이 근거 서사가 중복되는 점은 낮은 우선순위의 개선 여지(INFO)로 남는다. 전반적으로 유지보수성 관점에서 이번 변경은 개선(단순화·문서화)이며 새로 도입된 리스크는 경미하다.

## 위험도

LOW
