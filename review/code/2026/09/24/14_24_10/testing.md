# 테스트(Testing) 리뷰 — jest ESM 네이티브 로드 전환

## 검증 방법

이 변경은 소스 로직이 아니라 jest 설정/스크립트만 바꾸므로, 저장소를 뮤테이션하지 않고 다양한
`node` 커맨드라인 변형만으로 정적 리뷰 + 독립 재현을 병행했다(트리 변경 없음, 종료 시
`git status --short` 로 확인 완료 — untracked review 산출물 2개만 존재, 내가 만든 변경 없음).

- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --testPathPatterns='totp.service.spec.ts'`
  → **PASS (13/13)**. plan 의 §C 주장을 독립 재현.
- 같은 커맨드에서 `--experimental-vm-modules` 만 제거 → **FAIL**,
  `Must use import to load ES Module: …/@scure/base@2.2.0/index.js` (otplib → @otplib/plugin-base32-scure
  → @scure/base 경유). plan §D "판별 실험"(플래그만 빼면 RED)과 정확히 일치하는 실패 모드를 독립 재현.
- `node -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest …` (test:debug 가 쓰는 조합,
  `--inspect-brk` 유무 무관) → **SyntaxError: missing ) after argument list** (`node_modules/.bin/jest:2`,
  pnpm 의 POSIX shell shim을 ts-node 의 `.js` 확장자 훅이 JS로 파싱하려다 실패). diff 이전 커맨드
  (`--experimental-vm-modules` 없이 동일 조합)로도 **동일하게 재현** — 이 PR 이 만든 결함이 아니라
  **사전부터 깨져 있던 스크립트**임을 확인.

## 발견사항

- **[WARNING]** `test:debug` 스크립트가 PR 이전부터 실행 자체가 불가능한데, 이 PR 의 검증 절차가 그것을 못 잡는다
  - 위치: `codebase/backend/package.json:25` (`"test:debug": "node --experimental-vm-modules --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand"`)
  - 상세: 독립 재현 결과 `node -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest …` 조합은 `--experimental-vm-modules`·`--inspect-brk` 유무와 무관하게 항상 `SyntaxError: missing ) after argument list`(`node_modules/.bin/jest:2`)로 죽는다 — pnpm 이 생성하는 `node_modules/.bin/jest` 는 확장자 없는 POSIX shell shim(`#!/bin/sh` 시작)인데, `ts-node/register` 가 등록한 `.js` require 훅이 이를 JS 로 컴파일하려다 실패한다. 같은 조합을 diff **이전** 커맨드(`node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand`)로도 그대로 재현했으므로 **이 PR 이 만든 결함이 아니라 사전부터 깨져 있던 경로**다. 다만 이 PR 은 `test:debug` 를 "구현 — script 5곳" 에 포함해 손댔고, plan 의 TEST WORKFLOW 검증(lint/unit/build/e2e)은 `test`·`test:cov`·`test:e2e` 만 실행하므로 `test:debug`(및 `test:watch`)는 이번에도 어떤 자동 검증도 통과하지 못한 채 "완료"로 체크됐다.
  - 제안: 정확한 원인 규명·수정은 이 PR 스코프 밖(사전 결함)이지만, 최소한 plan 체크리스트에 "test:debug 는 검증 대상 아님(사전 결함, 별도 이슈)" 을 명시해 다음 사람이 "5곳 모두 검증됨" 으로 오독하지 않게 할 것. 근본 수정 시에는 다른 4개 스크립트처럼 `./node_modules/jest/bin/jest.js` 를 직접 가리키는 편이 이 shim 파싱 버그 자체를 없앤다.

