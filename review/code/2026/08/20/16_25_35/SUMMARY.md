# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 신규 CRITICAL 없음. `Execution.inputData` 응답의 *내용 계약*이 스키마 변경 없이 반전(egress 마스킹)된 breaking change 가 저장소 밖 소비자 확인 미완료 상태로 트래커에 미체크(open)로 이월 중이며(side_effect·api_contract 공통 지적), 프런트 신규 유틸에 깊이 상한 없는 재귀가 try/catch 밖에서 호출돼 uncaught 예외 가능성이 새로 발견됐다(performance). 그 외 발견은 대부분 이미 5라운드 code-review + 다회 consistency-check 를 거치며 수렴한 잔여 INFO/문서 정합성 이슈다. **forced whitelist(router_safety) 7개 전원 결과 확보 완료** — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API_CONTRACT / SIDE_EFFECT | `Execution.inputData` REST 응답(`GET /executions/:id`, `GET /executions` 목록, `POST /:id/rerun`)의 *내용*이 원문→마스킹값으로 바뀌었으나 OpenAPI 스키마 타입(`object, nullable`)은 무변경이라 계약 테스트로 감지 불가능한 breaking change. 저장소 밖 API 소비자 존재 여부 확인이 `spec-sync-external-interaction-api-gaps.md:329` 에 미체크(open) 상태로 3라운드째 이월 중 | `codebase/backend/src/modules/executions/executions.service.ts:1010,1075`(`toExecutionDto`/`toResponseExecution`), `execution-response.dto.ts:64-69` | 저장소 밖 REST 소비자(자동화/감사 export 등) 존재 여부 조사 완료 후 트래커 항목 체크. 있다면 릴리스 노트에 "`inputData` 는 이제 egress 마스킹됨" 명시 |
| 2 | PERFORMANCE / TESTING | `hasMaskedMarkerLeaf` 재귀에 깊이 상한이 없고, 에디터 "Run with Input" 자유 텍스트 JSON 검증 경로에서 이 호출이 `JSON.parse` 의 try/catch **밖**에 있어, 문법적으로 유효하지만 매우 깊게 중첩된 사용자 직접 입력 JSON 에 대해 uncaught `RangeError`(스택 오버플로)로 렌더 트리가 깨질 수 있음. backend 짝 함수(`deepRedactCore`)는 `MAX_REDACT_DEPTH=10` 상한이 있지만 이 프런트 함수엔 없음 | `codebase/frontend/src/lib/utils/masked-markers.ts:64-73`(`hasMaskedMarkerLeaf`), `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:103-120`(118행 호출이 108-113행 try/catch 밖) | 깊이 상한 추가(backend `MAX_REDACT_DEPTH` 미러) 또는 118행 호출을 108-113행 try/catch 범위 안으로 이동해 `RangeError` 도 "invalid JSON" 메시지로 흡수 |
| 3 | DOCUMENTATION | plan 체크리스트의 리뷰 라운드 카운트가 stale — code-review 를 "3라운드"(`14_08_45`/`14_44_08`/`15_10_25`)로만 나열하지만 이 diff 의 마지막 커밋(`e1607c737`, 커밋 메시지 자체가 "라운드5 처분")까지 실제로는 **5라운드**(`15_32_34`·`15_59_17` 누락) 포함. impl-done consistency 도 "3라운드"로 적었으나 `meta.json` 실측상 **4건**(`14_44_42`·`15_10_56`·`15_33_05`·`15_59_50`). "문서 패턴 3번 재발"도 실제 9곳보다 낮게 표기 | `plan/in-progress/eia-inputdata-marker-guard.md:153-162` | 153행을 "5라운드"+`15_32_34`·`15_59_17` 추가, 162행을 "4라운드"+4개 ID 로 갱신, 160행 재발 횟수 정정. `plan/complete/` 이동 전 처리 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `POST /executions/:id/rerun` 의 `inputOverride` 를 서버측에서 마스킹 마커 리터럴로 거부하지 않음 — UI 우회 시 재현 피해는 호출자 **자기 자신**의 새 실행 오염뿐(RBAC/IDOR/ownership 게이트 유지, 기밀성 침해 아님). 이미 트래커 등재·범위 밖 확정 | `executions.service.ts` `reRun`(~417-505행) | (선택) `resolveTriggerParameters` 직후 leaf 값이 마커와 정확 일치하면 `INVALID_INPUT` 거부하는 defense-in-depth |
| 2 | PERFORMANCE | 목록 조회(`toExecutionDto`)가 이전엔 무비용이던 `inputData` 도 마스킹 트리 순회 대상에 편입 — 행 수 × payload 크기 비례 CPU 증가(identity 캐시 미스, 신규 엔티티 인스턴스라 캐시 히트 없음). 보안 요구상 불가피, 별도 조치 불요 | `executions.service.ts` `toExecutionDto`/`toResponseExecution` | 대량 페이지네이션 확대 시 3-컬럼 마스킹 비용 함께 고려 |
| 3 | PERFORMANCE | 에디터 실시간 JSON 검증(`jsonError` useMemo)이 디바운스 없이 `JSON.parse`+`hasMaskedMarkerLeaf` 두 번의 O(n) 순회 수행 — 현재 규모(트리거 파라미터 폼)에서 위험 낮음 | `editor-toolbar.tsx:103-120` | 대용량 JSON 붙여넣기가 흔해지면 디바운스 고려 |
| 4 | MAINTAINABILITY | `isStructuredField` 가 `blockedByMaskedInput` 의 `maskedKeys.some()` 콜백 안에서 매번 `fields.find()`(O(n)) 수행 — 필드 수 작아 실질 위험 없음 | `rerun-modal.tsx`(`isStructuredField`/`blockedByMaskedInput`) | 필드 수가 많아지면 `useMemo` 로 `Map` 색인 고려 |
| 5 | MAINTAINABILITY | "카브아웃 폐지" 배경 서사가 6개 이상 파일(주석/JSDoc/CHANGELOG)에 근접 중복 — 서로 모순 없음, 이전 라운드가 이미 인지·감수한 트레이드오프 | `executions.service.ts`/`.spec.ts`, `execution-response.dto.ts`, `background-runs.service.ts`, `background-run-response.dto.ts`, `CHANGELOG.md` | 조치 불요 |
| 6 | TESTING | `blockedByMaskedInput` 의 "값이 비었는가" 단독 우회(boolean 필드+지연 스키마 조합, 원 버그 형태)를 정확히 재현하는 회귀 캐너리 부재 — 현재 설계상 구조적으로는 막혀 있음(`touchedMaskedKeys` 가 coercion 결과와 무관) | `rerun-modal.tsx:368,328` | "마스킹된 boolean 필드가 지연 스키마 로드 후에도 계속 막힌다" 캐너리 추가 |
| 7 | TESTING | frontend `MASKED_MARKERS` "backend SoT 일치" 테스트가 같은 파일 내 리터럴-대-리터럴 비교라 backend 상수 변경을 실제로 감지 못함(진짜 크로스체크 아님) — 트래커 등재 추정 | `masked-markers.test.ts:13-19` | (미등재라면) 테스트명 하향 조정 또는 backend 상수 export 해 실제 크로스체크로 승격 |
| 8 | DOCUMENTATION | plan 제목("재제출 소비처 2곳") vs CHANGELOG 제목("3곳") 표기 차이 — 각자 내적으로 일관(전자=이 작업이 신설한 곳, 후자=닫는 조건 충족 총합). 직전 라운드가 이미 defer | `plan/in-progress/eia-inputdata-marker-guard.md:2` vs `CHANGELOG.md:3` | 조치 불요(직전 판정 유지) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | reRun 서버측 마커 미검증 (INFO, 트래커 등재·범위 밖 확정) |
| performance | LOW | `hasMaskedMarkerLeaf` 깊이 무제한+try/catch 밖 호출(WARNING), 목록 마스킹 비용·디바운스 부재(INFO 2건) |
| architecture | LOW | 신규 CRITICAL/WARNING 없음, 기존 구조적 부채 2건 모두 트래커 확인·근거 有 |
| requirement | NONE | 5라운드 fix 전부 code/spec/test 3층위 line-level 재확인, 신규 결함 없음 |
| scope | NONE | 34개 실 변경 파일 전부 단일 목표에 수렴, 범위 이탈 없음 |
| side_effect | MEDIUM | `inputData` 응답 내용 계약 반전 — 스키마 미검출 breaking change, 저장소 밖 소비자 확인 미완료 |
| maintainability | LOW | O(n) lookup·배경 서사 중복(INFO 2건), 구조적 부채 없음 |
| testing | LOW | 회귀 캐너리 갭 3건(전부 INFO), 핵심 우회 경로 3종은 정밀 캐너리로 고정 확인 |
| documentation | LOW | plan 라운드 카운트 stale(WARNING), 제목 표기 차이(INFO, defer) |
| api_contract | LOW | `inputData` 내용 계약 이슈 재확인(WARNING, side_effect 와 동일 사안) |
| user_guide_sync | NONE | 매칭 3개 trigger 전부 동반 갱신 완결, 누락 0건 |

