# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `finalizeGuarded` CANCELLED 분기에 추가된 `RETURNING` 후처리 블록이 중첩 깊이를 5단으로 밀어올린다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:657-679`
  - 상세: `if (live.status === target)` → `if (target === CANCELLED)` → `if ((result.affected ?? 0) > 0)` → `if (persistedFinishedAt instanceof Date) / else if (typeof === 'string')` → `if (Number.isFinite(parsed.getTime()))` 로 최대 5단 중첩이다. `finalizeGuarded` 는 이미 "멱등 no-op / CANCELLED / 비-CANCELLED / 전이불가 / guarded UPDATE" 5갈래를 한 함수가 책임지는 고밀도 함수였는데, 이번 diff 가 그 안에 `duration_ms`/`finished_at` 되읽기·파싱 로직을 한 겹 더 얹었다. 로직 자체(왜 필요한지)는 인접 주석이 잘 설명하지만, 중첩이 깊어질수록 "이 if 가 어느 분기 소속인지" 를 눈으로 추적하는 비용이 커진다.
  - 제안: `result.raw` → `{ durationMs, finishedAt }` 변환을 별도 private 헬퍼(예: `extractPersistedTerminalFields(row)`)로 뽑아 `if (persisted > 0) { const { durationMs, finishedAt } = extractPersistedTerminalFields(row); ... }` 형태로 평탄화하면 `finalizeGuarded` 본체의 중첩이 3단으로 줄어든다.

- **[WARNING]** `RETURNING` 행에서 `finished_at` 을 숫자 아닌 날짜로 좁히는 로직이 인라인 중복 구현되어, 같은 파일이 `toFiniteNumber` 로 이미 세운 "파싱은 한 곳에" 원칙과 어긋난다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:669-677` (관련: `codebase/backend/src/shared/utils/terminal-duration.ts:71-78` `toFiniteNumber`)
  - 상세: 같은 블록 바로 위(`:663`)에서는 `duration_ms` 를 `toFiniteNumber(row?.duration_ms)` 로 위임해 숫자로 좁힌다. 그런데 같은 `RETURNING` 행의 자매 컬럼인 `finished_at` 은 `instanceof Date` / `typeof === 'string'` 분기를 새로 인라인 작성했다. `terminal-duration.ts` 의 `toFiniteNumber` JSDoc 이 정확히 이 이유("pg 드라이버는 값을 문자열로 줄 수 있어 숫자로 좁히는 책임을 한 곳에 둔다")로 만들어진 헬퍼인데, `finished_at` 에는 대칭 헬퍼가 없어 같은 클래스의 방어 로직이 파일마다 손으로 반복될 씨앗이 된다. `terminal-duration.ts` 자신의 최상단 문서가 "이 갈래를 emit 지점마다 손으로 처리하면 한 곳씩 빠진다" 고 경고하는 바로 그 패턴이다.
  - 제안: `terminal-duration.ts` 에 `toFiniteNumber` 와 대칭인 `toPersistedDate(v: unknown): Date | null` (또는 유사 이름)을 추가해 `retry-turn.service.ts:670-677` 를 `execution.finishedAt = toPersistedDate(row?.finished_at) ?? execution.finishedAt;` 한 줄로 축약. 이번 PR 범위 밖이면 최소한 plan 의 "관용구 헬퍼 추출" 항목에 이 자리도 등재.

- **[WARNING]** `createQueryBuilder` mock 체인이 같은 spec 파일 안에서 diff 가 손댄 곳만 4곳 중복 — 파일 전체로는 15회 반복되는 기존 패턴을 이번 PR 이 더 키웠다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:79-87`, `:1253`(단일 필드지만 형제 블록), `:1313-1325`(신규 테스트), `:1352-1361`
  - 상세: `update/set/where/andWhere/setParameter/returning/execute` 전체를 갖춘 동일한 mock 객체 리터럴이 diff 가 건드린 곳만 4곳이다(`grep -c createQueryBuilder` 결과 파일 전체 15곳). 바로 이 블록의 자체 주석(`:76-78`)이 "프로덕션이 체인 메서드를 하나 추가할 때마다 불완전한 mock 은 TypeError 를 던지고, 그 호출이 try/catch 안이면 테스트가 조용히 vacuous 해진다(#1171 에서 실제로 겪었다)" 고 이미 그 위험을 명시하고 있는데, 이번 수정이 택한 해법은 "각 자리에 손으로 `returning` 을 추가" 였다 — 다음에 체인 메서드가 하나 더 늘면 정확히 같은 실수(어느 한 자리 누락)가 재발할 조건을 그대로 남긴다.
  - 제안: `makeGuardedQueryBuilderMock(overrides?: { affected?: number; raw?: unknown[] })` 같은 공용 팩토리를 파일 상단에 두고 15곳을 그 호출로 치환. 최소한 이번 PR 이 새로 추가한 신규 테스트(`:1313-1325`)만이라도 공용 팩토리를 우선 적용해 반복을 늘리지 않는 방향이 나았다.

