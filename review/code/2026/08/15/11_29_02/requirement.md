STATUS=success

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (6차 라운드)

## 방법론 노트

이 PR 은 이미 5회의 ai-review 라운드(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`→`11_09_44`)와
다회의 consistency-check 라운드를 거쳤고, 그 산출물 전체가 이번 diff(= `origin/main`(`e3825cc2c`)
대비 13 commits, HEAD `2c9b490fd`)에 누적 포함돼 있다. 앞선 라운드가 이미 지적·조치를 확인한
항목(int4 SQL 클램프 CRITICAL, JS 클램프 CRITICAL, `emitCancellationEvent` JSDoc 오기술,
§6.5 캐비엇 범위 협소, 테스트 제목 정밀도, 정규식 과잉 스코프 등)은 코드/스펙에서 실측 재확인만
하고 중복 보고하지 않는다.

프롬프트 번들이 크기 제한으로 diff 를 생략한 핵심 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`, `retry-turn.service.ts` 일부, `terminal-duration.spec.ts`,
`spec-sync-external-interaction-api-gaps.md`, `eia-terminal-payload.md`)은 `git diff origin/main --`
와 `Read`/`grep` 으로 직접 열어 전문 대조했다. `git log --oneline`, `git show 2c9b490fd` 로 최신
커밋(JS 클램프 CRITICAL 수정)의 실제 diff 도 확인했다.

## 발견사항

- **[WARNING] CHANGELOG 가 최신 CRITICAL 수정(JS 경로 int4 클램프)의 실제 영향 범위를 반영하지 않는다**
  - 위치: `CHANGELOG.md:14` (게이트 14행), `codebase/backend/src/shared/utils/terminal-duration.ts`
    (커밋 `2c9b490fd`의 `resolveTerminalDurationMs` 변경분)
  - 상세: `CHANGELOG.md` 의 "Unreleased — 종결 이벤트에 `durationMs`" 항목은 여전히
    *"`duration_ms` 컬럼이 `INTEGER`(≈24.8일)라 **SQL 식에** int4 상한 클램프를 넣었다.
    없으면 오래 대기한 실행의 **취소 UPDATE** 가 통째로 실패해 그 실행이 영구 고착된다"* 라고만
    적는다(SQL 경로 · 취소(cancel) 경로만 언급). 그런데 이 CHANGELOG 항목이 커밋된 뒤(`606f54418`)
    발견·수정된 CRITICAL(커밋 `2c9b490fd`, `review/code/2026/08/15/11_09_44/RESOLUTION.md`)은 **JS
    경로**(엔티티가 이미 로드된 완료(completed) 경로들이 `resolveTerminalDurationMs` 로 계산하는
    쪽)에는 클램프가 없었다는 사실이었고, 그 커밋 메시지 자신이 *"폼·버튼·AI 대기에는 시간 기반
    강제취소가 없어 24.8일 초과 대기 후 **정상 완료**가 통째로 실패한다"* 고 명시한다 — 즉 실제
    도달 경로는 **취소가 아니라 정상 완료(completion)** 다. `git show 2c9b490fd -- CHANGELOG.md`
    는 빈 diff — 이 커밋이 CHANGELOG 를 갱신하지 않았다.

    결과적으로 CHANGELOG 는 지금도 "클램프가 없으면 **취소 UPDATE** 가 실패한다" 는, CRITICAL
    수정 이전 시점의 좁은 서술만 담고 있다. 이 문서만 읽는 독자(수신자 영향을 파악하려는
    운영자·후속 편집자)는 24.8일 초과 시 위험이 취소 경로에만 있다고 오해하고, 실제로 더 넓은
    범위(폼/버튼/AI 대기가 24.8일을 넘겨 **정상 완료**되는 경우도 과거엔 실패했었다는 사실 및 그
    수정)를 놓친다. `terminal-duration.ts` JSDoc(`:29-33`)과 커밋 메시지는 정확히 "JS 경로와 SQL
    경로가 같은 컬럼에 쓰므로 상한도 같아야 한다"고 적어 두었으나, 그 교훈이 CHANGELOG 로는
    전파되지 않았다.
  - 제안: `CHANGELOG.md` 의 해당 불릿을 "SQL 식" 한정을 걷어내고 "JS/SQL 두 경로 모두" 로
    넓히거나, 별도 불릿을 추가해 "완료(completion) 경로도 같은 컬럼에 쓰므로 동일 상한을
    공유한다 — 폼/버튼/AI 장기 대기 후 정상 완료도 보호 대상"임을 명시. 런타임 동작상 결함은
    아니며(코드는 이미 옳게 고쳐졌다), 순수 문서 완결성 문제라 WARNING 으로 분류한다.

## 그 외 확인 결과 (요구사항 관점 — 문제 없음, 재확인)

- **기능 완전성 / 반환값**: `resolveTerminalDurationMs` 는 모든 입력 조합(유효 durationMs ·
  `NaN`/`Infinity` · `startedAt`/`finishedAt` 부재·`null`·비-`Date` · 시계 역행 · int4 상한 초과)에
  대해 `number | null` 을 반환하며 `throw` 하지 않는다 — `terminal-duration.spec.ts` 가 25개
  케이스로 이를 고정한다(직접 `Read` 로 대조). 종결 emit 16 경로(`execution-engine.service.ts`
  9곳 + `retry-turn.service.ts` 3곳 계산 + `emitCancellationEvent` 4곳 위임) 전부가 이 헬퍼를
  거치며, `durationMs` 를 아예 안 싣는 emit 경로는 `grep -n "durationMs"` 로 확인한 결과 없다.
