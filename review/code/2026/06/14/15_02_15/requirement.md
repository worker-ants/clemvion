# 요구사항(Requirement) Review

## 발견사항

### [WARNING] `hooks.service.ts` chat-channel 경로에서 `extractClientIp` 이중 호출
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `handleChatChannelWebhook` 내 `sourceIp: extractClientIp(input.headers) ?? undefined`
- 상세: `handleWebhook` 경로는 인증 검증 전 `const clientIp = extractClientIp(input.headers)` 로 한 번만 추출해 공용으로 쓰는 반면, `handleChatChannelWebhook` 경로는 해당 리팩토링이 적용되지 않아 `extractClientIp(input.headers)` 를 인라인으로 한 번 더 호출한다. 함수 호출 비용보다 일관성 문제가 크다: 향후 `extractClientIp` 로직이 바뀌면 두 경로의 동작이 갈라질 수 있다. 또한 테스트(`hooks.service.spec.ts`) 가 chat-channel 경로에 대해 `sourceIp: undefined` 를 기대하는데, 실제 입력 헤더에 IP 가 있으면 undefined 가 아닐 수 있어 테스트 커버리지의 대표성도 부족하다.
- 제안: `handleChatChannelWebhook` 도 함수 진입 직후 `const clientIp = extractClientIp(input.headers)` 로 한 번만 추출하고 `sourceIp: clientIp ?? undefined` 형태로 통일하라.

### [WARNING] `getUsage` 에서 `periodCounts` 쿼리가 `totalCalls` 와 별도 QB 를 사용해 `now` 시점 불일치 가능성
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage` 메서드 내 `const now = Date.now()` 후 별도 `createQueryBuilder` 호출
- 상세: `totalCalls` 는 첫 번째 QB `getCount()` 로, `periodCounts` 는 두 번째 QB `getRawOne()` 로, `recentCalls` 는 세 번째 QB `getMany()` 로 순차 실행된다. 세 쿼리 사이에 `now` 시점이 고정되어 있어(`const now = Date.now()`) 롤링 윈도 경계가 쿼리 간 일관되지만, DB 서버 시간과 Node.js `Date.now()` 가 다를 경우 정확성이 떨어진다. 현재 구조에서 `COUNT(*) FILTER` 를 `totalCalls` 쿼리에 병합하면 왕복을 줄이고 일관성을 높일 수 있다. 현재 구현은 기능상 동작하나 경쟁 조건(짧은 시간에 호출이 들어올 경우 `totalCalls` 와 `last30d` 사이에 카운트 차이 발생) 이 가능하다.
- 제안: 개선 권장이지만 즉시 버그는 아님. `totalCalls` 와 `periodCounts` 를 단일 `COUNT(*) FILTER` 쿼리로 병합하거나, 현 구조 유지 시 주석으로 "3 queries, not transactionally consistent" 을 명시하라.

### [INFO] `AuthConfigUsageCallDto.sourceIp` 의 DTO 타입이 optional(`?`) 이나 서비스 반환 타입은 항상 `string | null`
- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` — `AuthConfigUsageCallDto.sourceIp?: string | null`
- 상세: 서비스 `getUsage` 의 반환 타입 `recentCalls: Array<{ ...; sourceIp: string | null; responseCode: string }>` 에서 `sourceIp` 는 `string | null` (optional 아님)이다. DTO 에서 `?` 로 선언하면 swagger 문서에는 optional 로 표시되지만 실제 응답에는 항상 `null` 또는 string 이 포함된다. `@ApiPropertyOptional({ nullable: true })` 는 의미적으로는 맞지만 타입 선언과 런타임 동작 간 미묘한 불일치가 생긴다.
- 제안: `sourceIp: string | null` (non-optional, nullable)로 통일하거나, swagger 어노테이션을 `@ApiProperty({ nullable: true })` 로 변경하여 "필드는 항상 존재하되 null 가능"임을 명확히 표현하라.

