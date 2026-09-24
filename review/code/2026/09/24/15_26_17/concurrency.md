# 동시성(Concurrency) 리뷰

## 발견사항

없음.

## 요약

이번 변경 셋(PROJECT.md 정책 문서 갱신, `codebase/backend/jest.config.ts`·`package.json`·`test/jest-e2e.json`,
신규 가드 스펙 `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`, 그리고 나머지
`plan/**`·`review/**` 산출물)은 전부 **jest 테스트 러너를 `--experimental-vm-modules` 로 구동해
ESM-only 의존성(예: `uuid`, `@nestjs/typeorm@12` 의 `import.meta.url`)을 네이티브로 로드하게 바꾸는
tooling/CI 변경**이다. 애플리케이션 런타임 코드(공유 자원 접근, 락, async/await 흐름, Promise 체인,
스레드/커넥션 풀 등)는 이 diff 에 전혀 포함되지 않는다.

세부 확인:
- `jest.config.ts` / `test/jest-e2e.json`: `transformIgnorePatterns` 를 손으로 유지하던 허용목록에서
  jest 기본값(`/node_modules/`)으로 되돌리는 변경. 모듈 변환 규칙일 뿐 동시성과 무관.
- `package.json` `scripts`: `jest` 실행을 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`
  로 감싸는 변경. jest 의 워커 풀 크기(`maxWorkers`)나 병렬도 설정 자체는 건드리지 않는다.
  `test:debug` 의 `--runInBand` 도 기존 그대로 유지되어 동시성 관련 동작 변화가 없다.
- 신규 `esm-native-load.spec.ts`: 세 개의 동기(sync) `it()` 블록(`uuid/package.json` 타입 확인,
  `uuidv4()` 호출, `fs.readFileSync` 로 두 jest 설정 비교)이며 async/await, Promise, 공유 가변
  상태, 락을 전혀 사용하지 않는다. 테스트 컨텍스트에서의 동기 I/O(`readFileSync`)는 이벤트 루프
  블로킹 관점에서도 문제 삼을 수준이 아니다(테스트 1회 실행, 소규모 JSON 파일).
- `--experimental-vm-modules` 플래그가 노출하는 `ExperimentalWarning` 은 jest 워커 프로세스마다
  한 줄씩 stdout 에 출력된다고 plan 문서(`jest-esm-native-load.md`)에 기록돼 있으나, 이는 각 워커가
  독립 프로세스이기 때문에 발생하는 로그 중복일 뿐이며 자원 경합·동기화 문제가 아니다.
- 나머지 `plan/in-progress/*.md`, `review/**/*.md` 파일들은 문서·리뷰 산출물이며 실행 코드가 아니다.
  이 중 `spec-draft-nullable-notation-followups.md` 에 "재진입 락 오케스트레이션" 언급이 있으나
  이는 향후 별도 작업 항목을 기록한 TODO 문구일 뿐, 이번 diff 가 그 락 코드 자체를 변경한 것은
  아니다.

동일 changeset 에 포함된 이전 라운드(`review/code/2026/09/24/14_24_10/concurrency.md`) 리뷰도
같은 결론(해당 없음)을 냈고, 본 재검토에서도 그 결론을 반증할 근거를 찾지 못했다.

## 위험도

NONE
