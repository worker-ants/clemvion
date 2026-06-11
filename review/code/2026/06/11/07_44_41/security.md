# Security Review

## 발견사항

### **[INFO]** Redis pub/sub 채널 페이로드가 integrationId 평문 전송
- 위치: `integration-cache-bus.service.ts` L540 (`client.publish(INTEGRATION_CACHE_INVALIDATE_CHANNEL, integrationId)`)
- 상세: `integration:cache:invalidate` 채널에 integrationId 를 평문으로 publish 한다. integrationId 는 UUID 형태의 내부 식별자로서 그 자체로 민감 정보는 아니나, Redis 가 인증 없이 노출된 환경이라면 채널을 subscribe 하는 제3자가 어떤 integration 의 자격증명이 회전됐는지 타이밍 정보를 획득할 수 있다. Redis가 적절히 인증/네트워크 격리돼 있다는 전제 하에 운영상 허용 가능한 수준이다.
- 제안: Redis 연결이 반드시 인증(requirepass/ACL) 및 내부 네트워크(VPC/내부망) 격리를 전제로 운영되어야 함을 운영 가이드(spec) 에 명시한다. 코드 변경은 불필요.

### **[INFO]** `errMessage` 함수가 원시 에러 메시지를 로그에 그대로 포함
- 위치: `integration-cache-bus.service.ts` L612–614, L543–546, L572–575, L588–592, L596–599
- 상세: `errMessage(err)` 는 `err.message` 를 변환 없이 logger.warn/error 에 포함한다. Redis 드라이버나 ioredis 가 반환하는 에러 메시지에 연결 문자열(host:port, 비밀번호 등)이 포함될 가능성이 낮지만 완전히 배제할 수 없다. 현재 로그는 서버 사이드(운영자 전용)이므로 외부 노출 위험은 없다. 다만 에러 메시지가 클라이언트 응답에 흘러나가지 않도록 기존 `sanitizeMessage` 패턴을 적용하거나, 이 경로가 응답으로 이어지지 않음을 확인한다.
- 제안: pub/sub 경로의 에러는 응답으로 이어지지 않으므로 현재 패턴(logger.warn + 삼킴)은 적절하다. 추가 조치 불필요.

### **[INFO]** 수신 메시지의 integrationId 입력 검증 범위
- 위치: `integration-cache-bus.service.ts` L565–566, L582–583
- 상세: `onModuleInit` 의 message 핸들러는 채널 일치만 확인한 후 `runInvalidators(message)` 를 호출한다. `runInvalidators` 는 `!integrationId` falsy 체크만 수행한다. Redis pub/sub 메시지는 내부 연결(TLS + ACL)에서만 수신되므로 외부 입력 주입 가능성은 없으나, 만약 Redis ACL 이 취약해 임의 클라이언트가 채널에 publish 할 수 있다면 임의 integrationId 에 대한 pool 무효화가 가능하다. 이는 가용성(denial of service by pool flush) 문제이지 기밀성·무결성 침해는 아니다.
- 제안: Redis ACL 로 publish 권한을 서비스 계정으로 제한(운영 레벨)하고, 코드 레벨에서는 UUID 형식 검증(정규식 일치)을 추가하면 방어 심도를 높일 수 있다. 필수는 아님.

### **[INFO]** e2e 테스트에서 하드코딩된 자격증명 문자열
- 위치: `integration-cache-invalidate.e2e-spec.ts` L2496, L2511 (`'secret-1'`, `'secret-2'`)
- 상세: `createHttpApiKey` 에 전달되는 `apiKey` 값이 테스트 픽스처로 하드코딩돼 있다. 이는 테스트 전용 더미 값이며 실제 시스템 시크릿이 아니므로 보안 위험이 없다.
- 제안: 현재 패턴(테스트 픽스처 더미 값) 유지 가능.

### **[INFO]** `broadcastCredentialChange` 가 회전·삭제 후 throw 없이 완료
- 위치: `integrations.service.ts` broadcastCredentialChange 메서드 (L1069–1073), 호출 지점 L1084, L1093
- 상세: `broadcastCredentialChange` 는 `IntegrationCacheBus.publish` 를 await 한다. `publish` 내부는 모든 실패를 삼키므로 외부에서 throw 될 일이 없다. 이는 intentional fail-safe 설계로, best-effort 캐시 무효화 실패가 credential 회전·삭제 트랜잭션을 롤백하지 않도록 하는 올바른 패턴이다.
- 제안: 현재 설계 적절. 추가 조치 불필요.

---

## 요약

이번 변경은 멀티 인스턴스 환경에서 자격증명 회전 시 인스턴스-로컬 DB 연결 풀을 즉시 무효화하기 위한 Redis pub/sub 버스(`IntegrationCacheBus`)를 도입한다. 보안 관점에서 하드코딩된 시크릿, SQL/커맨드 인젝션, XSS, 인증 우회 등 OWASP Top 10 해당 취약점은 발견되지 않았다. `hashCredentials` 에는 SHA-256 이 적절히 사용됐고, DB 에러 메시지는 `sanitizeMessage` 를 통해 클라이언트로 흘러가지 않도록 처리됐으며, SSRF 방어(assertSafeOutboundHostResolved)도 유지됐다. 보안에 관련된 주의사항은 모두 INFO 수준이며, Redis 인증·네트워크 격리가 운영 수준에서 보장된다는 전제 하에 위험도는 낮다.

## 위험도

NONE
