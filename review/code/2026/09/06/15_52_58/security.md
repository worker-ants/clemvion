# 보안(Security) 리뷰

## 개요

이번 diff(`origin/main...HEAD`)는 `User` 엔티티 컬럼 노출을 막는 검출 3축
(`user-entity-exposure-guard.ts` 구조 축, `dto-jsdoc-citation-guard.ts` JSDoc 인용 축,
`user-secret-absence.ts` 이름 축) 신설, `WorkflowVersionsService.findOne` 의 실제
`User` 전체 노출 수정, 트리거 UNIQUE 위반 처리(`pg-error.ts` 확장 + `triggers.service.ts`
409 매핑), YAML frontmatter 파서(`review_guard.py`) 유실 버그 수정으로 구성된다. 이미
10여 차례의 `/ai-review`+`/consistency-check` 라운드를 거친 브랜치라 대부분의 실질적
결함(감사 로그 26키 유출, `WorkflowVersionsService.findOne` 유출, eager 관계 검출력 0,
객체 형태 `relations` 누락 등)은 이미 이 diff 안에서 처분돼 있다. 이번 라운드에서
새로 코드를 열어 확인한 결과, 신규로 지적할 Critical/Warning 급 결함은 발견되지 않았다.

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` 유출은 이 PR 이 스스로 고친 것이지만, 노출
  창(수정 전 코드가 배포돼 있던 기간) 동안 실제로 나갔을 수 있는 자격증명에 대한 사후
  조치(로테이션) 필요 여부를 코드 변경만으로는 판단할 수 없다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:141-166`
    (수정), `CHANGELOG.md`(Unreleased 절 — "이미 나간 것은 회수되지 않는다")
  - 상세: 수정 전 `findOne` 은 `relations: ['creator']` 를 투영 없이 로드해 컨트롤러가
    가공 없이 반환했으므로, 해당 워크스페이스 멤버(viewer 포함) 권한으로
    `GET /api/workflows/:wfId/versions/:versionId` 를 호출하면 버전 작성자(`creator`)의
    `User` 전 컬럼 — `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
    `webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken` —
    이 그대로 wire 로 나갔다. `user.entity.ts:81-124` 를 직접 확인하면 `emailVerifyToken`·
    `passwordResetToken`·`emailChangeToken` 은 "raw 토큰은 메일 링크로만 전달" 하고 컬럼에는
    **SHA-256 해시만** 저장한다는 주석이 있어(`:123-124`), 이 세 토큰과 두 복구 코드
    배열의 노출은 즉시 재사용 가능한 평문은 아니다. 반면 `passwordHash` 는 bcrypt 해시라
    오프라인 무차별 대입(특히 약한 비밀번호)에 노출된다. CHANGELOG 자체가 "이미 나간
    것은 회수되지 않는다" 고 명시하고 있으므로, 이 코드 수정과 별개로 (a) 노출 창 동안
    이 엔드포인트에 접근한 워크스페이스 멤버 로그를 조회해 실제 노출 여부/범위를 특정하고
    (b) 해당 사용자들의 2FA 복구 코드 재발급, 필요 시 비밀번호 재설정 안내 등 사후 대응이
    필요한지는 이번 코드 리뷰 범위 밖의 운영/보안팀 판단 사항이다.
  - 제안: 코드 수정 자체는 적절하다. 다만 이 발견을 별도 보안 인시던트 트래킹 항목으로
    남겨, 노출 기간·접근 로그 유무를 확인하고 필요한 사후 조치(2FA 복구 코드 재발급 등)
    여부를 결정할 것을 권한다.

- **[INFO]** `WorkspacesService.listMembers` 는 구조적 가드가 닿지 않는 유일한 자리로,
  런타임 방어가 아니라 테스트(단위+e2e)에만 의존한다 — 이 PR 이 스스로 그 사실을 문서화하고
  테스트로 메웠다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:199-225`
    (`listMembers`, 이 diff 에서 변경되지 않음), 방어 테스트는
    `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1123-1191`,
    `codebase/backend/test/workspace-rbac.e2e-spec.ts:589-639`
  - 상세: `listMembers` 는 `relations: ['user']` 로 `User` 전 컬럼을 로드한 뒤 JS 단에서
    `email`·`name` 만 뽑아 새 객체를 만든다. `user-entity-exposure-guard.ts` 는 "로드
    형태" 만 보므로, 이 매핑이 넓어져도(예: `...m.user` 스프레드) 구조 가드는 계속
    초록이다 — PR 의 JSDoc(`user-entity-exposure.spec.ts:577-599`)이 이 사실을 정확히
    지목하고 있다. 안전망은 신설된 `findUserSecretLeaks`/`expectNoUserSecrets`(이름 축)
    를 쓰는 단위 테스트 1건과 e2e 1건뿐이며, 둘 다 컴파일 타임이 아니라 테스트 실행
    시점에만 회귀를 잡는다. 현재 프로덕션 코드는 안전하고 이 diff 가 그 안전판을
    처음으로 테스트로 고정했다는 점에서 개선이지, 새로운 결함은 아니다.
  - 제안: 조치 불요(이미 사용자 결정으로 "검출" 전략을 택했고 근거가 CHANGELOG/plan 에
    실측과 함께 남아 있음). 다음에 이 메서드를 다시 만질 때는 `select` 기반 DB 레벨
    투영(자매 수정인 `WorkflowVersionsService.findOne` 과 같은 형태)으로 옮기는 것을
    고려할 만하다는 점만 기록.

