# API 계약(API Contract) 리뷰 — `patch-null-validation` (2R, HEAD `3eec5f8be`)

이 라운드는 1R(`review/code/2026/09/27/17_47_49`)에서 발견된 API 관련 WARNING 2건(W1 모델
설정 PATCH happy-path e2e 부재, W2 `endpointPath` 문서 미갱신)이 `e5de5226c` 로 조치된 뒤의
재검토다. 두 커밋(`e5de5226c`, `3eec5f8be`)과 `codebase/backend/src/common/utils/optional-non-null.ts`
· 14개 DTO · `CustomValidationPipe` 를 직접 `Read`/`grep` 으로 재확인했다. 저장소에는 아무것도
쓰지 않았다(`git status --short` 는 이 세션 디렉터리만, `git diff --stat HEAD` 는 빈 출력).

## 발견사항

- **[INFO]** 1R WARNING #2(`endpointPath` null 거부가 문서화 안 됨)는 `e5de5226c` 로 실제 해소됐다 — 직접 확인.
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` (JSDoc 블록·`@ApiPropertyOptional({ description: ... })`, `IsOptionalNonNull()`/`endpointPath` 선언부)
  - 상세: JSDoc 에 "`null` 은 400 `VALIDATION_ERROR` 로 거부한다(`IsOptionalNonNull`) — 경로를 유지하려면 키를 생략한다. 종전 `@IsOptional()` 은 null 을 통과시켜 웹훅 수신 경로가 200 과 함께 조용히 지워졌다"가 추가됐고, Swagger `description` 끝에도 "null 은 400 VALIDATION_ERROR — 경로를 유지하려면 키를 생략한다"가 붙었다. OpenAPI 소비자가 코드/CHANGELOG 없이 이 한 필드의 계약을 알 수 있게 됐다.
  - 제안: 조치 불필요(이미 해소).

- **[INFO]** 1R WARNING #1(모델 설정 PATCH happy-path e2e 부재)도 `e5de5226c` 로 해소됐다 — 응답 계약(200 + `data` 필드 매핑)까지 실측됐다.
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts` (새 `it('모델 설정 PATCH — 유효 값은 200 으로 저장되고, 생략한 키는 값이 그대로다', ...)`)
  - 상세: 4필드(`provider`·`name`·`defaultModel`·`defaultParams`) 유효 값 PATCH → 200 + `body.data` 가 요청과 일치함을 `toMatchObject` 로 확인하고, 이어 빈 바디(`{}`) PATCH → 200 + 동일 값 유지(키 생략 = PATCH 부분 업데이트 계약 준수)를 같은 테스트에서 확인한다. `IsOptionalNonNull` 이 정상 경로·생략 경로 어느 쪽도 깨지 않음을 응답 바디 수준까지 고정했다.
  - 제안: 조치 불필요(이미 해소).

- **[INFO]** `nullable: true` 선언 필드와 이번 43필드(`IsOptionalNonNull` 적용 대상) 사이에 스키마 모순이 없음을 직접 grep 으로 재확인.
  - 위치: 14개 DTO 파일 전체(`alert-rule.dto.ts`·`update-auth-config.dto.ts`·`update-folder.dto.ts`·`integration.dto.ts`·`update-knowledge-base.dto.ts`·`update-model-config.dto.ts`·`update-node.dto.ts`·`update-schedule.dto.ts`·`update-trigger.dto.ts`·`update-me.dto.ts`·`update-assistant-session.dto.ts`·`update-workflow-test-dataset.dto.ts`·`update-workflow.dto.ts`·`update-workspace-settings.dto.ts`)
  - 상세: 각 파일에서 `nullable: true` 를 쓰는 필드(예: `description`·`parentId`·`ipWhitelist`·`avatarUrl` 등)와 `IsOptionalNonNull()` 이 붙은 필드가 겹치지 않는다 — `IsOptionalNonNull` 직전 8줄 컨텍스트 안에 `nullable` 문자열이 등장하는 사례는 14개 파일 전부 0건이었다. 즉 OpenAPI 스키마가 "null 허용"이라 광고하면서 런타임이 거부하는 모순은 이번 변경으로 생기지 않았다.
  - 제안: 조치 불필요 — 기록 확인용.

