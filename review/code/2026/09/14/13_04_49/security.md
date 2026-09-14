# 보안(Security) Review — trigger-canary-hardening (라운드 5)

## 범위 요약

`git diff --stat origin/main...HEAD -- codebase/` 기준 실제 코드 변경은 6개 파일로,
직전 4라운드(`review/code/2026/09/14/11_27_40`~`12_37_01`)에서 이미 심사된 것과 동일한
diff 다 — 이번 프롬프트에 새로 실린 나머지 파일들은 그 4라운드의 RESOLUTION/SUMMARY/체커
산출물(md·json)과 `review/consistency/2026/09/14/10_44_37/**` 산출물, `plan/**` 트래커
갱신이며 실행 코드가 아니다.

1. 신규 devtime repo-guard(`trigger-secret-columns-guard.ts`) + 소비 spec(`trigger-secret-columns.spec.ts`) — 트리거 응답에서 지워야 할 비밀 컬럼 목록 3중 사본의 **정적 정합성**을 TypeScript AST 로 검증하는 순수 읽기 로직.
2. 기존 e2e/캐너리 스펙에 `expectTriggerWorkflowRef(...)` 단언 3곳 추가 — 이미 존재하는 응답 필드 검증.
3. JSDoc/주석/plan 문서 정리(원문자→아라비아 숫자, teardown 근거 실측 반영) — 동작 변경 없음.

프로덕션 코드(`triggers.service.ts` 등)는 이번 diff 에 포함되지 않는다. 새 HTTP 엔드포인트,
인증/인가 분기, 암호화 로직, 외부 네트워크 호출은 도입되지 않는다.

## 발견사항

- **[INFO]** 신규 repo-guard 의 파일 경로 인자는 전부 하드코딩 상수 — 경로 탐색 위험 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` — `CANONICAL_SOURCE`/`MIRROR_SOURCES` 상수 선언부(12-26행), `readStringArrayConst` 함수(46-106행), `readAllTriggerSecretColumnLists`(109-123행)
  - 상세: `readStringArrayConst(repoRoot, relPath, constName)` 이 `path.join(repoRoot, relPath)` 로 절대경로를 만들고 `fs.readFileSync`/`fs.existsSync` 로 읽는다. `relPath` 는 파일 상단에 리터럴로 선언된 `CANONICAL_SOURCE`(13행) 또는 `MIRROR_SOURCES` 배열(23-26행)로만 호출되며(`readAllTriggerSecretColumnLists` 112-121행), 사용자 입력이나 외부 데이터가 경로 조합에 개입할 여지가 없다. `trigger-secret-columns.spec.ts` 의 대조군 케이스도 `fs.mkdtempSync(os.tmpdir())` 로 만든 격리 scratch 디렉터리 안에서만 `write()` 헬퍼로 파일을 생성·삭제한다(119-124행, `afterAll` 에서 `fs.rmSync` 로 정리) — repo 밖 임의 쓰기가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** AST 파싱만 사용 — 코드 실행/동적 평가 경로 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` (`ts.createSourceFile` + `ts.forEachChild` 순회, 60-104행)
  - 상세: `eval`/`vm`/동적 `require` 등 대상 파일 내용을 실행하는 경로가 없고, 순수 구문 트리 순회로만 리터럴을 추출한다. 정규식 대신 AST 를 택한 설계 근거(주석 안 예시 문자열이 값으로 오탐될 위험 회피, 32-35행)는 형제 가드(`redis-fail-open-catalog-guard.ts`)와 일관된 기존 패턴이다. 대상 파일은 모두 이 저장소 내부 소스이며 외부에서 주입된 파일을 파싱하지 않는다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 것으로 보일 수 있는 값들은 실제 시크릿이 아님 — 상수/더미 값 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` 의 `CANONICAL_CONST`/`MIRROR_CONST`(상수 **이름** 문자열, 14·27행), `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` 의 기존 fake secret 상수(이번 diff 는 76-79행 주석 4줄 추가만 — 상수 자체는 diff 밖)
  - 상세: 전자는 TypeScript 식별자 이름 문자열(`'TRIGGER_RESPONSE_STRIP_COLUMNS'` 등)이라 시크릿이 아니다. 후자는 형식 검증용 hex 더미 값으로 diff 범위 밖의 기존 코드이며 이번 변경이 새로 도입한 것이 아니다.
  - 제안: 없음.

- **[INFO]** `secret_store` 고아 row 관련 주석 정정은 스코프를 정확히 분리 — 프로덕션 삭제 경로(`secret-store.md §R4`)와 무관함을 명시
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (`afterAll` 상단 JSDoc, 148-168행 부근), `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` (76-79행)
  - 상세: `afterAll` 의 실제 정리 로직(raw `DELETE FROM trigger` 만 실행, `secret_store` 는 그대로 둠)은 이번 diff 에서 변경되지 않았고 — `git diff` 상 로직 라인은 unchanged — JSDoc 주석만 "무해함을 실측했다"는 근거(세션 간 `docker compose down -v`, 세션 내 `ref LIKE <접두>` 스코프)로 교체됐다. 프로덕션 삭제 경로(`TriggersService.remove()` → `deleteByPrefix`)는 이 한정과 별개로 `secret-store.md §R4` 를 그대로 따른다고 명시적으로 구분해 적었다(163-167행). 이 구분이 없었다면 "정리 안 해도 된다"는 결론이 프로덕션 삭제 경로로 잘못 번질 위험이 있었는데, diff 는 그 경계를 정확히 긋는다.
  - 제안: 없음.

- **[INFO]** e2e 신규 단언(`expectTriggerWorkflowRef` 3곳)은 기존 export 헬퍼 재사용 — 새 입력 경로 없음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — C-2 목록 케이스(277-280행), G 케이스(392-395행), H 케이스(429-432행)
  - 상세: 헬퍼(`expectTriggerWorkflowRef`) 자체는 이번 diff 에 포함되지 않고, 이미 HTTP 응답으로 받은 `row`/`patch.body.data` 에 대해 `expect` 단언만 추가한다. 새 네트워크 호출·DB 쿼리·인증 우회 경로가 없다.
  - 제안: 없음.

## 요약

이번 라운드(5회차)는 프로덕션 코드를 전혀 건드리지 않고, (1) 하드코딩된 상수 경로만 읽는
순수 devtime AST 정적 가드, (2) 기존 헬퍼를 재사용하는 e2e 단언 추가, (3) 주석/plan 문서
정리로만 구성된다. 새 인젝션 표면, 실제 시크릿 하드코딩, 인증/인가 변경, 안전하지 않은
암호화, 민감정보 노출 에러 메시지, 신규 의존성 어느 것도 관측되지 않았다. `git diff --stat
origin/main...HEAD -- codebase/` 로 실제 코드 diff 가 직전 4라운드와 동일함을 확인했고,
직접 두 신규 소스 파일(`trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts`)을
전문 열람해 경로 인자가 사용자 입력과 무관한 하드코딩 상수뿐임을 재확인했다.

## 위험도

NONE
