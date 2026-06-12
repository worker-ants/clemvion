# Testing Review — code-snapshot-perf

## 발견사항

### **[INFO]** 신규 테스트 5건 존재 여부 및 커버리지: 양호
- 위치: `code.handler.spec.ts` lines 629–145 (추가 블록)
- 상세: `execute — dayjs snapshot path (perf follow-up)` describe 블록에 총 5개 테스트가 추가되었다. (1) dayjs parity, (2) 25회 연속 일관성, (3) 교차 실행 프로토타입 오염 비캡처, (4) logs/$input per-exec 비누적, (5) §7.3 하드닝 스냅샷 경로 유지. 변경된 핵심 코드 경로(snapshot 생성→isolate 주입→DAYJS_SNAPSHOT 분기)가 모두 e2e 행동 테스트로 커버된다.
- 제안: 없음 (커버리지 충분).

### **[WARNING]** fallback 경로(`DAYJS_SNAPSHOT === undefined` 분기) 직접 단위 테스트 부재
- 위치: `code.handler.ts` line 1498 (`if (!DAYJS_SNAPSHOT)`)
- 상세: `DAYJS_SNAPSHOT`은 모듈 레벨 상수로 IIFE 초기화된다. 테스트 환경에서는 `ivm.Isolate.createSnapshot`이 성공하므로 항상 snapshot path만 실행된다. fallback 경로(createSnapshot 미지원 플랫폼/실패 시 `DAYJS_LOAD_SCRIPT` per-run 컴파일)는 어떤 테스트에서도 명시적으로 검증되지 않는다. 현재 테스트 파일 내에서 `DAYJS_SNAPSHOT`을 `undefined`로 강제할 방법이 없어 해당 분기는 사실상 dead code 취급된다.
- 제안: `jest.resetModules()` + `jest.mock`으로 `DAYJS_SNAPSHOT` 모듈 변수를 `undefined`로 설정한 별도 describe 블록을 추가하거나, `createSnapshot`이 throw하는 시나리오를 mock하여 fallback 경로를 1건 이상 검증할 것을 권장한다. 다만 모듈 상수가 module-private이라 주입이 쉽지 않으므로 최소한 주석으로 "fallback path not exercised in unit tests"를 명시하는 것이 권장된다. (현재 코드의 `try { } catch { return undefined }` fallback은 production defensive코드이므로 미테스트 상태로 merge하는 것은 낮은 위험이지만 커버리지 갭으로 기록한다.)

### **[INFO]** `stays consistent across many sequential executions` 테스트에서 중간값 검증 생략
- 위치: `code.handler.spec.ts` lines 61–80 (추가 블록), 812–830 (전체 파일)
- 상세: 루프 내(i=0..24) 각 실행의 `result.output` 날짜 값이 기대값과 일치하는지 검증하지 않고 `meta.success`만 확인한다. 마지막 실행(i=24)의 출력만 `'2020-01-25'`로 검증한다. 이로 인해 루프 중간에 snapshot 오염으로 잘못된 날짜가 반환되어도 테스트를 통과한다.
- 제안: 루프 내부에서 `expect(result.output).toBe(dayjs('2020-01-01').add(i, 'day').format('YYYY-MM-DD'))`와 같이 각 실행 결과를 검증하거나, 대표 구간(예: i=0, i=12, i=24)만 선택적으로 검증하면 테스트 의도를 더 완전하게 표현할 수 있다.

### **[INFO]** 테스트 격리: 동일 describe 블록 내 `context` 재사용
- 위치: `code.handler.spec.ts` `beforeEach` (lines 163–175)
- 상세: 기존 패턴과 동일하게 `beforeEach`로 `handler`와 `context`를 재생성한다. 새로 추가된 5개 테스트도 이 패턴을 따르므로 테스트 간 state 공유 위험이 없다. `logs / $input per-exec` 테스트(`keeps logs / $input per-execution`)에서 exec A와 exec B가 순차적으로 실행되지만 같은 테스트 내부이고 isolate는 각 `execute()` 호출마다 새로 생성되므로 격리가 유지된다.
- 제안: 없음.

