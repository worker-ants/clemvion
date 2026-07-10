# RESOLUTION — KB WebSocket 이벤트 count drift 정정

리뷰 SUMMARY: [`SUMMARY.md`](./SUMMARY.md) (전체 위험도 LOW, Critical 0).
개별 reviewer 상세: [`../11_28_51/`](../11_28_51/).

## 적용한 fix (commit `31bbd1d3a`)

| 항목 | 심각도 | 조치 |
|------|--------|------|
| `spec/2-navigation/5-knowledge-base.md:182` graph `_error` 6종 오서술 | WARNING | `_error` 제거 → 5종, #443 union 제거 주석 추가 |
| `spec/5-system/8-embedding-pipeline.md` Rationale "12개 이벤트" 자기모순 | WARNING | 취소선 패턴(data-flow §2.5 정렬)으로 11개 정정 |
| `CHANGELOG.md` 미갱신 | WARNING | `## Unreleased — KB WebSocket 이벤트 count drift 정정` 항목 추가 |
| 테스트 단방향 미러 한계 미문서화 | INFO | test docstring 에 한계 명시 |
| docblock rationale 중복 | INFO | hook docblock 축약(const docblock 참조) |

검증: frontend `vitest` 5/5, `eslint` 0, `tsc --noEmit` 0. backend 무변경(fix 배치는 spec/CHANGELOG/frontend 만).

## Deferred (별건 follow-up)

- **`emitEvent(event: KbEventType)` 시그니처 강화** (api-contract INFO#2): 현재 `graph-extraction.service.ts`·`embedding.service.ts` 의 private `emitEvent(event: string)` + `as` 캐스트가 union 의 컴파일타임 강제를 무력화한다. `event: KbEventType` 로 좁히면 오타/유령 이벤트를 tsc 가 잡아 이번 같은 drift 를 코드 레벨로 차단. 2개 service 파일 시그니처 변경이라 본 PR(문서/구독 정합) 범위 밖 — 리뷰어도 defer 권고. PR 본문에 follow-up 으로 명시.
- **shared KB 이벤트명 패키지** (testing·api-contract INFO#1): FE/BE 이중 하드코딩 미러를 구조적으로 제거하려면 `packages/` 공유 상수가 필요하나, socket.io 이벤트명이 프로토콜 전반 string 기반이라 대규모 리팩터 — 미채택(현행 수동 미러 + 회귀 테스트로 실용적 완화).

## 미조치 (조치 불필요)

- exact-order `toEqual` 브리틀니스(testing INFO#4): 순서 변경 미발생 + count/membership 테스트 보완, 현행 유지가 과설계 방지 관점 합리.
