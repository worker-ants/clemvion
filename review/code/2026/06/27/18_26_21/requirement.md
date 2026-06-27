# 요구사항(Requirement) Review

## 발견사항

### [INFO] 체크리스트 항목 미완료 — 정상 in-progress 상태
- 위치: `plan/in-progress/mc-modellistdto-swagger-fix.md` 체크리스트
- 상세: `/ai-review → Critical/Warning 0` 와 `consistency-check --impl-done` 두 항목이 미체크 상태. 현재 PR 이 in-progress 이므로 정상 — 본 리뷰가 그 일부를 채운다. 코드 버그 아님.
- 제안: 이 리뷰 포함 전 게이트 통과 후 체크 처리.

---

## Spec Fidelity 점검

### 관련 spec 식별

| spec 문서 | 관련 조항 |
|---|---|
| `spec/5-system/7-llm-client.md §3.5` | `ModelInfo` 인터페이스 정의 (권위 SoT) |
| `spec/2-navigation/6-config.md §3` | API 엔드포인트 표, 응답 형 `ModelInfo[]` 명시 |
| `spec/5-system/7-llm-client.md §5.5` | preview-models 엔드포인트 행위 명세 |

### ModelInfoDto vs spec §3.5 ModelInfo — line-level 대조

**spec §3.5 정의:**
```typescript
interface ModelInfo {
  id: string;    // 모델 식별자
  name: string;  // 표시 이름 (required)
  type: 'chat' | 'embedding'; // 용도 (required)
}
```

**구현 `ModelInfoDto`:**
```typescript
export class ModelInfoDto {
  @ApiProperty({ example: 'gpt-4o-mini' })
  id: string;
  @ApiProperty({ example: 'GPT-4o mini' })
  name: string;
  @ApiProperty({ enum: Object.values(MODEL_TYPE_ENUM), example: 'chat' })
  type: ModelTypeFilter;
}
```

- `id: string` — 일치 (required)
- `name: string` — 일치 (required). 구 `ModelItemDto.name?` 가 optional 이었던 것은 spec 위반이었고, 이번에 정정됨.
- `type: ModelTypeFilter` — 일치. `MODEL_TYPE_ENUM = { chat: 'chat', embedding: 'embedding' }` 이 spec `'chat' | 'embedding'` 과 완전 일치.
- 구 `ModelItemDto.meta?: Record<string, unknown>` — spec 에 없는 허위 필드. 삭제가 올바름.

### Wire shape 정합 검증

- 런타임 서비스: `ModelInfo[]` (bare array) 반환.
- `TransformInterceptor`: `{ data: ModelInfo[] }` 로 래핑.
- 구 swagger: `@ApiOkWrappedResponse(ModelListDto)` → `{ data: { models: [...] } }` — **불일치(버그)**.
- 신 swagger: `@ApiOkWrappedArrayResponse(ModelInfoDto)` → `wrapItemsSchema` → `{ data: { type:'array', items:{$ref:ModelInfoDto} } }` = `{ data: ModelInfoDto[] }` — **일치**.

`ApiOkWrappedArrayResponse` 구현(`api-wrapped.ts:183`)이 `wrapItemsSchema` 를 사용하는 것을 코드로 직접 확인. 실제 wire shape(`{ data: ModelInfo[] }`)와 OpenAPI 스키마가 이제 일치한다.

### 컨트롤러 변경 — 권한 규칙 무변경 확인

- `previewModels`: `@Roles('editor')` 유지 — spec §3 / R-7 요구 준수.
- `listModels`: `@Roles` 미적용 유지 (Viewer+) — spec R-7 §3 `GET :id/models` 는 Viewer 이상 명시 준수.
- 두 엔드포인트 모두 `@Throttle(PROVIDER_PROBE_THROTTLE)` 유지 — spec §5.5 / §3 rate-limit 정책 준수.

---

## 기능 완전성

1. `ModelListDto`·`ModelItemDto` 삭제 후 컨트롤러 import 에서 잔재가 남지 않음 — `ModelInfoDto`·`ModelTestConnectionResultDto` 만 남아 있고, `ApiOkWrappedResponse` 는 `testConnection` 핸들러용으로 잔존(정상).
2. `preview-models` (POST) 와 `:id/models` (GET) 두 엔드포인트 모두 annotation 교체 완료.
3. `mc-config-polish.md` 의 `spec_impact` frontmatter 누락 패치가 unit 테스트 가드를 통과시키기 위한 pre-existing 수정으로 명확히 문서화됨.

## 엣지 케이스

- `name` 이 이제 required (`@ApiProperty`)이므로 provider 클라이언트가 `name` 을 빈 문자열이나 undefined 로 반환하면 TS 타입은 통과하나 OpenAPI 계약상 required 필드 위반이 될 수 있다. 그러나 이는 이번 변경의 범위가 아니라 각 LLM 클라이언트 구현의 사전 계약(`ModelInfo` 인터페이스)에 의해 보증되는 사항이다. 해당 인터페이스(`llm-client.interface.ts:76`) 도 `name: string` 을 required 로 정의하므로 클라이언트 레벨의 보증이 존재한다.

## TODO/FIXME

대상 파일 내 TODO/FIXME/HACK/XXX 주석 없음.

---

## 요약

이번 변경은 `GET /api/model-configs/:id/models` 와 `POST /api/model-configs/preview-models` 의 Swagger 응답 스키마를 실제 런타임 wire shape과 일치시키는 순수 OpenAPI 메타데이터 정정이다. 신설 `ModelInfoDto`(`{ id, name, type }`)는 spec §3.5 `ModelInfo` 인터페이스 및 `llm-client.interface.ts` 구현체와 필드 단위로 완전히 일치하고, 컨트롤러 `@ApiOkWrappedArrayResponse` 교체로 `{ data: ModelInfoDto[] }` 스키마가 정확히 생성된다. 구 `ModelListDto`/`ModelItemDto` 는 spec 에 없는 `models:` 래퍼와 허위 `meta` 를 포함한 spec 위반 DTO 였으며 삭제가 올바르다. 권한 규칙(Editor+/Viewer+)과 rate-limit 정책은 변경 없이 spec 요구를 유지한다. Critical/Warning 발견사항 없음.

## 위험도

NONE
