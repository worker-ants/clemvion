# 유지보수성(Maintainability) 코드 리뷰 — eia-inputdata-marker-guard

## 발견사항

- **[CRITICAL]** `ExecutionDto.inputData` JSDoc 이 이번 변경으로 실제 동작과 정반대를 계속 주장한다 (stale/self-contradictory 주석)
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:52` (블록 전체는 49~62줄, `ExecutionDto` 클래스의 `inputData` 필드)
  - 상세: 이 필드 JSDoc 은 지금도 `"**값-패턴 마스킹 대상이 아니다** (형제 `outputData`/`error` 와 다르다) ... 근거 정본: `ExecutionsService.toResponseExecution`."` 그리고 `"**이 카브아웃은 `Execution` 레벨 한정이다**"` 라고 명시한다. 그런데 같은 PR 이 `codebase/backend/src/modules/executions/executions.service.ts` 의 `toExecutionDto`(1009행)를 `inputData: redactStoredDataForResponse(execution.inputData)` 로 바꿔 이 카브아웃 자체를 폐지했고, `MASKED_INPUT_DATA_REASON` 앵커도 완전히 삭제했다(코드베이스 전수 grep 0건 — "폐기" 방향으로 완결된 것은 맞다). 즉 `ExecutionDto.inputData` 필드가 실제로 참조되는 함수(`toResponseExecution`이 아니라 `toExecutionDto`)는 이 필드를 이제 **마스킹한다**. JSDoc 이 "근거 정본"이라고 인용하는 함수 이름 자체가 이제 그 필드를 반박하는 코드를 담고 있다.
    같은 파일 안 자매 클래스 `NodeExecutionSummaryDto.inputData`(173~182행)는 이번 diff 에서 정확히 반대 방향("**같은 정책**이다. 2026-08-20 이전에는 그쪽만 원문이었다")으로 **정확히 갱신됐다** — 그러나 `ExecutionDto.inputData` 쪽은 인용 문구 하나(`MASKED_INPUT_DATA_REASON` → `ExecutionsService.toResponseExecution`)만 바뀌고 핵심 주장("마스킹 대상이 아니다", "카브아웃은 Execution 레벨 한정이다")은 그대로 남았다. 한 파일 안에서 한쪽 자매는 고치고 한쪽은 놓친 전형적인 "자매 표면 누락" 패턴이며, 이 필드가 정확히 이 PR 의 주제(Execution.inputData 마스킹 전환)라서 파급이 크다 — Swagger 문서·IDE 툴팁을 읽는 다음 개발자가 이 필드를 "원문이 나간다"고 오신할 위험이 실재한다.
  - 제안: `ExecutionDto.inputData` JSDoc 을 `NodeExecutionSummaryDto.inputData`(173~182행)·`background-run-response.dto.ts`(20~26행)와 같은 방향으로 재작성한다 — "자격증명으로 판별된 값은 마스킹되어 반환된다(DB 원문과 다를 수 있음)" 로 시작하고, `webhook 민감 헤더 ingestion 캐비엇(60~61행)은 유지하되 "카브아웃" 관련 문장은 전부 제거한다.

