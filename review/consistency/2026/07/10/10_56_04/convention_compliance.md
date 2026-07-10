# 정식 규약 준수 검토 — execution-context.md 원칙 5 신설 + execution-engine.md §1.3 form_submitted row 동기화

## 대상
- `spec/conventions/execution-context.md` — "원칙 5 — `variables.__*` 시스템 예약 네임스페이스" 신설 (§1, line 63-70)
- `spec/5-system/4-execution-engine.md` §1.3 — `form_submitted` interaction row 를 `node-output.md` §4.5 SoT 와 동기화 (line 185)

두 파일 모두 uncommitted working-tree 변경 (`git diff` 확인). 대조군: `spec/conventions/node-output.md` §4.5 (SoT), `spec/conventions/node-cancellation.md` (형식 선례), `spec/conventions/spec-impl-evidence.md` (frontmatter 규약).

## 발견사항

- **[INFO]** `interaction.data` 표 안에서 SoT 백링크 표기 스타일이 혼용됨
  - target 위치: `spec/5-system/4-execution-engine.md` line 185 (`form_submitted` row) vs line 187 (`button_continue` row)
  - 위반 규약: 명시적 규약 문서 위반은 아니며, 같은 문서 내 기존 표기 패턴(`CONVENTIONS §4.5`, `CONVENTIONS Principle 4`, `CONVENTIONS node-output Principle 4.2.1` 등 line 121/132/157/179/187/480/491/504/1403)과의 **일관성**을 다룸.
  - 상세: 새로 추가된 `form_submitted` row 는 `[§4.5 SoT](../conventions/node-output.md)` 형태의 마크다운 링크 + `"SoT"` 접미사를 쓰는 반면, 바로 아래 `button_continue` row 는 기존 표기 `link 타입 버튼 (CONVENTIONS §4.5)` (링크 없는 순수 텍스트, `"CONVENTIONS"` 접두)를 그대로 쓴다. 또한 표 바로 위 캡션이 이미 `**`interaction.data` payload 규격** (CONVENTIONS §4.5):` 로 표 전체가 §4.5 파생임을 선언하고 있어, row-level 배지는 원래도 다소 중복이었는데 이번 수정으로 같은 표 안에 두 가지 다른 표기 스타일(링크 있음/없음, `"SoT"` 라벨 유무)이 공존하게 됐다.
  - 제안: `form_submitted` row 의 표기를 기존 로컬 관용구 `(CONVENTIONS §4.5)` 로 맞추거나(문서 전체 스타일 통일), 혹은 이 참조 방식을 새 표준으로 승격할 것이라면 `button_continue` row 도 같은 스타일로 함께 갱신. 기능/데이터 정확성에는 영향 없는 순수 포맷 이슈.

- **[INFO]** `execution-engine §6.1/§6.2` 복수 섹션 참조가 단일 anchor 로만 링크됨
  - target 위치: `spec/conventions/execution-context.md` line 69 — `[execution-engine §6.1 컨텍스트 구조 / §6.2 저장 전략](../5-system/4-execution-engine.md#61-컨텍스트-구조)`
  - 위반 규약: 강제 규약은 아님(`spec-link-integrity.test.ts` 는 링크 타깃 존재 여부만 검증, 링크 텍스트-타깃 1:1 대응은 검증 안 함).
  - 상세: 링크 텍스트는 "§6.1 컨텍스트 구조 / §6.2 저장 전략" 두 섹션을 함께 언급하지만 실제 anchor 는 `#61-컨텍스트-구조` 하나뿐이라 §6.2 로는 직접 점프되지 않는다. 두 섹션이 인접해 있어(§6.1 line 664, §6.2 line 782) 실사용상 문제는 미미하나, 이 문서 자체가 SoT 정합성을 엄격히 강조하는 규약 문서라는 점에서 사소한 흠으로 남는다.
  - 제안: 필요 시 두 개의 별도 링크로 분리 (`§6.1`·`§6.2` 각각). 우선순위 낮음.

