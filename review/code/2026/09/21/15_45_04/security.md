# Security Review — `authconfig-dup-delete` (2차 라운드, 15_45_04)

## 관측된 이상 상태 — 워킹트리 미커밋 뮤테이션 (본 리뷰어가 만든 것 아님)

리뷰 도중 `git status --short` 로 확인한 결과, 이 리뷰 세션이 시작하기 전부터(본 세션은 이 파일에
`Read`/`grep` 만 수행했고 `Write`/`Edit` 를 호출한 적이 없다) 아래처럼 **워킹트리에 미커밋 수정**이
존재했다:

```
 M codebase/backend/src/modules/auth-configs/auth-configs.service.ts
```

```diff
-    if (affected === 0) this.throwAuthConfigNotFound();
+    if (!affected) this.throwAuthConfigNotFound();
```

이는 plan(`plan/in-progress/authconfig-dup-delete.md`)과 unit 테스트가 명시적으로 겨냥하는 바로 그
뮤턴트(`=== 0` → `!affected`, `affected: null|undefined` 대조군을 죽이는 변경)와 정확히 일치한다 —
다른 reviewer(가능성이 높은 것은 testing/mutation 검증을 수행 중인 병렬 세션)가 같은 워킹트리에서
뮤테이션 테스트를 진행 중일 가능성이 크다. 본 리뷰의 소스 인용·분석은 모두 **diff(변경 후 정상
코드, `affected === 0`)를 기준**으로 했고, 이 미커밋 상태를 코드베이스의 실제 상태로 취급하지
않았다. 규약에 따라 본 세션은 이 파일을 직접 고치거나 `git checkout`/`restore` 로 되돌리지
**않았다** — 다른 세션의 진행 중 작업일 수 있어서다. 통합 SUMMARY/후속 세션은 이 워킹트리에 현재
`!affected` 로 뮤테이션된 미커밋 상태가 떠 있다는 사실을 인지하고, 최종 병합 전 `git status`/`git
diff` 로 이 파일이 원래 의도한 `affected === 0` 상태로 커밋돼 있는지 재확인해야 한다.

## 검토 범위

1차 라운드(`review/code/2026/09/21/15_18_16`)가 이미 보안 관점 NONE 으로 처분한 핵심 프로덕션 변경
(`AuthConfigsService.remove()` 의 `remove(entity)` → 원자적 `delete({id, workspaceId})` + `affected===0`
전환, `throwAuthConfigNotFound()` 추출)에 더해, 이번 라운드는 그 사이 있었던 후속 조치 커밋
(`69539209f`·`5502d1dee`·`caa9bae66`·`197425f51`)과 두 리뷰 세션(`15_18_16` code review,
`14_41_01` consistency check)의 산출물 일체가 저장소에 추가되는 diff다.

- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — 프로덕션 로직은 1차 라운드
  대비 **변경 없음**(주석/JSDoc 만 재작성). 워크스페이스 스코프(`delete({id, workspaceId})`),
  `affected === 0` 명시 비교, 파라미터화 쿼리(TypeORM), 에러 메시지 무정보노출 — 전부 재확인, 회귀 없음.
