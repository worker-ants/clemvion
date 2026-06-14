# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `getUsage` 반환 타입 확장 — 기존 호출자 breaking change
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `getUsage()` 반환 타입 (diff +397~+405)
- 상세: `getUsage()` 의 반환 타입에 `periodCounts` 필드와 `recentCalls` 아이템에 `sourceIp`/`responseCode` 가 추가됐다. TypeScript 타입 시스템상 반환 타입 확장은 소비자를 직접 깨뜨리지 않으나, 컨트롤러나 다른 서비스가 반환값을 구조 분해하거나 `as` 캐스팅해 사용 중이라면 런타임 shapemismatch 가 발생할 수 있다. DTO(`AuthConfigUsageDto`) 도 동시에 변경됐으므로 Swagger 문서와 API 클라이언트 계약이 즉시 바뀐다 — 기존 API 소비자(외부 클라이언트, 통합 테스트 픽스처 등)는 새 필드가 포함된 응답을 받게 된다.
- 제안: 컨트롤러 레이어에서 `getUsage` 를 호출하는 경로가 DTO 로 정확히 매핑되는지 확인하고, 계약 변경임을 API 버전 또는 체인지로그에 명시한다.

### [WARNING] `ExecuteOptions` 타입 유니언 확장 — 기존 `triggerId` variant 호출자 영향
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `ExecuteOptions` 타입 (diff +558~+766)
- 상세: `triggerId` variant 에 `sourceIp?: string` / `responseCode?: string` 두 선택적 프로퍼티가 추가됐다. 기존 `{ triggerId: 't1' }` 형태의 호출은 그대로 유효하나, 이 타입을 직접 참조해 narrow 하거나 `keyof` 로 순회하는 코드가 있다면 의도치 않게 새 키를 포함하게 된다. `hooks.service.ts` 외에도 `triggerId` variant 로 `execute()` 를 호출하는 경로(다른 서비스·테스트)에서 `sourceIp`/`responseCode` 를 넘기지 않으면 `null` 로 DB 저장되는데, 이는 의도된 동작이지만 호출자가 의식하지 못하고 누락할 가능성이 있다.
- 제안: `triggerId` variant 로 호출하는 다른 호출자(예: 재실행·체인 실행 경로)가 있는지 검색해 누락 없는지 확인한다.

### [INFO] `WEBHOOK_ACCEPTED_RESPONSE_CODE` 모듈 수준 상수 도입 — 전역은 아님, 범위 적절
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (diff +1031)
- 상세: `const WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED)` 는 모듈 스코프 상수로, 전역 변수가 아니다. `HttpStatus` import 를 추가하지만 부수효과는 없다. `String(202)` = `'202'` 로 고정돼 런타임 부수효과 없음.
- 제안: 이슈 없음.

### [INFO] `USAGE_PERIOD_WINDOWS_MS` 상수 도입 — 모듈 스코프, 부수효과 없음
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (diff +351~+355)
- 상세: `as const` 객체 상수로, 변이 불가. 전역 상태 변경 없음.
- 제안: 이슈 없음.

### [INFO] `safeUsageCount` 순수 함수 — 부수효과 없음
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (diff +361~+364)
- 상세: 입력만 읽고 출력을 반환하는 순수 함수. 외부 상태 변경 없음.
- 제안: 이슈 없음.

### [INFO] `extractClientIp` 호출 위치 이동 — 인증 이전으로 선행됨
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `handleWebhook` (diff +1041~+1051)
- 상세: 기존에는 `extractClientIp` 가 `authenticate()` 내부에서 인라인 호출됐다(인증 검증 전용). 이제 인증 블록 이전에 `const clientIp = extractClientIp(input.headers)` 로 한 번만 호출하고 인증과 호출 이력 영속 두 곳에 공용으로 사용한다. `extractClientIp` 가 순수 함수(헤더 읽기 전용)이고 실패 시 `undefined` 반환이라면 이 변경은 안전하다. 그러나 `extractClientIp` 내부에서 로깅·메트릭 등 부수효과가 있다면 호출 횟수가 줄어 그 부수효과도 줄어든다(기존 인증 경로에서 1회 → 전체에서 1회). 현 코드베이스에서 `extractClientIp` 는 헤더 파싱 전용이므로 실질 부수효과는 없다.
- 제안: `extractClientIp` 구현이 변경될 경우 이 공용 호출 패턴을 인지해야 함을 주석으로 남기는 것이 좋다(이미 W-9 메모로 주석에 명시돼 있어 적절함).

