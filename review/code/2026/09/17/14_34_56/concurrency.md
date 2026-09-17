# 동시성(Concurrency) 리뷰 — `trigger-cascade-window-probe` (3라운드)

## 범위 요약

핵심 변경은 이전 두 라운드(`review/code/2026/09/17/13_44_39`, `review/code/2026/09/17/14_11_48`)와
동일하다 — `codebase/backend/src/modules/triggers/triggers.service.ts` `TriggersService.update()`
(창 1)가 advisory lock(`acquireTriggerConfigLock`) 안에서 재읽은 `Trigger` 엔티티를 **통째로**
`save` 하던 것을, **이 요청이 바꾸는 필드(`defined`) + `config`(병합 결과)만 담은 부분 객체**로
좁힌 lost-update 수정이다.

`git diff 6d845d8a2..d60cc65aa -- codebase/backend CHANGELOG.md` 로 직접 대조한 결과, **이번
라운드(2라운드 처분 커밋 `d60cc65aa`)는 `codebase/` 안에서 순수 주석/JSDoc 정정뿐**이고 실행
경로 코드는 한 글자도 바뀌지 않았다 — `triggers.service.ts` 는 diff 에 아예 등장하지 않고,
`trigger-transaction-mock.ts`/`CHANGELOG.md` 변경도 문구·실측 표기(뮤턴트 재현 수치 지우기,
`workspace` CASCADE 를 "실측" 에서 "추정" 으로 낮추기) 뿐이다. 나머지 파일(review round
1·2 산출물, consistency 산출물)은 문서/리포트이며 동시성 코드 재검토 대상이 아니다.

## 검증한 것

- `codebase/backend/src/modules/triggers/triggers.service.ts`의 `update()` 트랜잭션 블록
  전체(약 632~715행 부근)를 다시 읽고, 락 획득 → `findOne` 재읽기 → `assertTriggerFound` →
  `const patch = { ...defined, config: mergedConfig }` → `m.save(Trigger, { id: target.id,
  ...patch })` → `Object.assign(target, patch)` → `if (written.updatedAt)` 응답 보정까지
  흐름을 대조했다. 저장(`m.save`)과 응답 조립(`Object.assign`)이 **같은 `patch` 객체**를
  재사용해, 앞선 라운드가 지적했던 "필드 목록 이중 작성" 드리프트가 실제로 해소돼 있음을
  확인했다.
- `acquireTriggerConfigLock` 호출부를 grep 해 `update()`(634행)와 `remove()`(1075행)가 **같은
  락 키**(`triggerConfigLockKey(triggerId)` = `trigger-config:<id>`)를 공유함을 재확인했다 —
  두 창의 직렬화가 이번 라운드에서도 유지된다.
- `trigger-config-lock.ts`의 `acquireTriggerConfigLock`/`rewriteTriggerConfigLocked` JSDoc을
  다시 읽어, "임계 구간에 외부 호출 없음 → 대기 상한 없음이 감당 가능"이라는 근거와 "이 함수는
  새 공유 블로킹 자원"이라는 자기 인정이 이번 diff로 바뀌지 않았음을 확인했다.
- `codebase/backend/test/trigger-update-save-window.e2e-spec.ts`(237줄) 전체를 읽었다. 별도
  `pg.Client`(자동커밋)로 트랜잭션 A 재읽기 **뒤**에 컬럼을 커밋시키고 그 뒤 A가 저장하도록
  코드를 순차 `await`로 배선해, 실제 스레드 경합 없이도 Postgres READ COMMITTED 하에서
  "재읽기 이후 커밋 관측" 창을 결정적으로 재현한다 — 타이밍 의존 플레이키 요소가 없다.
  `afterAll`에서 `ds.destroy().catch(...)` → `db.end().catch(...)` 순으로 두 핸들을 모두
  정리한다.

## 발견사항

이번 라운드에서 새로 발견한 동시성 결함은 없다. 이전 두 라운드가 이미 지적하고 비차단으로
처분한 INFO 2건은 이번 diff(주석/문서 정정)로 코드 동작이 바뀌지 않아 그대로 유효하다 —
재등재만 하고 새 항목으로 세지 않는다.

