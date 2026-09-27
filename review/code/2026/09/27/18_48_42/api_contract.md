# API 계약(API Contract) 리뷰 — patch-null-validation

## 발견사항

- **[INFO]** PATCH 요청에서 `null` 처리 방식이 바뀌는 것은 실질적으로 클라이언트 관측 가능한 동작 변경(behavior change)이다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts` (전역, `IsOptionalNonNull` 적용된 21 라우트 43 필드)
  - 상세: 이전에는 `@IsOptional()` 이 `null` 도 건너뛰어 (a) 31개 필드는 저장 시 Postgres NOT NULL 위반으로 500, (b) 노드 `label` 은 엉뚱한 409, (c) 트리거 `endpointPath` 는 200 과 함께 수신 경로가 조용히 삭제됐다. 이번 변경으로 이 43개 필드에 `null` 을 보내면 이제 일괄 400 `VALIDATION_ERROR` 다. 세 경우 모두 이전 상태 자체가 계약상 결함(서버 오류·오분류된 상태 코드·의도치 않은 데이터 손실)이었으므로 이 변경은 하위 호환성을 "깨는" 것이 아니라 고치는 방향이며, `CHANGELOG.md` 에 사용자 대상 문구로 명시돼 있어 적절히 공지됐다. 다만 (c)(`endpointPath`)처럼 이전엔 `null` 전송이 "성공"으로 관측되던 경로가 있었다면, 그 (버그에 의존한) 동작에 우연히 맞춰진 외부 클라이언트가 있을 경우 400 으로 바뀐다.
  - 제안: 조치 불요(이미 CHANGELOG 명시, RESOLUTION.md 상 이전 라운드에서 동일 관점 검토·수용됨). 참고용 기록.

- **[INFO]** OpenAPI `description` 텍스트는 43개 필드 중 `endpointPath` 한 곳만 "null 은 400" 문구가 추가됐고, 나머지 42개 필드는 Swagger 문서 텍스트 자체에는 null-거부 사실이 기술돼 있지 않다.
  - 위치: 예) `codebase/backend/src/modules/model-config/dto/update-model-config.dto.ts:18-31`(각 `@ApiPropertyOptional` 블록), `codebase/backend/src/modules/knowledge-base/dto/update-knowledge-base.dto.ts` 등 데코레이터만 `@IsOptional()` → `@IsOptionalNonNull()` 로 교체되고 `description` 문구는 그대로.
  - 상세: `endpointPath` 는 이전에 "200 으로 조용히 삭제"라는 눈에 띄지 않는 실패 모드였기 때문에 문서를 별도로 보강했지만, 나머지 필드는 데코레이터 교체만 이뤄졌다. 다만 런타임 에러 응답 자체가 `IsDefined` 커스텀 메시지("`$property` must not be null — omit the field to keep the current value")를 `details[].message` 에 실어 주므로, API 소비자는 400 을 받는 순간 원인과 해결법을 알 수 있다 — 정적 문서 갱신 없이도 계약 정보가 완전히 유실되지는 않는다.
  - 제안: 선택 사항. OpenAPI 생성 문서만 보고 클라이언트를 만드는 소비자를 위해서는 공통 문구 한 줄을 템플릿화해 42개 필드에도 붙이면 더 낫지만, 이전 라운드(RESOLUTION.md INFO 5·6·7)에서 "결함 아님"으로 이미 합의된 사안과 같은 성격이라 신규 차단 사유는 아니다.

- **[정보/검증됨 — 이슈 아님]** 요청 검증·에러 응답 형식이 기존 API 규약과 정합한다.
  - `CustomValidationPipe`(`codebase/backend/src/common/pipes/validation.pipe.ts:49-56`)가 `class-validator` 에러를 `{ code: 'VALIDATION_ERROR', message, details }` 로 매핑하고, `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts:88-96`)가 이를 `{ error: { code, message, requestId, details } }` 봉투로 감싸 §5.3 에러 응답 형식과 정합한다. `e2e-spec.ts` 의 `res.body.error.code`/`res.body.error.details` 단언이 실제 배선과 일치함을 확인했다.
  - `IsOptionalNonNull`(`codebase/backend/src/common/utils/optional-non-null.ts:17-32`)의 `ValidateIf((_, v) => v !== undefined)` + `IsDefined()` 조합을 직접 추적한 결과: 키 생략(`undefined`)은 `ValidateIf` 에서 전체 스킵(값 불변 유지), `null` 은 조건을 통과해 `IsDefined` 가 `isDefined` 위반을 내고 뒤이은 타입 검증기(`IsString` 등)도 함께 평가된다 — `optional-non-null.spec.ts`/`patch-null-rejection.spec.ts` 의 단언과 실제 동작이 일치한다.
  - §5.4(`spec/5-system/2-api-convention.md:278`) 는 "응답 바디" 전용 규칙이며 "요청 바디는 대상이 아니다"라고 명시하므로, 이번 요청 DTO 의 tri-state(생략=유지·null=거부·값=설정) 처리는 §5.4 위반이 아니라 별개 계약이다 — `optional-non-null.ts` JSDoc 의 교차 참조("API 규약 §5.4 의 PATCH tri-state")도 정확하다. 이 절의 적용 범위 이슈(§5.4 문서가 request tri-state 를 별도 서술로 확장해야 하는지 여부)는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 항목 (10) 에 planner 후속으로 등재돼 있어 본 리뷰의 신규 발견 사항은 아니다.
  - 값을 지울 수 있어야 하는 nullable 필드(워크플로/노드 `description`, 폴더 `parentId`, 인증 설정 `ipWhitelist` 등)는 이번 diff 에서 `@IsOptional()` 그대로 유지돼 `null` 로 지우는 기존 계약을 건드리지 않는다.
  - URL 설계, 버전 관리, 페이지네이션, 인증/인가는 이번 diff 의 변경 범위에 포함되지 않는다(해당 없음).

## 요약

이 변경은 PATCH DTO 21개 라우트 43개 필드에서 "값을 지울 수 없는(NOT NULL) 필드"에 `null` 을 보냈을 때의 처리를 `@IsOptional()`(null 도 통과) 에서 `@IsOptionalNonNull()`(키 생략만 통과, null 은 400) 로 교체하는 API 계약 관점의 버그 수정이다. 이전 동작 자체가 계약 결함(500/오분류된 409/조용한 데이터 손실)이었고, 새 동작은 기존 에러 응답 봉투(`{error:{code,message,details}}`)·HTTP 상태 코드 관례·§5.4(응답 전용) 범위 구분과 정합하며, 단위·DTO 표·e2e 세 층위에서 43개 필드 전수 + 유효값/생략 경로까지 검증됐다. 직전 두 라운드(1R/2R)에서 이미 Critical 0·Warning 0 으로 수렴했고, 그 이후 커밋(`634297632`, `27191021c`)은 JSDoc·plan 트래커 갱신뿐 기능 변경이 없어 API 계약 관점에서 신규 Critical/Warning 은 발견되지 않았다. 잔여 사항은 문서화 완결성 수준의 INFO 두 건뿐이다.

## 위험도

LOW
