# Security Review — 트리거 동시 DELETE 감사 중복 수정 (3차 라운드: 트래커 처분 + 단위 테스트 강화 반영)

## 발견사항

없음 (Critical/Warning 대상 없음).

### 검토 세부

- **인증/인가**: `TriggersService.remove()`(`codebase/backend/src/modules/triggers/triggers.service.ts`
  `remove()`)는 기존과 동일하게 `findById(id, workspaceId)` 로 워크스페이스 범위 조회를 하고,
  advisory lock 획득 뒤 신규 재조회(`const fresh = await m.findOne(Trigger, { select: { id: true },
  where: { id, workspaceId } });`)도 동일하게 `workspaceId` 로 스코프된다. 실제 소스(`sed -n
  '1058,1096p'`)로 직접 대조해 diff 와 일치함을 확인했다 — 다른 워크스페이스의 트리거 id 로는
  재조회가 걸리지 않아 크로스-테넌트 인가 우회가 없다.
  이번 라운드에서 추가된 `triggers.service.spec.ts` 신규 단위 테스트(`remove() — 락 안에서 행이
  사라졌으면 404 이고 삭제·감사·비밀 정리를 하지 않는다`)는 이 스코프 자체를 `mock` 이 값만 보고
  통과시키던 이전 공백(`review/code/2026/09/20/22_39_21` testing WARNING 1)을 닫고
  `expect(freshFindOptions.at(-1)).toMatchObject({ where: { id: 'trig-l', workspaceId: 'ws-1' } })`
  로 재조회의 인가 스코프 자체를 단언한다 — 보안 회귀(스코프 누락)를 잡아낼 테스트 커버리지가
  생긴 것으로, 결함이 아니라 개선.
- **인젝션**: 재조회는 TypeORM `findOne({ where: {...} })` 객체 스타일 파라미터 바인딩이라 SQL
  인젝션 경로가 없다. 신규 e2e(`codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`)의
  raw SQL 도 `pg_advisory_xact_lock(hashtext($1))`(게이트 93-95)과 `WHERE resource_id = $1`(게이트
  121-124) 모두 `$1` 파라미터 바인딩을 쓴다. `triggerConfigLockKey(id)` 에 넘기는 `id` 는 앞서
  API 가 생성한 트리거의 서버측 UUID 이고 임의 사용자 입력 문자열이 그대로 해시 함수에 들어가는
  경로가 아니다.
- **에러 처리 / 정보 노출**: 락 뒤 행 부재 시 `throwTriggerNotFound()`(일반 메시지 `'Trigger not
  found'`, `code: 'RESOURCE_NOT_FOUND'`)만 클라이언트에 반환되고 내부 사유는 노출되지 않는다.
  `.catch` 블록의 `this.logger.error(...)` 는 `err.message` 를 포함하지만 서버 사이드 로그로만
  남고 HTTP 응답에는 실리지 않는다. `if (err instanceof NotFoundException) throw err;` 로 정상적인
  경합 패배(404)를 "반쯤 삭제된 상태" 오류 로그로 잘못 승격시키던 거짓 경보를 없앤 것은 로그
  신뢰성 개선이다. 이번 라운드에서 추가된 단위 테스트(`remove() — genuine 삭제 실패는 반쯤 삭제된
  상태를 logger.error 로 남긴다`)는 이 분기(404 는 로그 없음, genuine 실패만 로그)가 실제로
  지켜지는지 뮤테이션으로 검증한 것으로, 보안 결함이 아니라 회귀 방지 커버리지.
- **하드코딩된 시크릿**: 이번 diff(코드·테스트·plan·CHANGELOG·이전 리뷰 라운드 산출물 45개 파일
  전부)에서 API 키·비밀번호·토큰·인증서 리터럴을 찾지 못했다. `grep -iE
  "password|secret|token|api[_-]?key|bearer|-----BEGIN"` 로 diff 전체를 훑은 결과 매칭은 전부
  (a) e2e 테스트의 `token` 변수 — `registerAndLogin()` 이 런타임에 발급하는 JWT, (b)
  `Authorization: Bearer ${token}` 헤더 조합, (c) `secretRef`/`botToken`/
  `notification_secret_rotated` 등 아키텍처 서술·감사 액션명·필드명이었다. 실값이 하드코딩된
  자리는 없다.
