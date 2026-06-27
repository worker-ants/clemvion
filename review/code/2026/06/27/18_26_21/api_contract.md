# API 계약(API Contract) Review

## 발견사항

- **[INFO]** Swagger 문서와 실제 wire shape 불일치 정정 — 이번 변경의 핵심이자 의도적 수정
  - 위치: `llm-model-config.controller.ts` L57–60, L68–71
  - 상세: 기존 `@ApiOkWrappedResponse(ModelListDto)` 는 OpenAPI 스펙을 `{ data: { models: ModelItemDto[] } }` 로 문서화했으나, 실제 런타임은 `TransformInterceptor` 를 통해 `{ data: ModelInfo[] }` 를 반환하고 있었다. `@ApiOkWrappedArrayResponse(ModelInfoDto)` 로 교체함으로써 Swagger 가 실제 wire shape 와 일치하게 됐다. 런타임 동작은 byte-identical 로 유지된다.
  - 제안: 수정 방향 정확. 추가 조치 불필요.

- **[INFO]** `ModelInfoDto.name` 필드 optional → required 변경
  - 위치: `model-config-response.dto.ts` L271–275 (구) → L280–281 (신)
  - 상세: 종전 `ModelItemDto.name` 은 `@ApiPropertyOptional()` 이었으나 신규 `ModelInfoDto.name` 은 `@ApiProperty()` (required). 이는 실제 `ModelInfo` 인터페이스(`llm/interfaces/llm-client.interface.ts`)의 `name: string` (non-optional)과 일치시키는 정합 수정이다. 구 Swagger 가 더 관대하게 문서화돼 있었을 뿐 실제 API 는 항상 name 을 반환했다.
  - 제안: 변경 정확. 단, 향후 provider 어댑터가 `name` 없는 항목을 반환하는 경우 인터페이스 계층에서 방어 처리가 필요하다.

- **[INFO]** `type` 필드 신규 추가 (Swagger 스키마 기준)
  - 위치: `model-config-response.dto.ts` L286–287
  - 상세: `ModelItemDto` 에는 `type` 필드가 없었으나 실제 `ModelInfo` 는 `type: 'chat' | 'embedding'` 을 포함한다. Swagger 에서 누락돼 있던 필드를 추가한 것으로 실제 API 응답 사양에 대한 정확도를 높인다. 기존 Swagger 기반 코드 생성 클라이언트는 `type` 를 신규 필드로 인식하나, 런타임에서는 기존에도 이미 응답에 포함돼 있었다.
  - 제안: 수정 정확. 별도 조치 불필요.

- **[INFO]** `meta` 필드 제거
  - 위치: `model-config-response.dto.ts` L276–278 (구)
  - 상세: `ModelItemDto.meta?: Record<string, unknown>` 은 실제 `ModelInfo` 인터페이스에 존재하지 않는 허위 필드였다. Swagger 스키마에서 제거함으로써 클라이언트의 오해 여지를 해소한다. 런타임 응답에서 해당 필드가 반환된 적이 없으므로 제거는 안전하다.
  - 제안: 수정 정확.

- **[INFO]** `ModelListDto` 및 `ModelItemDto` 클래스 삭제
  - 위치: `model-config-response.dto.ts` L283–286 (구)
  - 상세: 두 클래스가 외부에 re-export 되거나 다른 모듈에서 임포트되는 경우 breaking change 가 될 수 있다. 그러나 plan 문서에 "기존 어떤 테스트도 `{models}` shape 미의존(조사 확인)" 이라고 명시되어 있고, 빌드(TypeScript 컴파일) 통과로 미사용 확인이 됐다.
  - 제안: 안전한 삭제로 판단. 다만 공개 패키지나 채널별 클라이언트가 이 DTO 를 직접 임포트하는 경로가 있는지 패키지 경계(`codebase/packages/`) 관점에서 한 번 더 확인을 권장한다.

## 요약

이번 변경은 `GET /api/model-configs/:id/models` 및 `POST /api/model-configs/preview-models` 두 엔드포인트의 OpenAPI(Swagger) 문서를 실제 런타임 wire shape 와 일치시키는 순수 메타데이터 수정이다. 런타임 동작은 변경되지 않았으며(byte-identical), 기존에 실제 API 를 호출하던 클라이언트(frontend `unwrap<ModelInfo[]>` 패턴 포함)는 아무런 영향을 받지 않는다. Swagger 기반으로 코드를 자동 생성한 클라이언트라면 재생성이 필요하지만, 그 경우에도 잘못된 스키마로 생성된 코드가 올바른 코드로 교체되는 것이므로 하위 호환성 파괴가 아니라 버그 수정으로 간주된다. `ModelInfoDto` 의 필드 사양(`{ id, name, type }` 전부 required)이 실제 인터페이스를 정확히 반영하는지 `llm-client.interface.ts` 기준으로 단한 번 더 확인하면 완결된다.

## 위험도

LOW
