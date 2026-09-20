# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 트래커의 「해소」 표기가 아직 존재하지 않는 `plan/complete/` 경로를 인용하고, 정작 그 plan 자신의 완료 체크리스트는 끝나지 않았다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4960` (그리고 체크박스 자체는 4953행 `- [x] **\`schedule-trigger\` e2e 「D. PATCH cron → nextRunAt 재계산」이...**`)
  - 상세: 4960~4962행이 새로 추가한 문장은 "**2026-09-20 해소** `plan/complete/schedule-cron-flake.md` — 생성 cron 을 연 1회로 바꾸고 판정을 «새 cron 이 만드는 값인가»로 옮겼다. ... 뮤턴트(서비스의 재계산 블록 삭제) RED." 다. 그런데 실제로 확인하면(`ls plan/complete/schedule-cron-flake.md` → No such file or directory) 그 plan 은 아직 `plan/in-progress/schedule-cron-flake.md` 에 있고, 그 plan 자체의 "## 체크리스트" 는 `- [ ] \`/ai-review\` 수렴`, `- [ ] \`--impl-done\``, `- [ ] 트래커 해소 · 이 plan \`plan/complete/\` 로` 세 항목이 아직 미완이다(지금 이 리뷰 세션이 바로 그 미완 항목 중 하나를 처리하는 중이다). 즉 트래커는 "해소됨" 이라고 과거형으로 단언하며 존재하지 않는 최종 경로를 가리키는데, 그 최종 경로로의 이동은 아직 일어나지 않은 미래 사건이다.
  - 이 저장소 자신의 선례가 이 형태를 반증 기준으로 세워 둔다 — 같은 트래커 파일의 기존 "✅ ... 해소 — ... `plan/complete/<name>.md`" 패턴(예: 2106·2188·2294·2324행)은 모두 인용 시점에 이미 `plan/complete/` 로 실제 이동이 끝난 뒤에 적혔다(`ls plan/complete/trigger-config-lost-update.md`, `plan/complete/spec-draft-chat-channel-drift-3.md`, `plan/complete/impl-details-code-wiring.md` 모두 실재 확인). 이번 항목만 그 순서를 어겨 "이동 전에 이동 후 경로를 인용"한다. `spec/conventions/review-citations.md` 가 경고하는 "잘못 채운 경로는 bare 인용보다 나쁘다"와 같은 결의 실패 형태 — 지금 이 링크를 클릭하는 다음 사람은 파일이 없는 것을 보고 오히려 "해소가 취소됐나" 혼란을 겪는다.
  - 제안: `--impl-done` 통과 + 실제 `git mv plan/in-progress/schedule-cron-flake.md plan/complete/schedule-cron-flake.md` 가 끝난 **다음에** 이 트래커 문장을 추가하거나 커밋한다. 지금 상태로 이 문장을 먼저 커밋해야 한다면 시제를 "해소 (진행 중, PR 병합 후 `plan/complete/` 로 이동 예정)"로 낮추거나, 경로를 현재 실재하는 `plan/in-progress/schedule-cron-flake.md` 로 정정한다.

- **[INFO]** `--impl-prep` 이 찾은 pre-existing WARNING(`NAV-WF-02`)을 "planner 항목으로 등재한다"고 적었지만, 실제 등재된 자리가 확인되지 않는다
  - 위치: `plan/in-progress/schedule-cron-flake.md:51` (`... 은 이 작업과 무관한 기존 불일치 — planner 항목으로 등재한다`)
  - 상세: `review/consistency/2026/09/20/11_21_16/{SUMMARY.md,cross_spec.md}` 에는 `NAV-WF-02`(요구사항 카탈로그 상태 불일치) WARNING 원문과 "별도 planner 백로그" 제안이 있지만, `plan/in-progress/spec-draft-nullable-notation-followups.md`(이 저장소의 실질적 planner 트래커, 이번 diff 에도 포함됨)나 다른 `plan/in-progress/*.md` 어디에도 `NAV-WF-02` 문자열로 된 등재 항목을 찾지 못했다(`grep -rn "NAV-WF-02" plan/in-progress/` → `schedule-cron-flake.md:51` 자기 자신만 일치). "등재한다"는 현재형/예정 서술이라 아직 안 됐어도 틀린 진술은 아니지만, 위 WARNING 과 같은 패턴(완료를 앞서 단언)으로 굳어질 위험이 있다.
  - 제안: 이 작업을 `plan/complete/` 로 옮기기 전에 실제 planner 트래커(`spec-draft-nullable-notation-followups.md` 등)에 `NAV-WF-02` 항목을 넣었는지 확인하고, 안 됐다면 지금 넣거나 체크리스트 문구를 "등재 예정"으로 남긴다.

