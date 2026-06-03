# Code Review 통합 보고서

## 전체 위험도
**LOW** — spec 내부 anchor/링크 수정 및 build-time gate 테스트 4종 신규 추가. 기능 구현 변경 없음. 발견된 Critical 없음, WARNING 6건(테스트 robustness 및 문서 의미 정합성 위주).

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의미 정합성 | `node-cancellation.md §5.1` 의 WebSocket §4.4 anchor가 `execution.node.cancelled` 이벤트 정의 섹션이 아니라 `execution.waiting_for_input` 전용 섹션을 가리킨다. pre-existing 문제일 수 있으나 독자 혼동 유발 가능. | `spec/conventions/node-cancellation.md` L109 | `spec/5-system/6-websocket-protocol.md` 에서 `execution.node.cancelled` 가 실제 정의된 섹션(§4.3 또는 §4.1 등) 확인 후 anchor 재조정. project-planner 위임. |
| 2 | 문서 카운트 혼동 | `spec/conventions/spec-impl-evidence.md` §4 제목 "5건, 모두 build 차단"과 §4.0 의 항목들(3개) 경계가 괄호 주석 전까지 불명확. | `spec/conventions/spec-impl-evidence.md` §4 | §4 제목을 "Build-time 가드 (총 8건: §4 테이블 5건 + §4.0 인접 3건)" 등으로 명시하거나 §4.0 을 별도 번호 섹션으로 분리 검토. project-planner 위임. |
| 3 | 테스트 vacuous pass | `spec-plan-completion.test.ts` 에서 `GATE_C_CUTOFF=2026-06-04` 하드코딩으로 현재 모든 기존 plan 이 grandfathered 처리되어 `enforced` 배열이 비고 per-plan describe 블록이 생성되지 않을 수 있다. | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` L24 | `enforced.length > 0` assertion 추가 또는 cutoff 이후 시작된 픽스처 plan 을 `plan/complete/` 에 추가. |
| 4 | 테스트 silent pass | `spec-link-integrity.test.ts` — `findBrokenLinks` 가 내부 예외 발생 시 또는 `collectSpecMarkdown` 이 0개 반환 시 silent pass 가능. 두 `it` 블록 실행 순서 의존성 암묵적 존재. | `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` L55-58 | `spec-links.ts` 의 `findBrokenLinks`/`collectSpecMarkdown` 에 결과 0개 시 throw guard 추가. |
| 5 | 테스트 면제 로직 미검증 | `spec-area-index.test.ts` 에서 `spec/conventions` 면제 로직(`if (rel === "spec/conventions") continue`)이 의도적으로 동작하는지 검증하는 assertion 없음. 향후 `spec/conventions/_product-overview.md` 추가 시 silently 면제될 수 있음. | `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` L46, L71 | `spec/conventions` area 가 `areas` 배열에 포함되지 않는다는 assertion 추가. |
| 6 | 문서 링크 텍스트 불명확 | `spec/2-navigation/2-trigger-list.md` 에서 rotate-secret/revoke-token SoT 링크가 §7.1·§7.3 으로 분리됐으나 링크 텍스트 "Spec EIA §7.1"·"Spec EIA §7.3" 이 섹션 내용("Trigger 엔티티 확장"·"InteractionToken")을 드러내지 않아 독자 혼동 가능. | `spec/2-navigation/2-trigger-list.md` L148-149, L267 | 링크 텍스트를 `[Spec EIA §7.1 (Trigger 엔티티 확장)]` 처럼 섹션 제목 병기. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 링크 정합 | spec 내부 anchor 30여 건 수정 전수 검증 완료. 모두 실제 heading 과 일치. | spec/*.md 변경 파일 전체 | 없음 |
| 2 | 상대 경로 | `spec/2-navigation/6-config.md`, `spec/5-system/15-chat-channel.md` 상대 경로 수정 정확. | 해당 파일 | 없음 |
| 3 | 영역 index | `spec/5-system/_product-overview.md` 16개, `spec/2-navigation/_product-overview.md` 14개, `spec/7-channel-web-chat/_product-overview.md` 4개 spec 맵 신설. 링크 파일 전수 실존 확인. | 해당 _product-overview.md 3곳 | 없음 |
| 4 | 영역 index 누락 | `spec/2-navigation/_product-overview.md` 신규 spec 맵에 `0-dashboard.md` 미포함. plan 명세 "14개"와 수 일치하므로 의도적 제외 가능성. | `spec/2-navigation/_product-overview.md` | 의도적 제외라면 주석 추가, 누락이면 "15개"로 갱신 후 링크 추가. 현 scope 외 별도 판단 필요. |
| 5 | Gate C 문서 | `spec/conventions/spec-impl-evidence.md` Gate C 행 추가, Gate D advisory 명확화, §4.0 인접 가드 소절 신설. plan item 7 명세와 일치. | `spec/conventions/spec-impl-evidence.md` §4 | 없음 |
| 6 | 테스트 회귀 가드 | `spec-link-integrity.test.ts` `slugify` pin 케이스가 이번 PR 에서 수정된 anchor 오류 패턴과 직접 대응. 효과적 회귀 가드. | `spec-link-integrity.test.ts` L65-85 | 없음 |
| 7 | 테스트 단위 | `spec-plan-completion.test.ts` — `isGateCEnforced`/`hasValidSpecImpact` 순수 함수 합성 단위 테스트 11개 추가로 vacuous pass 부분 완화. | `spec-plan-completion.test.ts` L152-176 | 없음 |
| 8 | 테스트 단위 미비 | `inGeneratedCatalog` 함수에 대한 단위 테스트 없음. 경계 케이스(catalog 경로 vs 비catalog 경로) 미검증. | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` L125-127 | 파라미터화된 단위 테스트 케이스 추가 권장. |
| 9 | 문서 anchor 의미 | `spec/4-nodes/3-ai/0-common.md` Rationale 에서 §6.2 인용 목적("`$now` 변수 설명")이 섹션 제목 "저장 전략"과 일치하는지 불명확. | `spec/4-nodes/3-ai/0-common.md` Rationale | §6.2 실제 내용 확인 후 적합한 anchor 로 재조정 검토. |
| 10 | 경로 패턴 잔존 | `spec/conventions/node-cancellation.md` L106 의 `../../spec/5-system/` 경로 패턴 이번 변경 범위에서 미수정. 기능적으로 broken 아니나 비관용적 패턴. | `spec/conventions/node-cancellation.md` L106 | 다음 링크 정합 작업 시 `../5-system/` 로 수정 권장. |
| 11 | 유저 가이드 | 매트릭스 18개 trigger 중 `spec-major-change` 1개 glob 매칭. 변경 내용 전수 검토 결과 동반 갱신 의무 누락 0건. | `doc-sync-matrix.json` 전 trigger | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | anchor 30여 건 전수 검증 완료. 2건 WARNING: `node-cancellation §5.1` anchor 의미 부정확 가능성, `spec-impl-evidence §4` 카운트 경계 혼동. |
| testing | LOW | gate 테스트 4종 신규 추가 긍정적. 4건 WARNING: vacuous pass (spec-plan-completion, spec-link-integrity), 면제 로직 미검증 (spec-area-index), catalog 면제 단위 테스트 부재. |
| documentation | LOW | spec 맵 신설, Gate C/D 명확화 긍정적. 2건 WARNING: trigger-list 링크 텍스트 불명확, node-cancellation 경로 패턴 잔존. |
| user_guide_sync | NONE | 동반 갱신 의무 누락 0건. 매트릭스 전 trigger 검증 완료. |

