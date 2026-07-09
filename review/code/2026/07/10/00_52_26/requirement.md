# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** `$params.<name>` 하위키 자동완성이 enricher(§7.2) 산출 스키마와 결합돼 노출됨을 알리는 주석/문서가 갱신되지 않음 (stale cross-reference, 코드 버그 아님)
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts:332-333` (`enrichManualTriggerOutputSchema` JSDoc), `plan/in-progress/trigger-param-output-enricher.md` "목표" 섹션의 "(주의: `$params` 루트 변수의 하위키 자동완성은 별개 관심사로 본 enricher 영향권 밖 — ai-review WARNING #1 정정.)"
  - 상세: 두 문서 모두 "enricher 가 투영한 `output.parameters.<name>` 스키마는 `$params` 루트 변수 하위키 자동완성과 무관하다"고 명시한다. 그런데 본 PR 의 `$params.` 핸들러(`use-expression-suggestions.ts:1461-1480`)는 `expressionData.inputSchema?.properties?.parameters` 를 그대로 소비하며, `use-expression-context.ts:198-210` 확인 결과 트리거 직속 successor 의 `inputSchema` 는 `enrichManualTriggerOutputSchema` 로 enrich 된 스키마를 `.output` 으로 descend 한 것 — 즉 `inputSchema.properties.parameters` 는 정확히 enricher 가 투영한 그 서브스키마다. 따라서 실제로는 enricher 산출물이 (트리거 직속 successor 한정) `$params.<name>` 자동완성도 구동한다 — 신규 plan 파일(`plan/in-progress/trigger-params-autocomplete.md`) 자체는 이 연결을 정확히 서술("enricher 로 트리거 직속 successor 는 `.properties.parameters` 가 이름별로 enrich됨")하고 있어 신규 PR 문서와 기존 comment/plan 문서가 상충한다.
  - 제안: `node-output-schema-enrichers.ts` 의 해당 JSDoc 괄호 문장과 `trigger-param-output-enricher.md` "목표"/"비고"의 대응 문장을 "직속 successor 한정으로 `$params.<name>` 자동완성에도 관여한다"로 정정 (기능 결함 아님, 코드 fix 대상 아니고 문서 정확성 이슈이므로 후속 커밋에서 처리 권장).

- **[INFO]** `BUILT_IN_PICKER_VARIABLES` 를 통한 Variable Picker UI 에서 `$params` 는 (다른 `isExpandable` root 변수인 `$loop`/`$item`/`$thread`/`$trigger`/`$env` 와 동일하게) 하위키 드릴다운 없이 리터럴 삽입만 지원
  - 위치: `codebase/frontend/src/components/editor/expression/expression-constants.ts:1085` (`$params` 항목), `variable-picker.tsx:432-449` (`scopedBuiltIns.map` → `PickerItem`, `isExpandable` 필드 미전달)
  - 상세: 자동완성(에디터 인라인)에서는 `isExpandable: true` 로 인해 `$params` 선택 시 "." 이 자동 삽입되지만, Variable Picker(팝오버)의 `BUILT_IN_PICKER_VARIABLES` 타입은 `isExpandable` 을 아예 나르지 않아 그쪽에서는 단순 `$params` 텍스트 삽입만 된다. 다만 이는 이번 diff 가 새로 만든 비일관이 아니라 기존 패턴(`$loop`/`$thread`/`$trigger`/`$env` 모두 동일)을 그대로 따른 것 — 회귀 아님, 요구사항 위반도 아님.
  - 제안: 별도 조치 불요(회색지대, 기존 정책 일관 적용).

## 요구사항 충족 관점 검증 결과

1. **기능 완전성**: `$params` 가 `ROOT_VARIABLES` 에 `$input` 바로 뒤로 추가되고(`expression-constants.ts:1085`), `use-expression-suggestions.ts` 에 `$params.` drill 핸들러(`:1461-1480`)가 추가되어 plan(`trigger-params-autocomplete.md`) 의 설계·테스트 체크리스트 항목을 모두 충족. `$input.` 핸들러와 대칭 구조(같은 `buildNestedSuggestions` 재사용, 같은 `tokenStart`/`leafLength` 계산)로 구현 완전성 확인.
2. **엣지 케이스**: `inputSample.parameters` 가 `undefined`/원시값/배열인 경우 모두 `{}` fallback(`:1463-1467`) — 백엔드 `expression-resolver.service.ts:77-88` 의 `paramsFromInput` 계산과 동일한 가드(object 타입 && `!Array.isArray`)로 프론트-백엔드 정합. `inputSchema` 부재 시 `paramsSchema` 는 `undefined` 로 안전 처리되어 `getSchemaKeys`가 빈 배열 반환. 빈 컬렉션(파라미터 없음), prefix 필터링, non-successor 노드(파라미터 없는 입력) 케이스 모두 테스트로 커버되고 실행 확인(vitest 54/54 PASS, 신규 5건 포함).
3. **TODO/FIXME**: 리뷰 대상 3개 코드 파일에 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 함수 진입 주석("`$params.` → shortcut for `$input.parameters`")과 실제 로직이 일치. 단, 인접(비-diff) 파일의 stale 주석 1건 발견(위 INFO 참조) — 결함이 아니라 문서 동기화 이슈.
5. **에러 시나리오**: 별도 예외 경로 없음(순수 UI 힌트, 실행 경로 미변경) — spec 의 "순수 UX 힌트, 런타임 검증·엔진·백엔드 output shape 무변경" 원칙과 일치. 에러 발생 여지 있는 입력(non-object parameters)도 안전 fallback 처리됨.
6. **데이터 유효성**: `typeof rawParams === "object" && !Array.isArray(rawParams)` 가드가 백엔드 resolver 의 검증 로직과 정확히 대칭 — 프론트 힌트가 런타임 값 형태와 어긋나지 않음.
7. **비즈니스 로직**: "`$params` ≡ `$input.parameters`, 값 없으면 하위키 없음(오도 없음)" 이라는 plan 의 정책이 코드에 정확히 반영. `$params` 는 `scopeKey` 미설정으로 `$input` 과 동일하게 컨테이너 스코프 무관 항상 노출 — plan 의 "$input 과 동일 정책" 요구와 일치.
8. **반환값**: `$params.` 매치 시 `{ suggestions, tokenStart, tokenEnd }` 항상 반환(빈 배열 포함) — 다른 핸들러와 동일한 반환 계약 준수, 모든 분기에서 undefined 반환 없음.
9. **spec fidelity**: `spec/5-system/5-expression-language.md:171`(`$params` = `$input.parameters` 단축 참조, Object 타입)과 `spec/4-nodes/7-trigger/1-manual-trigger.md:150`(`$params.orderId → "abc-123" (단축 — $input.parameters 별칭)`)이 이미 `$params` 를 규정하고 있으며, 본 구현은 그 규정을 line-level 로 그대로 따라감(소스 = `inputSample.parameters`/`inputSchema.properties.parameters`, 즉 `$input.parameters` 와 동일 소스). spec §7.2 자동완성 데이터 소스 표의 `manual_trigger` enricher 행(`config.parameters[].name → .output.parameters.<name>`)과도 `use-expression-context.ts` 스레딩을 통해 정합적으로 연결됨(위 INFO 항목은 이 연결에 대한 *인접 문서*의 서술 누락일 뿐, spec 본문 자체와의 불일치 아님). spec §7.1 "자동완성 트리거" 표는 `$input.`/`$node["`/`$var.` 만 예시로 나열하고 `$params.` 행을 명시하지 않으나, 표 자체가 "..." 로 비완전 열거임을 명시하고 있어(§4.1 변수 목록에는 `$params` 가 이미 있음) 이는 회색지대(INFO) — CRITICAL 사유 아님. 필드명·기본값·에러코드·상태 전이 등 spec 규정 요소 중 코드와 어긋나는 부분 없음. SPEC-DRIFT 해당 없음(spec 이 이미 정확히 규정한 동작을 구현이 뒤늦게 따라잡은 catch-up 케이스).

## 요약

`$params.<name>` 자동완성 추가는 spec(`5-expression-language.md:171`, `1-manual-trigger.md:150`)이 이미 규정한 동작을 프론트엔드 자동완성 UI 에 뒤늦게 반영하는 catch-up 구현으로, `$input.` 핸들러와 완전히 대칭적인 구조·백엔드 resolver(`paramsFromInput`)와 동일한 유효성 가드를 재사용해 정확히 구현됐다. 신규 테스트 5건을 포함해 전체 54개 테스트가 통과했고 엣지 케이스(파라미터 없음/원시값/배열/비-successor 노드)도 안전하게 fallback 처리된다. spec 본문과 line-level 로 일치하며 CRITICAL 급 결함은 없다. 유일한 지적 사항은 이번 diff 범위 밖의 인접 문서(enricher JSDoc 주석, 선행 plan 파일의 "비고")가 본 PR 로 인해 사실과 어긋나게 된 서술을 갖게 된 점으로, 기능 결함이 아닌 문서 동기화 성격의 INFO 사항이다.

## 위험도

NONE
