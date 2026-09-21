# 요구사항(Requirement) 리뷰 — webauthn-dup-delete (아홉 번째/마지막 자리, 리뷰 후속 라운드)

## 스코프

이번 diff 는 `18_03_54` 리뷰 라운드의 WARNING 4건을 조치한 후속 커밋들
(`a20455447`, `d3127c8a6`, `69bd6ea84`, `c5da24ac6`)까지 포함한다. 핵심 프로덕션
변경은 여전히 `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`
`deleteCredential()` 한 곳이고, 나머지(unit spec 추가, 신규 e2e, CHANGELOG,
plan 문서, 이전 리뷰/consistency-check 산출물)는 그 변경의 테스트·근거·조치
기록이다. 실제 소스(`webauthn.service.ts`, `webauthn.controller.ts`,
`webauthn.service.spec.ts`, e2e spec)를 직접 `Read`/`grep` 으로 열어 diff 와
대조했고, `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md` 본문도
직접 확인했다. `_test_logs/*-20260921-182[0-5]*.log` 를 열어 lint/unit/build/e2e
재실행 결과(471 suites·9929 unit PASS, e2e 378 PASS)를 실측 확인했다. 저장소에
어떤 파일도 쓰지 않았다(`git status --short` 로 확인 — 이 세션의 출력 디렉터리만
untracked로 남음).

## 발견사항

- **[INFO]** spec 본문(`spec/5-system/1-auth.md:498`)의 WebAuthn credential DELETE
  행이 동시 삭제 시 404 의미론과 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 에러 코드를
  명시하지 않는다.
  - 위치: `spec/5-system/1-auth.md:498` (DELETE `/api/auth/2fa/webauthn/credentials/:id` 행)
  - 상세: 실제로 그 행을 읽어 확인했다 — "credential 삭제. **인증 필수** (JWT).
    **마지막 credential 삭제 시 ... NULL 화** ... 204" 만 적혀 있고 404/동시성
    언급이 없다. 반면 같은 클래스의 다른 자리(`spec/2-navigation/2-trigger-list.md:318`)는
    "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는
    `404 RESOURCE_NOT_FOUND`" 를 명시적으로 적어 둔 선례가 있다 — 이번 구현
    (진 쪽 404)은 그 확립된 저장소 관용과 정확히 부합하므로 코드가 아니라
    spec 문서화 밀도가 형제 대비 낮은 것이다. 이번 diff 가 새로 만든 갭이 아니고
    형제 8건 전부에 동일하게 존재하며, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 이미 planner 후속 항목으로 등재돼 있다(직접 확인).
  - 제안: 코드 되돌리기 대상 아님 — planner 턴에서 `1-auth.md` §5 DELETE 행에
    코드 명시. 회색지대이므로 SPEC-DRIFT 태그는 붙이지 않는다(이미 그렇게
    등재돼 있고 재등재 불필요).

- **[INFO]** `spec/5-system/3-error-handling.md:254`(§1.11)의 "`_NOT_FOUND` 는
  이름과 달리 404 가 아닐 수 있는 **유일한 예외**" 라는 문장이 실측으로
  거짓임이 재확인된다.
  - 위치: `spec/5-system/3-error-handling.md:254` / `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:403`(401, `verifyAuthentication`, 이번 diff 밖) vs `:517-521`(`throwCredentialNotFound`, 404)
  - 상세: 직접 grep 한 결과 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 에러 코드
    카탈로그(`spec/` 전체)에 **전혀 등재돼 있지 않고**, 코드 자체가 401
    (`verifyAuthentication`, 로그인 2FA 검증 단계, 이번 diff 미변경)과 404
    (`renameCredential`/`deleteCredential`, 이번 diff 가 후자를 건드림) 두
    status 를 오간다. §1.11 은 "다른 `*_NOT_FOUND` 는 전부 404" 라고 못박고
    있어 이 사실과 배치된다. 이는 이번 PR 이 만든 결함이 아니다 — 401 throw
    는 diff 밖(line 403, 미변경)에 있고, 404 throw 세 곳 중 두 곳(`renameCredential`)
    도 이번 diff 이전부터 존재했다. developer 는 spec 쓰기 권한이 없으므로
    (§자기-반증형 소정정 다섯 조건에도 해당하지 않음 — 이 문장을 developer
    자신이 쓴 것이 아니다) 직접 고치지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 planner 항목(코드 카탈로그 등재 + §1.11 문장 정정 + 401/404 분리 여부
    결정)으로 정확히 등재한 것을 확인했다. `--impl-prep` consistency-check
    (`review/consistency/2026/09/21/17_39_06`, WARNING 1)도 착수 전에 이미
    같은 사실을 적발해 BLOCK:NO 로 통과시켰다.
  - 제안: 코드 되돌리기 대상 아님, SPEC-DRIFT 도 아님(의도적 코드 개선을
    spec 이 못 따라간 경우가 아니라, spec 의 사실 진술 자체가 항상 거짓이었던
    경우) — 일반 회색지대 INFO 로 유지. planner 턴에서 위 등재 항목 집행.