- **[INFO]** "두 변경은 한 쌍" 불변식을 지키는 전용 회귀 테스트가 없다 — 기존 spec 들의 우연한 커버리지에 의존
  - 위치: `codebase/backend/jest.config.ts:17-39`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: plan(`plan/in-progress/jest-esm-native-load.md` §B·§D "판별 실험")이 주장하는 핵심 불변식 — "`--experimental-vm-modules` 플래그와 기본 `transformIgnorePatterns` 는 반드시 함께 가야 한다" — 을 자동으로 재확인하는 전용 테스트나 CI 체크는 없다. 대신 `uuid`(`http-exception.filter.ts`, `auth.service.ts`, `workspaces.service.ts`, `knowledge-base.service.ts`)·`otplib`(`totp.service.ts`)·`p-limit`(`execution-engine.service.ts` 등)를 이미 쓰는 **기존 비즈니스 스펙**들이 이 불변식을 우연히 검증하는 구조다. 독립 재현으로 이 커버리지가 실제로 즉각적이고 명확함을 확인했다(플래그 제거 시 `totp.service.spec.ts` 가 0.4초 만에 `Must use import to load ES Module` 로 실패, 원인 파일까지 스택트레이스에 명시). 현재는 커버리지가 넓어 위험이 낮지만, 이 서비스들이 리팩터로 해당 ESM 패키지 사용을 동시에 제거하면 불변식이 조용히 무보호 상태가 될 수 있다.
  - 제안: 우연한 커버리지에 기대는 대신, 이 설정 자체를 검증하는 최소 smoke 성격의 테스트(예: 알려진 ESM-only 패키지 하나를 명시적으로 import 해 로드되는지만 확인)를 추가하면 "의도된 회귀 테스트"로 격상된다.

- **[INFO]** jest 실행 커맨드 문자열이 5개 스크립트에 그대로 중복
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`(`test:debug` 는 변형)가 다섯 곳에 하드코딩돼 있다. 이번 PR 자체가 "플래그↔허용목록 제거는 한 쌍인데 하나만 바꾸면 깨진다"는 교훈에서 나왔는데, 향후 이 플래그를 변경/제거할 때도 다섯 곳 중 일부만 고치면 같은 클래스의 결함이 재발할 수 있다.
  - 제안: 공용 셸 스크립트나 npm `pretest`/헬퍼로 묶어 단일 지점화하는 것을 고려. 우선순위는 낮음(현재 다섯 곳 모두 정합됨을 확인).

- **[INFO]** (검증 결과 — 긍정적) plan 이 기록한 판별 실험을 독립 재현해 일치함을 확인
  - 위치: `plan/in-progress/jest-esm-native-load.md:92-101` (판별 실험 표), `codebase/backend/jest.config.ts:39`
  - 상세: 위 "검증 방법" 절 참고. plan 이 주장한 두 방향(플래그+기본목록=PASS, 플래그 제거=RED) 모두 독립적으로 재현되어 신뢰도가 높다. 회귀 테스트 관점에서 이 변경의 핵심 리스크(설정 페어링이 깨지는 것)는 잘 방증돼 있다.

## 요약

순수 jest 설정/스크립트 변경(신규 소스 로직 없음)으로, 테스트 관점에서 이례적으로 꼼꼼하게 검증됐다 — plan 문서가 "플래그만 빼면 RED" 라는 판별 실험까지 실측해 기록했고, 이번 리뷰에서 그 주장(정방향 PASS·역방향 즉시 FAIL)을 독립적으로 재현해 확인했다. 남은 갭은 두 가지다: (1) `test:debug` 스크립트가 이 PR 과 무관하게 사전부터 깨져 있는데(pnpm bin shim 을 `ts-node/register` 가 JS 로 파싱 시도 → SyntaxError, diff 이전 커맨드로도 동일 재현) 이 PR 의 TEST WORKFLOW 검증 범위(lint/unit/build/e2e)가 그것을 포함하지 않아 "구현 완료" 체크리스트가 실제로는 검증 안 된 스크립트를 포함한다는 착시를 준다. (2) 이 변경이 지키려는 핵심 불변식(플래그+기본 transformIgnorePatterns 페어링)을 전용으로 지키는 자동 테스트는 없고, 현재는 `uuid`/`otplib`/`p-limit` 를 쓰는 폭넓은 기존 스펙들이 우연히 그 역할을 한다 — 지금은 안전하지만 의도된 커버리지로 격상하는 편이 더 견고하다. 두 항목 모두 이 diff 를 되돌릴 만한 결함은 아니다.

## 위험도
LOW
