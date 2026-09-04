# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 는 37개 파일로 구성되지만 실질 코드/스펙 변경은 4개 파일이고, 나머지 33개는 직전 두 리뷰
라운드(`18_34_04`, `18_56_22`)와 consistency-check(`18_51_26`)의 산출물을 저장소에 커밋한 것(문서
전용, 신규 실행 코드 없음)이다.

1. `CHANGELOG.md` — `GET /api/executions/workflow/:workflowId` 의 죽은 쿼리 파라미터 `workflowId`
   제거 서술 추가 (문서).
2. `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — `workflowId?: string | null`
   필드와 `@IsOptional()/@IsUUID()/@Transform(...)` 데코레이터, 관련 import(`IsUUID`, `Transform`) 제거.
3. `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `CustomValidationPipe` 의
   `forbidNonWhitelisted` 축(미지 키 거절)을 처음으로 단언하는 테스트 2건 추가.
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 정적 분석 가드의
   JSDoc 재서술(판정 로직 `findSwaggerContractMismatches` 자체는 diff 전후 동일, `Read` 로 대조 확인).
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — 계획 문서 체크박스/서술 갱신.
6. `review/code/2026/09/04/{18_34_04,18_56_22}/*`, `review/consistency/2026/09/04/18_51_26/*` —
   신규 파일이지만 전부 마크다운/JSON 리뷰 산출물이며 실행 코드가 아니다. 표본 확인 결과 시크릿·
   자격증명·실제 발급 토큰은 포함돼 있지 않다(예시 문자열은 전부 플레이스홀더 패턴).

## 검증 절차

- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`, `.../executions.controller.ts`,
  `.../common/pipes/validation.pipe.ts`, `.../validation.pipe.spec.ts` 를 `Read` 로 현재 저장소 상태
  그대로 직접 열어 diff 내용과 대조했다(뮤테이션 없음, 저장소 트리 변경 없음).
- `grep -n "workflow/:workflowId\|ParseUUIDPipe" executions.controller.ts` 로 경로 파라미터
  `workflowId` 의 `ParseUUIDPipe` 검증이 이번 diff 와 무관하게 그대로 유지됨을 확인.
- `findByWorkflow` 핸들러 앞에 `verifyWorkflowOwnership(workflowId, workspaceId)` 호출이 그대로
  있어 IDOR 방지(워크스페이스 소유권 검증)가 이번 변경으로 영향받지 않음을 확인.
- `grep -iE "password|secret|api[_-]?key|token|bearer|private[_-]?key"` 를 실질 변경 5개 파일에
  대해 실행 — 매치 없음(하드코딩 시크릿 없음).

## 발견사항

- **[INFO]** `QueryExecutionDto.workflowId` 제거는 보안 관점에서 중립~긍정적(fail-closed 방향)
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (삭제된 필드는
    원본 파일 기준 삭제된 줄이라 새 파일 게이트가 없음 — 클래스 전체는 게이트 1~39)
  - 상세: 제거된 필드는 `ExecutionsService.findByWorkflow` 가 애초에 구조분해하지 않던 값이라
    (`{page, limit, sort, order, status}` 만 소비) 서비스 로직에 도달한 적이 없다. 즉 인젝션·IDOR
    표면과 무관했다. `@IsUUID()` 검증이 있었으므로 형식 공격면도 원래 없었고, 필드 자체가
    사라지면서 그 검증도 함께 사라지지만 보호 대상 로직이 존재하지 않았으므로 회귀는 아니다.
    전역 `CustomValidationPipe` 가 `whitelist: true` + `forbidNonWhitelisted: true` 로 동작해
    (`common/pipes/validation.pipe.ts:28-31`) 필드 삭제 이후 `?workflowId=…` 를 보내는 요청은
    조용히 무시되던 것이 명시적 `400 VALIDATION_ERROR` 거절로 바뀐다 — 이는 정보 노출이 아니라
    "요청을 이해할 수 없다"는 fail-closed 강화이며, 에러 응답 바디는 `{code, message, details}`
    로 스택 트레이스나 내부 구현 세부사항을 노출하지 않는다(`validation.pipe.ts` `flattenErrors`).
  - 제안: 없음.

- **[INFO]** 경로 파라미터 `workflowId` 의 검증·인가는 이번 diff 로 영향받지 않음
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` (`@Get('workflow/:workflowId')`
    핸들러, `@Param('workflowId', ParseUUIDPipe)` + `verifyWorkflowOwnership` 호출부)
  - 상세: 제거된 것은 쿼리 필터용 `workflowId` 뿐이고, 라우트 자체가 사용하는 경로 파라미터
    `workflowId` 는 여전히 `ParseUUIDPipe` 로 UUID 형식을 강제하며, 핸들러 진입 직후
    `verifyWorkflowOwnership(workflowId, workspaceId)` 로 워크스페이스 소유권을 검증해 IDOR(다른
    워크스페이스의 워크플로우 실행 목록 열람)을 차단한다. 이번 diff 는 이 경로를 건드리지 않았다.
  - 제안: 없음.

