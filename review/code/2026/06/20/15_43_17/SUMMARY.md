# Code Review 통합 보고서 — 3 regression 테스트 추가

## 전체 위험도
**LOW** — 전량 테스트 파일 변경, 프로덕션 코드 무변경. CRITICAL 0, WARNING 3(유지보수성 2 + 요구사항 1). SPEC-DRIFT 2건(코드 버그 아님 — spec 갱신 누락).

## Critical 발견사항
해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `depth=1` (`not.toThrow`) 케이스에서 `p2→p3` edge 위상이 "depth=1 body 내 Parallel 탐지" 경로를 올바르게 exercise 하는지 vs 우연 escape 인지 불확실 | `execution-engine.service.spec.ts` depth-guard 테스트 | 반환값으로 inner parallel 이 body 에 포함되는지 추가 단언해 의도 명확화 |
| 2 | 유지보수성 | `planParallelBody` private 메서드를 `as unknown as {7-param sig}` 캐스팅으로 직접 접근 — 시그니처 변경 시 컴파일 오류 없이 런타임 깨질 위험 | `execution-engine.service.spec.ts` planParallelBody 캐스트 | `protected` 전환 또는 type 별칭 추출 |
| 3 | 유지보수성 | `text-classifier.handler.spec.ts` signal 검증이 `mock.calls[length-1]` 인덱스 접근 — IE 의 `toHaveBeenCalledWith(objectContaining)` 패턴과 불일치 | `text-classifier.handler.spec.ts` signal 테스트 | `toHaveBeenCalledWith(...expect.objectContaining({ signal }))` 로 교체 |

## 참고 (INFO)
- **SPEC-DRIFT ×2**: `information-extractor`·`text-classifier` single-turn/signal 단위테스트 추가가 `spec/conventions/node-cancellation.md §6` 구현 현황 표 "AI 노드 signal 전파" 에 미반영 — 코드 유지, spec §6 표 갱신(planner).
- concurrency clamp 경계값(parentEffective=32→clamp to 1) 케이스 보강 권고.
- `waitAll=false` 경로 / 이미-abort signal 핸들러 동작 미검증(별도 이슈 추적 가능, 낮은 위험).
- `handlerRegistry.register('parallel_depthtest')` 격리 주석 권고(beforeEach 모듈 재생성으로 실 오염 없음).
- text-classifier 에러경로 `err.message` surface 는 프로덕션 핸들러 책임(테스트 범위 무이슈).
- execution-engine.service.spec.ts beforeEach provider 누적은 기존 기술부채(본 변경 무관).

## 에이전트별 위험도 요약
| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| security | NONE | 테스트 파일·시크릿 없음; AbortSignal 전파 검증은 긍정 패턴 |
| requirement | LOW | SPEC-DRIFT 2(§6 표), depth=1 위상 WARNING 1 |
| scope | (write_blocked) | 결과 파일 미기록 |
| side_effect | NONE | 프로덕션 무변경, mock 격리 양호 |
| maintainability | LOW | private 캐스팅·calls[length-1] WARNING 2 |
| testing | LOW | 캐스팅 타입안전성 + 경계 케이스 INFO |

## 라우터 결정
router_safety 강제 6명(security/requirement/scope/side_effect/maintainability/testing) + concurrency 선택 실행. `scope.md` terminal write_blocked 로 디스크 미기록(라우터 success).

> CRITICAL=0. WARNING 3 중 W1·W3 조치, W2 disposition(표준 private-method 테스트 패턴), SPEC-DRIFT 는 planner follow-up.
