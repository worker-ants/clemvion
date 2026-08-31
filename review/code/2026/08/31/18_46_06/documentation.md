# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `spec/data-flow/8-notifications.md` 안에 이번 스윕과 무관하게 실측 불가능한 절 참조가 남아 있다 — 이번 PR 이 도입한 것은 아니나, 바로 위에서 이번 PR 이 직접 고친(§4.4→§4.5) 문장과 같은 문단·같은 주제를 다룬다.
  - 위치: `spec/data-flow/8-notifications.md:349` — `3. **본 문서 §4.6 follow-up 정합**: 같은 문서가 multi-device 동기화 follow-up 으로 \`notification.read\` / \`notification.dismissed\` (점 표기) 를 명시한다.`
  - 상세: `git blame` 확인 결과 이 줄은 `841d6cfb86`(2026-05-29)에 작성돼 이번 PR 이전부터 있었다 — 이번 diff 의 renumbering 스윕이 만든 결함이 아니다. 다만 실제로 확인하면 `spec/5-system/6-websocket-protocol.md` 어디에도 `notification.read`/`notification.dismissed` 를 언급하는 곳이 없다(전수 grep 0건) — §4.5(신 번호, 알림 이벤트)에는 `notification.new` 한 항목만 있다. 즉 "§4.6" 은 이번 PR 전(구 번호 체계에서도 §4.6 = 외부 표면 매핑)이나 후(신 번호 체계에서 §4.6 = 시스템 이벤트) 어느 쪽으로도 실재하지 않는 내용을 가리키는 죽은 참조다. 이번 PR 이 스스로 "정정 후 재전수 — 실질 잔존 오인용 0건" 이라고 기록한 검증(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)은 `grep -rn '§<구번호>'` 로 번호 이동에 따른 오인용만 추적한 것이라, "가리키는 대상 자체가 애초에 없던" 이런 유형의 죽은 참조는 그 방법론의 사각지대에 있었다.
  - 제안: 이 PR 의 스코프 밖(선재 결함)이라 이번 라운드에서 반드시 고칠 필요는 없으나, 방치하면 다음 §4.x 스윕도 같은 사각지대를 반복한다. `notification.read`/`notification.dismissed` follow-up 서술을 삭제하거나(구현되지 않았고 WS 문서 어디에도 없다면), 실제로 그 내용을 §4.5 본문에 추가하고 앵커를 정확히 잇는 쪽으로 정정 권고.

- **[INFO]** `.claude/skills/consistency-checker/SKILL.md` 의 `--impl-done` 설명이 이번에 신설된 `_scope_delta_census` HEAD 블록을 언급하지 않는다.
  - 위치: `.claude/skills/consistency-checker/SKILL.md` (`--impl-done` 항목 bullet)
  - 상세: SKILL.md 는 `--impl-done` 이 target_doc 맨 앞에 "HEAD 워킹트리 절대경로 + CWD 신뢰 금지 가드"(`_head_basis_notice`)를 붙인다고 설명하지만, 이번 PR 이 그 바로 뒤에 추가한 두 번째 HEAD 블록(`_scope_delta_census` — scope/diff 델타 실측치, 절단 여부 판별용)은 SKILL.md 수준 설명에 반영돼 있지 않다. 구현 자체는 함수 docstring 에 근거·재발 이력이 상세히 실려 있어(`consistency_orchestrator.py` `_scope_delta_census`) 코드를 읽는 사람에게는 문제가 없지만, SKILL.md 만 읽고 `--impl-done` 산출물 구조를 파악하려는 사람은 이 블록의 존재를 모른 채로 넘어간다.
  - 제안: 필수는 아니나, SKILL.md 의 해당 bullet 에 한 문장으로 "target_doc 은 scope/diff 델타 실측 census 도 head 구역에 포함한다(절단 여부 판별용)" 를 덧붙이면 SKILL.md 만으로도 산출물 구조를 완전히 파악할 수 있다.

## 이전 라운드(18:30:55 세션) WARNING 처리 확인

