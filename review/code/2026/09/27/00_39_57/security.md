# 보안(Security) 리뷰 — workflow-version-creator (머지 후 재확인)

## 범위 및 방법

`origin/main` 대비 diff 17개 파일 중 실제 애플리케이션/테스트 코드는 5개다:

- `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` (+ `.spec.ts` 신규)
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (+ `.spec.ts` 신규 테스트 추가)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (래칫 화이트리스트에서 4행 제거)
- `codebase/backend/test/workflow-crud.e2e-spec.ts` (목록 엔드포인트에 `expectNoUserSecrets` + 계약 대조 신설)

나머지 파일(`CHANGELOG.md`, `plan/**`, `review/code/2026/09/27/00_20_58/**`, `review/consistency/2026/09/26/23_55_27/**`)은 문서·이전 리뷰/consistency-check 산출물이며 코드 변경이 아니다. `workflow-versions.service.ts`, `workflow-version-response.dto.ts` 는 diff 뿐 아니라 저장소의 현재 전체 파일을 `Read` 로 직접 열어 대조했다(뮤테이션 없음, 읽기 전용).

## 발견사항

- **[INFO]** `creator`/`changeSummary` 의 OpenAPI 선언이 optional(+nullable) → required(+`changeSummary`는 nullable 유지) 로 넓어지지만, 실제 노출 필드 집합은 바뀌지 않는다.
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` — `WorkflowVersionListItemDto.creator`/`.changeSummary`, `WorkflowVersionDto.creator`/`.changeSummary` (게이트 36-40, 46-50, 70-74, 84-88)
  - 상세: `@ApiPropertyOptional({ nullable: true })` → `@ApiProperty(...)` 전환은 문서(스키마)가 런타임 실체를 뒤늦게 따라잡은 것이다. `creator` 가 담는 값의 집합은 여전히 `CREATOR_PROJECTION`(`id`/`name`/`email` 3필드, `workflow-versions.service.ts` 게이트 97-101)으로 좁혀진다 — 이번 diff에서 이 상수 값은 **변경되지 않았다**. `workflow-versions.service.ts` 를 직접 열어 `findByWorkflow`(게이트 158) · `findOne`(게이트 179)이 여전히 `creator: CREATOR_PROJECTION` 을 명시적으로 붙이고 있음을 확인했다.
  - 제안: 없음 — 계약 정확도 개선이며 새 노출 없음.

- **[INFO]** `select` 리터럴 상수화(`VERSION_METADATA_SELECT`)가 과거 Critical(PII 유출) 결함 클래스의 재발 방지에 기여한다.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 게이트 103-116(`VERSION_METADATA_SELECT` 정의), 158(`findByWorkflow` 적용), 174-180(`findOne` 적용)
  - 상세: 이 저장소는 과거 `findByWorkflow`/`findOne` 이 같은 `select` 리터럴을 손으로 두 번 적다 한쪽만 `creator` 투영을 빠뜨려 `User` 전 컬럼(`passwordHash` 등)이 유출된 이력이 있다(코드 주석이 `review/code/2026/09/06/10_13_22` Critical 1 을 직접 인용). 이번 변경은 `creator` 투영(`CREATOR_PROJECTION`, 보안 경계)은 그대로 두고, 메타 6키(비민감)만 공유 상수로 뽑아 "자매 메서드 중 하나만 갱신" 형태의 드리프트를 줄인다. `creator: CREATOR_PROJECTION` 은 여전히 두 호출부에 각각 명시적으로 남아 있어, 이 상수화 자체가 보안 경계를 대체하지는 않는다 — 다만 새로 추가된 대칭 단위 테스트(`workflow-versions.service.spec.ts`, "목록·상세 select 는 snapshot 하나만 다르다")와 뮤턴트 검증(plan 기재 M4 KILLED)이 이 불변식을 실측 방어한다.
  - 제안: 없음.

- **[INFO]** 목록 엔드포인트(`GET /workflows/:wfId/versions`)에 처음으로 `User` 비밀 컬럼 부재 검증이 추가됨 — 방어 강화.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (목록 응답에 `expectNoUserSecrets(list.body)` + `WorkflowVersionListItemDto` 계약 대조 루프 신설)
  - 상세: 이전까지 상세(`GET .../versions/:versionId`)만 이 검증을 가졌고 목록 경로는 없었다. 이번 변경으로 두 경로 모두 이름 기반(`expectNoUserSecrets`) + 선언 기반(`assertMatchesContract`, `creator` 가 required + `$ref` 라 부재·다른 컬럼 혼입이 즉시 위반으로 잡힘) 이중 방어를 갖는다. plan 의 뮤턴트 M5(목록 `select` 에서 `creator` 투영 제거)가 실제로 이 신설 검증에 의해 KILLED 됨이 기록돼 있다.
  - 제안: 없음(개선 확인).

- **[INFO]** 동시 저장 충돌 시 원본 DB 에러가 클라이언트로 새지 않는다 — 이번 diff 미변경 로직이지만 인접해서 확인.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` `createVersion` 메서드의 `catch` 블록 (게이트 228-238 부근)
  - 상세: `QueryFailedError` 를 매치해 고정 메시지(`'Concurrent save detected — please retry'`)만 반환하고, DB 제약조건명·스키마 등 내부 정보는 노출하지 않는다. 매치 실패 시 `throw err` 로 재던지며 이는 NestJS 전역 예외 필터가 처리한다 — 이번 diff 의 변경 범위가 아니다.
  - 제안: 없음.

