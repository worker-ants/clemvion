# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `isCafe24RefreshCapable` 및 `tryRecoverExpired` 의 `credentials` 타입 캐스팅 — 런타임 검증 없이 `as Record<string, unknown>` 으로 캐스팅 후 `refresh_token` 문자열 여부만 확인
  - 위치: `integration-expiry-scanner.service.ts` (추가된 `isCafe24RefreshCapable` 함수, 라인 ~272-280) / `cafe24-mcp-tool-provider.ts` (`tryRecoverExpired`, 라인 ~1166-1173)
  - 상세: 두 곳 모두 `credentials` 필드를 `Record<string, unknown> | null | undefined` 로 캐스팅한 뒤 `refresh_token` 의 타입·길이만 확인한다. `credentials` 는 DB 에서 AES 복호화되는 JSONB 컬럼이며 사용자가 제어하는 입력이 직접 저장될 수 있다. 현재 코드는 `rt.length > 0` 만 요구하므로 공백 문자열 한 글자('` `')도 통과한다. 다만 이후 실제 refresh 시도 시 Cafe24 API 가 `invalid_grant` 를 반환해 결국 실패하므로 실질적 보안 피해는 없고 동작 오류(불필요한 큐 enqueue)에 그친다.
  - 제안: `rt.trim().length > 0` 으로 공백 단독 값을 사전에 거르거나, 공통 credentials 유효성 검사 유틸을 활용하는 것이 방어적 코딩 관점에서 바람직하다.

- **[INFO]** `logger.warn` 에 `integration.id` (UUID) 가 포함됨 — 내부 식별자의 로그 노출
  - 위치: `cafe24-mcp-tool-provider.ts` `tryRecoverExpired` 내부 warn 구문 (라인 ~1183, ~1198) / `integration-expiry-scanner.service.ts` warn 구문 (라인 ~245)
  - 상세: 로그에 integration ID(UUID)가 출력된다. 이는 기존 코드베이스의 공통 패턴과 일치하며 서버 사이드 로그이므로 외부 사용자에게 노출되지 않는다. 그러나 로그 수집 시스템에 접근 가능한 내부 공격자가 특정 integration UUID를 알 수 있는 수준의 정보 노출이다. 민감한 자격증명(access_token, refresh_token 값 자체)은 로그에 포함되지 않으므로 현재 구현은 적절하다.
  - 제안: 현재 수준 유지. 기존 패턴과 일관성이 있으며 UUID 자체는 접근 제어의 비밀 키로 사용되지 않는다.

- **[INFO]** `refreshTokenViaQueue` 의 폴백 경로 (큐 미바인딩 시 `refreshAccessToken` 직접 호출)
  - 위치: `cafe24-api.client.ts` `refreshTokenViaQueue` 함수 (라인 ~1251-1256)
  - 상세: 테스트 환경을 위해 `this.refreshQueue && this.refreshQueueEvents` 가 falsy 이면 `refreshAccessToken` 을 직접 호출한다. 이 경로는 `jobId = integrationId` BullMQ dedup 을 우회하므로, 만약 프로덕션에서 큐가 의도치 않게 미바인딩된 경우 멀티 인스턴스 refresh race 가 재발할 수 있다. 현재는 테스트 전용 경로이고, 프로덕션에서는 반드시 큐가 주입되도록 DI 설정이 보장되어야 한다.
  - 제안: 프로덕션 환경에서 큐 미바인딩이 발생한 경우 오류를 명시적으로 throw 하거나, 로그에 WARN 수준으로 "큐 없이 직접 refresh" 경고를 추가해 의도치 않은 폴백이 모니터링에 잡히도록 한다. 현재 폴백은 silent fail 에 가깝다.

