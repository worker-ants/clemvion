# 동시성(Concurrency) 리뷰

## 검토 대상 요약

이번 변경(93개 파일 목록 중)에서 실제 코드로 볼 수 있는 것은 4개뿐이다.

- `codebase/backend/jest.config.ts` — `transformIgnorePatterns` 를 수작업 ESM 허용목록에서
  기본값(`['/node_modules/']`)으로 되돌림, 주석 갱신
- `codebase/backend/package.json` — `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`
  스크립트에 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 실행 형태 도입
- `codebase/backend/test/jest-e2e.json` — 동일하게 `transformIgnorePatterns` 를 기본값으로
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` — 위 변경이 유지되는지
  지키는 신규 정적 가드 스펙 (텍스트/설정 대조, 동기 단언만 사용)

나머지(`PROJECT.md`, `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**`)는
문서·리뷰 산출물이며 실행 코드가 아니다.

## 점검 관점별 확인

- **경쟁 조건 / 데드락 / 동기화 / 스레드 안전성 / 원자성**: 애플리케이션의 공유 자원(DB
  커넥션, 락, 큐, 캐시 등)에 접근하는 런타임 코드는 이번 diff에 전혀 포함되지 않는다.
  jest 설정·npm script·테스트 러너 로딩 방식만 바뀌었다.
- **async/await**: 신규 스펙(`esm-native-load.spec.ts`)의 테스트 3개는 모두 동기 단언
  (`expect(...).toBe/toEqual`)이며 `async`/`Promise`/`await` 를 전혀 사용하지 않는다 —
  await 누락이나 미해결 Promise 우려 없음.
- **이벤트 루프**: `node --experimental-vm-modules` 플래그와 `transformIgnorePatterns` 변경은
  모듈 로더(CJS vs 네이티브 ESM) 전략 전환이지 이벤트 루프 스케줄링에 개입하지 않는다.
- **리소스 풀링(스레드 풀·커넥션 풀)**: jest 의 워커 풀 크기에 영향을 주는 `maxWorkers` 설정은
  이번 diff의 변경 대상이 아니다 — `test/jest-e2e.json` 의 `maxWorkers: 1`(e2e 직렬 실행)은
  그대로 유지되고, `jest.config.ts`(unit) 는 이전과 마찬가지로 `maxWorkers` 를 지정하지 않아
  jest 기본값(CPU 코어 기반)을 따른다. 전환된 것은 "어떻게 모듈을 로드하는가"이지 "몇 개의
  워커/커넥션을 쓰는가"가 아니다.

## 발견사항

없음.

## 요약

이번 변경은 Jest 를 `node --experimental-vm-modules` 로 띄우고 `transformIgnorePatterns` 를
기본값으로 되돌려 ESM-only 패키지(`uuid`, `@nestjs/typeorm@12` 등)를 네이티브로 로드하도록
전환한 테스트 인프라 변경이며, 신규 파일도 이를 지키는 정적(동기) 가드 스펙 하나뿐이다.
공유 자원 접근, 락, async/await 흐름, 이벤트 루프, 스레드/커넥션 풀 크기 등 동시성에 영향을
주는 애플리케이션 코드는 diff에 없다.

## 위험도

NONE
