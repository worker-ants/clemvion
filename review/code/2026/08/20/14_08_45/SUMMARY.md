# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — API 계약 문서(Swagger)가 이 PR 이 뒤집은 마스킹 정책과 정반대를 자기모순으로 계속 주장하고(4개 reviewer 독립 확인), 정확히 이 PR 이 막으려던 "마스킹 값의 재제출 왕복 오염"이 Re-run 모달의 object/array 타입 트리거 파라미터 경로에서 여전히 재현된다(requirement 리뷰어 실증). 두 CRITICAL 모두 이번 diff 자신의 범위 안에서 발생한 반쪽 구현/반쪽 갱신이며, forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 정상 확보돼 화이트리스트 미이행은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement/Security | Re-run 모달의 마커 가드(`splitMaskedParameters`)가 `isMaskedMarker`(정확 일치)만 쓰고 재귀 헬퍼 `hasMaskedMarkerLeaf` 를 쓰지 않아, `object`/`array` 타입 트리거 파라미터의 **중첩** 마스킹 leaf(예: `{"headers":{"apiKey":"***"}}`)를 감지하지 못한다. 마스킹된 leaf 가 그대로 프리필되고 `blockedByMaskedInput` 도 그 필드를 못 봐, 사용자가 아무것도 안 건드리고 제출하면 리터럴 `'***'` 가 새 실행 입력으로 그대로 전송된다 — 이 PR 이 닫으려던 취약점 클래스가 정확히 이 경로로 재현됨 | `codebase/frontend/src/components/executions/rerun-modal.tsx:113-128`(`splitMaskedParameters`), `:317-322`(`blockedByMaskedInput`); 대조 `codebase/frontend/src/lib/utils/masked-markers.ts:64-73`(`hasMaskedMarkerLeaf`, editor-toolbar 는 이미 사용) | `splitMaskedParameters` 에서 `isMaskedMarker(v)` 대신/추가로 `hasMaskedMarkerLeaf(v)` 를 적용해 object/array 값의 중첩 마커도 차단. `{"headers":{"apiKey":"***"}}` 류 회귀 테스트 추가 |
| 2 | Documentation/Maintainability/Architecture | `ExecutionDto.inputData` 의 JSDoc(Swagger `description` 으로 그대로 노출, `nest-cli.json introspectComments:true`)이 "값-패턴 마스킹 대상이 아니다"·"카브아웃은 Execution 레벨 한정이다" 를 그대로 유지 — 이 PR 이 정확히 이 카브아웃을 폐지했는데(`toExecutionDto`/`toResponseExecution` 모두 `redactStoredDataForResponse` 적용) 인용 문구 한 줄(`MASKED_INPUT_DATA_REASON`→`toResponseExecution`)만 갱신되고 핵심 주장은 방치됨. 같은 파일의 자매 필드 `NodeExecutionSummaryDto.inputData`(172-184행)는 정반대(올바른) 방향으로 정확히 갱신돼 있어 **한 파일 안에서 두 JSDoc 이 서로 모순**. 이전 라운드 consistency checker(`naming_collision.md`)가 CRITICAL 로 정확히 예측한 "6개 참조처 부분 갱신" 리스크가 실현됨 | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-62`(52행·57-58행) | 52행을 "값-패턴 마스킹 대상이다(2026-08-20 부터, DB 원문과 다를 수 있음)"로, 57-58행의 "카브아웃은 Execution 레벨 한정" 문단을 삭제/과거형으로 재작성 — `NodeExecutionSummaryDto` 쪽 서술과 대칭 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation/Maintainability/Architecture | `MASKED_INPUT_DATA_REASON` 앵커 삭제 시 인라인 주석·테스트 comment 를 "인용 부분만" 치환해 문장이 문법적으로 깨지거나("카브아웃은" 주어 뒤에 "Execution 레벨도 마스킹한다"가 붙어 의미 역전) 옛 결론("카브아웃은 Execution 레벨 한정이다")이 현재형으로 잔존 | `codebase/backend/src/modules/executions/executions.service.ts:692-694`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:303-304`, (부수) `executions.service.spec.ts:1248,1296`, `background-runs.service.spec.ts:265`, `spec/5-system/14-external-interaction-api.md:1631` 소제목 | 삭제 대상 앵커의 전체 사용처를 grep 한 뒤 "문장 전체" 단위로 재작성. `background-runs.service.spec.ts:224` 의 완결된 문장을 템플릿으로 사용 |
| 2 | Architecture/Testing | Re-run 모달 스키마 로드 후 재조정 `useEffect` 가 `coerceInput("boolean","")` 을 호출 → 마스킹으로 비운 빈 문자열이 `false` 로 캐스팅되어 `blockedByMaskedInput` 의 `"" \| undefined \| null` 판정을 통과, 사용자 입력 없이 boolean 타입 마스킹 필드의 제출 차단이 조용히 풀림. 회귀 테스트 없음 | `codebase/frontend/src/components/executions/rerun-modal.tsx:166-177`(`coerceInput`), `:294-310`(재조정 이펙트), `:317-322`(`blockedByMaskedInput`) | `maskedKeys` 소속 키는 재조정 이펙트의 타입 캐스팅에서 제외하거나, `blockedByMaskedInput` 을 "마스킹 키이고 사용자가 값을 변경하지 않음"으로 더 엄밀히 재정의. boolean 타입 마스킹 필드 회귀 테스트 추가 |
| 3 | Documentation | `spec/5-system/14-external-interaction-api.md:1631` 소제목이 옛 문구("input"/"inputData" 의 마스킹 여부는 "레벨"이 가른다)를 그대로 유지 — 바로 아래 본문은 이번 PR 로 "그 축은 폐기됐다"로 갱신되어 소제목과 본문이 모순 | `spec/5-system/14-external-interaction-api.md:1631` | 소제목을 "두 레벨 모두 마스킹한다(2026-08-20, '레벨이 가른다' 축 폐기)" 로 갱신 — `6-websocket-protocol.md` 자매 문서는 이미 올바르게 갱신됨 |
| 4 | Documentation | CHANGELOG.md 미갱신 — 동일 마스킹/카브아웃 주제의 직전 5개 커밋(#1177~#1186)이 전부 "## Unreleased" 항목을 남긴 확립된 관례에서 이번(시리즈의 정점) 커밋만 이탈 | `CHANGELOG.md` (루트) | 직전 항목과 같은 톤으로 "Execution.inputData 카브아웃을 닫았다" 항목 추가 |
| 5 | Testing | 에디터 "히스토리에서 불러오기" 마커 가드의 신규 테스트 3건이 실제 `getById → setJsonInput` 유입 경로가 아니라 textarea 직접 `fireEvent.change` 로 마스킹 JSON 을 주입 — 이 PR 이 고치는 정확한 버그 재현 경로(직렬화 단계 포함)가 스위트에 없음 | `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:136-150`(`handleLoadFromHistory`), `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx:452-497` | `getByIdMock` 이 마스킹된 `inputData` 를 반환하도록 설정하고 "Load from History" 버튼 클릭부터 시작하는 e2e 성격 테스트 1건 추가 |
| 6 | User Guide Sync | `Execution.inputData` 마스킹 카브아웃 폐지가 만든 새 "Run/Re-run 차단" UX(마스킹 마커 남으면 버튼 비활성)가 `05-run-and-debug/` 유저 가이드(ko/en)에 반영되지 않음 — spec(`3-execution.md:91`)은 같은 PR 에서 정확히 갱신됨 | `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx`(+`.en.mdx`), `run-results.mdx`(+`.en.mdx`) | "Load from History"/"Re-run" 설명에 마커 차단 동작(프리필 스킵, 채우기 전까지 버튼 비활성, `useOriginalInput` 예외) caveat 추가 |
| 7 | Maintainability | 신규 문자열 `dict/en/history.ts` 의 `maskedInputBlocked` 가 curly quote(`“`/`”`) 사용 — 같은 디렉터리 전체 관례(straight quote)에서 이 한 곳만 이탈 | `codebase/frontend/src/lib/i18n/dict/en/history.ts:15` | `\"Use original input\"` 로 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 마커 가드가 UI 레벨(`disabled`)에서만 강제되고 서버측 재검증이 없음 — 단 영향은 자기 워크스페이스의 자기 실행 데이터 무결성에 한정(기밀 노출 아님), 팀이 인지한 설계 | `rerun-modal.tsx:317-347`, `editor-toolbar.tsx:103-119,869-871` | defense-in-depth 로 서버측 마커 리터럴 거부 검토, 또는 §R17 에 UI-only 결정 근거 명시 |
| 2 | Security | 정확 일치 마커 검사가 backend 부분 마스킹(`scheme://***@host`) 을 못 잡음 — 자격증명 자체는 이미 지워진 뒤라 기밀 노출은 아니고 문서화된 트레이드오프 | `codebase/frontend/src/lib/utils/masked-markers.ts:47-73` | 조치 불요(의도된 경계) |
| 3 | Architecture | 마커 가드 3개 소비처(폼 프리필/Re-run/히스토리)의 강제 수준이 서로 다름 — `dynamic-form-ui.tsx` 는 LLM 이 만든 `required` 속성에만 의존해 프리필 스킵 외 강제 없음 | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:331-340` | 필수 아님. 마스킹 필드에 required 강제 검토 또는 "약한 가드" caveat 명시 |
| 4 | Side Effect | `Execution.inputData` REST 응답 값이 이제 마스킹돼 나감(공개 API 계약 변경) — 의도됨, 감사된 3소비처 전부 가드 확인, 감사 범위 밖 제3자 소비자 존재 가능성만 잔존 | `executions.service.ts` `toResponseExecution`/`toExecutionDto` | 조치 불요(spec §R17 승인) |
| 5 | Side Effect | `hasMaskedMarkerLeaf` 재귀에 깊이 상한 없음 — 클라이언트 로컬, `JSON.parse` 와 동일 스택 제약, 실질 위험 없음 | `codebase/frontend/src/lib/utils/masked-markers.ts` | 조치 불요 |
| 6 | Testing | 신규 공용 유틸 `masked-markers.ts`(`hasMaskedMarkerLeaf` 등)에 전용 unit 테스트 파일이 없고 컴포넌트 테스트로만 간접 검증 | `codebase/frontend/src/lib/utils/masked-markers.ts` | `__tests__/masked-markers.test.ts` 추가 권장(저비용) |
| 7 | Testing | `jsonError` 채널을 마커 검사와 공유해 "테스트 데이터셋 저장" 버튼도 마스킹 시 비활성화되는 부수효과가 테스트되지 않음(의도로 보이나 미고정) | `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:824-826,845` | 저장 버튼도 비활성됨을 확인하는 단언 1줄 추가 |
| 8 | Testing | 마스킹 관련 `role="alert"` 단언이 존재 여부만 확인하고 메시지 본문(원인이 마스킹임)은 확인하지 않음 | `editor-toolbar-run-input.test.tsx:462,477,492-494`, `rerun-modal.test.tsx:547,575` | 최소 1건에서 alert 텍스트 단언 추가 |
| 9 | Documentation | `background-runs.service.spec.ts:265` 테스트 주석도 "카브아웃은 Execution 레벨 한정" 잔존(테스트 전용, 파급 낮음) | `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:265` | 짧게 정정 |
| 10 | Security(긍정 확인) | `MASKED_INPUT_DATA_REASON` 앵커 및 "Execution 레벨은 예외" 서술이 6개 소비처 전수에서 정합적으로 제거·반전됨(consistency checker 가 사전에 CRITICAL 로 우려했던 위험이 실제로는 대부분 해소됨, 예외는 위 Critical #2) | 6개 파일 전수 grep 0건 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | UI-only 가드(서버 재검증 없음, INFO), 부분 마스킹 미검출(INFO, 문서화된 트레이드오프) |
| architecture | HIGH | Swagger JSDoc 자기모순(CRITICAL), 주석 스윕 미완결(WARNING), boolean 타입 결합으로 가드 조용히 풀림(WARNING) |
| requirement | HIGH | Re-run 모달 object/array 중첩 마스킹 미검출(CRITICAL, 이 PR 이 막으려던 취약점 재현), Swagger JSDoc 반대 진술(CRITICAL) |
| scope | NONE | 스코프 밖 변경 없음 — 대규모 diff(59파일) 전부 절차·요구사항으로 정당화 확인 |
| side_effect | NONE | 댕글링 참조·타입 불일치·전역 오염 없음(`tsc`+grep 실측). REST 응답 값 변경은 의도된 것(INFO) |
| maintainability | MEDIUM | Swagger JSDoc 자기모순(CRITICAL), 문장 호응 깨짐(WARNING), 인용부호 표기 불일치(WARNING) |
| testing | MEDIUM | boolean 타입 재조정으로 가드 우회 미검증(WARNING), 히스토리 로드 e2e 커버리지 갭(WARNING), 나머지 저비용 보강 권고(INFO) |
| documentation | MEDIUM | Swagger JSDoc 자기모순(CRITICAL), 주석/spec 소제목 잔존(WARNING), CHANGELOG 누락(WARNING) |
| user_guide_sync | MEDIUM | `05-run-and-debug/` 유저 가이드에 새 Run/Re-run 차단 UX 미반영(WARNING). i18n/backend-labels parity 는 정상 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 INFO 이상의 관측을 남겼다(scope·side_effect 는 위반/부작용 없음을 실측으로 확인한 긍정 결과).

## 권장 조치사항

1. **[Critical #1 우선 수정]** `rerun-modal.tsx` 의 `splitMaskedParameters` 를 `hasMaskedMarkerLeaf` 기반으로 바꿔 object/array 타입 트리거 파라미터의 중첩 마스킹 값도 프리필 스킵+제출 차단 대상에 포함시키고, `{"headers":{"apiKey":"***"}}` 류 회귀 테스트를 추가한다 — 이 PR 의 핵심 목적(마스킹 값 왕복 오염 차단)이 이 경로에서 아직 깨져 있다.
2. **[Critical #2 수정]** `execution-response.dto.ts` 의 `ExecutionDto.inputData` JSDoc(52·57-58행)을 `NodeExecutionSummaryDto.inputData` 와 대칭되게 재작성해 Swagger 로 노출되는 공개 API 문서의 자기모순을 해소한다.
3. **[Warning #1 함께 정리]** `MASKED_INPUT_DATA_REASON` 앵커 삭제로 깨진 인라인 주석·테스트 코멘트·spec 소제목(§executions.service.ts:692, background-runs.service.ts:303-304, spec/14-external-interaction-api.md:1631 등)을 전수 grep 후 문장 단위로 재작성 — Critical #2 와 같은 PR 로 묶어 처리하면 효율적이다.
4. **[Warning #2]** Re-run 모달의 boolean 타입 재조정 이펙트가 마스킹 가드를 조용히 우회하는 경로에 대한 근본 수정(마스킹 키는 타입 캐스팅에서 제외) + 회귀 테스트를 추가한다.
5. 나머지 Warning(CHANGELOG 갱신, 유저 가이드 05-run-and-debug 미러, 히스토리 로드 e2e 커버리지, i18n 인용부호)은 별도 후속 커밋으로 처리해도 무방하다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 성능 영향 표면 없음(순수 값 비교/마스킹 로직) |
  | dependency | router 판단 — 신규/변경 의존성 없음 |
  | database | router 판단 — 스키마/쿼리 변경 없음(egress 응답 조립만 변경) |
  | concurrency | router 판단 — 동시성 표면 변경 없음 |
  | api_contract | router 판단 — (참고: 실제로는 `ExecutionDto` Swagger 문서 자기모순이 발견됨 — architecture/requirement/documentation/maintainability 4개 reviewer 가 이를 각자 관점에서 CRITICAL/관련 사안으로 포착해 커버리지 공백은 없었으나, 향후 유사 변경에서 `api_contract` 제외가 반복되면 재검토 권장) |