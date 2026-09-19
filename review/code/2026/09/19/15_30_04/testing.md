# 테스트(Testing) 리뷰 — Database · HTTP 연결 테스터

## 검증 방법

정적 리뷰에 더해 실제로 관련 spec 파일들을 저장소 안에서 `jest`/`jest --coverage` 로 실행해 확인했다(저장소 파일은
쓰지 않았다 — 읽기 전용 명령만 사용). 아래 실측 수치는 이 실행 결과다.

- `database-connection-tester.spec.ts`(21) · `http-connection-tester.spec.ts`(26) · `clamp-message.spec.ts`(3) ·
  `http-credentials.spec.ts` — 4개 스위트, 63개 테스트 전부 통과.
- `integrations.service.spec.ts` · `http-request.handler.spec.ts` · `database-query.handler.spec.ts` — 3개 스위트,
  286개 테스트 전부 통과.
- 신규 파일 3개(`database-connection-tester.ts` · `http-connection-tester.ts` · `http-redirect.ts`)에 대해
  `--coverage`(text reporter)로 branch 커버리지를 직접 측정했다.

## 발견사항

- **[WARNING]** `closeWithin` 의 "드라이버 소켓을 못 찾음" fallback 분기가 어떤 테스트로도 도달하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:56-61` (`closeWithin` 함수의
    `else` 분기, 두 번째 `logger.warn`)
  - 상세: `npx jest database-connection-tester.spec.ts --coverage` 실측 결과 이 파일의 branch 커버리지는
    81.81%이고, 미커버 라인은 정확히 이 지점(소스 리포트 `Uncovered Line #s: 58`)이다. 테스트의 pg/mysql 모의
    객체(`pg`/`mysql` 상수)는 둘 다 `connection: { stream: { destroy: jest.fn() } }` 를 항상 정의해 두고 있어,
    `handle.connection?.stream?.destroy` 가 falsy 인 경우(주석 그대로 "드라이버 내부 구조가 바뀌면 여기로 온다")의
    방어 로그 분기는 한 번도 실행되지 않는다. 결과값(`success`/`code`/`message`)은 이 분기에서 바뀌지 않으므로
    사용자 체감 영향은 없지만, 방어 코드 자체가 뮤테이션에 걸리지 않는 상태다 — 이 분기를 통째로 지우거나
    메시지를 바꿔도 어떤 테스트도 실패하지 않는다.
  - 제안: pg/mysql 각 1건씩 `connection`(또는 `connection.stream`)이 없는 모의 객체로 닫기-초과 시나리오를
    재현하는 테스트를 추가해 fallback 경고 경로를 커버한다.

- **[INFO]** 비-`Error` throw 에 대한 `String(err)` fallback 분기가 두 파일에서 공통으로 미검증
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:66` (`describeFailure` 의
    `if (!(err instanceof Error)) return String(err);`), `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:30`
    (`outboundBlockReason` 의 `return err instanceof Error ? err.message : String(err);`)
  - 상세: `http-connection-tester.spec.ts` + `http-credentials.spec.ts` + `http-request.handler.spec.ts` 를 합쳐
    커버리지를 측정해도(세 스펙이 `http-redirect.ts`/`http-connection-tester.ts` 를 간접적으로 공유해서 부른다)
    두 파일 각각 정확히 이 한 줄만 uncovered 로 남는다. 테스트에서 던지는 모든 실패는
    `Error`/`TypeError` 계열(`new Error(...)`, `Object.assign(new TypeError(...), { cause })`)뿐이라, 실제로
    non-Error 값(문자열·객체 등)이 던져지는 경로가 한 번도 실행되지 않는다. `fetch`/SSRF 가드가 non-Error 를
    던질 가능성은 낮지만, 방어 코드로 남겨둔 이상 최소 1건은 검증해 두는 편이 "이 코드가 왜 있는지"를
    테스트로 보증한다.
  - 제안: `fetchMock.mockRejectedValue('raw string reason')` 류의 케이스를 두 함수 각각(또는 공유 헬퍼 하나)에
    1건씩 추가.

- **[INFO]** 리뷰 도중 저장소 파일이 외부에서 변경되는 것을 관측함(내 세션이 유발한 변경 아님)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts`, 같은 디렉터리의
    `integrations.service.spec.ts`
  - 상세: 세션 시작 시점의 `git status`(대화 시작 컨텍스트)에는 이 두 파일이 없었는데, 리뷰 도중(읽기 전용 명령만
    실행한 시점 이후) `git status --short` 를 다시 확인하니 두 파일이 `M`(수정됨) 으로 나타났다. 이 리뷰 세션은
    두 파일에 Write/Edit 을 전혀 하지 않았다(Read·Bash(jest 실행)만 사용) — 병렬로 도는 다른 세션(리뷰어 또는
    fix 적용 세션)이 같은 워크트리를 동시에 고치고 있는 것으로 보인다. `git diff` 로 확인한 변경 내용은 정확히
    `rotate()` 의 `updatedAt`/`lastRotatedAt` 처리를 "메모리에서 값을 채워 반환"에서 "저장 뒤 재조회로 반환"으로
    바꾸는 것이었고, 커밋되지 않은 코멘트에는 "e2e 실측 1ms" 라는 문구가 있어 이 리뷰 payload 에 포함된
    `integration-connection-test.e2e-spec.ts` E("응답의 updatedAt 이 회전 전 값이 아니라 DB 에 저장된 값과 같다")·
    `integrations.service.spec.ts`의 "rotate 는 바꾸는 컬럼만 저장한다" 유닛 테스트가 검출한 타이밍 정밀도
    문제를 다른 세션이 실시간으로 고치고 있는 정황과 일치한다. 이 자체는 이 리뷰가 받은 diff/payload 의 결함이
    아니지만, 위 두 파일에 대한 내 관찰(`integrations.service.spec.ts` 의 rotate 테스트 상세 내용 등)은 payload
    스냅샷 기준이며 **현재 디스크 상태와 이미 어긋나 있을 수 있다** — SUMMARY 통합 시 최종 상태로 재확인이
    필요하다.

