# 보안(Security) Review

## 검토 범위

`patch-omit-undefined` 브랜치 diff (커밋 `fd21691c9` · `814a99605` · `6da351477` · `5a4bb2bd4` · `52744b0cf`, origin/main 대비). 핵심 소스 변경은 3개 서비스 파일과 공용 헬퍼:

- `codebase/backend/src/common/utils/omit-undefined.ts` — 배열을 거부하는 타입 가드(`NotArray<T>`) 추가.
- `codebase/backend/src/modules/{workflows,nodes,auth-configs}/*.service.ts` — PATCH 부분 본문 병합 시 `omitUndefined()` 로 감싸 `undefined` 필드가 로드한 엔티티 값을 덮지 않도록 수정.
- `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` — IDOR 검사용으로 함께 읽은 `workflow` 관계 전체가 응답에 실리던 결함을 제거(`const { workflow: _workflow, ...response } = saved;`).
- 나머지는 스펙/e2e 테스트 · CHANGELOG · plan 문서 · consistency 리뷰 산출물(문서/JSON, 실행 코드 아님).

**저장소 상태 메모**: 리뷰 도중 `git status --short` 가 `codebase/backend/src/modules/nodes/nodes.service.ts` 를 modified(`M`)로 순간 표시했다가, 바로 다음 확인(`git diff`)에서는 diff 도 없고 재확인한 `git status --short` 에서도 다시 clean 이었다 — 병렬로 워킹트리를 읽는(또는 원복하는) 다른 리뷰어의 순간 상태를 본 것으로 추정된다. 이 세션이 그 파일을 수정하지도, `git checkout/restore/stash` 등으로 되돌리지도 않았다. 현재(리포트 작성 시점) `git status --short` 는 이 리포트 디렉터리(`review/code/2026/09/27/13_50_41/`)만 untracked 로 보여 저장소는 clean 하다.

## 발견사항

- **[INFO]** 노드 PATCH 응답의 과다 노출(Excessive Data Exposure, OWASP API3) — 이번 diff 에서 이미 수정 완료
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` (게이트 76~83행)
  - 상세: 수정 전 코드는 IDOR 검사를 위해 `relations: ['workflow']` 로 함께 읽은 노드 엔티티를 그대로 `Object.assign` 후 반환해, `NodeDto` 에 선언되지 않은 부모 워크플로 행 전체(이름·설명·태그·`settings`·`createdBy` 등)가 PATCH 응답에 실렸다(plan 문서에 실측 기록, `_test_logs/e2e-20260927-133438.log`). 같은 워크스페이스 사용자가 다른 API로 조회 가능한 값이라 비밀값 유출은 아니지만, 응답 계약을 벗어난 필드 노출이었다. 이번 diff 의 `const { workflow: _workflow, ...response } = saved;` 로 이미 제거됐고 회귀 테스트(`nodes.service.spec.ts` "응답에 IDOR 검사용 workflow 관계를 싣지 않는다", e2e `patch-partial-body.e2e-spec.ts` 케이스 C 의 `assertMatchesContract`)가 고정한다.
  - 제안: 조치 완료. 후속 조치 불요 — 참고로만 기록.

- **[INFO]** `Object.assign(entity, omitUndefined(dto))` 패턴은 DTO 화이트리스트에 의존하는 mass-assignment 형태
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (게이트 249행), `codebase/backend/src/modules/nodes/nodes.service.ts` (게이트 78행), `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (게이트 247행)
  - 상세: 이 변경 자체는 `undefined` 키를 걸러내는 필터만 추가할 뿐, 병합되는 **키 집합**은 바꾸지 않는다 — 즉 이 diff 이전부터 존재하던 패턴(`Object.assign(entity, rest)`)과 동일한 신뢰 경계를 갖는다. 전역 `CustomValidationPipe`(`whitelist + forbidNonWhitelisted`, `WorkflowSettingsDto` JSDoc 이 명시)가 DTO 미선언 키를 400 으로 거부하므로 현재로선 임의 필드 주입 경로는 없다. 다만 이 패턴이 안전하려면 각 `Update*Dto` 가 계속 엄격한 화이트리스트를 유지해야 한다는 전제가 암묵적이다 — 새 DTO 필드 추가 시 검토 대상.
  - 제안: 이번 PR 범위에서 조치 불요(신규 취약점 아님). 새 필드를 DTO 에 추가할 때 `forbidNonWhitelisted` 가 여전히 걸려 있는지, 그리고 그 필드가 엔티티에 그대로 얹혀도 괜찮은지(예: 권한·소유자 필드가 아닌지) 리뷰 시 재확인 권고.

