# 요구사항(Requirement) Review — EIA "DB = wire" invariant 잔여 3항목 (①②③)

대상: `finalizeCancelledExecution` guarded-UPDATE 반환 미확인 수정(①), retry-turn CANCELLED
재진입 `RETURNING` 추가(②), REST 단발 조회 `durationMs` 추가(③) + 관련 spec/plan/CHANGELOG.

## 검증 방법

- 코드 3개 핵심 파일(`execution-engine.service.ts`/`retry-turn.service.ts`/
  `interaction.service.ts`)을 diff 만이 아니라 `Read` 로 전체 함수 문맥을 직접 열람.
- `npx jest`로 변경된 3개 스펙 파일의 신규/관련 테스트를 실제 실행 — 전부 GREEN
  (`finalizeCancelledExecution`, `COALESCE`, `durationMs` 케이스).
- **뮤테이션 검증**: ① `if (!persisted) { …; return; }` 가드를 제거 → 신규 테스트가 RED로
  전환됨을 실측(`expect(emitSpy).not.toHaveBeenCalled()` 실패, 실제로 emit 1회 호출됨).
  ② `.returning()` 되읽기 대입(`execution.durationMs = persistedDuration`)을 제거 → 신규
  테스트가 RED(`Expected: 1234, Received: 600000`)로 전환됨을 실측. 두 경우 모두 원상복구
  (`cp`) 후 재실행해 GREEN 회복 확인 — plan 이 주장하는 "뮤테이션 확인/RED (1234 vs 600000)"
  서술과 정확히 일치.
- `npx tsc --noEmit`으로 변경 파일 4개에 타입 에러 없음 확인.
- `updateReturningRows`/기존 `.returning(['id','duration_ms'])` 5개 호출부(예:
  `cancelParkedExecution`)와 신규 `.returning(['duration_ms','finished_at'])` 코드가 같은
  snake_case raw-row 관용구를 따르는지 대조 — 일치.

## 발견사항

