# 동시성(Concurrency) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정 (3차 라운드)

이번 라운드(`13_53_04`)의 diff 는 이전 두 라운드(`12_57_05`, `13_28_12`)에서 이미 리뷰된 핵심 동시성 로직
(`removeMember()` 의 원자적 `DELETE` + `affected === 0` 명시 판정)을 **다시 변경하지 않는다**. 실제로 바뀐
것은 (a) 커밋 `6f1113a70` 의 e2e 주석·plan 문서 정정("형제 다섯은 전부 204" → "컨트롤러별로 갈린다", 사실
정정일 뿐 로직 무변경)과 (b) 직전 두 라운드의 리뷰 산출물(`review/code/2026/09/21/12_57_05/**`,
`review/code/2026/09/21/13_28_12/**`)이 이번 브랜치 diff 에 파일로 편입된 것뿐이다. `git show 6f1113a70 --
codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 로 직접 대조한 결과 변경분은 JSDoc 주석
8줄뿐이며 테스트 로직·단언·타임아웃·락 시퀀스는 손대지 않았다. 실제 소스(`workspaces.service.ts:795-841`)를
`Read`/`grep -n` 으로 직접 열어 이전 라운드가 서술한 내용과 현재 파일 상태가 정확히 일치함을 확인했다.

## 발견사항

- **[WARNING]** `removeMember()` 의 owner 보호 가드가 여전히 TOCTOU 로 뚫린다 (이번 PR 수정 범위 밖, 3차 재확인 — 신규 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:809` (`if (member.role === 'owner')`, 무락 판정) ~ `:834` (`this.memberRepository.delete(...)`) 사이의 창. 자기-인지 주석은 `:817-833`.
  - 상세: `:800` 의 무락 `findOne` 스냅샷을 owner 판정(`:809`)과 `assertAdmin`(`:815`)이 그대로 쓴다. 이 판정과 `:834`의 원자적 `DELETE` 사이에 동시 `transferOwnership()`이 같은 멤버를 owner로 승격시키면, `removeMember()`는 이미 "owner 아님"을 확인한 뒤라 가드를 재검사하지 않고 `DELETE`를 실행해 owner 행이 지워진다. 판별자 `affected === 0`(`:838`)은 "행이 사라졌는가"만 구분할 뿐 "owner로 바뀌었는가"는 구분하지 못하므로 이 창에서는 owner 삭제가 그대로 200으로 성공한다. `plan/in-progress/member-dup-remove.md` §C-2와 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 재진입 기법(locker가 행 락을 쥔 채 `role='owner'`로 UPDATE 후 COMMIT)으로 **실측 재현**(`status=200, rows_remaining=0`)됐고 후보 처방(`delete({..., role: Not('owner')})` + 0행 시 1회 재조회로 원인 분기)까지 문서화돼 있다. 이번 라운드도 이 구간을 건드리지 않았으므로 그대로 남아 있다.
  - 제안: 이번 PR을 막을 사유는 아니다(판별자 오염 방지 논리가 타당하고 트래커에 이미 등재됨). 3라운드 연속 재확인됐으므로, 다음 PR에서 실제로 닫힐 때까지 이 항목이 방치되지 않게 우선순위를 유지할 것.

- **[INFO]** 이번 라운드에서 바뀐 것은 주석/문서뿐이며 실행 경로에는 영향이 없다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 상단 JSDoc (커밋 `6f1113a70`, `git show` 로 확인한 8줄 diff — 코드 라인 없음)
  - 상세: "형제 다섯은 전부 204, 이 라우트만 200"이라는 이전 주석이 실측과 달랐던 것("성공 코드는 라우트별이 아니라 컨트롤러별로 갈린다")을 취소선 없이(원문 보존 방식으로) 정정한 것으로, 테스트의 락 시퀀스(`SELECT ... FOR UPDATE` → `Promise.race` 공허성 가드 → `COMMIT`/`ROLLBACK`)나 단언 로직은 바이트 단위로 동일하다. 동시성 관점에서 재검토할 새 표면이 없다.
  - 제안: 없음(정상).

- **[INFO]** 핵심 원자적 DELETE 판정과 자가 탈퇴 위임 경로는 2차 라운드 대비 무변경, 재대조로 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:800-841` (`removeMember()` 전체), `:804-807` (self-check → `leaveWorkspace()` 위임)
  - 상세: `DELETE ... WHERE id = $1 AND workspace_id = $2` 단일 문장이 동시 두 건 중 하나만 지우고, `affected === 0` **명시 비교**(`!affected` 아님)로 `null`/`undefined`(드라이버 미보고)를 정상 삭제로 오판하지 않는다. 자가 탈퇴 경로는 `leaveWorkspace()`(`pessimistic_write` 트랜잭션, 별도 재조회)로 위임되어 스냅샷이 stale해도 최종 판단은 항상 최신 상태를 본다. 두 성질 모두 `Read`로 직접 재확인했고 1·2차 라운드 서술과 일치한다.
  - 제안: 없음(정상).

## 검증용 뮤테이션

이번 리뷰는 저장소 파일을 고쳐보지 않았다 — `Read`/`grep -n`/`git show`로 정적 대조만 수행했다. `git status --short` 확인 결과 이 세션이 저장소에 남긴 변경은 `review/code/2026/09/21/13_53_04/`(이 리뷰 세션 자체의 출력 디렉터리, orchestrator가 사전 생성) 외에 없다.

## 요약

3차 라운드 diff는 핵심 동시성 수정(무락 `findOne`→`remove(entity)`를 원자적 `delete({id, workspaceId})`+`affected===0` 명시 판정으로 교체)을 그대로 유지한 채, e2e 주석의 사실 정정(성공 코드가 라우트별이 아니라 컨트롤러별로 갈린다)과 직전 두 라운드의 리뷰 산출물 파일만 추가한다 — 실행 경로·락 전략·판별자 로직에 변화가 없음을 소스 직접 대조로 확인했다. 유일하게 남는 실질 동시성 결함은 owner 보호 가드가 무락 스냅샷 위에 있어 동시 `transferOwnership()`과 겹치면 owner가 삭제될 수 있는 TOCTOU인데, 이는 이번 diff가 새로 만든 것이 아니고 3라운드 연속 재확인된, 이미 실측 재현·문서화·트래커 등재·의도적 유예가 완료된 사안이다. 병합을 막을 신규 동시성 결함은 없다.

## 위험도

LOW