- **[INFO]** §2 "새 필드 추가 결정 규칙" 표가 원칙 5 축(=`variables` 맵 시스템 네임스페이스)을 반영하지 않음
  - target 위치: `spec/conventions/execution-context.md` §2 (line 72-79)
  - 위반 규약: 명시적 규칙 위반은 아님. 원칙 1/2/4 는 이 결정 표에 각각 분기로 대응되지만 원칙 5 는 대응 분기가 없음.
  - 상세: 원칙 5 자체가 "top-level 필드 vs. `variables` 맵 내부 값은 스코프가 다르다"고 명시적으로 선을 그어(line 68) 이 표(ExecutionContext **top-level 필드** 추가 결정)의 스코프 밖임을 스스로 설명하고 있어 의도된 설계로 보인다. 다만 실무자가 "새 시스템 값을 어디에 둘지" 판단할 때 참조하는 진입점이 이 결정 표 하나뿐이라, 원칙 5 라는 세 번째 선택지(엔진 주입 시스템 스칼라 값 → `variables.__*`)가 누락되어 보일 여지가 있다.
  - 제안: 필수는 아니나, 결정 표에 "엔진이 실행 시작 시 주입하는 시스템 스칼라값이며 표현식/노드 UI 에서 읽혀야 하는가? → `variables.__*` (원칙 5)" 행을 추가하면 완전성이 개선됨. 규약 갱신이 아니라 target 자체의 강화 제안.

- **[INFO]** "강제 갭" 선례 인용의 정확한 표현("prefix")이 실제 코드 가드 조건("포함/separator")과 약간 다름
  - target 위치: `spec/conventions/execution-context.md` line 70 — "선례: carousel `button.id` 의 `__item_` prefix schema-level reject"
  - 위반 규약: 없음(내용은 정확 — 코드 대조 완료: `carousel.schema.ts`/`button.types.ts` 의 `btn.id.includes('__item_')`, 에러 메시지 "must not contain reserved separator" — `spec/4-nodes/6-presentation/1-carousel.md` line 368 도 "schema 레벨에서 reject" 로 동일 서술).
  - 상세: carousel 쪽 코드/spec 은 스스로를 "reserved **separator**" 로 칭하는데(‘prefix’ 아님, `includes()` 이므로 문자열 어디든 매치), execution-context.md 는 이를 "prefix schema-level reject" 라고 부른다. 의미상 크게 다르지 않고 인용 목적(스키마 레벨 거부 선례)에는 지장 없으나, 정확한 인용이라면 "separator"가 더 정밀한 단어.
  - 제안: "선례: carousel `button.id` 의 `__item_` reserved separator schema-level reject" 로 표현 다듬기. 매우 사소.

## 정합성 확인 (위반 없음, 참고용)

아래는 규약 준수 관점에서 **문제 없음**을 확인한 항목이며, 참고 근거로 남긴다.

