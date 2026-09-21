# Plan 정합성 검토 — spec/2-navigation (--impl-done, member-dup-remove)

## 발견사항

- **[INFO]** `member-dup-remove.md` 체크리스트의 「`/ai-review` → 수렴」 항목이 실제 수렴 이후에도 미체크(`- [ ]`) 상태
  - target 위치: 해당 항목은 spec/2-navigation 본문이 아니라 `plan/in-progress/member-dup-remove.md` 하단 `## 체크리스트`의
    "`/ai-review` → 수렴" 줄
  - 관련 plan: 같은 파일. 근거는 `review/code/2026/09/21/13_53_04/RESOLUTION.md`("이 라운드로 수렴했다" — 전체 위험도
    LOW, Critical 0, `codebase/**` 무수정 라운드로 정지 규칙 발화)
  - 상세: 라운드 3(`13_53_04`) 결과가 이미 수렴을 선언했고, 그 직후 커밋(`8bc16118f`, "리뷰 라운드 3 수렴")이
    `member-dup-remove.md` §C의 인라인 체크박스 모순(라운드 3 WARNING #2)을 고쳤음에도 하단 `## 체크리스트`의
    "`/ai-review` → 수렴" 줄 자체는 그대로 미체크로 남아 있다. 차단 사유는 아니지만 "체크박스 = 실제 상태"
    원칙에서 한 칸 벗어나 있다.
  - 제안: `plan/complete/`로 옮기기 직전 마무리 커밋에서 이 줄을 `- [x]`로 갱신(근거로 라운드 3 SUMMARY/RESOLUTION
    경로를 덧붙이면 추적성이 좋아진다).

## 점검한 항목 (문제 없음으로 확인)

1. **미해결 결정과의 충돌** — 없음. 이 PR의 diff(`workspaces.service.ts`/`.spec.ts`,
   `member-remove-concurrency.e2e-spec.ts`)는 spec 파일을 전혀 건드리지 않으며(`spec_impact: none`, 실측 확인),
   트래커(`spec-draft-nullable-notation-followups.md`)가 "결정 필요"로 열어 둔 세 항목 — ① 컨트롤러 200 vs
   204(planner 소유) ② `removeMember()` 권한 검사 순서/존재 오라클(별 PR로 유예, 에러코드 계약 변경이 필요하다는
   이유가 명시됨) ③ owner 승격 TOCTOU(별도 판별자 오염 문제로 명시적 유예) — 를 이 PR이 조용히 대신 결정하지
   않았다. 코드 주석과 plan 본문(§C)이 이 세 갈래를 "이번 PR이 닫지 않는 이유"까지 함께 적어 뒀다.

2. **선행 plan 미해소** — 없음. 이 처방(원자적 `delete` + `affected === 0` 판정)이 전제하는 선행 사례
   `plan/complete/integration-dup-delete.md`(#1372, 락 없는 자리의 동일 패턴)는 이미 완료돼 있다. 자가 탈퇴
   위임 대상인 `leaveWorkspace()`가 이미 트랜잭션 내 `pessimistic_write`로 닫혀 있음도 이번 PR이 e2e로
   직접 실증했다(추정에 의존하지 않음).

3. **후속 항목 누락** — 없음. `--impl-prep`(`review/consistency/2026/09/21/12_23_48`)이 지적한 WARNING —
   "`9-user-profile.md:378`(멤버 제거 DELETE)이 「동시 삭제 → 두 번째 404」 문서 부채 목록에서 빠졌다" — 는
   이 PR의 트래커 커밋에서 "2026-09-21 재확장 (3)"으로 `9-user-profile.md §6.1` + `data-flow/12-workspace.md §1.6`을
   추가해 그 자리에서 해소됐다(`plan/in-progress/spec-draft-nullable-notation-followups.md` 해당 항목 확인).
   남는 세 자리(`auth-configs.service.ts` #7 · `model-config.service.ts` #8 · `webauthn.service.ts` #9)와
   신규 e2e 파일(`member-remove-concurrency.e2e-spec.ts`)이 아직 어느 spec의 `code:` frontmatter에도
   없다는 사실도 별도 planner 항목으로 이미 등재돼 있다(등재 시점에 이름 패턴을 고정하지 말라는 자기 교정까지
   포함) — 이번 PR이 새로 만들어야 할 후속 항목 중 빠진 것은 없다.

## 요약

이번 세션(`member-dup-remove`)이 구현한 `WorkspacesService.removeMember()` 동시-삭제 감사 중복 수정은
spec/2-navigation 자체에 델타가 없고(코드 전용 변경), 트래커(`spec-draft-nullable-notation-followups.md`)가
열어 둔 미해결 결정들(컨트롤러 200/204, 권한 검사 순서, owner TOCTOU)을 우회하지 않았으며, 그 결정들을 별도
항목으로 명시적으로 유예한 근거까지 plan에 남겼다. `--impl-prep` 단계에서 지적된 유일한 WARNING(9-user-profile.md
문서 부채 누락)은 이 PR의 트래커 커밋에서 이미 해소됐고, 남는 세 자리(auth-configs/model-config/webauthn)와
새 e2e 파일의 spec 등재 공백도 별도 planner 항목으로 등재돼 후속 누락이 없다. 유일하게 눈에 띄는 것은
plan 자체의 하단 체크리스트 한 줄("`/ai-review` → 수렴")이 실제 수렴(라운드 3 LOW·Critical 0) 이후에도
미체크로 남아 있다는 사소한 문서 위생 문제뿐이며, 이는 `plan/complete/` 이관 전 마무리 커밋에서 갱신하면
충분하다.

## 위험도

NONE