### **[INFO]** `DAYJS_SNAPSHOT` 모듈 상수의 테스트 가시성(테스트 용이성)
- 위치: `code.handler.ts` lines 1041–1049, 1155–1163
- 상세: `DAYJS_SNAPSHOT`이 IIFE로 module-scope에서 초기화되므로 Jest의 `jest.isolateModules` 없이는 테스트에서 우회가 불가능하다. 구현 코드는 DI(의존성 주입)보다 모듈 레벨 초기화를 선택한 합리적 이유(성능 최적화의 핵심—모듈 로드 1회)가 있으나, 이로 인해 fallback 분기가 단위 테스트 경계 밖으로 밀려난다. `createSnapshot` 팩토리를 함수 인자로 주입하거나 테스트 전용 `createHandlerWithSnapshot(snapshot?)` 팩토리를 export하면 testability가 향상된다.
- 제안: P0 블로커는 아니나, W4(execute() 헬퍼 분리) follow-up 시 같이 고려할 것을 권장한다.

### **[INFO]** `§7.3 hardening` 테스트에서 `Function` 삭제 확인 방식의 미묘한 동작
- 위치: `code.handler.spec.ts` lines 132–144 (추가 블록), 883–895 (전체 파일)
- 상세: `typeof Function`이 `'undefined'`임을 검증하는 테스트는 BOOTSTRAP_SOURCE의 `delete globalThis[key]`가 스냅샷 경로에서도 정상 동작함을 확인한다. 다만 `delete globalThis.Function` 후에도 `function` 리터럴·화살표 함수는 사용 가능하며(언어 내장), 이 테스트는 `globalThis.Function` 접근 차단만 검증한다. 기존 security suite의 `should block new Function() constructor`(`return new Function("return 1")()`)가 이 케이스를 이미 커버하므로 중복이 아니라 보완 관계이다.
- 제안: 없음. 현재 구성으로 충분하다.

### **[INFO]** 메모리 한도 테스트 CI flakiness — plan에 미완료 항목으로 기록됨
- 위치: `plan/in-progress/code-node-isolated-vm-followups.md` 테스트 섹션 마지막 항목
- 상세: `execute — memory limit` 테스트(`CODE_MEMORY_LIMIT`)는 plan에서 CI flakiness 완화(`jest.retryTimes` 또는 `@slow` 분리)가 미완료 항목으로 남아있다. 이 PR은 memory limit 테스트를 수정하지 않았으므로 직접 영향은 없으나, snapshot 경로가 기본 활성화된 후 메모리 소진 패턴이 변경될 가능성(snapshot으로 로드된 heap 초기 크기 증가)이 있다.
- 제안: 이 PR 범위는 아니나, snapshot 활성화 후 `CODE_MEMORY_LIMIT` 테스트의 CI 통과율을 모니터링할 것을 권장한다.

---

## 요약

이번 변경은 `DAYJS_SNAPSHOT` 모듈 상수 추가와 `execute()` 내 분기 수정이 핵심이며, 이에 대응하는 5건의 단위 테스트(dayjs parity, 순차 일관성, 프로토타입 오염 비누적, logs/$input 격리, §7.3 하드닝 유지)가 적절히 추가되었다. 테스트는 행동(behavioral) 기반으로 snapshot 경로의 핵심 불변 조건(상태 비누적, 보안 하드닝 유지, dayjs 동작 동등성)을 명확하게 표현한다. 주요 갭은 `DAYJS_SNAPSHOT === undefined` fallback 분기로, 모듈 레벨 상수 구조상 현재 단위 테스트에서 직접 커버가 어렵다. 이 fallback은 defensive 코드로 실환경 위험이 낮지만 커버리지 블라인드 스팟으로 기록한다. `stays consistent` 테스트의 루프 내 중간값 미검증은 소규모 약점이다. 전체적으로 테스트 추가 품질과 격리 수준은 양호하다.

---

## 위험도

LOW
