# 신규 식별자 충돌 검토 — trigger-config-lost-update

검토 범위: `spec/5-system/` (scope 델타 0, 정상) + 구현 diff 17개 파일(신규 4개: `trigger-config-lock.ts`,
`trigger-config-lock.spec.ts`, `__test-utils__/trigger-transaction-mock.ts`,
`test/trigger-config-lost-update.e2e-spec.ts`).

## 발견사항

- **[WARNING]** `findByIdForUpdate` — 이 코드베이스에서 `ForUpdate`/`FOR UPDATE` 가 이미
  "진짜 pessimistic 행 잠금" 을 뜻하는 확립된 명명 관용구인데, 신규 메서드는 그 잠금을 하지 않는다
  - target 신규 식별자: `TriggersService.findByIdForUpdate(id, workspaceId)`
    (`codebase/backend/src/modules/triggers/triggers.service.ts:531`, private 메서드).
    구현은 `this.triggerRepository.findOne({ where: { id, workspaceId } })` 뿐이고
    `SELECT ... FOR UPDATE`/`lock: { mode: 'pessimistic_write' }` 어느 것도 쓰지 않는다.
    바로 위 JSDoc(`:523-530`)이 스스로 "`update()` 전용 — **검증에만 쓰는 가벼운 조회**"
    라고 밝힌다 — 실제 잠금은 이 호출이 아니라 그 뒤 `rewriteTriggerConfigLocked`/인라인
    `manager.transaction` 안에서 `acquireTriggerConfigLock`(advisory lock) 으로 별도로 걸린다.
  - 기존 사용처: 같은 백엔드에 `ForUpdate`/`FOR UPDATE` 를 문자 그대로 "행 잠금" 의미로 쓰는
    확립된 선례가 다수 있다 —
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8398,8407`
    (`lockNonTerminalExecutionRow` 의 `SELECT ... FOR UPDATE`),
    `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:369,371`
    (`updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec` 의 "FOR UPDATE" 기술),
    `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:78,195`.
    또한 spec 본문에도 같은 관용구가 있다 — `spec/5-system/1-auth.md` §1.4.4
    "credential row 는 `SELECT ... FOR UPDATE` 로 pessimistic lock 한다". 코드베이스 전수 검색
    결과 `findByIdForUpdate` 라는 정확히 같은 문자열은 다른 곳에 없지만(직접 충돌 없음),
    `*ForUpdate` 접미사가 이 저장소에서 이미 "SQL 잠금" 이라는 좁고 구체적인 의미로 통용된다.
  - 상세: 리뷰가 이미 8라운드 이상 진행되며 "config 를 다시 쓰는 자리" 전수 열거·뮤테이션
    검증까지 극도로 꼼꼼했지만, 이 메서드명이 시사하는 것과 실제 동작의 불일치는 어느 라운드
    에서도 지적되지 않았다(plan 전수 검색 결과 `findByIdForUpdate` 언급은 `4라운드` 성능 분리
    맥락 한 번뿐, 명명 자체에 대한 지적 없음). 향후 이 클래스를 만지는 사람이 `findByIdForUpdate`
    를 "이 시점에 행이 잠겼다" 로 오해하면, 그 뒤에 (`config` 가 아닌) 다른 컬럼을 락 없이
    수정하는 새 경로를 추가하면서 "이미 `ForUpdate` 로 읽었으니 안전하다" 고 잘못 판단할
    위험이 있다 — 정확히 이 PR 이 고치는 클래스의 결함(락 없는 읽기-수정-쓰기)을 재도입하는
    경로다. 이름이 유발하는 오신뢰라는 점에서 이 PR 의 주제와 특히 아이러니하다.
  - 제안: 이름에서 "ForUpdate" 를 빼고 실제 의도(PATCH 사전 검증용 경량 조회)를 드러내는 이름으로
    바꾼다 — 예: `findByIdForPatchValidation`, `findTriggerForValidation`, `findLightById`.
    이름을 바꾸지 않는다면 최소한 메서드 시그니처 옆 한 줄 요약에 "이 저장소의 `FOR UPDATE`
    관용구(행 잠금)와 무관 — 실제 잠금은 `acquireTriggerConfigLock` 참조" 를 명시해 검색만으로도
    구분되게 한다(현재는 JSDoc 본문을 끝까지 읽어야만 드러난다). private 스코프라 파급 범위는
    이 파일 내로 제한되므로 CRITICAL 대신 WARNING 으로 판단했다.

- **[INFO]** advisory lock key 접두어 `trigger-config:` 는 Redis 키 네임스페이스처럼 보이지만
  Redis 가 아니다 — 이미 식별·완화된 항목, 재확인만
  - target 신규 식별자: `TRIGGER_CONFIG_LOCK_PREFIX = 'trigger-config'`
    (`codebase/backend/src/modules/triggers/trigger-config-lock.ts:18`), 실사용 키 형태
    `trigger-config:<id>`.
  - 기존 사용처: `spec/conventions/redis-keys.md §4`(인접 네임스페이스 절)가 `{도메인}:{식별자}`
    형태의 실제 Redis 키들을 관리하는데, 이 문자열은 겉모양만 같고 실체는
    `pg_advisory_xact_lock(hashtext($1))` 의 SQL 입력값이라 Redis 를 전혀 경유하지 않는다.
    자매 사례 `exec-cap:<workspaceId>`(`execution-engine.service.ts`)도 같은 이유로 미등재.
  - 상세: 이 혼동은 이번 검토가 처음 지적하는 것이 아니라, 이전 `--impl-prep` naming_collision
    WARNING#2 가 이미 잡았고 코드가 `trigger-config-lock.ts:6-17` 에 "⚠️ 이 문자열은 Redis 키가
    아니다" 로 명시적 주석을 달아 완화했다. `redis-keys.md §4` 정식 등재(두 계열 `exec-cap:*`·
    `trigger-config:*` 동시)는 plan §"planner 범위" 표에 이미 후속으로 올라가 있다(spec 쓰기는
    developer 권한 밖).
  - 제안: 신규 조치 불요 — planner 턴에서 `redis-keys.md §4` 에 두 계열을 등재할 때 함께 처리.
    이번 검토는 그 완화가 실측대로 코드에 존재함(주석 확인)만 재확인했다.

## 요약

이 PR 은 spec 델타가 없는 순수 코드 변경이라 요구사항 ID·엔드포인트·이벤트명·환경변수 축에서는
신규 식별자 충돌이 없다. 신규 파일 경로(`trigger-config-lock.ts` 등)와 `__test-utils__/` 디렉터리
관례도 기존 `common/__test-utils__`·`integrations/__test-utils__` 와 일치해 문제없다. 유일한
실질 발견은 새 private 메서드 `findByIdForUpdate` 가 이 코드베이스에서 이미 "행 잠금" 을 뜻하는
`ForUpdate` 관용구와 이름만 같고 의미가 반대(잠금 없는 경량 조회)라는 점이며, private 스코프로
파급은 제한적이지만 개념적 오신뢰 위험이 있어 개명 또는 명시적 구분 주석을 권고한다. 그 외
lock-key 네임스페이스 혼동은 이미 식별·완화·후속 등재까지 끝난 상태로 재확인만 했다.

## 위험도

LOW