- `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — mock 정리(죽은
  `remove` 필드 제거, no-op `mockClear` 제거)뿐이며 테스트가 검증하는 보안 관련 불변식
  (`toHaveBeenCalledWith({ id, workspaceId: WS })`)은 그대로.
- `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` — 감사 카운트 쿼리에
  `resource_type = 'auth_config'` 필터가 추가됐다. 쿼리는 여전히 `$1` 바인드 파라미터만 사용(SQL
  인젝션 표면 없음), 필터 추가는 판별력 강화이지 보안 회귀가 아니다.
- `CHANGELOG.md`, `plan/in-progress/*.md` — 문서만. 비밀값·자격증명·개인정보 노출 없음.
- `review/code/2026/09/21/15_18_16/**`, `review/consistency/2026/09/21/14_41_01/**` — 이전 리뷰·
  consistency-check 세션의 산출물(SUMMARY/RESOLUTION/상태 JSON/개별 reviewer 리포트)이 신규 파일로
  추가된 것. 코드 실행 경로가 아니고, 하드코딩 시크릿·자격증명·PII 패턴 검색(`password=`,
  `api_key=`, `secret=`, `Bearer <token>`, `BEGIN PRIVATE KEY`, AWS 키 형태 등) 결과 실제 시크릿은
  발견되지 않았다(마스킹 컨벤션을 설명하는 문장 1건만 매칭, 실값 아님).

추가로 diff 밖이지만 인가 경계 재검증을 위해 `auth-configs.controller.ts` 의 `DELETE :id` 핸들러를
직접 열어 확인했다 — `@Delete(':id')` · `@Roles('admin')` · `@Param('id', ParseUUIDPipe)` ·
`@WorkspaceId()` 그대로이며 이번 diff 로 변경되지 않았다.

## 발견사항

- **[INFO]** 원자적 `DELETE` 전환이 워크스페이스 스코프를 조건절에 명시적으로 보존함(회귀 없음, 1차 라운드와 동일 결론 재확인)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `remove()`
    (`this.authConfigRepository.delete({ id, workspaceId })` 호출부, 게이트 323~327)
  - 상세: 종전 `remove(config)` 는 `findById(id, workspaceId)` 조회 결과 엔티티를 지워 워크스페이스
    스코프가 엔티티에 내재했다. 신규 `delete({id, workspaceId})` 는 두 필드 모두 조건 객체에 명시돼
    cross-tenant 삭제를 차단한다. `auth-configs.service.spec.ts`(게이트 307)의
    `expect(repo.delete).toHaveBeenCalledWith({ id, workspaceId: WS })` 가 이 조건 전체를 단언해
    향후 `workspaceId` 누락 회귀를 잡는다.
  - 제안: 없음(정상). 조치 불요.

- **[INFO]** `affected === 0` 명시 비교로 감사 로그 이중 기록(포렌식/모니터링 정합성) 결함이 닫힘
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `remove()` (게이트
    323~327, `if (affected === 0) this.throwAuthConfigNotFound();`)
  - 상세: 락 없는 `findById` 통과 후 무조건 성공하던 `remove(entity)` 대신, 단일 원자적
    `DELETE … WHERE id=$1 AND workspace_id=$2` 의 `affected` 를 판별자로 삼아 진 쪽만 404 를 받고
    감사를 남기지 않는다. `!affected` 가 아니라 `=== 0` 명시 비교라 드라이버 미보고(`null`/`undefined`)를
    "실패"로 오판해 정상 삭제가 404 로 뒤집히는 회귀도 막는다 — 대조군 테스트
    (`auth-configs.service.spec.ts` 게이트 328~343, `it.each([[undefined],[null]])`)가 이를 고정한다.
    (위 "관측된 이상 상태" 참고 — 현재 워킹트리엔 이 판정을 정확히 되돌리는 미커밋 뮤테이션이 떠
    있으나, 그 상태를 코드베이스의 실제 상태로 보지 않고 diff 상 정상 코드 기준으로 평가했다.)
  - 제안: 없음.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `throwAuthConfigNotFound()`
    (게이트 152~157)
  - 상세: `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Auth config not found' })` —
    존재 여부/워크스페이스 소속 여부를 구분해 노출하지 않는 일반 메시지. 스택 트레이스, 내부 쿼리,
    ID 원문, 다른 테넌트 정보 등 부가 노출 없음.
  - 제안: 없음.

- **[INFO]** 신규/수정 쿼리 전부 파라미터화 — SQL 인젝션 표면 없음
  - 위치: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts`
    (게이트 79~81 `SELECT id FROM auth_config WHERE id = $1 FOR UPDATE`,
    게이트 108~111 `SELECT COUNT(*)::text ... WHERE resource_type = 'auth_config' AND resource_id = $1 AND action = 'auth_config.delete'`)
  - 상세: raw `pg.Client` 쿼리 2건 모두 바인드 파라미터(`$1`)만 사용하고 문자열 결합이 없다. 이번
    라운드에서 추가된 `resource_type = 'auth_config'` 리터럴은 상수 문자열이며 사용자 입력이 아니다.
    하드코딩 자격증명·테스트 계정 비밀번호도 없음(`registerAndLogin` 헬퍼가 `uniqueEmail` 로 생성).
  - 제안: 없음.

- **[INFO]** 리뷰/consistency-check 산출물(신규 markdown·JSON 다수)이 저장소에 추가됨 — 보안 관점에서 특기사항 없음
  - 위치: `review/code/2026/09/21/15_18_16/**`, `review/consistency/2026/09/21/14_41_01/**` 전체
  - 상세: 이 파일들은 실행되는 코드가 아니라 이전 리뷰 세션의 텍스트 기록이다. 시크릿 패턴 검색
    (비밀번호·API 키·토큰·PEM 헤더·AWS 액세스 키 형태) 결과 실제 노출된 값은 없었다 — 유일하게
    매칭된 문장(`secret-store.md` §1 서술 인용, `***<last4>` 마스킹 컨벤션 설명)은 실값이 아니라
    문서 규약을 인용한 것이다.
  - 제안: 없음.

## 요약

이번 2차 라운드는 프로덕션 로직 변경이 없고(1차 라운드 이후 커밋은 문서·주석·mock 정리·e2e 쿼리
필터 추가뿐), 1차 라운드 security 리뷰가 확인한 결론 — 워크스페이스 스코프가 `delete()` 조건절에
명시 보존됨, `affected === 0` 명시 비교로 감사 로그 이중 기록과 오판정 둘 다 방지, 에러 메시지
무정보노출, 전 쿼리 파라미터화, 컨트롤러 `@Roles('admin')`/`@WorkspaceId()`/`ParseUUIDPipe` 인가
체인 불변 — 이 그대로 유지된다. 신규로 추가된 리뷰 산출물 파일들에서도 하드코딩 시크릿이나 민감정보
노출은 발견되지 않았다. 인젝션·인증/인가 우회·암호화·의존성 보안 어느 카테고리에서도 신규 결함이
없다. 단, 이 리뷰가 diff 를 읽는 도중 본 세션이 만들지 않은 미커밋 뮤테이션
(`affected === 0` → `!affected`)이 워킹트리에 떠 있는 것을 관측했다 — 위 "관측된 이상 상태" 절
참고. 병합 전 이 파일이 의도한 상태로 커밋돼 있는지 재확인 필요.

## 위험도

NONE
