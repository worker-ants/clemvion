# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/4-nodes/5-data/2-code.md`
**검토 일시**: 2026-06-11
**검토 모드**: `--spec` (spec draft 검토)

---

## 발견사항

### 1. **[CRITICAL]** 격리 방식 기술 충돌 — `node:vm` vs `isolated-vm`

- **target 위치**: `spec/4-nodes/5-data/2-code.md` §7.1 (격리 방식 표) 및 §Rationale "격리 방식 `isolated-vm` 전환" (2026-06-11)
- **충돌 대상**: `spec/4-nodes/0-overview.md §5` (노드 실행 샌드박싱 테이블)
- **상세**: target draft 는 격리 방식을 `isolated-vm`(V8 Isolate) 으로 기술하고 `node:vm` 의 prototype-chain escape 취약점을 이미 극복됨으로 서술한다. 반면 `0-overview.md §5` 는 여전히 "`code` 노드는 `node:vm` 컨텍스트에서 격리 실행하며 … `buildSandbox`"라고 명시하고, 메모리 제한 항목을 "**미구현 (Planned)**"으로 표기한다. 두 문서가 현재 구현 상태(격리 기술·메모리 제한 상태)를 정반대로 기술하므로, 어느 쪽을 신뢰해야 하는지 불명확하다.
- **제안**: `spec/4-nodes/0-overview.md §5` 를 target 과 일치하도록 갱신한다: 실행 격리 행 설명을 `isolated-vm`(V8 Isolate, `memoryLimit: 128`) 으로 교체하고, 메모리 제한 항목 구현 상태를 "구현됨 (code 노드, 128MB 하드 리밋)" 으로 갱신.

---

### 2. **[CRITICAL]** 캔버스 요약 포맷 불일치

- **target 위치**: `spec/4-nodes/5-data/2-code.md §8` (캔버스 요약)
- **충돌 대상**: `spec/4-nodes/5-data/0-common.md §3` (캔버스 요약 표)
- **상세**: target §8 는 캔버스 요약을 "`{language} · {N} lines`" 로 인용한다. 그러나 SoT 인 `0-common.md §3` 는 Code 행을 "`{language}` (대문자, `summaryTemplate: {{language|upper}}`)" 로 정의하며, 코드 줄 수는 "summaryTemplate DSL 이 개행 카운트를 지원하지 않아 요약에 포함하지 않는다"고 명시한다. target 이 인용하는 "`{N} lines`" 는 `0-common.md` 의 결정과 직접 모순된다. 이 불일치 상태에서 프론트엔드·테스트 구현 기준이 서로 다를 경우 캔버스 배지 렌더링이 어느 spec 을 따라야 하는지 알 수 없다.
- **제안**: target §8 의 인용 문자열을 "`Code` 행 인용 (`{language}`)" 으로 수정한다. 또는 `0-common.md §3` 를 "`{language} · {N} lines`" 로 변경하고 summaryTemplate DSL 에 개행 카운트 지원을 추가하는 별도 작업을 계획한다.

---

### 3. **[WARNING]** 샌드박싱 정책 문서 — `data/0-common.md §2` 가 `node:vm` 전제로 쓰인 `0-overview.md §5` 를 참조

- **target 위치**: `spec/4-nodes/5-data/2-code.md §7` 서두 — "[노드 실행 샌드박싱 정책](../0-overview.md#5-노드-실행-샌드박싱) 을 동일하게 적용한다"
- **충돌 대상**: `spec/4-nodes/5-data/0-common.md §2` 동일 참조 / `spec/4-nodes/0-overview.md §5`
- **상세**: target 이 `0-overview.md §5` 를 "동일하게 적용한다"고 참조하는데, CRITICAL#1 에서 확인했듯 해당 절의 실행 격리 기술이 `node:vm` 이다. `0-common.md §2` 도 같은 절을 참조하므로, `0-overview.md §5` 를 갱신하지 않으면 `0-common.md §2` 의 연쇄 참조도 outdated 정보를 전달하게 된다. 직접 모순은 아니지만 파급 범위가 넓다.
- **제안**: CRITICAL#1 해소 후 `0-common.md §2` 참조는 자동 정합됨. `0-common.md §2` 자체를 별도 수정할 필요는 없다.

---

### 4. **[WARNING]** 에러 코드 `CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT` legacyCode 안정성

