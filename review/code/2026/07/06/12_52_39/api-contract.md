# API 계약 리뷰 — GET /api/schedules triggerId 쿼리 필터 신설

- 대상 커밋: `5b52b8b96`
- diff: `git diff origin/main...HEAD`

## 발견사항

- **[INFO]** `findAll`(GET /api/schedules) 에 `@ApiBadRequestResponse` 미표기
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:52-67`
  - 상세: `QueryScheduleDto.triggerId` 에 `@IsUUID` 검증이 신설되어 비-UUID 값 전송 시 전역 `CustomValidationPipe` 가 400 을 반환하지만, 컨트롤러의 `@Get()` findAll 에는 다른 라우트(create/update/preview 등)와 달리 `@ApiBadRequestResponse` swagger 데코레이터가 없어 이 응답이 문서화되지 않는다.
  - 제안: `@ApiBadRequestResponse({ description: 'triggerId 형식이 유효하지 않음' })` 추가 검토. 단, 이는 이번 PR 신규 결함이 아니라 **workflows 의 대칭 케이스(`GET /api/workflows`, folderId `@IsUUID` 필터)에도 동일하게 존재하는 기존 갭**이므로 낮은 우선순위 — 이번 PR 범위에서 반드시 고칠 필요는 없음.

- **[INFO]** `@ApiOperation.description` 이 신설 `triggerId` 필터를 언급하지 않음
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:53-57`
  - 상세: description 이 "검색어(search)로 트리거 이름을 부분 일치 검색할 수 있습니다" 만 언급하고 `triggerId` 단일 필터는 언급이 없다. `@ApiPropertyOptional` 로 파라미터 자체는 문서화되어 있어 swagger UI 상 완전히 누락되지는 않지만, 엔드포인트 설명 텍스트와의 정합성이 아쉽다.
  - 제안: description 에 "`triggerId` 로 특정 트리거에 연결된 스케줄만 조회할 수 있습니다" 한 문장 추가.

## 항목별 평가

1. **하위 호환성** — 문제 없음. `triggerId` 는 `PaginationQueryDto` 를 상속한 `QueryScheduleDto` 에 `@IsOptional()` 로 추가된 신규 필드이며, 서비스 로직도 `if (triggerId) { qb.andWhere(...) }` 가드로 감싸 미전송 시 기존 쿼리와 완전히 동일하게 동작한다(커밋 `5b52b8b96` 실제 코드 및 신규 unit test `schedules.service.spec.ts` "triggerId 미지정 시 트리거 필터를 적용하지 않는다" 로 확인). 기존 클라이언트(FE 구버전, 외부 API 소비자) 영향 없음.

2. **`@IsUUID` 검증** — workflows `QueryWorkflowDto.folderId` 선례와 대칭적으로 `@IsOptional() @IsUUID()` 를 적용해 잘못된 형식은 400 으로 즉시 거부한다. 딥링크 UX 상으로도 적절 — silent 무시(전체 목록 반환)보다 명시적 400 이 오조작을 사용자/개발자에게 드러내는 편이 안전하다. 다만 folderId 는 빈 문자열을 `null` 로 `@Transform` 하는 처리가 있는 반면 triggerId 는 그런 처리가 없다 — 이는 의도된 비대칭이다: folderId 의 빈 문자열은 "루트 폴더" 라는 유효한 도메인 값이지만, triggerId 의 빈 문자열은 유효한 필터 값이 아니라 "필터 없음" 을 의미하며 FE 가 애초에 빈 값을 전송하지 않으므로(`...(focusTriggerId ? { triggerId: focusTriggerId } : {})`) 문제되지 않는다.

3. **FE↔BE 계약 일치** — `schedules/page.tsx` 가 `focusTriggerId`(URL `searchParams.get("triggerId")`) 가 truthy 일 때만 스프레드로 `triggerId` 를 포함시켜 전송하고, 없으면 아예 키를 안 보낸다. BE DTO 는 optional 이라 계약이 정확히 맞물린다. 다만 workflows 의 `folderId` 는 UI 셀렉트 값만 소비해 항상 유효한 UUID 인 반면, 이번 `triggerId` 는 브라우저 URL 에서 직접 읽어(`searchParams.get`) 그대로 전송하므로 사용자가 URL 을 임의 조작(`?triggerId=abc`)하면 비-UUID 값이 그대로 API 로 전달되어 400 을 유발할 수 있는 노출면이 있다. 다만 이 경우도 전역 `isError` → "loadFailed" 안내 + "전체 스케줄 보기" 해제 링크(필터 배너)가 여전히 렌더링되어 사용자가 복구 가능한 경로가 있으므로 심각한 문제는 아니다(INFO 수준의 잠재 UX 갭으로만 기록, 수정 요구 안 함).

4. **swagger 문서화** — `@ApiPropertyOptional({ description, format: 'uuid' })` 로 필드 자체는 잘 문서화됨. `@ApiOperation.description` 갱신 누락(위 INFO)과 `@ApiBadRequestResponse` 누락(위 INFO, 기존 패턴과 동일한 갭)만 사소하게 남음.

5. **workflows `?folderId=`/`?tag=` 필터 패턴과의 일관성** — 매우 높음. DTO 확장 상속 구조, optional + `@IsUUID`, 서비스단 `if (필드) { qb.andWhere(...) }` 가드, "연결 없으면 자연히 제외" 주석 스타일까지 `QueryWorkflowDto.folderId` 구현과 대칭적으로 미러링되어 있다. 신규 패턴 이탈 없음.

6. **페이지네이션/응답 형식** — `PaginatedResponseDto.create` 그대로 사용, 응답 스키마 변경 없음. 필터가 걸려도 `page`/`limit`/`totalItems` 의미가 그대로 유지되어(필터링된 부분집합에 대한 페이지네이션) 일관적이다.

7. **인증/인가** — 변경 없음. 기존 `@ApiBearerAuth`/`WorkspaceId` 데코레이터 그대로이며 `triggerId` 필터는 workspace 범위(`s.workspace_id = :workspaceId`) 안에서만 동작해 타 워크스페이스 트리거 ID 를 넣어도 workspace 조건에 막혀 데이터 누출 없음.

## 요약

신설된 `triggerId` 쿼리 필터는 기존 `QueryWorkflowDto.folderId` 패턴을 충실히 대칭 미러링한 구현으로, DTO 확장·optional 처리·`@IsUUID` 검증·서비스단 조건부 가드·FE 조건부 전송이 모두 정합적이며 하위 호환성 파괴나 응답 스키마 변경이 없다. 발견된 사항은 모두 INFO 수준(swagger `@ApiBadRequestResponse`/description 갱신 누락)이며, 그중 `@ApiBadRequestResponse` 누락은 이번 PR 신규 결함이 아니라 workflows 의 기존 대칭 케이스에도 있는 선재 갭이라 이번 범위에서 반드시 고칠 필요는 없다. API 계약 관점에서 차단 사유 없음.

## 위험도
LOW