- **[INFO]** `source` 파라미터의 타입 제한이 함수 시그니처에만 존재 — 외부 호출 시 타입 우회 가능
  - 위치: `cafe24-api.client.ts` `refreshTokenViaQueue(integration, source: 'proactive' | 'background' = 'background')` (라인 ~1249)
  - 상세: TypeScript 타입 시스템이 `source` 값을 `'proactive' | 'background'` 로 제한하지만, 런타임에는 어떤 문자열도 전달될 수 있다. 이 값이 BullMQ payload 의 `source` 필드로 직접 흘러가 진단·메트릭 라벨로 사용된다. 현재 consumer (`Cafe24TokenRefreshProcessor`) 가 `source` 값을 검증하거나 분기에 사용하는지에 따라 위험도가 달라지지만, 메트릭 라벨 오염 수준에 그친다. 코드 내 어디에도 `source` 를 명령 실행이나 SQL 구성에 사용하지 않으므로 인젝션 위험은 없다.
  - 제안: 낮은 우선순위. 필요하다면 런타임에서 허용 값 집합 검사를 추가하거나, `source` 필드를 enum 으로 관리한다.

- **[INFO]** 테스트 픽스처에 토큰 값으로 단순 문자열 리터럴(`'a'`, `'r'`, `'r-valid'`) 사용
  - 위치: `integration-expiry-scanner.service.spec.ts` (라인 ~70-75, ~128-134, ~168-173) / `cafe24-mcp-tool-provider.spec.ts` (픽스처 내 `credentials`)
  - 상세: 테스트 파일이므로 실제 자격증명 노출 문제는 아니다. 명백히 더미 값이며 하드코딩된 시크릿이 아니다. 다만 토큰 형식 검증 로직이 추가될 경우 이 더미 값들이 검증을 통과하지 못할 수 있어 테스트 유지보수성 측면에서 확인이 필요하다.
  - 제안: 현재 구조 유지. 실제 자격증명 패턴을 모사하는 픽스처 상수를 별도 파일로 분리하면 향후 유지보수가 용이하다.

- **[INFO]** `mcpDiagnosticsAcc` (McpServerSummary 배열)가 노드 메타로 그대로 emit됨
  - 위치: `ai-agent.handler.ts` `buildMcpDiagnosticsMeta` 헬퍼 (라인 ~569-574) 및 메타 emit 구문 (라인 ~473, ~1481)
  - 상세: `McpServerSummary` 에 포함된 `integrationId` (UUID) 와 `serviceType` 이 AI Agent 노드 실행 결과 메타에 포함되어 프론트엔드 LlmInformationTab 등에 노출된다. 이는 설계 의도이나, 해당 메타가 워크플로 실행 결과에 접근 가능한 모든 사용자에게 노출될 수 있음을 인지해야 한다. `skipReason` 도 함께 노출되어 "어떤 통합이 어떤 이유로 사용 불가" 정보가 외부로 전달된다. 같은 워크스페이스 내 사용자 간에는 이 정보 공유가 허용 범위인지 확인이 필요하다.
  - 제안: `mcpDiagnostics` 메타의 접근 제어가 워크플로 실행 결과 접근 권한과 동일 수준인지 확인한다. 추가 필터링이 필요하다면 `credentials` 와 동일하게 응답 직렬화 단계에서 redact 대상에 포함한다.

---

## 요약

이번 변경(cafe24-expired-self-healing)은 보안 취약점을 새로 도입하지 않는다. 핵심 보안 요소인 credentials 암호화(AES transformer)는 기존 패턴을 그대로 활용하고, refresh 진입점은 모두 BullMQ 큐 경유로 단일화되어 race condition 방어가 유지된다. 로그에 포함되는 정보는 integration UUID 수준이며 access_token/refresh_token 값 자체는 포함되지 않는다. 가장 주목할 점은 `refreshTokenViaQueue` 의 큐 미바인딩 폴백 경로인데, 프로덕션에서 미바인딩이 발생해도 silent 직접 refresh 로 처리되어 dedup 보장이 깨질 수 있다. 이는 기능적 race 위험이지 직접적 보안 취약점은 아니다. 신규 공개 API 서피스(`mcpServerSummaries` 메타)의 접근 제어가 기존 실행 결과 접근 권한과 동일 수준인지 운영 측면에서 확인을 권장한다.

## 위험도

LOW
