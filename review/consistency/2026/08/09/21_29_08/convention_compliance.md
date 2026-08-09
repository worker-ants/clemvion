# 정식 규약 준수 검토 — spec-draft-secret-store-verification-footnote

대상: `plan/in-progress/spec-draft-secret-store-verification-footnote.md` (검토 모드 `--spec`)
비교 규약: `spec/conventions/**` 전체 번들 (`project-planner` SKILL.md 의 명명·구조 규칙 포함)

## 검증 절차

1. target 이 인용하는 `spec/conventions/secret-store.md:91-94` 각주 문단을 실 파일과 대조 — **정확히 일치**.
2. target 이 근거로 드는 코드 사실 3건을 실제 코드베이스에서 재확인:
   - `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts` — 존재, `it(` 3건 (`가드가 통과시키는 형태`/`_ 는 임의 1글자`/`% 는 임의 문자열`). 각 케이스가 target 이 인용한 "리터럴 해석 시 0건 vs 실제 2건" 서술과 정확히 일치.
   - `secret-resolver.service.spec.ts:307-320` — `expect(repo._lastDeleteQuery.condition).toBe('ref LIKE :prefix')` + `expect(...).not.toMatch(/escape/i)` — target 서술("`ref LIKE :prefix`" 바인딩, `ESCAPE` 절 부재가 계약)과 정확히 일치.
   - `#1113` 커밋(`2ed145e39`) 존재 확인 — 커밋 메시지가 "LIKE 근거 e2e" 를 명시, target 의 "#1113 이 공백을 닫았다" 주장과 정합.
3. `plan/in-progress/backend-lint-gate-broken-on-main.md:332` 의 "**`secret-store.md §2.1` 각주의 '알려진 검증 공백' 문단 철회** — **planner 권한**" 미체크 항목과 target 문서가 정확히 대응 — target 은 이 항목을 실행하는 후속 planner 턴.
4. `project-planner` SKILL.md §작업 워크플로 3~5 (`plan/in-progress/spec-draft-<name>.md`, 본문 끝 `## Rationale`, "옛 내용을 정리해 latest 만 남김") 대조 — 파일명·구조·치환 방식 모두 일치.
5. `.claude/docs/plan-lifecycle.md §4` frontmatter 스키마(`worktree`/`started`/`owner` 필수, `priority`/`status`/`title` 허용) 대조 — 전부 충족. `spec_impact` 를 리스트 형식(`- spec/conventions/secret-store.md`)으로 선언 — Gate C 의 "bare string 금지" 규칙 준수 (완료 시점 의무 필드를 in-progress 단계에 선제 선언한 것으로, 금지되지 않음).
6. target Rationale 의 "`code:` frontmatter 를 건드리지 않는 이유 (c) — review_guard 의 spec-linked 판정" 주장을 `.claude/hooks/_lib/review_guard.py` 코드(spec `code:` glob 매칭 로직, L27-35, L536-640)로 대조 — 서술이 실제 구현과 부합.
7. 치환 문단의 Markdown 스타일(각주 내부 `> -` 불릿 목록, `` ` `` 이중 백틱 이스케이프 `` `` `${prefix}%` `` ``)을 같은 문서·타 conventions 문서(`cafe24-restricted-scopes.md`, `conversation-thread.md`, `node-output.md` 등)의 기존 각주 스타일과 대조 — 일관.

## 발견사항

발견 없음. 검토 관점 5가지(명명 규약 / 출력 포맷 규약 / 문서 구조 규약 / API 문서 규약 / 금지 항목) 전부에서 위반 없음:

- **명명 규약**: 파일명 `plan/in-progress/spec-draft-secret-store-verification-footnote.md` 이 `project-planner` SKILL.md §작업 워크플로 3 의 `spec-draft-<name>.md` 패턴과 정확히 일치. frontmatter `worktree` 슬러그(`spec-secret-store-footnote-retract-f91d93`)도 `.claude/tools/ensure-worktree.sh` 산출 패턴(`<task>-<slug>`)과 일치.
- **출력 포맷 규약**: target 은 API 응답·이벤트 페이로드·에러 코드를 다루지 않는다 — 해당 없음(N/A).
- **문서 구조 규약**: `## Overview` → 본문(왜 이 상태가 됐나 / 실측 / 변경안) → `## Rationale` 3섹션 구성이 CLAUDE.md·SKILL.md 의 권장 구조를 따름. spec 본문 반영 시에도 "history 아닌 latest 유지" 원칙(SKILL.md §5)을 target 스스로 Rationale 에 명시적으로 근거로 들며 준수.
- **API 문서 규약**: 해당 DTO/Swagger 데코레이터 변경 없음 — 해당 없음(N/A).
- **금지 항목**: `spec/conventions/secret-store.md` 자체나 `spec-impl-evidence.md`(frontmatter 의무), `plan-lifecycle.md`(Gate C 리스트 형식) 등에서 명시적으로 금지한 패턴(예: `spec_impact` bare string, 빈 배열, `code:` 미충족 glob)을 재현하지 않음.

target 이 다루는 실체 변경(각주 마지막 문단 교체)이 인용하는 모든 코드·커밋·타 plan 항목 사실관계가 실측으로 확인되며, 정식 규약과 충돌하는 지점이 없다.

## 요약

target 은 이미 구현·머지된 사실(#1113 의 LIKE-와일드카드 e2e + 단위 연결점 단언)을 spec 각주에 반영하는 순수 정정 draft로, `project-planner` SKILL.md 의 draft 명명·구조 규칙과 `plan-lifecycle.md` frontmatter 스키마를 정확히 따른다. 인용된 코드 경로·테스트 이름·커밋·타 plan 항목이 전부 실제 리포지토리 상태와 일치했고, `code:` frontmatter 를 의도적으로 건드리지 않는 근거(review_guard spec-linked 판정 확대 방지)도 실제 구현과 부합했다. 정식 규약(`spec/conventions/**`) 관점에서 위반·경계 사례가 발견되지 않았다.

## 위험도

NONE
