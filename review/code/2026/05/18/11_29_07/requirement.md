# 요구사항(Requirement) 리뷰

## 발견사항

### 1. 기능 완전성

- **[INFO]** `plan/in-progress/cafe24-expired-self-healing.md` 체크박스 A~D 중 미체크 항목 다수 잔존
  - 위치: `plan/in-progress/cafe24-expired-self-healing.md` §A, §B, §C(잔여), §D
  - 상세: plan 항목 A(`run()` 0d cafe24 enqueue)·B(`buildTools` expired refresh-then-include)·D(`mcpDiagnostics` skipReason 노출)의 모든 세부 체크박스가 `[ ]` 상태이고 §C에 `잔여 spec 보강` 1건이 아직 미완. 이에 반해 실제 diff를 보면 A·B·D 기능이 모두 구현되어 있어 plan 문서와 구현 간 불일치가 있다. plan이 아직 `in-progress/` 폴더에 있는 것은 맞으나 체크박스 미동기화 상태는 작업 완료 여부 추적을 불투명하게 만든다.
  - 제안: 구현·테스트가 완료된 항목(`A`, `B`, `D`)의 체크박스를 `[x]`로 갱신하고, C의 잔여 spec 보강(`§9.6` Rationale 에 buildTools 3번째 진입점 등록) 완료 후 plan을 `plan/complete/`로 이동.

- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md §9.6` Rationale에 buildTools 3번째 refresh 진입점 미등록
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.6
  - 상세: plan §C의 "잔여 spec 보강" 항목으로 명시된 작업이 이번 diff에 포함되지 않았다. Spec §9.6의 Rationale에는 여전히 proactive/background refresh 두 진입점만 기술되어 있고, `buildTools()` 단계의 세 번째 진입점이 누락된 상태이다.
  - 제안: 후속 commit에서 `spec/4-nodes/4-integration/4-cafe24.md §9.6`에 "buildTools 단계 expired 자가 회복" 진입점을 추가하거나, 이번 diff 내 `§9.6` Rationale 갱신이 반영된 것을 확인.

### 2. 엣지 케이스

- **[WARNING]** `tryRecoverExpired`에서 non-auth 오류도 `expired_refresh_failed`로 통일해 skipReason 의미 손실
  - 위치: `cafe24-mcp-tool-provider.ts` `tryRecoverExpired` 메서드 (약 1180~1186행)
  - 상세: transport 오류·Redis 장애 등 non-auth 오류가 발생해도 `expired_refresh_failed`를 반환한다. 사용자 입장에서 `expired_refresh_failed`는 "invalid_grant로 인증 실패"를 연상시키므로, 실제로는 일시적 인프라 장애인 경우에도 "재인증 필요"로 오해할 수 있다. 스펙(§8.6 표)도 `expired_refresh_failed`를 "invalid_grant로 실패" 케이스로 정의하고 있어 의미 충돌이 발생한다.
  - 제안: non-auth 오류에 대해 별도 `skipReason`(예: `expired_refresh_network_error`) 또는 `lookup_failed`를 사용하거나, 주석에 "일시 오류도 동일 reason 사용"임을 spec과 명시적으로 정합시킬 것.

- **[WARNING]** `isCafe24RefreshCapable` 함수: `credentials`가 암호화된 상태로 전달될 경우 `refresh_token` 판별 불가
  - 위치: `integration-expiry-scanner.service.ts` `isCafe24RefreshCapable` 함수 (약 272~280행)
  - 상세: `Integration.credentials`는 `credentials-transformer.ts`에 의해 AES 암호화된 JSONB로 저장된다. ORM 레이어(TypeORM column transformer)를 통해 조회된 entity라면 복호화가 자동 수행되지만, 특정 raw query나 단순 SELECT로 가져온 경우 암호화 blob에 대해 `rt.length > 0` 체크가 true가 되어 잘못된 분기로 진입할 수 있다. 현재 코드에 단위 테스트 픽스처도 plain JSON credentials를 직접 사용하므로 실제 환경과 다른 경로를 테스트하는 셈이다.
  - 제안: `integrationRepo.find()`가 TypeORM entity transformer를 통해 복호화된 credentials를 반환함을 코드 주석으로 명시하거나, transformer 적용 여부를 확인하는 통합 테스트를 추가.

- **[INFO]** `tryRecoverExpired`에서 worker의 status 전이 타이밍 race: `refreshTokenViaQueue`가 반환하는 시점에 worker가 DB 갱신을 아직 완료하지 않았을 가능성
  - 위치: `cafe24-mcp-tool-provider.ts` `tryRecoverExpired` 메서드 후반부 fresh row 재조회
  - 상세: `refreshTokenViaQueue`는 BullMQ 큐에 job을 enqueue하고 완료를 기다리는 방식(`refreshViaQueue`)이지만, worker가 DB commit까지 원자적으로 완료하는 보장 타이밍과 본 코드의 재조회 시점이 겹칠 수 있다. 테스트에서는 mock으로 처리해 이 race를 검증하지 않는다.
  - 제안: `refreshViaQueue`의 내부 구현이 job 완료를 대기하는지 명시하거나, 재조회 후 `status !== 'connected'`이면 `expired_refresh_failed`로 처리하는 현재 폴백 로직이 이 race를 커버함을 주석으로 명시.

### 3. TODO/FIXME

- **[INFO]** `mcp-diagnostics.ts` 파일 상단 주석에 follow-up 범위 명시 — 미완성이지만 의도된 것
  - 위치: `mcp-diagnostics.ts` 상단 주석 (약 1983~1986행)
  - 상세: "나머지 필드(`attempted / serverCount / toolCalls / resourceReads / promptGets / errors`)는 follow-up으로 확장"이라 명시되어 있다. 이는 TODO가 아닌 명시적 범위 축소이므로 문제없으나, 후속 PR이 없을 경우 spec §6.2의 `serverCount` 계산식(`= serverSummaries[] 중 status='connected' 행 수`)이 현재 아직 연산되지 않는 상태이다.
  - 제안: `serverCount` 계산과 `serverSummaries[]`의 연동이 follow-up PR 계획에 포함되어 있는지 plan에 명시.

### 4. 의도와 구현 간 괴리

- **[WARNING]** 스캐너 테스트: `does not crash scan when cafe24 refresh enqueue throws` — 알림 발사 여부를 검증하지 않음
  - 위치: `integration-expiry-scanner.service.spec.ts` "does not crash scan when cafe24 refresh enqueue throws" 케이스 (약 158~196행)
  - 상세: 주석에 "알림은 그대로 발사"라고 명시되어 있고 코드 구현 측 주석(파일 2, 243~244행)에도 "알림은 그대로 발사하여 사용자에게 가시성 유지"라고 기술되어 있으나, 해당 테스트 케이스에서 `notificationsService.createMany`가 호출되었는지 검증하는 단언(`expect(notificationsService.createMany).toHaveBeenCalled()`)이 없다. 구현 의도와 테스트 검증 사이의 공백.
  - 제안: `enqueue 실패` 케이스에서도 `notificationsService.createMany`가 호출되는지 검증하는 단언 추가.

- **[INFO]** `refreshTokenViaQueue` 메서드 docstring: "큐 미바인딩 시 in-process refreshAccessToken으로 폴백" — 의도와 실 동작 주의
  - 위치: `cafe24-api.client.ts` `refreshTokenViaQueue` 메서드 (약 1247~1256행)
  - 상세: "큐 미바인딩(테스트 환경) 시 in-process `refreshAccessToken`으로 폴백"이라고 주석에 있다. 그런데 `buildTools`에서 `refreshTokenViaQueue`를 호출하는 목적이 "BullMQ jobId dedup 경로 강제"이므로, 큐가 바인딩되지 않은 환경에서의 직접 refresh는 해당 목적을 달성하지 못한다. 프로덕션에서는 항상 큐가 바인딩되므로 실질 위험은 낮지만, 테스트 환경에서는 dedup 없이 실행되는 경로임을 명확히 해야 한다.
  - 제안: docstring에 "프로덕션 환경에서는 refreshQueue가 항상 주입되므로 폴백 경로는 테스트 전용"임을 명시.

### 5. 에러 시나리오

- **[CRITICAL]** `enqueues cafe24-token-refresh at 0d for cafe24 + refresh_token` 테스트: `expect(scanner.run(now)).resolves.toBeDefined()` 없음 — run()이 reject하면 테스트가 통과할 수 없지만 `scanner.run(now)` 자체의 완료 단언이 누락
  - 위치: `integration-expiry-scanner.service.spec.ts` 약 83행 (`await scanner.run(now)`)
  - 상세: "does not crash" 케이스(약 182행)에서는 `resolves.toBeDefined()`로 비동기 완료를 단언하지만, 핵심 성공 케이스(`enqueues cafe24-token-refresh at 0d`)는 단순 `await scanner.run(now)`로 호출한 뒤 개별 mock 검증만 수행한다. 이는 같은 파일의 다른 테스트와 일관성이 없다. `await`이 reject를 throw하므로 실질 위험은 낮으나, 테스트 의도 명확성 측면에서 불일치.
  - 제안: 일관성을 위해 `await expect(scanner.run(now)).resolves.not.toThrow()` 또는 `resolves.toBeDefined()` 형태로 통일.

- **[WARNING]** `Cafe24McpToolProvider.buildTools()`: `serviceType !== 'cafe24'`인 integration을 가리키는 ref에 대한 summary push 없음
  - 위치: `cafe24-mcp-tool-provider.ts` 약 1067행 (`if (integration.serviceType !== 'cafe24') continue;`)
  - 상세: `mcpServers[]`에 등록되었으나 `serviceType !== 'cafe24'`인 경우 `McpToolProvider`가 처리할 것을 기대하고 아무런 summary를 push하지 않고 넘어간다. 하지만 `McpToolProvider`가 해당 ref에 대한 summary를 push하지 않으면 `serverSummaries[]`에서 해당 통합이 아예 누락되어 사용자가 왜 tool이 없는지 알 수 없다. 스펙 §6.2의 `not_capable` skipReason이 이 케이스를 위해 vocabulary에 정의되어 있음에도 미사용.
  - 제안: `not_capable` skipReason을 push하거나, 각 provider가 자신이 처리하지 않는 ref에 대해 아무것도 push하지 않는 것이 의도된 설계임을 스펙과 코드 주석에 명시. 현재 주석("McpToolProvider가 본 ref를 처리하므로 본 provider의 summary에는 포함하지 않는다")이 있지만 McpToolProvider 측에서 실제로 push하는지 이번 diff에서 확인되지 않는다.

- **[INFO]** `scanner.run()` enqueue 실패 시 알림이 발사된다고 하지만, 알림 발사 로직이 `0d` 분기 이후에 위치하는지 확인 필요
  - 위치: `integration-expiry-scanner.service.ts` 약 257행 이후
  - 상세: diff 컨텍스트가 truncated되어 `const recipients = recipientsByIntegration.get(integration.id)` 이후의 알림 발사 코드 전체를 확인할 수 없다. 알림 발사가 `isCafe24RefreshCapable` 분기 외부에 있다면 enqueue 실패 시에도 발사되지만, 분기 내부에 있다면 catch 블록에서의 알림 발사 누락이 발생할 수 있다.
  - 제안: 알림 발사 로직이 cafe24/비cafe24 분기와 무관하게 `0d` 분기 처리 이후 공통 경로에 있음을 코드 확인 후 테스트에서 단언.

### 6. 데이터 유효성

- **[WARNING]** `isCafe24RefreshCapable`과 `tryRecoverExpired` 모두 `credentials` null 체크를 각각 독립적으로 수행 — 공통 유틸 부재
  - 위치: `integration-expiry-scanner.service.ts` (~274행), `cafe24-mcp-tool-provider.ts` (~1166행)
  - 상세: 두 곳 모두 `const creds = integration.credentials as Record<string, unknown> | null | undefined; const rt = creds?.refresh_token;` 패턴을 반복한다. 동일 로직이 두 파일에 산재해 향후 credentials 구조 변경 시 한 곳을 놓치는 위험이 있다.
  - 제안: `hasRefreshToken(integration: Integration): boolean` 유틸 함수를 공통 위치(예: `cafe24-token-refresh.constants.ts` 또는 별도 `cafe24-credentials.utils.ts`)에 추출하고 두 곳에서 참조.

- **[INFO]** `McpServerSummary.toolCount`가 skipped 행에서 항상 0으로 hardcoded — 유효성 제약이 타입에 없음
  - 위치: `mcp-diagnostics.ts` `McpServerSummary` 인터페이스
  - 상세: 스펙과 주석에 "skipped 행은 항상 0"이라고 명시되어 있으나 TypeScript 타입에서는 이를 강제하지 않는다. 향후 provider 구현 오류로 skipped 행에 non-zero toolCount가 들어올 수 있다.
  - 제안: 현재 수준에서는 런타임 검증보다 주석으로 충분하나, 타입을 discriminated union으로 분리(`status: 'connected'`일 때 `toolCount: number`, `status: 'skipped'`일 때 `toolCount: 0`)하면 컴파일 타임 보장 가능.

### 7. 비즈니스 로직

- **[WARNING]** `connected-expiry` scanner가 cafe24 0d enqueue 후 알림(`integration_expired`)을 발사하는데, worker가 refresh에 성공하면 "만료 알림"이 잘못된 것이 됨
  - 위치: `integration-expiry-scanner.service.spec.ts` 약 112~120행 (`notificationsService.createMany` 단언), `spec/2-navigation/4-integration.md §11.1`
  - 상세: spec §11.1 표와 의사코드 모두 0d cafe24 분기에서 enqueue + 알림을 동시에 발사하도록 명세되어 있고 구현도 이를 따른다. 그러나 worker가 refresh를 성공하면 사용자에게는 만료되지 않은 상태(connected 유지)가 되므로, 이미 발사된 `integration_expired` 알림이 불필요한 불안감을 줄 수 있다. 이는 설계상 결정("알림은 그대로 발사하여 사용자에게 가시성 유지")이므로 CRITICAL은 아니나 사용자 경험 측면의 trade-off.
  - 제안: spec에 "refresh 성공 후 알림 취소 또는 '갱신 성공' 후속 알림 미발사"가 의도된 설계임을 명확히 기록하거나, 향후 follow-up으로 "refresh 성공 시 알림 철회" 로직 검토를 plan에 추가.

- **[INFO]** `cafe24-background-refresh` 잡과 `connected-expiry` 0d 분기가 동일 integration에 대해 동시에 enqueue될 수 있는 타이밍 — dedup으로 처리되지만 `source` 값이 'background'로 충돌
  - 위치: `integration-expiry-scanner.service.ts` enqueue opts, `spec/2-navigation/4-integration.md §11.1`
  - 상세: 두 잡 모두 `jobId = integrationId`로 dedup되고 `source: 'background'`를 사용한다. dedup으로 한 번만 실행되므로 기능적 중복은 없으나, 메트릭·진단 라벨링에서 두 진입점이 구분되지 않는다. spec §9.6(Rationale)에 두 진입점이 명시적으로 별개의 역할임을 기술하고 있어 추적 가능성 개선 필요 여부 검토.
  - 제안: 현재 설계 의도대로라면 무방. 향후 메트릭 세분화 필요 시 `source: 'scanner_0d_expiry'` 등 별도 값을 고려.

### 8. 반환값

- **[INFO]** `buildMcpDiagnosticsMeta` 정적 메서드: `summaries.length === 0`일 때 `undefined` 반환 후 `?? {}`로 spread — 빈 `mcpDiagnostics` 키가 meta에 절대 포함되지 않음을 보장
  - 위치: `ai-agent.handler.ts` `buildMcpDiagnosticsMeta` 메서드 (약 569~574행), 호출 지점 (약 1480행)
  - 상세: `summaries`가 비어있으면 `undefined`를 반환하고 호출 측에서 `?? {}`로 처리해 아무 키도 추가되지 않는다. 이는 "비어있으면 omit" 의도와 정확히 일치한다. 반환값 경로 완전성 문제 없음.

- **[INFO]** `tryRecoverExpired` 반환 타입: 모든 분기가 명시적으로 값을 반환 — 완전성 확인
  - 위치: `cafe24-mcp-tool-provider.ts` `tryRecoverExpired` 전체
  - 상세: `install_timeout` → skipped, `refresh_token 없음` → skipped, `refreshViaQueue throw(auth)` → skipped, `refreshViaQueue throw(other)` → skipped, `재조회 실패` → skipped(lookup_failed), `fresh.status !== 'connected'` → skipped, `status === 'connected'` → recovered. 모든 경로가 명시적으로 반환값을 제공하며 TypeScript 타입도 discriminated union으로 선언되어 있어 컴파일 타임 완전성 보장.

---

## 요약

이번 변경은 Cafe24 통합의 `expired` 자가 회복 요구사항을 두 방어선(스캐너 0d 분기의 enqueue 전환 + buildTools의 refresh-then-include)으로 구현하고 mcpDiagnostics skipReason을 노출하는 기능을 담고 있다. 핵심 비즈니스 로직(isCafe24RefreshCapable 분기, tryRecoverExpired의 install_timeout/no_refresh_token/auth_failed/non-auth 분기)은 스펙 §8.6과 정합하며 테스트 커버리지도 주요 경로를 망라한다. 다만 몇 가지 요구사항 관점의 미비점이 있다: (1) enqueue 실패 시 알림 발사 여부를 단언하는 테스트가 누락되어 "알림 그대로 발사" 요구사항이 테스트로 검증되지 않고, (2) serviceType이 cafe24가 아닌 ref에 대해 `not_capable` skipReason을 push하지 않아 `McpToolProvider` 측 summary push 여부에 따라 serverSummaries[]가 불완전해질 수 있으며, (3) non-auth 오류도 `expired_refresh_failed`로 분류하는 것이 스펙 vocabulary와 의미 충돌을 일으킨다. plan 체크박스 미동기화와 §9.6 Rationale 잔여 spec 보강도 후속 처리가 필요하다.

## 위험도

MEDIUM
