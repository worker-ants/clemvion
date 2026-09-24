# 동시성(Concurrency) 리뷰

## 발견사항

해당 없음.

이번 변경은 backend Jest 테스트 러너의 ESM 로딩 방식(`--experimental-vm-modules` 플래그 도입,
`transformIgnorePatterns` 손-유지 allowlist 제거)과 그에 수반되는 `package.json` test 스크립트,
신규 가드 스펙(`esm-native-load.spec.ts`), `PROJECT.md`/plan 문서 갱신, 그리고 이전 라운드
리뷰 산출물(`review/**`) 커밋으로 구성된다. 다음을 확인했다:

- `codebase/backend/jest.config.ts`, `codebase/backend/test/jest-e2e.json`: 순수 설정값
  (`transformIgnorePatterns`) 변경. 런타임 공유 자원·락·비동기 흐름과 무관하다.
- `codebase/backend/package.json`: npm script 문자열에 `node --experimental-vm-modules` 접두어
  추가. 프로세스 실행 커맨드라인 변경일 뿐 애플리케이션 코드의 동시성 동작에는 영향이 없다.
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`: 신규 테스트는 모두
  동기 API(`createRequire`, `fs.readFileSync`, `JSON.parse`)만 사용하고 공유 가변 상태·전역
  변수·비동기 경합 지점이 없다. `it` 블록 간 공유 자원도 없어 Jest 워커 병렬 실행과도 안전하다.
- `PROJECT.md`, `plan/in-progress/*.md`, `review/**` 문서 변경: 전부 문서/보고서 텍스트이며
  실행되는 동시성 코드가 아니다.

Jest 자체의 워커 풀(`jest-worker`)이나 `maxWorkers` 설정에 대한 변경은 없다(리소스 풀링 관점 —
점검 관점 8 — 대상 없음). `--experimental-vm-modules`가 Jest의 모듈 로딩 내부(예: VM 컨텍스트
간 ESM 평가)에 미치는 영향은 Jest/Node 런타임 내부 구현의 문제이며, 이 diff가 그 내부 동작을
직접 제어하거나 변경하지 않는다.

리뷰 대상 코드에 뮤테이션을 가할 필요가 없었다(경합·락·비동기 로직 자체가 없음). 저장소 트리에
어떤 파일도 쓰거나 고치지 않았다 — `git status --short` 로 별도 확인할 변경 없음.

## 요약

이번 diff는 Jest 테스트 실행 방식(ESM 네이티브 로딩) 및 관련 설정/문서 변경으로, 동시성·병렬
처리와 관계된 애플리케이션 코드(공유 자원 접근, 락, async/await 흐름, 스레드/워커 풀 관리 등)가
포함되어 있지 않다. 신규 테스트 스펙도 동기 I/O만 사용해 스레드 안전성 문제를 일으킬 여지가 없다.

## 위험도
NONE