- **[INFO]** `review/consistency/2026/09/21/17_39_06/SUMMARY.md` 가 위 §1.11
  문장의 소재를 "§1.3" 으로 오기재한 것이 여전히 남아 있다(직접 열어 확인 —
  20행·36행·42행 모두 "§1.3").
  - 위치: `review/consistency/2026/09/21/17_39_06/SUMMARY.md:20,36,42`
  - 상세: `RESOLUTION.md` 가 "checker 가 생성한 산출물이라 손으로 고치면
    산출물과 실행 기록이 어긋난다 — 수정하지 않는다" 고 명시적으로 판단해
    둔 것을 확인했다. 반면 같은 세션에서 developer 가 직접 쓴
    `plan/in-progress/webauthn-dup-delete.md`·`spec-draft-nullable-notation-followups.md`
    는 올바르게 §1.11 로 인용한다. 실제 spec 파일(§1.11)을 대조해도 이 판단이
    맞다 — checker 산출물은 실행 당시 스냅샷이므로 사후 수정하지 않는 것이
    합리적이다.
  - 제안: 기능 영향 없음, 조치 불요 — 이미 developer 가 같은 판단을 내렸고
    타당하다.

## 검증한 사항 (문제 없음 확인 — 이전 라운드 대비 재검증 포함)

- `deleteCredential()`: `findOne`(무락) → 소유권 비교 → `throwCredentialNotFound()`
  → `delete({ id, userId })` → `affected === 0` **명시 비교**로 404 →
  `countCredentials` → `remaining===0` 시 `usersService.update({ webauthnRecoveryCodes: null })`
  → `{ remaining }` 반환. 소스 직접 대조로 diff 가 그대로 반영됐음을 확인.
- `throwCredentialNotFound()` 헬퍼: JSDoc 이 "네 곳이 공유" 라고 주장하는 호출
  지점 수를 실제 grep 으로 세어 정확히 4곳(`renameCredential` 2 + `deleteCredential`
  2)임을 확인 — 함수명·JSDoc·구현 일치.
- 컨트롤러(`webauthn.controller.ts:326-350`): `deleteCredential` 이 reject 하면
  `auditLogsService.record(...)` 호출부(그 아래에 위치)에 도달하지 않는 구조를
  실제 소스로 확인 — "진 쪽은 감사에 도달하지 않는다" 는 서술과 구현이 일치.
  감사 액션 상수(`AUDIT_ACTIONS.USER_2FA_DISABLED = 'user.2fa_disabled'`, `audit-action.const.ts:74`)도
  e2e 의 쿼리 조건과 정확히 일치.
- 단위 테스트 3종(`webauthn.service.spec.ts:516-561`): 소유자 스코프 DELETE
  호출 단언, `affected:0`→404+`count`/`update` 미호출, `affected: undefined|null`
  대조군(`it.each`)이 실제 구현의 `=== 0` 명시 비교와 정확히 대응함을 확인 —
  `!affected` 로 되돌리는 회귀를 잡는 판별력 있는 테스트.