### [INFO] `spec/1-data-model.md §2.13` Execution 테이블에 `source_ip`, `response_code` 컬럼 미등재
- 위치: `spec/1-data-model.md §2.13 Execution` 테이블 (line 453~474)
- 상세: V096 migration 으로 추가된 `source_ip VARCHAR(45)` 와 `response_code VARCHAR(10)` 두 컬럼이 `spec/1-data-model.md §2.13 Execution` 테이블 정의에 아직 없다. consistency-check SUMMARY 의 W-1·W-2 해소 메모("본 PR 에서 명시한다")가 있지만, 실제 spec 파일에 반영되었는지 확인이 필요하다. 코드는 올바르게 구현되었으나 spec 본문이 갱신되지 않으면 데이터 모델 SoT 가 실제와 어긋난다.
- 제안: `[SPEC-DRIFT]` — 코드 유지 + `spec/1-data-model.md §2.13 Execution` 테이블에 `source_ip | VARCHAR(45)? | ...` 및 `response_code | VARCHAR(10)? | ...` 행 추가. project-planner 위임.

### [INFO] `spec/2-navigation/6-config.md §A.3` 호출 이력 표가 여전히 "미구현(Planned)" 표기
- 위치: `spec/2-navigation/6-config.md §A.3` (line 101~102)
- 상세: 기간별 호출 수와 소스 IP·응답 코드 컬럼이 "🚧 미구현 (Planned)"/"단, 소스 IP·응답 코드 컬럼은 미구현 / Planned" 로 표기되어 있다. 이번 PR 에서 구현이 완료되었으므로 spec 표가 낡아 있다. consistency-check 메모에 "§A.3 표 ✅ 승격" 을 의도했으나 실제 spec 본문이 수정되었는지 확인 필요.
- 제안: `[SPEC-DRIFT]` — 코드 유지 + `spec/2-navigation/6-config.md §A.3` 표의 기간별 호출 수·소스IP·응답코드 항목을 ✅ 로 갱신하고 Planned 설명 제거. project-planner 위임.

### [INFO] `execution-engine.service.ts` 에서 `sourceIp`/`responseCode` 추출 시 `'sourceIp' in options` 패턴이 `executedBy` variant 와 교차할 여지
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `ExecuteOptions` 타입 분기 추출 (line 2834~2687 범위)
- 상세: `options && 'sourceIp' in options` 로 타입을 내로잉하는 방식은 올바르고 `executedBy` variant 와 `triggerId` variant 가 TypeScript 유니온으로 분리되어 있어 런타임 교차 위험은 없다. 그러나 `triggerId?: never` 인 세 번째 variant(`{ executedBy?: never; triggerId?: never }`)에도 `sourceIp` 키를 누군가 실수로 추가하면 타입 오류 없이 통과할 수 있다. 현재는 실제 문제 없음.
- 제안: 현행 유지. 필요 시 명시적 조건을 `options && 'triggerId' in options && options.triggerId` 로 강화할 수 있으나 현 코드도 기능상 정확하다.

### [INFO] `WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED)` — `HttpStatus.ACCEPTED` 값이 202 임을 활용하는 의도가 명확하나 문서 주석과 실제 코드 상수 모두 '202' 라 중복 설명 존재
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — 상수 정의 및 주석
- 상세: 상수명·주석·마이그레이션 COMMENT 에 모두 '202' 가 하드코딩 문자열로 반복 언급된다. `HttpStatus.ACCEPTED` 를 사용해 매직 넘버를 제거한 구현은 올바르다.
- 제안: INFO 수준. 현행 유지.

---

## 요약

이번 변경은 §A.3 호출 이력(소스 IP·응답 코드·기간별 호출 수) 기능을 DB 스키마(V096)부터 엔티티·서비스·DTO·프론트엔드 UI·i18n 까지 전 레이어에서 일관되게 구현했으며, 비-HTTP 트리거에 대한 NULL 폴백·롤링 윈도 집계·status enum 폴백 표시 등 엣지 케이스도 적절히 처리된다. 주요 기능 완전성 측면의 문제는 없다. 다만 `handleChatChannelWebhook` 에서 `extractClientIp` 가 이중 호출되는 일관성 문제(WARNING)와, 세 개의 분리된 쿼리로 인한 경쟁 조건 가능성(WARNING)이 있다. Spec fidelity 측면에서는 `spec/1-data-model.md §2.13` Execution 테이블과 `spec/2-navigation/6-config.md §A.3` 표가 구현 완료 상태로 갱신되지 않아 SPEC-DRIFT 상태이며(코드가 옳고 spec 갱신 누락), 이 두 항목은 project-planner 의 spec 반영으로 해소되어야 한다. `AuthConfigUsageCallDto.sourceIp` 의 optional 선언 vs 런타임 항상 존재 사이의 미묘한 불일치도 관찰된다.

## 위험도

LOW
