# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 발견사항

- **[WARNING]** §Overview 변경 제안이 문서 자신이 위임한 "카탈로그·분류" SoT 경계를 재선언한다
  - target 위치: target 문서 `## 변경 제안` 불릿 2~3 (`- \`ErrorCode\` — 노드 핸들러가 \`output.error.code\` 에 싣는다` / `- \`EngineErrorCode\` — 엔진이 \`Execution.error\` · \`NodeExecution.error\` 에 싣는다`)
  - 위반 규약: `spec/conventions/error-codes.md` §Overview 자신의 "책임 경계" 선언 — `카탈로그·분류·트리거: 5-system/3-error-handling.md §1 (SoT)` 및 인접 항목의 `본 문서는 재선언하지 않는다` 원칙(같은 Overview, 표기 규칙 bullet). 본 문서가 스스로 "명명·안정성 규율만 정의한다" 고 선언한 그 경계.
  - 상세: 현재 §Overview "적용 범위" 문단은 `ErrorCode` 를 "명명이 중앙화된 대표 surface" 라고만 부르고, **어느 필드에 실리는지는 말하지 않는다** — 그 사실은 `node-output.md §3.2` / 코드 JSDoc 이 소유한다. 그런데 이번 변경 제안은 두 surface 모두에 대해 목적지 필드(`output.error.code`, `Execution.error`·`NodeExecution.error`)를 명시적으로 적는다. 이는 "어느 surface 가 어느 필드에 실리는가" 라는 **카탈로그·분류 성격의 사실**이고, 이 문서 Overview 는 그 소유권을 명시적으로 `3-error-handling.md §1` 에 위임해 뒀다. 특히 `EngineErrorCode` 쪽 서술은 **일반화의 정확성 위험**도 있다 — 코드 자체(`codebase/backend/src/nodes/core/error-codes.ts:147-171`)를 보면 목적지가 코드마다 다르다: `EXECUTION_QUEUE_WAIT_TIMEOUT` 은 admission 단계에서 실패해 `NodeExecution` row 자체가 없으므로 `Execution.error` 에만 실리는 반면, `SERVER_INTERRUPTED` 의 JSDoc 은 "Execution·NodeExecution 양쪽 봉투에 실린다" 고 명시한다 — 즉 "둘 다에 싣는다" 는 문장은 이 const 의 **일부 값에만** 참이다. 이런 code-by-code 뉘앙스는 정확히 이 문서가 위임해 둔 카탈로그 SoT(`3-error-handling.md`)의 몫이며, Overview 레벨의 뭉뚱그린 재선언은 두 문서가 갈라질 때(SoT 가 갱신돼도 여기는 안 바뀔 때) 상충하는 서술을 남길 위험이 있다.
  - 제안: 두 가지 중 하나. (a) 기존 `ErrorCode` bullet 과 같은 추상 수준으로 낮춰 목적지 필드를 빼고 "노드 핸들러 층 대표 surface" / "엔진 층 대표 surface" 정도로만 병기하거나, (b) 목적지 필드를 유지하려면 `EngineErrorCode` 값마다 목적지가 다르다는 점을 숨기지 않도록 `Execution.error`(·경우에 따라 `NodeExecution.error`) 식으로 완화하고 카탈로그 SoT(`3-error-handling.md §1`, `1-data-model.md` "Execution.error ↔ NodeExecution.error 관계") 로 링크를 단다. 어느 쪽이든 이 문서의 "재선언하지 않는다" 관례를 지키는 방향이 더 안전하다.

## 그 외 확인한 항목 (위반 없음)

