# 코드 리뷰 SUMMARY — KB WebSocket 이벤트 count drift 정정

- 리뷰 대상: `8c3e95319`(구현) + `31bbd1d3a`(ai-review fix). base `2aa4c8093`.
- reviewer 6: requirement / documentation / testing / maintainability / scope / api-contract.
  상세 개별 리포트: [`../11_28_51/`](../11_28_51/) (구현 시점 fan-out).
- 처분: [`RESOLUTION.md`](./RESOLUTION.md).

## 전체 위험도: LOW

구현 시점 최고 위험도는 documentation **MEDIUM**(전역 spec 미정렬 2건)이었고, 두 WARNING 을 fix `31bbd1d3a` 로 정정해 **LOW** 로 낮췄다. Critical(기능 결함) 0.

## Critical

| # | Checker | 위배 |
|---|---------|------|
| - | - | (없음) |

## 경고 (WARNING) — 처분

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | requirement·scope·documentation·api-contract (4명 교차) | `spec/2-navigation/5-knowledge-base.md:182` — graph 이벤트를 여전히 `_error` 포함 6종으로 서술 (union 권위 11종과 모순) | **Fixed**(`31bbd1d3a`): `_error` 제거 → 5종 + #443 부재 주석 |
| 2 | requirement·scope·documentation·api-contract (4명 교차) | `spec/5-system/8-embedding-pipeline.md` Rationale — "union 12개 이벤트" 가 같은 파일 §8.1/§8.2(정정된 11)와 자기모순 | **Fixed**(`31bbd1d3a`): data-flow §2.5 와 동일한 취소선 패턴으로 11개 정정 |
| 3 | documentation | `CHANGELOG.md` 미갱신 (저장소 `## Unreleased` 컨벤션) | **Fixed**(`31bbd1d3a`): `## Unreleased` 항목 추가 |

## 참고 (INFO) — 처분

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | testing·api-contract | 신규 테스트는 frontend 측 단방향 미러 — backend-first union 변경은 못 잡음(TS 타입 소거·FE/BE 분리 배포·shared 패키지 부재의 구조적 한계) | **완화**: test docstring 에 한계 명시(`31bbd1d3a`). 구조적 해소(shared 패키지)는 과설계라 미채택 |
| 2 | api-contract | `emitEvent(event: string)` + `as` 캐스트가 union 컴파일타임 강제를 무력화 — 재drift 를 코드 레벨로 막지 못함 | **Deferred follow-up**: `emitEvent` 시그니처를 `KbEventType` 로 좁히는 하드닝(2개 service 파일). 본 PR 범위 밖(리뷰어도 defer), PR 본문에 명시 |
| 3 | maintainability | KB_EVENT_NAMES docblock 과 hook docblock 의 rationale 중복 | **Fixed**(`31bbd1d3a`): hook docblock 축약, const docblock 참조 |
| 4 | testing | exact-order `toEqual` 어서션이 순서까지 강제(다소 브리틀) | 조치 불필요: 순서 변경은 실제로 안 일어나고, 별도 count/membership 테스트가 보완. 현행 유지가 과설계 방지 |
| 5 | testing·api-contract(확인) | `graph_error` 제거가 dead subscription 정리(어떤 emit 경로도 없음, #443 커밋 `6898c4b3c` 확인) — no-op·회귀 없음 | — |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| requirement | LOW→(fix 후) | backend emit(5+5)·data-flow §2.5·frontend 11종 정합 확인. 잔여 sink 2건 정정 |
| documentation | MEDIUM→LOW | cross-ref(#443·data-flow §2.5) 정확. 자기모순 2건 fix, CHANGELOG 추가 |
| testing | NONE | 신규 가드 5/5, drift 재발 감지. 단방향 미러 한계 문서화 |
| maintainability | LOW | export 승격 타당·컨벤션 일치. docblock 중복 축약 |
| scope | LOW | 무관 변경·노이즈 없음. under-scope 2건(=WARNING 1·2) 정정 |
| api-contract | LOW | wire 계약 불변(union 리터럴 무변경)·breaking 아님. emitEvent 강제력 한계는 follow-up |
