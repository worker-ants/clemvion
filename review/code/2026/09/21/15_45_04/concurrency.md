# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** `remove()` 의 선행 `findById` 호출이 동시성 정합성 관점에서는 불필요한 왕복(선행 라운드에서 이미 지적된 항목, 재확인)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:306` (`await this.findById(id, workspaceId);`)
  - 상세: 뒤이은 `this.authConfigRepository.delete({ id, workspaceId })`(게이트 323~326)가 `affected === 0`(게이트 327)을 404 판별자로 쓰므로, 대상이 애초에 존재하지 않는 경우도 `delete()` 단독으로 정확히 404 를 낸다. `findById` 는 SELECT 왕복을 하나 늘릴 뿐 동시 삭제 레이스의 정합성에는 기여하지 않는다 — 바로 위 주석(게이트 308)도 "이 `findById` 는 잠그지 않으므로 동시 삭제 두 건이 둘 다 여기까지 온다" 고 스스로 명시한다. 레이스를 실제로 막는 것은 뒤의 원자적 `DELETE` 뿐이다.
  - 제안: 정정을 요구할 정도는 아니다 — 코드 자체 주석(게이트 302~305)과 신규 unit 테스트(`'대상이 없으면 DELETE 를 시도하지 않는다'`)가 "낭비 DELETE 회피 fail-fast" 라는 의도된 트레이드오프임을 명시한다. 조치 불요.