- **target 위치**: `spec/4-nodes/5-data/2-code.md §5.3` (에러 코드 정규화 매핑 표)
- **충돌 대상**: `spec/conventions/error-codes.md §2` (rename 안정성 정책)
- **상세**: target 은 `legacyCode: "CODE_RUNTIME_ERROR"` / `legacyCode: "EXECUTION_TIMEOUT"` 를 `output.error.details.legacyCode` 로 노출하며 "후속 노드는 `output.error.code` 사용"이라고 안내한다. `error-codes.md §2` 는 에러 코드 rename 을 breaking change 로 규정하고 클라이언트가 코드 값으로 분기한다고 명시한다. `legacyCode` 를 API surface 에 노출하면 일부 후속 노드나 사용자 코드가 legacy 값(`CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT`)으로 분기할 위험이 있으며, 이는 향후 정리 시 breaking change 를 유발한다. `error-codes.md §3` 역시 이 두 코드를 historical-artifact 레지스트리에 명시적으로 등록하지 않는다.
- **제안**: `error-codes.md §3` historical-artifact 예외 레지스트리에 `CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT` 를 등록하고, "후속 노드는 `output.error.code` 를 사용할 것, `legacyCode` 는 내부 분류용 — 클라이언트 분기 금지" 를 명시한다. 혹은 `legacyCode` 를 `output.error.details` 에서 완전히 제거하고 내부 로깅 전용으로 유지하는 방안을 검토한다.

---

### 5. **[INFO]** `spec/4-nodes/0-overview.md §5` 코드 파일 참조 — `buildSandbox` 함수명 outdated

- **target 위치**: 참조 없음 (target 은 `buildSandbox` 를 언급하지 않음)
- **충돌 대상**: `spec/4-nodes/0-overview.md §5` 실행 격리 설명 — `nodes/data/code/code.handler.ts buildSandbox` 함수명 인용
- **상세**: `isolated-vm` 전환 후 `buildSandbox` 함수명은 폐기됐거나 의미가 달라졌을 가능성이 높다. CRITICAL#1 갱신 시 함수명도 함께 교체해야 명세와 코드베이스 참조가 일치한다.
- **제안**: CRITICAL#1 해소 작업 시 함수명/파일 참조도 현행 `isolated-vm` 기반 구현에 맞게 갱신.

---

### 6. **[INFO]** `spec/4-nodes/_product-overview.md ND-CD-06` 메모리 제한 구현 상태

- **target 위치**: `spec/4-nodes/5-data/2-code.md §7.2` — 128MB 하드 리밋, `CODE_MEMORY_LIMIT` 설명
- **충돌 대상**: `spec/4-nodes/_product-overview.md` ND-CD-06 — "기존 노드 샌드박싱 정책 동일 적용 (타임아웃, **메모리 제한**, 네트워크 차단) ✅"
- **상세**: ND-CD-06 은 이미 ✅ 로 표시되어 있어 target 과 정합하다. 그러나 `0-overview.md §5` 의 메모리 제한이 "미구현 (Planned)"으로 남아 있어 ND-CD-06 의 ✅ 상태와 불일치한다. CRITICAL#1 이 해소되면 자동으로 일관성이 회복된다.
- **제안**: CRITICAL#1 해소로 충분. 별도 조치 불요.

---

## 요약

target `spec/4-nodes/5-data/2-code.md` 는 `isolated-vm` 전환(2026-06-11) 을 반영한 최신 draft 이며, CONVENTIONS Principle 7·8 의 `config.code` echo 및 `output` root 직접 배치 결정과 일관성이 있다. 그러나 **두 개의 CRITICAL 충돌**이 식별됐다: (1) `spec/4-nodes/0-overview.md §5` 가 여전히 `node:vm` 기반 격리와 메모리 제한 "미구현"을 기술하여 target 의 `isolated-vm` + 128MB 하드 리밋과 직접 모순되고, (2) target §8 의 캔버스 요약 인용(`{language} · {N} lines`)이 SoT인 `0-common.md §3` 의 "`{language}` 만" 정의와 상충한다. 두 충돌 모두 그대로 merge 하면 어느 한 spec 이 작동 불가 상태가 된다. `error-codes.md` 에 `legacyCode` 등록 누락(WARNING)과 `buildSandbox` 함수명 outdated(INFO)도 CRITICAL 해소 작업과 함께 처리하는 것이 효율적이다.

---

## 위험도

**HIGH**

> CRITICAL 2건이 동시에 존재하며, 격리 방식 충돌은 보안 정책(prototype-chain escape 차단 여부) 판단 기준에 직접 영향을 준다. 캔버스 요약 충돌은 프론트엔드 렌더링 구현의 SoT 를 불명확하게 만든다. 두 CRITICAL 모두 target draft 채택 전 연동 spec 갱신이 필요하다.
