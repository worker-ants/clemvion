# 요구사항(Requirement) 리뷰 — 트리거 동시 DELETE 감사 중복 수정

## 대상
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 에 락 안 재조회(`fresh`) + `NotFoundException` passthrough
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 위 분기를 검증하는 unit 테스트 2건 추가 + `workspaceId` 스코프 단언
- `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` — 신규 e2e
- `CHANGELOG.md`, `plan/in-progress/trigger-dup-delete.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md` — 문서·트래커 갱신
- `review/code/2026/09/20/22_07_23/**`, `review/code/2026/09/20/22_39_21/**`, `review/consistency/2026/09/20/21_43_47/**` — 앞선 두 리뷰 라운드(SUMMARY/RESOLUTION 포함)의 산출물 기록. 이번 라운드는 그 두 라운드의 조치가 실제로 반영됐는지도 함께 검증 대상.

## 발견사항

- **[INFO]** 핵심 수정은 spec §4.4 와 line-level 로 일치 — 결함 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1090-1101), 대응 spec `spec/2-navigation/2-trigger-list.md` §4.4("동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`")
  - 상세: 락(`acquireTriggerConfigLock`) 취득 직후 `m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } })` 로 재조회하고, 없으면 `throwTriggerNotFound()`(`{ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' }`, `never` 반환)를 호출해 `m.remove(trigger)` 이전에 반드시 return/throw 하도록 분기가 닫혀 있다. `.catch` 는 `NotFoundException` 을 먼저 걸러 재던지므로 "반쯤 삭제" 로그(거짓 경보)를 남기지 않는다 — 형제 `workflows.service.ts`(게이트 281-297 대응)와 동일한 패턴. e2e(`trigger-delete-concurrency.e2e-spec.ts`)가 `[204, 404]` + 감사 1건을 실측했고, unit 테스트가 workspaceId 스코프까지 값으로 단언한다. 재조회에서 `workspaceId` 를 인가 스코프로 유지해 authz 누수 가능성도 없다.
  - 제안: 조치 불필요.

- **[INFO]** 반환값·예외 경로 모두 완결 — 재조회 실패/성공/genuine 실패 세 갈래 전부 정의됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1090-1108)
  - 상세: (1) `fresh` 없음 → `NotFoundException` 던지고 트랜잭션 롤백, 비밀 정리·감사 모두 스킵(단위 테스트로 확인: `repo.remove`/`audit.record` 미호출, `deleteByPrefix:` 이벤트 없음, `logger.error` 미호출). (2) `fresh` 있음 → 정상 삭제 후 비밀 정리·감사 기록. (3) `m.remove` 자체가 genuine 하게 실패(예: lock timeout) → `NotFoundException` 이 아니므로 `logger.error` 로 "반쯤 삭제된 상태" 를 남기고 재던짐(신규 unit 테스트로 로그 내용까지 검증). 세 경로 모두 명시적으로 처리되며 falls-through 로 조용히 통과하는 틈이 없다.
  - 제안: 조치 불필요.

- **[INFO]** 스코프 밖 잔여 결함(`SchedulesService.remove()`)이 정확히 코드 위치까지 특정돼 트래커에 등재됨 — 이번 diff 의 결함 아님
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:345` (`await this.scheduleRepository.remove(schedule);` — 락·재조회 밖, 트랜잭션 커밋 뒤)
  - 상세: `plan/in-progress/trigger-dup-delete.md` 와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 양쪽이 이 잔여를 `schedules.service.ts:345` 로 정확히 짚어 신규 developer 항목으로 등재했다. 직접 소스를 열어 확인한 결과 인용이 정확하다 — 이 경로는 실제로 advisory lock 도 재조회 가드도 거치지 않는다. 이번 PR 이 닫는 범위(트리거·워크플로·워크스페이스 세 자리)와 스케줄 자신의 행 삭제(네 번째 자리)를 명확히 구분해, 이전 PR 제목의 "네 자리 완결" 과장을 정정한 것도 확인됨(`plan/in-progress/trigger-dup-delete.md` 게이트 20-28의 blockquote).
  - 제안: 조치 불필요 — 후속 planned item 으로 이미 적절히 이관됨.

- **[INFO]** `plan/in-progress/trigger-dup-delete.md` 체크리스트 3항목("`/ai-review` → 수렴", "`--impl-done` → BLOCK: NO", "트래커 항목 해소 + `plan/complete/`") 미완료
  - 위치: `plan/in-progress/trigger-dup-delete.md` (게이트 110-112, `## 체크리스트`)
  - 상세: 현재 라운드(`review/code/2026/09/20/23_04_17`)가 그 첫 항목을 수행 중인 과정 자체이므로 미완료가 자연스럽다. 결함이 아니라 워크플로 진행 상태 기록.
  - 제안: 이번 라운드가 Critical/Warning 0 으로 수렴하면 체크박스 갱신 + `plan/complete/` 이동을 마무리 커밋에서 진행할 것(회귀 방지용 메모).

- **[INFO]** 저장소 트리 일시적 이상 상태 관측(뮤테이션 아님, 자연 해소)
  - 위치: 없음(파일 경로 아님, 프로세스 관측)
  - 상세: 리뷰 도중 `git status --short` 가 한 차례 `M codebase/backend/src/modules/triggers/triggers.service.ts` 를 보였으나, 곧이은 `git diff`/`git diff HEAD` 는 빈 결과였고 재확인한 `git status --short` 에서도 사라졌다. 병렬 fan-out 중 다른 reviewer 가 뮤테이션 검증을 위해 `cp` 로 잠깐 바꿨다가 즉시 원복한 것으로 보인다(본 리뷰는 저장소에 아무것도 쓰지 않았고 이 파일을 읽기만 했다). 규약에 따라 관측 사실만 보고한다 — 현재 시점 `git status --short` 는 `review/code/2026/09/20/23_04_17/` untracked 항목만 남아 있어 잔여물은 없다.
  - 제안: 조치 불필요(자연 해소 확인됨). 다음 reviewer 가 같은 순간을 본다면 동일하게 해석할 것.

WARNING/CRITICAL 없음.

## 요약

`TriggersService.remove()` 의 동시 DELETE 감사 중복 결함은 요구사항(spec `2-trigger-list.md` §4.4 "두 번째 요청은 404")과 line-level 로 정확히 일치하게 고쳐졌다 — advisory lock 취득 직후 `workspaceId` 로 스코프된 재조회를 넣고, 없으면 `NotFoundException(RESOURCE_NOT_FOUND)` 로 롤백하며, genuine 실패와 동시-삭제-404 를 갈라 거짓 경보를 없앴다. 세 갈래(재조회 실패/성공/genuine 실패) 모두 unit 테스트로 커버되고 뮤테이션 판별력(고유 앵커 180자 뮤턴트, workspaceId 스코프 제거 뮤턴트)까지 실측으로 확인됐으며, e2e 가 `[204, 404]` + 감사 1건을 실제 DB 조회로 고정한다. 앞선 두 리뷰 라운드(`22_07_23`, `22_39_21`)에서 지적된 Warning 7건(테스트 판별력·lock key 리터럴·logger.error 미검증·workspaceId 스코프·문서 caveat 등)은 모두 커밋으로 반영됐고, 이번 라운드에서 재확인한 결과 회귀 없이 유지되고 있다. 스코프 밖으로 명시한 `SchedulesService.remove()` 잔여(스케줄 자신의 행 삭제, `schedules.service.ts:345`)와 provider teardown 중복 호출은 코드 인용이 정확하며 트래커에 적절히 이관돼 있어 이번 diff 의 결함으로 볼 수 없다. spec 자체의 결함이나 SPEC-DRIFT 는 발견되지 않았다(`spec_impact: none` 이 타당 — spec 은 이미 이 동작을 정의하고 있었고 코드가 그걸 뒤늦게 충족시켰을 뿐).

## 위험도

NONE
