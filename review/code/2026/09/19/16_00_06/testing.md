# 테스트(Testing) 리뷰 — Database · HTTP 연결 테스터 도입

검증을 위해 저장소 파일은 수정하지 않았다(읽기 전용). 관련 unit spec 7개(`database-connection-tester.spec.ts` ·
`http-connection-tester.spec.ts` · `clamp-message.spec.ts` · `http-credentials.spec.ts` ·
`database-driver-sockets.spec.ts` · `database-query.handler.spec.ts` · `http-request.handler.spec.ts`) 217건과
`integrations.service.spec.ts` 136건을 `npx jest` 로 직접 실행해 전수 GREEN 을 확인했다(회귀 없음, 총 0.78s/1.16s).
`git status --short` 로 실행 전후 트리 무변경도 확인했다.

## 발견사항

- **[WARNING]** `buildMysqlSsl('require' | 'verify-full')` → `{ rejectUnauthorized: true }` 매핑이 저장소 어디에도 직접 테스트되지 않는다
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts:55-61` (함수 정의) ·
    `codebase/backend/src/modules/integrations/database-connection-tester.spec.ts:149-154` (같은 매핑의 postgres 쪽만 검증)
  - 상세: 이번 PR 은 `buildPgConnection`/`buildMysqlSsl` 을 `database-query.handler.ts` 내부 비공개 함수에서
    `database-connection.ts` 로 꺼내 **노드 실행과 새 Database 연결 테스터가 공유**하도록 만들었다(파일 자체 doc 주석이
    이 공유 의도를 명시). 그런데 `database-connection-tester.spec.ts` 의 "SSL 매핑은 노드와 같다 — verify-full 은
    인증서 검증을 켠다" 테스트는 **postgres**(`ssl: expect.objectContaining({ rejectUnauthorized: true })`)만 확인하고,
    mysql 쪽은 happy-path 테스트에서 `ssl: 'disable'` → `undefined` 매핑만 지나간다. 저장소 전체에서
    `rejectUnauthorized` 를 assert 하는 곳은 그 한 줄이 유일하다(`grep -rn rejectUnauthorized --include=*.spec.ts`
    결과 1건). `require`/`verify-full` 이 mysql 드라이버에 실제로 인증서 검증을 켜는지는 코드 리딩으로만 확인 가능하고,
    이 함수가 지금 두 소비자(노드 실행 · 연결 테스트)가 공유하는 보안-민감 매핑(MITM 방지)이라는 점에서 회귀 감지력이
    postgres 쪽보다 약하다.
  - 제안: `database-connection-tester.spec.ts` 의 mysql `describe` 블록에 `it.each(['require', 'verify-full'])`
    형태로 `mockedCreateConnection).toHaveBeenCalledWith(expect.objectContaining({ ssl: { rejectUnauthorized: true } }))`
    를 추가한다(postgres 쪽과 대칭).

- **[WARNING]** `database-driver-sockets.spec.ts` 가 mock 없이 실제 소켓 I/O 를 수행해, unit 계층(`*.spec.ts`, `npm test`)에
  네트워크 의존이 섞여 들어간다
  - 위치: `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts:18-23` (pg, 포트 1 로 실제
    `Client` 생성) · `:25-37` (mysql2, 포트 9 로 실제 `createConnection` 호출)
  - 상세: 파일 상단 주석이 의도를 분명히 밝힌다 — `closeWithin`(테스터 코드)이 기대는 "`connection.stream` 에 소켓이
    있다" 는 두 드라이버의 **비공개** 내부 구조를 실제 객체로 고정해 두려는 목적이다. 목적 자체는 타당하고(모킹만 하는
    `database-connection-tester.spec.ts` 는 이 가정을 볼 수 없다), 실제로 이번 실행에서는 즉시 끝났다(전체 스위트
    0.78s, 이 파일 하나만으로도 network I/O 로 인한 지연 징후 없음). 다만 이 파일은 다른 `.spec.ts` 와 나란히
    `npm test`(unit 계층, mock 기반·네트워크 없음이 관례) 로 실행되므로, ① 소켓 정책이 더 엄격한 CI/샌드박스에서
    포트 1·9 접속 자체가 다르게 동작할 여지, ② 두 `expect` 중 앞쪽이 실패하면(드라이버 구조가 실제로 바뀌어 RED 가
    나는 그 시나리오에서) 뒤의 `stream.destroy()` 정리 줄이 실행되지 않아 소켓이 정리되지 않은 채 남는 부수효과가
    있다. 회귀 감지라는 목적에 견주면 프로세스 종료 시 정리되는 수준이라 실질 위험은 낮지만, 이 저장소의 unit/
    integration/e2e 3계층 구분(CLAUDE.md 개발 방법론)에서 "네트워크 I/O 를 쓰는 검증"은 통상 integration/e2e 쪽 관례에
    가깝다.
  - 제안: 현행 유지도 가능하나(GREEN 이고 위험은 낮음), 소켓 정리를 `try/finally` 로 감싸 실패 시에도 `destroy()` 가
    실행되게 하거나, 파일 최상단 주석에 "이 spec 은 예외적으로 실제 소켓을 쓴다"는 점을 CI 담당자가 찾기 쉽게
    한 줄 더 남기는 정도로 보강을 고려.

- **[INFO]** `rotate()` 의 `update` 성공(`affected` truthy) 후 재조회(`findOne`)가 `null` 을 돌려주는 좁은 race 는
  테스트되지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1139-1153` (`!saved` 분기의 두 경로 중
    `affected` truthy + 재조회 null 경로) · 대응 스펙은 `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1296-1307`
    (`affected: 0` 경로만 커버)
  - 상세: 이번 PR 이 새로 도입한 "저장 뒤 다시 읽은 행을 응답으로 쓴다" 로직은 `affected` 가 0이면 404 를 던지는
    경로 하나만 테스트돼 있다. `update` 가 1행을 바꿨다고 보고했는데 그 직후 재조회가 `null` 을 돌려주는(예: 같은
    트랜잭션 창 안에서 다른 요청이 그 사이 행을 삭제) 두 번째 `!saved` 분기는 코드에는 있지만 spec 에 대응 케이스가
    없다 — `integrationRepo.findOne` 기본 mock 이 `beforeEach` 에서 `.mockResolvedValue(integration)`(영구 값)로
    설정돼 있어 두 번째 호출(재조회)도 항상 같은 값을 돌려주도록만 짜여 있다.
  - 제안: `integrationRepo.findOne.mockResolvedValueOnce(entity).mockResolvedValueOnce(null)` 로 재조회만 null 을
    돌려주는 케이스를 추가해, `NotFoundException({code:'RESOURCE_NOT_FOUND'})` 를 던지고 `auditLogsService.record`·
    `integrationCacheBus.publish` 가 호출되지 않음을 확인하면 두 `!saved` 경로가 모두 커버된다.

