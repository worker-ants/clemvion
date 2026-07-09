# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/7-trigger/` (0-common.md · 1-manual-trigger.md · providers/_overview.md · providers/discord.md · providers/slack.md · providers/telegram.md) — impl-prep 검토, 배경 작업은 `plan/in-progress/trigger-param-output-enricher.md` (Manual Trigger `output.parameters` 자동완성 enricher, 프론트엔드 전용).

## 발견사항

### [WARNING] Expression Language spec §7.2 "config 기반 스키마 보강(enricher)" 표가 "4개 노드 타입"으로 고정 열거 — 5번째(manual_trigger) 추가가 계획에서 spec 갱신 없이 진행됨

- target 위치: 이번 plan 은 `spec/4-nodes/7-trigger/` 범위 안에서는 spec 변경이 없다고 명시한다 (`plan/in-progress/trigger-param-output-enricher.md` §목표 "런타임/spec 변경 아님" · §비고 "spec 변경 불필요"). 코드 변경은 `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` (`enrichManualTriggerOutputSchema` 신설) + `use-expression-context.ts` (manual_trigger 분기 2곳).
- 과거 결정 출처: `spec/5-system/5-expression-language.md` §7.2 (라인 405-424, "## Rationale" 절이 아니라 본문 규약이지만 이 기능의 단일 SoT 표):
  > "**config 기반 스키마 보강 (enricher)** — 미실행 상태에서도 사용자가 config 로 선언한 출력 필드가 힌트되도록, **4개 노드 타입**은 노드 인스턴스의 config 를 노드 유형의 정적 기본 스키마에 투영한다 (`node-output-schema-enrichers.ts` …)" — 이어지는 표는 `information_extractor`/`form`/`table`/`transform` 4행만 명시적으로 열거한다.
  이 문서의 frontmatter `code:` 는 `codebase/frontend/src/components/editor/expression/*.{ts,tsx}` 를 명시적으로 포함한다 — 즉 이번에 수정되는 두 파일 모두 이 spec 문서의 SoT 코드 글롭 안에 있다.
  이 표 자체가 "4개 노드 타입" 이라는 문구·행 개수로 고정된 것은 최근 결정이 아니라 **과거 spec↔code 전수 감사(PR #516, `db496a3c2`)가 코드에 이미 있던 4개 enricher 를 spec 이 못 따라가던 drift 를 발견해 신설**한 항목이다(같은 영역이 한 번 drift 로 지적된 이력이 있음).
- 상세: `enrichManualTriggerOutputSchema` 추가로 enricher 가 적용되는 노드 타입은 실질적으로 5개(+`manual_trigger`)가 되지만, plan 은 이 spec 표를 갱신 대상에 포함하지 않았고("스펙 변경 불필요"라고 명시적으로 disclaim), 새 Rationale 도 작성하지 않는다. 결과적으로 배포 후 §7.2 는 "4개 노드 타입"·4행 표라는 **사실과 다른 문장**을 갖게 되어, PR #516 이 교정했던 것과 같은 종류의 spec-code drift 가 이 PR 로 재발한다. 이는 "결정의 무근거 번복"(과거 결정을 확장하면서 해당 SoT 표·Rationale 을 갱신하지 않음)에 해당한다 — 단, 이 표는 엄밀히는 `## Rationale` 헤딩이 아니라 본문 규약이므로 "합의된 원칙"에 가깝지 "기각된 대안 재도입"은 아니다.
- 기능적으로는 문제 없음: 신규 enricher 는 `config.parameters[].name` → `output.parameters.<name>` 이름/타입만 투영하고 값은 echo 하지 않아 `conventions/node-output.md` Principle 1.1(config↔output 직교) 을 위반하지 않으며, `0-common.md §1/§3` 이 이미 규정한 `output.parameters` (record, name-keyed) 와 정확히 정합한다. 기존 4개 enricher(`enrichFormOutputSchema` 등)와 동일한 안전장치(`isSafeFieldName`, dev-only 콘솔 warn, silent fallback) 패턴을 그대로 재사용해 신규 원칙 위반은 없다.
- 제안: 이번 PR(또는 후속 커밋)에서 `spec/5-system/5-expression-language.md` §7.2 를 함께 갱신 — (a) "4개 노드 타입" → "5개 노드 타입", (b) 표에 `manual_trigger | config.parameters[].name → .output.parameters.<name>` 행 추가. 이 변경은 decision-free doc sync(기존 4건도 각자 별도 코드 PR 후 별도 spec-sync 감사에서 소급 반영됐던 선례가 있음)이므로 신규 `## Rationale` 항목까지는 불필요하지만, plan 의 "수정 대상"/"비고"에서 "spec 변경 불필요" 문구는 이 표에 한해 부정확하므로 정정 필요.

## 요약

`spec/4-nodes/7-trigger/` 자체(0-common.md·1-manual-trigger.md·providers/*)의 본문·Rationale 은 이번 작업과 직접 충돌하지 않는다 — 기획 중인 `enrichManualTriggerOutputSchema` 는 `config`(정의 스키마)와 `output`(런타임 값)의 직교성(Principle 1.1), `$params`/`output.parameters` 명명 규약(0-common §1/§3), 기존 4개 enricher 의 확립된 안전장치 패턴을 그대로 따르는 자연스러운 확장이며, 과거에 명시적으로 기각된 대안을 되살리거나 트리거 문서 자체의 Rationale 을 뒤집는 지점은 발견되지 않았다. 다만 이 기능의 실제 SoT 인 `spec/5-system/5-expression-language.md §7.2`("4개 노드 타입" 고정 열거, 이 PR 이 건드리는 두 코드 파일이 frontmatter `code:` 글롭에 포함됨)가 갱신 대상에서 빠져 있고, 이 영역은 과거 감사(PR #516)가 정확히 같은 종류의 spec-code drift 를 교정한 이력이 있어 재발 위험이 있다. target 문서 범위(`spec/4-nodes/7-trigger/`) 밖이지만 같은 기능의 단일 SoT 이므로 함께 갱신을 권고한다.

## 위험도

LOW
