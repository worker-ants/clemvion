STATUS=success plan_coherence review complete — 0 CRITICAL, 2 WARNING, 1 INFO

===REPORT_MARKDOWN_BELOW===

### 발견사항

- **[WARNING]** `spec-draft-eia-62-waiting-payload.md` frontmatter `spec_impact` 경로가 실재하지 않는다
  - target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` frontmatter
    `spec_impact:` 2번째 항목 (`spec/5-system/1-data-model.md`) — 이 파일은 이번 diff 로 신규
    생성됐다(`git diff origin/main...HEAD --stat` 에서 순수 추가 209줄)
  - 관련 plan: 없음(target 자체 결함). 단 같은 diff 의 `eia-terminal-payload.md` "함께 넘기는
    spec 항목" 표는 같은 절(`1-data-model.md §2.14`)을 경로 접두어 없이 올바르게 가리키고
    있어, target 이 이를 frontmatter 로 옮기며 `spec/5-system/` 접두어를 잘못 붙였을 가능성이
    높다
  - 상세: 실제 파일은 루트 레벨 `spec/1-data-model.md` 이고 `spec/5-system/` 하위가 아니다
    (`find spec -iname "*data-model*"` → `spec/1-data-model.md` 1건, `spec/5-system/1-data-model.md`
    는 부재를 재확인). target 이 고치려는 §2.14 "Execution.error ↔ NodeExecution.error 관계"
    표(`nodeId` nullable 갱신 대상)는 그 루트 파일에 실재하므로 대상 식별 자체는 맞고 경로
    표기만 틀렸다. `spec_impact` 는 Gate C(`spec-plan-completion.test.ts`)와 이후 consistency
    라운드가 번들링 대상을 찾는 데 쓰이므로, 잘못된 경로는 이 draft 가 최종 planner 턴을 집행할
    때 해당 spec 파일이 조용히 번들에서 빠질 위험이 있다. 직전 `09_38_17` 라운드가 이미 같은
    지적을 냈으나 이후 세 커밋(`a9574f823`·`5df89cda6`·`b49ee4310`)이 이 plan 파일을 여러 차례
    수정하면서도 frontmatter 는 그대로 남았다 — 재확인 결과 HEAD 에도 미수정 상태다
  - 제안: frontmatter 를 `spec/1-data-model.md` 로 정정

- **[WARNING]** target 의 SSE 필드명 매핑 재작성 계획이, 형제 plan 이 어제 "완료" 로 체크한
  바로 그 내용을 뒤집는데 교차 참조가 없다
  - target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` "변경 제안 (3)
    'SSE 필드명 매핑' blockquote 정정" — 및 그 근거가 되는 `spec/5-system/14-external-interaction-api.md:680-689`
    현재 blockquote("본 이벤트는 [채널별 봉투 규칙] 위에 **필드명까지** 달라지는 유일한
    경우")
  - 관련 plan: `plan/in-progress/spec-draft-eia-notification-payload-contract.md` — 같은
    worktree, 2026-08-13(하루 전) 실행, 체크리스트 "[x] §6.2 blockquote — 일반 봉투 규칙은
    도입부로, 남은 것은 `waiting_for_input` 고유 필드명 매핑뿐임을 명시"
  - 상세: 형제 plan 은 어제 이 blockquote 를 "그대로 두는 것"으로 완료 처리했다 —
    "waiting_for_input 만 필드명까지 다르다"는 전제를 유지한 채였다. target 은 오늘
    `notification-fanout.service.ts:134`(`payload: event.payload`, 변환 없이 그대로 감쌈)를
    직접 실측해 그 전제 자체가 틀렸다고 결론짓는다 — 실제로는 필드명이 아니라 **봉투만**
    다르다(§6 도입부의 "채널별 봉투" 절과 정합하는 결론). 기술적으로 target 의 결론이 맞아
    보이지만, target 은 이 관계를 전혀 언급하지 않는다 — `spec-draft-eia-notification-payload-contract.md`
    는 target 의 어느 절에도 인용되지 않는다. `spec/5-system/14-external-interaction-api.md`
    본문도 여전히 옛 blockquote(필드명 매핑 6개 화살표) 그대로라 이 반증이 아직 spec 에도
    반영되지 않은 상태다. 이 상태로는 형제 plan 을 나중에 읽는 사람이 이미 반증된 "필드명까지
    다르다" 전제를 재검토 없이 신뢰할 위험이 있다 — 직전 `09_38_17` 라운드가 이미 이 정확한
    문제를 지적했으나, 이후 `spec-draft-eia-62-waiting-payload.md` 를 세 차례 수정한 커밋들
    (`a9574f823`·`5df89cda6`·`b49ee4310`) 중 어느 것도 이 교차 참조를 추가하지 않았다
  - 제안: target 의 "변경 제안 (3)"에 `spec-draft-eia-notification-payload-contract.md` 를
    명시 인용하고, 그 plan 의 §6.2 blockquote 체크 항목 아래에 "실제로는 필드명 매핑이 아니라
    봉투 차이만 있었다 — `spec-draft-eia-62-waiting-payload.md` 가 정정" 후속 각주를 남길 것

- **[INFO]** `eia-terminal-payload.md` "함께 넘기는 spec 항목" 표가 target 의 범위 확장을
  반영하지 않는다
  - target 위치: `plan/in-progress/eia-terminal-payload.md` "### 함께 넘기는 spec 항목" 표
    (4항목: §6.2 webhook 예시 CRITICAL·`1-data-model.md` §2.14·§6.2 URL·`error.code`)
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` "변경 제안" — 위 4항목을
    전부 포함하면서 `interaction` 블록 Planned 표기·SSE 필드명 매핑 정정 2건을 추가해 실질
    6항목으로 범위를 넓혔다
  - 상세: 구조적으로는 정합하다 — target 체크리스트의 "eia-terminal-payload.md 차단 해제 후
    --impl-prep 재실행" 항목이 사실상 같은 결과를 내므로 현재 기능적으로 막히지는 않는다.
    다만 4→6 로 넓어진 사실이 원 plan 표에 반영되지 않아 추적 일관성이 약간 떨어진다
  - 제안: 저비용이므로 다음에 이 표를 열 때 함께 갱신. 급하지 않음

### 요약

이번 diff 의 실제 코드 변경(`websocket.service.ts` 의 `stripDeep` — 깊이 무관 strip, `__proto__`
오염 방지, 경계 연산자 통일)은 spec `6-websocket-protocol.md §4.4:519`("모든 외부 수신자에서
strip")가 이미 선언한 보장을 실제로 채우는 방향이라 CRITICAL 급 spec 충돌이 없고, 이 보안
수정에 딸린 결정(깊이 우선 strip 채택·이름 충돌 분리·성능 실측·이미 유출된 데이터 사후
대응 등재)은 모두 관련 plan(`spec-draft-eia-62-waiting-payload.md`)에 체크박스·근거와 함께
정확히 반영돼 있다 — 직전 세 라운드(`10_32_29`·`11_02_18`·`11_02_16` code review)가 지적한
체크박스 drift 는 모두 후속 커밋으로 해소됐다. 다만 그보다 앞선 `09_38_17` 라운드가 낸
WARNING 2건(잘못된 `spec_impact` 경로, 형제 plan 과 상충하는 SSE 필드명 매핑 재작성의
미인용)은 그 이후 세 차례의 plan 파일 수정에도 반영되지 않고 여전히 열려 있다 — 둘 다
"미해결"이라기보다 "다음 세션이 stale 한 전제를 재검토 없이 신뢰할 위험"이라는 동일한
패턴이며, 기능적으로 지금 당장 막고 있지는 않다.

### 위험도

LOW
