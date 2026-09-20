# 테스트(Testing) 리뷰 — trigger 동시 DELETE 중복 감사 수정

## 발견사항

- **[WARNING]** genuine(비-404) 삭제 실패 시 `logger.error` 가 실제로 불리는지 검증하는 테스트가 없다 — 실측: 로그 삭제 뮤턴트가 관련 테스트 11/11 을 GREEN 으로 통과
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` 의 `.catch((err) => { if (err instanceof NotFoundException) throw err; this.logger.error(...); throw err; })` 블록 / `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4030`(신규 테스트) 및 `:4105`, `:4247`(기존 인접 테스트)
  - 상세: 이번 diff 는 `.catch` 안에 `if (err instanceof NotFoundException) throw err;` 가드를 추가했다. 신규 유닛 테스트(`triggers.service.spec.ts:4030`)는 이 가드가 **404 케이스에서 로그를 억제하는지**(`expect(error).not.toHaveBeenCalled()`)만 검증한다. 그런데 이 가드가 지키려는 반대쪽 성질 — *genuine 실패(예: lock timeout)에서는 `logger.error` 가 실제로 호출돼 "반쯤 삭제된 상태 — 수동 정리 필요"를 남긴다 — 를 검증하는 테스트가 파일 전체에 하나도 없다. 인접한 두 테스트(`:4105` "remove() — 행 삭제가 실패하면 비밀은 지우지 않는다", `:4247` "remove() 실패는 삼키지 않고 던진다")는 `removeRejects: true` 로 genuine 에러를 만들지만 `Logger.prototype.error` 를 스파이하지 않고 `rejects.toThrow`/`audit.record` 만 단언한다.
    - **뮤테이션으로 직접 확인**: `this.logger.error(...)` 호출문만 삭제하고(가드·두 `throw` 는 그대로 유지) `jest -t "remove"` 를 돌리면 관련 11개 테스트가 **전부 GREEN** 으로 남는다(원본 코드에서는 이 두 테스트 실행 시 콘솔에 실제로 ERROR 로그가 찍히는 것도 확인했다 — 즉 로그는 실행되지만 아무도 단언하지 않는다). 원본으로 `cp` 복원 후 `git status --short` 로 저장소가 깨끗함을 재확인했다.
    - **같은 PR 계열의 자매 구현(`workflows.service.ts`/`workflows.service.spec.ts`, 커밋 `4a9828afe`)은 이 정확한 대칭 테스트를 이미 갖고 있다** — `workflows.service.spec.ts:1062` `'remove — 행 삭제가 실패하면 외부 해제가 이미 끝났다는 사실을 남기고 던진다'` 는 `Logger.prototype.error` 를 스파이해 `logged.toContain('wf-uuid-9')` / `toContain('이미 끝났으므로')` 를 단언한다. `triggers.service.spec.ts` 는 이 짝이 빠져 있어, 같은 PR 계열 안에서 커버리지가 비대칭이다.
  - 제안: `removeRejects: true` 를 쓰는 기존 실패 테스트(또는 신규 테스트)에 `jest.spyOn(Logger.prototype, 'error').mockImplementation(...)` 를 추가해, genuine 실패 시 `error` 가 **호출되고** 메시지에 `trigger=<id>` 및 "반쯤 삭제된 상태"류 문구가 포함됨을 단언한다. `workflows.service.spec.ts:1062` 를 그대로 패턴으로 복제하면 된다.

## 요약

이번 diff 는 트리거 동시 DELETE 중복 감사 결함을 "락 안 재조회 → 없으면 404" + ".catch 에서 NotFoundException 분리" 두 가지로 고쳤고, 신규 유닛 테스트(`triggers.service.spec.ts:4030`)와 신규 e2e 테스트(`trigger-delete-concurrency.e2e-spec.ts`)가 이를 잘 뒷받침한다. e2e 테스트는 advisory lock 을 직접 쥐어 경합을 결정적으로 재현하고 공허성 가드(락을 놓기 전 `pending` 이 아직 미해결임을 확인)까지 갖춰 자매 파일들(`workflow-/workspace-delete-concurrency.e2e-spec.ts`)과 형태가 일치한다. 신규 유닛 테스트는 `repo.remove`/`audit.record` 미호출, `deleteByPrefix` 미호출, `logger.error` 미호출(거짓 경보 억제)까지 정밀하게 짚어 mock 격리·가독성 모두 양호하다. 다만 실측(뮤테이션)으로 확인한 유일한 갭은, 이 가드가 지키려는 반대쪽 성질 — genuine 실패 시 진단 로그가 실제로 남는다는 것 — 을 검증하는 테스트가 없다는 점이다. 자매 모듈(`workflows.service.spec.ts`)에는 이미 그 대칭 테스트가 있으므로, 같은 패턴을 트리거 쪽에도 추가하면 커버리지가 완결된다. 그 외 mock 위임 구조(`withTransactionMock`), 테스트 격리(try/finally + mockRestore), 회귀 테스트 유효성은 모두 이상 없음을 확인했다.

## 위험도

LOW
