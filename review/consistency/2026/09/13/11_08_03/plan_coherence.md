# Plan 정합성 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 개요

이 PR(`guide-error-code-truth`, HEAD=`de99def86`)은 `spec/5-system/**` 를 한 파일도 수정하지
않는다(실측: `git diff --stat origin/main...HEAD -- spec/5-system` 0건). 실제 변경은
`codebase/backend/src/modules/llm/**`·`codebase/backend/src/modules/integrations/**`·
`codebase/frontend/src/content/docs/**`(유저 가이드 MDX)·`codebase/frontend/src/lib/docs/__tests__/**`
(신규 가드 2종)와, `plan/in-progress/guide-error-code-truth.md`(신설)·
`plan/in-progress/spec-draft-nullable-notation-followups.md`(갱신)이다. 따라서 "target=spec/5-system"
관점에서는 새로 내려진 spec 결정이 없고, 검토는 이 PR 이 **다른 plan 의 미해결 항목·후속 항목과
실제로 정합한가**에 집중했다.

`plan/in-progress/guide-error-code-truth.md` 자체는 이미 `--impl-prep`(`01_15_40`, BLOCK:NO)·
`/ai-review` 2라운드(Critical 0)·`--impl-done` 2라운드(`10_12_54`·`10_41_13`, 둘 다 BLOCK:NO)를
거쳤고, spec 쓰기 권한이 없는 developer 트랙답게 spec 편집이 필요한 항목 5건을 planner 등재로
분리했다(3건은 `spec-draft-nullable-notation-followups.md`, 나머지는 그 파일 안에서 기존
`spec-update-node-cancellation-shutdown-classification.md:632`·`keyset-cursor-uuid-validation.md:128`
와 상호 참조). 이 상호 참조는 실측으로 두 파일 모두 해당 줄에 인용된 내용이 실재함을 확인했고,
두 파일 모두 이 브랜치가 건드리지 않아 줄 번호 drift 도 없다.

## 발견사항