- **[INFO]** 모듈 최상단 JSDoc 이 「D. PATCH cron」 케이스의 flake 이력·비교 방식 변경(1라운드 개정)을 언급하지 않는다 (1라운드 문서화 리뷰 `review/code/2026/09/20/11_54_10/documentation.md` INFO 2 재확인, 조치 불요로 이미 처분됨)
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 파일 최상단 JSDoc (16~30행)
  - 상세: 케이스 앞의 개별 JSDoc(283~292행)이 맥락을 이미 충분히 담고 있어 필수는 아니다. 1라운드에서 이미 "조치 불필요"로 처분됐고 이번 라운드에서 코드가 더 바뀌지 않았으므로 재확인만 하고 새 조치는 제안하지 않는다.

## 확인했으나 문제 없음

- 「실측」 인용 정확성 (1라운드 WARNING 3 / W3) — **고침 확인.** `schedule-trigger.e2e-spec.ts:287` JSDoc 과 `plan/in-progress/schedule-cron-flake.md:21-22` 모두 이제 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 항목과 `review/code/2026/09/20/09_35_16/RESOLUTION.md`(직접 열어 확인 — 27행에 `_test_logs/e2e-20260920-095855.log`·09:59 KST·10:02 KST 재실행 366 통과 실측이 실제로 있다)를 가리킨다. 더 이상 근거 없는 문서(`plan/complete/ssrf-catch-instanceof.md`)를 인용하지 않는다.
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` 283~326행의 JSDoc·인라인 주석은 코드와 정확히 일치한다 — cron 리터럴(`0 0 1 1 *`), 시각창 상수(`-30_000`/`+90_000`), `getUTCSeconds() === 0` 단언 모두 주석이 설명하는 그대로다. 「달라졌다」 단언이 실제로 빠져 있음도 코드에서 직접 확인.
- `plan/in-progress/schedule-cron-flake.md` 본문(무엇이 문제인가/무엇이 잘못된 비교인가/할 것/비대상/테스트)은 diff 내용과 정확히 대응한다.
- README·API 문서·CHANGELOG·환경변수 문서·예제 코드: 이번 변경은 e2e 테스트 파일의 비교식·cron 리터럴 + 두 plan/tracker 문서 갱신뿐이라 해당 없음(서비스 코드·API 계약·설정 변경 없음).
- `review/code/2026/09/20/11_54_10/*`·`review/consistency/2026/09/20/11_21_16/*`는 워크플로가 그 시점 상태를 기록한 산출물이며, 그 자체가 "산 문서"로 유지보수되는 대상이 아니다(`spec/conventions/review-citations.md` §3가 인용 규약 적용 대상에서 제외). 내용 자체(1라운드 SUMMARY·RESOLUTION 조치표)를 대조해 봐도 실제 커밋(`a8ddcfb32`)의 diff와 일치한다.

## 요약

핵심 코드(`schedule-trigger.e2e-spec.ts`)의 JSDoc·인라인 주석은 코드와 정확히 일치하고, 1라운드에서 지적된 「실측」 오인용(W3)도 실제로 올바른 근거로 정정됐다 — 재확인 결과 문제없음. 다만 그 정정 작업 자체가 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 새로 추가한 "해소" 문장이 아직 존재하지 않는 `plan/complete/schedule-cron-flake.md` 경로를 인용하고 있다 — 그 plan 자신의 체크리스트(`/ai-review` 수렴·`--impl-done`·`plan/complete/` 이동)가 아직 끝나지 않은 상태에서 완료를 앞서 단언한 형태이며, 이 저장소의 기존 "해소" 표기 선례(모두 실제 이동 후에 적힘) 및 `review-citations.md`의 "잘못 채운 경로 > bare 인용" 경고와 정확히 같은 실패 형태다. README/API/CHANGELOG/설정 문서 갱신은 이번 변경 범위에 해당하지 않는다.

## 위험도

LOW
