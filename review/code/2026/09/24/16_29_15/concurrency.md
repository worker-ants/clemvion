# 동시성(Concurrency) 리뷰

## 발견사항

없음.

이번 변경 집합은 다음 두 그룹으로 구성된다.

1. **jest ESM 네이티브 로드 전환** — `codebase/backend/jest.config.ts`, `codebase/backend/package.json`,
   `codebase/backend/test/jest-e2e.json`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`.
   `transformIgnorePatterns` 를 손으로 유지하던 ESM 허용목록에서 기본값(`/node_modules/`)으로
   되돌리고, `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` 다섯 npm script 모두에
   `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 접두어를 붙였다.
   새로 추가된 `esm-native-load.spec.ts` 는 (a) canary(`uuid`)가 여전히 ESM-only 인지,
   (b) 다섯 script 문자열이 플래그·진입점을 같은 순서로 갖는지, (c) e2e 설정의
   `transformIgnorePatterns` 가 기본값인지를 **정적 텍스트 대조**로만 검증한다 — 각 `it` 블록이
   동기적으로 파일을 읽고 비교할 뿐 공유 가변 상태·타이머·Promise 체인이 없다.
2. **plan/PROJECT.md/review 산출물 문서 갱신** — 순수 문서.

동시성 관점에서 검토할 실질 코드가 없다는 점을 좀 더 구체적으로 확인했다.

- `--experimental-vm-modules` 는 부모 Node 프로세스에만 넘겨지는 CLI 플래그이지만, Jest 의
  워커 풀(`jest-worker`)이 기본적으로 `child_process.fork()` 로 워커를 띄울 때 부모의
  `process.execArgv` 를 상속하므로 병렬 워커에도 동일하게 적용된다 — 이는 Jest 공식 ESM 지원
  문서가 명시하는 표준 동작이며, 이 PR 이 워커 수(`maxWorkers`)나 풀 구성 자체를 건드리지도
  않았다. 리소스 풀링 관점의 회귀가 아니다.
- `esm-native-load.spec.ts` 의 세 테스트는 서로 다른 파일(`uuid/package.json`,
  `<repo>/package.json`, `test/jest-e2e.json`)을 각자 동기 `readFileSync` 로 읽고 끝나
  경쟁 조건·락·원자성 이슈가 성립할 표면이 없다.
- 나머지 변경(PROJECT.md, plan 문서, `review/**` 산출물)은 마크다운/JSON 문서로 동시성과 무관.

## 요약

이번 diff 는 Jest 를 ESM 네이티브 로드 모드(`--experimental-vm-modules`)로 전환하는 빌드/테스트
설정 변경과 그에 따른 회귀 방지 스펙, 그리고 계획·리뷰 문서 갱신으로만 구성되어 있다. 락·뮤텍스·
공유 가변 상태·async 제어 흐름·이벤트 루프 블로킹·스레드/커넥션 풀 크기 조정 등 동시성 리뷰
대상이 되는 실질 코드 변경이 없다.

## 위험도

NONE