- **명명 규약**: 이 draft 는 새 파일·식별자·API endpoint 를 신설하지 않는다 — 기존 `ErrorCode`/`EngineErrorCode` 를 언급만 한다. 실측(`error-codes.ts:8`, `:147`, `error-codes.spec.ts:59` 의 `overlap` 변수)은 실제 코드와 일치했다.
- **plan frontmatter 스키마**: `worktree`/`started`/`owner` 3필드 모두 존재(`.claude/docs/plan-lifecycle.md §4` 필수 스키마 충족). `spec_impact` 가 YAML 리스트(`- spec/conventions/error-codes.md`)로 선언돼 Gate C 형식(`bare string`/빈 배열 금지)을 지킨다. `status: in-progress` 는 비종결 값이라 `plan/complete/**` 종결값 제약 대상이 아니다(정상).
- **파일명 규약**: `spec-draft-<slug>.md` 패턴은 `plan/in-progress/`·`plan/complete/` 양쪽에 70여 건 선례가 있고 이 파일도 그 패턴을 그대로 따른다(`spec-draft-error-code-two-surfaces.md`). 기존 `spec-draft-error-codes.md`(완료, 다른 슬러그)와 이름 충돌 없음.
- **문서 구조(제목 형식)**: frontmatter `title:` 필드만 있고 본문에 별도 `# ` H1 없이 바로 `## Overview` 로 시작하는 구조는 유일하지 않다 — 정확히 같은 패턴의 선례가 `plan/complete/spec-draft-secret-store-verification-footnote.md` 에 있다(frontmatter `title:` + 본문은 `## Overview` 로 즉시 시작). 이 저장소의 spec-draft plan 은 두 스타일(`title:`+본문 H1 중복 vs `title:`만)이 혼재하며 명시적으로 강제하는 규약 문서가 없어 위반으로 볼 수 없다.
- **`code:` frontmatter 불필요성**: `error-codes.md` 의 `code:` 는 이미 `codebase/backend/src/nodes/core/error-codes.ts` **파일 경로**만 가리키고(`spec-impl-evidence.md §2` 는 심볼이 아니라 파일/glob 단위 evidence), `ErrorCode`·`EngineErrorCode` 가 같은 파일에 있으므로 이 draft 가 `code:` 갱신을 제안하지 않는 것은 옳다.
- **Rationale 인용 진위**: `## Rationale` 이 인용한 `exec-intake-followups.md` ARCH#5 ⑤ 블록(`"그때는 채택되지 않았다"`·`"형태의 의식적 이탈"`·`"해석의 여지가 있다는 사실 자체를"`)은 해당 문서 82~92행에 그대로 존재한다 — 지어낸 근거가 아니다.
- **출력 포맷/API 문서 규약**: 이 draft 는 API 응답·이벤트 페이로드·swagger 데코레이터를 건드리지 않는다 — 해당 관점은 적용 대상 아님.
- **금지 항목**: `error-codes.md` §1~§2 의 명시적 금지(무근거 rename, 인라인 명명 남발 등)를 이 draft 가 답습하지 않는다. 코드 값·rename 을 제안하지 않는다.

## 요약

target 문서는 `spec/conventions/error-codes.md` §Overview 에 `EngineErrorCode` surface 를 병기하는 좁은 범위의 spec draft로, plan frontmatter·파일명·spec_impact 리스트 형식 등 정식 규약의 형식적 요건은 모두 충족한다. 유일하게 지적할 지점은 변경 제안 불릿이 이 문서 스스로 `3-error-handling.md §1` 에 위임해 둔 "카탈로그·분류(어느 surface 가 어느 필드에 실리는가)" 사실을 목적지 필드까지 구체적으로 재선언한다는 점이며, 특히 `EngineErrorCode` 는 코드별로 목적지가 갈리므로(예: `EXECUTION_QUEUE_WAIT_TIMEOUT` vs `SERVER_INTERRUPTED`) Overview 레벨의 뭉뚱그린 문장이 향후 카탈로그 SoT 와 조용히 어긋날 위험이 있다. CRITICAL 급 위반이나 명명·출력 포맷 규약 위반은 발견되지 않았다.

## 위험도

LOW
