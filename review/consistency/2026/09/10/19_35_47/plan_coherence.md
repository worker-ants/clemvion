# Plan 정합성 검토 — `plan/in-progress/spec-draft-trigger-canary-nav.md`

## 발견사항

- **[WARNING] 항목 3(`PROJECT.md`) 분리는 근거가 옳지만, 분리된 항목이 지금 어디에도 등재돼 있지 않다**
  - target 위치: `plan/in-progress/spec-draft-trigger-canary-nav.md` §「3번은 이 턴에서 못 한다」(라인 31-51), **처분**: "3번을 developer 후속으로 분리한다"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1798` — `- [ ] **planner: 캐너리 착지 후속 5건 (한 턴으로 묶임)**` (미체크, 「1·2·3·4·5」 다섯 항목을 **한 planner 턴**으로 요구하는 표를 그대로 갖고 있음, `#3 = PROJECT.md §e2e 파일 위치`)
  - 상세: 두 SKILL.md 를 직접 확인한 결과 draft 의 재판정은 사실관계로 옳다 — `.claude/skills/developer/SKILL.md:33` 은 `| README.md, PROJECT.md | Read/Write |` 로 developer 소유를 명시하고, `.claude/skills/project-planner/SKILL.md` 에는 `PROJECT.md` 항목 자체가 없다(grep 0건). `PROJECT.md:315` 도 draft 인용대로 `신규 헬퍼: codebase/backend/test/helpers/<name>.ts` 그대로다. 즉 이 planner 턴이 `PROJECT.md` 를 못 고치는 것은 맞다. **문제는 그 다음이다.** draft 본문 어디에도 "developer 후속" 이 구체적으로 어느 plan 파일의 어떤 체크리스트 항목으로 등재될지가 없다 — `spec_impact` 는 세 spec 파일만 나열하고, `spec-draft-nullable-notation-followups.md` 는 여전히 "5건(한 턴으로 묶임)" 문구·표를 그대로 갖고 있다(온디스크 확인, 갱신 흔적 없음). 이 draft 가 적용되면서 그 트래커 항목이 "1·2·4·5 완료" 로 체크되면, 3번은 표에서 `있음 — 단 이 턴 밖(아래)` 이라는 각주 하나만 남긴 채 **추적 가능한 자리 없이 소실될 위험**이 있다. 이 저장소는 정확히 이 형태로 "미룬 항목 5건을 잃을 뻔" 한 전례가 있고(`feedback_review_fix_stale_loop`), developer SKILL §4 도 *"partial-implementation 분리 시 본 PR 머지 전 `plan/in-progress/<spec-name>-followup-<surface>.md` 신설 + `pending_plans:` 등록 의무"* 를 명문화하고 있어 — 미루는 쪽이 planner 든 developer 든 "그 턴에 plan 에 적어라" 는 동일 규율이 적용된다.
  - 제안: 이 draft 를 적용하는 커밋에서 (a) `spec-draft-nullable-notation-followups.md` 의 "캐너리 착지 후속 5건" 항목을 "4건 적용 완료(planner) + 1건 developer 로 분리"로 갱신하고, (b) 분리된 3번을 **새 `- [ ] (developer, ...)` 체크리스트 항목**으로 같은 트래커 파일(또는 신규 `plan/in-progress/` 파일)에 명시 등재한 뒤 이 draft 에서 그 위치를 교차 참조할 것. 봉인된 `plan/complete/trigger-workflow-ref-canary.md` 는 사후 수정 대상이 아니므로, 새 등재 쪽에서 그 문서의 「후속으로 넘기는 것」③번을 인용해 계보를 잇는 것으로 충분하다.

- **[INFO] `3-schedule.md` `code:` 확장(범위 밖 항목 C) — 다른 in-progress plan 과 충돌 없음, 근거·델타 실측 정확**
  - target 위치: `plan/in-progress/spec-draft-trigger-canary-nav.md` §C (라인 106-119)
  - 관련 plan: 트래커 항목(`spec-draft-nullable-notation-followups.md:1798`)의 표는 트리거 축(`2-trigger-list.md`)만 지목하고 `3-schedule.md` 는 포함하지 않음
  - 상세: 온디스크 `spec/2-navigation/3-schedule.md` frontmatter `code:` 를 직접 확인한 결과 현재 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 만 있고 헬퍼(`shared/testing/schedule-trigger-ref*.ts`) 글롭은 없다 — draft 의 델타 주장이 정확하다. `plan/in-progress/**` 전체를 대상으로 `3-schedule.md`/`schedule-trigger-ref` 를 grep 했으나 이 확장과 충돌하는 별도의 진행 중 결정은 없었다(유일하게 같은 파일을 건드리는 `eia-terminal-payload.md` 는 `14-external-interaction-api.md` §6/§6.4 대역만 다뤄 섹션이 겹치지 않는다). 트래커 범위를 넘는다는 사실 자체는 draft 가 이미 자인하고 근거를 적었으므로(라인 118-119) 별도 조치 불필요 — 다만 위 WARNING 과 마찬가지로 트래커에 "범위 확장 1건" 을 사후 등재하는 것이 위생적이다.
  - 제안: 별도 조치 불요. 트래커 갱신 시(위 WARNING 처리) 이 확장도 같은 커밋에서 한 줄로 언급하면 충분.

