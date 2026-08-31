# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** 직전 라운드(`18_46_06`)가 낸 INFO 2건(선재 결함 — `8-notifications.md:349` 죽은 §4.6 참조 / `SKILL.md` 의 `--impl-done` 설명 갭)이 이번 라운드 커밋(`f3ece1fc6`)에서 **의도적으로 미조치 처리**됐는데, 그 "미조치 사유"가 **커밋 메시지에만** 적혀 있고 어떤 `plan/**` 트래커에도 등재되지 않았다.
  - 위치: 커밋 `f3ece1fc6` 메시지의 `## 미조치 (사유)` 절. 관련 plan 파일은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 같은 커밋이 이 파일에 23줄을 추가했지만(`§4.4`/`§4.5` 스윕 회고), `8-notifications.md:349` 죽은 참조나 `SKILL.md` 설명 갭은 그 추가분에 없다(`grep -n "SKILL.md\|census" plan/in-progress/spec-sync-external-interaction-api-gaps.md` 로 확인 — 무관한 매치 2건뿐).
  - 상세: 이 저장소의 확립된 관례(과거 세션 피드백, 5건을 유실할 뻔한 사고 이후 명문화됨)는 "리뷰에서 미룬 항목은 그 턴에 `plan/`에 적어라 — `review/**`/커밋 메시지는 단일 진실(SoT)이 아니다" 이다. 이번 커밋은 정확히 그 반례를 재현한다 — 두 항목(§4.6 죽은 참조, SKILL.md census 설명 누락)의 존재와 "왜 지금 안 고치는지"가 오직 git 커밋 로그에만 남아 있어, 다음에 이 영역을 만지는 사람이 `plan/in-progress/`를 훑어도 이 두 건을 찾을 수 없다. 실측: `grep -rln "scope_delta_census\|census.*SKILL" plan/` 는 구현 자체를 설명하는 `harness-consistency-summary-downgrade-rule.md` 한 곳만 낸다 — "SKILL.md 설명 보강이 필요하다"는 사실 자체를 담은 항목은 없다.
  - 제안: 두 미조치 항목을 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(또는 신설 harness 트래커)에 체크박스로 옮겨 적을 것. 특히 `8-notifications.md:349`의 죽은 §4.6 참조는 2026-05-29 기원의 선재 결함이라 "이번 PR 범위 밖"이라는 판단 자체는 타당하지만, 그 판단이 다음 세션에서 다시 반복 조사되지 않으려면 어딘가에 살아있는 항목으로 남아야 한다.

- **[INFO]** `spec/data-flow/8-notifications.md:349`의 "본 문서 §4.6 follow-up 정합" 인용이 여전히 죽은 참조다.
  - 위치: `spec/data-flow/8-notifications.md` — "3. **본 문서 §4.6 follow-up 정합**: 같은 문서가 multi-device 동기화 follow-up 으로 `notification.read` / `notification.dismissed` (점 표기) 를 명시한다." (해당 문단 자체는 이번 diff 대상 밖의 문맥 줄이라 게이트 번호 없음 — `Read`로 직접 대조)
  - 상세: 같은 문서 190~192행("즉시 사라짐...§4.5" / "이벤트 이름은 §4.5")과 347행("프로토콜 권위: ...§4.5")은 이번 diff 로 §4.4→§4.5 정정됐는데, 바로 두 줄 뒤(349행)의 같은 주제(§4.x follow-up) 인용만 "§4.6"으로 남아 있다. `spec/5-system/6-websocket-protocol.md`를 전수 grep 해도 `notification.read`/`notification.dismissed` 언급은 0건 — 현재 §4.6(시스템 이벤트: `auth.token_expired`/`system.maintenance`)에도, 과거 §4.6(외부 표면 매핑, 이 diff 전 구번호 체계)에도 이 문장이 가리키는 내용은 존재한 적이 없다. 즉 번호 이동에 따른 오인용이 아니라, 애초부터 실재하지 않는 대상을 가리키는 별개 클래스의 결함이다. 커밋 `f3ece1fc6`가 "선재 결함, 범위 밖"으로 명시 판단했으므로 이번 라운드를 막을 이유는 없으나, 판단 자체는 유효하다.
  - 제안: `notification.read`/`notification.dismissed` follow-up 서술을 삭제하거나(미구현·미문서 상태를 인정), §4.5 본문에 실제로 그 내용을 추가하고 앵커를 정확히 잇는 쪽으로 정정.

