# 문서화(Documentation) 리뷰 — `finalizeStalledExhausted` 트랜잭션 원자화 (`eia-stalled-atomicity`)

## 발견사항

- **[WARNING]** CHANGELOG.md 에 이번 수정 항목이 없음 — 같은 파일의 확립된 선례(정확히 같은 결함
  클래스)를 어김
  - 위치: `CHANGELOG.md` (최상단 — 신규 `## Unreleased —` 항목 부재). 관련 코드:
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3334-3413`
    (`finalizeStalledExhausted`)
  - 상세: `git diff origin/main --stat` 로 확인한 이번 diff 13개 파일 중 `CHANGELOG.md` 는
    없다. 그런데 이 파일은 "짝 상태(Execution↔NodeExecution) 갱신 원자성" 결함류를 매번
    `## Unreleased —` 항목으로 상세히 기록해 온 확립된 관례를 갖고 있다 — 예:
    `## Unreleased — retry_last_turn 재진입: 종결 경로 terminal 가드 + 원자 claim + 짝 전이
    persist 수정`(`CHANGELOG.md:419`), `## Unreleased — AI multi-turn resume turn 경계 cancel
    가드 + park 짝 전이 lost-update 차단`(`:466`), `## Unreleased — 외부 cancel(Stop) 후에도
    하류 노드 dispatch·부수효과가 계속되던 결함 수정`(`:499`). 이번 수정은 정확히 같은
    형태다 — "부분 커밋 시 자식 NodeExecution 이 영구 RUNNING 으로 잔류" 라는, 위 항목들이
    기록한 것과 동일 계열(짝 전이 lost-update/원자성)의 버그다. 게다가 자매 함수
    `cancelParkedExecution` 이 같은 수정을 받았을 때도 JSDoc(아래 항목 참조)과 함께 상세
    기록을 남긴 선례(`ai-review WARNING #1 (2026-07-27)`, 코드 내 주석으로 확인)가 있다.
    plan 파일(`eia-stalled-atomicity.md`)의 체크리스트에도 CHANGELOG 항목 자체가 없어
    프로세스에서 완전히 누락된 상태다.
  - 제안: `CHANGELOG.md` 에 "`finalizeStalledExhausted` 만 트랜잭션 밖이라 부분 커밋 시
    NodeExecution 이 영구 RUNNING 으로 잔류할 수 있던 결함 수정" 항목을 추가한다. 이 결함은
    wire-visible 변경은 아니므로 "수신자 영향" 문구는 "없음(내부 신뢰성 수정)" 으로 명시하면
    충분하다.