- **JS/SQL 클램프 정합**: `PG_INT4_MAX` 상수를 JS(`Math.min(span, PG_INT4_MAX)`)와 SQL 템플릿
  문자열(`` `LEAST(${PG_INT4_MAX}, …)` ``) 양쪽이 공유해, 향후 한쪽만 갱신되는 재발을 정적으로
  차단한다(`terminal-duration.spec.ts` 의 "SQL 쌍둥이와 같은 상한 상수를 쓴다" 테스트가 문자열
  포함 여부로 고정). 두 경로 모두 시계 역행(음수)은 `NULL`/`null` 로 통일.
- **`driveCallStackResume` 회귀 여부**: `10_18_38` 라운드에서 지적된 "완료류 6경로 중 1곳만
  헬퍼 미경유" 문제를 `Read` 로 직접 확인 — 현재 `execution-engine.service.ts:2578-2579`,
  `:2595` 는 `resolveTerminalDurationMs` 를 정상적으로 사용한다. `10_34_51` 라운드의 "정규식이
  `NodeExecution` 8곳을 과잉 변경" 문제도 `grep -n "NodeExecution"` 로 대조한 결과 diff 안에
  0건 — 되돌림이 유지되고 있다.
- **spec fidelity (§6 도입부, `spec/5-system/14-external-interaction-api.md:564-580`)**: 필드
  집합 표의 `durationMs` 행("3종·구현됨·알 수 없으면 `null`")과 실제 emit 이 line-level 로
  일치한다. §6.5 blockquote(`:806-821`)의 취소 경로 대기-시간 캐비엇도 `EXECUTION_QUEUE_WAIT_TIMEOUT`
  ·park 취소·위젯 idle 회수 **셋 다** 명명하도록 이미 확장돼 있고(`11_09_44` W7 조치), retry-turn
  재진입 시 DB/emit 값 어긋남("알려진 예외 1건")도 invariant 옆에 명시적으로 적혀 있다 — spec 이
  스스로 알려진 갭을 감추지 않는다.
- **REST 비대칭(§5.3 `EIA-IN-04`, `:74`)**: `status/currentNode/context/result|error/seq/updatedAt`
  만 나열하고 `durationMs` 가 없다 — CHANGELOG(`:20-21`)와 spec-sync 트래커
  (`plan/in-progress/spec-sync-external-interaction-api-gaps.md:226-231`)가 이 비대칭을 이미
  일관되게 고지·등재하고 있어 서로 모순이 없다. 이 PR 범위 밖으로 명시적으로 defer 된 판단이라
  requirement 위반이 아니다.
- **`result.outputs` 분리**: 별도 필드 `result.outputs` (§6 필드 집합 표) 는 spec 이 shape 를
  정의한 적이 없어 "미구현 (Planned)" 로 남아 있고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:18-21`
  가 `durationMs` 와 별개 체크박스로 분리해 등재했다 — 두 필드를 한 체크박스로 묶어 두면
  `durationMs` 완료 시 `result.outputs` 가 조용히 닫힐 위험을 이 세션이 스스로 인지하고 분리한
  판단으로, requirement 관점에서 타당하다.
- **TODO/FIXME**: `terminal-duration.ts`/`.spec.ts`, `execution-engine.service.ts`,
  `retry-turn.service.ts`, `chat-channel/types.ts`, `chat-channel.dispatcher.ts` 전체에
  `TODO`/`FIXME`/`HACK`/`XXX` 0건(`grep` 확인).
- **엣지 케이스**: `durationMs: 0`(순간 완료)을 falsy 로 버리지 않도록 `??` 를 사용(`||` 아님)함을
  헬퍼·테스트 양쪽에서 확인. 레거시(키 부재) 이벤트 흡수는
  `chat-channel.dispatcher.spec.ts` 의 "레거시(키 부재) 이벤트도 깨지지 않는다" 테스트가 고정한다.

## 요약

핵심 요구사항("종결 이벤트 3종에 `durationMs` 를 싣고, 알 수 없으면 `null`, DB 와 wire 가 같은
값을 쓴다")은 5차례의 리뷰·수정 라운드를 거쳐 코드·spec·plan 트래커 사이에 line-level 로 정합한
상태로 수렴했다 — 이번 6차 라운드에서 새로 발견한 기능적 결함은 없다. 유일한 신규 발견은
`CHANGELOG.md` 가 가장 최근 CRITICAL 수정(JS 경로 int4 클램프 누락, 실제 도달 경로는 "정상
완료"이지 CHANGELOG 가 여전히 서술하는 "취소 UPDATE" 가 아니다)의 확장된 영향 범위를 반영하지
않는다는 점이다 — 런타임 동작에는 영향이 없는 순수 문서 완결성 갭이라 WARNING 으로 분류한다.
그 외 spec fidelity·엣지 케이스·에러 시나리오·반환값·TODO 부재는 모두 재확인 결과 문제가 없었다.

## 위험도

LOW
