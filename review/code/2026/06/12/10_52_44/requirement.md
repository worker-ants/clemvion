# 요구사항(Requirement) Review — code-snapshot-perf

리뷰 대상: `code.handler.ts` (DAYJS_SNAPSHOT 최적화), `code.handler.spec.ts` (신규 dayjs snapshot 테스트 5건), `plan/in-progress/code-node-isolated-vm-followups.md` (체크박스 완료 처리)

관련 spec: `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md`

---

## 발견사항

### **[INFO]** [SPEC-DRIFT] spec §4 step 3 에 snapshot 최적화 경로 미기술
- 위치: `spec/4-nodes/5-data/2-code.md` §4 (실행 로직) step 3
- 상세: spec §4 step 3은 `isolated-vm isolate(memoryLimit: 128) + context 를 만들어 script.run(..., {promise: true, timeout})` 로만 기술한다. 코드에서는 `DAYJS_SNAPSHOT` 이 정의된 경우 `new ivm.Isolate({ memoryLimit, snapshot })` 로 isolate 를 생성하고, DAYJS_LOAD_SCRIPT 컴파일 단계를 생략하는 두 경로가 있다. 이 최적화는 합리적·의도적 개선(plan 항목 완료)이며 기능·보안 계약은 동일하게 유지된다. 코드 구현 자체가 틀린 것이 아니라 spec 서술이 구현보다 낡아 있는 상태다.
- 제안: 코드 유지. spec §4 step 3 을 다음과 같이 갱신 (project-planner 위임):
  > `isolated-vm` isolate(`memoryLimit: 128`) + context 를 만들어 실행. isolate 는 모듈 로드 시 `ivm.Isolate.createSnapshot()` 으로 생성한 dayjs 힙 스냅샷(`DAYJS_SNAPSHOT`)을 사용할 수 있는 경우 `new ivm.Isolate({ memoryLimit, snapshot })` 으로 생성(per-exec dayjs 재컴파일 생략); 스냅샷 미지원/실패 시 bare isolate + 런타임 `DAYJS_LOAD_SCRIPT` 컴파일 fallback.

### **[INFO]** [SPEC-DRIFT] spec §7.1 격리 방식 설명에 snapshot 메커니즘 미언급
- 위치: `spec/4-nodes/5-data/2-code.md` §7.1 (격리 방식)
- 상세: §7.1 의 현재 구현 설명은 "dayjs UMD 를 per-exec 컴파일" 하는 구 동작만 전제하고, `createSnapshot` + `snapshot` 옵션으로 dayjs 를 미리 직렬화해 두는 최적화 경로를 언급하지 않는다. 보안 모델에는 영향 없으나 구현과 서술의 간격.
- 제안: 코드 유지. spec §7.1 에 참고 노트 1줄 추가 권장: "`DAYJS_SNAPSHOT` 힙 스냅샷을 사용하면 dayjs 재컴파일 없이 per-exec isolate 를 생성하나, per-exec 마다 새 Isolate + 새 Context 를 생성하므로 메모리 격리·dispose 불변은 동일하게 유지된다."

### **[INFO]** 'stays consistent across many sequential executions' 테스트: loop 내부 결과 실질적 검증 부재
- 위치: `code.handler.spec.ts` — `stays consistent across many sequential executions (snapshot reuse)` 테스트 (loop body, lines 63–76 in diff)
- 상세: `for (let i = 0; i < 25; i++)` 루프 내 각 result 에 대해 `expect(result.meta.success).toBe(true)` 만 확인하고, `result.output` 의 날짜 정확성은 검사하지 않는다. 루프 밖의 `last` 실행은 `output` 도 검증한다. 일관성 테스트의 핵심 목적(연속 실행 간 값 변조 없음)을 완전히 증명하려면 각 실행 결과도 확인하는 것이 이상적이다. 그러나 마지막 실행에서 `last.output === '2020-01-25'` 를 검증함으로써 dayjs snapshot이 25회 연속으로 올바르게 동작했음을 증명하는 데에는 충분하므로, 구조적 결함이 아닌 개선 가능 수준의 INFO다.
- 제안: 필수는 아니나, loop 내 `expect(result.output).toBe(expectedDate)` 를 추가하면 각 반복마다 정확성을 확정적으로 검증할 수 있다.

### **[INFO]** `DAYJS_SNAPSHOT` 생성 실패 시 silent fallback — 운영 관측 불가
- 위치: `code.handler.ts` lines 1157–1163 (`DAYJS_SNAPSHOT` IIFE)
- 상세: `createSnapshot` 이 예외를 던지면 `undefined` 를 반환하여 per-run 컴파일 경로로 fallback 한다. 이는 의도된 플랫폼 호환 설계(주석에 명시)이나, 실패 시 아무런 로그/경고도 남기지 않는다. 운영 환경에서 snapshot 이 조용히 비활성화돼 있어도 알 방법이 없다.
- 제안: 심각한 결함은 아니나, `catch` 블록에 `console.warn` 또는 structured logger 1줄 추가로 진단성 향상 가능. plan W4(execute() 헬퍼 분리) 와 함께 처리 가능.

---

## 요약

이번 변경은 `ivm.Isolate.createSnapshot()` 을 이용한 dayjs 힙 스냅샷 최적화 구현이다. 핵심 요구사항 충족 관점에서 다음을 확인했다.

1. **기능 완전성**: 스냅샷 경로와 fallback 경로 모두 구현됐으며, host callbacks(`__host_*`)·§7.3 위험 global 삭제는 per-exec `BOOTSTRAP_SOURCE` 에 그대로 유지된다(W13 capture-then-delete 순서 불변). `$helpers.date()`의 dayjs 동작, `$vars` 원자적 교체, 타임아웃·메모리 리밋, 에러 코드 정규화 등 기존 기능 계약은 변경 없음.
2. **보안**: 스냅샷에는 순수 JS(dayjs UMD)만 베이크되고 host binding 은 포함되지 않는다(`createSnapshot` 은 host 없는 bare isolate 로 실행). per-exec fresh isolate + fresh context 로 실행 상태 교차 오염이 구조적으로 차단됨을 신규 테스트 5건이 검증한다(프로토타입 오염 비전파, logs/$input 비누적, §7.3 하드닝 적용 확인).
3. **엣지 케이스**: `createSnapshot` 실패 시 `undefined` fallback이 구현되어 있고, snapshot 경로 불활성화 시에도 기존 per-run 컴파일 경로가 투명하게 동작한다.
4. **spec fidelity**: spec §4 step 3 및 §7.1 에 snapshot 경로가 기술되지 않아 코드가 spec보다 앞서 있는 SPEC-DRIFT 상태이나, 이는 코드 버그가 아니라 spec 갱신 누락이다.
5. **plan 항목**: `plan/in-progress/code-node-isolated-vm-followups.md` 의 성능 항목이 `[x]` 로 정확히 완료 처리됐으며, 완료 내용이 상세하게 기록됐다. TODO/FIXME 잔존 없음.

위험도: **NONE** — Critical/Warning 발견사항 없음. spec drift 2건(INFO)과 테스트 개선 가능 사항 1건(INFO)이 전부이며, 기능·보안·계약 충족 관점에서 변경이 의도된 요구사항을 완전히 충족한다.

---

## 위험도

NONE
