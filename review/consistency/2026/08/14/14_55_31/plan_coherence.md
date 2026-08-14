# Plan 정합성 검토 — plan_coherence

## 검토 대상 요약

이번 diff(`origin/main...HEAD`)는 `spec/5-system/**` 를 직접 수정하지 않는다. 최신 커밋
`7fa12301c`("같은 함수의 세 출구 중 하나만 막았다")는 직전 라운드(`review/consistency/2026/08/14/
14_30_36`)의 plan_coherence WARNING 2건(§R17 후속 의무 미등재·형제 plan 반증 각주 미기록)과
code-review CRITICAL 1건을 모두 반영했다 — `spec-draft-eia-62-waiting-payload.md` 변경 제안
(7)에 "§R17 정정" 불릿을 추가했고, `spec-draft-eia-notification-payload-contract.md`에 약속했던
반증 각주도 실제로 달았고, CHANGELOG 도 REST 경로를 포함해 갱신했다. 즉 직전 라운드가 낸
WARNING 은 전부 해소됐다.

이번 라운드에서 새로 확인한 것은 **그 해소 작업 자체가 만든 카운트 drift** 하나와, 두 plan 이
같은 코드 블록을 동시에 겨냥하면서 생기는 단방향 교차참조 누락 하나다.

---

## 발견사항

### [WARNING] `spec-draft-eia-62-waiting-payload.md` 체크리스트 "(6항목)"이 실제 7항목과 어긋난다

- **target 위치**: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:239`
  (`## 체크리스트` → `- [ ] spec 반영 (6항목)`)
- **관련 plan**: 같은 문서의 `## 변경 제안` 절 — `### (1)` ~ `### (7)` (라인 56·75·84·102·110·
  114·119), 특히 `### (7) llmCalls strip SoT 가 실제 누출 표면을 안 덮는다`
- **상세**: 이 문서는 커밋 `81f2c60d6`(2026-08-14 10:31)에 처음 만들어질 때 변경 제안이
  정확히 6개(`(1)`~`(6)`)였고, 당시 체크리스트도 "spec 반영 (6항목)"으로 일치했다(`git show
  81f2c60d6:...` 로 확인). 이후 커밋 `2ef826dc5`("체크박스 drift 가 바로 다음 커밋에서
  재발했다 + 유출 사후 대응 등재")가 `llmCalls` REST-경로 유출 발견을 반영해 `### (7)`을 새로
  추가했지만, 같은 커밋에서 하단 체크리스트의 "(6항목)"은 "(7항목)"으로 갱신되지 않았다. HEAD
  (`7fa12301c`)까지 이 상태가 그대로 남아 있다(`grep -n "^### ("` 로 7개 확인, `grep -n "spec
  반영"` 로 여전히 "(6항목)" 확인). 아이러니하게도 이 drift 를 만든 커밋의 제목 자체가
  "체크박스 drift 재발"을 다루고 있다 — 같은 클래스의 결함이 그 커밋에서 다시 발생했다.
  이 plan 의 실행 주체는 developer 가 아니라 `project-planner`(`owner: project-planner`)이고,
  차단된 `eia-terminal-payload.md`가 이 문서의 "spec 반영" 완료를 해제 조건으로 참조하고
  있으므로, planner 가 이 카운트만 보고 6개를 적용한 뒤 "spec 반영" 을 체크하면 `(7)`(§R17
  정정 + WS §4.4 확장)이 조용히 누락된 채 문서가 완료로 표시될 위험이 있다.
- **제안**: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:239` 의 "spec 반영
  (6항목)"을 "spec 반영 (7항목)"으로 정정한다.

### [INFO] `retry-turn-terminal-guard.md` #2(`cancelledBy`)와 `eia-terminal-payload.md`(error 객체화)가 같은 코드 블록을 겨냥하는데 교차참조가 단방향이다

- **target 위치**: `plan/in-progress/retry-turn-terminal-guard.md:364`(§코드 표 #2,
  `retry-turn.service.ts` `failRetryExecution` 의 `EXECUTION_CANCELLED`/`FAILED` payload)
- **관련 plan**: `plan/in-progress/eia-terminal-payload.md:1834-1836`("그리고
  `retry-turn-terminal-guard.md` `#2`(`cancelledBy` 추가)가 **같은 코드 블록**
  (`retry-turn.service.ts` `failRetryExecution` `:956~965`)을 겨냥한다 — 같은 턴에 함께
  처리하거나 순서를 맞출 것.")
- **상세**: `eia-terminal-payload.md`는 이 충돌을 이미 인지하고 명시적으로 등재했지만,
  `retry-turn-terminal-guard.md` 쪽(§코드 표 #2, §"5R 신규 등재 후속" W1)에는
  `eia-terminal-payload.md`에 대한 역참조가 없다(`grep -n "eia-terminal-payload"
  retry-turn-terminal-guard.md` 0건). `retry-turn-terminal-guard.md`가 먼저 착수되면
  `failRetryExecution`의 `error` 필드가 아직 string 인 상태에서 `cancelledBy`만 추가하게 되고,
  이후 `eia-terminal-payload.md`가 그 위에 `error` 객체 변환을 겹쳐야 해서 diff 충돌 또는
  놓친 필드 조합이 생길 수 있다. 두 plan 모두 `spec-draft-eia-62-waiting-payload.md`의 완료를
  선행 조건으로 걸고 있어(전자는 EIA §6 SoT 이관 언급, 후자는 명시적 차단) 실제 착수 순서는
  같은 planner 턴 이후로 맞춰질 가능성이 높지만, 문서만 놓고 보면 한쪽에서만 알고 있는 정보다.
- **제안**: `retry-turn-terminal-guard.md:364`(§코드 표 #2) 옆에 "`eia-terminal-payload.md`의
  `error` 객체화(같은 코드 블록)와 순서 조율 필요" 각주를 추가해 양방향 교차참조로 만든다.
  급하지 않음 — 두 plan 모두 같은 선행 조건(§planner spec 반영)에 묶여 있어 실제 병행 착수
  가능성은 낮다.

---

## 요약

이번 diff 는 `spec/5-system/**`를 건드리지 않는 순수 보안 코드 수정이며, 직전 라운드
(`14_30_36`)가 낸 plan_coherence WARNING 2건(§R17 후속 의무 미등재, 형제 plan 반증 각주
누락)은 최신 커밋에서 모두 정확히 반영됐다 — 확인 결과 재차 보고할 미해결 항목은 없다. 다만
그 해소 작업이 `spec-draft-eia-62-waiting-payload.md`에 새 변경 제안 `(7)`을 추가하면서 하단
체크리스트 "(6항목)" 카운트를 갱신하지 않아 새로운 drift 를 하나 남겼다(WARNING) — 이 문서는
`eia-terminal-payload.md`의 차단 해제 조건이라 planner 가 카운트만 믿고 항목 하나를 누락할
위험이 있다. 그 외 `retry-turn-terminal-guard.md`와 `eia-terminal-payload.md`가 같은 코드
블록(`retry-turn.service.ts failRetryExecution`)을 겨냥하면서 교차참조가 단방향인 점을
INFO 로 남긴다. 둘 다 target(`spec/5-system/`) 자체의 결정을 뒤엎거나 선행 plan 을 우회하는
CRITICAL 성격은 아니다.

## 위험도

LOW