## 발견 없는 에이전트

requirement, scope, user_guide_sync — 위험도 NONE, 신규 발견 없음. security 도 NONE(유일 항목은 이미 범위 밖 확정된 INFO).

## 권장 조치사항

1. `spec-sync-external-interaction-api-gaps.md` 의 "외부 소비자 확인" 항목(WARNING #1) — 저장소 밖 REST `inputData` 소비자 존재 여부를 실제로 조사해 트래커를 닫거나, 있다면 릴리스 노트에 계약 변경을 명시한다. 이 PR 배포 전 최소 "확인했으나 없음" 근거는 남기는 것을 권장.
2. `hasMaskedMarkerLeaf`(WARNING #2) 에 깊이 상한을 추가하거나, `editor-toolbar.tsx` 118행 호출을 기존 try/catch 범위 안으로 이동해 uncaught `RangeError` 가능성을 제거한다 — 작지만 실제 코드로 재현 가능한 견고성 결함이므로 이번 PR 범위에서 처리 권장.
3. `plan/in-progress/eia-inputdata-marker-guard.md` 의 리뷰 라운드 카운트(WARNING #3)를 실제 라운드 수·ID 로 정정한다 — `plan/complete/` 이동 전 처리.
4. INFO 8건은 배포를 막을 사안이 아니며 다음 관련 작업 시 참고(회귀 캐너리 3건 보강, O(n) lookup 최적화는 규모 커질 때).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 완료, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 changeset 과 무관(신규 의존성 없음) |
  | database | router 판단상 이번 changeset 과 무관(스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 changeset 과 무관(동시성 로직 변경 없음) |
