# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `wrapPaginatedSchema` 반환값 구조 변경 — 모든 직접 호출자에 전파
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.ts` (구 L85–117, 신 L184–347)
  - 상세: `wrapPaginatedSchema`는 공개 export 함수이며 반환값의 스키마 구조가 double-wrap → single-wrap으로 바뀐다. 함수 시그니처(`(dto: ClassRef<T>): SchemaObject`)는 동일하고, 반환 타입(`SchemaObject`)도 같다. 직접 호출자는 같은 파일의 `ApiOkPaginatedResponse`뿐이며, 이를 통한 15개 사용처가 plan에서 전수 확인됨. 런타임 행동(wire shape)은 변경 없음 — Swagger OpenAPI 메타데이터만 영향.
  - 제안: 추가 조치 불필요. plan의 "예외 0" 검증이 이미 부작용 범위를 포괄함.

- **[INFO]** 함수가 매 호출마다 새 plain object를 생성하므로 공유 상태·캐시 오염 없음
  - 위치: `api-wrapped.ts` `wrapPaginatedSchema` body
  - 상세: `getSchemaPath(dto)` 호출은 NestJS Swagger 내부 모델 레지스트리 읽기(쓰기 없음). 반환 객체는 호출자가 `ApiOkResponse({ schema: ... })`에 즉시 전달되어 NestJS decorator metadata에 등록되며, 이는 `ApiOkPaginatedResponse`가 기존에도 동일하게 수행하던 동작이다.
  - 제안: 해당 없음.

- **[INFO]** 전역 변수·환경 변수·파일시스템·네트워크·이벤트 — 해당 없음
  - 위치: 변경 전 범위 전체
  - 상세: 변경된 세 파일(`api-wrapped.ts`, `api-wrapped.spec.ts`, `swagger.md`, plan md) 모두 순수 스키마 객체 반환·테스트 단언·문서 텍스트 수정에 국한. 전역 변수 도입·수정 없음. `process.env` 접근 없음. 파일 I/O 없음. HTTP/외부 호출 없음. 이벤트 발행·콜백 등록 변경 없음.

## 요약

이번 변경은 `wrapPaginatedSchema` 반환 객체의 구조를 double-wrap에서 single-wrap으로 교정하는 순수 OpenAPI 메타데이터 수정이다. 함수 시그니처는 그대로이며, 반환값이 달라지는 유일한 호출 경로(`ApiOkPaginatedResponse`)의 15개 사용처가 plan에서 전수 검증되어 예외가 없음을 확인했다. 런타임 wire shape은 byte-identical하며, 전역 상태·파일시스템·네트워크·환경 변수·이벤트에 대한 의도치 않은 부작용은 없다.

## 위험도

LOW
