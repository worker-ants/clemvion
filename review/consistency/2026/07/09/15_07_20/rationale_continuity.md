# Rationale 연속성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-nav-spec-cleanup.md` (변경 1·2 — `11-error-empty-states.md`, `14-execution-history.md`, `_product-overview.md`)
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

- **[CRITICAL]** "변경 1" 이 아직 main 에 merge 되지 않은 병렬 워크트리의 미병합 코드를 이미 존재하는 현재 사실처럼 서술
  - target 위치: 변경 1 — `11-error-empty-states.md` §1.3 본문 정정 ("`[slug] layout` → 공용 `WorkspaceSlugGate`", "`(main)`·`(editor)` 양 layout 공유") + frontmatter `code:` 에 `lib/workspace/workspace-slug-gate.tsx` 추가
  - 과거 결정 출처: `plan/complete/workspace-slug-routing.md` §라우트 구조 — "**`(editor)`·`(auth)` 는 phase 1 slug 밖 유지**(에디터는 workflow id 로 스코프, 딥링크 redirect). editor slug화는 phase 2." (완료·잠금 결정). `spec/0-overview.md` Rationale 머리말 — "본문은 latest-only 사실을 기술" 원칙.
  - 상세: 본 worktree(`nav-spec-cleanup-f2dc5e`, base `892009f04`)의 실제 코드베이스에는 `lib/workspace/workspace-slug-gate.tsx` 파일이 **존재하지 않으며**, `(editor)/w/[slug]` 라우트도 없다 — `(main)/w/[slug]/layout.tsx` 안에 인라인 `WorkspaceSlugLayout` 함수로만 게이트 로직이 존재한다(공용 컴포넌트로 추출되지 않음). 해당 파일·`(editor)` 슬러그 라우트·공유 게이트는 **동일 base 에서 분기한 별도 워크트리 `editor-slug-phase2-f9a46b`(브랜치 `claude/editor-slug-phase2-f9a46b`, 미병합)** 에만 존재한다. 즉 target 이 인용한 `/consistency-check --impl-done`(`14_08_26`) 산출물은 그 다른 워크트리에서 나온 phase 2 impl-done 리뷰이고, 본 target 은 그 리뷰의 결론을 phase 2 코드가 없는 이 워크트리의 spec 에 그대로 이식하고 있다. 이는 `plan/complete/workspace-slug-routing.md` 가 잠근 "editor 는 phase 1 에서 slug 밖" 경계를 이 브랜치 기준으로는 실질적으로 뒤집는 서술이며, 그 뒤집음에 대한 새 Rationale(왜 이 브랜치에서 phase 2 를 이미 완료된 것으로 서술해도 되는지, 병합 순서 의존성 등)이 target 본문·Rationale 어디에도 없다.
  - 제안: (a) 이 spec 변경을 `editor-slug-phase2-f9a46b` 가 main 에 병합된 **이후**로 순서를 미루거나, (b) 지금 진행한다면 frontmatter `code:` 에서 미존재 경로를 제거하고 본문 서술을 "phase 2(별도 워크트리 진행 중) 병합 후 `(main)`·`(editor)` 공유 예정"처럼 미래형/조건부로 낮추거나, (c) 두 워크트리의 병합 순서를 plan frontmatter 에 명시적 의존성으로 기록해 어느 쪽이 먼저 merge 되어도 spec-code 정합이 깨지지 않게 한다. `spec-code-paths.test.ts` 는 "code: 중 최소 1개만 실재해도 통과"라 즉시 CI 하드 실패로 드러나지는 않지만(기존 경로들이 이미 매치), 그렇다고 존재하지 않는 경로·미병합 아키텍처를 현재형으로 적어도 되는 근거는 아니다.

