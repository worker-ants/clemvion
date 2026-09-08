# 정식 규약 준수 검토 — `spec/5-system/`

## 전제 확인

- 이번 검토 대상 diff 는 **`spec/5-system/` 델타 0개 파일** — 이 배치(#spec-followups-batch-b)는
  이 spec 영역을 바꾸지 않았다. 코드 diff(16개 파일 / 1042줄, `git diff origin/main...HEAD`)를
  워킹트리에서 직접 확인한 결과, 변경 파일은 `http-exception.filter.ts`(pg unique-violation
  판정 로직을 `common/db/pg-error.ts` 로 추출하는 순수 리팩터) · `workflow-versions.service.ts`
  (`WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명) · `workspaces.service.ts`
  (`User` 컬럼 DB-레벨 select 축소) · `integration-oauth.service.ts`(pg 에러 헬퍼 재사용) ·
  트리거 `endpoint-path-conflict-wrap` 정적 가드 신설 등이며, **`spec/5-system/1-auth.md`·
  `2-api-convention.md`·`3-error-handling.md` 가 다루는 인증/API/에러 도메인과 직접 교차하지
  않는다.** 이 문서들 자체는 이번 세션에서 변경되지 않았다.
- 이런 전제에서 본 리포트는 (a) 이 배치가 신규로 도입한 코드에 규약 위반이 있는지, (b) 번들에
  포함된 대상 문서 본문(1-auth.md·2-api-convention.md 전문, 3-error-handling.md 대부분)이
  `spec/conventions/**` 와 실제로 정합한지를 직접 대조했다. 컨텍스트 예산으로 생략된 나머지
  `5-system/` 파일 16개·`spec/conventions/` 파일 274개는 프롬프트 번들에 없었으므로, 관련 조문은
  실제 저장소 원본(`spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`,
  `spec/conventions/swagger.md`)을 절대경로로 직접 읽어 대조했다.

## 발견사항

- **[INFO] `3-error-handling.md §2.1` 예시의 `requestId` 가 문서가 선언한 UUID 형식과 다르다**
  - target 위치: `spec/5-system/3-error-handling.md` §2.1 "기본 형식" JSON 예시
    (`"requestId": "req_abc123"`)
  - 위반 규약: 같은 필드를 정의하는 `spec/5-system/2-api-convention.md §5.3` 이 "`requestId`:
    모든 에러 응답에 항상 포함되는 추적용 **UUID**" 라고 명시하고, 그 예시(`f3b6d2e0-9d4a-4b77-
    9d19-7a0f8f4c1e2b`)도 UUID 형식이다. 실제 구현(`codebase/backend/src/common/filters/
    http-exception.filter.ts:37` `uuidv4()`)도 UUID 를 발급한다.
  - 상세: `3-error-handling.md §2.1` 의 예시 문자열 `"req_abc123"` 은 UUID 형태가 아니어서,
    같은 필드를 다루는 두 문서 예시가 서로 다른 포맷을 암시한다. 값 자체가 잘못됐다기보다는
    "출력 포맷 규약"(관점 2) 상 예시 정합성이 깨진 것으로, 이 예시만 보고 클라이언트/SDK
    생성기를 만드는 사람이 `requestId` 를 임의 문자열로 오인할 여지가 있다.
  - 제안: `3-error-handling.md §2.1` 예시의 `requestId` 값을 `2-api-convention.md §5.3` 과
    동일하게 UUID 형태 placeholder 로 교체. 이 예시는 이번 배치가 만든 것이 아니라 기존
    문서에 있던 값이므로, spec 변경이 필요하면 `project-planner` 턴에서 처리한다(본 배치의
    `developer` 자기-반증형 소정정 대상도 아니다 — 이 문서를 이번 세션에서 쓴 사람이 아니다).

- 그 외 CRITICAL/WARNING 은 발견하지 못했다. 구체적으로 다음을 대조했고 모두 정합했다:
  - `1-auth.md §1.5.4` 의 `lower_snake_case` 에러 코드(`invitation_not_found` 등)는
    `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 실제로 등재돼 있고
    범위("초대 API 한정")도 일치한다.
  - `1-auth.md §4.1` 의 감사 액션 카탈로그·시제 분류는 `spec/conventions/audit-actions.md §2~3`
    의 구조(`<resource>.<verb>`, 과거분사/현재형/도메인동사 3분류, 도메인별 레지스트리 표)와
    문자열 단위로 일치한다.
  - `2-api-convention.md §5.4` 가 인용하는 "`@ApiPropertyOptional` 은 `ApiProperty({required:
    false})` 의 별칭" 이라는 설명은 `spec/conventions/swagger.md` 원문과 동일하다.
  - `2-api-convention.md` 의 문서 구조(Overview → 본문 1~12 → Rationale), `3-error-handling.md`·
    `1-auth.md` 도 동일하게 Overview/본문/Rationale 3섹션 구조를 지키고, frontmatter 에
    `id`/`status`/`code:` 를 갖춰 CLAUDE.md 의 명명 컨벤션(`_product-overview.md`, `spec/5-system/`
    영역 문서)과 일치한다.
  - 이번 배치가 새로 만든 코드(`common/db/pg-error.ts` 추출, `WorkflowVersionDetailProjection`
    개명, `workspaces.service.ts` 의 `select` 축소, `endpoint-path-conflict-wrap` 정적 가드)는
    신규 API 엔드포인트·에러 코드·DTO 를 도입하지 않으므로 `spec/5-system/` 의 명명·출력 포맷
    규약과 충돌할 표면이 없다.

## 요약

이번 배치는 `spec/5-system/` 영역에 spec 델타가 없고, 실제 코드 diff 도 인증/API/에러 처리
도메인과 교차하지 않는 순수 리팩터·격리 수정 위주다. 번들에 포함된 `1-auth.md`·
`2-api-convention.md`·`3-error-handling.md` 본문은 `spec/conventions/error-codes.md`·
`audit-actions.md`·`swagger.md` 와 대조했을 때 명명·출력 포맷·문서 구조 규약을 정확히 따르고
있으며(historical-artifact 예외 등재까지 포함), 새로 발견된 규약 위반은 없다. 유일한 지적은
같은 `requestId` 필드를 다루는 두 문서 예시(JSON placeholder)가 UUID 형식 일관성을 깨는
INFO 수준의 사소한 표기 불일치뿐이다. 컨텍스트 예산으로 생략된 `5-system/` 의 나머지 16개
파일과 `spec/conventions/` 274개 파일은 이번 diff 와 무관한 영역이라 판단해 전수 대조하지
않았다 — 이 배치가 그 영역을 건드리지 않았다는 사실(git diff 확인)에 근거한 판단이다.

## 위험도
LOW
