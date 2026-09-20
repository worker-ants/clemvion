# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** e2e 테스트가 advisory lock key 포맷을 export 된 헬퍼 대신 문자열로 재구현
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts:29` (`const lockKey = (triggerId: string) => \`trigger-config:${triggerId}\`;`)
  - 상세: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 는 이미 `TRIGGER_CONFIG_LOCK_PREFIX`
    와 `export function triggerConfigLockKey(triggerId: string): string { return \`${TRIGGER_CONFIG_LOCK_PREFIX}:${triggerId}\`; }`
    를 공개해 두었다. 테스트는 이 함수를 쓰지 않고 같은 포맷(`trigger-config:<id>`)을 리터럴로
    복제했고, 주석("여기서 어긋나면 겹침이 안 생긴다")으로 그 결합·드리프트 위험을 스스로 인지하고
    있다. 이 저장소의 다른 e2e spec 들(`agent-memory-admin.e2e-spec.ts` 등 다수)은 `../src` 아래
    모듈을 직접 import 하는 선례가 있어, 같은 패키지 안에서 소스를 재사용하지 못할 기술적 제약은
    없어 보인다. 포맷이 바뀌면(예: prefix 변경) 이 테스트의 "raced" 공허성 가드가 실패해 드러나긴
    하지만("fail loud"), 두 곳에 같은 지식을 수동으로 동기화해야 하는 상태 자체가 유지보수 비용이다.
  - 제안: `import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';` 로 교체해
    `lockKey` 헬퍼를 제거하고 단일 진실원을 재사용.

- **[INFO]** 3번째로 반복되는 "동시 DELETE" e2e 테스트 스캐폴드 — 헬퍼 추출 여지
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` 전체 vs
    `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts` / `workspace-delete-concurrency.e2e-spec.ts`
  - 상세: 세 파일이 `db`/`locker` 커넥션 준비, `fireDelete` 헬퍼, "락을 놓기 전 둘 다 아직 안
    끝났다" 공허성 가드(`Promise.race` + `setTimeout`), `finally` 블록의 `ROLLBACK`+`pending` 정리,
    `audit_log` 카운트 단언까지 구조가 거의 동일하다(`diff` 로 대조 시 자원 생성 부분만 실질적으로
    다름). 다만 이 PR 의 plan(`plan/in-progress/trigger-dup-delete.md` "이 PR 이 하지 않는 것")이
    "네 자리 공용 헬퍼 추출은 하지 않는다 — 트래커의 별도 설계 항목이 그 자리다" 라고 명시적으로
    유예를 기록해 두었으므로, 이는 누락이 아니라 **의도된 지연**이다. 향후 그 설계 항목이 착수될 때
    참고할 수 있도록 남긴다.
  - 제안: 없음(추적 중). 네 번째 유사 사례가 더 생기면 공용 하네스 추출을 우선순위로 올릴 근거가 된다.

- **[INFO]** `remove()` 의 신규 재조회 가드는 파일 내 기존 관용구와 일관됨 (긍정 관찰)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (라인 1090-1094)
  - 상세: `const fresh = await m.findOne(...); if (!fresh) this.throwTriggerNotFound();` 패턴은 같은
    파일의 `update()`(라인 652 부근 `const fresh = ...`)와 `revokePerTriggerToken()` 계열의
    `if (!wroteInteraction) this.throwTriggerNotFound();`(라인 1230)와 이름·형태가 일치한다.
    새 코드가 기존 관용구를 새로 발명하지 않고 재사용해 일관성을 해치지 않는다.

## 요약

변경 범위가 작고(구현 14줄 + 단위 테스트 31줄 + 신규 e2e 파일 128줄 + plan 문서), 기존에 같은 결함
클래스(워크플로·워크스페이스 동시 DELETE)를 고친 두 선행 PR과 동일한 형태(락 안 재조회 → 없으면 404,
`.catch` 에서 `NotFoundException` 분리)를 그대로 재사용해 파일 내부·자매 모듈 간 일관성이 높다. `remove()`
함수 길이·중첩·분기 수 모두 과도하지 않고, 코멘트가 길지만 이 코드베이스 전반의 확립된 문서화 관례와
같은 밀도다. 유일하게 지적할 만한 점은 신규 e2e 테스트가 이미 export 되어 있는 `triggerConfigLockKey`
헬퍼를 재사용하지 않고 lock key 포맷 문자열을 별도로 복제한 것(WARNING)이며, 3번째로 반복되는 동시성
e2e 테스트 스캐폴드의 중복은 PR 자신이 명시적으로 유예를 선언해 두어 감점 요소로 보기 어렵다.

## 위험도

LOW