- **[WARNING]** `finalizeStalledExhausted` 의 JSDoc 헤더가 이번 트랜잭션 원자화 사실·근거를
  기록하지 않음 — 자매 함수의 확립된 선례와 불일치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3315-3333`
    (`finalizeStalledExhausted` 위 docblock)
  - 상세: 같은 파일의 자매 함수 `cancelParkedExecution` 은 정확히 같은 수정(2단계 UPDATE →
    단일 트랜잭션)을 받았을 때 JSDoc 안에 별도 문단을 남겼다 — `:1017-1021`:
    "ai-review WARNING #1 (2026-07-27) — Execution/NodeExecution 이중 UPDATE 를
    `markWebChatIdleTimeout`(아래, 완전히 동형 연산)과 동일하게 **단일 트랜잭션**으로 묶는다.
    비-트랜잭션 2단계였을 때는 첫 UPDATE 커밋 후 둘째가 실패(또는 그 사이 크래시)하면
    NodeExecution 이 영구 WAITING 으로 잔류하고 Execution 만 CANCELLED 로 남는 불일치가
    있었다." 이번 PR 은 `finalizeStalledExhausted` 본문 안에 거의 동일한 설명을 인라인
    주석(`:3342-3345`)으로만 남기고, JSDoc 헤더(`:3315-3333`)는 갱신하지 않았다. JSDoc 은
    IDE hover·문서 생성 도구가 노출하는 1차 표면인데, 본문 인라인 주석은 함수 내부를 읽어야만
    보인다 — 같은 저장소·같은 클래스 안에서 동일 패턴에 다른 문서화 깊이를 적용한 셈이다.
  - 제안: `cancelParkedExecution` 선례와 같은 형식으로 JSDoc 에 "2026-08-15 —
    Execution/NodeExecution 이중 UPDATE 를 자매 두 함수와 동일하게 단일 트랜잭션으로 묶는다.
    부분 커밋 시 NodeExecution 이 영구 RUNNING 으로 잔류할 수 있었다" 문단을 추가.

- **[WARNING]** 신규 테스트가 같은 diff 에서 도입한 공유 헬퍼 `installStalledTx` 를 우회하고
  동일 설정을 손으로 복제 — 이 PR 계열에서 이미 지적된 패턴의 재발
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    신규 테스트 `it('Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다', ...)`
    (게이트 4914) 본문 4915-4939 부근. 비교 대상: 같은 파일에 새로 추가된 헬퍼
    `installStalledTx`(게이트 4879-4905)
  - 상세: `installStalledTx` 도입 커밋 메시지·주석은 "자매 `installCancelTx` 와 동형 — 두
    UPDATE 가 같은 트랜잭션 manager 를 탄다. 트랜잭션 밖 repo 를 쓰면 즉시 터지도록 무장"
    이라 명시한다. 그런데 바로 이 헬퍼가 검증하려는 **바로 그 명제**("두 UPDATE 가 같은
    트랜잭션 manager 를 탄다")를 직접 단언하는 신규 테스트(게이트 4914)는 이 헬퍼를 쓰지
    않고 `execQb`/`nodeQb`/`managerCqb`/`txSpy`/두 트랜잭션-밖-throw 가드를 전부 손으로
    다시 작성한다(`installStalledTx` 가 반환하는 4개 값과 정확히 동일한 것들). 뒤이은 두
    테스트("RUNNING 이면 failed..." 게이트 4962, "이미 terminal (affected=0)..." 게이트
    5023)는 반대로 `installStalledTx` 를 재사용한다 — plan 파일(`eia-stalled-atomicity.md`
    "## 조치")도 "기존 테스트 **2건**을 같은 하네스로 통일" 이라 적어 새 첫 테스트는 의도적으로
    범위 밖에 뒀음을 인정한다. 다만 그 이유(왜 새 테스트만 예외인지)를 코드에도 plan 에도
    남기지 않았다 — 헬퍼가 반환하는 `execQb`/`nodeQb`/`managerCqb`/`txSpy` 전부를 이 테스트가
    그대로 쓰므로 재사용을 막는 기술적 이유는 보이지 않는다(추가로 필요한 것은 `emitSpy`
    하나뿐이고 이는 헬퍼 호출 후 별도로 추가해도 충돌하지 않는다). 이 저장소는 같은 PR 계열의
    자매 트래커에서 이미 동형 패턴("신규 테스트 `(d)` 가 공유 `arrange()` 를 우회한다",
    `spec-sync-external-interaction-api-gaps.md` "## 신규 테스트 `(d)` 가 공유 `arrange()`
    를 우회한다" 절)을 WARNING 으로 등재해 뒀다 — 같은 결이 이번 diff 안에서 다시 발생했다.
  - 제안: 첫 테스트를 `const { execQb, nodeQb, managerCqb, txSpy } = installStalledTx(1);` 로
    바꾸고 `emitSpy` 설정만 추가. 의도적으로 유지한다면 이유(예: "헬퍼보다 먼저 작성돼 남음")를
    주석이나 plan 에 명시.

- **[INFO]** "30줄 아래" 라는 주석의 줄 거리 서술이 부정확 — 이 PR 이 옮긴 코드 블록이라 오차가
  더 벌어짐 (PR 신규 유발 아님, 선재 결함)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3384-3386`
    (`// 부모와 같은 code — 위 \`stalledError\` 를 도입한 이유(손으로 반복하면 갈린다)가` /
    `// 30줄 아래에서 그대로 재현되고 있었다.` / `code: stalledError.code,`)
  - 상세: `stalledError` 정의는 `:3338`, 참조 지점(`code: stalledError.code,`)은 `:3386` —
    실측 거리는 **48줄**이다. PR 이전(`git show HEAD~1:...`) 에도 이미 44줄이었으므로 "30줄"
    표현은 이 PR 이전부터 부정확했던 선재 결함이지만, 이번 PR 이 두 UPDATE 를
    `dataSource.transaction` 클로저 안으로 옮기며 들여쓰기·중간 코드(트랜잭션 래퍼 4줄 +
    `let stalledDurationMs`/`let finalized` 2줄 등)가 늘어 거리가 44→48줄로 더 벌어졌다. 이
    주석과 그 주변 코드 전체가 이번 diff 의 변경분(게이트 3378-3394)에 포함돼 있어, 지금이
    고칠 저비용 시점이다.
  - 제안: "30줄 아래" 를 상대적 줄 수 대신 "아래 NodeExecution UPDATE 안에서" 등 줄 수에
    의존하지 않는 표현으로 바꾸거나, 실측치로 갱신.

