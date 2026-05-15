## 발견사항

- **[INFO]** `callbackContextOf` — 서비스 내부 구현 세부사항이 컨트롤러로 노출
  - 위치: `integrations.controller.ts` +52 — `import { ..., callbackContextOf } from './integration-oauth.service'`
  - 상세: `callbackContextOf`는 에러 객체에서 컨텍스트를 추출하는 헬퍼 함수인데, 서비스 파일에서 직접 export되어 컨트롤러가 가져다 쓴다. 서비스 내부의 에러 구조(에러 객체에 어떤 프로퍼티가 붙는지)를 컨트롤러가 알아야 하는 결합이 생긴다. 에러 처리 로직(`markIntegrationCallbackError` 호출 포함)이 서비스 레이어에서 이루어진다면 이 함수를 public export할 이유가 없다.
  - 제안: `callbackContextOf`를 서비스 내부에서 직접 호출하거나, 컨트롤러에서 catch한 에러를 서비스에 통째로 넘기는 방식(`oauthService.handleCallbackError(err)`)으로 결합을 줄이는 것을 검토.

- **[INFO]** `lastError` 필드의 `additionalProperties: true` — 스키마 정의 누락
  - 위치: `integration-response.dto.ts` +42~46
  - 상세: `@ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })`는 `lastError`의 Swagger 문서를 완전히 자유 형태로 정의한다. 실제 shape(`{ code, message, at }`)가 코드 여러 곳에서 사용됨에도 스키마에 반영되지 않아, API 소비자가 타입 정보를 활용할 수 없다.
  - 제안: `additionalProperties: true` 대신 `properties: { code: { type: 'string' }, message: { type: 'string' }, at: { type: 'string', format: 'date-time' } }` 형태로 스키마를 명시하거나, 별도 nested DTO 클래스를 추출.

---

### 요약

이번 변경에서 새로운 외부 패키지는 추가되지 않았다. 사용된 모든 데코레이터(`@ApiProperty`, `@ApiPropertyOptional`)와 타입(`Record<string, unknown>`)은 이미 프로젝트에 존재하는 `@nestjs/swagger` 및 TypeScript 기본 타입이다. 주목할 지점은 두 가지로, 서비스 내부 헬퍼 함수(`callbackContextOf`)의 외부 export로 인한 모듈 간 결합과, `lastError` DTO 필드의 스키마 미명세다. 두 사항 모두 기능 동작에는 영향이 없으나 유지보수와 API 문서 품질 관점에서 개선 여지가 있다.

### 위험도

**NONE**