1. **`원칙 5` 헤딩/구조 포맷** — `### 원칙 5 — <title>` 형식은 원칙 1~4 (`### 원칙 1 — Stable core` 등)과 동일한 heading level·구두점(em dash) 패턴을 그대로 따름. `## 1. 설계 원칙` 하위 5번째 항목으로 자연스럽게 이어짐 — 헤딩 계층 위반 없음.
2. **문서 3섹션 구조 (Overview/본문/Rationale)** — 이번 변경은 `## 1. 설계 원칙` 본문 섹션 내부에만 추가되었고, `## Overview (목적)` / `## Rationale` 섹션 경계는 그대로 유지됨. CLAUDE.md 의 3섹션 권장 구조 위반 없음.
3. **frontmatter (`spec-impl-evidence.md` 스키마)** — `execution-context.md` frontmatter (`id`/`status: implemented`/`code:` 3개 경로)는 이번 변경으로 건드리지 않았고, 기존 frontmatter 는 스키마(§2)에 정합. `code:` 3개 경로(`node-handler.interface.ts`/`execution-context.service.ts`/`resume-call-stack.types.ts`) 실존 확인 완료.
4. **코드 SoT 대조 — `__*` 필드명 4개** — `node-handler.interface.ts` JSDoc 에 `__workspaceId`/`__workspaceName`/`__workspaceTimezone`/`__dryRun` 4개 필드 전부 실존 확인 (grep 결과 line 66/67/71/74). 원칙 5 의 "선례" 목록과 정확히 일치 — 이전 리뷰(3개 → 4개 완결) 반영 확인됨.
5. **코드 SoT 대조 — `filterUserVariables`** — `execution-engine.service.ts` line 7554-7562 `filterUserVariables` 구현이 정확히 `!key.startsWith('__')` 필터를 사용함을 확인 — 원칙 5 의 "영속 정책" 서술과 일치.
6. **"충돌하지 않는다" 절대 표현 잔존 여부** — 전체 파일 grep 결과 재발 없음. 이전 교정(단정적 invariant → convention + 강제 갭 bullet)이 완전히 반영됨.
7. **anchor 링크 무결성** — 신규/변경된 in-repo 링크 4건 전부 대상 파일·heading anchor 실존 확인:
   - `execution-context.md#L69` → `4-execution-engine.md#61-컨텍스트-구조` (존재, §6.1)
   - `execution-context.md#L70` (강제 갭 bullet 의 carousel 선례는 링크 아님, 코드/문서 대조로 검증 — `1-carousel.md` L368/450 과 정합)
   - `4-execution-engine.md#L185` → `../conventions/node-output.md` (존재)
   - 기존 `_contextKey`/`_callStack` 관련 앵커(`#75-resume-after-restart-rehydration`, `#91-키-패턴`)는 금번 diff 범위 밖이나 참고 대조 시 모두 유효.
8. **`form_submitted` row 내용의 SoT 정합성** — `execution-engine.md` §1.3 row (`{ [fieldName]: value, via?: 'ai_render' }`, 적용 노드 `form` / `ai_agent`(`render_form`))가 `node-output.md` §4.5 (SoT) 의 동일 row (`{ [fieldName]: value, via?: 'ai_render' }`, 적용 노드 `form`, `ai_agent` (`render_form`))와 shape·적용 노드 모두 일치. 이전(수정 전) `{ [fieldName]: value }` / `form` 단독 표기 대비 갭이 해소됨. GFM 표 문법(파이프 개수 3열 일치)도 유효.
9. **마크다운 표 유효성** — 변경된 `form_submitted` row 는 헤더 대비 컬럼 수(3) 일치, 셀 내부에 미이스케이프 `|` 없음 — 렌더링 깨짐 없음 (단, 셀 폭이 다른 행보다 훨씬 길어 raw 소스 상 시각적 정렬은 깨지나 이는 `node-output.md` §4.5 SoT 표 자체도 동일한 기존 스타일이라 새로운 패턴 아님).

## 요약

이번 변경(execution-context.md 원칙 5 신설 + execution-engine.md §1.3 form_submitted row 동기화)은 정식 규약 관점에서 **CRITICAL/WARNING 급 위반이 없다**. 헤딩 계층·3섹션 문서 구조·frontmatter 스키마를 모두 준수하며, 신규 서술 내용(4개 `__*` 필드 선례, `filterUserVariables` 필터 로직, carousel schema-reject 선례)은 코드 SoT 대조 결과 정확했다. 앞서 지적됐던 단정적 표현("충돌하지 않는다")도 완전히 교정되어 잔존하지 않는다. 남은 항목은 전부 INFO 급 — 같은 표 안에서 SoT 백링크 표기 스타일이 혼용된 점, §2 결정 표가 원칙 5 축을 명시적으로 포괄하지 않는 점, 일부 인용 표현의 미세한 부정확성(prefix vs separator) — 이며 어느 것도 다른 시스템의 invariant 를 깨뜨리지 않는다.

## 위험도
LOW
