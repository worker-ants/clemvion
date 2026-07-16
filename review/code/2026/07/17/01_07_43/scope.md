# 변경 범위(Scope) Review

대상 PR: 사용자 가이드(`/docs`) 사이드바 진입 시 `/w/<slug>` 무한 중첩 라우팅 fix
(`plan/in-progress/user-guide-routing-loop-fix.md`)

## 발견사항

- **[WARNING]** 이번 라우팅 버그 fix 와 무관한 파일(`plan/complete/ai-agent-tool-payload-budget-followups.md`)의 frontmatter 수정이 같은 브랜치에 포함됨
  - 위치: `plan/complete/ai-agent-tool-payload-budget-followups.md` (커밋 `89c4b1f6b`)
  - 상세: 이 파일은 AI Agent 도구 payload 예산 가드레일(PR #955·#956) 작업의 완료 plan 이며, 이번 작업(사용자 가이드 slug 라우팅)과 도메인·코드 영역이 전혀 겹치지 않는다. 변경 내용은 `status: complete` + `spec_impact` frontmatter 4개 항목 추가로, main 에서 이미 깨져 있던 Gate C(`spec-plan-completion.test.ts`) 실패를 보정하는 것이다. 커밋 메시지 자체가 "본 PR 과 무관하나 ... 함께 조치한다"고 명시하고 있어, 작성자도 범위 밖 변경임을 인지하고 있다.
  - 근거: `developer` SKILL §ISSUE FIX(기존부터 있던 이슈도 발견 시 조치)를 원용해 정당화했고, 별도의 원자적 커밋(`89c4b1f6b`)으로 분리되어 있으며 diff 도 8줄 frontmatter 추가에 불과해 리뷰 난이도나 회귀 위험은 낮다. 다만 "변경 범위(Scope)" 관점에서는 여전히 **이번 PR 의 의도(라우팅 버그 수정)를 벗어난 별개 관심사**이며, 커밋 메시지의 "TEST WORKFLOW unit 단계를 막아 함께 조치" 근거는 로컬 게이트 통과를 위한 편의적 해결로, 원칙적으로는 별도 PR 로 분리하는 편이 이력 추적과 리뷰 대상 명확성 면에서 더 낫다.
  - 제안: 컨벤션상 허용된 예외(ISSUE FIX)이므로 차단 사유는 아니나, 가능하면 이 frontmatter 보정을 별도의 소규모 PR 로 분리해 "사용자 가이드 라우팅 fix" PR 의 diff 를 라우팅 버그 관련 8개 파일 중 7개(plan 신규 파일 포함)로만 좁히는 것을 권장. 최소한 PR 설명/커밋 로그에 "본 PR 과 무관한 drive-by fix" 임을 명시해 리뷰어가 diff 스캔 시 혼동하지 않도록 한다(이미 커밋 메시지에는 명시되어 있음 — 이 점은 양호).

## 관점별 점검 결과

1. **의도 이상의 변경**: 위 WARNING 1건(무관 plan 파일) 외에는 발견 없음. 핵심 수정(`page.tsx`, `sidebar.tsx`, `href.ts`)은 모두 "①진입점(sidebar href 생성) + ②증폭기(catch-all 재부착)" 2단 근본원인과 정확히 대응한다.
2. **불필요한 리팩토링**: 없음. `sidebar.tsx` 의 `navItems` 재포맷은 `workspaceScoped` 필드 추가로 인한 필연적 결과(prettier 줄바꿈)이며, 로직 변경이 아닌 항목은 한 줄 포맷을 그대로 유지했다(예: `sidebar.triggers`, `sidebar.models`).
3. **기능 확장(over-engineering)**: 없음. `workspaceRootSlug`(=`/w/<slug>` 단독 처리)는 "부수 발견" 으로 plan 에 명시된 대로 같은 결함 클래스이며 요청 범위 내 정당한 확장이다. `notFound()` 도입은 무한 리다이렉트를 막기 위한 필수 대안으로 신규 기능이 아니라 결함 종결 처리다.
4. **무관한 수정**: 위 WARNING 1건(plan/complete 파일) 외 무관한 코드 영역 수정 없음.
5. **포맷팅 변경**: `sidebar.tsx` 의 일부 항목이 여러 줄로 재포맷된 것은 필드 추가에 따른 line-length 초과의 자연스러운 결과이며 실질 변경과 뒤섞여 리뷰를 어렵게 만들 정도는 아니다.
6. **주석 변경**: `page.tsx`·`href.ts` 의 주석/docstring 보강은 모두 이번 fix 의 설계 근거(terminal 종결 규칙, non-idempotent 결정)를 기록한 것으로 변경 의도와 직접 연관된다. 불필요한 주석 추가/삭제 없음.
7. **임포트 변경**: `page.tsx` 에서 `useMemo`, `notFound` 추가 — 둘 다 실제 사용됨. 미사용 임포트나 불필요한 정리 없음.
8. **설정 변경**: 없음. `.env`, CI, 빌드 설정 등 변경 없음.

## 요약

핵심 diff(6개 코드/테스트 파일 + 신규 in-progress plan)는 "사이드바 href 생성(①)"과 "catch-all 재부착 증폭(②)"이라는 명시된 2단 근본원인에 정확히 대응하며, 추가된 `workspaceRootSlug` 처리·notFound 종결·비-idempotent 문서화도 모두 동일 결함 클래스 내에서 정당화된다. 유일한 이탈은 `plan/complete/ai-agent-tool-payload-budget-followups.md` 의 frontmatter 보정으로, 이는 완전히 다른 작업(AI Agent 도구 payload 예산, PR #955/#956)의 완료 plan에 대한 drive-by 수정이며 커밋 메시지에도 "본 PR 과 무관"이라고 명시되어 있다. 프로젝트 컨벤션(ISSUE FIX)상 허용되는 예외이고 별도 원자적 커밋으로 분리되어 리뷰 난이도를 크게 높이지는 않지만, 엄밀한 범위(scope) 기준으로는 별도 PR 분리가 더 바람직하다.

## 위험도

LOW
