# 요구사항(Requirement) Review — trigger-param-output-enricher

## 발견사항

- **[INFO]** e2e 면제 근거가 화이트리스트 조건과 정확히 일치하지 않음
  - 위치: `plan/in-progress/trigger-param-output-enricher.md` "테스트" 절 — `e2e: 프론트 autocomplete 전용·런타임 무변경 → 면제 후보(화이트리스트 확인)`
  - 상세: 이번 diff 는 `node-output-schema-enrichers.ts`(+79)와 `use-expression-context.ts`(+8)에 실질 로직(신규 export 함수 + 2개 분기)을 추가한다 — 주석/공백/포맷만의 변경이 아니고 `*.test.ts` 전용 변경도 아니다. `PROJECT.md` §e2e 면제 화이트리스트는 "코드 변경(.ts 등)이 한 줄이라도 포함되면 e2e 는 default 로 수행"하며, 화이트리스트 항목은 `*.md`/`spec·plan·review`/`.claude/**`/i18n dict/주석 전용/CI/정적 자산으로 한정된다. "프론트 autocomplete 전용·런타임 무변경"이라는 자체 판단(self-judgment)은 명시적으로 화이트리스트 조건이 아니며, PROJECT.md 는 "자가 판단·'변경이 작아서' 는 모두 면제 사유가 아니다"라고 못박는다. 다만 이 프로젝트는 기존 4개 enricher(`enrichFormOutputSchema` 등) 도입 시에도 동일 패턴(순수 프론트 UX 힌트, 런타임 비영향)이었고 이번 변경도 같은 계열이라 기능적 리스크는 낮다.
  - 제안: RESOLUTION/PR 단계에서 e2e 를 실제로 수행하거나, "면제 후보"가 아니라 화이트리스트의 구체적 어느 항목에 해당하는지 명시(해당 사항이 없으면 실행)하도록 plan 을 갱신. 코드 자체의 결함은 아니며 워크플로 증적 정확성 문제.

- **[INFO]** `spec/4-nodes/7-trigger/0-common.md` §3 표의 `output: $params` 축약 표기가 §3.2/§5.1 JSON 예시(`output.parameters`)와 표기가 다름 — pre-existing 이슈이며 이번 PR 의 코드 결함이 아님. plan 후속 절 및 기존 consistency-check(`convention_compliance.md` WARNING)에 이미 non-blocking 후속으로 정확히 식별·기록돼 있어 추가 조치 불필요(project-planner 위임 확인됨).

## 점검 결과 상세

1. **기능 완전성**: `enrichManualTriggerOutputSchema`는 기존 4개 enricher(`enrichFormOutputSchema` 등)와 동일한 계약(undefined baseSchema→그대로 반환, 빈/비배열 parameters→base 그대로, 안전 필드만 projection, 병합 후 clone 반환)을 그대로 구현했고, `use-expression-context.ts`의 두 호출부(`$input` 스키마 폴백, `$node["Label"].output` 매핑)에 정확히 배선됨. `manual_trigger` 리터럴 문자열은 백엔드 `manual-trigger.schema.ts`의 `type: 'manual_trigger'` 및 프론트 `is-trigger.ts`의 기존 사용과 일치.
2. **엣지 케이스**: baseSchema undefined, config undefined, parameters `[]`/비배열, unsafe 키(`__proto__`/공백/숫자시작), output 프로퍼티 부재(clone+warn), `output.parameters`가 열린 record(`properties` 없음)인 경우 모두 테스트로 커버되고 구현과 일치. 40/40 테스트 통과 확인(`vitest run node-output-schema-enrichers.test.ts`).
3. **TODO/FIXME**: 변경분에 TODO/FIXME/HACK/XXX 없음.
4. **의도-구현 일치**: JSDoc 주석이 "config.parameters(배열) → output.parameters(name-keyed record) projection, config.parameters 는 일부러 projection 안 함" 이라고 설명하며 구현이 정확히 그 동작. `MANUAL_TRIGGER_TYPE_MAP`은 백엔드 zod enum `['string','number','boolean','object','array']`(`manual-trigger.schema.ts` line 14)과 1:1 일치 — "identity guard" 주석도 정확.
5. **에러 시나리오**: `output` 프로퍼티 부재 시 dev 전용 `console.warn` 후 clone 반환(런타임 throw 없음) — 기존 4개 enricher와 동일 패턴으로 실행 안전성 유지.
6. **데이터 유효성**: `isSafeFieldName` 재사용(prototype pollution 방지 + 식별자 정규식) — 신규 로직 없이 기존 안전장치 재사용, 별도 결함 없음.
7. **비즈니스 로직**: `config.parameters` vs `output.parameters` 직교성(spec `1-manual-trigger.md` §1 경고 박스, CONVENTIONS Principle 1.1)을 정확히 반영 — enricher 는 `output.parameters` 쪽에만 projection하고 `config.parameters`는 손대지 않음(사용자가 겪은 버그의 근본 원인과 정확히 대응).
8. **반환값**: 모든 경로(undefined base / 빈 params / 정상 projection / output 부재 fallback)에서 `JsonSchemaNode | undefined` 반환, 원본 mutate 없음("does not mutate the base schema" 테스트로 검증).
9. **spec fidelity**: 실제 SoT 는 `spec/5-system/5-expression-language.md §7.2`(frontmatter `code:` 가 `codebase/frontend/src/components/editor/expression/*.{ts,tsx}` 소유) — 본 diff 가 해당 표에 `manual_trigger` 행 + "4개"→"5개" 갱신을 **같은 커밋에 포함**해 line-level 로 코드와 일치시킴(§7.2 표 규칙 문구 `config.parameters[].name → .output.parameters.<name>`가 구현과 정확히 대응). `spec/4-nodes/7-trigger/1-manual-trigger.md` §4/§5.1의 `output.parameters` shape·`config.parameters` 배열 정의도 구현·JSDoc 인용과 일치. 사전 consistency-check(--impl-prep, `review/consistency/2026/07/09/23_02_55/`)가 정확히 이 §7.2 drift 를 WARNING #1로 지적했고 본 diff 가 그 지적을 해소했음을 교차 확인함(BLOCK: NO, Critical 0).

## 요약

Manual Trigger의 `output.parameters` autocomplete enricher는 기존 4개 enricher(Form/Table/Transform/InfoExtractor)와 동일한 패턴·안전장치를 정확히 재사용해 구현됐고, 신규 테스트 7건을 포함해 40개 유닛 테스트가 전부 통과한다. 타입 매핑(`MANUAL_TRIGGER_TYPE_MAP`)은 백엔드 zod enum과 1:1 일치하며, `config.parameters`(배열)와 `output.parameters`(name-keyed record)의 직교성을 정확히 반영해 사용자가 겪은 원인 버그(`$node["Manual Trigger"].config.parameters.region` 오사용)를 해소하는 방향으로 자동완성을 유도한다. 이 기능의 실제 SoT인 `spec/5-system/5-expression-language.md §7.2`도 같은 diff 안에서 갱신되어 spec-code line-level 정합이 확보됐다(사전 consistency-check WARNING이 정확히 해소됨). 기능적 결함이나 CRITICAL/WARNING 급 spec 불일치는 발견되지 않았고, 유일한 특이사항은 e2e 실행 근거("면제 후보")가 PROJECT.md 화이트리스트 문구와 엄밀히 일치하지 않는 프로세스성 INFO, 그리고 이미 project-planner 후속으로 정확히 추적 중인 `0-common.md §3` 표기 정밀성 이슈(pre-existing, 이번 PR 무관)뿐이다.

## 위험도

LOW
