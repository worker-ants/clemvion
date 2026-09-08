# 요구사항(Requirement) Review — 배치 B (spec-followups-batch-b)

검토 대상: `plan/in-progress/spec-followups-batch-b.md` B-1~B-8, 총 17개 코드/문서 변경 파일
(consistency 산출물 18~25번은 프로세스 아티팩트라 기능 요구사항 관점 검토 대상에서 제외).

## 방법

프롬프트에서 잘려 나간 전체 파일 컨텍스트(`.claude/test-stages.sh`, `PROJECT.md`,
`integration-oauth.service.ts`, `user-entity-exposure.spec.ts` 등)는 저장소에서 `Read`/`Grep`
로 직접 열어 대조했다. 저장소 파일은 전혀 수정하지 않았다(읽기 전용 검토) — `git status --short`
확인 결과 이 세션이 만든 변경 없음(사전 존재하던 `review/code/2026/09/08/` 미추적 디렉터리만 표시).
아래 실행은 모두 read-only 검증(테스트·타입체크 실행)이며 소스 트리를 건드리지 않았다:

- `npx jest`(backend) — `http-exception.filter.spec.ts` · `endpoint-path-conflict-wrap.spec.ts` ·
  `user-entity-exposure.spec.ts` · `production-build-devdep.spec.ts` ·
  `workspaces.service.spec.ts` · `workflow-versions/*.spec.ts` → **전부 GREEN**(125+13+6 개별 확인).
- `npx tsc -p tsconfig.build.json --noEmit`(backend), `npx tsc -p tsconfig.json --noEmit`(frontend)
  → 둘 다 오류 0.
- `python3 scripts/check-backend-typecheck-ratchet.py` / `check-frontend-typecheck-ratchet.py`
  → 둘 다 `OK`(baseline 과 일치).

## 발견사항

이번 배치(B-1~B-8) 범위에서 CRITICAL/WARNING 급 결함을 찾지 못했다. 아래는 INFO 수준 관찰이다.

- **[INFO]** B-6 AST 가드의 "래핑" 판정이 `.catch` 콜백 본문의 정적 텍스트 포함 여부만 본다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` —
    `isWrappedByConflictCatch` 함수(파일 내 `84|` 부근)
  - 상세: `cur.getText(sf).includes(CONFLICT_WRAPPER)` 는 콜백이 실제로
    `rethrowEndpointPathConflict` 를 **호출**하는지가 아니라 그 **식별자 문자열이 텍스트에
    존재**하는지만 본다. 예컨대 `.catch((err) => { /* rethrowEndpointPathConflict 미사용 */
    somethingElse(err); })` 처럼 이름이 주석·문자열로만 등장해도 "래핑됨"으로 오판할 수 있다.
    다만 이는 파일 헤더 JSDoc(`이름이 나타나는지만 묻는 좁고 눈먼 술어다`)이 명시적으로 인정하고
    fail-safe 방향(미래핑 쪽으로 시끄러워짐)을 택한 **의도된 설계**이며, 대조군 fixture
    (`catchButNotWrapping`)로 "체인 존재만으로는 안 됨"까지는 검증돼 있다. 다만 "이름만 텍스트로
    등장하고 실제 호출은 아님" 케이스에 대한 대조군은 없다.
  - 제안: 현재로선 실질 위험이 낮음(호출자가 8곳뿐이고 신규 사이트 추가 시 이 가드가 최소
    "존재를 인지시키는" 역할은 한다). 필요하면 향후 대조군에 "이름만 등장하고 호출하지 않는
    콜백" 케이스를 추가해 회귀를 고정할 수 있다. 차단 사유는 아님.

- **[INFO]** spec fidelity 확인 결과 — B-7 e2e 는 `spec/5-system/3-error-handling.md §1.10` 및
  `spec/2-navigation/2-trigger-list.md` (L96·L166)의 `409 RESOURCE_CONFLICT` +
  `details={field:'endpoint_path', code:'TRIGGER_ENDPOINT_PATH_CONFLICT'}` 계약과 실제
  `triggers.service.ts#rethrowEndpointPathConflict`(기존 코드, 이번 PR 범위 밖) 구현을 line-level
  로 대조 확인 — **완전 일치**. B-3(전역 필터 `isPostgresUniqueViolation` 치환)도
  `pg-error.ts`(SoT) 두 표면(`err.code`/`err.driverError.code`) 흡수와 정확히 일치하며, 회귀
  테스트(raw 표면 23505→409, non-23505→500)가 새 동작과 기존 동작 양쪽을 갈라 고정한다.
  차단 사유 없음, 참고 기록.

## 항목별 검증 요약

