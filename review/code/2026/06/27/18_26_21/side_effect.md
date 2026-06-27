# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `ModelListDto` / `ModelItemDto` 클래스 삭제 — 외부 참조 없음
  - 위치: `/codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`
  - 상세: 삭제된 두 클래스가 소스 트리 전체에서 `llm-model-config.controller.ts` 의 import 한 곳에서만 참조되었으며, 해당 import 역시 이번 변경에서 동시에 `ModelInfoDto` 로 교체되었다. 배럴(index.ts) 재수출 경로도 없다. 컴파일 아티팩트(`dist/`)의 `.d.ts` 잔존은 빌드 재수행 시 자동 정리된다. 삭제로 인한 import 파괴 없음.
  - 제안: 해당 없음(확인 완료).

- **[INFO]** `@ApiOkWrappedResponse(ModelListDto)` → `@ApiOkWrappedArrayResponse(ModelInfoDto)` — Swagger 메타데이터 전용, 런타임 무변
  - 위치: `llm-model-config.controller.ts` 두 핸들러(`previewModels`, `listModels`)
  - 상세: NestJS 데코레이터는 클래스 정의 시점에 Reflect 메타데이터로만 등록되며, 런타임 요청 처리 로직(`TransformInterceptor`의 `{ data: ... }` 래핑 포함)에 영향을 주지 않는다. 핸들러 함수 시그니처(`previewModels`, `listModels`)·반환값·의존 서비스 호출 모두 변경 없음.
  - 제안: 해당 없음.

- **[INFO]** `ModelInfoDto`의 `name` 필드 optional → required 변경, `meta` 삭제, `type` 추가
  - 위치: `model-config-response.dto.ts` 내 `ModelInfoDto` 클래스
  - 상세: 이 DTO는 순수 OpenAPI 응답 문서화 용도이며 `class-validator` 데코레이터가 없다(`@IsString` 등 부재). NestJS의 응답 직렬화는 DTO 필드 선언에 관계없이 서비스가 반환하는 객체 그대로 전달한다. 따라서 `name` 필수화·`meta` 제거·`type` 추가는 Swagger 스키마 문서에만 반영되며 실제 wire shape를 변경하지 않는다. 기존 어떤 테스트도 `{models}` shape를 의존하지 않음(plan 메모 확인).
  - 제안: 해당 없음.

- **[INFO]** `plan/complete/mc-config-polish.md` — `spec_impact` frontmatter 추가
  - 위치: `plan/complete/mc-config-polish.md`
  - 상세: plan 파일의 YAML frontmatter에 `spec_impact` 키 추가. 코드 동작·전역 상태·네트워크·파일시스템에 영향 없음. unit 게이트가 이 필드를 검증하므로 누락 시 실패하던 것을 정상화하는 수정이다.
  - 제안: 해당 없음.

- **[INFO]** `plan/in-progress/mc-modellistdto-swagger-fix.md` — 신규 plan 파일
  - 위치: `plan/in-progress/mc-modellistdto-swagger-fix.md`
  - 상세: 작업 추적 문서로 코드·런타임에 부작용 없음.
  - 제안: 해당 없음.

## 요약

이번 변경 전체는 Swagger/OpenAPI 문서화 정합 수정으로, 런타임 동작에 영향을 주는 코드 경로는 단 하나도 변경되지 않았다. `ModelListDto`·`ModelItemDto` 삭제는 소스 트리에서 유일한 소비자(컨트롤러 import)가 동시에 교체되어 dangling reference가 없으며, Swagger 데코레이터 교체는 NestJS Reflect 메타데이터 레이어에만 작용해 실제 HTTP 응답 byte 가 동일하다. 전역 변수, 환경 변수, 파일시스템, 네트워크 호출, 이벤트/콜백 중 어느 것도 변경되지 않았다. 의도치 않은 부작용 없음.

## 위험도

NONE
