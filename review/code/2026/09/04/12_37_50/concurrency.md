# 동시성(Concurrency) 리뷰

## 검토 범위 메모

이번 diff(누적, `origin/main..HEAD`)에서 동시성/비동기 표면을 가진 코드는 사실상
`codebase/backend/src/common/__test-utils__/temp-fixture.ts`(신규) 하나뿐이다. 나머지
변경(Swagger DTO `@ApiProperty`/`@ApiPropertyOptional` 데코레이터 정정, `source-scan.ts` 의
`toPosixPath`/`toPosixRelative` 순수 문자열 함수, 각 repo-guard 의 경로 정규화 호출 교체,
plan/CHANGELOG/review 산출물 문서)는 전부 동기 코드이거나 실행되지 않는 문서이며 `async`/
`await`/`Promise`/타이머/워커/락 어느 것도 쓰지 않는다 — `swagger-dto-contract-guard.ts`·
`swagger-dto-contract.spec.ts` 를 포함해 `grep -n "async|await|Promise|setTimeout|Worker|lock"`
로 직접 확인했다(매치 0건).

`temp-fixture.ts`/`temp-fixture.spec.ts` 는 이 diff 안에서 이미 3라운드의 리뷰를 거쳤다
(`review/code/2026/09/04/11_02_30/side_effect.md` WARNING → `11_44_16/concurrency.md` INFO 2건
→ `12_17_50/RESOLUTION.md` W3). 아래는 그 누적 수정이 반영된 **현재 코드**를 기준으로 독립적으로
재검토한 결과다.

## 발견사항

- **[INFO]** `withFiles` 의 async 오용 감지는 콜백의 **반환값**이 thenable 인 경우만 잡는다 — 반환하지 않는 detached 비동기 부작용(예: `setTimeout`/등록만 하고 반환하지 않는 프라미스)은 여전히 감지되지 않는다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:56-69` (`withFiles` 함수 본문, `try { const result = fn(paths); if (isThenable(result)) {...} return result; } finally { fs.rmSync(dir, ...) }`)
  - 상세: `fn` 이 동기 함수이되 내부에서 `setTimeout(() => fs.readFileSync(paths['a.ts']), 0)` 처럼 콜백 완료 후에도 살아남는 비동기 작업을 예약만 하고 그 결과를 반환하지 않으면, `result`(=`fn(paths)` 의 반환값)는 thenable 이 아니므로 `isThenable(result)` 판정을 통과해 `finally` 의 `fs.rmSync(dir, { recursive: true, force: true })` 가 즉시 실행된다. 그 타이머가 나중에 발화하면 이미 지워진 tmpdir 을 조용한 `ENOENT` 로 마주친다 — 이번 diff 가 고친 레이스(콜백이 `Promise` 를 **반환**하는 경우)와 같은 클래스지만 탐지 범위 밖이다. 다만 이는 이 헬퍼의 "동기 콜백 전용" 계약의 원리적 한계이고, JSDoc(라인 32 "동기 콜백 전용이다")이 이미 이 경계를 명시하며, 현재 두 소비처(`nullable-type-lie-cast.spec.ts`, `swagger-dto-contract.spec.ts`)는 파일 읽기/문자열 매칭만 하는 순수 동기 콜백이라 실제 발현 경로가 없다. 직전 라운드(`11_44_16/concurrency.md` INFO#1)와 동일한 관찰이며, 이번 diff 에서도 여전히 미해소 상태(설계상 의도적으로 좁게 유지)다.
  - 제안: 조치 불필요 — 향후 소비처가 콜백 안에서 "반환은 동기이지만 detached 비동기 작업을 예약"하지 않는지 코드 리뷰로 확인하는 정도면 충분하다. 닫으려면 `fn` 자체를 `async` 로 확장해 `await` 하는 것이 유일한 원리적 해법이나, 그러면 "동기 전용" 계약이 사라져 지금의 설계 선택(§JSDoc 40-42행 "async 콜백이 실제로 필요해지면 그때 확장")과 충돌한다.

- **[INFO]** (검증 완료, 회귀 없음) 직전 라운드가 지적한 "dangling promise → unhandled rejection" 갭은 `result.then(undefined, () => {})` 로 이미 닫혔다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:58-63`
  - 상세: `11_44_16/concurrency.md` INFO#2 는 `isThenable(result)` 로 감지한 뒤 `throw` 만 하고 원래 `result`(pending Promise)를 아무도 구독하지 않아 콜백이 나중에 reject 하면 unhandled rejection 이 새어나갈 수 있다고 지적했다. 현재 코드는 `throw` 직전에 `result.then(undefined, () => {})` 로 no-op catch 를 부착해 그 경로를 닫았고, `temp-fixture.spec.ts` 의 "async 콜백이 실제로 reject 해도 … unhandled rejection 이 새지 않는다" 테스트(`process.on('unhandledRejection', ...)` 로 전역 누출을 직접 관측)가 이를 검증한다 — `12_17_50/RESOLUTION.md` W3 뮤테이션 검증(그 한 줄 제거 시 RED 1건, 원복 시 GREEN)으로도 확인됐다. 새로운 결함은 아니며, 이전 라운드 발견의 해소를 재확인하는 차원에서 기록한다.
  - 제안: 없음 (해소 확인).

