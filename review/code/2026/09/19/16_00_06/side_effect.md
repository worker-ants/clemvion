# 부작용(Side Effect) 리뷰 — integration-testers-5c2d91

대상: Database · HTTP 통합 연결 테스트 신설 PR (`integrations.service.ts` 동시 상한 도입, `database-connection-tester.ts` ·
`http-connection-tester.ts` 신설, `http-request.handler.ts` 공유 모듈 추출, `rotate()` 저장 방식 변경 등). 리뷰는 저장소를 뮤테이션하지
않고 `Read`/`Bash`(cat·grep)만으로 수행했다 — `git status --short` 최종 확인 결과 워킹트리 변경 없음.

## 발견사항

- **[WARNING]** 신규 공유 동시-실행 리미터(`connectionTestLimit`)의 재진입 데드락 위험이 코드로 강제되지 않고 주석에만 의존한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `connectionTestLimit` 필드 초기화(생성자
    직전, `private readonly connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY);`)와 `registerEntityTester` 위
    JSDoc(`It runs inside the connection-test concurrency limit … so it MUST NOT call back into testConnection /
    previewTest / rotate — a nested wait on the same limit can deadlock once every slot is held by such a tester.`)
  - 상세: `IntegrationsService`는 `@Injectable()`(기본 싱글턴 스코프)이라 `connectionTestLimit`(상한 2)은 프로세스 전체에서
    `previewTest`·`testConnection`(entity tester 경로)·`rotate`(내부적으로 `dispatchTest` 경유) 셋이 **공유**하는 단일 큐다.
    지금 등록된 두 entity tester(`cafe24.module.ts:103`, `makeshop.module.ts:86`)는 `pingConnection()`만 호출하고
    `testConnection`/`previewTest`/`rotate`를 되부르지 않아 **현재는** 위반이 없음을 직접 코드로 확인했다. 그러나 이 계약은
    타입 시스템이나 런타임 가드로 강제되지 않는다 — `EntityAwareTester`의 시그니처는 `(entity: Integration) =>
    Promise<IntegrationTestResult>`일 뿐이라 향후 확장점(주석 자체가 "확장점으로 들어오는 테스터"를 언급)이 실수로 재진입
    호출을 넣으면, 상한 2개 슬롯이 모두 그 재진입 대기로 채워지는 순간 **두 슬롯이 서로를 영원히 기다리는 프로세스 전역
    데드락**이 되어 재시작 전까지 모든 워크스페이스의 preview-test·test·rotate가 멈춘다. 컴파일 타임에도, 런타임에도 이를
    잡아내는 장치가 없다.
  - 제안: (a) `AsyncLocalStorage`나 간단한 카운터로 "현재 `connectionTestLimit` 슬롯 안에서 실행 중"임을 표시해 두고, 같은
    슬롯 안에서 `dispatchTest`/`testConnection`/`previewTest`/`rotate`가 다시 호출되면 데드락 대신 즉시 에러로 fail-fast
    하게 하거나, (b) 최소한 이 계약을 어기는 테스터를 등록하면 콘솔에 경고를 남기는 정도의 가드를 추가. 최소 비용 대안으로는
    "위반 시 즉시 실패"를 검증하는 회귀 테스트 한 건을 추가해 향후 리팩터링이 이 불변식을 깨는 순간 CI가 잡게 한다.

