# 정식 규약 준수 검토 — `spec/5-system/`

## 전제 확인

- 이번 diff 는 **`spec/5-system/` 델타 0개 파일**이다 — 이 배치가 이 spec 영역을 바꾸지 않았다.
  코드 diff(`git diff origin/main...HEAD` 실측: 23개 파일 / 869+153줄)는 직접 워킹트리에서
  확인했다. 변경 내용은 다음과 같다:
  - `http-exception.filter.ts` — 로컬 `isUniqueViolation`(TypeORM-wrapped 표면만 판정)을
    `pg-error.ts` 의 `isPostgresUniqueViolation`(raw + wrapped 두 표면)로 교체.
  - `integration-oauth.service.ts` — 인라인 constraint 추출을 `pgErrorConstraint` 헬퍼로 교체.
  - `workflow-versions.service.ts` — `WorkflowVersionDetail` → `WorkflowVersionDetailProjection`
    개명(프런트 동명 타입과의 혼동 차단, 순수 rename).
  - `workspaces.service.ts` — `listMembers` 쿼리에 TypeORM `select` 투영 추가(`User` 민감 컬럼을
    DB 레벨에서부터 비적재).
  - `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture — 신규 정적 가드(트리거
    `triggerRepository.save()` 호출이 `endpoint_path` UNIQUE 충돌 래핑을 갖췄는지 검사).
  - 그 외 `source-scan.ts`·`user-entity-exposure-guard.ts`·`production-build-devdep.spec.ts`
    등 테스트 인프라 수정, `webhook-trigger.e2e-spec.ts` 신규, `tsconfig.build.json`·
    `test-stages.sh`·`CHANGELOG.md`·`PROJECT.md` 변경(타입체크 ratchet을 build 단계로 이관).
  - 이 중 어느 것도 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 가
    다루는 인증/API/에러 도메인의 **신규 엔드포인트·DTO·에러 코드·감사 액션**을 도입하지 않는다
    (`WorkflowVersionDetailProjection` 은 `@ApiProperty` 데코레이터가 없는 내부 서비스 타입이라
    `swagger.md` 의 DTO 명명 규칙이 적용되는 대상이 아니다).
- 이 세션에서는 오늘 이미 세 차례(`12_21_11`·`13_22_38`·`13_34_30`) 동일 관점의 검토가
  수행됐고 모두 CRITICAL/WARNING 0·LOW 판정이었다. 본 리포트는 (a) 그 판정 이후의 증분
  diff(가드 신설·harness 문서 변경)에 규약 위반이 새로 생겼는지, (b) 이전 리포트가 인용한
  `spec/conventions/error-codes.md`·`audit-actions.md`·`swagger.md` 의 구체 문구를 저장소
  원본에서 직접 재대조해 그 인용이 여전히 정확한지를 검증했다. 컨텍스트 예산으로 프롬프트
  번들이 `spec/5-system/` 16개 파일·`spec/conventions/` 274개 파일 전부와 diff 본문을
  누락시켰으므로(번들 자체 경고 문구 확인), 판정에 필요한 부분은 저장소 원본을 절대경로로
  직접 읽었다.

## 발견사항

- **[INFO] `3-error-handling.md` 예시의 `requestId` 가 선언된 UUID 형식과 다르다 (이월, 미해결)**
  - target 위치: `spec/5-system/3-error-handling.md` L265, L284, L475 (`"requestId": "req_abc123"`)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3` — `requestId` 는 "모든 에러 응답에
    항상 포함되는 추적용 **UUID**" 라고 명시하고 예시도 UUID 형식(`f3b6d2e0-9d4a-...`)이다.
    실제 구현(`http-exception.filter.ts` `uuidv4()`)도 UUID 를 발급한다.
  - 상세: `13_34_30` 검토에서 이미 지적된 동일 항목이며, 이번 배치가 이 문서를 건드리지
    않아 여전히 미해결이다(재확인만 함, 실측 3곳 모두 `req_abc123` 유지). 값 자체가 틀렸다기보다
    같은 필드를 다루는 두 문서의 예시 포맷이 서로 다른 "출력 포맷 규약" 표기 불일치.
  - 제안: 이번 배치 범위 밖 — 이 문장을 developer 가 이번 세션에 쓴 것이 아니므로 자기-반증형
    소정정 대상이 아니다. `project-planner` 턴에서 `req_abc123` 을 UUID 형태 placeholder 로
    교체 권고.

- 그 외 CRITICAL/WARNING 은 발견하지 못했다. 저장소 원본 대조로 재확인한 항목:
  - `1-auth.md §1.5.4` 의 `lower_snake_case` 코드(`invitation_not_found`·`forbidden`·
    `rate_limited` 등)는 `spec/conventions/error-codes.md` L76 historical-artifact
    레지스트리에 문자열 단위로 등재돼 있고 "초대 API 한정" 범위 문구도 일치한다.
  - `1-auth.md §4.1` 감사 액션 카탈로그는 `spec/conventions/audit-actions.md §1~3`(구조
    `<resource>.<verb>`, 언더스코어 토큰 구분, 시제 3분류, 도메인별 레지스트리 표)과
    `integration.*`/`user.*`/`auth_config.*`/`execution.re_run`/`workspace.*`/`member.*`/
    `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 전 항목이 문자열 단위로 일치한다.
  - `2-api-convention.md §5.4` 의 "`@ApiPropertyOptional` 은 `ApiProperty({required: false})`
    의 별칭" 인용은 `spec/conventions/swagger.md` L112~115 원문과 동일하다.
  - 문서 구조: `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 모두 Overview → 본문 →
    Rationale 3섹션 + frontmatter(`id`/`status`/`code:`)를 갖춰 CLAUDE.md 명명 컨벤션과 일치한다.
  - 신규 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)는 파일 헤더에서 "파서 순수 로직과
    소비 spec 분리" 를 형제 가드(`user-entity-exposure-guard.ts`·`swagger-dto-contract-guard.ts`)
    와 동일 패턴이라 명시하고 있어, 기존 가드 명명·구조 관례를 따른다 — 신규 위반 없음.
  - `WorkflowVersionDetailProjection` 개명은 컨트롤러·DTO 계층에 노출되지 않는 내부 service
    타입 rename 이며(`grep` 결과 파일 내부 전용), API 표면·Swagger 스키마에 영향 없음.

## 요약

이번 배치는 `spec/5-system/` 에 spec 델타가 없고, 코드 diff 도 인증/API/에러 도메인의 신규
표면(엔드포인트·DTO·에러 코드·감사 액션)을 도입하지 않는 내부 리팩터·정적 가드 신설·harness
문서 정비 위주다. `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 가
인용하는 `spec/conventions/error-codes.md`·`audit-actions.md`·`swagger.md` 의 구체 문구를 저장소
원본과 직접 재대조한 결과 모두 정합했고(historical-artifact 등재, 감사 액션 시제 분류, DTO
데코레이터 설명 인용 포함), 새로 발견된 CRITICAL/WARNING 은 없다. 유일한 지적은 `3-error-handling.md`
의 `requestId` 예시(`req_abc123`)가 같은 필드를 UUID 로 규정하는 `2-api-convention.md §5.3` 과
포맷이 어긋나는 INFO 수준 사안으로, 오늘 이미 세 차례 검토에서 반복 확인된 이월 항목이며 이번
배치 범위 밖이다.

## 위험도
LOW
