# RESOLUTION — fresh review 12_15_40 (2차)

원 review 11_44_59 의 fix(dedc411fd)를 fresh review 한 결과 정확성 이슈 발견. 조치.

## 조치 항목

| # | 검출 | 내용 | 조치 |
| --- | --- | --- | --- |
| R1 | testing·side_effect·scope (3인 수렴) | `eia-events.test.ts:265` 설명 주석이 `// @ts-expect-error` 로 시작 → TS 가 pragma 로 오인 → `TS2578 Unused directive`. self-inflicted. 현재 harness 무영향(위젯 typecheck 미배선)이나 C2 배선 시 터짐 | **fixed** — 설명 줄 앞을 비워 pragma 오인 제거. 위젯 `tsc --noEmit` 로 내 파일(eia-events/eia-types) TS 에러 0 확인 |
| R2 | testing·side_effect·scope | "SDK build=tsc 가 negative 검증" 부정확 — SDK tsconfig 가 `*.spec.ts` exclude. 실제 통로는 `test`(ts-jest) | **fixed** — client.spec.ts 주석 + RESOLUTION(11_44_59) 정정. 기능 회귀 아님(reviewer 가 removal 실측으로 test 발화 확인) |
| R3 | scope | `cmd_lint` 에 SDK 미추가 근거 미기록 | **fixed** — SDK 에 `eslint.config.js` 부재라 의도적 제외임을 RESOLUTION 에 기록 |
| R4 | testing·scope | followups C2 "pre-existing red 3건" stale (실측 ~10건) | **fixed** — followups 정정 |

no_change_needed: SDK narrowing breaking(v0.1.0 internal), RESOLUTION 해시열 부재(chicken-egg).

## TEST 결과

2차 변경 = `eia-events.test.ts`·`client.spec.ts` **주석만**(코드 라인 0줄) + 문서(followups/RESOLUTION/SUMMARY).

| 단계 | 결과 |
| --- | --- |
| lint | **PASS** (40s) |
| unit | **PASS** |
| build | **PASS** |
| e2e | **면제** — [§e2e 면제 화이트리스트](../../../../PROJECT.md) "주석 전용 변경(코드 라인 0줄)". test 파일 주석 재배치 + 문서만, 제품 런타임 0. 직전 e2e 250 통과(dedc411fd) 이후 실행 코드 무변경 |

## 보류·후속 항목

없음(R1-R4 전부 fixed). C2 등 기존 후속은 `eia-context-schema-followups.md` §리뷰 후속 유지.
