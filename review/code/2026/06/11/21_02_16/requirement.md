# 요구사항(Requirement) 리뷰 — model-config.controller.spec.ts

리뷰 대상: `codebase/backend/src/modules/model-config/model-config.controller.spec.ts`
관련 spec: `spec/2-navigation/6-config.md §Model Config API`, `spec/5-system/7-llm-client.md §3.5 ModelInfo·§5.4 preview-models`, `spec/5-system/9-rag-search.md §374`, `spec/1-data-model.md §2.16 ModelConfig`

---

## 발견사항

### **[INFO]** 기능 완전성 — 전체 커버리지
- 위치: 파일 전반
- 상세: 이번 변경(f0589e29)은 기존 테스트 파일에 55행을 추가하며 다음 세 가지 WARNING 을 해소한다. (1) `ListModelConfigsQueryDto whitelist` describe 내 `pipe`/`metadata` 를 `beforeEach` 로 이동해 격리 확보, (2) `page`, `sort`, `order` 기본값 및 숫자형 `kind` 거부 케이스 추가, (3) 빈 문자열 `kind=''` 의 two-layer 검증(pipe → `parseKind`) 경로 커버. 변경 의도와 실제 코드 내용이 일치하며, 추가된 케이스들은 모두 컨트롤러·DTO·파이프 구현 흐름과 정합한다.
- 제안: 없음

### **[INFO]** parseKind — 빈 문자열 처리 경로의 단일 진실 확인
- 위치: spec.ts L190-202
- 상세: 테스트 주석은 "pipe 자체는 `''`(빈 문자열)를 통과시키고 `parseKind` 의 `!kind` 분기가 거부한다"고 설명한다. `ListModelConfigsQueryDto.kind` 는 `@IsOptional @IsString` 이고 빈 문자열은 `IsString` 을 통과하므로 이 경로 설명은 정확하다. 구현(`model-config.controller.ts` L54: `if (!kind || …)`)과 테스트 기대값이 일치한다.
- 제안: 없음

### **[INFO]** `previewModels` 테스트 — `type` 필드 리터럴 일치
- 위치: spec.ts L256 — `type: 'chat' as const`
- 상세: spec `spec/5-system/7-llm-client.md §3.5 ModelInfo` 는 `type: 'chat' | 'embedding'` 으로 정의한다. 테스트의 mock 반환값 `{ id: 'gpt-4o', name: 'gpt-4o', type: 'chat' as const }` 는 spec 허용 범위 내이며 `'chat'` 리터럴이 정확히 사용됐다.
- 제안: 없음

### **[INFO]** `@Roles('editor')` 메타데이터 검증 범위
- 위치: spec.ts L270-293
- 상세: `create`, `update`, `remove` 세 mutation 메서드에 대해 `Reflect.getMetadata` 로 `roles` 메타데이터를 확인한다. `spec/2-navigation/6-config.md §Model Config API`는 "mutation(POST/PATCH/DELETE)은 Editor+"라고 명시한다. `setDefault`, `previewModels`(POST)는 테스트 대상에서 빠져 있으나, `setDefault` 는 `model-config.controller.ts` L148에 `@Roles('editor')`가 있고 `previewModels`도 L163에 있다. 이 두 메서드에 대한 Roles 메타데이터 테스트는 부재하지만, 현 scope(기존 WARNING 해소)를 벗어나므로 CRITICAL/WARNING 이 아닌 INFO 로 분류한다.
- 제안: 후속 task 에서 `setDefault`, `previewModels` 에 대한 Roles 메타데이터 테스트도 추가 검토 가능.

### **[INFO]** spec fidelity — `MODEL_CONFIG_INVALID` 에러 코드 위치
- 위치: spec.ts L81-95 (parseKind BadRequestException), 컨트롤러 L55-59
- 상세: `spec/5-system/9-rag-search.md L374` 는 "`MODEL_CONFIG_INVALID` / `MODEL_CONFIG_NOT_FOUND` 은 설정 CRUD(`/api/model-configs`) 레이어 전용이다"라고 명시한다. 컨트롤러 `parseKind` 는 `{ code: 'MODEL_CONFIG_INVALID', message: '...' }` 를 throw 하므로 spec 정의와 일치한다. 테스트는 `BadRequestException` 타입만 검증하고 `code` 값 자체를 단언하지는 않으나, 이는 컨트롤러 단위 테스트 범위에서 적절한 수준이다 (에러 코드 계약은 통합 테스트 범위).
- 제안: 없음

### **[INFO]** `listModels` endpoint — `type` 쿼리 파라미터 테스트 부재
- 위치: 컨트롤러 L215-221 (listModels 핸들러)
- 상세: `GET /api/model-configs/:id/models?type=chat|embedding` 핸들러는 이번 변경 파일에서 테스트되지 않는다. 이 파일의 변경 scope 는 `parseKind` + whitelist pipe 이슈 해소이므로 CRITICAL/WARNING 은 아니다. 단, 해당 핸들러의 단위 테스트 부재는 이전부터 존재하는 갭이다.
- 제안: INFO 수준으로 후속 추가 고려.

---

## 요약

이번 변경은 `GET /api/model-configs` 에서 `kind` 쿼리 파라미터가 글로벌 `forbidNonWhitelisted` ValidationPipe 에 의해 거부되던 버그를 수정한 이전 fix 커밋(abbfd984)의 테스트 보완 커밋이다. 추가된 5개 케이스는 모두 의도한 구현 흐름(pipe whitelist 통과 → `parseKind` 값 검증)을 정확하게 반영하며, `page`/`sort`/`order` 기본값과 타입 거부 경로를 명시적으로 검증한다. 빈 문자열 `kind=''` 의 two-layer 처리 경로도 코드 주석과 실제 구현이 일치한다. spec(`6-config.md §Model Config API`, `7-llm-client.md §3.5`, `9-rag-search.md §374`, `1-data-model.md §2.16`)과의 line-level 불일치는 발견되지 않았으며, 에러 코드(`MODEL_CONFIG_INVALID`), kind 허용값(`chat|embedding|rerank`), mutation 권한(`editor`) 모두 spec 정의와 부합한다.

---

## 위험도

NONE
