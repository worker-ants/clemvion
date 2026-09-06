# 요구사항(Requirement) 리뷰

## 검토 범위 및 방법

프롬프트 번들에 diff 가 생략된 파일이 다수(`review/**` 산출물 다수 포함)라, `git diff origin/main...HEAD`
로 실제 소스 diff 를 직접 확보해 대조했다. 핵심 기능 변경은 아래 세 갈래다.

1. `User` 엔티티 컬럼 노출 방어 2축(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts`
   이름 축) + 실유출 수정 2건(`WorkflowVersionsService.findOne` 의 `creator` 투영 누락,
   `GET /api/workspaces/:id/members` 의 `WorkspaceMemberDto.joinedAt` 미선언).
2. `(workspace_id, endpoint_path)` UNIQUE 위반을 spec(`2-trigger-list.md §3`)이 약속한 409
   `RESOURCE_CONFLICT` + `details.field`/`details.code` 형태로 발행하도록 구현(`triggers.service.ts`
   `rethrowEndpointPathConflict` + `pg-error.ts` `pgErrorConstraint`).
3. `.claude/hooks/_lib/review_guard.py` 의 YAML frontmatter `code:` 블록 리스트 파서가 주석/빈 줄에서
   `break` 하던 결함 수정(gate 파서가 41개 entry 를 조용히 유실 중이었음).

세 갈래 모두 실측(엔티티 컬럼 수 23, `@Column` 카운트, `workspace_member.joinedAt` 을 채우는 4개 실제
호출지점, `V002__indexes.sql` 의 `idx_trigger_workspace_endpoint` 존재, gray-matter 파서와의 731/731
일치)으로 직접 재검증했고 코드와 어긋나는 지점을 찾지 못했다.

## 발견사항

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 담는 필드 위치(`details.code`)가 spec 문면에서
  유일하게 결정되지 않는다 — 다만 이미 올바른 경로로 등재돼 있어 조치 불요
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict`
    (`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수 선언부 인근) / spec `spec/2-navigation/2-trigger-list.md:164`
  - 상세: spec 원문은 "409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`,
    `details.field='endpoint_path'`)" 라고만 적어, "세부 코드" 를 `details.code` 에 둘지 top-level
    `code` 자체를 교체할지 명문화하지 않는다. 저장소에는 두 선례가 공존한다 — (1) top-level `code` 자체를
    특화 코드로 교체하는 7건, (2) `details[].code` 로 감싸는 `error-codes.md §4.2` 계열. 구현은 (2) 계열
    형태를 택해 `details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 로 발행한다.
    이 선택 자체는 spec 문면과 모순되지 않고(“세부 코드”·`details.field` 두 층을 나눠 적은 원문과 부합),
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "도메인 세부 에러 코드의 표현 방식을
    정식화한다" planner 항목으로 이미 등재돼 있어 developer 권한 밖의 정식화를 우회하지 않았다. 새로 지적할
    결함이 아니라 확인 결과를 기록한다.
  - 제안: 조치 불요 — 후속 planner 턴에서 `2-api-convention.md §5.3` 에 택일 기준을 명문화.

## 요약

핵심 변경 3갈래(User 컬럼 노출 방어, 트리거 endpoint_path 충돌 409 계약 구현, review_guard YAML 파서
수정) 모두 기능적으로 완결돼 있고, null/undefined/빈 컬렉션/두 가지 PG 에러 wrap 표면(`driverError` vs
최상위) 같은 엣지 케이스를 대칭적으로 커버하는 단위 테스트 및 e2e 테스트가 동반됐다. TODO/FIXME/HACK/XXX
주석은 diff 대상 파일 전체에서 0건이었다. 함수명·JSDoc 과 실제 동작이 정확히 일치하며(`isEndpointPathUniqueViolation`
이 이름대로 인덱스명까지 좁히고, `findEagerUserRelations`/`collectUserRelationNames` 는 각각 맞는 JSDoc
아래 놓여 있다 — 앞선 리뷰 라운드가 지적한 JSDoc 오배치는 이미 수정돼 재발하지 않는다), 에러 시나리오(다른
UNIQUE 위반·비-unique 에러는 그대로 흘려보냄, `save` 실패 시 catch 미스매치 없음)도 명시적으로 테스트된다.
spec 본문(`2-trigger-list.md §3`, `error-codes.md §4.2`)과 line-level 대조 결과 함수 시그니처·에러
코드·기본값·필드명 모두 spec 이 명시한 것과 일치했고, spec 이 침묵하는 필드 배치 하나(`details.code`
위치)는 이미 planner 후속 항목으로 정식 등재돼 있어 CRITICAL/WARNING 으로 볼 근거가 없다. `WorkspaceMemberDto.joinedAt`
필드(§5.4 기본형)도 실제로 4개 생성 지점이 전부 `joinedAt: new Date()` 로 즉시 채운다는 주석 상 근거를
grep 으로 재확인했고 사실과 일치했다. 전반적으로 이 변경분은 자기 검증(뮤테이션 테스트 기록, 실측 수치)이
매우 촘촘해 요구사항 충족 관점에서 추가로 지적할 결함을 찾지 못했다.

## 위험도

NONE
