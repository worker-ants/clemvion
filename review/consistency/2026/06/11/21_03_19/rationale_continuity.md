# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/5-data/2-code.md` (worktree: `code-node-isolated-vm`)
검토 모드: spec draft (--spec)
검토 일시: 2026-06-11

---

### 발견사항

- **[INFO]** `isolated-vm` 전환 Rationale 은 충분하나 기존 로드맵 항목을 이미 달성했음을 명시
  - target 위치: `spec/4-nodes/5-data/2-code.md` §Rationale "격리 방식 `isolated-vm` 전환 — 위협 모델과 결정 (2026-06-11)"
  - 과거 결정 출처: 동 파일 구 §7.1 선택 근거 "완벽한 sandbox escape 방어는 불가 … 추후 `isolated-vm` 등으로 재검토"
  - 상세: target 의 Rationale 은 구 spec 로드맵이 지정했던 `isolated-vm` 전환을 정식 결정으로 격상하고, 기각 대안(worker_threads / 컨테이너 즉시 전환 / 현상유지+frozen-prototype)을 모두 명시하며 근거를 서술했다. 이는 Rationale 연속성 원칙에 정합한다 — 기각 대안을 재도입하지 않고 오히려 Rationale 에 기록함으로써 미래 재도입을 차단한다.
  - 제안: 추가 보완 불필요. 다만 §Rationale 에 "이전 spec §7.1 의 로드맵 항목을 본 결정으로 종결함" 을 한 줄로 명시하면 연속성 추적이 더 명확해진다.

- **[WARNING]** `spec/4-nodes/0-overview.md` §5 샌드박싱 테이블이 갱신되지 않아 target 과 모순
  - target 위치: `spec/4-nodes/5-data/2-code.md` §7.1 "현재 구현: `isolated-vm` (V8 Isolate)" + §7.2 "메모리 128MB 하드 리밋"
  - 과거 결정 출처: `spec/4-nodes/0-overview.md` §5 테이블 행 — "실행 격리: `node:vm` 컨텍스트 … 구현됨" / "메모리 제한: **미구현 (Planned)**"
  - 상세: target 은 격리 방식을 `isolated-vm` 으로 전환하고 메모리 128MB 하드 리밋을 구현됨으로 선언했으나, `0-overview.md §5` 는 동 worktree 에서 갱신되지 않아 여전히 `node:vm + buildSandbox` / "메모리 제한 미구현(Planned)" 을 기술하고 있다. 두 문서가 동일 구현 사실에 대해 모순된 값을 갖는다. `2-code.md` 는 `0-overview.md#5-노드-실행-샌드박싱` 을 직접 인용하므로(`§7` 인트로), 교차 참조 독자가 혼동할 수 있다. (합의된 invariant 위반이 아닌 문서 갱신 누락이라 WARNING 으로 분류한다.)
  - 제안: `spec/4-nodes/0-overview.md` §5 테이블의 "실행 격리" 행을 `isolated-vm` (V8 Isolate) 로 갱신하고, "메모리 제한" 행을 **구현됨 (128MB, `isolated-vm` memoryLimit)** 으로 정정한다. `buildSandbox` 참조도 제거한다.

- **[INFO]** §5 인트로의 `vm.Script` 잔류 표현 — 명칭 불일치
  - target 위치: `spec/4-nodes/5-data/2-code.md` §5 인트로 블록쿼트 — "컴파일 실패 (`vm.Script` 구문 오류)"
  - 과거 결정 출처: 동 파일 §Rationale "격리 방식 `isolated-vm` 전환" + §6 에러 코드 표 — "isolate `compileScript` 구문 오류"
  - 상세: §4 실행 로직(line 107)과 §6 에러 코드 표(line 300)는 정확히 `isolate compileScript` 로 표현하나, §5 인트로 블록쿼트만 구 표현 `vm.Script 구문 오류` 를 그대로 유지하고 있다. 기능 동작은 동일하므로 Rationale 위반은 아니나 독자가 `node:vm` 코드패스가 남아 있다고 오해할 수 있다.
  - 제안: §5 인트로 블록쿼트의 `vm.Script 구문 오류` 를 `isolate compileScript 구문 오류` 로 통일한다.

- **[INFO]** 기각 대안 "현상 유지 + frozen-prototype 단기 완화" — Rationale 기록 정합
  - target 위치: `spec/4-nodes/5-data/2-code.md` §Rationale "기각된 대안" 세 번째 항목
  - 과거 결정 출처: 해당 항목 자체 (신규 Rationale)
  - 상세: target Rationale 이 "우회 경로가 다수라 근본 차단이 아니며 다중 워크스페이스에서 수용 불가" 로 기각 근거를 명시하고 있다. 기각 대안 재도입 문제 없음. 단, 이전 spec 이 "frozen-prototype" 접근을 검토했음이 구 spec 어디에도 Rationale 로 기록되지 않았으므로, 이 항목이 향후 "구 spec 어디서 논의됐나" 질문에 답할 수 없다. 필요 시 이전 리뷰 스레드 / 커밋 메시지를 cross-link 하면 추적성이 높아진다.
  - 제안: 선택적 보완 — "구 spec §7.1 선택 근거에서 언급된 단기 완화 시도" 를 한 줄 추가.

---

### 요약

target `spec/4-nodes/5-data/2-code.md` 의 Rationale 은 `isolated-vm` 전환 결정을 신규 작성하면서 기각 대안 세 가지를 모두 명시하고, 구 `node:vm` 로드맵과의 연속성(이전 spec 이 이미 인지·기록한 트레이드오프를 발전시킨 것)을 서술한다. 따라서 기각 대안의 무근거 재도입이나 합의된 invariant 위반은 없다. 단, 동 worktree 내 `spec/4-nodes/0-overview.md §5` 가 갱신되지 않아 "node:vm + buildSandbox + 메모리 제한 미구현" 과 "isolated-vm + 128MB 구현됨" 이 동시에 기술되는 문서 내 모순이 존재한다. 이 Warning 과 두 건의 경미한 명칭 불일치(INFO)를 제외하면 Rationale 연속성은 유지된다.

### 위험도

LOW
