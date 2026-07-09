# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** JSDoc 이 실제로 구현되지 않은 `$params.<name>` 자동완성을 "된다"고 명시 — 원인이 된 사용자 혼동과 동일 계열의 과잉주장
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` (`enrichManualTriggerOutputSchema` 함수 JSDoc, "Project `config.parameters[].name` into `output.parameters.<name>` so `$node["Manual Trigger"].output.parameters.<name>` (and `$params.<name>`) autocompletes pre-run" 문장) — 동일 문구가 `plan/in-progress/trigger-param-output-enricher.md` "## 목표" 섹션에도 반복됨("`$node["Manual Trigger"].output.parameters.<name>` / `$params.<name>` 이 실행 전에도 자동완성되게 한다")
  - 상세: `enrichManualTriggerOutputSchema` 는 `config.parameters[].name` 을 `output.parameters.<name>` 에 projection 할 뿐이며, 이 enricher 의 결과는 `$node["Manual Trigger"].output.` / `$input.` 자동완성 경로에서만 소비된다(`use-expression-context.ts` 의 두 호출부). 그러나 `$params` 는 프론트엔드 자동완성의 최상위 변수 목록(`expression-constants.ts` `ROOT_VARIABLES`)에 아예 존재하지 않고, `use-expression-suggestions.ts` 에도 `$params.` 접두어를 처리하는 분기가 없다(grep 결과 `$params` 는 오직 이 JSDoc 문장·plan 문서·백엔드 런타임 평가기(`expression-resolver.service.ts`)·인앱 사용자 가이드(`content/docs/02-nodes/triggers.mdx`, `$params.email` 을 "축약형(권장)" 으로 소개)에만 등장). 즉 이 PR 이후에도 에디터에서 `{{ $par` 를 타이핑하면 `$params` 자체가 자동완성 후보로 뜨지 않는다 — 코드는 정확하나 주석이 실제 동작 범위를 과대 서술한다. 이 작업의 발단이 "빈 문자열 자동완성 힌트 부재로 사용자가 잘못된 경로(`config.parameters.<name>`)로 유도됐다"는 것이었던 만큼, 검증되지 않은 "된다" 서술을 남기는 것은 같은 계열의 문서 신뢰도 문제를 재생산할 위험이 있다(다음 개발자가 이 JSDoc 만 보고 `$params` 자동완성이 이미 동작한다고 오신할 수 있음).
  - 제안: JSDoc 에서 `$params.<name>` autocompletes 문구를 제거하거나, "`$params` 는 현재 루트 변수 자동완성 목록에 없어 이 enricher 의 영향을 받지 않는다(별도 후속 필요)" 로 정정. plan 파일의 "## 목표" 문장도 동일하게 정정하거나, `$params` 자동완성 자체를 별도 후속 작업으로 명시.

- **[INFO]** CHANGELOG.md 미갱신 — 저장소 관례상 사용자 체감 가능한 변경은 "Unreleased" 항목으로 기록되는데(예: 바로 위 커밋의 "Manual Trigger `defaultValue` 파라미터가 실행에서 무시되던 버그 수정" 항목, 키보드 단축키·배지 등 유사 규모 변경도 모두 항목화됨) 이번 enricher 추가는 항목이 없음
  - 위치: `CHANGELOG.md` (신규 항목 없음)
  - 상세: `.claude/docs/plan-lifecycle.md`/`developer` SKILL 워크플로 체크리스트에 CHANGELOG 갱신이 필수 게이트로 명시돼 있지는 않아 차단 사유는 아니나, 이 변경은 실사용자 리포트가 트리거였고("인천 날씨 알림" 워크플로에서 표현식이 빈 값을 반환) 자동완성 UX 를 실제로 바꾸는 변경이라 저장소의 기존 관례(유사 규모 UX 변경 전부 CHANGELOG 항목화)와의 일관성 관점에서 눈에 띈다.
  - 제안: 필수는 아니나, 다른 in-progress 항목들과 병합 시점에 "Unreleased" 항목 추가를 고려.

## 요약

이번 변경은 문서화 관점에서 전반적으로 모범적이다 — 신규 export 함수(`enrichManualTriggerOutputSchema`, `MANUAL_TRIGGER_TYPE_MAP`)에 기존 4개 enricher와 동일한 패턴의 상세 JSDoc이 달려 있고, 테스트 파일에도 의도를 설명하는 헤더 주석이 있으며, spec 소유 관계(`code:` glob)를 스스로 식별해 `spec/5-system/5-expression-language.md` §7.2 표를 "4개→5개"로 정확히 동기화했고, plan 문서(`plan/in-progress/trigger-param-output-enricher.md`)에 배경·근거·후속 과제까지 상세히 기록돼 있다. 다만 신규 JSDoc과 plan "목표" 섹션이 공통적으로 `$params.<name>` 자동완성이 "된다"고 서술하는데, 실제로는 `$params` 가 에디터 자동완성 최상위 변수 목록에 아예 없어(`ROOT_VARIABLES`, `use-expression-suggestions.ts` 모두 미처리) 이 enricher 의 영향권 밖이다 — 이 PR 의 발단이 된 "config vs output 경로 혼동"과 동일한 계열의, 검증되지 않은 문서 과잉주장이라는 점에서 정정 가치가 있다. CHANGELOG 미갱신은 저장소 관례상 참고 사항 수준이다.

## 위험도

LOW