- **[INFO]** `CustomValidationPipe.flattenErrors` 는 필드당 제약 위반 **개수만큼** `details[]` 항목을 낸다 — null 값은 `isDefined`·타입 검증기(`isString` 등) 둘 다 위반해 같은 `field` 로 2개 항목이 나온다. API 계약이 "필드당 1개 항목"을 보장하지 않는 한 이는 계약 위반이 아니다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts` (`flattenErrors`), `codebase/backend/src/common/utils/optional-non-null.spec.ts` (`name: ['isDefined', 'isString']` 로 이 동작 자체를 이미 검증)
  - 상세: 직접 `Read` 로 대조한 결과 `flattenErrors` 는 `error.constraints` 의 각 값마다 `details.push(...)` 하므로, `null` 이 온 필드는 `isDefined`(이번 PR 의 커스텀 메시지)와 원래 타입 검증기(class-validator 기본 메시지) 둘 다 위반해 `details[]` 에 같은 `field` 값을 가진 항목이 2개 들어간다. e2e·unit 테스트는 `fields.toContain(field)` 형태로만 단언해 이 중복 개수 자체는 검증하지 않는다(1R SUMMARY INFO #2 와 같은 축의 관찰이지만, 그건 "여러 필드 동시 null" 이고 이건 "한 필드가 복수 제약 위반"이라 별개 관측이다). 클라이언트가 `details[].field` 존재 여부만 보고 첫 매치 메시지를 쓰는 소비 패턴이면 문제 없고, `field`→단일 메시지 매핑을 가정하는 클라이언트가 있다면 어느 메시지가 먼저 오는지(`isDefined` 가 먼저)에 의존하게 된다는 점만 남긴다.
  - 제안: 조치 불필요 — 이번 PR 이 만든 동작이 아니라 `CustomValidationPipe` 의 기존 구조(모든 필드에 공통)이고, 이 PR 의 목적(400 으로 조기 거부)에는 영향 없다. 후속으로 필드당 details 항목을 1개로 접을지 결정할 여지만 기록.

- **[INFO]** SPEC-DRIFT(§5.4 PATCH tri-state 서술 범위 모호성)는 1R 에서 이미 3개 reviewer(requirement·documentation·api_contract)가 독립적으로 같은 결론에 도달했고 `plan/in-progress/spec-draft-nullable-notation-followups.md` planner 항목 (10)에 등재돼 해소 대기 중이다 — 재확인만 하고 새 조치는 요구하지 않는다.
  - 위치: `spec/5-system/2-api-convention.md` §5.4 블록쿼트; 등재 위치 `plan/in-progress/spec-draft-nullable-notation-followups.md` (6399~6407행 부근, "2026-09-27 보강" 문단)
  - 상세: 이 PR 의 43필드는 전부 OpenAPI `nullable` 미선언 필드이고, 실제 tri-state 대상(`authConfigId`·`llmConfigId`·`parentId`·`folderId` 등)은 건드리지 않아 실질 충돌은 없다. `Read` 로 트래커 항목이 실제로 존재함을 재확인했다.
  - 제안: 조치 불필요(이미 트래커에 있음). 병합을 막을 사유 아님.

## 평가 근거

- **하위 호환성**: 대상 43필드는 종전에 `null` 전송 시 500(31건)·엉뚱한 409(`nodes.label`)·조용한 데이터 삭제(200, `triggers.endpointPath`)였다 — "성공"을 얻던 기존 클라이언트가 있을 수 없는 입력이므로 400 전환은 실질적 breaking change 가 아니다. 정상 값·키 생략 경로는 `e5de5226c` 로 model-configs 라우트까지 200 응답 형태가 실측 고정됐다.
- **버전 관리**: 신규 엔드포인트·URL 변경 없음. 기존 PATCH 라우트 입력 검증 강화(결함 수정)이며 버전 승격 대상 아님.
- **응답 형식**: 전부 기존 `400 { code: 'VALIDATION_ERROR', message, details: [{ field, message, code: 'INVALID_FIELD' }] }` 형식으로 수렴 — `CustomValidationPipe` 를 직접 읽어 확인. 신규 에러 코드·신규 스키마 없음.
- **에러 응답**: 500→400·409→400·200(데이터 유실)→400 전환 — 모두 더 적절한 상태 코드로 개선. 위 INFO 에 적은 "필드당 복수 details 항목" 외 이상 없음.
- **요청 검증**: `IsOptionalNonNull`(`ValidateIf(v !== undefined)` + `IsDefined`)이 "생략=스킵, null=거부, 값=해당 검증기만" 을 정확히 구현함을 소스 레벨로 재확인. 43필드 어디도 `nullable: true` 와 충돌하지 않는다.
- **URL/경로 설계**: 변경 없음.
- **페이지네이션**: 해당 없음(목록 API 미변경).
- **인증/인가**: 변경 없음 — 요청 바디 검증 계층만 건드림.

## 요약

1R 에서 지적된 API 계약 관련 WARNING 2건(모델 설정 PATCH happy-path e2e 부재, `endpointPath` 문서 미갱신)이 `e5de5226c` 로 정확히 조치됐음을 소스 직접 대조로 확인했다 — JSDoc/Swagger description 에 null 거부 문구가 실제로 들어갔고, model-configs 라우트에 유효 값 200 + 응답 바디 매칭 + 빈 바디 200 값 유지 테스트가 추가됐다. 43필드 전체에서 `nullable: true` 선언과 `IsOptionalNonNull` 적용이 겹치지 않아 스키마 모순도 없다. 남는 것은 이미 트래커에 등재된 SPEC-DRIFT 1건(§5.4 tri-state 서술 범위, planner 턴 대기)과, 이번 PR 범위가 아닌 기존 구조(`CustomValidationPipe`)에서 비롯된 "필드당 복수 details 항목" 관찰 하나뿐이며 둘 다 병합을 막을 사유가 아니다. 하위 호환성·응답 형식·에러 코드·요청 검증 전 축에서 breaking change 없이 기존 결함(500/409/조용한 삭제)을 계약대로 교정한 변경이다.

## 위험도

LOW