### [INFO] `handleChatChannelWebhook` 에서 `extractClientIp` 신규 호출 추가
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `handleChatChannelWebhook` (diff +2073~+2075)
- 상세: 기존 `handleChatChannelWebhook` 에는 `extractClientIp` 호출이 없었다. 이제 헤더 파싱을 1회 추가로 수행한다. 헤더 파싱만 하는 함수이므로 네트워크 호출·파일시스템·외부 상태 변경은 없다. 추출 결과 `clientIp` 가 null/undefined 이면 `clientIp ?? undefined` 로 `sourceIp: undefined` 가 되고, `execute()` 내에서 `'sourceIp' in options` 로 narrowing 시 `undefined` 가 `null` 로 저장된다(의도된 동작). `?? undefined` 를 쓰면 `in options` 체크에서 `sourceIp` 키가 존재해 분기가 실행되므로, `null` 이 아닌 `null`(`undefined` → `?? null`)로 저장된다. 실제 흐름: `clientIp = null` → `null ?? undefined = undefined` → options에 `sourceIp: undefined` 존재 → `'sourceIp' in options = true` → `options.sourceIp ?? null = null` → DB `NULL`. 의도와 일치한다.
- 제안: 이슈 없음. 동작 정확함.

### [INFO] DB 스키마 영구 변경 — `execution` 테이블에 컬럼 2개 + 인덱스 추가
- 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql`
- 상세: `ALTER TABLE execution ADD COLUMN ...` 은 돌이킬 수 없는 스키마 변경이다. 다운 스크립트가 주석으로 제공돼 있고, 두 컬럼 모두 `NULL` 기본값이므로 기존 row 에 회귀 없음. `CREATE INDEX IF NOT EXISTS` 는 멱등하다. partial index (`WHERE trigger_id IS NOT NULL`) 는 schedule/manual 행을 제외해 인덱스 크기를 최소화하는 의도된 설계다.
- 제안: 이슈 없음.

### [INFO] DTO 공개 API 필드 추가 — `AuthConfigUsageDto` breaking
- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` (diff +502~+566)
- 상세: `AuthConfigUsageDto` 에 `periodCounts` 필드가 추가되고 `AuthConfigUsageCallDto` 에 `sourceIp`/`responseCode` 가 추가됐다. REST API 응답 shape 이 확장되므로, 엄격하게 응답을 검증하는 기존 API 클라이언트(예: 프론트엔드 타입 정의, OpenAPI codegen 소비자)에게는 breaking change 다. 프론트엔드 `AuthConfigUsage` 인터페이스도 동시에 업데이트됐으므로 프론트-백엔드 간 계약은 정합하다.
- 제안: 배포 시 클라이언트와 서버를 동시에 업그레이드해야 하며, 구형 클라이언트가 새 응답을 받을 경우 `periodCounts` 미정의 접근이 런타임 에러로 이어지지 않도록 프론트엔드 방어 코드(`usageData.periodCounts?.last24h ?? 0` 등)를 검토한다.

### [INFO] `recharts` 신규 라이브러리 임포트 — 번들 크기 증가
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` (diff +1409~+1417)
- 상세: `recharts` 가 `authentication/page.tsx` 에 직접 임포트됐다. 이 라이브러리가 이미 `package.json` 에 포함돼 있다면 추가 설치 부작용은 없다. 그러나 tree-shaking 없이 `BarChart`/`Bar`/`XAxis`/`YAxis`/`CartesianGrid`/`Tooltip`/`ResponsiveContainer` 를 named export 로 임포트하므로, recharts 전체 또는 상당 부분이 Authentication 페이지 번들에 포함된다. SSR/CSR 레이아웃 측정 이슈는 테스트에서 jsdom passthrough stub 으로 처리됐다.
- 제안: 이미 다른 페이지에서 recharts 를 사용 중이라면 번들 크기 영향은 코드 분할 경계에 따라 다르다. `dynamic import` + `ssr: false` 로 감싸면 초기 번들에서 제외할 수 있다.

## 요약

이번 변경은 `execution` 테이블에 `source_ip`/`response_code` 컬럼을 추가하고, webhook/chat-channel 발화 시 해당 값을 캡처해 영속한 뒤, `getUsage` API 를 통해 기간별 호출 수·소스 IP·응답 코드를 노출하는 end-to-end 기능 추가다. 전역 변수 도입·예상치 못한 파일시스템 변경·의도치 않은 네트워크 호출은 없다. 주요 부작용 위험은 두 가지다: (1) `getUsage` 반환 타입 및 `AuthConfigUsageDto` 의 응답 shape 확장으로 인한 기존 API 소비자(특히 구형 프론트엔드 클라이언트)의 잠재적 runtime 접근 에러, (2) `ExecuteOptions` 의 `triggerId` variant 확장으로 인해 `hooks.service` 외 다른 호출자가 `sourceIp`/`responseCode` 를 인식하지 못하고 누락하는 경우. 두 위험 모두 이번 PR 내에서 프론트엔드 타입 정의 및 테스트가 동시에 업데이트돼 있어 사실상 완화되어 있으나, 외부/통합 소비자가 있다면 별도 확인이 필요하다. DB 마이그레이션은 nullable 컬럼 추가로 회귀 위험 없이 안전하다.

## 위험도

LOW
