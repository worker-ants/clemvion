# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] DNS 재바인딩 TOCTOU 경쟁 조건 — 기존 한계, 신규 도입 없음
- 위치: `/codebase/backend/src/nodes/integration/http-request/http-safety.ts` L118-121 (`assertSafeOutboundHostResolved` 주석)
- 상세: 가드가 DNS resolve 후 실제 `connect()` 사이에 짧은 경쟁 창(race window)이 존재한다. 공격자가 DNS TTL을 0으로 설정하면 가드 시점과 연결 시점 사이에 IP를 내부 주소로 교체할 수 있다. 이번 변경이 신규 도입한 문제가 아니며, 코드에 주석으로 문서화되어 있다.
- 제안: 운영 환경 egress 방화벽 부재 시 별도 티켓으로 추적. 본 PR 범위 밖. 현재 수준에서 수용 가능.

### [INFO] DNS 실패 시 fail-open 정책 — 의도적 설계, 신규 도입 없음
- 위치: `/codebase/backend/src/nodes/integration/http-request/http-safety.ts` L135-142
- 상세: `lookup()` 실패 시 가드가 통과를 허용한다 (`return`). DNS 해석 실패는 연결 자체도 실패하므로 실질적 SSRF 위협은 없다는 논리로 문서화된 의도적 설계다. 단, DNS 실패를 이용한 DoS + SSRF 체인 이론적 가능성은 잔존한다.
- 제안: DNS 실패를 structured warn 로그로 남기면 비정상 패턴 감지에 도움. 선택적 개선.

### [INFO] catch 블록에서 원본 예외 정보 서버 로그 미기록
- 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` L224-231
- 상세: `assertSafeOutboundHostResolved` 가 던지는 원본 에러(`SSRF_BLOCKED: hostname "..." resolves to restricted IP "..."`) 를 `catch {}` 로 silently 소멸시키고 일반화 메시지의 새 `IntegrationError` 로 대체한다. 클라이언트에 host/IP 를 노출하지 않는 정찰 면 축소 설계는 올바르다. 그러나 원본 에러가 서버 측 로그에도 기록되지 않아 운영 관찰가능성 갭이 발생한다. 이후 `logUsage` 에서 기록되는 `toLogError(err)` 는 이미 승격된 `IntegrationError('DB_HOST_BLOCKED', '...')` 를 기록하므로 어떤 host/IP 가 차단됐는지 서버 로그에서 추적 불가능하다.
- 제안: `catch (originalErr)` 로 원본 예외를 캡처하여 서버 구조화 로그에 차단된 host 를 기록하는 것을 검토한다 (클라이언트 응답에는 일반화 메시지 유지). 예: `logger.warn({ blockedHost: creds.host, reason: String(originalErr) }, 'DB SSRF guard blocked')`. 선택적 개선.

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS` 환경변수 — 보안 영향 문서화 적절
- 위치: `/codebase/backend/src/nodes/core/error-codes.ts` L27-30, `/codebase/backend/src/nodes/integration/http-request/http-safety.ts` L80-82
- 상세: opt-out 메커니즘이 환경변수 문자열 비교(`=== 'true'`)로 구현되어 있다. 이는 표준적이고 안전한 패턴이다. `true` 외의 값(`True`, `1`, `yes`)은 무시되어 가드가 활성 상태를 유지한다 — 의도적 보수 설계.
- 제안: 해당 없음. 현행 유지.

### [INFO] 에러 메시지 정찰 면 축소 검증 — 구현 올바름
- 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` L227-230
- 상세: `IntegrationError('DB_HOST_BLOCKED', 'Database host resolves to a private/loopback address blocked by SSRF policy.')` 메시지에 차단된 host 값이 포함되지 않는다. 테스트도 `expect(out.output.error.message).not.toContain(host)` 로 이를 명시적으로 검증한다. 정찰 방지 설계가 코드와 테스트 양쪽에서 보장된다.
- 제안: 해당 없음.

### [INFO] SSRF 가드 위치 — 커넥션 풀 획득 전, 올바름
- 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` L223-232 (가드 블록이 `resolvePgPool`/`resolveMysqlPool` 호출 전)
- 상세: SSRF 차단 시 실제 TCP 연결이 열리지 않음이 보장된다. 테스트(`expect(connectMock).not.toHaveBeenCalled()`, `expect(jest.requireMock('mysql2/promise').createPool).not.toHaveBeenCalled()`)가 이를 검증한다.
- 제안: 해당 없음.

## 요약

이번 변경은 Database Query 노드의 SSRF 차단 에러 코드를 기존 `INTEGRATION_CALL_FAILED` fallback 에서 전용 `DB_HOST_BLOCKED` 로 승격하는 것이 핵심이다. 보안 관점에서 긍정적으로 평가된다: (1) SSRF 가드 자체는 기존 `assertSafeOutboundHostResolved` 를 재사용하며 신규 취약점을 도입하지 않는다; (2) 에러 메시지에서 차단 host/IP 를 제거해 정찰 면을 축소하고 테스트로 검증한다; (3) 가드가 커넥션 풀 획득 전에 위치해 TCP 연결 없이 차단된다; (4) `ALLOW_PRIVATE_HOST_TARGETS` opt-out 이 보수적으로 구현되어 있다. 알려진 DNS 재바인딩 TOCTOU 창과 DNS 실패 fail-open 정책은 기존 코드에서 재사용된 한계이며 주석으로 문서화되어 있다. 유일한 관찰가능성 갭은 catch 블록에서 원본 에러(차단된 host/IP 정보 포함)가 서버 로그에도 기록되지 않는 점으로, 운영 모니터링 관점에서 선택적 개선 대상이다. 신규 하드코딩 시크릿, 인증 우회, 인젝션 취약점, 안전하지 않은 암호화 알고리즘, 민감 정보 클라이언트 노출은 발견되지 않았다.

## 위험도

NONE
