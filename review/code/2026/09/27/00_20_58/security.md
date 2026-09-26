# 보안(Security) 리뷰 — workflow-version-creator

## 범위

- `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` (+spec)
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (+spec)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (래칫 목록 축소)
- `codebase/backend/test/workflow-crud.e2e-spec.ts` (목록 응답에 `expectNoUserSecrets` + 계약 대조 추가)
- `CHANGELOG.md`, plan/review 문서 (코드 변경 없음)

변경 본질은 워크플로 버전 응답 DTO의 `creator`(작성자 3필드) · `changeSummary` 선언을 OpenAPI 상 실제 런타임과 일치시키고(§5.4 "optional+nullable 금지 조합" 정정), 두 조회(`findByWorkflow`/`findOne`)가 손으로 두 번 적던 `select` 메타 6키를 `VERSION_METADATA_SELECT` 상수로 통합한 것이다. `CREATOR_PROJECTION`(`id`/`name`/`email` 3필드만 투영)은 이번 diff에서 값이 바뀌지 않았다 — 과거(`review/code/2026/09/06/10_13_22` Critical 1) `findOne`이 이 투영 없이 `User` 전 컬럼(`passwordHash`·2FA secret·복구 코드 등)을 유출했던 결함의 재발 방지 목적으로 이미 존재하던 상수다.

## 발견사항

- **[INFO]** DTO 선언 확장(`creator` optional→required, `$ref` 참조)이 실제 노출 필드를 넓히지는 않는다
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:39`, `:49`, `:73`, `:87`
  - 상세: `@ApiPropertyOptional({ nullable: true })` → `@ApiProperty(...)`로 바뀌어 OpenAPI 계약상 "항상 존재"로 넓어지지만, 이는 문서(스키마)가 런타임 실체(항상 존재하는 참조)를 뒤늦게 따라잡은 것이지 서버가 실제로 새 데이터를 더 내보내게 된 것은 아니다. 값은 여전히 `CREATOR_PROJECTION`(`id`/`name`/`email`) 3필드로 좁혀진다(`workflow-versions.service.ts:97-101`, 이번 diff에서 불변). 보안 영향 없음 — 계약 정확도 개선으로 기록.
  - 제안: 없음 (개선 사항).

- **[INFO]** `select` 통합(`VERSION_METADATA_SELECT`)이 "자매 메서드 간 투영 누락" 결함 클래스를 구조적으로 재발 방지한다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:109-116`, `:158`, `:177-180`
  - 상세: 과거 Critical 1은 `findByWorkflow`와 `findOne`이 같은 리터럴을 손으로 두 번 적다 한쪽(`findOne`)만 `creator` 투영을 빠뜨려 생긴 것이었다. 이번 변경은 메타 6키를 공유 상수로 뽑아 두 조회가 같은 소스에서 펼쳐 쓰게 하고, `creator: CREATOR_PROJECTION`는 여전히 각 호출부에서 명시적으로 붙인다 — 상수화가 `creator` 투영 자체를 실수로 빠뜨릴 여지를 줄이지는 않지만(두 곳 다 명시적으로 남아 있음), 메타 필드의 "한쪽만 갱신" 드리프트는 막는다. 새 단위 테스트(`workflow-versions.service.spec.ts:175-190`)가 "목록·상세 select는 snapshot 하나만 다르다"는 불변식을 대칭으로 고정했고, 뮤테이션 M4(`findOne`이 5키만 적음)로 KILLED가 실측되어 있다(plan `workflow-version-creator.md` 뮤턴트 표).
  - 제안: 없음 (방어 강화, 실측 확인됨).

- **[INFO]** e2e 방어선 확장 — 목록 엔드포인트에 `expectNoUserSecrets` 신설
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:575` (목록), 기존 `:588`(상세)
  - 상세: 이전에는 `GET /workflows/:wfId/versions`(목록) 응답에 대해 `User` 비밀 컬럼 부재를 검증하는 e2e가 없었다(상세만 검증). plan의 뮤턴트 M5(목록 select에서 creator 투영 제거 → `User` 전 컬럼 유출 재현)가 이 신설 검증(`expectNoUserSecrets`)에 의해 실제로 KILLED됨이 실측되어 있다 — `passwordHash` 등 7개 필드가 걸렸다고 기록됨. 이 테스트가 없었다면 목록 경로의 같은 유형 회귀는 계약 대조(선언 축)만으로는 값 자체의 유출을 잡지 못했을 것이다. 방어 강화이며 결함 아님.
  - 제안: 없음.

- **[INFO]** `WorkflowVersionCreatorDto.email` 노출은 이번 PR 범위 밖의 기존 설계
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:9-14` (WorkflowVersionCreatorDto, 미변경)
  - 상세: 워크스페이스 내 버전 작성자의 email이 응답에 포함된다. 이번 diff는 이 필드 집합을 바꾸지 않았고(`CREATOR_PROJECTION`도 불변), 워크스페이스 소유권 검사(`assertWorkspaceOwnership`, 컨트롤러 경유, 이번 diff에 미포함)를 통과한 동일 워크스페이스 사용자에게만 노출되는 구조로 보인다. 신규 취약점 아님 — 참고로만 기록.
  - 제안: 없음 (범위 밖).

- **[INFO]** 에러 처리 — 동시 저장 충돌 시 원본 DB 에러 미노출
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:223-236` (`createVersion`, 이번 diff 미변경 로직)
  - 상세: `QueryFailedError`를 잡아 `err.message`에 대해 `/unique|duplicate/i` 매치만 한 뒤, 클라이언트에는 고정 메시지(`'Concurrent save detected — please retry'`)만 반환한다. DB 스키마·제약조건명 등 내부 정보가 응답으로 새지 않는다. 매치 실패 시 `throw err`로 원 예외를 재던지지만 이는 NestJS 전역 예외 필터가 처리할 대상이며 이번 diff의 변경 사항이 아니다. 문제 없음.

- **[INFO]** 인젝션·시크릿·인증 관련 — 해당 없음
  - 이번 diff는 TypeORM의 구조화된 `find`/`findOne` 옵션(`where`/`select`/`relations`)만 사용하며 원시 SQL 조립이 없다. 하드코딩된 API 키·비밀번호·토큰 없음. 인증/인가 로직(가드·workspace 소유권 검사) 자체는 이번 diff에 포함되지 않았다(파일 미변경).

## 요약

이번 변경은 새로운 취약점을 도입하지 않는다. 핵심은 OpenAPI DTO 선언을 실제 런타임 형태(§5.4 "optional+nullable 금지 조합" 정정)에 맞추는 문서 정확성 개선과, 과거 Critical PII 유출(투영 누락)의 재발을 막기 위한 `select` 상수 통합·회귀 테스트(단위 대칭 단언, e2e `expectNoUserSecrets` 목록 축 신설) 추가다. `CREATOR_PROJECTION`(민감 컬럼 차단의 실질 보안 경계)은 값이 바뀌지 않았고, 뮤테이션 테스트로 그 경계가 여전히 강제됨이 실측 확인되어 있다. DTO 선언이 `required`로 넓어진 것은 문서-실체 간극을 좁히는 방향이라 노출 확대가 아니다. 전반적으로 이 PR은 보안 관점에서 중립~긍정적이다.

## 위험도

NONE
