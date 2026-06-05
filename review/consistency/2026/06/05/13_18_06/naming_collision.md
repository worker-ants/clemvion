## 발견사항

### [INFO] `user_variables` (DB 컬럼/TypeORM 속성) — 충돌 없음, 명명 적절
- **target 신규 식별자**: `Execution.user_variables` (PostgreSQL 컬럼, V085), `Execution.userVariables` (TypeORM 엔티티 프로퍼티)
- **기존 사용처**: `execution` 테이블에 기존 `variables` 관련 컬럼 없음. `ExecutionContext.variables` 필드는 in-memory 런타임 맵으로 다른 레이어. `spec/1-data-model.md §2.13` Execution 테이블에 `variables` 컬럼 자체가 존재하지 않음.
- **상세**: `user_variables` 는 기존 컬럼명과 겹치지 않는다. 직전에 도입된 `conversation_thread`(V084) 컬럼과 동일 네이밍 패턴(`noun_underscore_noun`)을 따른다. 런타임 `ExecutionContext.variables`(복합 맵)와는 레이어·타입·생존 주기가 분명히 다르므로 혼동 소지는 낮다.
- **제안**: 없음. 네이밍 적절.

### [INFO] `stageDurableResumeSnapshot` — `stageConversationThreadSnapshot` 교체, 기존 참조 없음
- **target 신규 식별자**: `private stageDurableResumeSnapshot()` (execution-engine.service.ts)
- **기존 사용처**: 교체 이전 이름 `stageConversationThreadSnapshot` 은 `execution-engine.service.ts` 내부 private 메서드로만 존재했으며(`origin/main` 기준 3곳 self-call + 1곳 정의), 외부 파일·spec 문서에 해당 이름이 기술된 곳은 없음.
- **상세**: rename 이 자기완결이며 다른 모듈이 의존하지 않으므로 ABI/계약 충돌 없음. 새 이름이 범위를 정확히 서술한다(conversation_thread 뿐 아니라 user_variables 도 commit).
- **제안**: 없음.

### [INFO] `rehydrateUserVariables` / `filterUserVariables` — 신규 private 메서드, 충돌 없음
- **target 신규 식별자**: `private rehydrateUserVariables()`, `private filterUserVariables()` (execution-engine.service.ts)
- **기존 사용처**: 동일 파일 또는 타 파일에 같은 이름의 메서드·함수가 존재하지 않음. `rehydrateConversationThread` 와 대칭적 네이밍 패턴(`rehydrate*`)을 따름.
- **상세**: private scope이므로 외부 노출 없음. 이름이 동작을 명확히 서술. 충돌 없음.
- **제안**: 없음.

### [WARNING] 마이그레이션 번호 V085 — 병렬 브랜치와 경합 가능성
- **target 신규 식별자**: `V085__execution_user_variables.sql`
- **기존 사용처**: `origin/main` 에는 V085 파일이 아직 없음(V084 까지만 랜딩). 그러나 로컬 브랜치 `claude/impl-concurrency-cap-pr2b` 가 존재하며(git branch -a 확인), 해당 브랜치의 migrations 디렉터리는 현재 V083 까지만 보유 — V085 선점은 확인되지 않았으나, 브랜치가 계속 개발되면 V085 를 주장할 수 있다.
- **상세**: Flyway는 버전 번호를 유일 식별자로 사용하므로 두 브랜치가 각각 `V085__*.sql` 을 만들면 어느 한쪽이 main 에 먼저 머지된 뒤 나머지 PR 이 numbering 충돌로 실패한다. 이전 plan 메모(`plan/in-progress/exec-park-durable-resume.md` "consistency --impl-prep C1(BLOCK): impl-concurrency-cap-pr2b…V085 자유")에 따르면 현재는 V085 가 자유롭다고 판단했으나, 해당 브랜치가 활성 상태이므로 머지 타이밍에 따라 충돌 발생 가능.
- **제안**: PR 머지 전 `claude/impl-concurrency-cap-pr2b` 브랜치의 최신 migrations 디렉터리를 재확인해 V085 선점 여부를 검증. 충돌 시 plan 메모(`§A3. …renumber…`) 절차에 따라 V086으로 renumber.

### [INFO] `V085__execution_user_variables.sql` 파일 경로/이름 컨벤션 준수
- **target 신규 식별자**: 파일 경로 `codebase/backend/migrations/V085__execution_user_variables.sql`
- **기존 사용처**: 기존 파일 패턴 `V<N>__<table>_<descriptor>.sql` (예: V084__execution_conversation_thread.sql, V083__execution_active_running_ms.sql) 과 일치.
- **상세**: `execution_user_variables` 는 테이블명 + 컬럼 서술어 형태로 기존 컨벤션을 따름. 충돌 없음.
- **제안**: 없음.

---

## 요약

이번 변경(Phase A3)이 도입하는 신규 식별자(`Execution.user_variables` DB 컬럼, `userVariables` TypeORM 속성, `stageDurableResumeSnapshot`/`rehydrateUserVariables`/`filterUserVariables` private 메서드, `V085__execution_user_variables.sql` 마이그레이션)는 기존 코드베이스·spec 어느 영역에서도 의미 충돌하는 선점 사용처가 발견되지 않았다. 모두 기존 A1(`conversation_thread` / V084) 패턴을 일관되게 따른다. 유일한 실질 위험은 마이그레이션 번호 V085 의 병렬 브랜치(`impl-concurrency-cap-pr2b`) 경합이며, 이는 머지 전 최신 branches 확인으로 예방 가능한 타이밍 이슈다.

## 위험도

LOW
