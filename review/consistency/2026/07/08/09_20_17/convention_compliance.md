# 정식 규약 준수 검토 — `spec/3-workflow-editor/0-canvas.md`

## 발견사항

- **[WARNING]** §5.3.2 "노드별 미설정 경고 메시지" 표의 영문 메시지가 실제 표시되는(localize 된) 문구와 불일치
  - target 위치: §5.3.2 "노드별 미설정 경고 메시지" 표 (If/Else, HTTP Request, Split, Transform, Map, Variable Declaration 등 전 행)
  - 위반 규약: `spec/conventions/i18n-userguide.md` Principle 1 (UI 문자열 dict 키 경유) · Principle 3 (`warningRules[].message` 영문 SoT + `WARNING_KO` 매핑 의무)
  - 상세: 표에 적힌 문자열(예: If/Else `⚠ Condition not set`, HTTP Request `⚠ URL not set`, Split `⚠ Field path not set`, Transform `⚠ No operations defined`, Map `⚠ Input field not set`)은 각 노드 schema 의 **legacy `summaryTemplate.warnMessage`** 필드 값이다. 그러나 `codebase/frontend/src/lib/utils/node-config-summary.ts` `getConfigSummary()` 는 **`warningRules`(blocking) 를 먼저 평가하고 매치되면 즉시 반환**하며, 검증한 노드들은 `warningRules[]` 의 `when` 조건이 `summaryTemplate.warnWhen` 과 동일(예: HTTP Request 둘 다 `!url`)해 blocking 경로가 항상 먼저 잡는다 — 즉 `warnMessage`(예: `"URL not set"`) 분기는 **도달 불가(dead code)**이고, 실제 AlertTriangle 배지에 표시·localize(`translateBackendWarning` → `WARNING_KO`) 되는 문구는 `warningRules[].message`(예: `"URL must be entered."` → ko `"URL 을 입력해야 합니다."`)다. Variable Declaration 은 아예 `summaryTemplate.warnWhen/warnMessage` 자체가 없어(`warningRules` 만 정의) 표의 `⚠ No variables defined` 는 코드 어디에도 없는 문자열이다. 즉 i18n-userguide.md 가 정의한 SoT(영문 원문) + `WARNING_KO` 매핑 파이프라인의 실제 keyed 문자열과 spec 표기가 어긋나 있어, 이 표를 그대로 `WARNING_KO` 신규 키 근거로 삼으면 존재하지 않는 키를 등록하게 된다.
  - 제안: 표의 메시지 열을 `warningRules[].message`(실제 blocking 문구, 코드 주석에도 "SSOT for warnings" 로 명시됨) 기준으로 갱신하거나, 두 메커니즘(`warningRules` vs legacy `summaryTemplate.warnWhen`)이 공존·중복되는 현황 자체를 각주로 명시. 이 항목은 이번 diff(§5.3.1 "업데이트" 행·§8 저장 모델 교정) 범위 밖의 기존 콘텐츠이므로 별도 후속 plan 으로 분리 가능.

- **[INFO]** `id: canvas` 는 파일 basename(`0-canvas`)과 문자 그대로 일치하지 않음
  - target 위치: frontmatter `id: canvas`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`id` 는 "파일 basename(확장자 제외) 기반 권장")
  - 상세: 실제로는 영역 내 형제 파일 전부(`1-node-common.md`→`node-common`, `2-edge.md`→`edge` 등)가 동일하게 정렬 prefix(`N-`)를 제거한 id 를 쓰는 확립된 패턴이라 위반이 아니라 기존 컨벤션의 자연스러운 적용이다. 새로 유입되는 검토자를 위해 별도 조치는 불필요.
  - 제안: 조치 불요 (기록용 INFO).

## 요약

diff 로 실제 변경된 범위(§5.3.1 "업데이트" 행, §8 저장 모델·`POST /workflows/:id/save` API 표기, R-3 Rationale 추가)는 `spec/conventions/spec-impl-evidence.md`(frontmatter 5필드·`pending_plans` 실재성) · `cross-node-warning-rules.md`(`hasError`/`graph-warning` 용어) · 실제 컨트롤러 라우트(`saveCanvas`)와 모두 정합하며 새로운 정식 규약 위반은 없다. 프론트matter(`id`/`status: partial`/`code:` glob 7건/`pending_plans:` 2건)도 spec-impl-evidence.md 스키마·plan-lifecycle frontmatter 요건을 모두 충족한다(경로 실재 확인 완료). 다만 이번 diff 와 무관하게 기존에 존재하던 §5.3.2 경고 메시지 표는 i18n-userguide.md 가 규정한 `warningRules`/`WARNING_KO` SoT 파이프라인과 문구가 어긋나 있어(legacy `summaryTemplate.warnMessage` 를 표기하지만 다수 노드에서 이 분기가 blocking `warningRules` 에 가려 도달 불가) WARNING 으로 별도 기록한다. API 문서(OpenAPI/Swagger 데코레이터) 규약은 본 문서가 백엔드 DTO/컨트롤러를 정의하지 않아 해당 사항 없음.

## 위험도

LOW
