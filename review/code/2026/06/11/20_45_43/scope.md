# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 신규 파일 생성: ListModelConfigsQueryDto
- 위치: `codebase/backend/src/modules/model-config/dto/list-model-configs-query.dto.ts`
- 상세: 범위 내 생성. `@Query() query: PaginationQueryDto` 가 `kind` 를 whitelist 에 포함하지 않아 `forbidNonWhitelisted` 가 400을 던지는 버그를 해결하기 위한 최소 DTO 도입. 내용은 `kind?: string` 단일 필드 + 설명 주석으로 범위 이탈 없음.

### [INFO] 컨트롤러 시그니처 변경 — `@Query('kind') kind` + `@Query() query` → `@Query() query: ListModelConfigsQueryDto`
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts` diff 라인 444-453
- 상세: 두 개의 `@Query` 파라미터를 하나의 DTO로 통합하는 변경. 버그 수정의 직접 구현이며 다른 핸들러에는 손대지 않아 범위 적절.

### [INFO] 프론트엔드 `limit: 9999 → limit: 100` 수정
- 위치: `codebase/frontend/src/lib/api/model-configs.ts` diff 라인 719-723
- 상세: `PaginationQueryDto` 의 `@Max(100)` 상한 초과로 발생하는 두 번째 회귀 버그 수정. 단순 값 교정이며 주석 추가로 이유가 명시됨. 범위 내.

### [INFO] 테스트 시그니처 갱신 및 회귀 테스트 추가
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.spec.ts` diff 라인 109-188
- 상세: `findAll` 호출 시그니처가 바뀌었으므로 기존 4개 테스트를 신규 시그니처로 갱신한 것은 필수적. 추가된 `ListModelConfigsQueryDto whitelist` describe 블록(2개 테스트)은 ValidationPipe 통과/거부를 직접 검증하는 회귀 커버리지로, 해당 버그의 재발 방지를 위한 최소 추가이므로 범위 이탈로 볼 수 없음.

### [INFO] 임포트 추가
- 위치: `model-config.controller.spec.ts` 2-3행: `CustomValidationPipe`, `ListModelConfigsQueryDto` 임포트 추가
- 상세: 신규 회귀 테스트에서 실제 사용되는 임포트. 불필요한 임포트 없음.

### [INFO] 주석 추가
- 위치: `list-model-configs-query.dto.ts` JSDoc 블록; `model-configs.ts` 인라인 주석; `model-config.controller.spec.ts` 회귀 설명 블록 주석
- 상세: 세 곳 모두 버그 원인·설계 결정을 설명하는 맥락 주석. 의미 없는 포맷팅 변경이 아닌 이해 필수 정보 기록.

## 요약

이번 변경의 의도는 PR #541(통합 모델 관리) 회귀 2건 수정 — (1) `GET /model-configs` 의 `kind` 파라미터가 `forbidNonWhitelisted` ValidationPipe 에 걸려 HTTP 400을 반환하는 문제, (2) `modelConfigsApi.list()` 의 `limit: 9999` 가 `@Max(100)` 상한을 위반하는 문제 — 이다. 4개 파일 모두 해당 두 버그를 직접 수정하거나 수정에 수반되는 필수 변경(테스트 시그니처 갱신, 회귀 테스트 추가)에 해당한다. 관련 없는 핸들러·파일·설정 변경은 발견되지 않았으며, 불필요한 리팩토링이나 기능 확장 요소도 없다. 변경 범위는 의도된 버그 수정 범위 내에 완전히 부합한다.

## 위험도

NONE
