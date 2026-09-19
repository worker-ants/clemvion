# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-code-guards-and-change-summary.md`

## 발견사항

- **[INFO]** `1-data-model.md` 는 frontmatter-evidence build gate 의 `§1 inclusive list` 밖이라 `code:` glob 실존은 build 로 검증되지 않는다
  - target 위치: `## 1. spec/1-data-model.md frontmatter code:` 절, "효과" 문단
  - 위반 규약: 없음 (위반이 아니라 근거 메커니즘 확인)
  - 상세: `spec/conventions/spec-impl-evidence.md §1` 의 frontmatter 의무 inclusive list 는 `spec/2-navigation/**`·`3-workflow-editor/**`·`4-nodes/**`·`5-system/**`·`7-channel-web-chat/**`·`conventions/**` 뿐이며 `spec/1-data-model.md` 는 애초에 이 목록 밖이다(§1 의 `EXCLUDE_BASENAMES` 항목은 부가 서술일 뿐, 이 파일은 그 이전에 inclusive list 미포함). 즉 `spec-code-paths.test.ts` 등 프런트엔드 4개 build 가드는 이 문서의 `code:` 를 애초에 보지 않는다. 반면 draft 가 실제로 노리는 메커니즘은 별개 구현인 `.claude/hooks/_lib/review_guard.py::_spec_linked_changes` 다 — 이 함수는 `spec/**/*.md` 를 basename 필터 없이 전수 walk 해 `code:` 를 파싱하므로(직접 코드 확인: `_spec_code_patterns` 에 inclusive-list/EXCLUDE_BASENAMES 필터가 없음), draft 가 말하는 "`--impl-done` 을 부른다" 효과는 실제로 성립한다. 다만 문서의 "효과" 문장만 읽으면 두 메커니즘(빌드 gate vs review_guard 스캐닝)이 섞여 읽힐 여지가 있다
  - 제안: 이미 사실관계는 맞으므로 정정 불필요. 다만 spec 반영 시 "효과" 문장에 "`review_guard._spec_linked_changes`(전수 스캔, 대상 제한 없음) 기준" 한 구절을 덧붙이면 다음 사람이 프런트엔드 frontmatter-evidence 가드로 오인하지 않는다 (선택 사항)

- **[INFO]** draft 코드블록의 인라인 YAML 주석은 실제 frontmatter 관행과 다르므로 명시적으로 분리해 둔 점이 규약 사고를 예방한다
  - target 위치: `## 1.` 절, "(주석은 draft 설명용 — spec frontmatter 에는 경로만 적는다.)"
  - 위반 규약: 없음 (모범 사례 확인)
  - 상세: 실측(`grep -rn "^\s*-\s*codebase.*#" spec/**/*.md`, cafe24 카탈로그 제외) 결과 현재 어떤 spec 문서도 `code:` 리스트 항목에 인라인 주석을 쓰지 않는다. `spec/conventions/spec-impl-evidence.md §2.1` 의 `code:` 필드 설명이 언급하는 과거 파서 결함(주석 뒤 항목이 `- ` 로 시작하지 않으면 블록 파싱이 `break` 해 항목이 유실되던 문제, 2026-09-06 수정)과 무관하게, draft 는 처음부터 "주석은 draft 설명용" 이라 명시해 실제 frontmatter 에 옮길 때 이 패턴을 반복하지 않도록 미리 못박았다
  - 제안: 조치 불요. spec 반영 시 이 주석이 실수로 그대로 복사되지 않는지만 한 번 확인

## 검증한 사실관계 (참고 — 발견사항 아님)

- 세 e2e 파일(`deletion-cascade-indexes` · `trigger-endpoint-path-dedupe` · `entity-schema-declarations`) 모두 `codebase/backend/test/` 에 실존 (`ls` 확인) — `code:` glob 매치 조건(§3 `partial`/`implemented` 시 ≥1 매치 의무, 다만 위 INFO 1 대로 이 문서엔 gate 자체가 안 걸림)은 실질적으로도 충족
- DB 카탈로그 키워드(`pg_index`/`pg_indexes`/`pg_constraint`/`information_schema`/`indisvalid`)를 쓰는 e2e 파일 8개 중, 이미 등재된 2개(`schedule-trigger.e2e-spec.ts`→`2-trigger-list.md`·`3-schedule.md`, `trigger-deletion-releases-resources.e2e-spec.ts`→`2-trigger-list.md`)와 이번에 넣을 2개(`deletion-cascade-indexes`·`entity-schema-declarations`)를 빼면, 미등재 4개(`background-monitoring`·`notifications-dismiss`·`terminal-duration-sql`·`webhook-trigger`)는 실제로 어느 spec `code:` 에도 없음 — draft 의 "비대상" 판단과 grep 결과가 정확히 일치
- `spec/**` 전체에서 `change_summary`/`changeSummary` 언급 10줄 중 draft 가 지목한 `0-canvas.md:526` 한 줄만 "자동 생성" 을 주장하고 나머지는 이미 "요청이 보낸 값을 그대로" 또는 "`Restored from vN`" 으로 정확히 서술 — 코드(`workflows.service.ts:725` restore 시 `Restored from v${target.version}` 하드코딩, `save-canvas.dto.ts:214` `changeSummary?: string`, 프런트 `changeSummary` 사용처가 응답 타입·표시 컴포넌트뿐)와도 일치
- plan frontmatter(`worktree`/`started`/`owner`) 3필드, `spec_impact` 리스트(실존 spec 경로 2개), 파일명 `spec-draft-<name>.md` 패턴, 본문 끝 `## Rationale` — 모두 `.claude/skills/project-planner/SKILL.md` §Spec 문서 구조·`.claude/docs/plan-lifecycle.md §4` 요구사항을 충족

## 요약

target 문서는 사용자 결정 두 건을 반영하는 planner draft로, 명명(파일명·e2e 파일명)·frontmatter 스키마·draft 문서 구조(`## Rationale` 포함)·`code:` 필드 의미론 모두 `spec/conventions/spec-impl-evidence.md`·`.claude/docs/plan-lifecycle.md`·`project-planner/SKILL.md` 의 정식 규약과 일치한다. 제시된 모든 사실 주장(e2e 파일 실존, DB 카탈로그 키워드 grep 8건, `change_summary` 10줄 대조, 소스 코드 인용)을 독립적으로 재현해 정합성을 확인했으며 어긋나는 지점을 찾지 못했다. `code:` 등재가 실제로 작동하는 메커니즘이 프런트엔드 frontmatter-evidence build gate가 아니라 `review_guard._spec_linked_changes` 전수 스캔이라는 점(§1 inclusive list 밖 파일이라 build gate 미적용)은 draft 의 의도와 부합하지만 문서에는 명시돼 있지 않아 INFO 수준으로 짚었다. CRITICAL/WARNING 급 규약 위반은 없다.

## 위험도

NONE
