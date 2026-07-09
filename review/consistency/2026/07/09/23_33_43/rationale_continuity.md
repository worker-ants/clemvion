# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/`(scope) — impl-done 검토, diff-base `origin/main`. 대상 워크트리(HEAD)에서
`git diff origin/main --stat` 로 확인한 실제 변경 spec 파일은 `spec/5-system/5-expression-language.md`
1개(§7.2 enricher 표 4→5행)이며, 배경 코드 변경은
`codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts`
(`enrichManualTriggerOutputSchema` 신설)·`use-expression-context.ts`(`manual_trigger` 분기 2곳),
plan `plan/in-progress/trigger-param-output-enricher.md`(신설)·
`plan/in-progress/node-output-redesign/manual-trigger.md`(체크박스 주석 갱신).

주의: orchestrator 가 이번 실행에 전달한 prompt payload(`_prompts/rationale_continuity.md`)에는
`spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md` 전문과 여러 무관 spec 의 `## Rationale`
발췌만 포함되어 있고, 실제 target 인 `5-expression-language.md`·§7.2·enricher·manual_trigger 관련
내용이 전혀 들어있지 않았다(파일 끝에 `... (truncated due to size limit) ...` 마커, 전체 1780줄 grep
결과 "expression" 문자열 0건). 이는 이전 실행(23_02_55, --impl-prep)에서 이미 지적된 payload
불일치와 같은 계열의 orchestrator 측 payload 구성 이슈로 보이며, 본 checker 의 판단 범위 밖이라
별도로 보고하지 않고 대상 워크트리를 절대경로로 직접 조사해 검토를 수행했다(호출 규약에 따른
"코드가 SoT" 원칙 적용).

## 발견사항

발견된 CRITICAL/WARNING 없음. 이하 검토 과정과 근거만 기록한다(INFO 없음 — 완전 정합).

- **[확인 — 문제 없음] 직전 --impl-prep 회차(23_02_55)의 WARNING 이 본 diff 로 완전히 해소됨**
  - target 위치: `spec/5-system/5-expression-language.md` §7.2 (라인 415, 423)
  - 과거 결정 출처: 같은 실행 계열의 `review/consistency/2026/07/09/23_02_55/rationale_continuity.md` WARNING — "§7.2 가 '4개 노드 타입'으로 고정 열거된 채 5번째(`manual_trigger`) enricher 가 spec 갱신 없이 코드에만 추가될 위험"
  - 상세: 현재 diff(`git diff origin/main -- spec/5-system/5-expression-language.md`)는 정확히 그 WARNING 이 요구한 두 수정을 모두 반영했다 — (a) "4개 노드 타입" → "5개 노드 타입"(라인 415), (b) 표에 `manual_trigger` 행 추가(라인 423, `config.parameters[].name` → `.output.parameters.<name>`). 코드의 `enrichManualTriggerOutputSchema`(export 5개 enrich 함수 중 5번째, `grep -n "^export function enrich"` 로 실측)·`use-expression-context.ts` 두 호출부(`$input` fallback, `$node[...].output`)와 spec 표 서술이 1:1 대응한다. `plan/in-progress/trigger-param-output-enricher.md` 도 "정정(consistency WARNING #1)" 문구로 이 조치를 명시적으로 기록했다.
  - 결론: 별도 조치 불요 — 이미 해소.