- **[WARNING]** `finalizeCancelledExecution` 함수 JSDoc 이 바로 아래 구현이 방금 뒤집은 동작을
  여전히 "항상 emit 한다"고 서술 — 의도와 구현이 같은 함수 안에서 정면으로 모순
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4869`
    (`* emit 은 반환값과 무관하게 항상 발행한다 — …`)
  - 상세: 이 줄은 함수 본문 바로 위(4856~4875행) JSDoc 블록의 일부이며, 이번 diff 가 **손대지
    않은** 기존 문장이다. 그런데 diff 는 바로 아래(4891~4902행)에 `persisted` 를 확인해 `false`
    면 emit 을 **skip**하는 새 가드를 추가했다 — 정확히 이 문장이 부정하는 동작이다. 이 PR 은
    `spec/conventions/node-cancellation.md` §2.4 Rationale 의 "과대서술"(구현보다 넓은 보장을
    문서화)을 정확히 정정하는 작업인데, 같은 클래스의 문제가 코드 인접 JSDoc 에는 새로 생겼다.
    이 저장소가 반복 관측한 패턴("문서한 보장이 구현보다 넓으면 안 된다")과 같은 유형이며,
    다음 사람이 이 JSDoc 만 읽고 "emit 은 항상 나간다"고 오해해 가드를 실수로 제거하거나
    자매 함수에 반대로 이식할 위험이 있다.
  - 제안: JSDoc 문단을 "emit 은 `updateExecutionStatus` 가 `true` 를 반환할 때만 발행한다 —
    동시 writer 가 이미 terminal 로 선점했으면(guarded UPDATE 0행) CANCELLED 재마킹·emit 을
    모두 skip한다(2026-08-15)"로 정정. `stop()`이 유일한 알림 지점인 경우가 있다는 뒷부분
    설명(WAITING 경로만 `cancelParkedExecution`이 emit)은 여전히 유효하므로 보존.

- **[WARNING]** `[SPEC-DRIFT]` 아님 — `EIA-IN-04` 요구사항 필드 목록이 구현된 `durationMs` 를
  누락한 채로 남음 (구현 스코프 누락, spec 이 옳고 이번 diff 가 정정을 놓친 사례)
  - 위치: `spec/5-system/14-external-interaction-api.md:77`
    (`| EIA-IN-04 | ... 현재 상태 단발 조회 (status / currentNode / context / result|error / seq / updatedAt) | 필수 |`)
  - 상세: 같은 파일 §5.3 JSON 예시(482~488행)와 §6 필드표(581행)는 이번 diff 로 `durationMs`
    를 정확히 반영했지만, §3.2 의 이 요구사항 정의 문장은 REST 단발 조회가 반환하는 필드를
    괄호로 열거하면서 `durationMs` 만 빠져 있다 — 나열된 나머지 필드(`status`/`currentNode`/
    `context`/`result|error`/`seq`/`updatedAt`)는 모두 실제 `ExecutionStatusDto` 필드와
    1:1 대응하므로, 이 목록은 "예시"가 아니라 사실상 완전 열거로 읽힌다. 착수 전
    `--impl-prep` convention_compliance 검토(INFO #2, `review/consistency/2026/08/15/13_43_10/convention_compliance.md`)가
    "EIA-IN-04 필드 목록(§3.2) + §5.3 JSON 예시... 를 **한 커밋에서 동반 갱신**할 것"을 명시
    권고했는데, 이번 구현은 §5.3 만 갱신하고 §3.2 요구사항 텍스트는 갱신하지 않았다.
  - 제안: L77 괄호 목록에 `durationMs` 추가 (`... / result|error / durationMs / seq / updatedAt`).
    `spec/` 쓰기 권한은 `project-planner` 소관이므로 developer 턴에서는 plan 체크리스트에
    이 갱신을 명시적으로 등재해 후속 spec 커밋으로 반영할 것.

- **[INFO]** `finalizeCancelledExecution` 의 "positive path"(guarded UPDATE 가 1행 매칭 →
  emit 실제 발생)에 대한 이번 diff 전용 회귀 테스트는 없음 — 이번에 추가된 테스트는 skip
  분기(0행)만 고정한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1069-1098`
  - 상세: 새 `describe('finalizeCancelledExecution — 선점 시 사후 오시그널 금지', …)` 블록은
    0행(선점) 케이스만 검증한다. 함수 자체는 이 PR 이전부터 존재했고 1행(정상) 경로는 기존
    동작을 바꾸지 않으므로 기존 광범위한 취소 관련 통합 테스트(`applyCancellation`,
    `markExecutionCancelled` 등, 같은 파일 다른 describe)가 간접적으로 커버할 가능성이 높지만,
    `finalizeCancelledExecution` 이름으로 직접 검증하는 positive 테스트는 diff 범위 안에서
    확인되지 않았다. 실제 결함은 아니며(뮤테이션 검증으로 negative 분기가 진짜 결함을 잡는다는
    것은 실측 확인했다), 완전성 측면의 참고 사항.
  - 제안: 조치 불요(선택) — 여유가 있으면 `persisted=true` 시 `emitCancellationEvent` 가 실제
    호출되는 대칭 테스트를 같은 describe 에 추가하면 자매 `finalizeFailedExecution` 처럼
    양쪽 분기가 모두 이름으로 고정된다.

## 확인된 정합 사항 (문제 없음)

- `updateExecutionStatus` else 분기(8611~8657행)가 `duration_ms = $5` 로 **로컬 JS 값을
  그대로** 쓰는 것을 직접 코드로 재확인 — plan 의 "실측하니 값은 같다" 주장과 일치. ①의
  진짜 결함은 값 불일치가 아니라 "반환을 안 읽는 것" 이었다는 서술이 코드와 정확히 부합.
