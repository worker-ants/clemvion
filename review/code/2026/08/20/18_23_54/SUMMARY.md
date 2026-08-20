# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 11명 reviewer(강제 7명 전원 결과 확보) 전원이 이 changeset(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳 마커 가드)을 NONE~LOW 로 판정했다. 이미 10라운드의 code review + 9라운드의 consistency check 를 거쳐 수렴한 상태에 대한 독립 재검증이며, 이번 라운드에서 새로 발견된 유일한 항목(WARNING, plan 문서 중복 문단)은 기능·코드에 영향 없는 문서 편집 잔여물이다. 나머지 WARNING 은 모두 이전 라운드부터 트래커에 등재돼 있는 기존/추적 중 사안의 확인적 재기재다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/범위 | plan 문서에 동일 blockquote 문단("자매 중 하나만... 이 브랜치에서 네 번 나왔다")이 176~177행과 181~182행에 글자 그대로 두 번 반복된다. 커밋 `2c628f6ac` 가 기존 blockquote 바로 앞에 새 문단을 삽입하며 오프닝 두 줄을 병합하지 않고 그대로 복제한 편집 잔여물 (신규 발견, scope·documentation reviewer 공통 지적) | `plan/in-progress/eia-inputdata-marker-guard.md:176-182` | 176~177행(신규)과 181~182행(기존)의 중복된 오프닝 문장을 하나로 합치고, 178~180행(라운드10 회고)과 183행 이하(`11_01_55` 설명)를 순서대로 이어 붙인다 |
| 2 | API 계약 | `Execution.inputData` REST 응답 콘텐츠 시맨틱이 "원문"→"마스킹"으로 반전됐으나 OpenAPI 스키마(`type: object, additionalProperties: true`)는 그대로라 자동 계약 검증으로는 드러나지 않는 breaking 변경. 저장소 밖에서 이 필드를 직접 소비하는 통합/스크립트가 있다면 조용히 마스킹된 값을 받게 됨 (기존 추적 사안, security·side_effect·api_contract 3자 공통 재확인) | `codebase/backend/src/modules/executions/executions.service.ts` (`toResponseExecution`/`toExecutionDto`), `dto/responses/execution-response.dto.ts` | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:342` 에 이미 등재. 외부 소비자 존재 여부 확인 후 release-notes 로 breaking 공지 |
| 3 | 보안/API 계약 | `POST .../re-run` 의 `inputOverride` 가 서버측에서 마스킹 마커 리터럴(`'***'`, `'[REDACTED]'`)을 검증 없이 통과시킨다 — 마커 가드가 UI 계층에만 존재. `curl` 직접 호출 시 새 실행의 실제 입력이 리터럴 마커로 오염될 수 있음(기밀성 침해 아님, 호출자 자신의 데이터 무결성 문제로 한정) (기존 추적 사안, security·requirement·api_contract 3자 공통 재확인) | `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`, `executions.service.ts` 의 `useOriginal === false` 분기, `dto/re-run.dto.ts` | `inputOverride` 값이 `MASKED_MARKERS` 와 정확히 일치하면 `400 INVALID_INPUT` 계열로 거부하는 defense-in-depth 체크 추가. `spec-sync-external-interaction-api-gaps.md:322` 에 이미 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `inputData` egress 카브아웃 폐지로 list/detail 응답 경로의 행당 마스킹 비용이 `outputData`/`error` 수준으로 늘어남(zero-cost 패스스루 → 재귀 walk). list 는 페이지네이션(기본 20)으로 유계, 3개 컬럼이 각각 독립 walk(WeakMap 캐시 이득 없음) | `executions.service.ts` (`toExecutionDto`/`toResponseExecution`) | 의도된 트레이드오프, 조치 불요. 대용량 워크플로우 증가 시 p95 실측 권장 |
| 2 | 성능 | `ReRunModal.blockedByMaskedInput` 이 `useMemo` 없이 매 렌더 재계산됨. 파라미터 수가 유계라 실질 영향 미미 | `rerun-modal.tsx` | 조치 불요. 파라미터 수 증가 시 `useMemo` 고려 |
| 3 | 보안/테스트 | `MASKED_MARKERS` 상수가 backend SoT 와 frontend 미러 사이에 손으로 복제돼 있고, 어긋남을 잡는 계약 테스트가 없음(리터럴-대-리터럴 비교만 존재) | `codebase/backend/src/shared/utils/sanitize-error-message.ts:150` ↔ `codebase/frontend/src/lib/utils/masked-markers.ts:16` | 공유 패키지 추출 또는 두 파일 대조 CI 스크립트 추가. 트래커 등재됨 |
| 4 | 부작용 | `MASKED_MARKERS`/`isMaskedMarker` export 위치가 `dynamic-form-ui.tsx` → `lib/utils/masked-markers.ts` 로 이동. 전 소비처(3곳) 갱신 확인, dangling import 없음 | `codebase/frontend/src/lib/utils/masked-markers.ts` | 조치 불요 — 이미 완결된 마이그레이션 |
| 5 | 유지보수성 | `rerun-modal.test.tsx` 두 `describe` 블록이 동일 `beforeEach` 6줄 중복 (3라운드 연속 "선택, 비차단"으로 미조치) | `rerun-modal.test.tsx:103-111`, `:538-546` | 선택: `resetTestState()` 헬퍼로 추출 |
| 6 | 유지보수성 | "카브아웃 폐지" 배경 서사가 6개 이상 파일에 근접 중복 서술(SoT 앵커 삭제 후 각자 반복) | `CHANGELOG.md`, DTO/서비스 JSDoc 다수 | 선택: `toResponseExecution` 표를 유일 SoT로 삼고 나머지는 참조만 |
| 7 | 유지보수성 | `ReRunModal` 컴포넌트 608줄, 다관심사 단일 파일(4번째 소비처 생기면 판단하기로 유예된 항목, 조건 미성립 유지) | `rerun-modal.tsx` | 선택, 비차단 |
| 8 | 문서화 | plan 제목("소비처 2곳")과 CHANGELOG 제목("소비처 3곳")이 다른 기준(신규 추가분 vs 총합)으로 세어 나란히 읽으면 어긋나 보임. 각 문서 내적으로는 일관 (여러 라운드 조치-불요 확정) | `plan/in-progress/eia-inputdata-marker-guard.md:2` vs `CHANGELOG.md:3` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `inputOverride` 서버측 마커 미검증(WARNING, 기존), 마커 상수 손-복제(INFO, 기존). 그 외 마스킹 표면 전수 일관, 인가 무변경 확인 |
| performance | LOW | `inputData` 재귀 마스킹 비용 증가(INFO), 모달 `useMemo` 부재(INFO). 알고리즘적 위험 없음 |
| architecture | LOW | 새 CRITICAL/WARNING 없음. `inferTypeFromValue` fix 반영 확인, 유틸 승격으로 레이어 개선 확인 |
| requirement | NONE | CRITICAL/WARNING 없음. 3조건 판정·spec fidelity·깊이 상한 매핑 전수 정합 확인 |
| scope | LOW | plan 문서 중복 문단(WARNING, 신규). 코드 변경은 직전 라운드 지적 사항에만 정확히 국한 |
| side_effect | LOW | REST 응답 콘텐츠 계약 반전(WARNING, 기존), export 위치 이동(INFO, 안전 확인). 서버 재실행 로직은 마스킹 미적용 raw 경로 확인 |
| maintainability | LOW | INFO 3건 전부 기존 라운드에서 이미 "선택/유예" 판정된 재확인 항목 |
| testing | NONE | frontend 93 + backend 71 테스트 green 실측, 뮤테이션 재검증 성공. 마커 미러 계약 테스트 부재(INFO, 기존)만 |
| documentation | LOW | plan 문서 중복 문단(WARNING, scope 와 공통 발견), 소비처 개수 표기 차이(INFO, 조치불요 확정) |
| api_contract | LOW | 응답 콘텐츠 계약 breaking 반전(WARNING, 기존), `inputOverride` 미검증(WARNING, 기존). 응답 형식·인가·URL 무변경 |
| user_guide_sync | NONE | 매트릭스 20행 중 2개 trigger 매칭, 필수 동반 갱신 이미 완결. 이번 라운드 델타는 신규 trigger 미개방 |

## 발견 없는 에이전트

requirement, testing, user_guide_sync — CRITICAL/WARNING 없음 (NONE 판정).

## 권장 조치사항

1. **(선택, 비차단)** `plan/in-progress/eia-inputdata-marker-guard.md:176-182` 의 중복 blockquote 문단을 정리한다 — 이번 PR 을 막을 사안은 아니나 다음 편집 시 함께 정리 권장.
2. **(트래커 진행 중, 이 PR 범위 밖)** `inputOverride` 서버측 마스킹 마커 리터럴 거부(defense-in-depth)를 `spec-sync-external-interaction-api-gaps.md` 항목대로 별도 작업(planner 턴 동반)으로 착수한다.
3. **(트래커 진행 중, 이 PR 범위 밖)** `Execution.inputData` 응답 의미 반전에 대해 외부 API 소비자 존재 여부를 확인하고, 있다면 release-notes 로 breaking 변경 공지한다.
4. **(선택)** frontend/backend 마스킹 마커 상수의 손-복제를 해소하는 공유 패키지 추출 또는 계약 테스트를 별도 작업으로 고려한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨. 강제 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 changeset 과 무관 (신규 의존성/버전 변경 없음) |
  | database | router 판단상 이번 changeset 과 무관 (스키마/마이그레이션 변경 없음) |
  | concurrency | router 판단상 이번 changeset 과 무관 (동시성 제어 로직 변경 없음) |