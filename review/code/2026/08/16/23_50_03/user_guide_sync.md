# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 방법

`.claude/config/doc-sync-matrix.json` (SSOT, `rows[]`) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(표 + "자주 누락되는 항목") 을 적재했다. 변경 file 목록은 prompt 에 포함된 28개 항목을 기준으로 하되, `git diff origin/main --stat` 로 전체 47개 파일 목록을 재확인했다 (prompt 는 파일 6·7·9·13·14~17·20·21 의 diff 를 크기 제한으로 생략했으나, 파일 경로 자체는 전부 확인 가능했다). `codebase/frontend/**` 경로는 이번 changeset **47개 파일 전체에 단 하나도 없다** — 이 점이 매칭의 핵심이다.

## 발견사항

- **[WARNING]** 백엔드 API 응답 노출이 바뀌었는데(§R17 값-패턴 마스킹 신설) 그 노출을 그대로 서술하는 유저 가이드 페이지(`05-run-and-debug/run-results.mdx` + `.en.mdx`)가 이번 changeset 에 없다.
  - 변경 파일: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (`ExecutionDto.inputData`/`outputData`/`NodeExecutionSummaryDto.outputData` 의 `@ApiPropertyOptional` JSDoc 이 "자격증명으로 판별된 값은 마스킹되어 반환된다" 로 갱신됨), `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (동일), 그리고 그 값을 실제로 마스킹하는 `executions.service.ts`/`background-runs.service.ts` 의 `redactStoredDataForResponse` 적용.
  - 매트릭스 항목: `doc-sync-matrix.json` row `backend-api-change` — trigger glob `codebase/backend/src/**/dto/**` 가 위 두 DTO 파일에 **직접 매칭**된다(semantic 판단이 아니라 glob 매칭). targets: `"controller·DTO 의 swagger jsdoc"` (target a — 이번 diff 안에서 이미 충족됨) + `"API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"` (target b — 미충족). PROJECT.md 표 동일 행: `백엔드 API 추가·변경 | (a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지`. 보조로 row `run-debug-flow-change`(semantic, target `codebase/frontend/src/content/docs/05-run-and-debug/`)도 같은 표면을 가리킨다.
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` (KO) 및 `run-results.en.mdx` (EN).
    - KO 파일 `:71` `{ name: "Input", type: "노드 레벨", description: "노드가 받은 입력 JSON이에요. 폴링으로 뒤늦게 수신되므로 잠시 Loading이 뜰 수 있어요." }`
    - KO 파일 `:72` `{ name: "Output", type: "노드 레벨", description: "노드의 출력 JSON이에요. AI 노드는 Model·Tokens·Turn Count·Tool Calls 요약 그리드가 상단에 함께 나와요." }`
    - EN 파일 `:60`/`:61` 동형 (`"Input JSON this node received..."` / `"The node's output JSON..."`)
    두 서술 모두 "노드가 받은/낸 JSON 그대로" 를 전제하며, 이번 PR 이 바로 이 API(`GET /api/executions/:id` 계열, `NodeExecutionSummaryDto`/`BackgroundRunNodeExecutionDto`)가 반환하는 `inputData`/`outputData` 값에 자격증명 패턴 마스킹(`***`)을 새로 적용했다는 사실을 반영하지 않는다.
  - 상세: 이 diff 는 실제로 사용자가 에디터의 Run Results 드로어와 "전용 실행 내역 페이지"(`run-results.mdx:67` 가 명시하는 바로 그 UI)에서 보는 Input/Output 탭 JSON 의 **일부 값이 원문에서 `***` 로 바뀌는** wire-visible 변경이다. `CHANGELOG.md` 신규 항목이 스스로 "⚠️ wire 변화: … 워크플로가 정당하게 자격증명을 다루면 그 값도 `***` 로 보인다" 라고 명시하는 만큼, 이는 개발자만 아는 내부 구현이 아니라 **워크플로 제작자가 화면에서 실제로 관찰하는 값**이 바뀐다. 사용자가 예를 들어 HTTP 노드의 `input`/`output` 에 API 키·연결 문자열이 정상적으로 포함된 워크플로를 디버깅하다가 `***` 를 보면, 지금의 가이드 문구("노드가 받은 입력 JSON이에요")만으로는 이것이 버그(데이터 유실)인지 의도된 보안 마스킹인지 구분할 근거가 없다. `redact-stored-error.ts` 의 `redactStoredDataForResponse` JSDoc 이 스스로 SoT 로 인용하는 `spec/5-system/14-external-interaction-api.md` §R17 은 이번 diff 의 자매 커밋(`e5a63abff`)에서 이미 갱신됐지만, 그건 내부 spec 이고 최종사용자가 보는 `codebase/frontend/src/content/docs/**` 유저 가이드는 별개 SoT 라 자동으로 따라가지 않는다.
  - 제안: `run-results.mdx`/`run-results.en.mdx` 의 Input/Output(및 필요시 Error) 행 description 에 "자격증명으로 판별된 값은 `***` 로 마스킹되어 표시될 수 있어요(DB 원문과 다를 수 있음)" 류의 캐비엇을 한 줄 추가한다. `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트(§B/§D 등)에도 이 항목이 없으므로 함께 등재해 "같은 turn 원칙"을 지키는 것을 권장.

## 매칭되지 않은/해당 없음 판정 (참고)

- **새 노드 추가·노드 schema 변경**: `codebase/backend/src/nodes/**` 변경 없음 — 매칭 안 됨.
- **신규 UI 문자열(TSX)·i18n dict parity**: `codebase/frontend/**` 파일이 이 changeset 47개 전체에 **0건** — TSX 변경 자체가 없으므로 매칭 안 됨.
- **backend-labels.ts (warningCode/errorCode → ko 매핑)**: `warningRules`/`error-codes.ts`(`ErrorCode` enum) 변경 없음 — 매칭 안 됨.
- **신규 섹션 디렉토리 locale 등록**: `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음 — 매칭 안 됨.
- **통합/제공자 변경**: 신규/변경 provider 없음 — 매칭 안 됨.
- **표현식 언어 변경**: `codebase/packages/expression-engine/**` 변경 없음 — 매칭 안 됨.
- **인증·권한·세션 흐름 변경**: `codebase/backend/src/modules/auth/**` 변경 없음. `ExecutionChannelAuthorizer.verifyOwnership` 이 JSDoc·주석에서 근거로 **인용**될 뿐 그 파일 자체는 수정되지 않았다 — 매칭 안 됨.
- **spec 문서(`14-external-interaction-api.md`/`6-websocket-protocol.md`/`12-webhook.md`) 갱신**: 이미 이 changeset(커밋 `e5a63abff`) 안에서 반영 완료 — user-guide(frontend docs) 와는 별개 SoT 라 본 리뷰 범위의 "누락"으로 카운트하지 않음.

## 요약

매트릭스 21개 행 중 glob/semantic 매칭이 성립한 것은 `backend-api-change`(DTO glob 직접 매칭) 1건이며, target (a) swagger jsdoc 은 이번 diff 안에서 충족됐으나 target (b) "API 노출 변경 → 관련 user-guide 페이지" 는 `05-run-and-debug/run-results.{mdx,en.mdx}` 양쪽 모두 미반영으로 WARNING 1건이다. 그 외 노드·i18n dict·backend-labels·신규 섹션·통합·표현식 언어·인증 흐름 trigger 는 이 changeset 에 `codebase/frontend/**` 파일이 전무하므로 전부 해당 없음이다.

## 위험도

LOW