- **[INFO]** 신규 테스트(`validation.pipe.spec.ts`)는 전역 보안 통제(whitelist 거절)를 처음으로
  회귀 고정 — 긍정적 방향
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts:86-116` (게이트, `describe('CustomValidationPipe — forbidNonWhitelisted', …)` 블록)
  - 상세: `forbidNonWhitelisted: true` 는 whitelist 기반 입력 검증(과잉 파라미터 주입 방지)의
    핵심 축인데 종전에는 이를 단언하는 테스트가 저장소 어디에도 없었다(이번 라운드 RESOLUTION.md
    W2 가 지적). 신규 테스트가 "DTO 가 선언하지 않은 키는 거절된다"와 "선언된 키만 있으면 통과한다"
    두 방향을 모두 확인해 대조군을 갖췄다.
  - 제안: 없음(긍정 관찰).

- **[INFO]** `swagger-dto-contract-guard.ts` 변경은 순수 JSDoc 재서술, 판정 로직 불변
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:100-121` (게이트)
  - 상세: `@Transform` 예외를 적용하는 조건문(파일 내 `findSwaggerContractMismatches` 본문)은
    diff 전후 동일함을 `Read` 로 대조 확인했다. 이 가드는 런타임 보안 통제가 아니라 OpenAPI 문서와
    TS 타입의 정합성을 검사하는 정적 분석 도구라 이번 변경으로 인한 보안 영향은 없다.
  - 제안: 없음.

- **[INFO]** 커밋에 포함된 리뷰/consistency 산출물(33개 파일)은 문서 전용, 시크릿 없음
  - 위치: `review/code/2026/09/04/{18_34_04,18_56_22}/*`, `review/consistency/2026/09/04/18_51_26/*`
  - 상세: 전부 마크다운/JSON 이며 실행되는 코드가 아니다. 내용을 훑은 결과 실제 발급된 자격증명·
    API 키·토큰은 없고, 로컬 워크트리 절대경로(`/Volumes/project/...`)만 등장하는데 이는 민감
    정보가 아니라 리뷰 세션 메타데이터다.
  - 제안: 없음.

CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.

## 점검 관점별 결과

1. **인젝션(SQL/XSS/커맨드/경로탐색)**: 해당 없음 — 신규 입력 처리 로직 없음. 제거된 필드는
   애초에 서비스 로직에 도달하지 않았고, 남은 `status` 필드는 `@IsIn` 화이트리스트 검증을 그대로
   유지한다.
2. **하드코딩된 시크릿**: 발견 없음(변경 5개 파일 + 신규 리뷰 산출물 33개 파일 전수 grep, 매치 0건).
3. **인증/인가**: 변경 없음 — `verifyWorkflowOwnership`(IDOR 방지) 호출부는 이번 diff 범위 밖이며
   그대로 유지됨을 확인.
4. **입력 검증**: `@IsUUID()` 검증 대상 필드 자체를 제거했으므로 그 축은 사라지지만, 서비스가
   원래 그 값을 소비하지 않았으므로 실질 위험 변화 없음. 오히려 `forbidNonWhitelisted` 축을
   처음으로 테스트로 고정해 회귀 안전망이 늘었다.
5. **OWASP Top 10**: 해당 사항 없음.
6. **암호화**: 변경 없음.
7. **에러 처리**: `CustomValidationPipe` 의 400 응답은 `{code, message, details}` 형태로 일반화된
   메시지만 포함하며 내부 스택/구현 세부사항을 노출하지 않음(기존 동작 유지, 이번 diff 로 변경
   없음).
8. **의존성 보안**: 신규/변경 의존성 없음(import 는 기존 `class-validator`/`class-transformer`
   심볼을 줄였을 뿐).

## 요약

이번 PR 의 실질 코드 변경은 서비스 로직이 소비한 적 없는 죽은 UUID 쿼리 파라미터
(`QueryExecutionDto.workflowId`) 하나를 제거한 것이 전부다. 경로 파라미터 검증(`ParseUUIDPipe`)과
워크스페이스 소유권 검증(IDOR 방지)은 이번 diff 로 영향받지 않았고, 제거된 필드는 애초에 인젝션·
검증 우회 표면이 아니었다. 부작용으로 이 파라미터를 보내던 외부 클라이언트가 `200`(무시)에서
`400`(거절)을 받게 되는 breaking change 가 생기지만, 이는 보안 취약점이 아니라 fail-closed 방향
강화이며 에러 응답도 민감 정보를 노출하지 않는다. 신규 테스트는 전역 `forbidNonWhitelisted` 축을
처음으로 회귀 고정해 오히려 보안 테스트 커버리지를 개선했다. 함께 커밋된 33개 리뷰/consistency
산출물은 문서 전용이며 하드코딩된 시크릿이나 민감정보 노출이 없음을 확인했다. CRITICAL/WARNING
급 보안 결함은 발견되지 않았다.

## 위험도

NONE
