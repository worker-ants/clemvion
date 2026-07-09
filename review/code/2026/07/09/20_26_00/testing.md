### 발견사항

- **[INFO]** 텍스트 스캔 기반 가드의 주석/문자열 오탐(false-positive) 가능성 미검증
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` `findSubGlobalTimeouts()` (라인 62-77, prompt 기준 `#L1929-1943`)
  - 상세: `findSubGlobalTimeouts`는 파일을 라인 단위 원문 텍스트로 스캔해 `timeout:\s*(\d[\d_]*)`를 찾는다. 코드가 아니라 주석(`// timeout: 3000 은 쓰지 말 것`)이나 mock 응답 바디 문자열(`JSON.stringify({ timeout: 30 })`) 안에 우연히 `timeout: N`(N<전역)이 등장해도 offender 로 오판되어 CI 를 차단할 수 있다. 이 케이스는 self-test(`검출 로직 true/false positives`)에 포함되어 있지 않다.
  - 제안: 최소한 "주석 안 timeout 리터럴은 무시" 케이스를 self-test에 추가하거나, 정규식을 코드 리터럴 컨텍스트(`{ timeout: N }` 형태)로 좁혀 오탐 범위를 문서화한다. 현재는 이런 오탐이 실제로 발생하면 무관한 spec 수정이 CI 를 막는 형태로 드러날 것이라 즉시 진단 가능하긴 하다.

- **[INFO]** 멀티라인 포맷의 `timeout:` 값은 탐지되지 않음 (false-negative) — 미검증
  - 위치: 동일 파일, `findSubGlobalTimeouts` 의 `lines.forEach` + 라인별 `matchAll`
  - 상세: 파일을 `\n` 기준으로 먼저 split 한 뒤 라인별로 정규식을 적용하므로, `timeout:` 키와 숫자 리터럴이 서로 다른 줄에 걸쳐 있으면(prettier 가 강제로 한 줄에 붙이지 않는 한) 탐지를 놓친다. 현재 리포의 프리티어 컨벤션상 발생 가능성은 낮지만, 이 경계 케이스에 대한 self-test 는 없다.
  - 제안: 우선순위 낮음. 필요 시 전체 파일 텍스트에서 개행 제거 없이 정규식을 파일 전체 문자열에 적용(단, 라인 번호 계산 로직 보강)하는 방식으로 강화 가능.

- **[INFO]** self-test(`검출 로직 true/false positives`)가 실제 프로덕션 파이프라인 함수(`collectE2eFiles`/`findSubGlobalTimeouts`)를 통과하지 않고, 내부에서 재구현한 `scanLine` 헬퍼(정규식·`toNumber`는 실제 모듈 상수 재사용하지만 파일 순회·오프셋 포맷팅 로직은 재현 안 함)만 검증
  - 위치: 동일 파일 라인 ~93-121 (`describe("검출 로직 true/false positives")`)
  - 상세: 메인 assertion(`expect(findSubGlobalTimeouts(GLOBAL)).toEqual([])`)은 "현재 저장소에 위반 0건"이라는 사실만 확인할 뿐, `findSubGlobalTimeouts`/`collectE2eFiles`의 파일 탐색·경로 조합 로직 자체가 옳게 동작하는지는 합성 fixture로 검증되지 않는다. `collectE2eFiles`의 확장자 필터나 `path.relative` 계산에 버그가 있어도 (우연히) 현재 트리에서는 여전히 빈 배열을 반환해 그린으로 통과할 수 있다 — 이는 이 프로젝트가 반복적으로 겪어온 "가드가 조용히 fail-open" 패턴(`가드가 fail-open 하지 않는다` 테스트가 이미 이 위험을 부분적으로 인지하고 있음)과 같은 종류의 갭이다.
  - 제안: 임시 디렉토리(`fs.mkdtempSync`)에 최소 e2e 트리 + playwright.config stub 을 만들어 `collectE2eFiles`/`findSubGlobalTimeouts` 전체 경로를 한 번은 end-to-end 로 실제 위반 파일을 검출하는 테스트를 추가하면 이 갭이 닫힌다. 다만 현재도 `it.each` self-test 가 정규식 핵심 로직은 충분히 커버하므로 위험도는 낮음(INFO).

