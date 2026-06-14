# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `AuthConfigUsageCallDto.sourceIp` 타입 불일치 — optional vs 항상 존재
- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` line 483
- 상세: `sourceIp?: string | null` (optional + nullable). 그런데 서비스 반환 타입(`auth-configs.service.ts` line 302)도 `sourceIp: string | null` (non-optional, nullable). DTO 의 `?` optional marker 는 실제 계약과 어긋나며, 소비처에서 `undefined` 도 처리해야 하는지 모호하다. frontend 인터페이스(`page.tsx` line 404) 는 `string | null` 로 일치하게 선언되어 있어 세 지점이 각기 다른 선언을 가진다.
- 제안: DTO 를 `sourceIp: string | null` (non-optional)으로 통일하거나, 세 지점 모두 `string | null | undefined` 의도를 명시적으로 맞춘다.

### [WARNING] `hooks.service.ts` — `handleChatChannelWebhook` 에서 `extractClientIp` 두 번째 직접 호출, `handleWebhook` 과 패턴 불일치
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` diff line 1074
- 상세: `handleWebhook` 은 `const clientIp = extractClientIp(...)` 를 한 번 호출하고 인증·execute 두 곳에 재사용(인라인 중복 제거)한다. 반면 `handleChatChannelWebhook` 에 추가된 코드는 `extractClientIp(input.headers) ?? undefined` 를 execute options 에 직접 인라인으로 호출한다. 두 메서드가 동일한 목적을 위해 서로 다른 패턴을 사용한다.
- 제안: `handleChatChannelWebhook` 에서도 `const clientIp = extractClientIp(input.headers)` 변수로 추출 후 options 에 `sourceIp: clientIp ?? undefined` 로 전달해 `handleWebhook` 과 일관된 패턴을 유지한다.

### [WARNING] `auth-configs.service.ts` — `getUsage` 반환 인터페이스가 메서드 시그니처에 인라인 정의
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` lines 521–305 (diff context)
- 상세: `getUsage` 의 반환 타입이 메서드 시그니처에 `Promise<{ totalCalls: number; lastUsedAt: Date | null; periodCounts: {...}; recentCalls: Array<{...}> }>` 형태로 인라인 객체 리터럴로 선언되어 있다. DTO 클래스(`AuthConfigUsageDto`, `AuthConfigUsagePeriodCountsDto`, `AuthConfigUsageCallDto`)가 이미 존재하는데, 서비스 내부 반환 타입만 별도 인라인 shape 를 사용한다. 이로 인해 DTO 변경 시 서비스 반환 타입도 별도로 동기화해야 하는 중복이 생긴다.
- 제안: 서비스 내부용 인터페이스를 별도 타입/인터페이스로 추출하거나, 이미 존재하는 DTO 타입을 서비스 반환 타입으로 재사용하는 방향을 검토한다. 최소한 인라인 복잡 타입을 named interface 로 파일 상단에 분리한다.

### [INFO] `USAGE_PERIOD_WINDOWS_MS` 상수 — 산술 표현식 vs 리터럴
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` lines 281–284
- 상세: 상수가 `24 * 60 * 60 * 1000` 형태로 산술 표현식으로 정의되어 있다. 이는 의미 전달은 명확하지만, TypeScript `as const` 와 함께 사용 시 타입 추론이 특정 숫자값이 아닌 `number` 로 넓어질 수 있다. 실제로 `as const` 가 붙어 있어 tuple 값 타입은 유지되지만, 숫자 연산이 반복되면 리터럴 타입이 아닌 `number` 로 추론된다. 기능적 문제는 없으나 스타일 가이드에 따라 컴파일 타임 상수 혹은 주석으로 단위를 명시하는 것이 일관적이다.
- 제안: 현행 패턴은 다른 상수들과 일관되면 유지해도 무방. 단위 명확성을 위해 주석 `// ms` 가 이미 있으므로 추가 조치는 불필요.