- **[WARNING]** 부분 편집으로 문장이 문법적으로 끊어져 의미가 뒤집힌 것처럼 읽힘
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:303-304` (`toNodeExecutionDto` 내부 `inputData` 필드 주석)
  - 상세: 원문은 `"**노드 레벨이라 `inputData` 도 마스킹한다** — 카브아웃은 `Execution` 레벨 한정(`MASKED_INPUT_DATA_REASON` 참조)."` 이었는데, 이번 diff 는 마지막 절만 `"2026-08-20 부터 `Execution` 레벨도 마스킹한다 — 두 레벨이 같은 규칙이다."` 로 치환했다. 그 결과 지금 소스에는 다음 문장이 그대로 남는다: `"**노드 레벨이라 `inputData` 도 마스킹한다** — 카브아웃은 2026-08-20 부터 `Execution` 레벨도 마스킹한다 — 두 레벨이 같은 규칙이다."` — "카브아웃은"(주어) 뒤에 붙는 서술이 "Execution 레벨도 마스킹한다"라서, 마치 **카브아웃(예외)이 마스킹을 수행한다**는 식으로 읽힌다(카브아웃은 원래 "마스킹을 면제"하는 개념이라 의미가 역전돼 보인다). 편집이 문장 뒷부분만 갈아끼우고 앞부분 주어("카브아웃은")를 정리하지 않아 생긴 비문이다. 자매 파일 `background-runs.service.spec.ts:224` 는 같은 종류의 편집을 하면서도 `"...레벨 한정이었고(2026-08-20 폐지), 이 표면엔 애초에 재제출 소비처가 없다."` 로 문장을 완결시켜 이 문제가 없다.
  - 제안: `"— 카브아웃(재제출 예외)은 `Execution` 레벨 한정이었으나 2026-08-20 부로 폐지돼, 두 레벨이 같은 규칙(전면 마스킹)이다."` 처럼 주어-서술 호응을 맞춰 재작성.

- **[WARNING]** 신규 문자열이 이 dict 디렉터리 전체의 확립된 인용부호 표기 관례를 벗어남
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/history.ts:15` (`maskedInputBlocked` 신규 키)
  - 상세: `"Some inputs were masked as credentials. Enter them directly, or turn on “Use original input”."` — UI 라벨을 인용할 때 `“`/`”`(유니코드 curly-quote 이스케이프)를 쓴 것은 `codebase/frontend/src/lib/i18n/dict/en/` 디렉터리 전체(실측: grep 전수)에서 **이 한 곳뿐**이다. 같은 목적(버튼/라벨 이름 인용)의 기존 관례는 예외 없이 straight quote — `\"Test Run\"`(`integrations.ts:96`), `\"Load models\"`(`knowledgeBases.ts:73`), `'{{name}}'`(`workspace.ts` 다수) 등. 같은 PR 이 추가한 `editor.ts` 의 `runWithInputMasked` 는 인용부호 없이 그냥 `(***)` 로 표기해 일관성 문제가 더 도드라진다. 기능상 문제는 없으나(렌더 결과는 정상적인 curly quote), 향후 검색·치환·grep 기반 유지보수(예: "인용부호 전수 straight-quote 통일" 같은 리팩터) 시 이 한 줄만 다른 인코딩으로 남아 누락되기 쉽다.
  - 제안: 기존 관례에 맞춰 `\"Use original input\"` (또는 `'Use original input'`) 로 통일.

## 요약

전반적으로 이번 변경은 마스킹 정책 전환(카브아웃 폐지)이라는 단일 결정을 backend 세 표면(`executions.service.ts`/`background-runs.service.ts`/두 DTO)과 frontend 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 걸쳐 일관된 이름(`isMaskedMarker`/`MASKED_MARKERS`/`hasMaskedMarkerLeaf`)과 JSDoc 규약으로 반영하려는 시도가 뚜렷하고, 신규 `masked-markers.ts` 유틸 분리·`rerun-modal.tsx` 의 `splitMaskedParameters` 헬퍼·`editor-toolbar.tsx` 의 파싱-후-마커검사 흐름 모두 함수 길이·중첩·네이밍 면에서 양호하며 테스트도 캐너리(경계) 패턴을 갖춰 두었다. 다만 "정책을 뒤집는" 성격의 PR 이 흔히 겪는 실패 형태 — **자매 표면 중 일부만 갱신**하고 일부는 옛 결론을 계속 진술 — 가 정확히 `ExecutionDto.inputData` JSDoc 에서 재발했다(CRITICAL). 이는 코드 동작에는 영향이 없지만, 이 필드가 이번 PR 의 핵심 변경 대상이라는 점에서 신뢰도가 높은 문서가 실제와 반대로 남아 있는 것은 유지보수성에 실질적 위험이다. 그 외 문장 호응 깨짐(WARNING)과 신규 문자열의 인용부호 표기 불일치(WARNING)는 경미하지만 즉시 정정 가능한 항목이다.

## 위험도

MEDIUM
