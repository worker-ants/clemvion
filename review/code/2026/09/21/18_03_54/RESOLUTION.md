# RESOLUTION — review/code/2026/09/21/18_03_54

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드(문서) | `a20455447` | `CHANGELOG.md` 에 WebAuthn(아홉 번째이자 마지막) 항목 추가 + 기존 `auth_config`·`model_config` 두 항목의 "남는 것: WebAuthn, 아홉 번째" 전방 참조를 취소선으로 해소 |
| #2 | 코드 | `d3127c8a6` | `deleteCredential()` JSDoc 에 `@throws {NotFoundException} WEBAUTHN_CREDENTIAL_NOT_FOUND` + 동시 삭제 시 진 쪽 404 한 줄 추가(인라인 주석과 비중복) |
| #3 | 코드 | `d3127c8a6` | `WEBAUTHN_CREDENTIAL_NOT_FOUND` 리터럴 4곳(`renameCredential` 2곳 + `deleteCredential` 2곳)을 `private throwCredentialNotFound(): never` 로 추출, 형제(`throwAuthConfigNotFound`/`model-config` `notFound()`) 패턴과 통일. `:403` `UnauthorizedException`(401)은 대상 제외 + 헬퍼 JSDoc 에 그 차이 명시 |
| #4 | 코드(측정) | `69bd6ea84` | 이종 credential 동시삭제 `remaining` 경합 주장을 순서 논증(위 논증 참조)으로 반증하고, 그 논증을 e2e 캐너리로 고정. **코드 수정 없음** — 반증 결과이므로 |

## WARNING #4 — 측정 결과: 리뷰어 주장 반증

리뷰어(`concurrency` 에이전트)는 서로 **다른** credential 두 개를 동시 삭제하면
두 `countCredentials` 가 서로 상대의 커밋 전 스냅샷을 읽어 **둘 다**
`remaining === 1` 로 오판, `user.webauthn_recovery_codes` 가 NULL 화되지 않을 수
있다고 주장했다.

**main 의 순서 논증** (사전 분석): `deleteCredential` 에 트랜잭션이 없어 각
DELETE 는 그 자리에서 즉시 커밋되고 그 뒤에 자기 `count` 가 돈다(같은 요청 안
프로그램 순서 = 실시간 순서). R1(A 삭제) 커밋을 t1, count 를 t2(t1<t2), R2(B
삭제) 커밋을 t3, count 를 t4(t3<t4) 라 하면, 커밋은 Postgres WAL 상 전순서이므로
WLOG t1<t3. 그러면 R2 의 count(t4>t3>t1) 는 A·B 모두 이미 커밋된 뒤라 반드시
0 을 본다 — 즉 **나중에 커밋하는 쪽은 항상 0 을 본다.** 「둘 다 1 로 오판」하려면
`t1<t2<t3<t4<t1` 이 동시에 성립해야 하는데 이는 `t1<t1` 모순이다. 따라서 이
경합은 발생할 수 없다.

**e2e 로 고정**: `webauthn-credential-delete-concurrency.e2e-spec.ts` 에 두 번째
`it` 을 추가했다 — 별도 사용자에게 credential 두 개를 SQL 로 INSERT, 복구
코드를 SQL 로 직접 세팅(세팅됐음을 먼저 단언 — `['seed-hash-1','seed-hash-2']`
확인), 서로 다른 두 credential 을 동시 DELETE, 결과가 `[204, 204]` 임을 확인한
뒤 `user.webauthn_recovery_codes` 가 DB 에서 **NULL** 로 수렴했는지 직접
조회했다. **통과** (`_test_logs/e2e-20260921-182519.log`, 378 PASS = 기존 377 +
신규 1) — 리뷰어 주장은 반증됐다.

이 테스트는 삭제하지 않고 남겨 **캐너리**로 쓴다 — 누군가 이 메서드를
트랜잭션으로 감싸(delete 를 count 시점까지 커밋 지연) 위 순서 논증의 전제를
깨면 그때 RED 가 된다.

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260921-182030.log`)
- unit  : 통과 (`_test_logs/unit-20260921-182123.log`)
- build : 통과, 타입체크 ratchet 포함 (`_test_logs/build-20260921-182235.log`)
- e2e   : 통과, 378 PASS = 기존 377 + WARNING #4 반증 테스트 1건
  (`_test_logs/e2e-20260921-182519.log`)

## 보류·후속 항목

- INFO 5 (`§1.3` 오기재): `review/consistency/2026/09/21/17_39_06/SUMMARY.md` 경고
  표 1행이 실제로는 `spec/5-system/3-error-handling.md` **§1.11** 을 가리켜야 하는데
  `§1.3` 으로 오기재됐다. 그 SUMMARY 는 **checker 가 생성한 산출물**이라 손으로
  고치면 산출물과 실행 기록이 어긋난다 — 수정하지 않는다.
- INFO 3·4·10·11 등: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  트래커에 등재됐거나 유예 결정이 끝난 항목 — 재등재·재조치 안 함(SUMMARY 자체도
  "재지적 불필요"로 명시).
- WARNING #4 의 근본 원인(비원자적 `delete`+`count`+recovery-code-NULL 시퀀스
  자체)은 이번 PR 범위 밖으로 SUMMARY 가 이미 분류했고, 트랜잭션+행 락 개선은
  트래커의 별도 후속 항목이다(이번 세션은 "그 경합이 실제로 발생하는가"만
  측정·반증했을 뿐, 구조를 트랜잭션으로 감싸는 리팩터는 하지 않았다).