- **[INFO]** EH-* Overview 매트릭스를 `_product-overview.md` 로 이관하는 결정은 기존 원칙과 정합하나, 직전의 관련 결정(#540)을 명시적으로 언급하지 않음
  - target 위치: 변경 2 — `14-execution-history.md` Overview 섹션 전체 제거 + `_product-overview.md §3.15` 신설
  - 과거 결정 출처: 커밋 `b3879c24d`(#540, "14-execution-history Overview/본문 번호 체계 중복 해소") — 당시 `## Overview (제품 정의)` **섹션 자체는 존치**하기로 하고 내부 번호 체계만 정리했음. `.claude/skills/project-planner/SKILL.md` §Spec 문서 구조 — "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"(Overview 배치 원칙).
  - 상세: #540 은 "Overview 섹션 유지·번호만 정리"라는 좁은 범위 결정이었고, 그 결정이 "이 파일은 영구히 3섹션(Overview/본문/Rationale) 구조를 유지한다"를 명시적으로 선언한 것은 아니었다. target 의 전면 이관은 SKILL.md 의 멀티파일 영역 Overview 배치 원칙과 정합하고, `_product-overview.md` 가 이미 다른 모든 형제 영역의 요구사항 매트릭스 SoT 라는 점도 사실 확인됨(§3.1~§3.14). 따라서 이것은 "무근거 번복"은 아니고 target 자신의 `## Rationale` 에 새 근거가 기술되어 있어 절차상 요건은 충족한다. 다만 #540 이 "번호만 정리"로 이 구조를 한 차례 확정지은 이력이 있으므로, 새 Rationale 에 "#540 은 번호 체계 범위 결정이었고 본 변경은 그보다 상위의 배치(SoT) 결정을 다룬다"는 한 줄을 추가하면 향후 독자가 두 결정 이력을 추적하기 쉬워진다.
  - 제안: `14-execution-history.md` 신설 Rationale 또는 이관 커밋 메시지에 "#540(번호체계 정리)과 별개로, 본 이관은 SKILL.md 멀티파일 영역 Overview 배치 원칙에 따른 SoT 재배치" 한 줄을 추가.

- **[INFO]** "형제 전부가 2섹션 패턴" 전제가 근사치 — `6-config.md` 는 여전히 자체 `## Overview (제품 정의)` 보유
  - target 위치: 변경 2 서술 — "형제(`0-dashboard`·`1-workflow-list`·`10-auth-flow`·`11-error`·`15-system-status` = 2섹션 패턴)와 이질적이었다"
  - 과거 결정 출처: 해당 없음 (target 자체의 사실 서술 정확도 문제)
  - 상세: target 이 나열한 5개 형제는 실제로 2섹션이 맞지만, 나열에서 빠진 `6-config.md` 는 여전히 짧은 `## Overview (제품 정의)` 단락(Part A/B 통합 소개)을 보유한다. 다만 `6-config.md` 의 Overview 는 EH-* 류의 ID 부여 요구사항 매트릭스를 중복 보유하는 것이 아니라 한두 문장 요약이라, 14-execution-history 가 가졌던 "완전 중복 매트릭스" 문제와는 성격이 달라 본 이관 결정 자체를 흔들지는 않는다. 다만 "형제와 이질적" 이라는 표현이 배타적 사실 주장처럼 읽혀 완전한 정확성 관점에서는 근거가 근사치다.
  - 제안: 표현을 "2섹션 형태의 형제 다수"처럼 완화하거나, 필요 시 `6-config.md` 의 Overview 도 향후 정리 대상(별도 plan)으로 각주.

---

## 요약

변경 2(EH-* Overview 매트릭스를 `_product-overview.md` 로 이관)는 SKILL.md 의 멀티파일 영역 Overview 배치 원칙과 정합하고, 과거 관련 결정(#540)의 좁은 범위(번호 체계 정리)를 실질적으로 뒤집는 것이 아니며 target 자체에 새 Rationale 이 기술되어 절차 요건도 충족한다(INFO 수준 보완 여지만 있음). 반면 변경 1(evidence 정밀화)은 심각한 문제가 있다 — target 이 인용하는 `WorkspaceSlugGate` 공용 컴포넌트·`(editor)/w/[slug]` 공유 게이트는 이 워크트리의 실제 코드베이스에는 존재하지 않고, 동일 base 에서 분기한 별도 미병합 워크트리(`editor-slug-phase2-f9a46b`)에만 존재한다. `plan/complete/workspace-slug-routing.md` 가 명시적으로 잠근 "editor 는 phase 1 에서 slug 밖" 경계를 이 브랜치 관점에서 이미 넘어선 것처럼 서술하면서도, 그 cross-branch 의존성이나 병합 순서에 대한 새 Rationale·의존성 기록이 전혀 없다 — "본문은 latest-only 사실을 기술한다"는 `0-overview.md` Rationale 의 근본 원칙과 충돌한다.

---

## 위험도

HIGH
