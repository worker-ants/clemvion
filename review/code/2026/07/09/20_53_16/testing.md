### 발견사항

- **[INFO]** self-test 가 파일 스캔 파이프라인 전체(오프셋/상대경로 포맷팅)는 여전히 검증하지 않음
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` — `describe("검출 로직 true/false positives")` 블록
  - 상세: 이번 커밋은 `subGlobalTimeoutsInLine(line, global)` 단일 헬퍼로 판정 로직(정규식 매칭 + 임계값 비교)을 프로덕션(`findSubGlobalTimeouts`)과 self-test 가 공유하도록 정리해 W1(로직 이중 구현 drift)을 실질적으로 해소했다. 다만 self-test 는 여전히 `subGlobalTimeoutsInLine` 단위만 직접 호출해 검증하며, `findSubGlobalTimeouts`/`collectE2eFiles` 가 담당하는 파일 트리 순회·`path.relative` 오프셋/라인번호 포맷팅 경로는 실제 `e2e/**` 트리(위반 0건 상태)를 통해서만 간접 실행된다. 해당 포맷팅에 회귀(예: 라인 번호 off-by-one, 상대경로 오류)가 생겨도 실 위반이 없는 한 `toEqual([])` 로 여전히 통과하므로 이 경로는 사실상 미검증 상태로 남는다. 이는 직전 리뷰(WARNING 1/INFO 1)에서도 지적됐고 RESOLUTION.md 가 "여력이 되면 fixture 기반 e2e self-test 추가"로 명시적으로 non-blocking 보류한 항목과 동일 — 이번 커밋 범위에서 신규 회귀는 아님.
  - 제안: 우선순위 낮음. 필요 시 `fs.mkdtempSync` 로 임시 e2e 트리를 만들어 `findSubGlobalTimeouts`/`collectE2eFiles` 전체 파이프라인(오프셋 포맷 포함)을 검증하는 별도 fixture 테스트를 추가하면 이 블라인드스팟이 닫힌다.

- **[INFO]** 주석·멀티라인·비정형 포맷 오탐/미탐 케이스는 self-test 미보강 상태 유지
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` — `it.each` 검출/통과 테이블
  - 상세: `TIMEOUT_LITERAL` 정규식의 word-boundary 부재(W3)와 주석 내 `timeout: N`, `timeout : N`(콜론 앞 공백), 멀티라인 포맷 미탐 케이스는 이번 커밋에서도 self-test 테이블에 추가되지 않았다. 팀 결정(RESOLUTION.md W3·INFO 2)대로 "과탐이 CI 차단 목적상 미탐보다 안전"이라는 근거는 타당하고, 현재 `e2e/**` 전수 위반 0건이므로 실질 리스크는 낮다. 새 회귀는 아니며 의도적 보류.
  - 제안: 조치 불필요. 실제 오탐 사례가 나오면 그때 `it.each` 통과 테이블에 케이스 추가.

- **[INFO]** 리팩터 검증 재현
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts`
  - 상세: 직접 `pnpm vitest run` 재실행 결과 11/11 통과 확인, `playwright.config.ts`의 `expect.timeout`이 실제 10_000이라 `GLOBAL >= 10_000` 어설션과 정합. 메인 `it()` 타이틀에 `${GLOBAL}` 값이 실제 보간되는지(W2 수정)도 diff 상 확인됐고, 이 타이틀 문자열을 참조하는 다른 코드/스냅샷은 저장소 내 존재하지 않아 회귀 위험 없음.
  - 제안: 없음 (확인용 기록).

### 요약

이번 diff는 직전 리뷰(session 20_26_00)의 WARNING 1(self-test·프로덕션 판정 로직 이중 구현으로 인한 drift 위험)과 WARNING 2(타이틀 보간 오도 코드)를 `subGlobalTimeoutsInLine(line, global)` 단일 헬퍼 추출로 정확히 해소한 순수 테스트 리팩터다. 실제로 11/11 테스트가 통과하고, 공유 헬퍼가 고정된 기대값(`[5000]`, `[9999]` 등)과 비교되므로 이제 프로덕션 로직 회귀가 self-test 에서도 감지된다 — Warning 1의 핵심 우려가 근본적으로 해소됐다. 남은 갭(파일 스캔 파이프라인 전체 미검증, 주석/비정형 포맷 미탐 케이스)은 새로 도입된 문제가 아니라 팀이 이미 근거를 갖고 non-blocking 으로 보류한 항목이 그대로 남은 것이며, RESOLUTION.md 의 판단(과탐 > 미탐이 CI 가드 목적상 안전)에 동의한다. 테스트 격리·가독성·회귀 안전성 모두 양호하며 추가 조치 없이도 머지 가능한 수준이다.

### 위험도
LOW