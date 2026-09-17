# 동시성(Concurrency) 리뷰

## 대상 요약

이번 PR 의 핵심 프로덕션 변경은 두 곳이다.

1. `codebase/backend/src/modules/triggers/trigger-config-lock.ts`
   - `rewriteTriggerConfigLocked` 이 `m.update(...)` 의 `UpdateResult.affected` 를 확인해,
     `0` 이면 `false` 를 반환하도록 수정 (기존에는 항상 `true` 반환).
   - `acquireTriggerConfigLock` 의 `SET LOCAL lock_timeout` 보간 값을 `toLockTimeoutMs()` 로
     좁혀 `NaN`/`Infinity`/음수/과대값이 SQL 문자열에 그대로 실리지 않도록 방어.
2. `codebase/backend/src/modules/triggers/triggers.service.ts`
   - `findByIdForUpdate` → `findByIdForPatchValidation` 개명 (락을 잡지 않는 메서드가
     `FOR UPDATE` 관용구를 이름에 담고 있던 오신뢰 자리 제거).

나머지는 테스트/문서/plan 변경이다.

## 발견사항

- **[INFO]** `affected` 판정 이전에 발생하는 비-트랜잭션 부작용(secret store 쓰기)은 여전히
  race window 안에 남는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken()`
    함수 내, "5. issuedInboundSigning plaintext → secret store" 단계(`this.secrets.rotate(...)`
    호출부, `if (!wrote) this.throwTriggerNotFound();` 판정보다 **앞선 코드**). 정확한 게이트
    번호가 필요하면 `Read`/`Grep` 으로 `rotateBotToken` 본문에서 `secrets.rotate` 호출과
    `if (!wrote)` 호출의 상대 위치를 대조.
  - 상세: `rewriteTriggerConfigLocked` 의 `affected===0` 수정으로 **HTTP 응답**은 이제
    올바르게 404 를 던진다. 그러나 `rotateBotToken` 의 흐름은 (1) 새 봇 토큰으로
    `adapter.setupChannel` 재호출 → (2) `issuedInboundSigning` 을 secret store 에
    저장(`this.secrets.rotate`) → (3) `rewriteTriggerConfigLocked` 로 DB 컬럼 갱신 → (4)
    `affected===0` 이면 404. 즉 (2)의 secret store 쓰기가 (4)의 판정보다 **먼저** 실행되므로,
    이 PR 이 다루는 바로 그 레이스(재읽기~UPDATE 사이 FK CASCADE 삭제)가 발생하면 여전히
    "트리거 행은 삭제됐는데 secret store 에는 새 토큰만 남는" 상태가 만들어진다 — CHANGELOG
    자체가 *"secret store 에는 새 토큰만 남는다"* 로 서술하는 잔여 증상과 동일한 모양이다.
    이번 수정은 **응답 계약**(성공 위장 방지)은 닫았지만, **트랜잭션 경계를 넘는 보상 동작의
    원자성**(secret store 쓰기 vs DB 행 존재)까지는 닫지 못했다. 이 자체는 이 diff 가 새로
    만든 결함이 아니라 손대지 않은 기존 순서(secret 쓰기가 항상 컬럼 갱신보다 먼저)에서
    비롯된 잔여 창이며, PR 의 명시적 스코프(다섯 항목)에도 포함되어 있지 않다.
  - 제안: 새 결함으로 등재하기보다, 이번 트래커(`plan/in-progress/trigger-lock-followups.md`)
    또는 후속 planner 항목에 "삭제 경합 시 secret store 고아 항목 정리/보상" 트랙으로 명시해
    스코프를 벗어난 잔여로 남겨 둘 것. (silent 하게 넘기면 다음 사람이 "이미 닫혔다" 로 오해할
    수 있다.)

- **[INFO]** `affected` 가 `null`/`undefined` 인 경우 항상 성공(`true`)으로 처리한다 — 드라이버
  의존적 맹점.
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 의
    `rewriteTriggerConfigLocked` 본문, `if (result.affected === 0) return false;` 줄.
  - 상세: 의도된 설계이고(JSDoc 에 "«모른다»를 «없다»로 읽으면 정상 쓰기를 실패로 뒤집는다"로
    명시, 대응 테스트도 `trigger-config-lock.spec.ts` 에 존재) 현재 TypeORM Postgres 드라이버는
    `affected` 를 신뢰성 있게 보고하므로 실무 영향은 없다. 다만 드라이버·쿼리 형태가 바뀌어
    `affected` 가 항상 `undefined` 로 오는 회귀가 생기면 이 판정 자체가 무력화되어 세 번째
    삭제 경로(FK CASCADE) 레이스가 다시 조용히 열린다는 점은 기록해 둘 가치가 있다 (silent
    fail-open 방향의 fail-safe 선택).
  - 제안: 조치 불요. 다만 "드라이버가 affected 를 보고하지 않는 환경으로 전환" 시 재검토
    대상으로 인지.

- **[INFO]** `acquireTriggerConfigLock` 의 `lock_timeout` 은 advisory lock 하나가 아니라 그
  트랜잭션의 **모든** 락 대기(뒤따르는 `DELETE`/CASCADE 포함)에 적용된다는 점이 JSDoc 에
  명시되어 있음 — 새로 발견한 문제는 아니고 기존 설계 결정(선행 리뷰 WARNING#6 수용)이
  이번 diff 에서 그대로 유지·정리됨을 확인. 조치 불요.

## 검증 메모

- `trigger-config-lock.ts`, `triggers.service.ts`, `schedules.service.ts`, `trigger.entity.ts`
  를 직접 열어 (a) `rewriteTriggerConfigLocked` 의 새 `affected===0` 분기, (b) 그 반환값을
  소비하는 4개 호출부(`update()`/`rotateBotToken`/`revokePerTriggerToken`/
  `promoteRotatedNotificationSecrets`)가 모두 `if (!wrote)`/`if (result.affected...)` 형태로
  일관되게 처리하는지, (c) `SchedulesService.remove()` 의 cascade 삭제 경로가 동일 advisory
  lock 을 잡는지, (d) `Workflow`/`Workspace` FK 가 실제로 `onDelete: 'CASCADE'` 인지 대조했다.
  네 항목 모두 diff/문서 서술과 일치했다.
- `toLockTimeoutMs()` 의 `Number.isFinite` 가드와 clamp 범위(`1`~`60000`)를 확인 — 예외 발생
  지점이 advisory lock 획득 **이전**(트랜잭션 내 부작용 없음)이라 롤백 시 자원 누수·부분 커밋
  위험이 없음을 확인.
- 락 순서(단일 advisory lock, 트리거별로만 직렬화)에 다중 락 획득 패턴이 없어 데드락 가능성은
  이 diff 범위 내에서 확인되지 않음.
- 저장소 파일은 뮤테이션하지 않았다 — 정적 대조만 수행, `git status --short` 로 무변경 확인.

## 요약

이 PR 의 핵심 동시성 변경(`rewriteTriggerConfigLocked` 의 `affected===0` 판정)은 advisory
lock 이 원리적으로 막을 수 없는 세 번째 삭제 경로(FK `onDelete: 'CASCADE'`)에서 재읽기~UPDATE
사이의 진짜 TOCTOU 경합을 정확히 겨냥해 닫는다. 반환값을 소비하는 모든 호출부가 이미
`if (!wrote)` 패턴을 갖추고 있어 배선 누락이 없고, `null`/`undefined` affected 를 성공으로
간주하는 선택도 근거·테스트가 있다. `toLockTimeoutMs` 방어 강화와 메서드 개명도 동시성 동작
자체를 바꾸지 않는 안전한 정리다. 유일하게 남는 잔여는 `rotateBotToken` 에서 secret store
쓰기가 `affected` 판정보다 앞서 일어나 트랜잭션 경계를 넘는 보상 동작의 원자성이 완전히
닫히지는 않는다는 점인데, 이는 이번 diff 가 새로 만든 것이 아니고 PR 이 선언한 스코프
밖이라 INFO 로만 기록한다. 새로 도입된 데드락·미동기화·경쟁 조건은 발견되지 않았다.

## 위험도

LOW