- e2e(`webauthn-credential-delete-concurrency.e2e-spec.ts`): 헬퍼(`createDbClient`,
  `uniqueEmail`, `registerAndLogin`)의 실제 export 시그니처를 대조해 일치 확인.
  행 락 + 공허성 가드(1.5s) + 상태쌍 `[204,404]` + 감사 1건 검증 구조가 실제
  구현과 부합. 두 번째 케이스(이종 credential 동시삭제, WARNING #4 반증)의
  수학적 순서 논증(나중에 커밋하는 쪽이 항상 `remaining===0` 을 본다)도 직접
  재검산해 모순 없음을 확인 — `deleteCredential` 에 트랜잭션이 없어(별도
  statement) 각 요청의 DELETE 커밋이 자신의 COUNT 보다 먼저 온다는 전제가
  실제 코드(순차 `await`, 공유 트랜잭션 없음)와 일치한다.
- CHANGELOG.md: 실제 파일(`sed -n '1,140p'`)을 열어 diff 가 정확히 반영됐고,
  기존 두 전방 참조("남는 것: WebAuthn credential 삭제...")가 취소선 + "해소"
  문구로 정정됐음을 확인.
- 테스트 재실행 증거: `_test_logs/lint-20260921-182030.log`,
  `unit-20260921-182123.log`(471 suites, 9929 passed / 1 skipped — 스킵은 무관한
  기존 항목), `build-20260921-182235.log`, `e2e-20260921-182519.log`(378 passed,
  `webauthn-credential-delete-concurrency.e2e-spec.ts` PASS 확인)가 모두 실재하고
  WARNING 조치 커밋들 이후 시각에 재실행됐음을 확인 — RESOLUTION.md 의 "378 PASS"
  주장은 실측과 일치.
- TODO/FIXME/HACK/XXX 주석 없음(diff 전체 재확인).
- 모든 경로에서 반환값(`{ remaining }`) 또는 명시적 throw 로 귀결 — 누락 경로
  없음.
- plan 체크리스트(`plan/in-progress/webauthn-dup-delete.md`)의 미체크 항목
  (`/ai-review` 수렴, `--impl-done`, `plan/complete/` 이동)은 실제로 아직
  완료되지 않은 상태와 일치 — 거짓 체크 없음.

## 요약

핵심 변경(`deleteCredential()` 의 `affected===0` 명시 비교 도입 + DELETE 조건절
`userId` 스코프)은 형제 8건과 동일한 검증된 패턴을 정확히 재현하며, 실제
소스·테스트·spec 문서를 직접 열어 대조한 결과 함수 시그니처·에러 코드·반환
계약·감사-스킵 계약이 모두 diff 서술 및 spec/2-navigation/2-trigger-list.md 가
확립한 "동시 삭제 진 쪽 404" 관용과 일치한다. 이전 라운드(`18_03_54`)의 WARNING
4건(CHANGELOG 누락·JSDoc `@throws` 미기재·404 헬퍼 미추출·이종 credential
`remaining` 경합)은 각각 커밋(`a20455447`/`d3127c8a6`/`69bd6ea84`)으로 조치됐고,
조치 내용을 소스 대조로 재검증해 모두 실제로 반영됐음을 확인했다(테스트
재실행 378 PASS 로그 실존 확인 포함). WARNING #4(이종 credential 동시삭제 시
`remaining` 오판)에 대한 반증 논증은 트랜잭션 부재 전제를 실제 코드로 재검산해
타당함을 확인했다. 남은 이슈는 전부 이번 diff 가 만든 것이 아닌 사전 존재
spec 문서화 공백(§5 DELETE 행, §1.11 "유일한 예외" 오류 문장)이며, 두 건 모두
developer 권한 밖으로 정확히 판단돼 planner 트래커에 실측과 함께 등재돼 있어
이번 PR 을 막을 사유가 아니다. TODO/FIXME 없음, 모든 경로에서 반환값 정의됨.

## 위험도

NONE