## 정합성 확인 (테스트 품질이 특히 좋았던 지점)

- 두 테스터(`database-connection-tester.ts`/`http-connection-tester.ts`) unit spec 은 성공·SSRF 차단·인증 실패·
  일반 연결 실패·타임아웃·닫기 지연(fake timer 로 상한 초과 재현)·메시지 길이 clamp·드라이버 기본값·SSL 매핑까지
  분기를 빠짐없이 다루며, `plan/in-progress/integration-db-http-testers.md` 에 뮤턴트 24개(10+14) 전수 실행 결과가
  기록돼 있고 실제로 `jest --coverage` 로도 각 96%+ branch 커버리지를 재확인했다(예외 두 건은 위 WARNING/INFO).
- `http-request.handler.spec.ts` 에 추가된 `expect(global.fetch).toHaveBeenCalledTimes(6)` 단언은 리다이렉트 상한의
  off-by-one 회귀를 정확히 겨냥한다 — 상태 코드(`HTTP_BLOCKED`)만 보면 5홉/6홉 뮤턴트가 모두 통과하는데 호출
  횟수까지 보게 해 실제로 가른다.
- `integrations.service.spec.ts` 의 동시성 테스트(`동시에 도는 연결 테스트는 2개까지` · `연결 테스트는 종류를
  가리지 않고 한 줄을 공유한다`)는 `Promise` 를 수동으로 pending 상태로 유지하는 deferred 패턴 + `setImmediate`
  로 microtask 를 flush 시켜 `pLimit` 의 실제 동시 실행 수(`peak`)를 관측 가능한 값으로 만든다 — mock 이 타이밍에
  의존하지 않고 결정적이라 flaky 위험이 낮다.
- e2e(`integration-connection-test.e2e-spec.ts`)는 rotate 의 상태 코드를 의도적으로 단언하지 않고(400 vs 422
  불일치가 트래커에 있음을 plan 에 명시) 4xx 범위 + `code` 로만 판정해, 아직 정하지 않은 계약을 e2e 로 조기
  고정하는 실수를 피했다. `integration-cache-invalidate.e2e-spec.ts` 의 fixture 변경(`base_url` 제거)도 왜
  필요한지 주석으로 남기고, 그 대상(broadcast)이 신규 테스터의 실제 네트워크 호출에 영향받지 않게 정확히
  분리했다.
- `resolveHttpCredentials`/`appendQueryParams` 전용 spec(`http-credentials.spec.ts`)은 필수 필드 각각을 빼는
  `it.each` 로 "하나라도 없으면" 조건의 세 갈래를 모두 개별 검증하고, query 파라미터 중복 키·빈 객체·`undefined`
  케이스까지 커버한다.

## 요약

이번 변경(Database · HTTP 연결 테스터 신설 + 동시 상한 + rotate 배선)에 대한 테스트는 매우 두텁다 — unit(63개
신규/관련 테스트) · 기존 회귀(286개 통과) · e2e(사설 host 차단을 세 경로에서 확인) 전부 실행해 통과를 확인했고,
plan 문서에 기록된 뮤테이션 테스트 결과와도 실측이 일치한다. 실측으로 찾아낸 진짜 갭은 두 곳뿐이다 — ①
`closeWithin` 의 "소켓을 못 찾음" 방어 로그 분기(WARNING, 결과값에 영향 없음) ② `describeFailure`/
`outboundBlockReason` 의 비-Error throw `String(err)` fallback(INFO, 방어 코드 검증 부재) — 둘 다 기능적
회귀 위험이 아니라 로그/방어 코드의 "죽은 채로 방치될 수 있는" 분기다. 이 외에 리뷰 도중 `integrations.service.ts`·
`integrations.service.spec.ts` 가 내 세션과 무관하게 외부에서 변경되는 것을 관측했다(병렬 세션의 rotate
타임스탬프 정밀도 수정으로 추정) — 결함이 아니라 리뷰 payload 스냅샷과 현재 디스크 상태 간 드리프트 가능성에
대한 알림이다.

## 위험도
LOW
