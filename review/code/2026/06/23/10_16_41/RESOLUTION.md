# Code Review 후속 처리 (RESOLUTION) — M-8 2단계 (god-component 분리)

리뷰 대상: `refactor(triggers): M-8 2단계 — 카드 파일 분리 + hooks` (commit `ccdbc531`)
처리 일시: 2026-06-23
전체 위험도: 리뷰 MEDIUM(W-1 driver) — **단, 모든 Warning 이 verbatim-moved pre-existing 으로, 본 behavior-preserving 분리가 유발한 회귀는 0.**

## 핵심 판정: 회귀 0, 모든 Warning pre-existing

본 PR 은 `trigger-detail-drawer.tsx`(1,537→65줄)의 **verbatim 파일 분리**다. 8개 Warning 은
전부 카드 내부 코드가 그대로 옮겨진 **pre-existing** 사안이며, 분리가 새로 만든 결함이 아니다.
작업 규약("pre-existing 동작 지적은 대조 검증 후 behavior-preserving 보존 + 별건 위임")에 따라
**리팩터 PR 에 버그수정을 혼입하지 않고**(동작보존 순수성·검증 신뢰성 유지) 별건 트랙으로 위임한다.

### origin/main 실측 검증 (대표 2건)
- **W-8** (WebhookConfigCard `handleCancel` 의 `updateMutation.reset()` 누락): origin/main 의 원본
  `cancelEdit()` 도 `setEditing(false)` + 버퍼 리셋만 하고 `updateMutation.reset()` 을 **호출하지
  않는다**(`git show origin/main:...drawer.tsx` L390 부근). 내 `handleCancel` = `cancelEdit(() => {
  setEndpointPathValue(...); setAuthConfigIdValue(...) })` 로 **동일 보존**. ChatChannelCard 가
  `saveMutation.reset()` 을 부르는 비대칭도 원본 그대로 → **분리 회귀 아님.**
- **W-1** (ChatChannel saveMutation 의 `formMode: "multi_step"` 하드코딩): origin/main 원본
  ChatChannelCard PATCH body 가 이미 `formMode: "multi_step"` 하드코딩(검증됨). 내 카드가 verbatim
  이동 → **pre-existing.** (실 데이터 덮어쓰기 위험은 실재하나 본 분리가 도입한 것 아님.)

---

## Warning 처분 (전부 pre-existing → 별건 defer)

| # | 카테고리 | 처분 |
|---|----------|------|
| W-1 | Requirement | **pre-existing 버그**(formMode 하드코딩 → native_modal/auto 설정 덮어쓰기). origin/main verbatim. **별건 버그수정 권장**(planner: spec §2.3.1 formMode selector + `initialChatChannelEditValues` 가 `uiMapping?.formMode ?? "auto"` 읽기). 본 리팩터 범위 밖(feature 변경) |
| W-2 | Requirement | botToken regex 클라이언트 검증 누락 — `RotateBotTokenModal` verbatim 이동. pre-existing. 별건 |
| W-3 | Requirement | `OverviewCard` name `maxLength={255}` vs spec 120 — verbatim. pre-existing(backend 최종 차단). 별건 |
| W-4 | Requirement | notification URL clear 불가(빈 값 시 키 누락) — `ExternalInteractionCard` verbatim. pre-existing. spec EIA §4 확인 후 별건 |
| W-5 | Architecture | `window.confirm()` 직접 호출(rotate/revoke/webhook-save 3곳) — verbatim. pre-existing 패턴. `useConfirm`/Modal 도입은 후속 |
| W-6 | Architecture | `chat-channel-card.tsx` 615줄 과밀 — 분리 시 chat-channel 전체를 한 파일로 응집한 결과(코드 자체 verbatim). `RotateBotTokenModal`+유틸 추가 분리는 후속 정리 |
| W-7 | Maintainability | 카드 헤더 편집/저장/취소 JSX 3카드 반복 — pre-existing 패턴(각 카드 고유 헤더). `CardEditHeader` 추출은 후속 |
| W-8 | Side Effect | WebhookConfigCard cancel 의 `updateMutation.reset()` 누락 — **origin/main 검증 결과 pre-existing**(원본도 미호출). 분리 회귀 아님. ChatChannel 과의 일관성 보강은 별건 |

---

## INFO 처분 (전부 비차단)

- **I-1/I-2 (SPEC-DRIFT)** — `languageLocale` 편집 / Auth Config 카드 병합(5카드) → **planner-only**(spec §2.3.1 갱신). 5카드 유지는 plan 명시 의도(impl-prep W-1, behavior-preserving).
- **I-9 (Overview startEdit)** — Overview 는 hook 의 `startEdit` 을 destructure 하지 않고 로컬 `startEdit`(nameValue 리셋 포함) 정의 — shadowing 아님(의도된 특수 케이스, agent 보고/검증 일치). 명확화 주석은 선택.
- **I-3~I-8, I-10~I-20** — window.confirm Modal화 / `onSaved` 공통 타입 / `invalidate` memo / `cards/index.ts` 배럴 / 헬퍼 모듈스코프 이동(`providerLabel`·`getCurlExample` 등) / 매직넘버 상수화 / 훅·export JSDoc / 테스트 보강(`useCardEditToggle`·`parseLanguageHints`·rotate/revoke) / `SecretRevealBox` 60s 확인 → **전부 후속 정리/테스트 보강 후보**. 본 PR 은 verbatim 분리라 신규 결함 0, 기존 테스트 54 무수정 통과로 동작 보존 입증.
- **I-20 (Scope)** — plan "후속(별건)" 메모는 명시적 "별건" 표기로 허용(현행 유지).

---

## 결론

Critical 0. Warning 8 **전부 verbatim-moved pre-existing**(W-1/W-8 origin/main 실측) — 본 분리는 **회귀 0**
의 순수 behavior-preserving 파일 재구성. 동작보존 순수성 유지를 위해 pre-existing 버그수정은 리팩터
PR 에 혼입하지 않고 별건 트랙(planner/developer)으로 위임·근거 기록. INFO 도 후속/planner 분류.

**특기(별건 권장)**: **W-1 formMode 하드코딩**은 실 데이터 덮어쓰기 가능한 pre-existing 버그 —
trigger-review-deferred 트랙 또는 신규 bug-fix 로 우선 처리 권장(본 리팩터와 독립).

코드 변경 없이 defer(분리는 이미 동작보존·테스트 green) → 재리뷰 불요. `/consistency-check --impl-done` 후 PR.