- **[INFO]** `database-driver-sockets.spec.ts`의 mysql2 케이스가 "unit" 스펙임에도 실제 OS 소켓 연결 시도를 발생시킨다(pg 케이스는 아님 — 확인됨)
  - 위치: `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts` — `mysql2 promise Connection 은
    connection.stream 에 소켓을 둔다` 테스트, `mysqlCoreConnection({ host: '127.0.0.1', port: 9, connectTimeout: 1_000 })`
    호출부
  - 상세: `node_modules/mysql2/lib/create_connection.js` → `new Connection(...)` → `node_modules/mysql2/lib/base/connection.js`
    생성자(약 58행)가 `this.stream = Net.connect(opts.config.port, opts.config.host);`를 **생성자 안에서 즉시** 실행함을
    소스로 직접 확인했다 — 즉 `createConnection()`을 호출하는 순간 `127.0.0.1:9`로 실제 TCP 연결 시도가 나간다. 반면 같은
    파일의 `pg` 케이스는 `node_modules/pg/lib/connection.js`에서 `stream`은 생성자에서 만들어지지만(`getStream()`)
    `.connect(port, host)`는 별도 `connect()` 메서드에서만 호출되고 이 테스트는 `client.connect()`를 부르지 않으므로 실제
    네트워크 시도가 없다 — 두 케이스가 비대칭이다. mysql2 케이스는 `core.on('error', () => {})`로 에러를 삼키고 스트림을
    생성 직후 동기적으로 `.destroy()`하므로 실전 위험은 낮지만(루프백 한정, 즉시 파괴), "unit" 계층 spec 이 실제 소켓
    syscall을 발생시킨다는 점에서 이 저장소의 다른 unit spec들과 성격이 다르고, 소켓 syscall 자체를 차단하는 네트워크
    제한적 CI 샌드박스에서는 실패·flaky 가능성이 있다.
  - 제안: 파일 상단 주석에 "mysql2 케이스는 생성 즉시 루프백으로 실제 connect 를 시도하고 곧바로 destroy 한다"는 사실을
    명시해 다음 사람이 이 spec 을 순수 유닛으로 오해하지 않게 하거나, CI가 소켓 syscall을 막는 샌드박스에서 도는지 확인.
    긴급도는 낮음(루프백 한정, 즉시 파괴, 현재 CI 통과 전제).

- **[INFO — 의도된 변경, drift 없음 확인]** `preview-test`·`:id/test`·`rotate`가 "외부 호출 없음"에서 "실제 접속"으로 바뀐 것은
  이 PR의 핵심 목적이며, 관련 문서·DTO·Swagger가 모두 동기화됐다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts`(`dispatchTest`) ·
    `integrations.controller.ts`(Swagger `description` 갱신) · `dto/integration.dto.ts` · `dto/responses/integration-response.dto.ts`
  - 상세: 세 endpoint가 이제 DNS 조회·TCP 연결·(HTTP는) 실제 GET 요청을 수행한다 — 이전 컨트롤러 주석("no outbound HTTP is
    performed")과 정반대다. 다만 diff 안에서 컨트롤러 Swagger 설명·`PreviewTestDto`/DTO 필드 설명·CHANGELOG·사용자 가이드
    (`integration-management.mdx`/`.en.mdx`) 전부가 같은 커밋 계열에서 함께 갱신되어 문서-구현 drift는 없었다. SSRF 가드
    재사용(`ALLOW_PRIVATE_HOST_TARGETS`)과 동시 상한(2)으로 완화됐고, 프런트엔드 `test-step.tsx`의 `useQuery`는 마법사의
    전용 "Test" 스텝 진입 시 1회만 발동해(키 입력마다 재요청 아님) 이 새 네트워크 부작용이 사용자 입력 중에 반복 트리거되는
    구조는 아니다. 조치 불요 — 리뷰 관점 "네트워크 호출"의 확인 기록으로 남긴다.

- **[정보 — 확인, 문제 없음]** `rotate()`의 저장 방식이 `save(entity)`(엔티티 전체 upsert) → `update({id}, changes)` + 재조회로
  바뀌어 반환 객체의 출처가 달라졌다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` (변경 후 파일 기준 약 1132~1153행,
    `const changes = {...}` ~ `if (!saved) throw new NotFoundException(...)`)
  - 상세: 이 변경은 이번 PR 라운드 자체의 수정 목표(동시 `logUsage` 원자적 update가 되돌려지는 문제 · 삭제된 행에 대한
    `save()`의 암묵적 INSERT 방지)이고, 반환값이 "메모리의 엔티티"에서 "저장 뒤 재조회한 행"으로 바뀐다는 시그니처 외부
    가시 동작 변화는 새 unit 테스트("바꾸는 컬럼만 저장한다…")와 e2e 테스트 E가 명시적으로 고정한다. `affected === 0` 이면
    404(`RESOURCE_NOT_FOUND`)로 감사 로그·broadcast 모두 건너뛰는 것도 새 unit 테스트로 커버됨을 확인했다. 결함 아님 —
    검증 완료 기록.

