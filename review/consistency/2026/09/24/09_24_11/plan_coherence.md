# Plan 정합성 검토 — spec/5-system (--impl-done, member-owner-toctou)

## 검토 대상

- Target: `spec/5-system` — scope 델타 0 (정상, 코드 전용 PR). 실질 변경은
  `codebase/backend/src/modules/workspaces/workspaces.service.ts` 등 5개 파일 437줄과
  이를 서술하는 `plan/in-progress/member-owner-toctou.md`.
- 소스 트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
  "`removeMember()` 의 owner 보호 가드가 TOCTOU 로 뚫린다 — 실측 확인됨"(현재 파일 기준 L4917).
- 선행 검토: 같은 target 에 대한 `--impl-prep` 단계 plan_coherence
  (`review/consistency/2026/09/24/07_29_15/plan_coherence.md`)가 이미 위험도 NONE 으로
  판정했다. 본 검토는 그 이후 실제 구현 + `/ai-review` 3라운드가 코드/plan/CHANGELOG 를
  바꾼 것이 새 정합성 문제를 만들지 않았는지 재확인한다.

## 발견사항

- **[INFO]** plan 체크리스트가 이미 완료된 3라운드 리뷰를 반영하지 못하고 있다
  - target 위치: 해당 없음(target `spec/5-system` 자체는 무변경)
  - 관련 plan: `plan/in-progress/member-owner-toctou.md` §체크리스트 — `- [ ] 3라운드 — 2라운드
    fix 가 코드를 바꿨으므로 fresh 리뷰가 필요하다` / `- [ ] /consistency-check --impl-done
    spec/5-system → BLOCK: NO` / `- [ ] 트래커 항목 해소 + plan complete/ 로`
  - 상세: HEAD(`09682d7b8`) 시점에 `/ai-review` 3라운드(`review/code/2026/09/24/09_10_41`,
    Critical 0 · Warning 2)가 이미 실행·수렴했고 그 결과로 `CHANGELOG.md` 정정 커밋까지
    올라가 있는데, 같은 HEAD 의 plan 파일은 여전히 3라운드를 "필요함"으로, 본 `--impl-done`
    체크와 트래커 해소·`complete/` 이동을 미완료(`[ ]`)로 적고 있다. 체크리스트 자체가
    거짓 서술은 아니다(다음 커밋에서 갱신 예정으로 읽을 수 있다) — 다만 이 검토가 끝나는
    시점에 plan 을 갱신하지 않고 그대로 두면 실제 상태(3라운드 수렴·CHANGELOG 정정 완료)와
    plan 서술이 어긋난 채 남는다.
  - 제안: 본 `--impl-done` 결과(BLOCK: NO)를 받은 뒤, 같은 커밋에서 (1) 위 세 체크박스를
    체크하고 (2) 트래커 L4917 항목을 해소 처리하고 (3) `member-owner-toctou.md` 를
    `plan/complete/` 로 이동한다 — plan 이 이미 예고한 "한 커밋으로" 원칙 그대로.

## 교차 검증 (문제 없음을 확인한 항목)

1. **미해결 결정과의 충돌 (없음)**: 트래커의 인접 미해결 항목 "`removeMember()` 의 권한
   검사 순서 오라클"(L4871)이 서술하는 조회 순서(존재→self 위임→owner 403→admin 403)를
   실제 코드(`workspaces.service.ts:797-834`, HEAD 기준)에서 재확인했다 — `assertAdmin` 은
   여전히 owner 이른 가드 **뒤**에 있고, 이 PR 은 그 순서를 바꾸지 않는다. plan §F 가 이
   경계를 명시적으로 그었고, `/ai-review` 3라운드(security 리뷰어, `09_10_41`)도 독립적으로
   "이번 diff 가 만든 결함이 아니고 이미 정확한 블라스트 반경으로 별도 트래커에 등재돼
   있다"고 재확인했다 — 3라운드 연속 같은 판정으로 결정 충돌 없음.
2. **선행 plan 미해소 (없음)**: `transferOwnership` 이 대상 행에 `pessimistic_write` 를
   쥔다는 전제, 그리고 형제 아홉 자리의 무락 원자적 DELETE 패턴이 모두 `plan/complete/`
   로 닫혀 있다는 전제는 `--impl-prep` 단계에서 이미 검증됐고, 구현 이후에도 코드
   (`Not('owner')` 술어 + EvalPlanQual 재평가)와 e2e 재현(RED→GREEN)으로 실측 확인됐다.
3. **후속 항목 누락 (없음)**: `--impl-prep` WARNING 4건이 요구한 후속 조치 3건이 트래커에
   정확히 등재돼 있음을 직접 확인했다 — (a) `removeMember` owner 보호 메커니즘을
   `data-flow/12-workspace.md` 에 명문화(planner, L4967) (b) `CANNOT_REMOVE_OWNER` 등
   3개 에러 코드의 중앙 카탈로그 미등재(planner) (c) `1-auth.md` §3.2 각주로 인한 표 분절
   (planner). 코드 리뷰 3라운드가 추가로 낸 조치 요구(재진입 보일러플레이트 복제 임계값)도
   트래커에 등재돼 있다. `spec/data-flow/12-workspace.md` L141/188/189 인용 라인도 현재
   문서와 실측 대조해 드리프트 없음을 확인했다.
4. `spec_impact: none` (bare) 표기는 Gate C 요구 형식과 일치하고, target `spec/5-system`
   의 기존 서술(§3.2 "대상이 Owner 인 경우 거부된다")과 이 PR 의 처방(같은 문장을
   동시성 하에서도 참으로 만듦, 메커니즘 미규정)이 충돌하지 않는다는 `--impl-prep` 판단이
   구현 이후에도 그대로 유지된다.

## 요약

target(`spec/5-system`)은 이번 diff 로 변경되지 않았고, 실질 정합성 검토는 이를 반영하는
`plan/in-progress/member-owner-toctou.md`와 소스 트래커
(`spec-draft-nullable-notation-followups.md`) 사이에서 이뤄진다. 구현·3라운드
`/ai-review`·CHANGELOG 정정을 거친 뒤에도 이 PR 이 명시적으로 유예한 인접 미해결 결정
(권한 검사 순서 오라클)과 충돌하지 않고, 전제로 삼은 선행 plan(형제 아홉 자리)은 모두
해소돼 있으며, `--impl-prep` 이 요구한 후속 planner/developer 항목 전부가 트래커에
정확히 등재돼 있음을 재확인했다. 유일한 지적은 plan 자체의 체크리스트가 이미 수렴한
3라운드 결과를 아직 반영하지 않은 것으로, 차단 사유가 아니라 마무리 커밋에서
`complete/` 이동과 함께 정리할 부기 사항이다.

## 위험도

NONE
