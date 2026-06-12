# Security Review

## 발견사항

### **[INFO]** DNS 재바인딩 경쟁 조건 (TOCTOU) — 알려진 한계이며 문서화됨
- **위치**: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` L118-121, `assertSafeOutboundHostResolved`
- **상세**: DNS를 resolve한 후 실제 TCP 연결이 맺히기 전 사이의 짧은 시간 동안 DNS 응답이 바뀔 수 있는 TOCTOU(Time-Of-Check Time-Of-Use) 경쟁 조건이 존재한다. 주석에 "Race window"로 명시되어 있고, "pair with an egress firewall" 권고가 달려 있다. 이번 변경(DB_HOST_BLOCKED)은 이 경쟁 조건을 신규 도입하지 않으며 기존 메커니즘을 그대로 재사용한다.
- **제안**: 현재 설계 수준에서는 수용 가능한 한계. 운영 환경에 egress 방화벽이 없는 경우 별도 티켓으로 추적할 것. 이번 PR 범위 밖.

### **[INFO]** DNS 실패 시 fail-open 정책
- **위치**: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` L135-142
- **상세**: `lookup` 실패 시 SSRF 가드가 `throw` 없이 통과(`return`)시킨다. 이후 드라이버가 ENOTFOUND로 실패하므로 실제 내부 망 접근은 일어나지 않지만, 이론적으로는 DNS 서버를 마비시켜 가드를 우회하는 시나리오가 가능하다(DoS + SSRF 체인). 주석에 의도적 설계임이 명시되어 있다.
- **제안**: 현재 설계 의도를 수용. 다만 DNS 실패를 구조화 로그(warn)로 남기면 이상 패턴 감지에 도움이 된다. 이번 PR 범위 밖.

### **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` 환경변수 — 매 호출마다 `process.env` 읽기
- **위치**: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` L80-82, `isPrivateHostsAllowed()`
- **상세**: `process.env.ALLOW_PRIVATE_HOST_TARGETS`를 매 요청마다 읽는다. 설정 값 동적 변경이 가능하지만, 테스트에서 `process.env`를 변조해 opt-out 검증을 수행하는 코드가 있으므로 현재 동작이 의도적이다. 이는 plan에서도 "선택 사항"으로 분류된 후속 항목이다.
- **제안**: 보안 위험 없음. plan의 기존 후속 항목(`env-read-once`)으로 추적 중.

### **[INFO]** `hashCredentials`에 SHA-256 사용 — 평문 비밀번호 포함
- **위치**: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` L2167-2178
- **상세**: 풀 캐시 키 생성에 비밀번호를 포함하여 SHA-256으로 해시한다. 이 해시는 캐시 키(식별자)로만 사용되고 외부로 노출되지 않는다. 인증이 아닌 pool 무효화 식별 용도로 해시 사용은 적절하다.
- **제안**: 문제 없음.

### **[INFO]** `DB_HOST_BLOCKED` 메시지 — 하드코딩된 일반화 문구로 host/IP 미노출 확인
- **위치**: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` L1816-1819
- **상세**: `DB_HOST_BLOCKED` 발생 시 `IntegrationError`의 `message`를 `'Database host resolves to a private/loopback address blocked by SSRF policy.'`라는 고정 문자열로 설정한다. 차단된 host/IP를 포함하지 않으므로 정찰(reconnaissance) 면을 올바르게 축소한다. 원본 SSRF_BLOCKED 메시지(`hostname "..." resolves to ...`)는 `logUsage` → `toLogError` 경로로 서버 로그에만 기록된다.
- **제안**: 설계가 올바르다. 보안 의도에 부합.

### **[INFO]** catch 블록에서 원본 에러 무시 — 서버 로그 가시성 부분 소실
- **위치**: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` L1813-1820
- **상세**: `catch { throw new IntegrationError('DB_HOST_BLOCKED', ...) }` 패턴에서 원본 `assertSafeOutboundHostResolved` 에러(차단된 host/IP 정보 포함)가 무시된다. `IntegrationError`가 최종 `catch (err)` 블록에서 `toLogError(err)` → `logUsage`로 처리되므로 서버 로그에 `DB_HOST_BLOCKED` 코드와 일반화 메시지가 기록되나, 차단된 실제 host/IP는 서버 로그에도 남지 않는다. 이는 의도적인 정찰 방지 설계다.
- **제안**: 운영 가시성을 높이려면 서버 로그에는 차단 host를 structured field로 기록하는 것을 고려할 수 있다(클라이언트 노출 없이). 보안 취약점은 아니며 선택적 개선 사항이다.

---

## 요약

이번 변경은 Database Query 노드의 SSRF 차단 이벤트를 generic `INTEGRATION_CALL_FAILED` 대신 전용 `DB_HOST_BLOCKED` 에러 코드로 surface하는 것이 핵심이다. 기존 `assertSafeOutboundHostResolved` SSRF 가드(IPv4/IPv6 사설·loopback·link-local·CGNAT 차단, DNS 확인 포함)를 그대로 재사용하면서 catch-wrap 패턴으로 에러 코드를 승격한다. 클라이언트 노출 메시지에 차단 host/IP를 포함하지 않는 일반화 문구를 사용하여 정찰 면을 올바르게 축소하며, 입력 화이트리스트 패턴(CCH-ERR-02/03)도 준수하고 있다. 하드코딩된 시크릿, SQL 인젝션, 인증 우회, XSS, 커맨드 인젝션, 평문 전송 등의 명백한 취약점은 발견되지 않았으며, 기존에 알려진 TOCTOU/DNS-fail-open 한계는 모두 코드 주석으로 문서화되어 있다. 알려진 취약 라이브러리 신규 추가도 없다.

## 위험도

NONE