- `finalizeCancelledExecution`(①)과 `finalizeFailedExecution` 이 이제 `persisted` 확인 →
  `false` 시 로그+skip, `true` 시 emit 구조로 **실제로 동형**임을 나란히 대조해 확인.
- `finalizeGuarded` CANCELLED 분기(retry-turn.service.ts:640-680)의 `COALESCE` +
  `.returning(['duration_ms','finished_at'])` + `toFiniteNumber` 되읽기 로직 — `0` 값을
  `!== null` 로 정확히 구분(falsy-zero 버그 없음), `finished_at` 의 `Date`/문자열/불가능값
  3분기 방어 모두 확인.
- `interaction.service.ts` `durationMs: execution.durationMs ?? null` — 종결 전 `null`,
  종결 후 영속 컬럼 그대로(재계산 없음), `STATUS_PROJECTION_COLUMNS`/`BASE_COLUMNS`(spec.ts
  정확집합 가드) 양쪽에 `durationMs` 반영됨을 확인.
- `ExecutionStatusDto.durationMs?: number | null` + `@ApiPropertyOptional({ nullable: true })`
  — 형제 필드(`result`/`error`/`currentNode`)와 동일 패턴, additive(breaking 아님).
- `spec/5-system/14-external-interaction-api.md` §6.5 캐비엇 취소선 처리가 같은 파일 577행의
  기존 관행과 정확히 같은 포맷(`~~원문~~ **(날짜 해소)**`, 원문 보존)임을 확인.
- `spec/conventions/node-cancellation.md` §2.4 매트릭스에 `finalizeCancelledExecution` 행
  추가 + Rationale 정정 문단(취소선+정정 노트)이 실제 구현(①)과 line-level 로 일치.
- Entity `durationMs: number`(실제로는 nullable 컬럼)의 타입 부정확성은 plan 이 스스로
  "이 PR 범위 밖 — 트래커 등재"로 명시했고 새로 도입된 문제가 아님 — 확인만, 발견사항 아님.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 대응 체크박스(자매 트래커)가
  같은 턴에 `[x]`로 동기화됨을 확인 — 이 durationMs 계열에서 4회 반복된 "자매 트래커
  미동기화" 패턴이 이번엔 재발하지 않았다.
- TODO/FIXME/HACK/XXX 마커: 변경분에 없음.

## 요약

핵심 결함 ①(`finalizeCancelledExecution` 이 guarded UPDATE 결과를 안 읽고 무조건 emit)과
②(retry-turn CANCELLED 재진입 시 `COALESCE` 가 보존한 DB 값과 emit 값이 갈리는 것)는 코드
직접 열람 + jest 실행 + 뮤테이션 RED/GREEN 실측으로 실제로 고쳐졌고 회귀 테스트로 고정됐음을
확인했다. ③(REST 재조회 `durationMs`)도 additive 로 정확히 구현됐으며 정확집합 가드까지
동반 갱신됐다. spec(`14-external-interaction-api.md` §5.3/§6.5, `node-cancellation.md` §2.4)과
CHANGELOG 서술도 구현과 line-level 로 일치한다. 다만 (1) `finalizeCancelledExecution` 바로
위 JSDoc 이 이번에 뒤집은 동작을 여전히 "항상 emit"이라고 서술해 문서-코드 모순이 새로
생겼고, (2) §3.2 `EIA-IN-04` 요구사항 필드 목록에 `durationMs` 반영이 누락됐다 — 둘 다
구현 착수 전 consistency-checker 가 예방적으로 경고했던 것과 같은 클래스의 잔여 갭이다.
두 항목 모두 CRITICAL 은 아니며(런타임 동작에는 영향 없음), 문서 정합성 관점의 WARNING이다.

## 위험도

LOW — 기능적 정확성은 뮤테이션 테스트로 실증됐고 CRITICAL 급 결함 없음. 다만 문서-코드
모순(JSDoc)과 spec 요구사항 필드 목록 누락은 병합 전 정정을 권장.
