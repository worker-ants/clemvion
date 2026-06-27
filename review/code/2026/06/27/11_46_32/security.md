# 보안(Security) 리뷰

**대상 브랜치**: claude/refactor-02-c2-llm-modelconfig-93cae7
**검토 일시**: 2026-06-27
**검토 파일**: llm-model-config.controller.ts / .spec.ts / workspace-rbac.e2e-spec.ts / plan·review 문서

---

## 발견사항

### [INFO] `@Query('type')` 파라미터에 런타임 열거형 검증 없음
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `listModels` 메서드, `@Query('type') type?: 'chat' | 'embedding'`
- **상세**: TypeScript 타입 `'chat' | 'embedding'` 은 컴파일 타임 제약으로, 런타임에는 어떤 문자열이든 전달될 수 있다. `type` 값이 `llmService.listModels` 내부에서 DB 쿼리 필터나 Provider API 파라미터로 전달될 경우 유효하지 않은 값이 유입된다. TypeORM/Prisma 를 사용하는 서비스 레이어가 파라미터화 쿼리를 통해 이미 인젝션을 방어하더라도, 예상 외 값을 필터링하지 않으면 의도하지 않은 Provider 호출이 발생할 수 있다.
- **제안**: `ParseEnumPipe` 또는 `class-validator @IsEnum`을 적용해 런타임 검증을 추가한다.
  ```ts
  @Query('type', new ParseEnumPipe(['chat', 'embedding'], { optional: true }))
  type?: 'chat' | 'embedding',
  ```
  또는 Query DTO + `ValidationPipe` 조합으로 일관성을 확보한다.

---

### [INFO] `previewModels` 에서 외부 API 키가 요청 바디로 수신됨
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `previewModels(@Body() dto: PreviewModelListDto)`
- **상세**: `PreviewModelListDto.apiKey` 는 저장되지 않는다는 설명이 있으나, 수신된 API 키가 애플리케이션 로그(예: HTTP request body 전체 로깅, 에러 스택 직렬화)에 기록될 가능성이 있다. 외부 Provider API 키는 노출 시 즉시 악용 가능한 고감도 시크릿이다. 엔드포인트 자체는 `@Roles('editor')`로 적절히 보호되고 있어 비인가 접근 위험은 없지만, 전송 후 처리 과정의 로그 마스킹 여부가 관건이다.
- **제안**: 로그 인터셉터 또는 NestJS `Logger` 설정에서 `apiKey` 필드를 마스킹 처리하는지 확인한다. `PreviewModelListDto` 에 `@Exclude()` (class-transformer) 또는 custom `toJSON()` 을 추가해 직렬화 시 키 필드가 응답·로그에 포함되지 않도록 강화할 것을 권장한다.

---

### [INFO] `testConnection` 의 NotFound 흡수 패턴 — 리소스 열거 내성 확인
- **위치**: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 테스트 주석, "testConnection 은 미존재 설정의 findEntity NotFound 를 내부 catch 가 흡수해 200 + { success: false } 를 반환한다"
- **상세**: 존재하지 않는 UUID 에 대해 404 가 아닌 200 + `{ success: false }` 를 반환하는 설계는, 임의 UUID 를 순열 탐색해 리소스 존재 여부를 추론하는 enumeration 공격을 자연스럽게 차단한다(응답이 동일하므로). 이는 오히려 보안 친화적인 패턴이다. 그러나 `@Roles('editor')` 가드가 없었던 이전 상태에서는 viewer 도 임의 UUID 를 순열 탐색할 수 있었으므로, 이번 변경으로 해당 공격 표면이 editor+ 수준으로 좁혀진 것은 긍정적 개선이다.
- **제안**: 현 설계를 유지한다. 다만 서비스 레이어의 catch 가 `ModelConfig.dimension` 자동 저장 실패도 함께 흡수하는지 확인이 필요하다. 예외를 전부 삼키는 catch 블록은 부분 성공(dimension 저장 성공, Provider 호출 실패)을 동일하게 `{ success: false }` 로 응답해 실제 상태와 응답이 괴리될 수 있다.

---

## 보안 긍정 변경 (확인 사항)

1. **`@Roles('editor')` 추가 — `testConnection` 권한 상향**: 이전에는 viewer 가 `POST /api/model-configs/:id/test` 를 직접 호출해 조직의 Provider API 키로 외부 LLM 호출을 유발하고 과금을 발생시킬 수 있었다. embedding 종류의 경우 `ModelConfig.dimension` 자동 PATCH 저장이라는 상태 변경 부수효과도 존재했다. `@Roles('editor')` 적용으로 이 두 가지 공격 표면이 모두 차단됐다.

2. **`ParseUUIDPipe` — 경로 파라미터 인젝션 방어**: `@Param('id', ParseUUIDPipe)` 는 UUID 형식이 아닌 값을 400 으로 즉시 거부해 경로 파라미터를 통한 인젝션 시도를 방어한다.

3. **`@Throttle({ limit: 10, ttl: 60_000 })` — 전 엔드포인트 적용**: 모든 3개 엔드포인트에 throttle 이 적용돼 있어 Viewer+ 가 접근 가능한 `listModels` 에서의 Provider API 쿼터 소진 공격을 분당 10회로 제한한다.

4. **`@ApiBearerAuth('access-token')` 클래스 레벨 선언**: 컨트롤러 레벨 bearer 선언으로 `@Roles` 가 없는 `listModels` 도 인증된 요청에만 응답한다. e2e 테스트가 viewer 토큰으로 404 를 받는 것이 이를 증명한다.

5. **유닛 테스트의 `Reflect.getMetadata` 단언**: `testConnection` 과 `listModels` 의 역할 메타데이터를 명시적으로 검증해, 향후 리팩터링 중 decorator 가 실수로 제거되면 단위 테스트가 즉시 실패하도록 회귀 보호가 구축됐다.

---

## 요약

이번 변경은 `POST /api/model-configs/:id/test` 에 `@Roles('editor')` 를 추가해 viewer 가 외부 LLM Provider 호출을 유발하거나 `ModelConfig.dimension` 상태를 변경할 수 있었던 인가 공백을 정확히 봉쇄했다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 세션 관리 문제는 없으며, UUID 파라미터 검증과 throttle 이 방어 계층을 구성한다. 잔여 주의 사항은 `listModels` 의 `type` 쿼리 파라미터에 대한 런타임 열거형 강제가 없다는 점(INFO)과 `previewModels` 의 API 키 바디 수신 시 로그 마스킹 확인(INFO)이다. 두 항목 모두 현재 코드 구조(인증/인가 레이어 정상 작동, throttle 적용)에서 즉각적 악용 가능성이 낮아 위험도를 LOW 로 평가한다.

---

## 위험도

LOW
