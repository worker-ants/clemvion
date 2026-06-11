# Rationale 연속성 검토 결과

**대상 문서**: `spec/4-nodes/5-data/2-code.md`
**검토 일시**: 2026-06-11
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

### 발견사항 없음 — 모든 Rationale 연속성 점검 통과

---

## 상세 분석

### 1. 기각된 대안의 재도입 — 없음

target 의 `## Rationale` 에 명시된 기각 대안 세 가지를 검토했다.

**`isolated-vm` 전환 결정 (2026-06-11)에서 기각된 대안**:
- `worker_threads` 권한 박탈 — 본문 §7 및 body 에서 어디에도 재도입 없음.
- 컨테이너/gVisor 즉시 전환 — §7.1 로드맵 행으로 "선택적 후속 강화"로 명시되었고, "즉시 전환(현재 구현)"이 아닌 "선택적 미래 강화" 위치를 유지함. 기각된 "즉시 전환"과 "로드맵 잔류"는 개념적으로 구분되며 충돌 없음.
- `현상 유지 + frozen-prototype 단기완화` — 본문 어디에도 재도입 없음.

**`output.result` 래핑 미적용 결정 (2026-06-03)에서 기각된 대안**:
- Code 출력을 `output.result` 로 래핑 — §5.1 에서 `output` root 직접 배치를 명확히 유지. `node-output.md` Principle 8.2 표도 "root 직접 배치 (Code/Transform 예외)"로 정합화되어 있음.

**`config.code` raw echo 결정 (2026-06-03)**:
- 기각된 "echo 금지" 해석 — `node-output.md` Principle 7 "절대 echo 금지" 목록에서 `code.config.code`가 삭제·"항상 echo"로 이동됨. target 과 conventions 가 일치.

### 2. 합의된 원칙 위반 — 없음

검토한 원칙과 정합 여부:

| 원칙 | 확인 결과 |
|------|-----------|
| CONVENTIONS Principle 7 (`config` echo) | `config.code` raw echo 허용 — `node-output.md` §7 명시적 예외로 정합 |
| CONVENTIONS Principle 8.2 (`output.result` 래핑) | Code 노드 root 직접 배치 — `node-output.md` Principle 8.2 표의 "Code/Transform 예외" 행과 정합 |
| CONVENTIONS Principle 3.1/3.2 (pre-flight throw / `output.error`) | §6 pre-flight throw 표·§5.3 런타임 에러 봉투 모두 CONVENTIONS 준수 |
| 5필드 invariant (`config`/`output`/`meta?`/`port?`/`status?`) | §5.1·§5.3 예시 JSON 모두 top-level 5필드 이내. 위반 없음 |
| Data 공통 §2·§4 샌드박싱·에러 컨트랙트 | `0-common.md §2/§4.1` 의 "Code 노드는 sandboxing 정책 준수, runtime 에러는 `port:'error'`" 와 target 본문 완전 정합 |
| `nodes-overview §5` 샌드박싱 정책 | `isolated-vm`(V8 Isolate, memoryLimit:128) 으로 현재 구현 기술 — overview 표와 정합 |

### 3. 결정의 무근거 번복 — 없음

유일한 결정 번복은 **`node:vm` → `isolated-vm` 전환**이다. 이에 대해:
- 이전 spec §7.1 "선택 근거"가 "완벽한 sandbox escape 방어는 불가 … 추후 `isolated-vm` 등으로 재검토"로 이미 인지·기록한 트레이드오프임을 target Rationale 이 명시적으로 인용.
- 전환의 배경(위협 모델), 한계(prototype-chain escape), 결정(사용자 결정 2026-06-11), 기각된 대안 3가지, 트레이드오프(node-gyp 의존성·C++ 툴체인·isolated-vm 버전 선택) 를 모두 갖춰 새 Rationale을 작성함.
- "로드맵 항목 종결"로 명시해 이전 결정과의 연속성을 명확히 함.

### 4. 암묵적 가정 충돌 — 없음

검토한 invariant:
- **다중 워크스페이스 안전 posture (self-host 단일 테넌트 가정에 기대지 않음)**: target Rationale 의 위협 모델 절이 이 posture를 명시적으로 채택함. `nodes-overview §5` 샌드박싱 정책과 방향 일치.
- **Promise/async 기능 약속 유지**: §4.1 "비동기 코드 지원: `async/await` / `Promise` 모두 사용 가능", §7.3 허용 API 표에 `Promise, async/await` 포함. Rationale에서 "Promise(async/await)는 §4.1 의 기능 약속이라 유지"로 명시. 기능 약속과 보안 결정이 충돌 없이 분리됨.
- **컨테이너/gVisor 로드맵 보존**: §7.1 표 2행 "로드맵 (선택): 컨테이너 / gVisor"가 Rationale의 기각된 대안("즉시 전환") 기록과 함께 유지되어 향후 강화 경로를 명시적으로 보존.
- **`$vars` deep clone + 원자적 교체 invariant**: §4.5 가 이 invariant 를 상세 기술하고 "설계 근거"에 Proxy 대비 선택 근거를 인라인으로 명시. 다른 spec 의 Rationale과 충돌 없음.

---

## 요약

`spec/4-nodes/5-data/2-code.md` 는 기존 spec 의 Rationale에서 명시적으로 기각한 대안을 재도입하지 않으며, 합의된 설계 원칙(`node-output.md` Principle 7/8.2/3, `0-common.md` 에러 컨트랙트, `nodes-overview` 샌드박싱 정책)을 모두 준수한다. 유일한 결정 번복인 `node:vm → isolated-vm` 전환은 이전 Rationale이 "추후 재검토"로 예고한 로드맵 항목을 종결하는 형태이며, 위협 모델·결정 근거·기각된 대안·트레이드오프를 갖춘 새 Rationale과 함께 작성되어 있다. Rationale 연속성 관점에서 문제 없음.

---

## 위험도

NONE

STATUS: SUCCESS
