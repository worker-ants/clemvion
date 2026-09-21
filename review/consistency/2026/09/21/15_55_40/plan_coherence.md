# Plan 정합성 검토 — `spec/2-navigation` (impl-done, `authconfig-dup-delete`)

## 검토 배경

이번 PR 의 `spec/2-navigation` 델타는 0(스코프 정의상 정상)이고, 실제 변경은
`codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (동시 삭제 시
`auth_config.delete` 감사가 두 번 남는 결함을 원자적 `delete()` 의 `affected===0` 로
닫음) + `plan/in-progress/authconfig-dup-delete.md`(신규) + 트래커
`plan/in-progress/spec-draft-nullable-notation-followups.md` 정정이다. 프롬프트 번들의
`## 구현 변경 사항` diff 는 예산에 잘려 보이지 않았으므로, 워킹트리를 절대경로로 직접
읽어(`git diff origin/main...HEAD`, 관련 plan 파일 실측) 판정했다.

## 발견사항

- **[INFO]** `authconfig-dup-delete.md` 체크리스트의 `/ai-review → 수렴` 이 미체크 상태로 남아 있음
  - target 위치: `plan/in-progress/authconfig-dup-delete.md` 하단 `## 체크리스트`, `- [ ] /ai-review → 수렴`
  - 관련 plan: 동일 plan 자신 + `review/code/2026/09/21/15_45_04/RESOLUTION.md`
  - 상세: 실제로는 `/ai-review` 라운드 2(`review/code/2026/09/21/15_45_04`)가 이미 **Critical 0 · Warning 0** 로 수렴했고(커밋 `d4c45f8a4` "auth-configs 리뷰 라운드 2 수렴"), 그 직전 라운드(`15_18_16`)의 Warning 1 도 `de5ac569c` 커밋에서 RESOLUTION 으로 처리됐다. 그런데 plan 본문의 체크박스는 아직 `[ ]`(미완료)로 남아 실제 상태와 어긋난다. 이 자체가 다른 plan 과 충돌하거나 후속 항목을 무효화하진 않지만, 이 세션이 여기서 중단되면 다음 사람이 "리뷰가 아직 안 끝났다"고 오판할 수 있다.
  - 제안: 이번 `--impl-done` 검토(본 리포트)가 통과하면, 같은 턴에서 `/ai-review → 수렴` 체크박스도 함께 갱신해 실제 상태와 동기화할 것 (사용자 메모 관례: "체크박스 = 실제 상태").

- **[INFO]** 트래커 종결 항목 2건은 아직 열려 있음 — 계획대로 진행 중이며 결함 아님
  - target 위치: `plan/in-progress/spec-sync-auth-gaps.md:215` (`동시 삭제 중복 감사 (W7, 기존 auth-configs 패턴과 함께)`), `plan/in-progress/spec-draft-nullable-notation-followups.md:4917` (`AuthConfigsService.remove() 도 동시 삭제에서 감사 행을 두 번 남긴다 — 일곱 번째`)
  - 관련 plan: `plan/in-progress/authconfig-dup-delete.md` 체크리스트 W2 처리 메모("종결 단계에서 함께 해소한다")
  - 상세: 두 트래커 항목 모두 여전히 `[ ]` 다. `authconfig-dup-delete.md` 는 이를 명시적으로 "종결 단계"(마지막 체크리스트 항목 `트래커 항목 해소 + plan/complete/ 로`)로 미뤄뒀고, 그 항목도 아직 미완료라 순서상 정합하다 — 결함이 아니라 진행 중 상태의 정상적인 스냅샷이다.
  - 제안: `plan/complete/` 이동 시 이 두 트래커 라인을 `[x]` 로 함께 닫을 것 (plan 자신이 이미 그렇게 계획하고 있음 — 별도 조치 불요, 확인 메모만 남김).

## 확인한 정합성 (문제 없음)

- **선행 plan 해소 확인**: 이번 처방("무락 → 원자적 `delete()` + `affected===0` 판정")이 의존하는 "형제" 패턴 — `plan/complete/{trigger,integration,schedule,member}-dup-delete.md`(및 `member-dup-remove.md`) — 이 모두 `plan/complete/` 에 실재하며 완료 상태다. 선행 plan 미해소는 없다.
- **미해결 결정 우회 없음**: `AuthConfigsService.remove()` 관련 "결정 필요" 항목은 트래커에 없고, 처방 자체가 이미 트래커에 완전히 서술돼 있던 것을 그대로 구현했다. "사용처 검사(트리거 참조 중 삭제 차단) 부재"는 이 PR 이 만든 문제가 아니라고 명시적으로 범위를 좁혔고(`## 이 PR 이 하지 않는 것`), 이를 뒤집는 별도 pending 결정도 발견되지 않았다.
- **후속 항목 반영 확인**: 같은 diff 안에서 트래커의 "삭제 엔드포인트 spec 들에 「동시 삭제 → 두 번째 404」 서술이 없다" 항목을 일반화하며 `6-config.md §A (DELETE /api/auth-configs/:id)` 를 대상 목록에 새로 추가했다 — 이번 코드 변경이 만든 문서 갭을 후속 추적에 정확히 반영했다.
- **부수 정정 반영 확인**: `#1373` 이 잘못 등재했던 "`workspaces.controller.ts` 에 `RolesGuard` 가 없다"는 근거를 이번 PR 이 실측으로 정정(`RolesGuard` 는 전역 `APP_GUARD`)하고, 그 결과 새로 드러난 "17개 중 13개 라우트가 멤버십 가드 커버리지 밖"이라는 사실을 완료된 `auth-workspace-membership-guard.md`(모집단 다름 — 구성상 이 13개를 포함하지 않음)와 충돌시키지 않고 별도 미해결 항목으로 정확히 남겼다(취소선 처리 없이 `[ ]` 유지).
- **모델-config/webauthn(8·9번째) 미충돌**: 트래커에 별도 `[ ]` 항목으로 남아 있고, 이번 plan 은 "각각 별 PR" 이라고만 언급해 선점·중복 결정 없이 트래커 상태를 그대로 유지했다.
- **`spec_impact: none`**: 실제로 `spec/**` 파일은 diff 에 없고 `plan/**` 만 변경돼 frontmatter 와 일치한다.

## 요약

이번 PR 은 `spec/2-navigation` 을 직접 변경하지 않는 코드 전용 변경이며, 의존하는 5개 선행 plan(형제 dup-delete 계열)은 모두 `plan/complete/` 에 실재하는 완료 상태라 전제 미해소 문제가 없다. 미해결 결정을 우회하는 대목도 발견되지 않았고, 코드 변경이 만든 문서 갭(`6-config.md §A`)과 리뷰 중 드러난 부수 결함(RolesGuard 커버리지 갭)도 모두 같은 diff 안에서 트래커에 정확히 반영됐다. 유일하게 눈에 띄는 것은 plan 자체의 체크리스트가 이미 완료된 `/ai-review` 라운드 2 수렴을 아직 미체크로 남긴 사소한 동기화 지연이며, 이는 이번 `--impl-done` 검토 직후 같은 턴에서 정리하면 되는 수준이다.

## 위험도

NONE