- **[INFO]** 새 가드/유틸 코드(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`,
  `user-secret-absence.ts`, `review_guard.py` 파서 수정)는 전부 dev-tooling·테스트
  보조 코드이며, 신뢰할 수 없는 외부 입력을 처리하지 않는다 — 인젝션·ReDoS 관점에서
  문제되는 패턴 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts:49-53`
    (`CITATION_PATTERNS`), `.claude/hooks/_lib/review_guard.py`(`_strip_comment`/
    `_parse_frontmatter_code`)
  - 상세: 정규식들은 고정 길이 `\d{n}` 반복과 단일 `\s+` 로만 구성돼 중첩 정량자가 없어
    catastrophic backtracking 경로가 없다. 두 파일 모두 저장소 자체 소스 파일을 읽는
    로컬 CLI/CI 도구이고 HTTP 요청 등 외부 신뢰 경계를 넘지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 트리거 UNIQUE 위반 매핑은 DB 내부 정보를 클라이언트에 노출하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1608-1631`
    (`rethrowEndpointPathConflict`)
  - 상세: SQLSTATE 23505 + 인덱스명(`idx_trigger_workspace_endpoint`)을 술어로 좁혀
    잡은 뒤, 사용자에게는 일반화된 한국어 메시지와 `code`/`details.code` 만 반환하고
    원본 `QueryFailedError`(쿼리 텍스트·제약 이름 등)는 wire 로 나가지 않는다. 매칭되지
    않는 다른 UNIQUE 위반은 그대로 재던져 전역 예외 필터가 처리하므로 새로운 정보
    노출 경로가 생기지 않는다.
  - 제안: 조치 불요.

## 요약

핵심 변경인 `WorkflowVersionsService.findOne` 의 `User` 관계 무투영 전체 로드는 실제
Critical 급 정보 노출(워크스페이스 멤버 누구나 다른 사용자의 비밀번호 해시·2FA 복구
코드 해시·토큰 해시를 조회 가능)이었고, 이 diff 는 DB 레벨 `select` 투영으로 해당
경로를 정확히 닫았다. 함께 신설된 세 검출 축(구조 기반 관계-로드 가드, DTO JSDoc 인용
가드, 응답 본문 이름 기반 부재 단언)은 실행 시점 방어가 아니라 CI/테스트 시점 회귀
방지 장치이지만, `select:false`(19곳 공유 로더, fail-silent 위험)와 전역
`ClassSerializerInterceptor`(298개 e2e 표면 전체 변경)를 실측 후 기각한 근거가 타당하고
문서화돼 있어 설계 판단으로 수용할 만하다. 트리거 충돌 처리·YAML 파서 수정에서도
인젝션·정보 노출·시크릿 하드코딩 등 새로운 취약점은 발견되지 않았다. 유일하게 기록할
가치가 있는 것은 이미 노출됐을 수 있는 자격증명(과거 `findOne` 유출)에 대한 사후
대응(로테이션) 필요 여부가 이번 코드 수정만으로는 해소되지 않는다는 점과,
`WorkspacesService.listMembers` 가 여전히 구조적 가드 밖에서 테스트만으로 지켜지고
있다는 점인데, 둘 다 이 PR 이 스스로 인지하고 문서화한 잔여 리스크다.

## 위험도

LOW
