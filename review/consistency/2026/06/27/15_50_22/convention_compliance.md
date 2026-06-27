# 정식 규약 준수 검토 — spec/2-navigation/6-config.md

검토 모드: 구현 완료 후 (--impl-done)  
diff-base: origin/main  
검토 대상 코드: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`, `codebase/backend/test/workspace-rbac.e2e-spec.ts`

---

## 발견사항

### [WARNING] spec §3 API 표에 `type` 파라미터 검증 계약 누락

- **target 위치**: `spec/2-navigation/6-config.md` §3 Model Config API 표, `GET /api/model-configs/:id/models` 행
- **위반 규약**: `spec/conventions/swagger.md §2-4` 상태 코드 응답 규칙 — 400 검증 실패는 `@ApiBadRequestResponse` 로 문서화해야 하고, 이 계약은 spec SoT 에도 반영돼야 한다. 또한 `spec/conventions/spec-impl-evidence.md §3` 상 `status: implemented` spec 은 구현 surface 의 모든 계약적 행동을 커버해야 한다.
- **상세**: 구현 diff 는 `GET :id/models` 에 `ParseEnumPipe(MODEL_TYPE_ENUM, { optional: true })` 를 추가해 `type` 파라미터를 서버 사이드에서 검증하고 허용 외 값에 `400 Bad Request` 를 반환한다. 컨트롤러에는 `@ApiBadRequestResponse` 도 추가됐다. 그러나 spec §3 의 해당 행 설명(`사용 가능한 모델 목록 조회 (chat/embedding) **(Viewer+ — 조회)**`)은 이 변경 이전과 동일해, 허용값 `chat | embedding` 과 400 응답이 spec SoT 에 선언되지 않은 상태다. 이 검증은 이전에 존재하지 않던 behaviour(과거 `@Query('type')` 는 passthrough 였음)로, 클라이언트 계약 변화에 해당한다.
- **제안**: spec §3 Model Config API 표에서 `GET /api/model-configs/:id/models` 행 설명에 `type` 쿼리 파라미터(`chat | embedding`, 선택)와 400 응답(허용값 외 type 값) 을 추가한다. 예시: "사용 가능한 모델 목록 조회. 쿼리 `type=chat|embedding`(선택) 으로 타입 필터. 허용값 외 type → 400. **(Viewer+ — 조회)**"

---

### [INFO] `@ApiQuery` enum 에 `enumName` 미지정

- **target 위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L121–126 (`@ApiQuery` for `type`)
- **위반 규약**: `spec/conventions/swagger.md §1-4` — `enum: MyEnum, enumName: 'MyEnum'` 패턴 권장
- **상세**: `@ApiQuery({ enum: Object.values(MODEL_TYPE_ENUM) })` 는 배열 형태를 사용한다. swagger.md §1-4 는 `enumName` 동반을 권장하나, 이는 DTO `@ApiProperty` 맥락의 예시이고 `@ApiQuery` 는 별도 타입을 스키마에 생성하지 않아 실질 영향은 적다. 다만 `enumName: 'ModelTypeFilter'` 를 지정하면 OpenAPI 스키마에 named type 이 생성돼 소비자 코드 자동생성 시 가독성이 높아진다.
- **제안**: `@ApiQuery({ ..., enum: Object.values(MODEL_TYPE_ENUM), enumName: 'ModelTypeFilter' })` 로 보강 (선택 사항).

---

## 준수 확인 항목 (이상 없음)

| 관점 | 결과 |
|---|---|
| Frontmatter `id: config` — basename 기반 (`6-config.md`) | ✅ |
| Frontmatter `status: implemented` — 유효 enum | ✅ |
| Frontmatter `code:` 에 변경된 `llm-model-config.controller.ts` 포함 | ✅ |
| 문서 구조 Overview / 본문 / Rationale 3섹션 | ✅ |
| `@ApiTags('Model Config')` + `@ApiBearerAuth('access-token')` 클래스 레벨 | ✅ swagger.md §2-1 |
| `@Roles('editor')` 엔드포인트에 `@ApiForbiddenResponse` 동반 (`preview-models`, `:id/test`) | ✅ swagger.md §5-4 |
| `@Roles` 미적용 `listModels` 에 `@ApiForbiddenResponse` 없음 (의도적, 컨트롤러 주석 근거) | ✅ swagger.md §5-4 |
| UUID param 에 `@ApiParam({ format: 'uuid' })` | ✅ swagger.md §5-4 |
| `@ApiOkWrappedResponse` 공용 래퍼 사용 | ✅ swagger.md §5-2 |
| 400 → `@ApiBadRequestResponse` 추가 (`listModels`) | ✅ swagger.md §2-4 |
| `@ApiUnauthorizedResponse` 보호 엔드포인트 전 핸들러 포함 | ✅ swagger.md §2-4 |
| 에러 코드 명명 — 신규 에러 코드 미도입 (enum validation 에러는 NestJS 내장) | ✅ conventions/error-codes.md §1 |
| spec-impl-evidence `status: implemented` + `code: ≥1` 매치 | ✅ spec-impl-evidence.md §3 |

---

## 요약

`spec/2-navigation/6-config.md` 는 정식 규약 관점에서 대부분 준수한다 — frontmatter 스키마(id/status/code), 3섹션 문서 구조, Swagger 데코레이터 패턴(`@ApiTags`, `@ApiBearerAuth`, `@ApiForbiddenResponse` 동반, 공용 래퍼 헬퍼, UUID format param) 이 모두 conventions 를 따른다. 단 구현 diff 가 `GET :id/models` 에 `ParseEnumPipe` 를 신규 도입해 `type` 파라미터 검증(400 반환) 이라는 계약적 행동 변화를 만들었음에도, spec §3 API 표는 이를 반영하지 않아 spec SoT 와 구현 간 계약 기술 갭이 존재한다(WARNING 1건). `@ApiQuery enumName` 미지정은 사소한 형식 제안(INFO 1건)이다.

## 위험도

LOW