- **[INFO]** `PROJECT.md`의 신규 timeout 컨벤션 문장이 언급하는 가드가 §변경 유형→갱신 위치 매핑 표(자동 가드 목록)에는 추가되지 않음
  - 위치: `PROJECT.md` §e2e 테스트 작성 가이드 신규 bullet, §자동 가드(build-time 차단) 목록
  - 상세: 신규 unit 가드(`e2e-no-sub-global-timeout.test.ts`)는 e2e 작성 패턴 절 본문에서만 언급되고, 같은 문서 하단 "자동 가드(build-time 차단)" 목록(다른 registry/parity 가드들이 나열된 곳)에는 등록되지 않았다. `test_doc_sync_matrix.py`는 통과하지만(§변경 유형→갱신 위치 매핑 표만 검증 대상), 향후 가드 인벤토리를 한눈에 보려는 목적상 일관성이 약간 떨어진다.
  - 제안: 사소한 문서 일관성 이슈이며 차단 사유는 아님.

### 검증 수행 내역

- 실제 `pnpm/npx jest execution-engine.service.spec.ts`(파일 전체) 실행 → **378/378 통과**, `reentryWorkflowInput` describe 만 타겟 실행해도 통과 확인. `svcMetrics`가 해당 describe 의 `beforeEach`에서 실제로 할당되는 유효한 인스턴스임을 grep 으로 확인(`let svcMetrics: ExecutionEngineService;` / `svcMetrics = modRef.get(...)`) — 이는 진짜 pre-existing `ReferenceError` 버그(다른 최상위 describe 스코프의 `service`를 참조)를 고치는 정당한 회귀 수정이며, 이 브랜치 본 작업(e2e timeout 가드)과 무관하지만 TEST WORKFLOW 를 막던 결함이라 함께 처리한 것으로 커밋 메시지에도 명확히 근거가 남아있다.
- 실제 `npx vitest run src/__tests__/e2e-no-sub-global-timeout.test.ts` 실행 → **11/11 통과**. 현재 `e2e/**`(28건의 `timeout:` 사용처)에 위반 0건임도 grep 으로 직접 확인.
- `python3 .claude/tests/test_doc_sync_matrix.py` 실행 → 통과 (PROJECT.md 변경이 매트릭스 정합성을 깨지 않음).
- `plan/in-progress/e2e-retry-visibility-followup.md` 변경은 완료 표시(체크박스/✅)와 실제 코드 산출물(신규 가드 파일)이 일치 — plan 체크박스가 실제 상태를 정확히 반영.

### 요약

핵심 신규 산출물인 `e2e-no-sub-global-timeout.test.ts` 가드는 실제로 실행·통과하며, 경계값(9_999/10_000/15_000)·명명 상수·무관 API(`waitForTimeout`)·무관 숫자 리터럴을 구분하는 self-test 세트로 "탐지 로직 자체가 무력화되는" 흔한 실패 모드를 어느 정도 방어했고, `readGlobalExpectTimeout`이 파싱 실패 시 throw(fail-closed)하도록 설계되어 있어 견고하다. 다만 라인 단위 텍스트 스캔이라는 구현 특성상 주석/문자열 오탐, 멀티라인 미탐지, 그리고 self-test 가 파일 순회 파이프라인 전체가 아닌 정규식 로직만 재검증한다는 세 가지 미검증 엣지 케이스가 남아 있다 — 모두 현재 시점 실제 오작동 증거는 없고 위험도도 낮아 INFO 수준이다. 별도로 번들된 `execution-engine.service.spec.ts` 1줄 수정은 실제 `ReferenceError`를 고치는 정당한 pre-existing 버그 fix로, 직접 재실행하여 378/378 전체 통과를 확인했다. `PROJECT.md`/plan 문서 변경은 코드 변경과 부합하며 사후 보정 패턴 없이 같은 turn 에 반영됐다.

### 위험도
LOW