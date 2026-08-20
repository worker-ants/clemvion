# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. `Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳 마커 가드는 직전 두 리뷰 라운드(`14_08_45`, `14_44_08`)의 CRITICAL 2건·WARNING 다수가 실제로 해소됐음을 9개 reviewer 전원이 코드·테스트·spec 대조로 재확인했다. 이번 라운드 신규 발견은 문서 자리 2건(WARNING, "주제문은 안 고치고 세부만 고친다" 패턴의 재발)과 다수의 INFO(대부분 기존 트래커 등재 항목의 재확인)뿐이다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `ResponseExecution` 타입 JSDoc 주제문이 "두 컬럼(마스킹 대상)의 null 가능성만 다르다"고 말하지만, 이번 PR 이 `inputData` 를 마스킹 대상에 편입시켜 실제로는 **세 컬럼**(error·inputData·outputData)이 다르다. 같은 파일 691행·1033행은 이미 "세 컬럼"으로 정확히 서술 — 101행만 갱신 누락. 두 차례 리뷰가 반복 지적한 "주제문 미갱신, blockquote 캐비엇만 추가" 패턴의 3번째 재발 | `codebase/backend/src/modules/executions/executions.service.ts:101` | 101행을 "마스킹 대상 세 컬럼의 null 가능성만 다르다"로 정정 |
| 2 | documentation | `CHANGELOG.md` 가 이 PR 안에서 이미 폐기된 중간 단계 차단 판정 기준("건드렸는가" 단독)을 최종 결론처럼 서술. 실제 최종 로직(`29d00021d`)은 "건드렸고 **그리고** 현재 값에 마커가 없는가"의 AND — spec 2곳·plan 체크리스트는 이 최종 규칙으로 갱신됐으나 CHANGELOG 만 갱신 대상에서 빠짐 | `CHANGELOG.md:19-21` | "값 기반도, 건드렸는가 단독도 아니라 건드렸고 그리고 현재 값에 마커가 없는가(AND)"로 재작성하고, 되돌린 마커에 재차 뚫리는 2차 구멍도 한 문장 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 마스킹-마커 재제출 차단이 클라이언트 UI(`disabled` 버튼)에서만 강제되고 `handleSubmit`/`handleRunWithInput` 내부에 재확인 가드가 없음 — curl 등 UI 우회 시 왕복 오염 재현 가능(기밀성 침해 아님, 데이터 무결성 문제로 국한). 이미 트래커 등재(`spec-sync-external-interaction-api-gaps.md` W6) | `rerun-modal.tsx` `handleSubmit`, `editor-toolbar.tsx` `handleRunWithInput` | 조치 불요(스코프 밖, 등재됨). defense-in-depth 원하면 핸들러 내 즉시 return 가드 + 서버측 마커 리터럴 거부 검토 |
| 2 | security | frontend `hasMaskedMarkerLeaf` 재귀에 깊이 상한 없음 — backend 대응 함수(`MAX_REDACT_DEPTH=10`)와 비대칭. 다만 순회 대상이 이미 backend 의 깊이-제한 마스커를 통과한 구조라 실질 위험 낮음 | `codebase/frontend/src/lib/utils/masked-markers.ts:64` | 조치 불요에 가까움. 방어적 일관성 원하면 동일 상수 미러 |
| 3 | architecture | egress 마스킹 관문이 backend 4개 호출부에 분산(단일 게이트 아닌 주석 표로만 동기화) — 이번 PR 은 패턴을 정확히 따랐으나 근본 fragmentation 은 유지. 트래커 등재(W4) | `executions.service.ts:1009-1011,1074-1076,695-703`, `background-runs.service.ts:305-306` | (등재됨) `redactExecutionFields` 공유 헬퍼/interceptor 통합 후속 검토 |
| 4 | architecture | frontend `MASKED_MARKERS` 가 backend 상수의 손-복제 미러 — 컴파일/CI 타임 계약 없음. 트래커 등재 | `masked-markers.ts:18-22` vs `sanitize-error-message.ts` | (등재됨) 두 상수 배열 대조 계약 테스트 신설 |
| 5 | architecture | `rerun-modal.tsx` 에 마스킹 차단 도메인 로직(판별+상태추적+파생게이트)이 프레젠테이션 컴포넌트 안에 직접 조립 — 이중조건 강화로 상태 복잡도 한 단계 상승 | `rerun-modal.tsx:116-138,228-231,299-304,329-349` | 필수 아님. 다음 소비처 생기면 `useMaskedParamGuard` 훅으로 추출 검토 |
| 6 | side_effect | `Execution.inputData` REST 응답 콘텐츠 계약이 원문→마스킹으로 변경(스키마 diff 로는 안 드러남) — 저장소 밖 소비자(QA/감사 export) 영향 가능. 트래커 등재(W5) | `executions.service.ts` `toResponseExecution`/`toExecutionDto`/`stop`, `background-runs.service.ts:305` | 별도 조치 불요(등재됨). 후속 처리 여부만 확인 |
| 7 | maintainability | 신규 테스트 파일 마지막 `it` 블록과 `describe` 닫는 `});` 사이 불필요한 빈 줄(같은 파일 다른 블록과 형태 불일치) | `editor-toolbar-run-input.test.tsx:538` | 빈 줄 제거 |
| 8 | testing | Re-run 모달이 열린 채로 `original` prop 만 바뀌는 재사용 경로(터치 상태 리셋)에 대한 테스트 없음 — 실제 호출부가 항상 닫았다 다시 여는 방식이면 위험 낮음 | `rerun-modal.tsx:234-242`, 대응 테스트 `rerun-modal.test.tsx:537` | "닫혔다 다시 열림, 다른 original" 시나리오에서 `touchedMaskedKeys` 초기화를 단언하는 테스트 추가 검토 |
| 9 | testing | `Execution.inputData` egress 마스킹 반전에 e2e(HTTP 왕복) 수준 직접 검증 없음(unit 레벨만) — 선행 PR(#1179/#1180) 과 동일한 저장소 전체 패턴 | `executions.service.spec.ts:1109-1424` vs `test/*.e2e-spec.ts` | (선택) `re-run.e2e-spec.ts` 원본 실행 조회 응답 마스킹 e2e 어서션 추가 검토 |
| 10 | testing | 클라이언트 제출 함수에 버튼 `disabled` 외 내부 가드 없고, 이 defer 전제(UI 우회 시 그대로 통과) 자체를 고정하는 테스트 없음 | `rerun-modal.tsx:351`, `editor-toolbar.tsx:290` | 조치 불요에 가까움(등재됨, W6). 전제를 캐너리로 고정하고 싶다면 직접 호출 테스트 추가 |
| 11 | documentation | plan 제목("소비처 2곳")과 CHANGELOG 제목("소비처 3곳")이 다른 기준으로 세어 모순처럼 보임 — 기존 라운드가 이미 INFO 로 판정, 재확인만 | `plan/in-progress/eia-inputdata-marker-guard.md:2` vs `CHANGELOG.md:3` | 조치 불요(기존 판정 유지) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. 이전 라운드 우회 경로(object/array leaf, 값/터치 단독 판정) 전부 재검증상 해소. INFO 2건(클라이언트 전용 강제, 재귀 깊이 상한) |
| architecture | LOW | 이전 CRITICAL/WARNING 전부 해소 확인. INFO 3건(마스킹 관문 fragmentation, 상수 손-복제, 모달 상태 기계 비대화) — 전부 기존 등재 또는 확장성 관찰 |
| requirement | NONE | 신규 요구사항 결함 없음. spec 7개 문서 line-level 대조 전수 일치 |
| scope | NONE | `git diff origin/main...HEAD` 101파일 전량 대조, 범위 이탈 없음 |
| side_effect | LOW | 의도치 않은 부작용 없음. INFO 1건(REST 응답 콘텐츠 계약 변경, 이미 등재) |
| maintainability | NONE | 이전 라운드 지적 전부 해소. INFO 1건(테스트 파일 빈 줄) |
| testing | LOW | frontend 84/84, backend 71/71 통과 + 뮤테이션 재현으로 캐너리 실효성 확인. INFO 3건(모달 재사용 리셋 테스트, e2e 갭, UI 우회 전제 미고정) |
| documentation | LOW | 이전 라운드 처분 정확히 반영 확인. **WARNING 2건**(ResponseExecution JSDoc "두 컬럼" stale, CHANGELOG 차단판정 서술 stale) 신규 발견. INFO 1건(소비처 개수 표기 불일치, 기존 판정 유지) |
| user_guide_sync | NONE | 매칭 trigger 2개(run-debug-flow-change, new-ui-string) 모두 동반 갱신 완결. 누락 0건 |

## 발견 없는 에이전트

requirement, scope, user_guide_sync (신규 결함 0건)

## 권장 조치사항
1. `codebase/backend/src/modules/executions/executions.service.ts:101` `ResponseExecution` JSDoc 주제문을 "세 컬럼"으로 정정 (WARNING 1)
2. `CHANGELOG.md:19-21` 의 차단 판정 서술을 최종 AND 로직으로 재작성 (WARNING 2)
3. (선택) `editor-toolbar-run-input.test.tsx:538` 빈 줄 제거, Re-run 모달 재사용 리셋 테스트 추가 등 INFO 항목은 여유 있을 때 처리

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 changeset 과 무관 |
  | dependency | router 판단상 이번 changeset 과 무관 |
  | database | router 판단상 이번 changeset 과 무관 |
  | concurrency | router 판단상 이번 changeset 과 무관 |
  | api_contract | router 판단상 이번 changeset 과 무관 |