- **[INFO]** `.claude/skills/consistency-checker/SKILL.md`의 `--impl-done` 설명이 이번 커밋 체인이 신설한 `_scope_delta_census` HEAD 블록을 언급하지 않는다.
  - 위치: `.claude/skills/consistency-checker/SKILL.md` — `--impl-done <scope>` 항목 bullet (파일 내 유일하게 target_doc 구성을 설명하는 자리)
  - 상세: SKILL.md는 `--impl-done`이 target_doc 맨 앞에 "HEAD 워킹트리 절대경로 + CWD 신뢰 금지 가드"(`_head_basis_notice`)를 붙인다고만 설명한다. `consistency_orchestrator.py`의 `collect_context`는 이제 그 바로 뒤에 `_scope_delta_census(root, target_path_rel, _rank_changed, diff_text)` 결과를 추가로 삽입한다 — "이 검토가 실제로 다루는 델타(예산 절단 전 실측)"라는, 절단 여부(diff 가 잘렸는지 vs 아예 없는지)를 가르는 핵심 기능이다. 함수 자체의 docstring 은 재발 이력·실측치가 상세해 코드를 읽는 사람에겐 문제가 없지만, SKILL.md 만으로 `--impl-done` 산출물 구조를 파악하려는 사람(신규 참여자·다른 skill 작성자)은 이 블록의 존재를 알 수 없다.
  - 제안: 해당 bullet에 "target_doc은 scope/diff 델타 실측 census(`_scope_delta_census`)도 head 구역에 포함한다 — 예산 절단 여부 판별용" 한 문장 추가.

## 긍정적으로 확인한 점

- `_count_diff_files`/`_scope_delta_census`(`consistency_orchestrator.py`)는 재발 이력·정량 실측치("15 prompts... 0 times")를 근거로 실은 모범적 docstring을 갖췄고, 신설 `test_consistency_scope_census.py`도 모듈 docstring에서 왜 이 스위트가 필요한지(공허 방지·절단 생존 축 포함)를 정확히 설명한다.
- `chat-channel.dispatcher.ts`/`.spec.ts`/`types.ts`의 SoT 인용에서 썩는 하드코딩 줄 번호(`line 536`/`line 89`)를 제거하고 §번호+마크다운 앵커만 남긴 정정은 "줄 번호로 코드를 인용하면 다음 편집이 조용히 무효화한다"는 이 저장소가 반복적으로 겪은 결함 클래스에 대한 올바른 처방이다. 앵커는 건드리지 않고 표면을 정확히 한정했다.
- `notifications-channel-authorizer.ts`의 클래스 JSDoc 갱신("emit 은 미구현이라 실피해 0" → "이미 구현·배선 완료라 실 트래픽을 막고 있다")은 코드 변경 없이 주석만 갱신했지만 실제 코드 상태(WebsocketService.emitNotificationEvent 배선)와 정확히 일치함을 확인했다 — 오래된 주석이 가드의 중요성을 과소평가하게 만들던 것을 바로잡은 좋은 사례.
- `workflow-assistant.controller.swagger.spec.ts`는 "왜 이 파일이 있나" JSDoc으로 회귀 방지 취지·범위(이 컨트롤러 한정, 저장소 전체 가드는 별도 필요)를 명시하고, 공허(vacuous) 방지용 "[전제]" 테스트까지 갖췄다. 인용한 `swagger.md §2-4` 문구도 실제 spec 본문과 정확히 일치한다.
- `.claude/tests/README.md`에 신설 테스트 카탈로그 엔트리(`test_consistency_scope_census.py`)가 함께 추가돼, 이 저장소의 "신규 테스트는 카탈로그에 즉시 등재" 관례를 유지했다.
- `plan/in-progress/*.md` 다수(cafe24-backlog-residual, node-output-redesign/README, spec-sync-user-profile-gaps, spec-sync-websocket-protocol-gaps, webchat-usewidget-extraction)에 "규모/전제 실측" 블록이 일관되게 추가돼, 착수 전 조사 결과(측정값 표 포함)를 다음 세션이 반복하지 않도록 기록한다 — 이 저장소의 강한 관례가 이번 diff에서도 유지됐다.

## 요약

이번 diff는 harness(consistency-checker) 신규 기능·spec 절번호 재정렬·chat-channel/websocket 주석 정확성 정정·swagger 401 문서화 보강을 모두 포함하는 다중 fix 라운드다. 신규 코드(`_scope_delta_census`, swagger 401 스펙)는 근거가 실린 독스트링과 회귀 테스트를 갖췄고, 여러 plan 문서가 착수 전 실측을 상세히 기록하는 이 저장소의 강한 관례를 유지한다. 다만 이번 라운드가 스스로 발견하고 의도적으로 미룬 두 문서 갭(`8-notifications.md:349`의 죽은 §4.6 참조, `SKILL.md`의 census 설명 누락)이 커밋 메시지에만 남고 어떤 `plan/` 트래커에도 등재되지 않아, "review/**는 SoT가 아니다"라는 이 저장소 자신의 확립된 관례를 위반한다 — 다음 세션이 같은 조사를 반복할 위험이 있다. 두 항목 자체의 위험도는 낮다(코드 동작에 영향 없음, 죽은 참조는 5월부터 존재).

## 위험도

LOW