- **[INFO]** 동일 계열 헬퍼가 `try`/`finally` 로 tmpdir 정리를 보장하는 구조 자체는 동시성 관점에서 안전 — Jest 병렬 실행과의 상호작용 확인
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:49` (`fs.mkdtempSync(path.join(os.tmpdir(), prefix))`)
  - 상세: `mkdtempSync` 는 호출마다 유일한 디렉터리를 생성하므로, Jest 가 여러 테스트 파일을 병렬 워커로 실행해도 서로 다른 `withFiles` 호출이 같은 디렉터리를 공유하거나 경쟁할 여지가 없다. 같은 파일 안의 `it()` 들은 Jest 기본 동작상 순차 실행(`.concurrent` 미사용)이라 추가 격리가 필요 없다. `temp-fixture.spec.ts` 의 `process.on('unhandledRejection', ...)`/`process.off(...)` 도 `try/finally` 로 짝을 맞춰 등록·해제하므로 같은 워커 프로세스에서 실행되는 이후 테스트에 핸들러가 누수되지 않는다.
  - 제안: 없음 (양호 확인, blocking 아님).

## 요약

이번 diff 의 실질 코드 변경은 대부분 순수 동기 로직(Swagger 데코레이터 정정, 경로 문자열
정규화, AST 기반 정적 가드)이라 공유 가변 상태·락·스레드·이벤트 루프 블로킹과 무관하다.
유일하게 비동기/동시성 표면을 가진 `temp-fixture.ts`(`withFiles`)는 이 diff 이전 3라운드
리뷰가 지적한 레이스(async 콜백 반환 시 `finally` 가 완료를 기다리지 않고 tmpdir 을 먼저
지우는 문제)를 회피가 아니라 즉시 명시적 실패로 전환했고, 그 뒤 라운드가 추가로 지적한
dangling promise → unhandled rejection 누출 경로도 no-op catch 부착으로 닫혔다 — 두 수정 모두
`temp-fixture.spec.ts` 의 전용 테스트(및 뮤테이션 검증)로 고정돼 있다. 남은 유일한 잔여
사항은 "반환하지 않는 detached 비동기 부작용은 여전히 탐지 밖" 이라는 INFO 하나로, 이는
헬퍼가 스스로 선언한 "동기 콜백 전용" 계약의 원리적 경계이고 현재 소비처 0건이라 실제
발현 경로가 없다. CRITICAL/WARNING 급 동시성 결함은 발견되지 않았다.

## 위험도

LOW

## 관측된 이상 상태 (본 리뷰와 무관, 병렬 프로세스 추정)

리뷰 종료 직전 `git status --short` 확인 중 `review/consistency/2026/09/04/11_33_21/SUMMARY.md` 가
**본 리뷰어가 건드리지 않았음에도 unstaged 상태로 수정돼 있음**을 관측했다 — 이 리뷰는 저장소
트리에 어떤 파일도 쓰지 않았고(본 리뷰 산출물 외에는 Read/Grep 만 사용), 뮤테이션 검증도 수행하지
않았다. 다른 병렬 프로세스(같은 fan-out 의 다른 리뷰어이거나 orchestrator/summary 단계)가 같은
워킹트리에 동시에 쓰고 있는 것으로 보인다 — 규약 문서가 경고한 "병렬 리뷰어가 저장소를
뮤테이션해 서로를 오염시킨다" 패턴과 일치할 수 있다. 원복은 시도하지 않았다(그 변경의 소유자가
아니므로 `git restore` 금지 원칙 적용). 다음 단계(SUMMARY 취합)에서 이 파일의 최종 상태를 다시
확인할 것을 권장한다.
