# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `execution-failure-classifier.spec.ts` — `DB_HOST_BLOCKED` 분류 키 단언 중복
- 위치: `/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` 라인 113 (`it.each` 배열) 및 라인 128~136 (단독 `it` 블록)
- 상세: `DB_HOST_BLOCKED → executionFailedInternal` 분류는 `it.each` 배열에 이미 포함되어 있어 `result.key === 'executionFailedInternal'` 가 한 번 검증된다. 추가된 단독 `it` 블록 역시 동일한 `expect(result.key).toBe('executionFailedInternal')` 를 반복한다. warn 로그 비호출 검증(`warnSpy.not.toHaveBeenCalled()`)은 별도 가치가 있는 단언이지만, 테스트 이름이 "no CCH-ERR-04 warn log" 를 의도한다고 보면 key 단언 중복이 테스트 의도를 흐린다.
- 제안: 단독 `it` 블록에서 `expect(result.key).toBe('executionFailedInternal')` 를 제거하거나, 테스트 이름을 `"DB_HOST_BLOCKED → no CCH-ERR-04 warn log (classification via it.each above)"` 로 바꿔 중복 의도임을 명시한다. 기능적 문제는 아니며 INFO 수준.

### [INFO] `database-query.handler.spec.ts` — `pgIntegrationWithHost` / `mysqlIntegrationWithHost` 헬퍼 스코프
- 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` `describe('SSRF host guard ...')` 내부 정의
- 상세: 두 헬퍼가 `describe` 블록 내부에 함수 선언으로 정의되어 있다. 파일의 다른 픽스처들(예: `MYSQL_INTEGRATION_BASE`, `makeService` 팩토리)이 모듈 최상단에 정의된 패턴과 혼재한다. 동작에는 영향 없으나 추후 SSRF guard 테스트 확장 시 재사용성 낮다.
- 제안: 현 범위에서는 수용 가능. 확장 시 `describe` 외부 팩토리로 승격 권장.

### [INFO] `database-query.handler.spec.ts` — IPv6 loopback(`::1`) 차단 케이스 미포함
- 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` `it.each` 배열 (라인 939~943)
- 상세: 현재 `it.each` 는 `127.0.0.1`, `10.0.0.5`, `169.254.169.254`, `localhost` 를 검증한다. IPv6 loopback `::1` 및 IPv6 link-local `fe80::1` 은 SSRF 가드가 차단해야 할 추가 경우이나 테스트에서 누락되어 있다. `assertSafeOutboundHostResolved` 구현이 IPv6 를 커버하는지 테스트로 보장되지 않는다.
- 제안: `it.each` 배열에 `['IPv6 loopback', '::1']` 케이스 1건 이상 추가 검토. 가드 구현이 IPv6 를 처리하지 않는다면 테스트가 미커버 코드 경로를 드러낼 수 있다.

### [INFO] `database-query.handler.spec.ts` — `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 테스트의 env-mutation 격리 방식
- 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` 라인 1000~1021
- 상세: `process.env.ALLOW_PRIVATE_HOST_TARGETS` 를 `try/finally` 블록으로 복원하는 패턴을 사용한다. Jest 는 파일 단위 워커 격리(별도 Node.js 프로세스)를 기본으로 하므로 동일 파일 내 다른 테스트와의 env 공유 간섭은 직렬 실행 + `finally` 복원으로 충분히 방어된다. 비동기 Promise resolve 전 다른 코루틴이 env 를 읽을 가능성에 대한 우려가 있으나, `await` 체인이 단일 이벤트 루프 틱 내에서 순서대로 실행되고 다른 테스트가 동시 실행되지 않는 Jest 구조상 실질적 위험은 낮다.
- 제안: 현 수준에서 충분. `jest.isolateModules` 나 별도 파일 분리는 선택적 강화다.

### [INFO] `database-query.handler.spec.ts` — MySQL opt-out(`ALLOW_PRIVATE_HOST_TARGETS=true`) 케이스 미포함
- 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` SSRF host guard describe 블록
- 상세: PostgreSQL 드라이버에 대한 `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 테스트는 있지만, MySQL 드라이버에 대한 동일 opt-out 테스트는 없다. 가드가 드라이버 분기 전에 실행되므로 이론적으로 동일하게 동작하겠지만, MySQL 로도 opt-out 경로가 유효함을 테스트로 명시하는 것은 추가 신뢰를 제공한다.
- 제안: 중복 비용 대비 가치가 낮아 INFO 수준. 현 테스트 구조에서 skip 가능.

## 요약

이번 변경(`DB_HOST_BLOCKED` 신설)에 대한 테스트 커버리지는 전반적으로 충실하다. 핵심 차단 경로(PostgreSQL 4종 host 유형, MySQL 드라이버, opt-out 환경변수)를 `it.each` + 별도 `it` 블록으로 조합하여 커버하고, 각 케이스에서 `port:error`, `code:DB_HOST_BLOCKED`, 메시지 비노출, 연결 미호출, logUsage 기록 5가지를 단언하는 구조는 명확하다. `execution-failure-classifier.spec.ts` 의 분류 키 단언 중복은 기능적 문제가 없으나 테스트 가독성 면에서 의도 중첩이 발생한다. IPv6 loopback(`::1`) 케이스가 `it.each` 에 없어 가드의 IPv6 처리 여부가 테스트로 보장되지 않는 점이 잠재적 커버리지 갭이다. env-mutation 격리는 파일 단위 Jest 워커 구조상 현재 수준으로 충분하다. 발견된 모든 사항이 INFO 수준이며 Critical·Warning 없음.

## 위험도

LOW
