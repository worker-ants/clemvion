# AI Review SUMMARY (fresh) — resolution 커밋 dedc411fd

- scope: `--commit dedc411fd` (원 review 11_44_59 의 fix 커버)
- 실행 reviewer 3: testing · side_effect · scope
- 위험도: testing MEDIUM · side_effect LOW · scope LOW

## 종합

| 항목 | 값 |
| --- | --- |
| Critical | 1 (testing — 문서 정확도, 기능 회귀 아님) |
| Warning | 1 실질(TS2578) + 문서 정확도 몇 건 |

3인 모두 negative-injection 실측으로 확인: fix 3개(frontend 스캔·NonNullable·SDK test 통한 negative)는 실제로 발화한다. 남은 건 정확성 이슈 2건.

## 조치 (2차 resolution)

### R1. [WARNING·실질] eia-events.test.ts:265 self-inflicted TS2578
설명 주석이 `// @ts-expect-error` 로 **시작**해 TS 가 실제 pragma 로 오인 → 다음 줄에 에러 없어 `Unused directive`. 현재 harness(위젯 typecheck 미배선)는 안 깨지나 C2 배선 시 터진다. SDK client.spec.ts:43 은 문장 중간 배치라 안전(비대칭 실수).
→ **fixed**: 설명 줄 앞을 비워 pragma 오인 제거. 위젯 typecheck 로 내 파일 TS 에러 0 확인.

### R2. [문서] "SDK build=tsc 가 negative 검증" 부정확
SDK `tsconfig.json` 이 `**/*.spec.ts` exclude → build 는 spec 미검. 실제 검증 통로는 `test`(ts-jest, cmd_unit 신규 배선). 기능 회귀 아님(negative 는 test 로 실제 발화, reviewer 가 removal 실측). 
→ **fixed**: client.spec.ts 주석 + RESOLUTION 정정.

### R3. [INFO] cmd_lint 에 SDK 미추가 근거 미기록
SDK 에 `eslint.config.js` 부재라 `cmd_lint` 추가 시 즉시 red — 의도적 제외. → RESOLUTION 에 근거 기록.

### R4. [INFO] followups C2 "pre-existing red 3건" stale
실측 ~10건(presentation.test.ts·use-widget-eager-start.test.ts 등). → followups 정정.

## no_change_needed / acknowledged

- SDK narrowing breaking = v0.1.0 internal-only, 위험 낮음.
- RESOLUTION(11_44_59) commit 해시 열 부재 = 같은 커밋 신설 chicken-egg(선례와 형식만 상이).

## 결론

실질 조치는 R1(TS2578) 하나. 나머지는 문서 정확도. 기능 회귀 0, fix 3개 실측 발화 확인.
