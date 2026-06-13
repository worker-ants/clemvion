# RESOLUTION — form-gaps §5.5 ai-review (2026-06-14/01_22_06)

RISK=LOW, Critical 0, Warning 5. 수동 조치.

## WARNING 처리
| # | 상태 | 조치 |
|---|------|------|
| 1 requirement (재수화 interactionType 손실) | ✅ FIXED | `node.type === 'form'` 일 때 `fallbackMeta = { interactionType: 'form' }` 를 resumedMeta 앞에 합성 → prevMeta 부재(재수화)에도 interactionType 보존. spec §5.5 정합. |
| 2 testing (startedAt 부재/nodeExec undefined) | ✅ FIXED | startedAt 없는 nodeExec → durationMs 미설정·기존 meta 보존 테스트 추가. |
| 3 testing (시계 역행 0 클램핑) | ✅ FIXED | 미래 startedAt → durationMs=0 테스트 추가. |
| 4 testing (prevMeta 부재) | ✅ FIXED | meta 키 없는 재수화 케이스 → fallback interactionType + durationMs 테스트 추가. |
| 5 maintainability (테스트 structuredOutputCache 직접 주입) | ⏭ 수용 | `setStructuredOutput` 은 output 을 adapt 변환해 durationMs=0 검증을 오염시킬 수 있어, 단위 테스트의 결정적 검증을 위해 직접 cache 주입을 의도적으로 유지(test-only, 보안/런타임 무영향). |

## INFO 처리
| # | 상태 | 조치 |
|---|------|------|
| 3 requirement (fallback durationMs NaN 가드) | ✅ FIXED | nodeExec.durationMs fallback 에 `startedAt ? ... : 0` 가드. |
| 7 side_effect (fallback Math.max(0) 비대칭) | ✅ FIXED | fallback 에도 `Math.max(0, ...)` 적용(resumeDurationMs 경로와 동일). |
| 11 testing (DB durationMs save 검증) | ✅ FIXED | main 테스트에 mockNodeExecutionRepo.save 의 durationMs ≥ 4000 assertion 추가. |
| 1,2,4,6,8,9,10,12 | ⏭ 수용/별도 | 파일검증 cluster(plan 추적)·startedAt 신뢰·근사치·null 레거시·중첩 spread 가독성·plan blockquote·applyContinuation 과거 주석(기존 이슈, 별도 정리 PR). |

## 검증
- §5.5 테스트 4건(main + startedAt 부재 + 시계역행 + 재수화 fallback) 통과. build·lint(0) 통과.

## 결론
Critical 0. Warning 5 해소(W1 코드·W2/W3/W4 테스트·W5 수용 근거). 가치 INFO 3건 반영.
