# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 발견은 없다. `architecture`·`scope` 두 reviewer 가 MEDIUM 을 매겼고, 핵심 사유는 (1) 이미 존재하는 PG 에러 판별 SoT 헬퍼를 우회한 4번째 사본 신설, (2) 이 PR 자신이 세운 "가드 목록은 소스에서 파생하라"는 원칙을 자매 가드가 어기는 자기모순, (3) `User` 컬럼 방어라는 원래 목표에서 4단계 연쇄로 확장돼 최종 커밋이 무관 도메인(트리거 endpoint-path 충돌)의 신규 프로덕션 API 응답 필드까지 추가한 스코프 크리프다. forced(router_safety) 화이트리스트 7개(`documentation`/`maintainability`/`requirement`/`scope`/`security`/`side_effect`/`testing`) 전원의 결과가 확보되어 있어 강제 화이트리스트 미이행은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `TriggersService.isEndpointPathUniqueViolation` 이 이미 존재하는 SoT 헬퍼 `common/db/pg-error.ts`(`pgErrorCode`/`isPostgresUniqueViolation`)를 재사용하지 않고 PG 에러 duck-typing(`err instanceof QueryFailedError` → `err.driverError?.code === '23505'`)을 손으로 다시 짰다 — 저장소 전체에서 동일 로직의 **4번째 독립 사본**(`http-exception.filter.ts`, `workspace-invitations.service.ts` 에 이미 2곳 존재) | `codebase/backend/src/modules/triggers/triggers.service.ts:209-221` | SQLSTATE 판정 부분을 `pgErrorCode(err) === '23505'`/`isPostgresUniqueViolation(err)` 호출로 교체하고 `constraint` 비교만 이 파일에 남긴다. 여유가 되면 `pgErrorConstraint(err)` 를 SoT 에 추가해 기존 3개 사본도 점진 이관 |
| 2 | 아키텍처 | 같은 PR 이 신설한 두 형제 가드가 "이름 목록을 손으로 적지 말고 소스에서 파생하라"는 이 PR 자신의 설계 원칙(구조 축 `user-entity-exposure-guard.ts` 는 이미 이 교훈을 실측 근거로 반영)을 값 축 자매 가드는 따르지 않음 — `USER_SECRET_KEYS` 를 `user.entity.ts` 실제 컬럼과 대조하는 테스트가 0건 | `codebase/backend/src/shared/testing/user-secret-absence.ts:24-32` (`USER_SECRET_KEYS`) vs `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:158-166` | `user.entity.ts` 를 AST 로 스캔해 `select:false` 없는 비밀 패턴(`*Token`/`*Secret`/`*Hash`/`*RecoveryCodes`) 컬럼과 `USER_SECRET_KEYS` 를 대조하는 테스트 추가, 최소한 엔티티 컬럼 수 카나리아라도 둔다 |
| 3 | 테스트/요구사항 | `.claude/hooks/_lib/review_guard.py` 의 신규 `_strip_comment` 가 **따옴표로 감싼 스칼라 + 트레일링 주석** 조합(`"a.ts"  # note`)을 처리하지 못해 닫는 따옴표+주석이 값에 남는 "죽은 glob" 이 재생산된다(재현 확인). 이 PR 은 언쿼트 트레일링 주석 3형태는 촘촘히 테스트했으나 이 인접 변형에는 대조군이 없다. 현재 저장소 `spec/**` 에 이 조합이 실존하지 않아 즉각 피해는 없음 | `.claude/hooks/_lib/review_guard.py` (`_strip_comment`), `.claude/tests/test_review_guard.py` (quoted 케이스 부재) | quoted 스칼라의 닫는 따옴표 위치를 찾아 그 뒤 트레일링 텍스트를 잘라내도록 확장하거나, 최소한 quoted+trailing-comment 대조군 테스트를 추가해 갭을 명시적으로 기록 |
| 4 | 스코프 | 최종 커밋(`a185846a5`)이 "User 컬럼 방어"와 무관한 신규 프로덕션 동작(트리거 endpoint-path 충돌 시 `details.subCode` 응답 필드)을 이 브랜치에 추가 — JSDoc 가드→harness 파서 수정→spec 문서 정정에 이은 **4번째 연쇄 확장 층**이며, 앞선 세 층과 달리 실제 API 응답 바디에 새 필드를 추가하는 프로덕션 변경 | `codebase/backend/src/modules/triggers/triggers.service.ts` (`isEndpointPathUniqueViolation`, `rethrowEndpointPathConflict`) | 기능·테스트 품질은 충분해 되돌릴 필요는 없으나, 릴리스 노트 작성 시 이 브랜치가 서로 다른 4개 관심사를 담고 있음을 명시. 향후 게이트 확장이 무관 부채를 드러내는 패턴이 반복되면 해당 항목은 별도 브랜치로 분리 검토 |
| 5 | 테스트 | `WorkspacesService.listMembers` 는 이 PR 이 스스로 "구조 축 가드가 지키지 못한다"고 명시한 유일한 채널인데 단위 테스트가 0건 — 방어가 신규 e2e 1건에 전적으로 의존(빠른 피드백 루프 없음, 실패 원인 좁히기 불가) | `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`) / 부재: `workspaces.service.spec.ts` | `listMembers` 단위 테스트 추가 — mock `memberRepository.find` 가 `user` 에 `passwordHash` 등 추가 필드를 포함해도 반환 키가 `{id,userId,email,name,role,joinedAt}` 로 좁혀지는지 단언 |
| 6 | 문서화 | `CHANGELOG.md` 가 최종 커밋(`a185846a5`)의 두 안건 중 하나(트레일링 같은-줄 주석 파서 결함 수정)를 누락 — 다른 하나(트리거 endpoint 충돌)는 실었음. 커밋 메시지·코드 docstring·plan·테스트에는 서술돼 있으나 CHANGELOG 에만 없어 "파서 결함은 하나였고 다 닫혔다"는 불완전한 인상을 줌(실질 렌더링/판정 영향은 없음) | `CHANGELOG.md` (`## Unreleased — User 엔티티에 마지막 방어선을 세운다` 절) | 해당 절에 트레일링 같은-줄 주석 결함과 수정 내역(테스트 4건, 731 대 731 재확인)을 한 단락 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (수정 완료) | `WorkflowVersionsService.findOne` 이 `creator` 관계를 투영 없이 로드해 `User` 전 컬럼(비밀번호 해시·2FA 시크릿·복구 코드·토큰)을 응답으로 유출하던 실제 Critical 을 이번 PR 이 직접 발견·수정(`CREATOR_PROJECTION` 3필드 투영 + 단위/e2e 테스트) | `workflow-versions.service.ts` (`findOne`) | 조치 완료. 과거 노출분(로그/캐시/APM)의 사후 로테이션 여부는 이 diff 범위 밖 |
| 2 | 보안 | 응답 DTO JSDoc 2건이 Swagger 를 통해 내부 리뷰 경로/일시를 노출(기존 부채, 이번 PR 은 계량화만) | `schedule-response.dto.ts`, `trigger-response.dto.ts` | 조치 불요(정책상 소급 정리 대상 아님). 다음에 해당 DTO 를 만질 때 인용을 `//` 로 이동 |
| 3 | 보안 | 신규 방어 3축은 검출(detect) 전용이며 실행 시점 차단이 아님 — 설계 문서에 이미 disclose 된 의도적 트레이드오프 | `user-entity-exposure-guard.ts`, `user-secret-absence.ts` | 조치 불요 |
| 4 | 아키텍처 | `WorkflowVersionDetail`(백엔드)와 동명 FE 타입이 공유 계약 없이 형태 divergence 지속(기존 부채, 투명 disclose) | `workflow-versions.service.ts:46-64` vs `frontend/src/lib/api/workflows.ts:109` | 다음에 이 API 형태를 만질 때 `codebase/packages/` 공유 타입 이전 또는 이름 분리 고려 |
| 5 | 요구사항 | §5.4 "검증 층" 표·`code:` 등재 후속 작업이 plan 에 명시적으로 미완 상태로 추적됨(숨은 갭 아님) | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요, 다음 라운드 확인 |
| 6 | 스코프 | 이전 라운드가 지적한 e2e 라벨 중복(`F.`)이 `J.` 로 재명명되어 해소됨 | `workspace-rbac.e2e-spec.ts` | 조치 불요 |
| 7 | 스코프/API계약 | `WorkspaceMemberDto.joinedAt` 필드 추가는 목표 밖 곁가지지만 CHANGELOG·DTO 주석·plan 세 곳에서 투명하게 disclose, §5.4 규칙(상시 존재+nullable)과 실제 서비스 매핑 모두 일치 | `workspace-response.dto.ts:81-93` | 조치 불요 |
| 8 | 부작용 | 공유 게이트 파서 수정(`review_guard.py`)으로 파싱 entry 수가 690→731 로 확대, 이 PR 과 무관한 7개 spec 파일까지 게이트 판정이 넓어짐(순수 함수, 부수효과 없음, CHANGELOG·테스트로 disclose) | `.claude/hooks/_lib/review_guard.py` | 조치 불요. 병합 시 다른 in-flight 브랜치가 새로 게이트에 걸릴 수 있음을 팀 공지 |
| 9 | 부작용 | `WorkflowVersionsService.findOne` 반환 타입이 좁혀짐(`Promise<WorkflowVersion>`→`Promise<WorkflowVersionDetail>`) — 유일 호출자·컨트롤러 확인 결과 영향 없음 | `workflow-versions.service.ts` | 조치 불요 |
| 10 | 유지보수성/테스트 | `triggers.service.spec.ts` 의 `it.each` 케이스가 동일 실패 호출을 두 번 실행(중복, 결과엔 영향 없음) | `triggers.service.spec.ts` | promise 를 변수에 담아 두 단언에서 재사용 |
| 11 | 유지보수성 | 신규 Python 테스트 4건의 멀티라인 문자열 들여쓰기가 파일 내 기존 스타일과 다름 | `.claude/tests/test_review_guard.py` | 포매터 적용 또는 수동 정렬 |
| 12 | user_guide_sync | `WorkspaceMemberDto.joinedAt` 은 이미 FE 타입에 존재했고 실제 렌더링 UI 표면이 없어(0건) 유저 가이드 갱신 불요로 판정 | `workspace-response.dto.ts`, `frontend/src/lib/api/workspaces.ts` | 향후 UI 가 이 필드를 렌더링하게 되면 `workspaces-and-members.mdx` 갱신 검토 |
| 13 | API계약 | 트리거 UNIQUE 충돌 `details` 추가는 순수 additive, 상태코드·top-level code 유지, `GlobalExceptionFilter` 로 wire 도달 확인 | `triggers.service.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실제 Critical 유출(`findOne`)을 이 PR 이 자체 수정, 잔여는 기존 부채(JSDoc 인용) INFO 뿐 |
| architecture | MEDIUM | PG 에러 판별 SoT 우회(4번째 사본), 자매 가드 간 "소스 파생" 원칙 불일치 |
| requirement | LOW | 핵심 계약 전부 spec 과 line-level 일치 확인, `_strip_comment` quoted 케이스 갭 |
| scope | MEDIUM | 목표 밖 4번째 연쇄 확장(트리거 프로덕션 기능 추가) |
| side_effect | LOW | 신규 가드 전부 읽기 전용 순수 스캔, 두 fix 모두 additive·disclose 됨 |
| maintainability | LOW | 이전 8라운드 지적 전부 해소 확인, 잔여는 사소한 테스트 중복/스타일 |
| testing | LOW | 테스트 품질 전반 우수, `listMembers` 단위 테스트 부재·quoted 주석 갭 |
| documentation | LOW | 문서화 품질 우수, CHANGELOG 가 최종 커밋 안건 하나 누락 |
| api_contract | NONE | 계약 갭 2건을 스펙에 맞춰 정확히 좁힘, 하위호환 유지 |
| user_guide_sync | NONE | 매칭 trigger 1건(`backend-api-change`)뿐이며 target 충족/불요 판정 |

## 발견 없는 에이전트

없음 — 10개 reviewer 전원이 최소 1건 이상(WARNING 또는 INFO)을 보고했다(security/api_contract/user_guide_sync 는 위험도 NONE 이나 INFO 항목은 존재).

## 권장 조치사항

1. `TriggersService.isEndpointPathUniqueViolation` 의 SQLSTATE 판정을 `common/db/pg-error.ts` 의 `pgErrorCode`/`isPostgresUniqueViolation` 재사용으로 교체한다(WARNING #1).
2. `WorkspacesService.listMembers` 에 단위 테스트를 추가해 e2e 단독 의존을 해소한다(WARNING #5) — 이 PR 이 스스로 "가드가 못 지킨다"고 밝힌 유일한 자리다.
3. `USER_SECRET_KEYS` 를 `user.entity.ts` 실제 컬럼과 대조하는 테스트를 추가해 자매 가드와 설계 원칙을 맞춘다(WARNING #2).
4. `review_guard._strip_comment` 에 quoted 스칼라 + 트레일링 주석 처리를 추가하거나 최소한 대조군 테스트로 갭을 명시한다(WARNING #3).
5. `CHANGELOG.md` 에 누락된 트레일링 주석 파서 수정 내역을 보완한다(WARNING #6).
6. (선택) 향후 릴리스 노트/PR 설명에 이 브랜치가 담은 4개 독립 관심사(User 컬럼 방어·JSDoc 인용 가드·harness 파서 수정·트리거 endpoint 충돌 구현)를 명시한다(WARNING #4).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(정적 스캔 가드 + 순수 additive 응답 필드)에 성능 영향 표면 없음 |
  | dependency | 신규 외부 의존성 추가 없음 |
  | database | 신규 마이그레이션/스키마 변경 없음(기존 인덱스·컬럼만 참조) |
  | concurrency | 신규 동시성 제어 로직 없음(읽기 전용 스캔 + additive 에러 매핑) |