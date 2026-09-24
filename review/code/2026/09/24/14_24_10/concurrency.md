# 동시성(Concurrency) 리뷰

## 검토 대상 요약

이번 변경은 13개 파일로 구성되나, 실제 코드 변경은 3개(`codebase/backend/jest.config.ts`,
`codebase/backend/package.json`, `codebase/backend/test/jest-e2e.json`)뿐이고 전부 Jest
테스트 러너 설정/실행 스크립트다:

- `transformIgnorePatterns` 를 수작업 ESM 패키지 허용목록에서 기본값(`['/node_modules/']`)으로
  되돌림
- `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` npm script 에
  `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 실행 형태 도입 (Jest 가
  ESM 의존성을 네이티브로 로드하도록 Node 플래그 추가)

나머지 파일(`plan/in-progress/*.md`, `review/consistency/**`)은 plan 문서와 consistency-check
산출물로, 코드가 아니다.

## 발견사항

없음. 애플리케이션의 공유 자원 접근, 락, async/await 흐름, 이벤트 루프, 스레드/커넥션 풀 등
동시성에 영향을 주는 런타임 코드는 이번 diff에 포함되지 않는다. 변경 범위는 테스트 실행 시
모듈 로더 동작(CJS transform vs 네이티브 ESM 로드)에 한정되며, 다음을 확인했다:

- `test/jest-e2e.json` 의 `maxWorkers: 1` (e2e 테스트 직렬 실행 설정)은 이번 diff의 변경
  대상이 아니다 — 그대로 유지됨.
- 단위 테스트 `jest.config.ts` 는 워커 동시성 설정(`maxWorkers`) 자체를 지정하지 않으며
  이번 diff도 이를 건드리지 않는다.
- `--experimental-vm-modules` 플래그와 `transformIgnorePatterns` 원복은 모듈이 CJS로
  변환되는지 ESM으로 네이티브 평가되는지를 바꿀 뿐, 테스트 실행의 병렬성/동기화 모델 자체는
  바꾸지 않는다.

## 요약

이번 변경은 Jest 테스트 러너의 모듈 로딩 방식(허용목록 기반 CJS transform → Node
`--experimental-vm-modules` 를 통한 ESM 네이티브 로드)을 다루는 빌드/테스트 설정 변경이며,
애플리케이션 런타임의 공유 자원·락·async 흐름·이벤트 루프·스레드/커넥션 풀과 무관하다.
동시성 관점에서 지적할 사항이 없다.

## 위험도

NONE