- **후속 RESOLUTION 커밋 검토** (이번 라운드가 새로 반영한 두 코드 커밋):
  - `931877519`: e2e 의 advisory lock key 문자열 리터럴을 제거하고 기존 export 함수
    `triggerConfigLockKey` import 로 교체 — 동작 변경 없는 리팩터, 보안 중립.
  - `4abc730cb`: genuine 삭제 실패 시 `logger.error` 호출 자체를 단언하는 신규 단위 테스트 추가 —
    테스트 전용, mock 기반이라 프로덕션 공격 표면에 영향 없음.
  - `ba904cdfe`(락 안 재조회의 `workspaceId` 스코프 단언 추가)도 같은 성격 — 테스트 강화이며
    인가 스코프 자체를 프로덕션 코드에서 바꾸지 않는다(소스 대조로 확인).
- **동시성 수정의 보안적 함의**: advisory lock 획득과 행 존재 확인 사이의 TOCTOU 간극을 닫아
  패자 요청이 이중으로 감사 로그·비밀 정리(`releaseSecretsAfterCommit`)를 수행하지 않도록 한다.
  감사 추적 신뢰성 저하를 막는 수정이며 새로운 인가 우회·자원 누수 경로를 만들지 않는다.
  - **이 diff 가 닫지 않는 것 (이미 문서화된 잔여, 재플래그 아님)**: 외부 provider teardown
    (chat-channel 등) 중복 호출은 여전히 락 밖에서 두 번 실행된다 — 이전 라운드
    (`review/code/2026/09/20/22_07_23` side_effect/concurrency WARNING 1)에서 이미 지적·실측(500
    유발이나 처리 중단으로 이어지지 않는 best-effort·실패 삼킴 구조)됐고, 이번 라운드의
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신분(게이트 4583-4589)에 명시적
    으로 크로스레퍼런스돼 있다. `SchedulesService.remove()` 자신의 스케줄 행 삭제가 같은 형태의
    감사 중복을 가질 수 있다는 사실도 같은 문서(게이트 4773-4783)에 신규 developer 항목으로
    투명하게 등재돼 있다 — 은폐가 아니라 스코프 밖 잔여의 명시적 트래킹.
- **문서/plan/JSON 산출물** (파일 1, 5~45 — CHANGELOG·plan 갱신·이전 리뷰 라운드
  `22_07_23`/`22_39_21`/`21_43_47` 의 SUMMARY/RESOLUTION/각 reviewer 산출물·JSON 상태 파일 전체):
  훑은 결과 하드코딩된 시크릿·자격증명·평문 토큰 없음. `_resolution_state.json`,
  `_retry_state.json`, `meta.json` 류도 커밋 SHA·타임스탬프·상태 플래그만 담고 있다.
- **의존성**: 신규 의존성 추가 없음 (`@jest/globals`, `pg`, `supertest`, `node:crypto` 모두 기존
  사용 패턴).

### 뮤테이션 검증 관련 메모

이 리뷰는 정적 분석(diff 대조 + 실제 소스 파일 `sed`/`grep` 확인)만으로 결론에 충분히 도달했다.
저장소 파일을 뮤테이션하지 않았다 — `git status --short` 확인 결과 이 세션이 만든 잔여 변경은
세션 자신의 출력 디렉터리(`review/code/2026/09/20/23_04_17/`) 외에는 없다.

## 요약

이번 3차 라운드는 앞선 두 라운드(`22_07_23`, `22_39_21`)가 이미 위험도 NONE 으로 판정한 동일한
프로덕션 코드 변경(`TriggersService.remove()` 의 advisory lock 안 재조회 + `NotFoundException`
분리)에, 트래커 처분 정정(plan/CHANGELOG 문서)과 단위 테스트 강화(재조회의 `workspaceId` 스코프
직접 단언, genuine 실패 시 `logger.error` 호출 자체 단언) 두 커밋을 더한 것이다. 실제 소스를
직접 열어 대조한 결과 인가 스코프(`workspaceId`)는 재조회에도 그대로 유지되고, 신규/기존 쿼리는
모두 파라미터 바인딩되어 있으며, 에러 응답은 일반화된 메시지만 노출하고 상세 사유는 서버 로그
에만 남는다. diff 전체(코드 4개 파일 + plan/CHANGELOG + 과거 리뷰 산출물 40여 개)를 시크릿
패턴으로 훑어도 하드코딩된 자격증명은 없다. 새로 추가된 두 커밋은 보안 관점에서 테스트
커버리지 개선일 뿐 프로덕션 동작을 바꾸지 않으며, 이미 알려진 잔여(외부 provider teardown 중복
호출, `SchedulesService.remove()` 미해결)는 이번 diff 의 스코프 밖으로 투명하게 문서화돼 있어
은폐로 볼 수 없다. 새로운 취약점을 도입하지 않는다.

## 위험도

NONE
