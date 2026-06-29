# Plan 정합성 검토 결과

## 검토 대상

- target: `spec/conventions/i18n-userguide.md`
- 검토 모드: spec draft (--spec)
- 검토 시점: 2026-06-29

## 변경 내용 요약

worktree 브랜치(`spec-userguide-residual-closeout-e723f5`)와 main 의 diff:

1. **Principle 7 §GUI 흐름 절 서술 동기화** (l.172): 판별 기준을 기존 "strong 으로 시작" 단일 신호에서 `findGuiFlowSections()` 의 두 신호 OR — (1) h2/h3 heading 텍스트에 bareword `GUI` 포함, 또는 (2) 절 본문 어디든 `GUI` 를 포함한 bold strong — 으로 정밀화. `user-guide-evidence.md §2` 를 SoT 로 명시.
2. **자동 가드 요약표 §Principle 7 행 갱신** (l.189): `—` / `manual` 에서 `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts` (GUI 흐름 절 hard fail 3건 + 개념 설명 절 manual) 으로 현실화.

---

## 발견사항

발견된 CRITICAL / WARNING / INFO 등급 이슈가 없습니다.

### 검토 세부

#### 미해결 결정과의 충돌

`findGuiFlowSections()` 의 두 신호 OR 정의는 이미 `spec/conventions/user-guide-evidence.md §2` (status: `implemented`, 관련 구현 완료)에서 확정됐다. 이 정의는 plan 에서 "결정 필요"로 열려있는 항목이 아니며, target 은 SoT 로부터 파생된 동일 내용을 `i18n-userguide.md` 에 동기화하는 것이다. 일방적 새 결정에 해당하지 않는다.

#### 선행 plan 미해소

- `spec-sync-user-guide-evidence-gaps.md` — complete/ 로 이동 완료. 관련 구현(`impl-anchor-existence.test.ts` + `integrations-coverage.test.ts` + `triggers-coverage.test.ts`)은 확정됐다.
- `parallel-p2-followups.md §6` — `i18n-userguide.md` Principle 3-C 항목은 이미 `[x]` (완료). 본 변경과 무관하다.
- `ai-context-memory-followup-v2.md §Batch 2 후속` — 오픈 항목(`node-output.md` / `3-information-extractor.md`)은 `i18n-userguide.md` Principle 7 서술과 무관하다.

target 이 가정하는 선행 조건(`user-guide-evidence.md §2` 정의 확정)은 이미 해소된 상태다.

#### 후속 항목 누락

Principle 7 서술 정밀화와 가드 요약표 갱신은 새 의무나 새 가드를 도입하지 않는다 — 기존 구현된 가드 3건과 이미 확정된 판별 로직을 spec 텍스트에 반영하는 것이다. 다른 in-progress plan 에서 이 변경으로 무효화되거나 새로 추가되어야 할 후속 항목은 발견되지 않았다.

---

## 요약

target (`spec/conventions/i18n-userguide.md`) 의 두 변경은 모두 `spec/conventions/user-guide-evidence.md §2` 에 이미 확정·구현된 내용을 i18n-userguide 의 요약 서술과 가드 표에 동기화하는 것이다. 어떤 미해결 결정도 우회하지 않고, 선행 plan 미해소 항목에 의존하지 않으며, 다른 in-progress plan 의 후속 항목을 무효화하거나 새로 생성할 변경도 없다. Plan 정합성 관점의 충돌·누락·의존성 위반은 발견되지 않았다.

## 위험도

NONE
