# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** `remove()` 의 선행 `findById` 호출이 동시성 정합성 관점에서는 이제 불필요한 왕복
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:299` (`await this.findById(id, workspaceId);`)
  - 상세: 뒤이은 `this.authConfigRepository.delete({ id, workspaceId })` 가 `affected === 0` 을 404 판별자로 쓰므로, 대상이 애초에 존재하지 않는 경우도 `delete()` 단독으로 정확히 404 를 낸다. `findById` 는 (SELECT 1회 + DELETE 1회)로 왕복을 하나 늘릴 뿐 동시 삭제 레이스의 정합성에는 기여하지 않는다 — 주석도 "이 `findById` 는 잠그지 않으므로 동시 삭제 두 건이 둘 다 여기까지 온다" 고 스스로 명시한다. 즉 레이스를 막는 것은 뒤의 원자적 `DELETE` 뿐이고 `findById` 는 그 전에 존재 여부만 확인하는 군더더기 단계다.
  - 제안: 정정을 요구할 정도는 아님(정확성엔 문제 없음, 형제 CRUD들과의 코드 형태 일관성·의도적 fail-fast 목적일 수 있음). 다만 핫 패스라면 `findById` 를 제거하고 `delete()` 단독 결과로 404 를 판별해도 동일하게 안전하다는 점을 기록해 둔다.

- **[INFO]** e2e 테스트의 공허성 가드 타이머가 정리되지 않음
  - 위치: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` — `Promise.race([...])` 블록 (unified diff 상 91~93행 부근, `setTimeout(() => resolve('pending'), 1_500)`)
  - 상세: `pending` 이 먼저 settle 되어도 `setTimeout` 핸들이 `clearTimeout` 되지 않는다. 테스트 결과에는 영향 없고(값은 `raced` 로만 소비) 단지 Jest `--detectOpenHandles` 류 진단에서 노이즈가 될 수 있는 수준의 사소한 사항.
  - 제안: 필요하면 `timer` 변수를 잡아 `clearTimeout` 하되, 우선순위는 낮음.

## 검증한 항목 (문제 없음)

- **경쟁 조건 수정 검증**: 종전 `findById` → `remove(config)`(엔티티 기준 삭제) 패턴은 두 동시 요청이 모두 `findById` 를 통과한 뒤 각자 `remove()` 를 호출해도 TypeORM `remove(entity)` 가 0행 삭제 시 예외를 던지지 않아 감사 로그가 2건 남는 TOCTOU 결함이었다. 새 코드는 `DELETE … WHERE id = $1 AND workspace_id = $2` 단일 문장의 `affected` 를 승자 판별자로 사용한다. Postgres 는 단일 DELETE 문 자체가 원자적이고 동일 행에 대한 동시 DELETE 는 DB 레벨에서 직렬화되므로, 두 요청 중 정확히 하나만 `affected: 1` 을 받고 나머지는 `affected: 0` 으로 404 를 받는다 — 감사 로그 이중 기록 결함이 올바르게 닫혔다.
- **원자성**: 판별에 별도 lock(advisory/row lock)을 두지 않고 단일 DELETE 문의 원자성에 의존하는 설계는 이 경로에 기존 lock 이 없다는 전제(주석에 명시)와 일치하며, 형제 PR(#1369~#1373)들의 처방과 동일한 패턴이다. `affected === 0` 명시 비교(`!affected` 아님)로 드라이버 미보고(`null`/`undefined`) 케이스를 정상 삭제로 취급하는 것도 올바르다 — 유닛 테스트에 `it.each([[undefined], [null]])` 대조군이 존재해 `!affected` 로의 회귀를 실측으로 막는다.
- **데드락**: 새 코드 경로에 다중 락 획득이 없어 데드락 가능성 없음. e2e 테스트가 사용하는 `SELECT … FOR UPDATE` 는 단일 커넥션이 단일 행에 대해 보유하는 락이며, 두 DELETE 는 그 락 해제를 대기만 할 뿐 순환 대기 구조가 아니다.
- **async/await**: `delete()` 호출과 `recordAudit()` 호출 모두 `await` 되어 있고, `throwAuthConfigNotFound()` 가 `never` 반환 타입으로 조기 종료를 강제하므로 패자 쪽에서 `recordAudit` 로 흘러갈 경로가 없다.
- **테스트 설계**: e2e 테스트가 공허성 가드(락 해제 전 `pending` 이 아직 settle 되지 않았음을 관측)를 포함해, fixture 가 실제로 겹침을 만들었는지를 자체 검증한다 — 이 가드가 없었다면 레이스가 실제로 발생하지 않았는데도 테스트가 통과하는 거짓 양성이 가능했을 것. `fireDelete()` 가 실패도 resolve 로 흡수해 `Promise.all` 이 unhandled rejection 없이 안전하게 동작하는 점도 확인.
- **워크스페이스 스코프**: `delete({ id, workspaceId })` 조건에 `workspaceId` 가 포함돼 cross-tenant 삭제를 차단하며, 유닛 테스트가 `toHaveBeenCalledWith({ id, workspaceId: WS })` 로 이 조건 전체를 단언한다.
- **저장소 뮤테이션 없음**: 본 리뷰는 코드 실행/뮤테이션 없이 정적 분석만 수행했으며 워킹트리에 어떤 파일도 쓰지 않았다.

## 요약

이번 변경은 `AuthConfigsService.remove()` 에서 동시 DELETE 두 건이 감사 로그(`auth_config.delete`)를 중복 기록하던 TOCTOU 경쟁 조건을 수정한다. 처방은 락을 새로 들이지 않고 단일 원자적 `DELETE` 문의 `affected` 값을 승자/패자 판별자로 사용하는 방식으로, DB 레벨 직렬화에 올바르게 의존하고 있으며 형제 PR들과 동일한 검증된 패턴이다. `affected === 0` 명시 비교로 드라이버 미보고 케이스의 오판(`!affected` 회귀)까지 유닛 테스트 대조군으로 막았고, e2e 테스트는 `SELECT ... FOR UPDATE` 로 실제 겹침을 강제 재현하며 공허성 가드까지 갖춰 판별력이 높다. 발견된 사항은 모두 INFO 수준(불필요한 선행 조회 왕복 1건, 테스트의 미정리 타이머)으로 정정을 강제할 만한 결함은 없다.

## 위험도

LOW