이번 diff 는 직전 code review 세션(`review/code/2026/08/31/18_30_55`)이 낸 WARNING 들을 실제로 정정하는 fix round다. 저장소를 직접 열어 대조한 결과 아래는 전부 해소를 확인했다(뮤테이션 없이 `git diff`/`grep`/`Read` 만 사용, `git status --short` clean 확인):

- `spec/5-system/6-websocket-protocol.md` 자체 내부 bare 텍스트 인용(라인 28·52·156·1013·1086 등) — §4.4/§4.5→§4.5/§4.6/§4.7 전부 정정됨. 리뷰 시점 기준 `§4\.4`/`§4\.5` 관련 잔존 오인용 없음(직접 grep 재확인).
- `spec/data-flow/8-notifications.md:192` (같은 문단 내 §4.4 잔존) — `§4.5` 로 정정됨.
- `websocket-events.types.ts:211,232`, `websocket.service.ts:567`, `websocket.service.spec.ts:1268`(diff 밖에서 추가로 발견된 것) — 전부 `§4.4`→`§4.5` 정정됨.
- `consistency_orchestrator.py` 의 매직넘버 `20` — `_SCOPE_HITS_DISPLAY_LIMIT` 모듈 상수로 추출되고 두 지점(`scope_hits[:...]`, `len(scope_hits) - ...`)에서 참조하도록 정정됨.
- `_scope_delta_census` 의 20건 초과("… 외 N건" 절단) 분기 테스트 커버리지 부재 — `test_consistency_scope_census.py` 에 `test_over_the_limit_...`(n=25, `"… 외 5건"` 단언 포함) 로 보강됨.
- 신규 함수 삽입부의 3-blank-line 스타일 이슈 — 현재 소스는 2-blank-line 관례를 따름(정정 확인).
- `chat-channel.dispatcher.ts`/`.spec.ts`/`types.ts` 의 `line 536`/`line 89` 하드코딩 줄 번호 — 저장소 전체 재확인해도 잔존 0건.

## 긍정적으로 확인한 점

- 신설 함수 `_count_diff_files`/`_scope_delta_census` 는 재발 이력·실측치를 포함한 상세한 docstring 을 갖췄고, `test_consistency_scope_census.py` 도 모듈 상단에 왜 이 스위트가 필요한지(공허 방지·배선 축 포함)를 설명한다.
- `workflow-assistant.controller.swagger.spec.ts` 는 "왜 이 파일이 있나" JSDoc 으로 회귀 방지 취지를 명시하고, 인용한 `swagger.md §2-4` 문구와 실제 spec 본문이 정확히 일치함을 확인했다.
- `plan/complete/harness-consistency-summary-downgrade-rule.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 등은 처방·검증(뮤테이션 예측/실측 표 포함)·잔여 사항을 이례적으로 상세히 기록해, 다음 사람이 같은 조사를 반복하지 않도록 하고 있다.
- 줄 번호 인용을 심볼/§번호+앵커로 교체하는 원칙이 `chat-channel` 3파일·`node-output-redesign/README.md` 등 여러 곳에 일관되게 적용됐다.

## 요약

이번 diff 는 직전 리뷰 라운드가 지적한 문서화 WARNING(§4.4→§4.5 renumbering 스윕 누락 5곳, 매직넘버 미상수화, 테스트 커버리지 갭 등)을 저장소 직접 대조로 전부 해소했음을 확인했다. 신규 코드(`_scope_delta_census`, swagger 401 테스트)는 근거가 실린 독스트링과 회귀 테스트를 갖췄고, plan 문서들은 처방·검증·잔여를 상세히 기록하는 이 저장소의 강한 관례를 유지한다. 유일하게 남은 것은 이번 PR 범위 밖의 선재 결함(`8-notifications.md:349` 의 존재하지 않는 §4.6 follow-up 참조, 2026-05-29 기원)과 SKILL.md 의 경미한 설명 갭으로, 둘 다 INFO 수준이며 이번 PR 을 막을 이유는 없다.

## 위험도

LOW