## 확인했으나 문제 없음 (참고)

- `spec/5-system/4-execution-engine.md` §7.1 에 추가된 문단("이 마감은 단일 트랜잭션이다
  (2026-08-15)...")은 코드와 정확히 일치하고, `spec/conventions/node-cancellation.md` 는
  이번 diff 에서 전혀 건드리지 않았다 — 직전 `--impl-prep`(`15_54_20`) convention_compliance
  WARNING("취소 전용 스코프 밖 문서에 등재")이 정확히 지적한 대로 위치를 옮겨 반영한 것으로
  확인된다(`plan/in-progress/eia-stalled-atomicity.md` "## 체크리스트" 1항목이 이 경위를
  기록).
- `plan/in-progress/eia-stalled-atomicity.md` 의 "## 체크리스트" 는 커밋 시점 기준 "자매
  트래커 동시 갱신" 이 `[x]` 로 동기화돼 있다 — 직전 consistency 라운드(`15_54_20`
  plan_coherence)가 지적한 본문↔체크리스트 지연이 해소됐다.
- 테스트 파일의 `mockNodeExecutionRepo.createQueryBuilder` "항상 참" 단언 교체는 plan 문서·
  주석·실제 코드 세 곳 모두 일관되게 같은 근거로 서술돼 있다.

## 요약

핵심 로직 변경(트랜잭션 원자화)과 spec §7.1 갱신 자체는 정확하고 자매 함수 패턴과 일치한다.
다만 문서화 관점에서 세 가지 확립된 선례가 이번 diff 에서 지켜지지 않았다 — (1) 같은
CHANGELOG.md 가 반복적으로 기록해 온 "짝 전이 원자성 결함 수정" 항목 부재, (2) 자매 함수
`cancelParkedExecution` 이 JSDoc 헤더에 남긴 것과 달리 이번 함수는 인라인 주석에만 원자화
근거를 남김, (3) 이 PR 자체가 도입한 공유 테스트 헬퍼를 그 헬퍼가 검증하려는 명제를 가장 직접
단언하는 신규 테스트가 우회 — 이는 같은 PR 계열의 자매 트래커가 이미 등재한 "신규 테스트가
공유 헬퍼를 우회" 패턴의 재발이다. 부가로 이번 diff 가 옮긴 코드 블록 안의 선재 주석("30줄
아래")이 실측과 더 벌어졌다(INFO). CRITICAL 급 문서 결함은 없다.

## 위험도

MEDIUM
