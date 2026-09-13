# Plan 정합성 검토 — `spec/5-system/` (--impl-done, diff-base=origin/main, 라운드 4)

## 개요

`spec/5-system/**` 델타는 이번에도 0(실측: `git diff origin/main --stat -- spec/5-system` 무출력) —
이 PR(`guide-error-code-truth`, HEAD=`137784219`)은 유저 가이드 MDX(`content/docs/**`)·
`LlmService.testConnection` 계약·신규 build-time 가드(`guide-error-code-*`,
`guide-sanitized-message-parity`)·두 plan 트래커(`guide-error-code-truth.md`,
`spec-draft-nullable-notation-followups.md`)만 건드렸다. 따라서 검토는 이 라운드가 이전
plan_coherence 라운드(`10_12_54`→`10_41_13`→`11_08_03`)의 결과를 실제로 반영했는지, 그리고
라운드 3 수정(`137784219`, 커밋 메시지 "리뷰 라운드 3")이 새로 만든 등재 2건이 다른 plan 과
충돌·중복·누락을 내지 않는지에 집중했다.

## 이전 라운드 대비 델타 확인

- **`11_08_03` 가 낸 유일한 WARNING**("`user-guide-evidence.md` 후속 등재가 §2.1 관계표만
  겨냥, frontmatter `code:` 목록 누락은 안 겨냥")이 이번 라운드에서 실제로 해소됐다. 실측:
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 항목에
  "**같은 파일의 frontmatter `code:` 목록도 갱신 대상이다** — 현재 7개 경로가 있고 신규
  3파일이 빠져 있다: `guide-error-code-scan.ts`·`guide-error-code-existence.test.ts`·
  `guide-sanitized-message-parity.test.ts`" 문장이 추가됐다. `spec/conventions/
  user-guide-evidence.md` 현재 frontmatter `code:` 를 직접 열어 대조하니 정확히 7개 경로가
  있고(신규 3파일 미포함) — 등재 문구의 "7개" 주장과 baseline 이 일치한다.
- 같은 라운드의 INFO(§1.2 캐비어트 줄 포인터 미인용)는 checker 자신이 "실질 리스크 낮음,
  별도 조치 불요" 로 판정했고 이번 라운드에서도 해당 절은 변경되지 않아 상태 그대로다(추가
  악화 없음).

## 라운드 3 수정이 새로 만든 등재 2건 검토

`137784219` 는 `/ai-review`(`11_07_36`) 지적을 반영하며 plan 등재를 2건 추가했다
(`spec-draft-nullable-notation-followups.md`):

1. "가이드 에러 코드 가드가 한 방향만 본다 — '코드 → 가이드' 누락은 못 잡는다" (developer 등재)
2. "선언은 있는데 결코 발행되지 않는 '유령 필드' 를 잡는 자동 가드가 없다" (developer 등재)

확인한 사항:

- **중복 없음**: `유령 필드`·`assertMatchesContract`·`param-uuid-pipe`·`가이드 에러 코드`·
  `guide-error-code` 를 `plan/in-progress/` 전체에서 grep 한 결과 이 항목들을 언급하는 파일은
  `guide-error-code-truth.md` 자신과 `spec-draft-nullable-notation-followups.md` 뿐이다 — 다른
  in-progress plan 에 같은 항목이 이미 등재돼 있어 두 번 만드는 경우는 없다.
- **선행 plan 미해소 없음**: 두 항목 모두 "선실측할 것" 캐비어트를 스스로 달아 두어(가드
  설계 전 앵커 존재 여부 확인 등) 착수 조건이 명시돼 있고, 이 항목들이 가정하는 사전 조건
  (§D 의 가드 가족 합류 결정, `assertMatchesContract` 배선)은 이미 이 PR 자신이 충족했다.
- **미해결 결정과의 충돌 없음**: §D 의 "탈출구를 만들지 않는다"(Planned 로드맵 이름에
  허용목록을 두지 않는다) 결정과 새 역방향 가드 항목은 서로 다른 축(가이드→코드 vs
  코드→가이드)이라 충돌하지 않는다.
- `plan/in-progress/guide-error-code-truth.md` 의 "체크리스트" §E 줄("planner 항목 3건 등재")은
  §E 절 자체가 등재한 3건만 지칭하는 표현이고, 이후 §G·§I 가 별도로 등재한 developer 트랙
  항목(MCP 필드 3종·역방향 가드·유령 필드)까지 "3건" 에 포함시키는 서술이 아니므로 stale
  claim 은 아니다.

## 다른 in-progress plan 과의 접점 재확인

- `spec-sync-auth-gaps.md`(`1-auth.md` frontmatter `pending_plans`) — WebAuthn/LDAP/SAML 축이라
  이 PR 의 LLM/통합 테스트 계약과 파일·주제 겹침 없음.
- `spec-conventions-engine-error-code-surface.md` — `EngineErrorCode` JSDoc 이분법 프레이밍
  잔여 1건뿐이고 `error-codes.ts` 의 서술 방식 문제라 이 PR 의 대상(가이드 MDX·testConnection
  DTO·frontend 가드)과 파일이 겹치지 않는다.
- `keyset-cursor-uuid-validation.md`·`spec-update-node-cancellation-shutdown-classification.md` —
  `10_41_13` 라운드에서 이미 파일·줄 단위로 상호 참조가 걸렸고 이번 라운드까지 두 파일 모두
  변경되지 않아 인용 drift 없음(재확인: 두 파일 모두 이 브랜치의 diff 대상 아님).

## 요약

이전 두 라운드(`10_41_13` NONE, `11_08_03` LOW·WARNING 1)가 수렴 추세였고, 이번 라운드는 그
유일한 WARNING(frontmatter `code:` 목록 누락)이 실제로 고쳐졌음을 실측으로 확인했다. 라운드 3
수정이 새로 등재한 developer 트랙 항목 2건도 중복·선행조건 미해소·기존 결정 충돌 없이
정합하다. `spec/5-system/**` 자체는 이번에도 델타 0 이라 "미해결 결정 우회" 유형의 충돌 소지가
없다. plan 정합성 관점에서 이 라운드는 추가 조치 없이 수렴한다.

## 위험도

NONE