- **[정보 — 확인, 문제 없음]** `http-request.handler.ts`의 리다이렉트·쿼리 파라미터·자격증명 로직을 `http-redirect.ts` ·
  `http-credentials.ts`로 추출한 리팩터가 노드 실행 경로의 관측 가능한 동작을 바꾸지 않는다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`(추출 전/후 diff),
    `http-redirect.ts`(`followRedirectsSafely`, `MAX_REDIRECT_HOPS = 5`), `http-credentials.ts`(`resolveHttpCredentials`,
    `appendQueryParams`)
  - 상세: 리다이렉트 홉 상한(5), 클라이언트 노출 문구(`SSRF_BLOCKED_CLIENT_MESSAGE` — 문자열 리터럴 값 불변 확인), 자격증명
    실패 시 `IntegrationError` 코드·메시지(`INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`)가 추출 전후 동일함을
    diff로 대조 확인했다. `buildHttpCredentials`는 여전히 실패를 예외로 던지는 반면 신설 `resolveHttpCredentials`는 값으로
    돌려주는 이중 계약이 의도적으로 문서화돼 있고(순환 import 회피), 노드 핸들러 쪽은 그 값을 `IntegrationError`로 그대로
    변환해 기존 호출자(워크플로 실행 엔진)가 보는 예외 타입·에러 코드에 변화가 없다. `http-request.handler.spec.ts`에 추가된
    `expect(global.fetch).toHaveBeenCalledTimes(6)` 단언도 "첫 요청 + 5홉"이라는 기존 카운트와 일치함을 직접 계산해 확인.
    시그니처·인터페이스 파손 없음.

## 요약

가장 실질적인 부작용 위험은 `IntegrationsService`에 새로 생긴 프로세스-전역 동시성 리미터(`connectionTestLimit`, 상한 2)이며,
`registerEntityTester` 확장점에 "이 리미터 안에서 testConnection/previewTest/rotate 를 되부르면 데드락"이라는 계약을 주석으로만
남기고 코드로 강제하지 않는다는 점이다 — 지금 등록된 Cafe24·MakeShop 테스터는 위반하지 않음을 직접 확인했지만, 향후 확장점이
이를 어기면 프로세스 전체가 조용히 멈추는 잠재적 결함이다. 그 외에는 (a) `database-driver-sockets.spec.ts`의 mysql2 케이스가
"unit" 계층임에도 루프백으로의 실제 소켓 연결을 즉시 열고 파괴한다는 점(저위험, 문서화 권장), (b) preview-test·:id/test·rotate가
"외부 호출 없음"에서 "실제 접속"으로 바뀌는 이 PR 고유의 핵심 변경이 문서·DTO·Swagger·프런트엔드 트리거 지점까지 정합적으로
동기화돼 있다는 점(확인, 문제 없음), (c) `rotate()`의 `save→update+재조회` 전환과 `http-request.handler.ts` 리팩터 추출이
모두 새/기존 테스트로 동작 동등성이 뒷받침된다는 점(확인, 문제 없음)을 정리했다. CRITICAL 급 의도치 않은 전역 상태 변경,
파일시스템 부작용, 깨진 공개 시그니처, 예상 밖 환경변수 접근은 발견되지 않았다.

## 위험도

MEDIUM — CRITICAL 은 없으나, 재진입 데드락 WARNING 은 코드로 강제되지 않는 계약이라 향후 확장점 추가 시 재발 가능성이 실질적이다.
