# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 신규 build-blocking 가드(`stray-tool-tags.test.ts`)가 그 가드 family 의 SoT 문서에 등재되지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 파일, 전체) / `spec/conventions/spec-impl-evidence.md:4-18`(frontmatter `code:` 리스트), `spec/conventions/spec-impl-evidence.md:126-128`(§4.2 헤더 및 "build 차단 4건" 서술)
  - 상세: 신규 파일 `stray-tool-tags.test.ts` 는 `plan/**`·`spec/**` 마크다운 전체를 `walkTree` 로 스캔해 위반 0건을 단언하는 구조로, 같은 디렉터리에서 `spec/**.md` 를 스캔하는 `spec-link-integrity.test.ts` 와 정확히 동형이다. 그런데 `spec-link-integrity.test.ts`/`spec-area-index.test.ts`/`plan-frontmatter.test.ts`/`spec-plan-completion.test.ts` 4건을 "지식저장소·plan 무결성 가드… build 차단 4건" 이라고 **개수까지 명시**하고 "본 절이 규약 SoT" 라고 선언하는 `spec/conventions/spec-impl-evidence.md §4.2` 의 표에는 이 신규 5번째 가드가 없다. 같은 문서 frontmatter 의 `code:` 리스트("4개 build 가드 구현 파일은 본 문서 frontmatter `code:` 에 등재" 라고 스스로 적음)에도 `stray-tool-tags.test.ts` 가 빠져 있다(`tree-walk.ts`/`tree-walk.test.ts` 처럼 이 새 가드가 재사용하는 헬퍼는 이미 등재돼 있어 대조가 뚜렷하다). 이 changeset 의 다른 어떤 파일에도 이 표/frontmatter 를 갱신하는 diff 가 없다 — 새 가드가 CI 를 막는 범위에 들어갔는데 "규약 SoT" 를 자처하는 문서가 그 사실을 모르는 상태로 남는다.
  - 제안: `spec/conventions/spec-impl-evidence.md` §4.2 표에 `stray-tool-tags.test.ts` 행을 추가하고 "build 차단 4건" → "5건" 으로 갱신, frontmatter `code:` 리스트에도 파일 경로를 추가한다.

## 확인했으나 문제 없음 (근거 기록)

- `.claude/hooks/_lib/plan_guard.py` 의 `_CHECKBOX` 정규식 확장(파일 2)은 변경 이유·과거 실패 사례(`deps-peer-gating-and-eslint10.md`)·역방향 오탐 부재 실측(2026-09-01, 인용문 안 `[ ]` 6건 중 불릿 구조 3건)을 인라인 주석에 충실히 남겼다. 인용된 두 plan 파일(`plan/complete/deps-peer-gating-and-eslint10.md`, `plan/complete/spec-draft-error-cause-criterion.md`)이 실제로 존재하고, "인용문 안 불릿형 `[ ]` 는 정확히 3건" 이라는 실측 주장도 `grep -rnP '^[\s]*>[\s>]*[-*]\s+\[ \]' plan/` 로 재현·일치를 확인했다 — 인용이 지어낸 근거가 아니다. `test_plan_guard.py`(파일 3)에 추가된 3개 테스트(인용문 안 열린 체크박스, 중첩 인용, 서술 오탐 대조군)도 docstring 이 그 배경을 정확히 재서술한다.
- `plan-lifecycle.md`(파일 1)에 추가된 "이동하는 문서 자신의 outgoing 링크" 절은 "가드가 안 잡는다" 며 `findBrokenPlanLinks` 의 JSDoc 근거를 언급하는데, 실제로 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:434-438` 의 JSDoc 이 "`plan/complete/**` 는 의도적으로 제외 — 시점 기록의 깨진 링크가 정상 상태" 라고 정확히 그 근거를 담고 있다. 문서-코드 간 주장이 어긋나지 않는다.
- `spec/conventions/error-codes.md`(파일 68)에 추가된 `EngineErrorCode` 병기 문단은 "층(layer)" 대신 "비대칭" 프레이밍을 최종 채택해, 같은 changeset 안의 `review/consistency/2026/09/01/21_49_21` 라운드가 지적한 "이 문서·코드 JSDoc·테스트가 이미 '레이어' 를 정착시켰다" WARNING 을 반영한 상태로 적용됐다(원문 대조 확인). 목적지 필드도 카탈로그 SoT(`3-error-handling.md §1`)로 위임하고 직접 재선언하지 않아, 앞선 WARNING(SoT 중복)도 해소돼 있다.
- `plan/complete/{agent-memory-model-config,agent-memory-model-select,fix-model-select-label,webchat-session-apibase-binding}.md` + `plan/in-progress/webchat-usewidget-extraction.md` 에서 제거된 `</content>`/`</invoke>` 잔재 5파일 6건은 신규 가드(`stray-tool-tags.test.ts`) 상단 주석의 "2026-09-01 실측: `plan/` 5파일 6건" 서술과 정확히 일치한다(파일별 태그 개수까지 재확인). 정리(diff)와 그 정리를 정당화하는 서술(주석)이 서로를 검증하는 관계로, 문서·코드 불일치가 없다.
- CHANGELOG.md 갱신 누락 여부: 이 changeset 은 harness(`​.claude/**`)·plan·spec-convention 성격이고, 저장소 관례상 `fix(harness)`/`docs(harness)`/`docs(plan)`/`docs(spec)` 커밋들은 CHANGELOG.md 를 갱신한 선례가 없다(`git log --oneline -20 -- .claude/` 대조 확인) — CHANGELOG 는 `codebase/backend` 등 제품 기능 커밋에 한정되는 관례로 보이며, 이번 변경이 그 관례를 깨는 누락은 아니다.

## 요약

이번 changeset 은 대부분(harness 가드 정규식 확장, plan 위생 정리, spec 규약 1개 문단 추가)이 스스로 근거를 인라인 주석·docstring·plan 기록으로 충실히 남기고 있고, 인용된 실측 수치·파일 경로·JSDoc 근거를 직접 대조해도 어긋나지 않았다. 유일한 실질 결함은 신규 build-blocking 가드 `stray-tool-tags.test.ts` 가 스스로 "규약 SoT" 라고 선언한 `spec/conventions/spec-impl-evidence.md §4.2`(표의 "4건" 개수 + frontmatter `code:` 리스트)에 등재되지 않은 것이다 — 이 문서가 정확히 이런 가드의 존재·개수를 추적하기 위해 존재하는 문서라는 점에서, 이번 PR 범위 안에서 함께 갱신했어야 할 자리다.

## 위험도

LOW
