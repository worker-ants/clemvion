# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 모듈-레벨 상수 도입 — `PROVIDER_PROBE_THROTTLE`, `MODEL_TYPE_ENUM`
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L279–280
- 상세: 두 상수가 파일 최상단 스코프(모듈 레벨)에 선언됐다. 전역 변수와 유사한 위치지만 `const` + `as const` 이고 파일 외부로 export 되지 않는다. 런타임에 값이 변경될 수 없으며 모듈 경계 밖으로 노출되지 않아 공유 상태 오염 위험 없음.
- 제안: 현재 구조 유지 적합. 향후 다른 파일에서도 동일 상수가 필요해지면 공유 constants 파일로 추출하되, 현재 범위에서는 단일 소스 원칙을 잘 지키고 있다.

### [INFO] `ParseEnumPipe` 인스턴스 공유 — 데코레이터 평가 시점
- 위치: `listModels` 메서드 파라미터 데코레이터 (`@Query('type', new ParseEnumPipe(...))`)
- 상세: `new ParseEnumPipe(MODEL_TYPE_ENUM, { optional: true })` 는 클래스 정의(모듈 로드) 시점에 한 번만 평가되어 단일 인스턴스가 모든 요청에서 공유된다. NestJS `ParseEnumPipe` 는 요청 간 공유 가변 상태를 갖지 않는 순수 변환 파이프이므로 인스턴스 공유는 안전하다.
- 제안: 변경 불필요.

### [INFO] `@Throttle` 파라미터 프로퍼티 순서 변경
- 위치: 세 핸들러의 `@Throttle` 데코레이터 (L290, L299, L308)
- 상세: 기존 인라인 리터럴은 `{ limit: 10, ttl: 60_000 }` 순서였고, 새 상수 `PROVIDER_PROBE_THROTTLE` 는 `{ ttl: 60_000, limit: 10 }` 순서다. NestJS 스로틀러는 `limit`, `ttl` 을 키로 접근하므로 프로퍼티 순서는 동작에 무영향이다.
- 제안: 무시 가능.

### [WARNING] `listModels` 공개 API 동작 변경 — 허용 범위 외 `type` 값 처리
- 위치: `listModels` 핸들러 (`@Query('type', new ParseEnumPipe(...))`)
- 상세: 변경 전에는 `type=bogus` 같은 비허용 값이 파이프를 거치지 않고 `llmService.listModels(id, workspaceId, { type: 'bogus' })` 로 그대로 전달됐다. 변경 후에는 `ParseEnumPipe` 가 핸들러 도달 전에 400 Bad Request 를 반환한다. 이는 의도된 hardening 이며 CHANGELOG 에 명시됐다. 단, 과거에 문서 외 `type` 값(예: `all`, 빈 문자열 제외 임의 문자열)을 이용해 전체 목록을 조회하던 직접 API 호출 클라이언트는 400 을 받게 된다. Swagger 준수 클라이언트(`chat`·`embedding`·미전송)에는 영향 없음.
- 제안: CHANGELOG 의 설명(스펙 준수 클라이언트 무영향)이 정확하다. 추가 조치 불필요. 단, 서비스가 `type` 미지정 시 전체 반환·필터링 로직이 이미 존재하는지(`llmService.listModels` 의 `{ type: undefined }` 경로) 별도 확인 권장 — 이 변경으로 우회로가 차단됐으므로 서비스 레이어의 방어 코드 의존도는 낮아짐.

### [INFO] `@ApiQuery enum` 파생 방식 변경
- 위치: `listModels` 의 `@ApiQuery` 데코레이터
- 상세: `enum: ['chat', 'embedding']` (하드코딩 리터럴) → `enum: Object.values(MODEL_TYPE_ENUM)` (단일 소스 파생). `Object.values` 는 데코레이터 평가 시점(클래스 정의 시)에 한 번 호출되고 결과(`['chat', 'embedding']`)가 Swagger 메타데이터로 저장된다. 런타임 동작 동일. Swagger 문서와 파이프 검증 허용값이 동일 소스에서 파생돼 불일치 위험이 제거된 긍정적 변경이다.
- 제안: 변경 불필요.

### [INFO] e2e 테스트 — `missingId` UUID 의 400 vs 404 우선순위
- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` L503–508
- 상세: `invalidType` 테스트는 `missingId`(존재하지 않는 UUID)에 `?type=bogus` 를 붙여 요청하고 400 을 기대한다. `ParseEnumPipe` 는 라우트 파라미터·서비스 조회보다 먼저 실행되므로 404(존재하지 않는 ID) 보다 400(잘못된 쿼리 파라미터)이 먼저 반환된다. NestJS 파이프 실행 순서상 `@Param` 파이프와 `@Query` 파이프가 모두 핸들러 호출 전 적용되나, 400 이 먼저 발생하면 서비스 레이어(404 소스)에 도달하지 않으므로 기대값 400 이 안정적으로 충족된다.
- 제안: 변경 불필요. 테스트 의도와 구현이 일치한다.

---

## 요약

이번 변경은 `LlmModelConfigController` 한정 리팩터링과 `listModels` 엔드포인트 입력 hardening 으로 구성된다. 모듈-레벨 상수(`PROVIDER_PROBE_THROTTLE`, `MODEL_TYPE_ENUM`)는 `const`/`as const` 비내보내기 선언이므로 전역 상태 오염이 없고, `ParseEnumPipe` 인스턴스 공유도 파이프 무상태성이 보장되어 안전하다. 주목할 유일한 런타임 동작 변화는 `type` 파라미터 검증 강화(비허용 값 → 400)인데, 이는 CHANGELOG 에 정확하게 기술됐으며 Swagger 스펙 준수 클라이언트에는 영향이 없다. 의도하지 않은 부작용은 발견되지 않았다.

## 위험도

LOW
