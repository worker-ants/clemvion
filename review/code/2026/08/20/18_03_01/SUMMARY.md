# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. 신규 실질 결함은 architecture 가 찾은 "스키마 드리프트 orphan 마스킹 필드 → `[object Object]` 렌더" WARNING 1건뿐이고, 나머지 WARNING 2건(서버측 마커 리터럴 미검증, `Execution.inputData` 응답 시맨틱 반전)은 이미 이전 라운드에서 인지·트래커 등재되어 의도적으로 defer 된 항목의 재확인이다. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | 스키마 드리프트로 사라진 마스킹 키(`orphanMasked`)가 강제로 `type: "string"` 필드로 되살아나면서, 원본 값이 object/array 였던 경우 `displayValue` 가 `[object Object]` 를 렌더한다. `RerunField` 가 "차단 대상 키는 렌더된다"는 새 불변식은 지켰지만 "렌더된 필드 타입이 실제 값 shape 을 반영한다"는 기존 불변식을 이 합성 경로에서 깨뜨린다 | `codebase/frontend/src/components/executions/rerun-modal.tsx:323`(원인), `:169-175`(`displayValue`), `:117-139`(`splitMaskedParameters`) | orphan 필드 타입을 원본 값 shape 으로 추론(object/array/string 구분)하거나, 최소한 "스키마 존재 + 해당 키만 드리프트 + 원본이 object" 케이스를 겨눈 회귀 테스트 추가 |
| 2 | Security / API Contract | `POST .../re-run` 의 `inputOverride` 에 마스킹 마커 리터럴(`'***'`/`[REDACTED]`/`[REDACTED_DEPTH]`)이 그대로 제출돼도 서버가 거부하지 않는다 — 이번 PR 의 재제출 오염 방지 가드는 전적으로 프런트 UI 정상 흐름(`rerun-modal.tsx`/`editor-toolbar.tsx`)에만 있고, API 를 직접 호출하면 우회 가능 | `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`, `codebase/backend/src/modules/executions/executions.service.ts`(reRun `inputOverride` 처리), `codebase/backend/src/modules/executions/dto/re-run.dto.ts` | 서버측에서 값이 `MASKED_MARKERS` 와 정확히 일치하면 거부하는 defense-in-depth 체크 추가 + planner 턴으로 §R17 에 가드 범위 명문화. **이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커에 등재된 항목의 재확인** — 이번 PR 을 막을 신규 사유 아님 |
| 3 | API Contract / Side Effect | `Execution.inputData` REST 응답의 의미가 "원문"에서 "마스킹된 값"으로 반전됐다. 응답 타입 시그니처(`Record<string, unknown> \| null`)는 그대로라 정적 스키마로는 드러나지 않는 콘텐츠 레벨 breaking change — 저장소 밖에서 이 필드를 직접 소비하는 API 클라이언트(사내 자동화·리포팅 도구 등)가 있다면 마스킹 문자열을 원본으로 오인할 위험 | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-56`, `codebase/backend/src/modules/executions/executions.service.ts`(`toResponseExecution`/`toExecutionDto`) | **이미 `review/code/2026/08/20/15_32_34/RESOLUTION.md` 트래커에 "저장소 밖 소비자 확인" 항목으로 등재, 의도적 defer** — 이 엔드포인트가 프런트 전용이라는 전제가 맞다면 spec 에 한 줄 명시 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Architecture / Testing | 마스킹 마커 집합(`MASKED_MARKERS`)·깊이 상한이 backend SoT(`sanitize-error-message.ts`)와 frontend 미러(`masked-markers.ts`) 사이에 손으로 복제돼 있고, 어긋남을 기계적으로 잡는 계약 테스트가 없다. 소비처가 1곳(폼)에서 3곳(폼·Re-run 모달·에디터 히스토리)으로 늘어 폭발 반경 확대 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:150` ↔ `codebase/frontend/src/lib/utils/masked-markers.ts:18,96` | 이미 트래커 등재(2026-08-17 최초). backend 상수 export + 계약 테스트, 또는 `packages/chat-channel-validation` 선례처럼 공유 패키지로 승격 검토 |
| 2 | Maintainability | `rerun-modal.test.tsx` 신규 describe 블록이 상위 `beforeEach` 6줄을 토큰 단위까지 그대로 복제 | `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:103-111` vs `:538-545` | 조치 불요(선택, 기존 라운드가 이미 "미조치" 판정). 공용 `beforeEach`/`resetTestState()` 헬퍼로 통합 가능 |
| 3 | Maintainability | "2026-08-20 카브아웃 폐지" 배경 서사가 CHANGELOG·backend DTO/서비스·spec 등 6개 이상 파일에 근접 중복 서술 — 단일 `MASKED_INPUT_DATA_REASON` 앵커 삭제 이후 각 파일이 조금씩 다른 문장으로 자체 반복 | `CHANGELOG.md:3-33`, `executions.service.ts`, `execution-response.dto.ts:49-56,166-171`, `background-run-response.dto.ts:49-51`, `background-runs.service.ts:300-304` 등 | 조치 불요(3라운드 연속 "알려진 트레이드오프" 판정). 선택적으로 `toResponseExecution` 마스킹 표를 유일 SoT 로 삼고 나머지는 "SoT: 표 참조"로 압축 |
| 4 | Documentation | plan 제목("소비처 2곳")과 CHANGELOG 제목("소비처 3곳")이 셈법 기준이 달라 나란히 읽으면 숫자가 어긋나 보임(plan=이 작업이 새로 추가한 것만, CHANGELOG=누적 총합) | `plan/in-progress/eia-inputdata-marker-guard.md:2` vs `CHANGELOG.md:3` | 조치 불요(3차례 반복 판정된 defer). 굳이 닫으려면 plan 제목에 "(총 3곳 중 나머지 2곳)" 한정어 추가 |
| 5 | Requirement | `spec/5-system/13-replay-rerun.md` §10.2 캐비엇은 해제 조건을 AND 로 서술하고 코드(`blockedByMaskedInput`)는 차단 조건을 OR 로 구현 — 드모르간 쌍대라 논리적으로 동치, 기능 결함 아님 | `spec/5-system/13-replay-rerun.md:360-363` vs `rerun-modal.tsx:392-399` | 조치 불요. 선택적으로 spec 캐비엇에 "구현은 반대 방향(OR)으로 짜여 있다" 한 줄 추가하면 다음 대조 비용 감소 |
| 6 | Side Effect | `setParam` 이 `paramValues`+`touchedKeys` 두 state 를 함께 갱신하도록 확장됐으나 `ReRunModal` 컴포넌트 로컬 클로저로 완전히 격리, 모달 오픈 시 두 state 가 같은 effect 에서 함께 리셋되어 시점 불일치 없음 | `codebase/frontend/src/components/executions/rerun-modal.tsx`(`setParam`) | 조치 불요 — 참고용 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 서버측 `inputOverride` 마커 검증 부재(WARNING, 기존 트래커) · 마커 집합 손복제(INFO, 기존 트래커) |
| architecture | LOW | orphan 마스킹 필드 강제 string 타입화 → `[object Object]` 렌더(WARNING, 신규) |
| requirement | NONE | spec §10.2 AND vs 코드 OR 프레이밍 차이(INFO, 논리적 동치) 외 기능/엣지케이스/spec 정합 전수 통과 |
| scope | NONE | 발견 없음. `d446ab7ad` 는 직전 라운드 WARNING 2건만 정확히 겨냥, 범위 이탈 없음 |
| side_effect | LOW | `Execution.inputData` 응답 시맨틱 반전(WARNING, 기존 트래커 재확인) · `setParam` 로컬 부작용(INFO) |
| maintainability | LOW | `beforeEach` 중복(INFO) · 배경 서사 다중 파일 중복(INFO), 둘 다 기존 라운드 재확인 |
| testing | NONE | 마커 상수 계약 테스트 부재(INFO) · 서버측 마커 미검증(INFO), 둘 다 기존 트래커. 전체 스위트 실행 GREEN(frontend 92 / backend 71 passed) |
| documentation | NONE | plan/CHANGELOG 소비처 개수 셈법 차이(INFO, 3차례 defer 확인) 외 문서 정합 전량 통과 |
| api_contract | LOW | `Execution.inputData` 응답 시맨틱 breaking change 스키마 미반영(WARNING) · 서버측 마커 미검증(INFO, 기존 트래커) |
| user_guide_sync | NONE | 발견 없음. `run-debug-flow-change`/`new-ui-string` 두 trigger 매칭, 동반 갱신(MDX 4파일 + i18n dict ko/en) 완결 확인. 가드 테스트 실행 GREEN |