- **B-1** (`test-stages.sh` + `PROJECT.md`): `cmd_build()` 안에 `_cmd_typecheck_ratchets`가
  `_run_internal build` 뒤·`_cmd_build_docker_images` 앞에 정확히 삽입됨. `PROJECT.md`의
  "wrapper 4단계 밖의 CI 게이트" 표에서 두 행이 실제로 빠지고 그 사실을 알리는 인용문이 추가됨 —
  문서-코드 정합. 두 ratchet 스크립트를 직접 실행해 현재 baseline과 일치함을 실측 확인(회귀 없음).
- **B-2** (`tsconfig.build.json`): `**/__test-utils__/**` exclude 추가. 실제 저장소에 해당 이름의
  디렉터리가 `src/common/__test-utils__`·`src/modules/integrations/__test-utils__` 정확히 2곳
  존재(주석의 "두 곳" 주장과 일치). `production-build-devdep.spec.ts`의 대응 캐너리
  GREEN(`resolveBuildFileNames`가 TS 컴파일러 API로 glob을 해석하므로 손-정규식 리스크 없음).
- **B-3** (`http-exception.filter.ts`): `isUniqueViolation`(QueryFailedError 선요구, raw 표면
  누락) 삭제 → `isPostgresUniqueViolation` 치환. 분기 순서(`HttpException` → 이 분기 →
  `instanceof Error`)가 그대로 유지돼 기존 QueryFailedError 케이스도 안 깨짐 — 신규 회귀 테스트
  2건(raw 23505→409, raw 23502→500)이 양방향을 갈라 고정. 미사용이 된 `QueryFailedError` import
  제거 확인.
- **B-4** (`workspaces.service.ts#listMembers`): `relations:['user']` + `select:{...}` DB
  투영으로 전환. `user-entity-exposure-guard.ts`의 `hasProjectionFor`가 이 형태(값이 불리언이
  아닌 객체)를 투영으로 인식함을 가드 소스에서 직접 확인 — 화이트리스트에서 항목 제거가
  타당함. 신규 단위 테스트가 "쿼리가 select로 좁혀 요청하는가"(투영 축)와 "반환 키가
  6개인가"(매핑 축)를 분리 단언 — 투영을 되돌려도 매핑 단언만으로는 못 잡는다는 자체 주장이
  실제로 성립함(두 단언이 서로 다른 것을 본다).
- **B-5** (`integration-oauth.service.ts`): cafe24·makeshop 두 자리 모두 손-작성
  `constraint` 추출을 `pgErrorConstraint()` 로 정확히 치환, 다른 로직 변경 없음.
- **B-6** (신규 AST 가드 3파일): `triggerRepository.save()` 8곳(create·update 2곳 wrapped +
  6곳 unwrapped) 전수와 실제 소스가 정확히 일치함을 별도로 grep+수동 확인. 6개
  "unwrapped" 화이트리스트 항목 전부 `endpointPath` 토큰이 본문에 없음을 grep으로 재확인
  (화이트리스트 사유 주석이 실측과 일치).
- **B-7** (e2e B4): 실 DB 유니크 제약(`idx_trigger_workspace_endpoint`)을 실제로 타는 유일한
  테스트. 헬퍼(`createWebhookTrigger`)·`beforeAll` 셋업과 정합, 응답 상태·code·details 두 키를
  함께 단언(하나만 보면 details 유실을 놓친다는 주석대로 실제로 두 값 모두 검증).
- **B-8** (타입 rename): 백엔드 전역에서 `WorkflowVersionDetail` 잔존 참조 0건(JSDoc 텍스트
  제외), 컨트롤러가 타입명을 직접 참조하지 않아 rename만으로 안전. 프런트 타입은 이름만 다를 뿐
  변경 없음(JSDoc만 갱신) — 두 타입의 실제 형태 차이(`creator` 3필드 고정 vs 옵셔널·nullable,
  `createdAt` Date vs string)를 실제 소스에서 재확인, JSDoc 서술과 일치.

## 요약

배치 B의 8개 항목(B-1~B-8)은 계획서(`plan/in-progress/spec-followups-batch-b.md`)가 기술한
목표와 실제 구현이 라인 레벨로 일치한다. 각 항목은 사전 조건(가드 인식 형태, 실제 8곳의
save() 호출 목록, spec §1.10 계약 문구)을 코드/문서에서 직접 대조해 확인했고, 관련 단위·가드
테스트를 전부 실행해 GREEN을 확인했으며 두 typecheck ratchet과 양쪽 `tsc --noEmit`도 통과했다.
TODO/FIXME/HACK/XXX 등 미완성 표식은 도입되지 않았다. B-6 가드의 "이름 텍스트 포함" 판정은
설계상 의도된 좁은 술어이며 위험 방향이 fail-safe(과탐)라 INFO로만 기록한다. spec fidelity
관점에서 §1.10(에러 처리)·2-trigger-list.md의 문구와 신규 e2e/필터 코드가 정확히 일치함을
확인했다.

## 위험도

NONE