### INFO — `updatedAt` 폴백이 무신호로 스테일해질 수 있는 경로 (1·2라운드 재확인, 변경 없음)
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `TriggersService.update()`
  트랜잭션 콜백 마지막의 `if (written.updatedAt) target.updatedAt = written.updatedAt;`
- 상세: `written.updatedAt`이 falsy면 응답은 재읽기(`fresh`) 시점의 `updatedAt`을 그대로 낸다.
  실제 Postgres 경로는 `@UpdateDateColumn`이 항상 채우므로(e2e ②c로 실측) 발생 확률은 낮지만,
  이 분기가 참이 되는 경로를 직접 단언하는 회귀는 여전히 없다.
- 제안: 차단 사유 아님 — 1·2라운드가 이미 비차단으로 처분.

### INFO — FK CASCADE 창은 advisory lock 범위 밖에 여전히 남아 있다 (1·2라운드 재확인, 변경 없음)
- 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` `describe('① 재읽기 뒤
  workflow 삭제 (FK CASCADE — advisory lock 으로 못 막는 경로)', ...)`
- 상세: `acquireTriggerConfigLock`은 trigger id로만 잠그므로 부모 `workflow`/`workspace` 삭제
  (DB 레벨 CASCADE)는 이 락으로 직렬화되지 않는다. "시끄러운 실패 + 롤백"(23502/23503)으로
  끝나고 부활이 없음이 e2e로 고정돼 있어 데이터 손상은 없다 — 설계상 수용된 gap이고 이번 PR이
  새로 만든 것이 아니다. plan `## 이 PR 이 안 하는 것`에 명시적으로 남아 있다.
- 제안: 조치 불요. 이 창이 "조용한 lost update"로 바뀌는 방향의 변경(예: 저장 실패를 삼키는
  캐치 추가)이 향후 들어오면 즉시 재검토가 필요하다는 캐너리 역할은 이 e2e가 계속 수행한다.

## 검증하지 않은 것

- `chat-channel-binder.service.ts`(binder/`rotateBotToken`)가 `config` JSONB 밖 컬럼에 쓸 때
  같은 `acquireTriggerConfigLock`을 거치는지는 diff 밖 파일이라 이번 라운드에서도 직접
  추적하지 않았다 — 1·2라운드에서 이미 검증된 전제로 취급했고, 이번 diff가 그 잠금 경로 자체를
  바꾸지 않았다.
- 저장소를 뮤테이션하는 검증(코드를 실제로 고쳐 재현)은 이번 라운드에서 수행하지 않았다 —
  실행 경로 코드 자체가 이번 diff에 없고(주석만 변경), 1·2라운드가 이미 동일 로직을 뮤턴트
  (M1~M4, mock 배선)와 e2e로 실측했다. 저장소 상태는 건드리지 않았다(`git status --short`로
  확인할 변경 없음 — 아무 파일도 쓰지 않았다).

## 요약

이번 라운드(3라운드)는 2라운드 처분 커밋(`d60cc65aa`)이 `codebase/` 안에서 순수 주석/JSDoc
정정만 담고 있어, 창 1의 부분 객체 `save` 로직·advisory lock 범위·락 키·응답 조립 흐름 등
실행 경로는 1·2라운드가 검증한 상태에서 전혀 바뀌지 않았다. 직접 코드를 재대조한 결과도
동일하다 — `update()`와 `remove()`가 같은 락 키를 공유하는 직렬화, 부분 객체 저장이 락 밖에서
커밋된 컬럼을 보존하는 메커니즘, FK CASCADE 창의 loud-failure 설계 모두 그대로 유지된다.
이번 라운드에서 새로 발견한 동시성 결함은 없으며, 남은 INFO 2건은 이미 두 차례 비차단으로
처분된 항목의 재확인이다.

## 위험도
LOW — 핵심 동시성 로직은 두 차례 실측·뮤테이션 테스트로 뒷받침됐고, 이번 라운드 diff는 그
로직을 바꾸지 않는 주석 정정뿐이라 새로 발견한 결함이 없다.
