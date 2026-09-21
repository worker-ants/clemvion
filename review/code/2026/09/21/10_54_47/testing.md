# 테스트(Testing) 리뷰 — integration-dup-delete

## 발견사항

- **[WARNING]** 사용처 존재(Conflict) 경로의 회귀 단언이 `remove()`→`delete()` 전환 이후 **vacuous** 해졌다 — 뮤테이션으로 실측 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1175` (`it('throws ConflictException when usages exist' …)`), `:1197` (`it('blocks deletion when only an MCP reference exists' …)`)
  - 상세: 두 테스트는 `expect(integrationRepo.remove).not.toHaveBeenCalled();` 로 "사용 중이면 삭제 호출을 하지 않는다"를 검증하려 한다. 그런데 이번 diff(`integrations.service.ts:800`)가 삭제 경로를 `this.integrationRepository.remove(entity)` 에서 `this.integrationRepository.delete({ id, workspaceId })` 로 완전히 대체했다 — `grep`으로 확인한 결과 구현 어디에도 `integrationRepository.remove()` 호출이 더 이상 없다. 즉 `remove` mock 은 **어떤 경로로도 절대 호출되지 않으므로** 이 단언은 사용처 검사 로직의 정상/비정상 여부와 무관하게 항상 통과한다.
    실측(뮤테이션 검증, 원복 완료): conflict 분기에 `await this.integrationRepository.delete({ id, workspaceId });` 를 `ConflictException` 던지기 **직전**에 삽입해 "사용 중인데도 실제로 지워버리는" 회귀를 시뮬레이션한 뒤 같은 스위트를 돌렸다 —
    ```
    Tests: 141 skipped, 3 passed, 144 total   ← "usages exist"/"MCP reference" 테스트 모두 GREEN
    ```
    사용 중인 통합을 실제로 지우는 심각한 회귀도 이 두 테스트는 잡아내지 못한다. (mutation 은 `cp` 백업 후 원복, `git status --short` 로 클린 확인.)
  - 제안: 두 곳 모두 `expect(integrationRepo.remove).not.toHaveBeenCalled();` 를 `expect(integrationRepo.delete).not.toHaveBeenCalled();` 로 교체한다(현재 삭제 경로의 실제 진입점을 검사하도록). 필요하면 죽은 `remove` mock 자체도 다른 곳에서 더는 안 쓰인다면 정리 대상으로 남긴다.

- **[INFO]** 대조군 테스트에서 `integrationCacheBus.publish` 를 clear 만 하고 단언하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1097-1108` (`it('affected 를 보고하지 않는 드라이버에서는 404 로 뒤집지 않는다' …)`)
  - 상세: 루프 안에서 `integrationCacheBus.publish.mockClear();` 를 매 반복 호출하지만, 이후 `expect(integrationCacheBus.publish)…` 형태의 단언이 없다. `auditLogsService.record` 만 `toHaveBeenCalled()` 로 확인한다. 이 테스트의 의도(“정상 삭제로 취급해 감사·broadcast 모두 정상 진행돼야 한다”)를 완전히 검증하려면 broadcast 쪽도 함께 확인해야 하는데, clear 만 있고 assert 가 빠져 있어 "확인했지만 결과를 보지 않은" 인상을 준다.
  - 제안: 루프 본문 끝에 `expect(integrationCacheBus.publish).toHaveBeenCalled();` 를 추가하거나, broadcast 를 검증할 의도가 없다면 `mockClear()` 호출 자체를 제거해 테스트 의도를 명확히 한다.

## 그 외 확인한 사항 (문제 없음)

- **테스트 존재/커버리지**: 핵심 변경(`remove()` 를 원자적 `delete()`+`affected===0` 판정으로 교체)에 대해 unit 2건(진 쪽 404, `null`/`undefined` 대조군)과 e2e 1건(`SELECT … FOR UPDATE` 로 실제 겹침을 만들어 `[204,404]` + 감사 1건 확인)이 신규로 추가돼 있다. 형제 PR(#1369~#1371)과 같은 패턴을 그대로 따르고 있어 구조적 일관성도 좋다.
- **엣지 케이스**: `affected: 0` vs `affected: undefined/null` 을 분리해 "0을 명시 비교로 판정해야 한다"는 설계 근거(주석 `integrations.service.ts:797-799`)를 직접 뮤테이션(`=== 0` → `!affected`)으로 반증 가능한 대조군으로 잡아 두었다 — 형제 PR(#1371)에서 이 대조군이 없어 같은 형태 뮤턴트가 32건을 통과했다는 이력이 plan(`plan/in-progress/integration-dup-delete.md:52-56`)에 기록돼 있고, 이번엔 처음부터 반영됐다.
- **Mock 적절성**: `delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] })` (`integrations.service.spec.ts:134`) 는 TypeORM `DeleteResult` 형태(`{ raw, affected? }`)를 그대로 반영해 실제 드라이버 동작과 괴리가 없다.
- **테스트 격리**: `beforeEach` 가 매번 `integrationRepo` 등 모든 mock 을 새로 생성하므로(`:119-138`) `mockResolvedValueOnce` 큐가 테스트 간에 남아 누수될 걱정이 없다. e2e 도 `beforeAll`/`afterAll` 에서 커넥션을 명시적으로 열고 닫으며, `finally` 블록에서 `ROLLBACK` + `pending` catch 로 실패 시에도 잠금을 남기지 않는다(형제 e2e `schedule-delete-concurrency.e2e-spec.ts` 와 동일 패턴).
- **공허성 가드**: e2e 테스트가 `Promise.race` 로 "락을 놓기 전엔 두 요청이 아직 끝나지 않았음"을 먼저 확인한 뒤에야 겹침을 전제로 한 본단언으로 넘어간다 — fixture 가 겹침을 실제로 만들었는지를 테스트 스스로 검증하는 좋은 패턴이다.
- **회귀 테스트(그 외)**: `deletes when no usages exist` (`:1060-1071`) 는 `remove` → `delete` 단언으로 정확히 갱신됐고, `broadcasts cache invalidation …`(`:1110`)·`throws NotFoundException when the integration is absent`(`:1115`)·`reads the integration row only once`(`:1125`) 는 이번 diff 로 동작이 바뀌지 않는 경로라 그대로 유효하다.
- **테스트 용이성**: `IntegrationsService` 는 리포지토리가 생성자 DI 로 주입돼 있어 `delete` 교체 자체는 mock 갱신만으로 대응 가능했다 — 구조적으로 테스트하기 쉬운 형태를 유지했다.

## 요약

핵심 결함(동시 DELETE 두 건의 감사 중복)에 대한 재현(e2e)·회귀 방지(unit, `affected===0` 대조군 포함)는 견고하게 갖춰졌고 형제 PR들의 교훈(대조군 누락으로 뮤턴트 32건 생존)을 이번엔 선제 반영했다. 다만 `remove()`→`delete()` 전환으로 인해 기존 conflict-path 테스트 2건(`usages exist`, `MCP reference`)의 "삭제 호출 안 함" 단언이 죽은 mock(`remove`)을 겨냥하고 있어 **뮤테이션 실측으로 vacuous 함을 확인**했다 — 사용 중인 통합을 실제로 지워버리는 심각한 회귀도 이 두 테스트는 통과시킨다. 이번 diff 자체가 심은 결함은 아니지만(사이드이펙트로 발생한 stale 회귀 테스트), 이번 PR 범위 안에서 한 줄 교체로 바로잡을 수 있는 갭이다.

## 위험도

MEDIUM
