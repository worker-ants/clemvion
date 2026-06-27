# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] capModelList — 클라이언트가 절단 여부를 관측할 수 없음 (의도된 설계, 수용됨)
- 위치: `codebase/backend/src/modules/llm/list-models-cap.ts` + `llm.service.ts` + `llm-preview.service.ts`
- 상세: 500건 초과 시 응답이 조용히 500개로 절단되며 클라이언트는 응답 바디에서 절단 여부를 판별할 수 없다. 계획 문서(`plan/in-progress/mc-config-polish.md`)에 "truncated 플래그를 추가하면 `ModelInfo[]` → `{models,truncated}` 로 breaking change 가 되어 silent 캡으로 선회"라는 배경이 명시되어 있으며 팀이 인지하고 수용한 트레이드오프다. 정상 provider(수십 개)에서는 이 상한에 절대 닿지 않고, 응답 계약 `ModelInfo[]`는 유지된다.
- 제안: 현재 설계 유지. 후속 별도 PR에서 `X-Truncated: true` 응답 헤더 방식(breaking 아님)을 검토할 수 있으나 현재 범위에서는 허용 가능.

### [INFO] ModelListDto Swagger 스키마와 실제 wire shape 불일치 (범위 외, 사전 인지)
- 위치: `ModelListDto` — 이번 변경 대상 아님
- 상세: 계획 문서에 "ModelListDto({models:[]}) Swagger 가 실제 wire shape(bare ModelInfo[])와 불일치 — 본 PR 범위 아님"으로 명시. 이번 변경이 신규 유발한 문제가 아니며 별도 트랙으로 처리 예정.
- 제안: 별도 PR에서 Swagger DTO를 실제 `ModelInfo[]` wire shape에 맞게 정정.

---

## 이전 리뷰 대비 조치 확인

1차 리뷰(17_23_53)에서 식별된 API 계약 관련 이슈:

| # | 항목 | 상태 |
|---|------|------|
| I-3 | probe 3 핸들러 `@ApiTooManyRequestsResponse` 누락 | FIXED — `previewModels`, `testConnection`, `listModels` 3개 핸들러 모두 429 데코레이터 추가 확인 |
| I-15 | silent truncation 미관측 | 수용(팀 결정 B) — 변동 없음 |
| I-16 | `ModelListDto` swagger 불일치 | 범위 외 — 별 트랙 유지 |

`@ApiTooManyRequestsResponse` 누락은 이번 변경셋에서 3개 핸들러 모두 수정 완료됐다. 이로써 `@Throttle` 적용 엔드포인트와 OpenAPI 문서 사이의 비대칭이 해소됐다.

---

## 요약

이번 변경은 API 계약 관점에서 전체가 후방 호환(backward-compatible)이다. 핵심 변경 4건 모두 기존 API 클라이언트 계약을 건드리지 않는다. (1) `SENSITIVE_ACTION_THROTTLE` 추출은 값이 동일한 상수 참조 전환으로 실행 동작 변화 없음. (2) `MODEL_TYPE_ENUM`/`ModelTypeFilter` DTO 이전은 런타임 타입을 변경하지 않으며, `@ApiQuery enumName` 추가는 OpenAPI 스키마 개선이지 런타임 검증 변경이 아님. (3) `capModelList` 500건 상한은 응답 타입 `ModelInfo[]`를 유지하고 정상 provider에서는 투명하므로 기존 클라이언트에 영향 없음. (4) `@ApiTooManyRequestsResponse`는 세 throttle 적용 핸들러에 모두 추가되어 1차 리뷰의 OpenAPI 문서화 갭이 해소됐다. 잔존 사항 2건(silent truncation, ModelListDto swagger 불일치)은 팀이 인지·수용한 설계 결정 또는 범위 외 선행 이슈로, 이번 변경이 도입한 문제가 아니다.

## 위험도

LOW

---

STATUS=success ISSUES=0