- **[INFO] `spec_impact` 세 파일과 다른 in-progress plan 간 실질적 충돌 없음 — 단 인접 미해결 항목 하나는 후속 조정 여지**
  - target 위치: `plan/in-progress/spec-draft-trigger-canary-nav.md` frontmatter `spec_impact` (라인 8-11)
  - 관련 plan: `spec-draft-nullable-notation-followups.md:2469` — `- [ ] **CRITICAL: chatChannel PATCH 가 bot token single-path 를 우회한다**` (판정은 "예" 로 이미 끝났으나 developer 수정은 대기 중)
  - 상세: `spec-draft-nullable-notation-followups.md` 자신의 `spec_impact` 에 이미 `2-trigger-list.md`·`3-schedule.md` 가 등재돼 있고(15-chat-channel.md 등도), 새 draft 의 세 파일과 겹치는 것은 이 조상 트래커 자체이므로 이례적이지 않다(출처 관계가 명시돼 있음). `14-external-interaction-api.md` 를 동시에 건드리는 `eia-terminal-payload.md`(owner: developer) 는 섹션이 겹치지 않아 무해. 유일하게 볼 만한 것은 위 chatChannel PATCH bot-token 우회 항목 — 그 처방(DTO 분리)이 적용되면 `trigger-workflow-ref.e2e-spec.ts` case E 의 **요청 바디**가 바뀌어야 한다고 트래커에 이미 명시돼 있다. 이는 이 draft 가 §3 註에 적으려는 "다섯 케이스(양성 4 + 생성 음성 1)" 구조 자체(케이스 개수·성격)를 무효화하지 않는다 — 바뀌는 것은 한 케이스의 요청 바디뿐이다. 따라서 target 의 spec 문구는 그 developer 수정 이후에도 유효하다.
  - 제안: 조치 불요. 다만 developer 가 bot-token DTO 분리를 적용할 때 이 draft 가 새로 쓴 §3 註("다섯 케이스로 고정") 문구가 여전히 성립하는지 한 번 더 육안 확인하는 것을 그 PR 의 체크리스트에 남기면 안전하다.

- **[INFO] 봉인된 `plan/complete/trigger-workflow-ref-canary.md` 의 기대("한 planner 턴")와 draft 의 실제 분할 — 근거 있는 이탈이며 사실관계도 확인됨**
  - target 위치: `plan/in-progress/spec-draft-trigger-canary-nav.md` 라인 31-51, 65-67
  - 관련 plan: `plan/complete/trigger-workflow-ref-canary.md:217-224` — "후속 planner 턴" 표가 ①§3 문장 정정 ②`code:` 등재 ③`PROJECT.md` 헬퍼 위치 규칙 셋을 **"한 planner 턴으로 묶인다"** 고 명시
  - 상세: 봉인 문서는 세 항목 모두 planner 턴 하나에서 처리될 것으로 기대했으나, draft 는 실측(SKILL.md 권한 표)으로 ③이 planner 권한 밖임을 확인하고 분리했다. 이는 봉인 문서 자체의 가정 오류를 사후에 바로잡는 것으로, draft 가 그 근거(`#1308` T-4 와 "방향만 반대" 라는 명시적 비교)를 스스로 적어 계보를 남겼다. 봉인된 `complete/` 문서를 소급 수정할 필요는 없다(관례상 완료 문서는 봉인 유지) — 단, 이 이탈의 유일한 흔적이 현재 이 draft 파일 하나뿐이라, 위 WARNING 처리(3번의 새 등재)가 이뤄지지 않으면 봉인 문서가 약속한 ③번이 **어느 살아있는 문서에서도 추적되지 않는 상태**가 된다. 즉 이 항목은 사실상 첫 번째 WARNING 과 같은 뿌리다.
  - 제안: 별도 조치 없음(첫 WARNING 처리로 흡수됨).

## 요약

target draft(`spec-draft-trigger-canary-nav.md`)의 spec 편집안 A/B/C/D 는 모두 실측(현재 frontmatter·본문 라인 인용)과 정확히 일치하고, 다른 in-progress plan 과의 파일 단위 겹침(`14-external-interaction-api.md` 를 공유하는 `eia-terminal-payload.md` 등)도 섹션이 갈려 실질 충돌이 없다. 가장 눈에 띄는 문제는 내용이 아니라 **후속 처리의 등재 누락**이다 — draft 는 트래커가 "한 턴으로 묶은" 5건 중 3번(`PROJECT.md`)을 developer 소유로 재판정해 분리했는데(근거는 SKILL.md 권한 표 실측으로 옳다), 그 분리된 항목을 받아 줄 새 트래커 항목이 아직 어디에도 없다. 이 draft 가 적용되며 원 트래커 항목이 완료 처리되면 이 저장소가 이미 한 번 겪은 "미룬 항목 소실" 패턴이 재현될 수 있으므로, 적용 커밋 안에서 developer 항목을 명시적으로 재등재하는 것을 권고한다. 3-schedule.md `code:` 범위 확장은 사유가 정직하게 기록돼 있고 충돌도 없어 그대로 진행해도 무방하다.

## 위험도

MEDIUM