- **[WARNING] `user-guide-evidence.md` 후속 등재가 §2.1 관계표만 겨냥, frontmatter `code:` 목록 누락은 안 겨냥**
  - target 위치: (target 자체엔 없음 — 이 항목은 `spec/conventions/user-guide-evidence.md` 프론트매터 `code:` 리스트, target `spec/5-system/**` 밖의 spec 문서)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목
    *"`user-guide-evidence.md §2.1` 관계표에 새 가드 2건이 빠져 있다"* (§본문, `guide-error-code-truth.md` §E 원문과 동일)
  - 상세: 이번 PR 이 `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` ·
    `guide-sanitized-message-parity.test.ts` 두 파일을 신설해 `user-guide-evidence.md` 가 소유하는
    가드 가족에 합류시켰다. 등재 항목은 "§2 가 '가드 3건' 이라 세는 것을 5건으로" · "§2.1 관계표에
    행 추가" 를 명시하지만, **같은 파일 최상단 frontmatter `code:` 배열**(실측: 현재
    `impl-anchor.tsx`·`impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·
    `triggers-coverage.test.ts`·`impl-anchor-parse.ts`·`tree-walk.ts`·`tree-walk.test.ts` 7개 항목만
    있고 신규 2파일 없음)에 대해서는 언급이 없다. 이 배열은
    `spec/conventions/spec-impl-evidence.md` §2 의 build-time 가드(`spec-code-paths.test.ts`)가
    "최소 1개 매치" 만 검사하므로 CI 를 막지는 않지만, 그 spec 이 자기 구현 표면을 서술하는
    SoT 목록이 이 PR 이후로도 불완전한 채 남는다 — planner 가 등재 문구("§2.1 관계표")만 보고
    처리하면 frontmatter 는 그대로 지나칠 수 있다. 이 PR 이 등재문에서 **같은 클래스의 실수를
    한 번 이미 지적**했다("등재를 한 번 좁게 썼다 — 첫 판은 가드 하나만 적어 관계표가 4건으로
    마감될 뻔했다") — 그 자기교정이 §2.1 표에는 적용됐지만 frontmatter 목록에는 적용되지 않았다.
  - 제안: planner 가 이 항목을 집행할 때 `user-guide-evidence.md` frontmatter `code:` 에 두 신규
    테스트 파일 경로를 추가하도록 등재 문구에 한 줄을 보태거나(가장 값싼 수정), 최소한 이 리뷰
    결과를 참고해 집행 시점에 함께 갱신할 것.

- **[INFO] `spec-update-node-cancellation-shutdown-classification.md` §1.2 캐비어트 미인용은 실질 위험 낮음**
  - target 위치: (target 밖) `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목
    *"`3-error-handling.md §1` 카탈로그가 통합·LLM 코드 계열을 통째로 누락한다"*
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:632-645`
  - 상세: 신규 항목이 `OAUTH_STATE_MISMATCH (400) 를 §1.2 에 등재` 라고 원 plan 의 **:632 줄**을
    인용하는데, 바로 아래 **:634-645** 는 "위 §1.2 메인 표 지시는 그대로 집행하면 안 된다 —
    §1.2 메인 표는 400 을 받지 않고(401×5·403×3·423×1), 새 서브섹션 구조 판단이 필요하다" 는
    2026-08-30 실측 캐비어트를 담고 있다. 신규 항목 자체는 이 캐비어트를 재서술하지 않고 줄
    포인터만 남겼다. 다만 줄 번호가 인접(632→634)해 그 plan 파일을 직접 열면 캐비어트가
    바로 이어지므로, 다음 사람이 그 파일을 열지 않고 요약문만 보고 "§1.2 메인 표에 그냥
    추가하면 된다" 고 오판할 위험은 낮다 — 실질 리스크가 낮아 INFO 로 낮춘다.
  - 제안: 별도 조치 불요. planner 턴에서 세 plan(이 항목·`spec-update-node-cancellation-*`·
    `keyset-cursor-uuid-validation.md`)을 묶어 `3-error-handling.md §1` 하위 구조를 재설계할 때
    원본 캐비어트를 반드시 함께 읽을 것(줄 포인터가 이미 그 위치를 가리키고 있음).

## 확인했으나 문제 없음

- 코드 변경(`llm.service.ts` `testConnection` 반환 필드 `error`→`message`)은 `7-llm-client.md §3.4`
  가 "Planned" 로 유보한 `LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND` 세분화와 무관한 별도 계층
  (`LlmService.testConnection` 서비스 래퍼)이라 그 Planned 결정과 충돌하지 않는다. `7-llm-client.md
  §3.1` 의 `LLMClient.testConnection(): Promise<boolean>` 인터페이스도 이 PR 이 건드리지 않았다.
- 유저 가이드 수정분(`models.mdx`·`run-results.mdx`·`error-handling.mdx`)이 인용하는 카테고리별
  코드 표는 `spec/5-system/3-error-handling.md §1.4` 카탈로그와 실측 대조해 불일치가 없다.
- `plan/in-progress/spec-conventions-engine-error-code-surface.md`(EngineErrorCode 병기, 거의
  완료 상태)·`spec-sync-auth-gaps.md`(WebAuthn/LDAP/SAML, `1-auth.md` 의 `pending_plans`) 등
  다른 `spec/5-system/` 관련 진행 중 plan 과는 주제·파일이 겹치지 않아 선행조건 충돌이 없다.
- 새로 등재한 developer 트랙 항목("MCP 전용 응답 필드 3종 미선언 + 계약 검증자 미배선")은
  기존 plan 어디에도 중복 등재가 없다(`IntegrationTestResult`/`ServerCapabilities`/
  `ConnectionPreview` grep 결과 이 PR 문서 두 개뿐).

## 요약

target(`spec/5-system/**`)에는 이번 PR 이 만든 신규 결정이 없어 "미해결 결정 우회" 유형의
충돌은 없다. 이 PR 이 실제로 남긴 것은 developer 트랙에서 planner 트랙으로 넘기는 5건의 후속
등재이며, 그중 4건은 상호 참조·실측까지 갖춰 정합하다. 유일한 실질적 갭은 `user-guide-evidence.md`
후속 등재가 산문(§2 개수)과 §2.1 관계표는 겨냥했지만 같은 파일의 frontmatter `code:` 목록 갱신은
누락했다는 점으로, build-time 가드를 깨지 않는 낮은 심각도의 완결성 결함이다. 그 외에는 다른
in-progress plan 의 미해결 사전조건을 침해하거나 후속 항목을 무효화하는 지점을 찾지 못했다.

## 위험도

LOW