- **[INFO]** `omitUndefined` 는 `null` 을 명시적 "값 지우기" 로 남긴다 — 기존 설계 그대로
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts` (게이트 15행 JSDoc)
  - 상세: `WorkflowSettingsDto.maxConcurrentExecutions` 는 `@IsOptional() @IsInt() @Min(1)` 인데, `class-validator` 의 `@IsOptional()` 은 `null` 값도 검증을 건너뛴다 — 따라서 `settings: { maxConcurrentExecutions: null }` 을 보내면 유효성 검사를 통과해 JSONB 에 `null` 이 저장될 수 있다. 다만 이 DTO 파일은 이번 diff 의 변경 대상이 아니고(내용 미변경), 주석이 "런타임의 `resolveConcurrencyCap` 이 부적합 값을 defaultCap 으로 무시하는 backstop을 갖는다" 고 명시해 이미 알려진/의도된 설계다.
  - 제안: 이번 PR 범위 밖. 참고로만 기록 — 인가/보안 영향은 없음(동시 실행 상한이 기본값으로 폴백할 뿐).

- **[INFO]** 하드코딩된 시크릿·인젝션·암호화·에러 처리 관점에서 신규 이슈 없음
  - 위치: 전체 diff (`git diff origin/main...HEAD -- codebase/ CHANGELOG.md` 를 `password|secret|api[_-]?key|token=|BEGIN` 로 grep)
  - 상세: 매치된 것은 enum 값 `type: 'api_key'`(인증 설정 타입 리터럴)와 `token = owner.accessToken`(테스트 헬퍼가 로그인 후 받은 토큰을 변수에 담는 것) 뿐 — 둘 다 하드코딩된 자격증명이 아니다. SQL/커맨드 인젝션 표면(원시 쿼리, `exec`, 파일 경로 조합)도 diff 에 없다. `auth-configs.service.ts` 의 HMAC 알고리즘 화이트리스트(주석 참조)는 이번 diff 로 변경되지 않았고 그대로 유지된다. 인증/인가 체크(`assertWorkflowInWorkspace`, `node.workflow?.workspaceId !== workspaceId`, `findById(id, workspaceId)`)는 이번 diff 로 건드리지 않았다 — `omitUndefined` 삽입은 그 체크들 **이후** 지점에서만 병합 대상을 바꾼다.
  - 제안: 없음.

## 요약

이번 diff 는 PATCH 부분 본문이 `undefined` 필드로 로드된 엔티티 값을 덮어 응답/DB 값을 잃던 데이터 무결성 결함을 3개 서비스(workflows·nodes·auth-configs)에서 공용 헬퍼로 고치는 작업이며, 인가·인증 체크 로직 자체는 변경하지 않았다. 부수적으로 노드 PATCH 응답이 IDOR 검사용으로 함께 읽은 부모 워크플로 행 전체를 노출하던 과다 노출 결함도 같은 PR 안에서 이미 수정·테스트로 고정됐다. 하드코딩된 시크릿, 인젝션 벡터, 안전하지 않은 암호화, 민감정보 노출 에러 처리 등 OWASP Top 10 관점의 신규 위반은 발견되지 않았다. `Object.assign(entity, omitUndefined(dto))` 패턴이 DTO 화이트리스트(`forbidNonWhitelisted`)에 계속 의존한다는 점과 `maxConcurrentExecutions` 의 `null` 경유 우회는 기존 설계로 확인되어 이번 PR 의 결함으로 보지 않는다.

## 위험도

NONE
