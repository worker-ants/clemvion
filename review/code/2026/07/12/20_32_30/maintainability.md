# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** Swagger 문서 빌드 테스트 보일러플레이트(`StubController` + `buildDocument()`)가 두 spec 파일에 verbatim 중복
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts` (기존) vs `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.spec.ts` (신규)
  - 상세: 신규 `interact-ack-response.dto.spec.ts` 가 도입한 `@Controller('stub') class StubController { ... }` + `async function buildDocument(): Promise<OpenAPIObject> { ... }` 패턴은 `execution-status-response.dto.spec.ts` 에 이미 존재하는 것과 `buildDocument()` 함수 본문이 한 글자도 다르지 않게(9줄) 동일하고, `StubController` 도 HTTP 메서드 데코레이터(`@Get`↔`@Post`)·핸들러명(`find`↔`ack`)·DTO 타입 참조만 다르다. 저장소 전체(`grep -rl "SwaggerModule.createDocument" codebase/backend/src --include="*.spec.ts"`)에서 이 패턴은 이 두 파일에서만 나타나며, 이번 diff 가 그 두 번째 인스턴스를 만든 시점이다. 앞으로 EIA 모듈에 스키마 회귀 spec 이 추가될 때마다(이미 이 패턴 재사용 후보인 DTO 가 여럿 존재) 같은 ~20줄이 계속 복붙될 위험이 있다.
  - 제안: 공용 테스트 헬퍼(예: `dto/responses/__test-utils__/build-swagger-document.ts`)로 `buildDocument(stubControllerClass)` 또는 `buildDocumentFor(dtoClass, { method })` 형태를 추출해, 두 파일 모두 이를 소비하도록 정리할 것. 지금 2회차에서 정리하면 3번째 소비처부터는 복붙이 아니라 재사용이 된다.

- **[INFO]** 순서 pin 테스트의 하드코딩 배열이 SoT 값과 문자 그대로 중복
  - 위치: `execution-status.literal.spec.ts` — `expect([...EIA_EXECUTION_STATUS_VALUES]).toEqual(['pending', 'running', ...])`
  - 상세: SoT 배열(`execution-status.literal.ts`)의 리터럴 값을 테스트 안에 다시 하드코딩해 중복처럼 보이지만, 주석(`// 하드코딩 리터럴 대조. SoT 배열을 재정렬하면 (파생 심볼 비교와 달리) 여기서 실패한다.`)이 의도를 명시한 golden-value pin 패턴이다 — 심볼 참조 비교였다면 재정렬 회귀를 못 잡는다는 이전 라운드(20_08_27 W1)의 실증까지 있어 정당화된 디자인이다. 조치 불요, 참고로만 기록.

## 검증한 사항 (문제 없음)

- `EIA_` 접두·`Literal` 접미 네이밍은 파일 JSDoc 에 근거(동명 상수·엔티티 enum 과의 충돌 회피)가 명시돼 있고, 실제로 `workflow-assistant/tools/explore-tools.service.ts` 의 동명 `EXECUTION_STATUS_VALUES`(다른 값 순서)와 `execution.entity.ts::ExecutionStatus`(다른 enum 순서) 둘 다와 대조 확인한 결과 우려가 사실에 부합한다.
- `enum: EIA_EXECUTION_STATUS_VALUES` 직접 참조(spread 아님)는 같은 모듈의 기존 관용구 `@ApiProperty({ enum: INTERACT_COMMANDS })`(`dto/interact.dto.ts`)와 동일한 스타일로, 이전 라운드(19_49_01)의 spread-불일치 INFO 를 정확히 해소했다.
- `type ExecutionStatusLiteral` inline type-modifier import 스타일은 저장소 전역에 98곳, 별도 `import type {}` 스타일은 244곳 공존하는 기존 관례라 일탈이 아니다.
- 신규 함수·타입 선언 전부 단일 책임·짧은 길이(선언·재-export 수준)이며 중첩·순환복잡도 이슈 없음. 매직 넘버 없음.
- `execution-status.literal.ts` JSDoc 은 "왜 엔티티 enum 에서 파생하지 않는가"를 근거 두 가지(레이어 결합 회피, enum 순서 불일치)와 함께 명확히 서술해 재도입 유혹을 잘 방어한다.

## 요약

이번 diff 는 이전 두 라운드(19_49_01, 20_08_27)에서 제기된 유지보수성 INFO(spread 스타일 불일치, 네이밍 근거 미문서화, drift 가드 순서-무결성)를 모두 정확히 해소한 상태이며, 프로덕션 DTO 코드(`execution-status-response.dto.ts`/`interact-ack-response.dto.ts`/`execution-status.literal.ts`) 자체는 가독성·네이밍·복잡도 어느 측면에서도 새로운 결함이 없는 깔끔한 SoT 통합이다. 다만 이번 라운드에서 새로 추가된 `interact-ack-response.dto.spec.ts` 가 기존 `execution-status-response.dto.spec.ts` 의 Swagger 문서 빌드 보일러플레이트(`StubController`+`buildDocument()`)를 거의 그대로 복제해, 저장소 전체에서 이 패턴의 두 번째 인스턴스를 만들었다 — 프로덕션 코드가 아닌 테스트 스캐폴딩이라 즉각적 리스크는 낮지만, 앞으로 이 모듈에 스키마 회귀 spec 이 늘어날수록 복붙이 반복될 시점이라 공용 헬퍼로 추출하는 편이 유지보수성에 이롭다.

## 위험도

LOW