## 발견 없는 에이전트

- **user_guide_sync**: 동반 갱신 의무 누락 없음.

## 권장 조치사항

1. `spec-plan-completion.test.ts` 에 `enforced.length > 0` assertion 추가 또는 cutoff 이후 픽스처 plan 추가 — gate 가 실제로 동작하는지 검증.
2. `spec-link-integrity.test.ts` / `spec-links.ts` 에 `collectSpecMarkdown` 결과 0개 시 guard(throw 또는 경고) 추가 — silent pass 방지.
3. `spec-area-index.test.ts` 에 `spec/conventions` 면제 assertion 추가 — 면제 로직의 의도적 동작 명시.
4. `spec/conventions/node-cancellation.md §5.1` anchor — `execution.node.cancelled` 이벤트 실제 정의 섹션 확인 후 재조정 (project-planner 위임).
5. `spec/conventions/spec-impl-evidence.md §4` 제목 — 카운트 경계를 제목 자체에서 명시하도록 갱신 (project-planner 위임).
6. `spec/2-navigation/2-trigger-list.md` rotate-secret/revoke-token 링크 텍스트에 섹션 제목 병기 (가독성 개선).

## 라우터 결정

라우터가 reviewer 를 선별했다.

- **실행** (4명): `requirement`, `testing`, `documentation`, `user_guide_sync`
- **강제 포함(router_safety)** (2명): `documentation`, `requirement`
- **제외** (10명):

| 제외된 reviewer | 이유 |
|------------------|------|
| security | spec anchor/링크 수정 및 gate 테스트 추가로 보안 관련 표면 변경 없음 |
| performance | 성능 영향 없는 문서·테스트 변경 |
| architecture | 아키텍처 변경 없음 |
| scope | 스코프 이탈 판단 불필요 |
| side_effect | 부수효과 표면 없음 |
| maintainability | 유지보수성 검토 우선순위 외 |
| dependency | 신규 의존성 없음 |
| database | DB 변경 없음 |
| concurrency | 동시성 이슈 없음 |
| api_contract | API 계약 변경 없음 |