## 정합성 확인 (문제 없음 — 특히 잘된 점)

- `database-connection-tester.spec.ts`·`http-connection-tester.spec.ts` 는 SSRF 차단·인증 실패·서버 오류·타임아웃·
  리다이렉트 홉 상한(off-by-one 까지, `MAX_REDIRECT_HOPS + 1` 회 호출 명시 검증)·닫기 유예 상한(`jest.useFakeTimers` +
  `advanceTimersByTimeAsync`)·메시지 길이 클램프까지 경계값을 빠짐없이 짚는다. "종전에는 구조만 맞으면 성공이었다"
  회귀를 각 스펙 상단 doc 주석에 명시해 무엇을 막으려는 테스트인지 분명하다.
- `http-request.handler.spec.ts` 의 신규 단언 `expect(global.fetch).toHaveBeenCalledTimes(6)` 은 리다이렉트 상한의
  off-by-one 뮤테이션을 정확히 잡는 형태다(호출 결과만 보면 6홉도 5홉도 같은 `HTTP_BLOCKED` 로 끝나 구분 안 됨).
- `integrations.service.spec.ts` 의 동시성 테스트 2건(`CONNECTION_TEST_MAX_CONCURRENCY` 개까지만 동시 실행·
  서로 다른 서비스가 슬롯을 공유)은 `inFlight`/`peak` 카운터로 실제 동시 실행 수를 관측하는 방식이라 vacuous 하지
  않다. `service` 를 매 테스트 `beforeEach` 에서 새로 생성해 `pLimit` 인스턴스가 테스트 간 공유되지 않으므로 격리도
  안전하다.
- 새 `PreviewTestResultDto.code` 필드는 `assertMatchesContract(result, await contractForDto(PreviewTestResultDto))`
  로 응답-계약 검증까지 걸려 있고(§5.4 응답-계약 검증자 관례와 일치), e2e(`integration-connection-test.e2e-spec.ts`)
  가 실제 HTTP 라운드트립으로 `data.code` 가 직렬화돼 나가는지까지 확인한다 — DTO 선언 누락으로 필드가 조용히
  드롭되는 회귀를 막는 이중 방어.
- `database-connection-tester.spec.ts`/`integrations.service.spec.ts` 의 mock 분리(전자는 `pg`/`mysql2/promise`
  전체 모킹, 후자는 두 테스터 모듈 자체를 모킹)는 "테스터는 자기 unit spec 이 보고, 서비스 스펙은 배선만 본다" 는
  주석대로 이중 검증도 이중 누락도 없다.
- `database-query.handler.spec.ts` 는 이번 PR 에서 `buildPgConnection`/`buildMysqlSsl` 추출의 영향을 받는 파일인데
  diff 에 포함되지 않았음에도(순수 위치 이동, 로직 무변경) 실행 결과 전량 GREEN — 회귀 없음을 실측으로 확인했다.

## 요약

새로 추가된 Database·HTTP 연결 테스터와 그 공유 모듈(`http-credentials.ts`·`http-redirect.ts`·`database-connection.ts`)은
SSRF 차단·인증 실패 분류·타임아웃·리다이렉트 홉 상한·닫기 유예 등 핵심 분기를 경계값까지 포함해 폭넓게 커버하며,
서비스 계층의 동시 실행 상한과 새 `code` 응답 필드도 실제 동시성 관측과 계약 검증으로 뒷받침된다. 217+136건을 직접
실행해 회귀 없음(전량 GREEN)을 확인했다. 남은 갭은 크지 않다 — mysql SSL 인증서 검증 매핑(`buildMysqlSsl`)이
postgres 쪽과 달리 직접 테스트되지 않는 점(WARNING), 드라이버 내부 구조를 고정하는 `database-driver-sockets.spec.ts`
가 unit 계층에 실제 소켓 I/O 를 섞는 점(WARNING, 이번 실행에서는 문제 없었음), `rotate()` 의 재조회-null race 경로가
테스트되지 않은 점(INFO)이다. 셋 다 병합을 막을 수준은 아니다.

## 위험도

LOW
