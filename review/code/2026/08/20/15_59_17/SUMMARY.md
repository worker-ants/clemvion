# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. 이 changeset(`Execution.inputData` egress 마스킹 카브아웃 폐지)은 이미 4라운드의 code review 를 거쳐 CRITICAL 2건이 해소된 상태이며, 이번(5라운드) 재검토는 신규 CRITICAL 을 발견하지 못했다. 잔여 발견사항은 전부 WARNING/INFO 등급의 문서 정합(spec/CHANGELOG/plan 3곳이 최신 fix 커밋의 "세 번째 조건"을 반영하지 못함 — 4번째 재발 패턴)과 테스트 커버리지 갭 1건이다. 라우터 forced 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] Re-run 모달 차단 판정에 세 번째 조건(구조 필드 coerce-실패 가드)이 코드·테스트엔 있는데 spec 3곳(`§R17` 표, `§10.2` 캐비엇)은 여전히 "두 조건의 합"만 서술 | `spec/5-system/14-external-interaction-api.md:1571`, `spec/5-system/13-replay-rerun.md:353-364` | Re-run 모달 행/캐비엇을 "세 조건의 합"으로 갱신하고 무효 JSON 우회 경로를 추가 서술 |
| 2 | 문서화 | 동일 사안 — "차단 판정은 두 조건의 합" 서술이 `CHANGELOG.md`·plan 트래커·spec §R17 세 SoT 문서에 그대로 남아 마지막 커밋(`38b4669bd`)의 세 번째 조건을 반영 못함. 이 PR 이 스스로 "3번 재발"이라 기록한 패턴의 4번째 재발 | `CHANGELOG.md:19-25`, `plan/in-progress/eia-inputdata-marker-guard.md:125-128`, `spec/5-system/14-external-interaction-api.md:1571` | 세 곳 모두 "세 조건의 합"으로 갱신 + plan 체크리스트 라운드 카운트(`15_32_34`/`15_33_05`) 반영 |
| 3 | 아키텍처 | 3라운드 연속 우회가 발견된 마스킹-차단 판정 로직(`blockedByMaskedInput`/`isStructuredField`)이 여전히 컴포넌트 내부 인라인 클로저라 render 하네스 없이 단위 테스트 불가 — 같은 PR 이 `isMaskedMarker`/`hasMaskedMarkerLeaf` 는 순수 함수로 승격해 놓고 정작 반복 회귀가 난 이 자리는 처방을 못 받음 | `codebase/frontend/src/components/executions/rerun-modal.tsx:359`, `:364-371` | `blockedByMaskedInput`/`isStructuredField` 를 순수 함수로 추출해 `lib/utils/masked-markers.ts` 등에 배치, 직접 단위 테스트 가능하게 |
| 4 | 유지보수성 | 새 헬퍼(`isStructuredField`)가 기존 큰 JSDoc 블록과 그 설명 대상 선언(`blockedByMaskedInput`) 사이에 끼어들어 문서-대상 대응이 시각적으로 어긋남 — 같은 파일에서 이미 한 번(라운드1 W8) 고친 결함 클래스의 재발 | `codebase/frontend/src/components/executions/rerun-modal.tsx:329-371` | `isStructuredField` 를 JSDoc 블록 위 또는 `blockedByMaskedInput` 바로 앞으로 재배치 |
| 5 | 유지보수성 | `type === "object" || type === "array"` 구조 타입 판정이 이번 diff 로 같은 파일 안에서 세 번째로 중복(`displayValue`, `coerceInput`, `isStructuredField`) — 이 PR 자신이 "동일 판정 분산은 위험"이라는 교훈으로 마커 판별기를 승격했음에도 반대 방향으로 진행 | `codebase/frontend/src/components/executions/rerun-modal.tsx:162`, `:179`, `:360-361` | `isStructuredType(type)` 단일 헬퍼로 추출해 세 곳이 재사용 |
| 6 | 테스트 | `Execution.inputData`/node-level `inputData` 가 이번에 처음 egress 마스킹 대상에 편입됐는데, "ingestion `[REDACTED]` 마커를 egress 마스커가 덮지 않는다" 캐너리가 `outputData` 표면에만 있고 `inputData` 표면엔 없음. 자매 테스트의 rationale 주석("`inputData` 는 마스커를 안 지난다")도 이번 diff 로 사실이 아니게 됨 | `codebase/backend/src/modules/executions/executions.service.spec.ts:1261-1263`, `codebase/backend/src/modules/executions/background-runs/*.spec.ts:274` | `⑥` 테스트를 `inputData` 케이스로 확장(또는 신설) + stale 주석 정정 |
| 7 | 문서화 | 신규 i18n 카탈로그 행(`maskedInputBlocked`)이 이 표의 기존 관례(실제 dict 리터럴 그대로 기재)를 깨고 요약·주석(`…`, `(§10.2 마커 가드)`)을 섞어 넣어 실제 문자열과 다름 | `spec/5-system/13-replay-rerun.md:405` | 실제 dict 리터럴 전체를 그대로 옮겨 적고, 섹션 참조는 표 밖 각주로 분리 |
| 8 | Side Effect | 공개 REST 응답 계약이 스키마 변경 없이 침묵 변경(`Execution.inputData` 원문→마스킹값) — 저장소 밖 API 소비자에게는 스키마로 드러나지 않는 breaking 변경 (이미 plan 트래커 W5 등재, 재확인 목적 기재) | `codebase/backend/src/modules/executions/executions.service.ts` (`ResponseExecution`, `toResponseExecution`, `toExecutionDto`) | 추가 조치 불요(트래커 유지) — 릴리스 노트 breaking 공지 유지 |
| 9 | API 계약 | 위와 동일 사안 — 내용 계약(semantic contract) 반전이 스키마상 감지 불가하고 이 프로젝트엔 API 버전 관리 체계도 없음 (이미 등재된 기존 갭, 재확인) | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:52-60`, `:177-181` | 저장소 밖 소비자 확인 + breaking change 공지 (트래커 항목 유지) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `inputOverride` 는 서버측에서 마스킹 마커 리터럴을 값으로 거부하지 않음 — UI 우회 시 자기 자신의 재제출만 오염 가능(기밀성 침해 아님, 기존 등재 갭) | `codebase/backend/src/modules/executions/executions.service.ts` (`reRun`) | (선택) `resolveTriggerParameters` 직전 마커 리터럴 정확 일치 시 `INVALID_INPUT` 거부 — 범위 밖 |
| 2 | API 계약 | 요청 검증 축 서버측 마커 거부 부재는 이번 PR 신규 결함 아님, 기존 등재 갭(W6) | `codebase/frontend/src/components/executions/rerun-modal.tsx`, `editor-toolbar.tsx` | (선택) 서버측 얕은 거부 검토 |
| 3 | API 계약 | 응답 DTO Swagger description 이 새 마스킹 정책에 맞춰 정확히 갱신됨 (긍정적) | `execution-response.dto.ts:52-60`, `:177-181`, `background-run-response.dto.ts:50-51` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 결함 없음. `inputOverride` 서버 미검증(INFO, 기존 등재) 외 이전 라운드 CRITICAL 수정이 재발 없이 반영됨을 재확인 |
| architecture | LOW | 마스킹-차단 판정 로직이 3라운드 연속 회귀에도 여전히 컴포넌트 인라인 클로저(WARNING) — 순수 함수 미승격 |
| requirement | LOW | [SPEC-DRIFT] Re-run 세 번째 차단 조건이 코드엔 있는데 spec 3곳이 "두 조건"으로 stale |
| scope | NONE | 143개 파일 diff 전량 대조, 범위 이탈·무관한 변경 없음 |
| side_effect | LOW | `Execution.inputData` REST 응답 값-마스킹 전환이 스키마 미반영 breaking 변경(기존 등재 W5), 그 외 상태변이/전역변수 등 신규 부작용 없음 |
| maintainability | LOW | 신규 헬퍼가 JSDoc 블록-대상 선언 사이 끼어듦 + 구조 타입 판정 3중 중복 |
| testing | LOW | 프런트 3소비처 테스트는 촘촘함. backend `inputData` ingestion-마커-보존 통합 캐너리 부재(신규 발견) |
| documentation | LOW | "두 조건의 합" 서술이 CHANGELOG·plan·spec 3곳 stale(4번째 재발), JSDoc 블록 재배치 필요, i18n 표 문구 불일치 |
| api_contract | LOW | 응답 필드 내용 계약 반전이 스키마 미반영(기존 등재 W5), 서버측 요청 검증 갭(기존 등재 W6) — 신규 결함 아님 |
| user_guide_sync | NONE | 매칭 trigger 3개(new-ui-string, run-debug-flow-change, backend-api-change) 전부 동반 갱신 완결, 누락 0건 |

## 발견 없는 에이전트

security(신규 결함 없음, INFO 1건만), scope(NONE), user_guide_sync(NONE)

## 권장 조치사항

1. **문서 3곳(CHANGELOG/plan/spec §R17) 동시 갱신** — 마지막 커밋(`38b4669bd`)이 추가한 Re-run 모달 세 번째 차단 조건(object/array coerce 실패 가드)을 "두 조건의 합" → "세 조건의 합"으로 반영. requirement·documentation 두 리뷰어가 독립적으로 지적한 [SPEC-DRIFT]이며 이 PR 안에서 4번째 재발한 패턴이므로 우선순위가 가장 높다.
2. **backend `inputData` ingestion-마커-보존 통합 테스트 추가** — `executions.service.spec.ts`/`background-runs.service.spec.ts` 의 `⑥` 캐너리를 `inputData` 표면으로 확장하고 stale 주석("`inputData` 는 마스커를 안 지난다") 정정. 향후 마스킹 게이트 통합 리팩터(이미 트래커 등재)가 이 배선을 조용히 깰 수 있는 유일한 미보호 지점.
3. **`blockedByMaskedInput`/`isStructuredField` 순수 함수 추출** — 3라운드 연속 회귀 이력이 있는 판정 로직을 컴포넌트 밖으로 승격해 직접 단위 테스트 가능하게(같은 PR 이 `hasMaskedMarkerLeaf` 에 이미 적용한 처방과 동일).
4. `rerun-modal.tsx` JSDoc 재배치(`isStructuredField` 위치 이동) + `isStructuredType` 헬퍼로 3중 중복 정리, i18n 카탈로그 표 문구를 실제 dict 리터럴로 정정 — 낮은 비용의 문서/유지보수 정리.
5. (선택, 트래커 유지) `Execution.inputData` 응답 의미 반전의 저장소 밖 소비자 확인 및 breaking change 공지, `inputOverride` 서버측 마커 리터럴 거부 검토 — 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W5/W6 로 등재된 기존 갭이므로 이번 PR 을 막을 사안 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 표 (아래, 4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 상세는 `_routing_decision.json` 참조 — 본 prompt 에 미포함) |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |