# Consistency Check (--impl-done) 통합 보고서

**BLOCK: YES** (checker 판정) — **단, 개발자 검증 결과 본 M-5 changeset 기준 false-positive (아래 §개발자 판정). BYPASS_REVIEW_GUARD 근거 문서.**

## Critical 위배 (checker BLOCK 사유)

| # | Checker | 위배 | target 위치 |
|---|---------|------|-------------|
| 1 | Cross-Spec | 동적 포트 ID 생성 방식 모순 — `1-logic/0-common.md §7`·`3-workflow-editor/1-node-common.md`·`3-ai/_product-overview.md ND-AG-20`이 UUID v4 선언, 구현·`0-overview.md §1.3`은 stable slug | `1-logic/0-common.md §7` 등 |
| 2 | Convention | 동일 위배(다른 각도) — `1-logic/0-common.md §7`(라인 137–142)이 slug 규약 무시 UUID v4 명시 | `1-logic/0-common.md §7` |

## 경고 (WARNING)

| # | Checker | 위배 |
|---|---------|------|
| 1 | Cross-Spec | `0-overview.md §1.0` 부트스트랩 설명이 DI 와 미싱크 (정적 직접 호출 암시) |
| 2 | Rationale | `1-logic/0-common.md §7` UUID v4 잔재 (plan 이 planner 위임 명시) |
| 3 | Convention | `1-logic/0-common.md §9` `status:'background_running'` 미정의 값 |
| 4 | Convention | `0-overview.md §1.0` 카테고리 공유 디렉토리 prefix(`_shared/`vs`shared/`) 미확정 |

## 참고 (INFO) — 요약
Rationale 절 부재(0-overview), ButtonDef UUID 예외 미명시, 레이어2 plan 분리 권장 등 — 전부 비차단/후속.

---

## 개발자 판정: **false-positive (본 changeset 기준) — BYPASS 근거**

검증(2026-06-20):

1. **Critical C1/C2 는 내 changeset 밖 pre-existing drift**. `git diff --name-only origin/main` 에 `1-logic/0-common.md`·`3-workflow-editor/1-node-common.md`·`3-ai/_product-overview.md`·`port-id.util.ts` **전부 미포함**. 내 spec 변경 = `0-overview.md` 단 하나. 내 diff 에 UUID/포트 변경 **0건**. → 동적 포트 ID UUID↔slug drift 는 M-5 가 도입한 게 아니며, **impl-prep(14_21_32)이 이미 동일 항목을 C1 으로 "pre-existing·비차단·범위 밖" 판정**, plan `§범위 밖`에 **별도 planner 태스크**로 등재함(`1-logic/0-common.md §7`·`3-workflow-editor §1.5`·`carousel.md:429` 묶음).
2. **WARNING #1(§1.0 미싱크)은 이미 해소**. 커밋 `7283a216` 이 §1.0 부트스트랩 서술을 DI(`@Inject(NODE_COMPONENT)`·결정적 정렬)로, 폴더 트리에 `node-components.module.ts` 추가, §4 를 DI 로 갱신함. 본 검증에서 §1.0 line 재확인 + fresh ai-review(15_26_45)가 "spec §1.0/§4 DI 서술 동기 반영 완료(requirement NONE)"로 독립 확인. → 오탐.
3. WARNING #3/#4 도 내 changeset 밖 pre-existing(`1-logic §9` background_running, `§1.0` 디렉토리 prefix "혼재" 기존 서술).

⇒ 메모리 "impl-done spec 번들 버그"(--impl-done 가 target spec **영역**의 pre-existing 모순을 changeset 무관하게 오탐 BLOCK) 패턴. 내 코드-vs-spec 정합은 clean(naming/plan_coherence checker NONE, cross-spec 의 내 파일 관련 항목은 이미 sync). **BYPASS_REVIEW_GUARD=1 적용 — UUID↔slug drift 는 별도 planner 태스크로 분리(이 PR 범위 밖, scope-reviewer 정합).**

**naming_collision: NONE** (NODE_COMPONENT·NodeComponentsModule·7 카테고리 배열·신규 경로 전부 클린). **plan_coherence: NONE/INFO** (plan 추적 양호).
