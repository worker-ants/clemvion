### 발견사항

- **[WARNING]** `finalizeCancelledExecution` 의 DB-정본 재조회 분기(`(a)` — DB 가 이미 CANCELLED)에서 `finishedAt` 되쓰기 줄이 어떤 테스트로도 검증되지 않는다 — 직접 뮤테이션으로 생존 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 함수 `finalizeCancelledExecution`, 게이트 라인 `4926-4928`
    ```
    4926	      // (a) — DB 가 cancelled 다. 값은 DB 정본으로 맞춰 wire 와 일치시킨다.
    4927	      savedExecution.durationMs = live.durationMs ?? savedExecution.durationMs;
    4928	      savedExecution.finishedAt = live.finishedAt ?? savedExecution.finishedAt;
    ```
    테스트: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` describe `finalizeCancelledExecution — 0행 매칭의 두 의미`(게이트 `1072-1126`), 특히 test (a) `게이트 1106-1113`.
  - 상세: `arrange()` 헬퍼(게이트 `1073-1090`)가 `findOneBy` 로 되돌리는 `live` 픽스처는 `{ id, status, durationMs: 777 }` 뿐이고 `finishedAt` 필드가 아예 없다. test (a) 는 `payload.durationMs` 만 단언하고 `savedExecution.finishedAt`(또는 그로부터 파생되는 어떤 값)도 단언하지 않는다. **실제로 `4928` 줄을 통째로 지우고 같은 describe 블록(3 tests)을 돌려도 전부 GREEN 이었다**(직접 패치→재실행→원복으로 실측). 코드 주석 자체가 "값은 DB 정본으로 맞춰 wire 와 일치시킨다" 고 두 컬럼(`durationMs`/`finishedAt`)을 나란히 언급하는데, 테스트는 한 컬럼만 커버한다.
    이 저장소는 정확히 같은 형태의 결함을 같은 PR 의 자매 코드(`retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기)에서 이미 한 번 겪고 고쳤다 — 직전 라운드(`review/code/2026/08/15/13_58_27/RESOLUTION.md` W1/W2)가 "두 컬럼을 되쓰기로 해 놓고 한 컬럼만 단언했다" 며 `finishedAt` 되쓰기 회귀 테스트를 추가했고(`retry-turn.service.spec.ts` 신규 테스트가 `expect(execArg.finishedAt).toEqual(new Date(PERSISTED_FINISHED_AT))` 을 명시적으로 단언), 그 자매 수정에 자기 뮤테이션 검증(returning 스파이 + 필드 삭제 뮤턴트 RED)까지 남겼다. 그런데 형제 함수(`execution-engine.service.ts`)의 동일 패턴에는 같은 처방이 적용되지 않았다.
    실전 영향은 현재는 좁다 — `emitCancellationEvent` 페이로드는 `durationMs` 만 신고 `finishedAt` 을 직접 싣지 않으며, `resolveTerminalDurationMs` 는 `savedExecution.durationMs` 가 이미 숫자면 `finishedAt`/`startedAt` 차분 계산으로 내려가지 않고 단락한다. 즉 `live.durationMs` 가 항상 채워져 있는 한(코드 주석 `4860` 이 "stop() 이 이미 guarded UPDATE 로 finishedAt/durationMs 를 **함께** 커밋한다" 고 명시) 이 줄은 현재 관측 가능한 차이를 만들지 않는다. 그러나 그 전제(`live.durationMs` 가 CANCELLED 행에서 항상 non-null)가 깨지는 경계(예: 과거 데이터, 수동 UPDATE, 다른 진입 경로로 인한 partial write)에서는 `resolveTerminalDurationMs` 의 fallback(`finishedAt - startedAt`)이 살아나고, 그때 이 되쓰기가 실제 값을 좌우한다 — 지금은 그 경로 자체가 테스트로 확인된 바 없다.
  - 제안: `arrange()` 의 `live` 픽스처에 `finishedAt` 필드를 추가하고, test (a) 에서 `savedExecution.finishedAt`(private 필드라면 emit 이후 `resolveTerminalDurationMs` 를 우회시키는 `live.durationMs: null` + `live.finishedAt: <값>` 조합의 4번째 케이스 (d)를 추가해, `resolveTerminalDurationMs` 의 fallback 경로가 실제로 DB 정본 `finishedAt` 을 쓰는지 관측 가능하게 만들 것. 최소한 `retry-turn.service.spec.ts` 가 쓴 것과 같은 "두 컬럼 모두 단언" 패턴을 형제 함수에도 맞출 것.

- **[INFO]** `retry-turn.service.ts` 의 `toFiniteNumber`/`toPersistedDate` 파싱-실패(=되쓰기 skip, 로컬 값 보존) 분기에는 이 서비스 레벨 통합 테스트가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 게이트 `664-673` (`if (persistedDuration !== null) { ... }` / `if (persistedFinishedAt !== null) { ... }` 의 `else`—즉 조건이 거짓인 경로)
  - 상세: 두 헬퍼(`toFiniteNumber`/`toPersistedDate`) 자체는 `terminal-duration.spec.ts` 에서 null/undefined/빈 문자열/Invalid Date 등 경계값이 촘촘히 단위 테스트돼 있다. 하지만 `retry-turn.service.ts` 쪽에서 "`RETURNING` 이 파싱 불가능한 값을 줬을 때 로컬 값이 조용히 유지되는지"를 직접 확인하는 케이스는 새 테스트에 없다(추가된 테스트는 `affected: 0`(되쓰기 블록 미진입) 과 `affected: 1` + 파싱 가능한 값, 두 경우만 다룬다). 이미 직전 라운드 concurrency 리뷰(`review/code/2026/08/15/13_58_27/concurrency.md`)가 이 지점을 "이론적 케이스이며 별도 조치 불요"로 평가해 정착된 사안이라 우선순위는 낮다.
  - 제안: 조치 불요(참고용) — 향후 이 헬퍼가 실패를 반환하는 실제 드라이버 형태가 관측되면 그때 fixture 로 고정.

### 회귀·격리·가독성 (문제 없음, 확인 완료)

- `execution-engine.service.spec.ts` 신규 describe 블록은 `mockExecutionRepo`/`eventEmitter`/`service` 가 파일 전역 `beforeEach`(게이트 `697` 부근)로 매 테스트 재생성되므로 테스트 간 상태 누수가 없다. `mockResolvedValueOnce` 를 일관되게 사용해 다음 테스트로 mock 값이 새지 않는다.
- `retry-turn.service.spec.ts` 의 새 테스트(`returningSpy` 를 이용해 `.returning(['duration_ms','finished_at'])` **호출 자체**를 단언)는 mock 의 `raw` 가 실제 `.returning()` 호출과 무관하게 반환되는 함정을 정확히 막는다 — RESOLUTION.md 가 기록한 "호출 자체를 지워도 GREEN 이던" 결함이 이번엔 재발하지 않는다. `startedAt` 을 10분 전으로 설정해 로컬 재계산값(T2)과 DB 보존값(T1)이 실제로 갈리는 fixture 를 쓴 것도 판별력 있는 설계다.
- `interaction.service.spec.ts` 의 `STATUS_PROJECTION_COLUMNS` 회귀 가드(게이트 `1038-1082`)는 `select.slice().sort()` 대 `BASE_COLUMNS.slice().sort()` 정확집합 비교라, 초과·누락 양쪽을 다 잡는다. `durationMs: 0` 을 `??`/`||` 로 가르는 경계 테스트, `null`(종결 전) 케이스도 갖춰 `??` 뮤턴트에 대한 판별력이 있다.
- `execution-status-response.dto.spec.ts` 의 `it.each` 목록에 `durationMs` 를 추가한 것은 "손으로 고른 목록 자체가 커버리지" 라는 이 저장소의 반복 함정을 스스로 주석에 명시하고 고친 것으로, 좋은 회귀 방지다.
- `terminal-duration.spec.ts` 의 신규 `toPersistedDate` 테스트는 Date 객체·ISO 문자열·null/undefined/빈 문자열/공백/비-날짜 문자열/Invalid Date 객체/숫자/객체 아홉 가지 입력을 `it.each` 로 촘촘히 다뤄 경계값 커버리지가 충실하다.
- 기존 테스트(`applyCancellation`/`markExecutionCancelled` 등 `affected:1` 해피패스, 라인 `3259` 부근)는 이번 diff 가 건드리는 `finalizeCancelledExecution`(사설 헬퍼, `runExecution`/`finalizeResumedExecutionOutcome` catch 전용)과 다른 코드 경로라 회귀 충돌이 없음을 직접 확인했다.

### 요약

이번 PR 은 "0행 매칭의 두 가지 의미"를 (a)/(b)/(c) 세 갈래로 정확히 나눈 회귀 테스트, `.returning()` 호출 자체를 스파이로 단언한 retry-turn 테스트, `??` 를 가르는 `durationMs: 0` 경계 테스트, `toPersistedDate` 9종 경계값 테스트 등 전반적으로 테스트 밀도와 판별력이 높다. 다만 형제 함수인 `finalizeCancelledExecution` 의 DB-정본 재조회 분기가 `durationMs`/`finishedAt` 두 컬럼을 나란히 되쓰는데, 정작 새 테스트는 `durationMs` 만 단언하고 `finishedAt` 되쓰기 줄은 통째로 지워도 GREEN 이다(직접 뮤테이션으로 확인) — 같은 PR 이 자매 코드(`retry-turn.service.ts`)에서 정확히 이 형태의 결함을 스스로 발견해 고쳤던 것과 대칭이 어긋난다. 그 외 발견은 이미 이전 라운드가 검토·수용한 저-우선순위 이론적 경로뿐이다.

### 위험도

LOW