- **[INFO]** 인젝션·하드코딩 시크릿·인증/인가 — 해당 없음.
  - 이번 diff 는 TypeORM 의 구조화된 `find`/`findOne` 옵션(`where`/`select`/`relations`)만 사용하며 원시 SQL 조립·문자열 결합이 없다. 신규/변경 코드 어디에도 API 키·비밀번호·토큰·인증서 하드코딩이 없다(e2e 테스트의 `Bearer ${ownerToken}` 은 테스트 픽스처가 런타임에 발급하는 토큰이며 하드코딩된 시크릿이 아니다). 인증/인가 로직(가드, `assertWorkspaceOwnership`)은 이번 diff 에서 변경되지 않았다.

- **[INFO]** `WorkflowVersionCreatorDto.email` 노출은 이번 PR 범위 밖의 기존 설계 — 재확인만.
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` `WorkflowVersionCreatorDto` (게이트 3-15, 이번 diff에서 필드 자체는 미변경)
  - 상세: 버전 작성자의 `email` 이 워크스페이스 내 다른 멤버에게 노출되는 기존 구조는 이번 변경으로 새로 생기거나 넓어지지 않았다.
  - 제안: 없음(범위 밖, 신규 아님).

## 요약

이번 변경은 워크플로 버전 응답 DTO(`creator`/`changeSummary`)의 OpenAPI 선언을 §5.4 금지 조합(optional+nullable)에서 실제 런타임 보장에 맞춘 문서 정확성 정정과, 두 조회가 공유하는 비민감 메타 컬럼 `select` 를 상수(`VERSION_METADATA_SELECT`)로 통합한 리팩터다. 실제 보안 경계인 `CREATOR_PROJECTION`(`id`/`name`/`email` 3필드로 `User` 컬럼 투영을 제한하는 코드)은 값이 이번 diff에서 변경되지 않았음을 파일을 직접 열어 확인했고, 두 호출부 모두 여전히 이 투영을 명시적으로 사용한다. 오히려 목록 엔드포인트에 `expectNoUserSecrets` + 계약 대조가 처음 추가되어 과거 Critical(투영 누락에 의한 `User` 전 컬럼 유출) 결함 클래스에 대한 회귀 방지 커버리지가 넓어졌다. 인젝션, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감 정보 노출 에러 처리 등 다른 OWASP Top 10 관점에서도 이번 diff 가 새로 도입하는 문제는 발견되지 않았다. 신규 Critical/Warning 없음.

## 위험도

NONE