- **[확인 — 문제 없음] `conventions/node-output.md` Principle 1.1 (config/output 직교, 리터럴 값 output 중복 금지) 위반 아님**
  - target 위치: `enrichManualTriggerOutputSchema` (신규), §7.2 표 `manual_trigger` 행
  - 과거 결정 출처: `spec/conventions/node-output.md` Principle 1.1 "사용자가 UI에서 설정한 리터럴 값은 config 에만 존재하고, output 에 중복 복사하지 않는다" — 및 `spec/4-nodes/7-trigger/1-manual-trigger.md` §1 "`config.parameters` 와 `output.parameters` 는 이름은 같지만 shape 이 다르다 (CONVENTIONS Principle 1.1 직교성)"
  - 상세: 신규 enricher 는 `config.parameters[].name`(필드 **이름**)만 정적 JSON-schema property key 로 투영하며, 실제 **값**은 여전히 실행 시점(`output.parameters` record)에만 채워진다 — 편집기 자동완성용 스키마 힌트이지 런타임 `output` 데이터 자체가 아니다. 기존 4개 enricher(`form`/`table`/`transform`/`information_extractor`)가 이미 동일 패턴으로 코드에 존재했고 spec §7.2 는 그 패턴을 "config 기반 스키마 보강" 이라는 명칭으로 이미 승인해 두었다(`db496a3c2`, PR #516 spec↔code 역방향 감사에서 신설). manual_trigger 확장은 그 승인된 패턴의 5번째 인스턴스일 뿐, 새 원칙을 도입하거나 Principle 1.1 을 우회하지 않는다.
  - 결론: 원칙 위반 없음.

- **[확인 — 문제 없음] "4개 enricher" 를 닫힌 집합으로 못박은 과거 결정/Rationale 부재 — 재도입·번복 대상 자체가 없음**
  - target 위치: §7.2 enricher 표 전체 이력
  - 과거 결정 출처: `db496a3c2`(PR #516, spec↔code 전수 상호 감사) 커밋에서 이 표가 최초 도입됨
  - 상세: 해당 커밋 diff 를 확인한 결과(`git show db496a3c2 -- spec/5-system/5-expression-language.md`), "4개 노드 타입"이라는 문구는 **당시 코드에 이미 존재하던 enricher 개수를 사실대로 기술**한 것이지, "이 표는 4개로 고정하고 추가하지 않는다"는 명시적 제약을 선언한 문장이 아니다. 이 항목은 `## Rationale` 헤딩 아래가 아니라 §7.2 본문 규약이며, 본문 어디에도 "trigger 계열 노드는 의도적으로 enricher 대상에서 제외한다" 류의 서술이 없다(spec 전체에서 `manual_trigger`·`enricher`·`autocomplete` 교차검색 결과 `5-expression-language.md` 외 다른 `spec/5-system/*.md` 에는 관련 언급 자체가 없음). 따라서 본 diff 는 "기각된 대안의 재도입"에 해당하지 않는다 — 애초에 "trigger 는 enricher 대상 아님"이라는 기각 결정이 존재하지 않았다.
  - 결론: 재도입 대상 없음.

- **[확인 — 문제 없음] 결정 번복 시 신규 Rationale 미작성 — 해당 없음(번복이 아니라 확장)**
  - 상세: 이번 변경은 과거 결정을 뒤집는 것이 아니라 기존에 승인된 패턴(§7.2 enricher 투영)을 5번째 노드 타입으로 **확장**하는 decision-free 변경이다. 선례(`db496a3c2`)도 이 표를 신설할 때 별도 `## Rationale` 항목을 추가하지 않았으므로, 이번 확장도 같은 문서화 관례를 따라 표 자체 갱신만으로 충분하며 신규 Rationale 부재가 "무근거 번복"을 뜻하지 않는다. `plan/in-progress/trigger-param-output-enricher.md` 도 이를 "decision-free doc sync (신규 Rationale 불요)"로 명시적으로 판단해 기록해 두었다 — 판단 근거가 plan 에 남아 있어 추적 가능하다.

## 요약

`spec/5-system/5-expression-language.md` §7.2 의 `manual_trigger` enricher 행 추가는 (1) 같은 계열의 직전 --impl-prep 검토(23_02_55)가 지적한 "spec 미동기화" WARNING 을 정확히 해소한 후속 조치이고, (2) `conventions/node-output.md` Principle 1.1(config/output 직교)을 우회하지 않으며 — 값이 아닌 필드 이름만 정적 스키마에 투영하는 순수 편집기 힌트이기 때문, (3) 과거에 "trigger 노드는 enricher 대상에서 제외한다"는 명시적 기각 결정이 spec 어디에도 존재하지 않아 재도입 문제가 성립하지 않는다. `spec/5-system/` 범위 안에서 이번 diff 가 건드린 유일한 문서·유일한 절(§7.2)에 대해 Rationale 연속성 관점의 충돌·번복·원칙 위반은 발견되지 않았다.

## 위험도

NONE
