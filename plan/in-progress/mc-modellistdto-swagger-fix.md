---
worktree: mc-modellistdto-fix
started: 2026-06-27
owner: developer
status: in-progress
spec_impact: none
base: origin/main @ 9381d0bce (#720 포함)
source: #720 ai-review 부수 발견(I-16/I-14) — ModelListDto swagger↔wire shape 불일치
---

# ModelListDto swagger ↔ wire shape 정합 (pre-existing 버그)

## 버그

`GET /api/model-configs/:id/models`·`POST /api/model-configs/preview-models` 는 런타임에
bare `ModelInfo[]` 반환 → `TransformInterceptor` 가 `{ data: ModelInfo[] }` 로 래핑.
그러나 swagger 는 `@ApiOkWrappedResponse(ModelListDto)`(= `{ models: [...] }` 객체)라
OpenAPI 가 `{ data: { models: [...] } }` 로 **잘못** 문서화. spec(`7-llm-client §3.5` =
`ModelInfo[]`)·frontend(`unwrap<ModelInfo[]>`)·서비스 전부 bare array — swagger 만 outlier.

추가 결함: `ModelItemDto`(`{ id, name?, meta? }`) 가 `ModelInfo`(`{ id, name, type }`)와
불일치 — required `type` 누락, name optional, 허위 `meta`. array-vs-object 만 고치면
item schema 는 여전히 부정확.

## 수정 (코드만, spec 변경 없음 — spec 은 이미 ModelInfo[] 로 정확)

1. `model-config-response.dto.ts`: `ModelInfo` 충실 미러 `ModelInfoDto`(`{ id, name, type }`,
   `type` enum = `MODEL_TYPE_ENUM` SOT) 신설. `ModelListDto`·`ModelItemDto` 삭제(미사용화).
2. `llm-model-config.controller.ts`: `@ApiOkWrappedResponse(ModelListDto)` ×2 →
   `@ApiOkWrappedArrayResponse(ModelInfoDto)`. import 교체(`ApiOkWrappedResponse` 는
   testConnection 의 `ModelTestConnectionResultDto` 용으로 잔존).

## 체크리스트

- [x] ModelInfoDto 신설(`{id,name,type}`, type enum=MODEL_TYPE_ENUM) + ModelListDto/ModelItemDto 삭제
- [x] 컨트롤러 annotation 2건 `@ApiOkWrappedArrayResponse(ModelInfoDto)` 교체
- [x] TEST WORKFLOW (lint·unit·build·e2e 215) PASS — 빌드가 미사용 DTO 삭제 안전성 검증
- [ ] /ai-review → Critical/Warning 0
- [ ] (spec 연결 시) consistency-check --impl-done → BLOCK NO

> **TEST 중 발견(pre-existing 조치)**: `plan/complete/mc-config-polish.md`(#720)가 Gate C(`spec_impact` frontmatter) 미선언으로 unit 실패 — #720 에서 plan-complete 이동이 마지막 unit 런 이후라 가드 미검증된 갭. `spec_impact:`(touched 4 spec) 추가로 해소.

## 메모

- 순수 OpenAPI 메타데이터 변경 — 런타임 동작 byte-identical. 새 e2e 시나리오는 무의미
  (heavy 셋업 불요), 단 전체 e2e 재수행으로 무회귀 확인. 기존 어떤 테스트도 `{models}`
  shape 미의존(조사 확인).
- spec 변경 없음(§3.5 가 이미 ModelInfo[] 명시) → impl-prep 게이트는 "코드를 기존 spec 에
  맞추는" 정합이라 충돌 불가. hook-enforced --impl-done(spec 연결 시)·/ai-review 로 검증.
