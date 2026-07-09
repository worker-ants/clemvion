# Cross-Spec 일관성 검토 — spec/4-nodes/7-trigger/ (--impl-prep)

## 검토 범위 메모

Target 은 `spec/4-nodes/7-trigger/` (0-common.md · 1-manual-trigger.md · providers/*)이며, 실제 변경 작업(plan: `trigger-param-output-enricher`)은 **프론트엔드 전용 autocomplete enricher 추가**(`enrichManualTriggerOutputSchema` — `config.parameters[].name` → `output.parameters.<name>` projection)로, target spec 문서 자체의 본문 변경은 없다(plan 비고: "spec 변경 불필요"). 이 전제로 target 문서가 기존 `spec/**` 타 영역과 충돌하는지, 그리고 이 구현이 타 영역 spec 의 SoT 를 stale 하게 만드는지를 함께 점검했다.

## 발견사항

- **[WARNING]** 구현이 `spec/5-system/5-expression-language.md §7.2` 의 "4개 노드 타입" enumerable 목록을 stale 하게 만듦 — plan 의 "spec 변경 불필요" 판단은 target 영역(trigger) 기준으로는 맞지만 소유 spec 이 다른 영역(expression-language)임을 놓침
  - target 위치: (target 문서 자체에는 해당 내용 없음 — plan `plan/in-progress/trigger-param-output-enricher.md` "목표"/"비고" 절, 및 실제 구현 `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts:344` `enrichManualTriggerOutputSchema` + `use-expression-context.ts` 두 호출부)
  - 충돌 대상: `spec/5-system/5-expression-language.md` §7.2 "자동완성 데이터 소스" — "config 기반 스키마 보강 (enricher)" 절. frontmatter `code:` 가 `codebase/frontend/src/components/editor/expression/*.{ts,tsx}` 를 명시적으로 소유(바로 이번에 수정된 두 파일 포함)
  - 상세: 해당 spec 은 "4개 노드 타입은 노드 인스턴스의 config 를 노드 유형의 정적 기본 스키마에 투영한다"고 명시하고, `information_extractor` / `form` / `table` / `transform` 4행짜리 표를 **단일 진실**로 열거한다. 이번 구현은 코드 레벨에서 5번째 enricher(`manual_trigger`, `config.parameters[].name` → `.output.parameters.<name>`)를 이미 추가했다(`node-output-schema-enrichers.ts` 344행, `use-expression-context.ts` 두 분기 — `sourceType === "manual_trigger"` / `nodeType === "manual_trigger"`). 이 spec 파일의 `code:` frontmatter 가 변경된 파일을 직접 소유하고 있으므로, "4개" 텍스트와 표는 구현 merge 시점부터 사실과 어긋난다. `spec/4-nodes/7-trigger/*` 만 보면 아무 문제가 없어 보이지만, cross-spec 관점에서는 이 변경의 실제 SoT 문서가 trigger 영역이 아니라 expression-language 영역이라는 점이 간과됐다
  - 제안: `spec/5-system/5-expression-language.md §7.2` 표에 `manual_trigger` 행 추가(`config.parameters[].name` → `.output.parameters.<name>`) + "4개 노드 타입" 문구를 "5개 노드 타입"으로 갱신. plan 의 "spec 변경 불필요" 결론을 이 한 줄 갱신 범위로 정정 — 사용자 메모리 피드백("Plan must include spec updates: 구현 plan 은 spec 갱신까지 정식 phase 로 포함")과도 정합. 커밋 시 `spec/5-system/5-expression-language.md` 를 같은 PR 에 포함시킬 것을 권고

## 점검했으나 이상 없음 (참고)

- **데이터 모델**: `spec/1-data-model.md` §2.8 Trigger / §2.9 Schedule / §2.9.1 동기화 규칙이 target §1(트리거 진입 파라미터 공통 계약)의 `schedule.parameterValues` 서술과 정합. Node.type 목록(§2.6)의 `container_id` 제약도 target 의 "입력 포트 없음"·"container 불가" 서술과 일치
- **API 계약**: `spec/5-system/12-webhook.md` §5.2/§5.3, `spec/5-system/3-error-handling.md §1.7` 의 에러 코드 정규화(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)가 target §6 에러 코드 표와 상호 참조 일치
- **표현식 변수 계약**: `spec/5-system/5-expression-language.md §4.1/§4.5` 의 `$params`/`$input.parameters`/`$trigger` 구분이 target §1·§3.2·§5 의 `$params === $input.parameters` 축약형·`output.request` 필드 이름 집합과 정확히 일치(§4.5 가 명시적으로 target 1-manual-trigger.md §5.2 를 cross-link)
- **CONVENTIONS 원칙 참조**: target 이 인용하는 Principle 0/1.1/2/3.1/7/10/11 모두 `spec/conventions/node-output.md` 에 실존하며 서술 내용도 부합
- **RBAC/권한**: target 문서에는 신규 권한 구조 도입이 없음 — 충돌 없음
- **상태 전이**: target 은 비-블로킹 즉시완료 노드로 별도 상태 머신을 도입하지 않음 — 충돌 없음
- **providers/*.md (discord/slack 등)**: Chat Channel 관련 RBAC·secret 슬롯·HTTP 응답 코드 예외는 각 파일이 `spec/5-system/15-chat-channel.md §5.5/§5.5.1` 을 SoT 로 명시적으로 위임하고 있어 target scope 안에서 자기완결적 — 이번 변경(프론트 enricher)과도 무관

## 요약

이번 작업 자체(Manual Trigger `output.parameters.<name>` autocomplete enricher)는 런타임·API·데이터 모델·RBAC 를 건드리지 않는 순수 프론트엔드 힌트 추가이며, `spec/4-nodes/7-trigger/*` 본문과 데이터 모델·표현식 변수 계약·에러 코드 등 타 영역 spec 사이에 실질적 모순은 없다. 다만 변경된 두 코드 파일의 실제 SoT 는 `spec/4-nodes/7-trigger/` 가 아니라 `spec/5-system/5-expression-language.md` (frontmatter `code:` 소유)이며, 그 spec 이 enricher 패턴을 "4개 노드 타입"으로 명시적으로 열거하고 있어 이번 구현으로 즉시 stale 해진다. plan 의 "spec 변경 불필요" 판단은 이 cross-spec 소유 경계를 놓친 것으로, 별도 결정 없이 그대로 두면 spec-impl drift 가 하나 남는다.

## 위험도

MEDIUM
