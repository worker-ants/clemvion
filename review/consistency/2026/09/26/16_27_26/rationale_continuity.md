# Rationale 연속성 검토 — `plan/in-progress/spec-draft-ed-ai-19-status.md`

## 검토 대상 요약

target 은 `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행 끝에 `(미구현 — 계획, §4-ai-assistant §12.2)` 표기를
덧붙이는 1행 사실 정정이다. 요구사항 문장·우선순위(`필수`)는 그대로 두고, 같은 문서의 다른 두 인용(§10.9 도입부, ED-AI-38)은
"정책 서술"이라 손대지 않는다. `4-ai-assistant.md` frontmatter `status` 승격은 명시적으로 스코프 밖이라고 선언한다.

## 대조한 Rationale 소스

- `spec/3-workflow-editor/4-ai-assistant.md` `## Rationale` 전체 (Workflow AI Assistant 기획 결정 메모, streamMessage 분할, 시스템 프롬프트 구조, 자체 점검/에러 풍부화, 프로바이더 대응, Candidate Picker, 실행 조회 도구, Runtime ports hint)
- `spec/conventions/spec-impl-evidence.md` §1~§6 (frontmatter 의무 대상·제외·`partial`/`pending_plans` 규칙)
- 실측 확인: `spec/3-workflow-editor/_product-overview.md` §10.4(ED-AI-19, ED-DB-05 선례 행), §10.9, ED-AI-38 / `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1, §12.2 / `grep -rln ASSISTANT_WORKFLOW_RUNNING codebase/{backend,frontend}/src` → 0건, target 서술과 일치

## 발견사항

없음 — CRITICAL/WARNING 대상 없음.

target 은 새 결정을 도입하지 않고, `4-ai-assistant.md` 의 `## Rationale`(및 본문)이 이미 여러 곳에서 확립한 사실
— "`ASSISTANT_WORKFLOW_RUNNING` 가드는 (계획) 상태이며 read 도구(§4.1.1, 실행 조회 도구 결정 메모 "Running/waiting 실행 조회" 행)와는
독립"— 을 PRD 표기에 반영만 한다. 기각된 대안을 재도입하거나 합의 원칙을 무시하는 지점이 없다:

1. **기각된 대안의 재도입** — 해당 없음. `4-ai-assistant.md` Rationale 안에서 "기각" 표시가 붙은 항목들(웹훅 HMAC 분리, 인덱스 대안 등은 다른 spec 소속)은 모두 다른 영역이고, ED-AI-19/실행 가드 주제에는 과거 기각 이력 자체가 없다(grep 결과 관련 언급 없음).
2. **합의된 원칙 위반** — 오히려 원칙을 강화한다. `spec-impl-evidence.md` §1은 `_product-overview.md` 를 밑줄-prefix(`_*.md`) 로 frontmatter 의무에서 제외하는데, target 은 이 문서의 frontmatter 를 건드리지 않고 본문 표기만 고쳐 그 경계를 존중한다. 또한 §3 `partial` 전이 시 `pending_plans:` 의무 규칙을 target 이 정확히 인지해, `4-ai-assistant.md` 의 status 승격은 "§7·§10·§12.2 세 곳의 `(계획)` 을 함께 pending_plans 로 세워야 한다" 는 이유로 **의도적으로 보류**하고 별도 WARNING 으로 트래킹한다 — 규칙을 우회한 것이 아니라 그대로 적용한 결과다.
3. **결정의 무근거 번복** — 해당 없음. target 은 과거 결정을 뒤집지 않는다. "실행 중 편집 거부"라는 제품 요구사항 자체는 유지하고(우선순위 불변), 오직 "이미 사실인 미구현 상태를 PRD 에도 드러낸다"는 표기 정합화다. 새 Rationale 작성이 필요한 종류의 번복이 아니다.
4. **암묵적 가정 충돌** — 해당 없음. "read 도구는 실행 중 거부 정책과 무관"이라는 invariant(실행 조회 도구 결정 메모 "Running/waiting 실행 조회" 행, `4-ai-assistant.md` §4.1.1/§12.2)를 target 은 그대로 두고(§10.9, ED-AI-38 인용부 미변경) 우회하지 않는다.

## 요약

target 은 신규 설계 결정이 아니라, 이미 `4-ai-assistant.md` 의 `## Rationale`/본문에 여러 차례(기획 결정 메모의 "스트리밍 v1 지원 provider" 행 표기 패턴, §4.1.1, §12.2, 실행 조회 도구 결정 메모)에 걸쳐 확립된 "ED-AI-19 실행-중-편집-거부 가드는 (계획) 미구현" 사실을 상위 PRD 문서에 동기화하는 1행 표기 정정이다. 요구사항·우선순위·정책 인용문은 그대로 두었고, `spec-impl-evidence.md` 의 frontmatter 의무 규칙(≠`_product-overview.md`, `partial`+`pending_plans` 트리거)도 우회 없이 정확히 인지·반영해 별도 WARNING 으로 넘겼다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 관측되지 않았다.

## 위험도

NONE