- **[INFO]** `if (!persisted) { logger.warn(...); return; }` guarded-UPDATE 스킵 관용구가 이번 diff 로 세 번째 자리(`finalizeCancelledExecution`)를 얻었다 — 이미 plan 이 별도 PR 로 추적 중인 항목
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4895-4902` (자매: `:4970-4978` `finalizeFailedExecution`, `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:707-712` `finalizeGuarded`)
  - 상세: 세 함수 모두 "guarded UPDATE 결과 확인 → 실패 시 warn 로그 + emit skip" 을 각자 손으로 작성한다. 로그 문구·변수명(`persisted`)은 일관되게 맞춰져 있어 새 리더가 패턴을 알아보긴 쉽지만, 세 곳이 구조적으로 동일한 코드다. `plan/in-progress/eia-db-wire-invariant.md` 의 "범위 밖(등재됨)" 절이 "관용구 16곳 헬퍼 추출 — 별도 PR" 로 이미 이 항목을 의도적으로 미뤄뒀으므로 이번 리뷰에서 추가 조치를 요구하지는 않는다 — 다만 이번 diff 가 그 16곳에 자리를 하나 더 보탰다는 사실은 후속 PR 스코프 산정 시 반영할 필요가 있다.

- **[INFO]** 신규/수정 함수의 JSDoc·인라인 주석이 라운드별 CRITICAL 이력을 그대로 누적 서술해 매우 길다 — 이 저장소의 기존 관행과는 일치하지만 가독성 트레이드오프가 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4856-4875`(`finalizeCancelledExecution` JSDoc), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:600-639`(`finalizeGuarded` 내부 주석, 2차~4차 라운드 이력 나열)
  - 상세: 한 함수 안에 "2차 라운드 CRITICAL", "3차 라운드 CRITICAL", "4차 라운드 CRITICAL" 식으로 결정 이력이 시간순으로 쌓여, 실제 실행 코드(수 줄)보다 주석(수십 줄)이 압도적으로 길다. 이 저장소는 "왜" 를 지우지 않고 정정 노트로 남기는 관행을 명시적으로 채택하고 있어(다른 리뷰·plan 문서에서도 반복 확인됨) 이 자체를 결함으로 보긴 어렵다. 다만 함수 하나를 처음 읽는 사람이 실제 분기 로직에 도달하기까지 읽어야 하는 텍스트 양이 계속 늘고 있다는 점은 누적 비용이라 참고로 남긴다.
  - 제안: 조치 불요. 다만 이 계열 함수가 앞으로도 CRITICAL 라운드를 더 겪는다면, 라운드별 서사를 함수 JSDoc 대신 링크된 CHANGELOG/plan 항목으로 옮기고 함수에는 "현재 불변식"만 남기는 정리를 후속 리팩터 후보로 고려할 만하다.

## 요약

이번 diff(핵심: `finalizeCancelledExecution` guarded-UPDATE 결과 확인, retry-turn `COALESCE` 값 `RETURNING` 되읽기, REST `durationMs` 추가)는 네이밍·주석 스타일·기존 관용구(guarded UPDATE + `persisted` 체크, `resolveTerminalDurationMs` 위임) 모두 codebase 컨벤션을 정확히 따르고 있고, 각 변경의 "왜"가 코드·테스트·plan·spec 네 곳에 일관되게 기록돼 있어 추적성은 높다. 다만 구조적으로는 (1) `retry-turn.service.ts` `finalizeGuarded` 의 CANCELLED 분기가 새로 얻은 `RETURNING` 후처리 블록이 중첩을 5단까지 밀어올렸고 그 안의 날짜 파싱이 이미 존재하는 `toFiniteNumber` 헬퍼 패턴을 인라인으로 재발명했으며, (2) 같은 spec 파일의 query-builder mock 중복이 이번 PR 로 한 겹 더 늘었는데 정작 그 파일 자신의 주석이 이 중복의 위험성을 경고하고 있다는 점에서, 다음 유사 변경 때 반복 비용이 계속 누적되는 구조다. 둘 다 즉시 차단할 사안은 아니고 CRITICAL 은 없다.

## 위험도

LOW