- **[INFO]** e2e 공허성 가드의 `setTimeout` 핸들이 정리되지 않음
  - 위치: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts:91` (`setTimeout(() => resolve('pending'), 1_500)`, `Promise.race([...])` 블록 내부)
  - 상세: `pending` 이 먼저 settle 돼도 이 `setTimeout` 핸들이 `clearTimeout` 되지 않는다. 테스트 판정(`raced` 값)에는 영향이 없고, Jest `--detectOpenHandles` 류 진단에서 노이즈가 될 수 있는 수준의 사소한 사항.
  - 제안: 필요하면 핸들을 변수로 잡아 `pending.then(...)` 이 먼저 resolve 될 때 `clearTimeout` 하되 우선순위는 낮음.

## 검증한 항목 (문제 없음)

- **경쟁 조건(TOCTOU) 수정 검증**: 종전 `findById` → `authConfigRepository.remove(config)`(엔티티 기준) 패턴은, 잠금 없는 `findById` 를 두 동시 요청이 모두 통과한 뒤 각자 `remove()` 를 호출해도 TypeORM `remove(entity)` 가 0행 삭제 시 예외를 던지지 않아 감사 로그(`auth_config.delete`)가 2건 남는 결함이었다(CHANGELOG·plan 실측: 고치기 전 e2e 로 둘 다 204, 감사 2건). 새 코드(`auth-configs.service.ts` 게이트 323~327)는 `DELETE … WHERE id = $1 AND workspace_id = $2` 단일 문장의 `affected` 를 승자 판별자로 쓴다. Postgres 는 동일 행에 대한 동시 DELETE 를 행 락으로 직렬화하므로 정확히 하나만 `affected: 1` 을 받고 나머지는 `affected: 0` → 404 를 받는다. 락(advisory/row)을 새로 들이지 않는 설계는 이 경로에 기존 lock 이 전혀 없었다는 전제(주석 게이트 309~311)와 일치하며, 형제 6곳(#1369~#1373)과 동일 패턴이다.
- **원자성 판별자의 명시 비교**: `affected === 0` (게이트 327)로 명시 비교하며 `!affected` 를 쓰지 않는다. `null`/`undefined`(드라이버 미보고)를 0 과 같이 취급하면 정상 삭제를 404 로 오판하는 회귀가 발생하는데, `auth-configs.service.spec.ts` 게이트 328~343 의 `it.each([[undefined], [null]])` 대조군이 이 회귀를 실측으로 막는다 — 형제 PR(#1371)에서 이 대조군 부재로 `=== 0` → `!affected` 뮤턴트 32건이 전건 GREEN 생존했던 사례가 CHANGELOG(게이트 88~90)에 기록돼 있고, 이번 PR 은 처음부터 그 대조군을 갖춘다.
- **데드락 가능성 없음**: 신규 경로에 다중 락 획득이 없다. e2e 테스트가 사용하는 `SELECT … FOR UPDATE`(`auth-config-delete-concurrency.e2e-spec.ts` 게이트 79)는 단일 커넥션(`locker`)이 단일 행에 대해 보유하는 락이고, 두 `DELETE` 요청은 그 락 해제를 대기만 할 뿐 순환 대기 구조가 아니다.
- **async/await 올바름**: `delete()` 호출(게이트 323)과 `recordAudit()` 호출(게이트 329) 모두 `await` 되어 있다. `throwAuthConfigNotFound()`(게이트 152~157)가 `never` 반환 타입이라 패자 쪽이 `if (affected === 0)` 분기에서 조기 종료되며 `recordAudit` 로 흘러갈 경로가 컴파일 타임에 차단된다.
- **테스트의 판별력 자체 검증(공허성 가드)**: e2e 테스트가 락을 놓기 **전** `Promise.race` 로 `pending` 이 아직 settle 되지 않았음을 관측(게이트 88~94)한 뒤에야 겹침이 실제로 만들어졌다고 판단한다 — 이 가드가 없다면 fixture 가 겹침을 못 만들었는데도 테스트가 통과하는 거짓 양성이 가능했다. `fireDelete()`(게이트 65~73)가 실패도 `.then(res=>..., ()=>({status:-1,...}))` 로 흡수해 `Promise.all` 이 unhandled rejection 없이 동작하는 점도 확인.
- **워크스페이스 스코프**: `delete({ id, workspaceId })`(서비스 게이트 323~326)에 `workspaceId` 가 포함돼 cross-tenant 삭제를 차단하며, unit 테스트(`auth-configs.service.spec.ts` 게이트 216~218)가 `toHaveBeenCalledWith({ id, workspaceId: WS })` 로 이 조건 전체를 단언한다.
- **mock 의 동시성 시뮬레이션**: `auth-configs.service.spec.ts` 게이트 48~51 의 `delete` mock 은 `DeleteResult` 를 명시 타입으로 반환해, `mockResolvedValueOnce` 로 대조군(`affected: null|undefined`) 을 캐스트 없이 주입할 수 없게 만드는 타입 좁힘 문제를 코멘트(게이트 45~47)로 이미 짚고 회피했다 — 타입체크 ratchet 이 실측으로 잡았다는 근거가 코드에 남아 있다.
- **저장소 뮤테이션 없음**: 본 리뷰는 정적 분석만 수행했고 워킹트리에 어떤 파일도 쓰거나 고치지 않았다(`git status --short` 를 별도로 실행하지 않아도 될 정도로 읽기 전용 작업만 수행). 파일은 output_file 경로에만 신규 작성했다.

## 요약

이번 변경은 `AuthConfigsService.remove()` 에서 동시 DELETE 두 건이 `auth_config.delete` 감사 로그를 중복 기록하던 TOCTOU 경쟁 조건(같은 결함 클래스의 일곱 번째 자리, 형제 #1369~#1373)을 수정한다. 처방은 새 락을 들이지 않고 단일 원자적 `DELETE` 문의 `affected` 값을 승자/패자 판별자로 삼는 방식으로, Postgres 의 행 락 기반 직렬화에 올바르게 의존하며 형제 PR들과 동일한 검증된 패턴을 그대로 재사용한다. `affected === 0` 명시 비교로 드라이버 미보고(`null`/`undefined`) 오판(`!affected` 회귀)까지 대조군 테스트로 막았고, e2e 테스트는 `SELECT ... FOR UPDATE` 로 실제 겹침을 강제 재현하며 공허성 가드까지 갖춰 판별력이 높다. 첨부된 CHANGELOG/plan/이전 리뷰 산출물 변경분은 코드가 아니라 문서이므로 동시성 리스크가 없다. 발견된 사항은 모두 이전 라운드(15_18_16)에서도 동일하게 지적됐던 INFO 2건(불필요한 선행 `findById` 왕복, e2e `setTimeout` 미정리)뿐이며 코드가 그 사이 바뀌지 않아 판정도 동일하다. 정정을 강제할 결함은 없다.

## 위험도

LOW