## 발견 없는 에이전트

- **scope** — 이번 라운드 신규 반영분(`d446ab7ad`, 6파일)이 직전 라운드 WARNING 2건만 정확히 겨냥, 범위 이탈·무관한 수정·설정 변경 없음
- **user_guide_sync** — 매칭된 2개 trigger(`run-debug-flow-change`, `new-ui-string`)의 필수 동반 갱신이 모두 완결, 누락 0건

## 권장 조치사항

1. **(WARNING #1, 신규)** `rerun-modal.tsx` orphan 마스킹 필드의 타입을 원본 값 shape 으로 추론하거나 최소한 "스키마 드리프트 + 원본 object" 케이스의 회귀 테스트를 추가해 `[object Object]` 렌더가 의도된 동작인지 확정한다.
2. **(WARNING #2·#3, 기존 트래커 이월)** 서버측 `inputOverride` 마커 리터럴 거부 + `Execution.inputData` 응답 시맨틱 변경의 저장소 밖 소비자 영향 확인은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(및 관련 RESOLUTION.md) 트래커대로 후속 PR 에서 별도 처리한다 — 이번 PR 의 머지를 막을 사유는 아니다.
3. **(선택)** 마스킹 마커 상수의 backend↔frontend 계약 테스트 또는 공유 패키지 승격을 다음 유지보수 사이클에 반영한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **forced 전원 결과 확보됨, 강제 화이트리스트 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 changeset(마스킹 카브아웃 폐지 + 마커 가드)과 무관 |
  | dependency | 신규/변경 의존성 없음 |
  | database | 스키마·쿼리 변경 없음 |
  | concurrency | 동시성/레이스 관련 변경 없음 |