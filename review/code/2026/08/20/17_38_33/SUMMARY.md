# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 새 마커 가드는 견고하나 **API 계약 표면**(`Execution.inputData` 응답 값-의미 반전이 스키마에 안 드러남 + `inputOverride` 서버측 마커 거부 부재)이 아직 실제로 해소되지 않은 채 트래커에만 등재돼 있고, `background-runs.service.spec.ts` 에 형제 파일과 동일 클래스의 vacuous 단언이 남아 있다. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract | `Execution.inputData` 응답 콘텐츠 계약이 원문→마스킹으로 반전됐는데 OpenAPI/DTO 스키마(`nullable: true`, `additionalProperties: true`)는 변경 전후 동일해 스키마 diff 로는 드러나지 않는 조용한 breaking change. 저장소 내부 소비자는 이번 PR의 마커 가드로 보호되지만 저장소 밖 API 소비자(감사 export·서드파티 통합)는 공지 없이 값 의미가 바뀐다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:329` 에 등재만 되고 실제 확인·공지는 미집행. (side_effect 도 동일 지점 INFO 로 독립 확인) | `codebase/backend/src/modules/executions/executions.service.ts:1010,1075`(`toResponseExecution`, rerun-chain 조립), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:52-60` | 후속 스프린트에서 실제 집행: (1) access log 로 외부 소비자 존재 확인, (2) 있다면 릴리스 노트에 "breaking: `inputData` 값-의미 변경" 명시 공지 |
| 2 | api_contract | 마스킹 마커 재제출 차단이 **클라이언트 UI 에서만** 강제되고, 실제 재실행을 트리거하는 서버 경로(`resolveTriggerParameters`)는 `inputOverride` 값이 마커 리터럴(`'***'` 등)이어도 타입·필수값만 보고 통과시킨다. UI 를 우회하는 클라이언트(curl/서드파티)는 이 PR 이 막으려던 오염(마커 리터럴이 실제 입력이 되는 것)을 API 레벨에서 재현 가능. 기밀성 노출은 아니고(security 리뷰어는 INFO, "§R17 이 가드 범위를 UI 정상 흐름으로 명시"·기존 defer 결정에 동의) 데이터 무결성 성격. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322` 에 등재만 되고 미집행. | `codebase/frontend/src/components/executions/rerun-modal.tsx:373-380`(`blockedByMaskedInput`, 클라이언트 전용), `resolveTriggerParameters` 호출부(백엔드, 이번 diff 미포함) | defense-in-depth: `resolveTriggerParameters` 또는 rerun 핸들러에 `hasMaskedMarkerLeaf` 동형 검사를 서버측에 추가해 마커 리터럴을 `INVALID_INPUT` 류로 거부 |
| 3 | requirement | Manual Trigger 스키마가 실행 이후 바뀌어 마스킹된 파라미터 키가 현재 스키마에서 사라지면, Re-run 모달의 편집 모드가 **영구적으로 차단**된다 — 렌더되지 않는 필드는 `touchedKeys` 에 절대 들어갈 수 없어 `blockedByMaskedInput` 이 영구 `true`. 유일한 탈출구는 "원본 그대로 사용" 토글인데, 이를 켜면 다른 필드의 정상 편집까지 무시되어 "이 키만 마스킹, 나머지는 편집" 의도를 만족 못함. fail-closed 방향이라 CRITICAL 은 아니나 §R17 의 "재입력해 언블록" UX 자체가 이 경로에서 성립하지 않음. | `codebase/frontend/src/components/executions/rerun-modal.tsx` — `fields` useMemo(297-311행), `blockedByMaskedInput`(373-380행) | `fields` 계산 시 스키마에 없는 `maskedKeys` 를 fallback 필드(untyped text)로 병합하거나 `blockedByMaskedInput` 이 이 상태를 구분해 명시적 안내. 저빈도이므로 tracker 등재 후 기존 "Re-run 차단 판정 순수 함수 추출" 리팩터와 병합 처리도 대안 |
| 4 | testing | `background-runs.service.spec.ts` 의 노드 레벨 `inputData` 마스킹 단언이 `inputData`+`outputData` 를 **한 문자열로 합친 뒤** `toContain('***')`(양성) 하나만 두어, `outputData` 쪽 마스킹만으로 통과 — `inputData` 마스킹이 필드를 비우거나 `null` 로 떨어뜨리는 회귀가 나도 검출 못함. 같은 PR 이 형제 파일(`executions.service.spec.ts` ①②⑥⑧⑧-b)에서 정확히 이 클래스의 결함을 뮤테이션으로 잡아 고쳤는데 이 파일엔 번지지 않음. | `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:262-266` | `inputData` 전용 문자열(`JSON.stringify(...data[0].inputData)`)에 대해 별도로 `not.toContain('admin:pw')` + `toContain('***')` 양쪽을 독립 단언 (같은 파일의 마커 보존 테스트가 이미 필드별 분리 패턴을 씀 — 재사용) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `executions.service.spec.ts` ③④⑤⑥-b 가 여전히 음성 단독 단언(결합 JSON 문자열 + 양성 단언 부재) — 이번 diff 의 방향 반전 대상이 아닌 pre-existing 노드 레벨 캐너리라 범위 밖으로 판단, 라운드8 커밋 메시지도 "노드 레벨 캐너리는 그대로 둔다" 명시 | `executions.service.spec.ts:1198,1228,1250-1253,1362,1369` | 여유 있으면 같은 양성-단언 패턴을 필드별로 분리해 자매 표면 단언 강도 통일. 급하지 않으면 트래커 등재 |
| 2 | testing | 마스킹-가드 왕복(마스킹값 → 프리필 스킵/제출 차단 → 재입력 → 해제)을 검증하는 e2e(Playwright) 테스트 없음. unit/component 커버리지가 촘촘해 실질 위험은 낮음 | `codebase/frontend/e2e/`(grep 매치 0건) | 필수 아님. 다음 e2e 정비 라운드에서 짧은 스모크 1개 추가 고려 |
| 3 | maintainability | 신규 `describe` 블록(`rerun-modal.test.tsx`)이 상위 블록의 `beforeEach` 6줄을 토큰 단위로 그대로 복제 — 지금은 무해하나 이후 한쪽만 갱신되면 격리 보장이 조용히 갈릴 수 있음 | `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` | 파일 최상위 공용 `beforeEach` 하나로 통합하거나 `resetTestState()` 헬퍼로 추출 |
| 4 | maintainability | "2026-08-20 카브아웃 폐지" 배경 서사가 6개 이상 파일에 근접 중복 서술 — CHANGELOG 스스로 "SoT+미러" 트레이드오프로 이미 인지·수용, 직전 2라운드도 동일 판정 (재확인, 신규 아님) | `CHANGELOG.md:3-33`, `executions.service.ts` JSDoc, `execution-response.dto.ts:49-60,174-181`, `background-run-response.dto.ts:49-51`, `background-runs.service.ts:300-304`, `executions.service.spec.ts` describe JSDoc | 선택 사항. `toResponseExecution` 마스킹 표를 유일 SoT로 삼고 나머지는 "SoT 참조"로 축약 |
| 5 | side_effect | `MASKED_MARKERS`/`isMaskedMarker` 가 `dynamic-form-ui.tsx` 공개 export 에서 `lib/utils/masked-markers.ts` 로 이동 — 잔존 참조 0건 실측, 순수 위치 이동으로 위험 없음 (기록용) | `dynamic-form-ui.tsx`(제거) → `lib/utils/masked-markers.ts`(신규) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 서버측 `inputOverride` 마커 거부 부재(INFO, 기존 defer 동의) 외 net-new 이슈 없음 |
| requirement | LOW | Re-run 모달 스키마 드리프트 시 영구 편집 차단 edge case(WARNING) |
| scope | NONE | 라운드7·8 커밋 모두 예고한 범위만 정확히 수행, 무관한 변경 없음 |
| side_effect | LOW | `inputData` 응답 의미 반전(INFO, 트래커 등재됨), 모듈 이동 잔존 참조 0건 |
| maintainability | LOW | 신규 테스트 `beforeEach` 복제(INFO), 배경 서사 다중 중복(INFO, 기존 인지) |
| testing | LOW | `background-runs.service.spec.ts` vacuous 단언(WARNING), 자매 pre-existing 갭·e2e 부재(INFO) |
| documentation | NONE | 과거 라운드 수정 전부 재확인 완료, 신규 결함 없음 |
| api_contract | MEDIUM | 응답 의미 반전 무공지(WARNING) + 서버측 마커 거부 부재(WARNING), 둘 다 트래커 등재만 되고 미집행 |
| user_guide_sync | NONE | 매칭 3개 trigger(new-ui-string, run-debug-flow-change, backend-api-change) 전부 동반 갱신 완결 |

## 발견 없는 에이전트

scope, documentation, user_guide_sync

## 권장 조치사항
1. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재된 두 API 계약 갭(응답 의미 반전 무공지, 서버측 마커 리터럴 거부 부재)을 후속 스프린트에서 실제 집행 — 특히 서버측 `hasMaskedMarkerLeaf` 동형 검사는 defense-in-depth 로 비용 대비 효과가 높다.
2. `background-runs.service.spec.ts` 의 `inputData` 마스킹 단언을 `outputData` 와 분리해 필드별 독립 검증으로 교체 — 형제 파일(`executions.service.spec.ts`)에 이미 적용된 패턴 재사용.
3. Re-run 모달에서 Manual Trigger 스키마 드리프트로 마스킹 키가 영구히 편집 불가능해지는 edge case를 tracker 에 등재하고, 기존 "Re-run 차단 판정 순수 함수 추출" 리팩터와 함께 처리 검토.
4. (선택) `rerun-modal.test.tsx` 신규 `describe` 의 `beforeEach` 중복을 공용 헬퍼로 통합.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **제외**: 5명 (아래 표)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(마스킹 가드·응답 필드) 밖으로 스코프 산정 (상세 사유 미제공) |
  | architecture | 상동 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |

---