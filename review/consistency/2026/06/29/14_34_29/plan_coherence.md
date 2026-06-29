# Plan 정합성 검토 결과

## 검토 대상

- **Target**: `spec/conventions/spec-impl-evidence.md`
- **변경 내용**: §1 inclusive list 아래에 `spec/data-flow/**` 의 의도적 제외 사유 설명 노트 삽입 (기존 `**제외**` 단락 위에 `> inclusive list 에 없는 영역은 의도적 제외다 …` blockquote 추가)
- **검토 모드**: `--spec`

## 발견사항

발견된 충돌·미해소 선행 조건·누락 후속 항목 없음.

**근거:**

1. **`plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` (line 9)** — 해당 plan 은 작성 시점부터 "data-flow 문서라 frontmatter status 강제 대상은 아니나"라고 명시하고 있다. target 의 설명 노트는 이 기존 인식을 규약 문서에 공식화한 것이므로 plan 과 충돌하지 않는다.

2. **`plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`** — `spec/data-flow/8-notifications.md` 의 미구현 surface 를 추적하지만, frontmatter `id`/`status` 부재·INCLUDE_PREFIXES 관련 결정 항목은 전혀 없다. target 의 변경에 영향받지 않는다.

3. **그 외 `plan/in-progress/spec-sync-structural-followups.md`, `spec-code-cross-audit-2026-06-10.md`, `spec-update-gap-callout-plan-links.md` 등** — `spec/data-flow/**` 파일들을 frontmatter 추적 대상으로 추가하거나 `INCLUDE_PREFIXES` 를 확장하려는 미해결 결정 항목은 존재하지 않는다. 해당 plan 들은 data-flow 파일의 본문 내용(코드 갭·드리프트 수정)만 다룬다.

4. **`INCLUDE_PREFIXES` 확장 의도** — 전체 `plan/in-progress/` 를 대상으로 `INCLUDE_PREFIXES` 또는 data-flow frontmatter 의무화를 언급하는 plan 이 없으므로, target 이 일방적으로 "data-flow 는 제외"라는 결정을 내리더라도 미해결 결정과 충돌하지 않는다.

5. **후속 항목 누락** — target 변경은 순수 문서 설명 추가(blockquote 3줄)이며, 가드 구현(`spec-frontmatter-parse.ts`)·inclusive list·test 파일을 수정하지 않는다. 따라서 다른 plan 의 후속 항목을 무효화하거나 신규 생성할 필요가 없다.

## 요약

Target(`spec/conventions/spec-impl-evidence.md`)의 이번 변경은 `spec/data-flow/**` 가 frontmatter 의무 대상이 아닌 이유를 §1 에 명시적 blockquote 로 추가한 것이다. `plan/in-progress/` 전체를 검색한 결과, data-flow 를 frontmatter 추적 대상에 넣겠다는 미해결 결정 항목이나 INCLUDE_PREFIXES 확장을 요구하는 선행 조건이 없으며, 기존 data-flow 관련 plan 들(`spec-sync-data-flow-12-workspace-gaps.md` 등)은 이미 해당 파일들이 frontmatter 강제 대상이 아님을 전제로 작성되어 있다. Plan 정합성 관점에서 충돌·선행 미해소·후속 누락은 발견되지 않는다.

## 위험도

NONE