### [INFO] `page.tsx` BarChart 데이터 배열 — 컴포넌트 렌더링 내 인라인 객체 생성
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` lines 1434–1447 (diff)
- 상세: `BarChart data` 에 전달되는 배열 `[{ label: t(...), count: ... }, ...]` 이 JSX 렌더링 함수 내에 직접 인라인으로 생성된다. `usageData.periodCounts` 가 변경될 때마다 매 렌더에서 새 배열 참조가 생성된다. 기능상 문제는 없지만, `useMemo` 로 메모화하거나 헬퍼 함수로 추출하면 렌더 함수 크기를 줄이고 데이터 변환 로직을 분리할 수 있다. 이 파일이 이미 God Component 이슈(ai-review WARNING 1·4 추적 중)로 지목된 상황에서 추가 인라인 로직은 복잡도를 높인다.
- 제안: `const periodChartData = useMemo(() => [...], [usageData.periodCounts, t])` 로 추출한다. God Component 분리 후속 작업 시 함께 이동.

### [INFO] `auth-configs.service.spec.ts` — `makeExecutionRepo` 내 QB mock 체이닝 패턴이 기존 테스트의 mock 구조와 일관성 확인 필요
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` lines 133–151
- 상세: 새로 추가된 `makeExecutionRepo` 헬퍼 함수가 `qb` 객체를 직접 반환하는 구조를 취한다. 기존 파일의 다른 테스트들이 TypeORM repository mock 을 어떻게 구성하는지와 패턴 일관성이 필요하다. 새 헬퍼는 `{ qb, createQueryBuilder }` 두 개를 함께 반환하는 독자적인 형태이다. 파일 내 다른 helper 들이 `makeAuthConfigRepo()` 와 같이 단일 반환 구조를 사용한다면 패턴 혼재가 발생한다.
- 제안: 파일 내 기존 mock 헬퍼 패턴과 일치하도록 구조를 맞추거나, 새 패턴이 더 유용하다면 기존 헬퍼도 점진적으로 통일한다.

### [INFO] `response_code VARCHAR(10)` 길이 — HTTP 상태 코드 저장에 10자는 충분하나 근거 명시
- 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` lines 56–57
- 상세: `VARCHAR(10)` 은 3자리 HTTP 상태 코드에 충분하지만, 주석에는 성공 경로 `'202'` 만 예시로 언급된다. 실제로 이 컬럼이 HTTP 코드 외 `status` enum 폴백값(`'completed'`, `'failed'` 등)도 저장될 수 있는지 migration 레벨에서 불분명하다. 서비스 레이어(`getUsage`) 에서는 폴백 로직이 있지만, migration 주석만 봐서는 컬럼이 HTTP 코드 전용인지 구분이 안 된다.
- 제안: migration SQL 주석에 "이 컬럼은 webhook 실행의 실제 HTTP 응답 코드만 저장. `getUsage` 가 NULL인 경우 status enum 으로 UI 폴백하지만, 폴백값은 이 컬럼에 기록되지 않는다" 를 명시한다.

## 요약

전반적으로 변경 코드는 유지보수성이 양호하다. 상수 정의(`USAGE_PERIOD_WINDOWS_MS`, `WEBHOOK_ACCEPTED_RESPONSE_CODE`), SQL 마이그레이션 주석, 스펙 참조(`§A.3`, `WH-MG-05`) 등 의도 전달이 충실하다. 주요 유지보수성 우려는 두 가지다. 첫째, `handleWebhook` 과 `handleChatChannelWebhook` 이 `extractClientIp` 호출 방식에서 패턴 불일치를 보여 향후 유사 경로 추가 시 혼란 가능성이 있다. 둘째, `getUsage` 의 복잡한 반환 타입이 인라인 인터페이스로 정의되어 DTO 클래스와 이중 유지가 필요하다. 나머지 발견사항은 INFO 수준으로 기능에 영향을 주지 않으나, God Component(authentication/page.tsx) 분리 후속 작업 시 함께 정리되어야 할 인라인 데이터 변환 코드가 추가되었다는 점을 기록해 둔다.

## 위험도

LOW
