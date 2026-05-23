# Cross-Spec 일관성 검토 결과

검토 모드: 구현 착수 전 (`--impl-prep`)
Target 영역: `spec/4-nodes/`
검토 일시: 2026-05-23

---

## 발견사항

### [CRITICAL] Parallel 노드 `count` 필드 — 공통 규약과 노드 스펙 간 직접 모순

- **target 위치**: `spec/4-nodes/1-logic/10-parallel.md §5.2` — "**`count` 필드는 제거됨** (P1.1 직교성 — `branches.length` 가 SSOT)"
- **충돌 대상**:
  - `spec/4-nodes/1-logic/0-common.md §9.1` 테이블 — Parallel 의 완료 시점 output 이 `{ branches: [...], count }` 로 명시 (`count` 포함)
  - `spec/4-nodes/1-logic/0-common.md §5` (반복/분기 출력 구조 CONVENTIONS §9.2) — `컨테이너 / 분기 노드는 { <컬렉션>, count } 형태로 결과를 내보낸다`
  - `spec/4-nodes/1-logic/0-common.md §11` 색인 — Parallel 행 `§5.7 {branches, count}`
- **상세**: Logic 공통 규약(0-common.md)은 모든 컨테이너 노드(loop/foreach/map/parallel)가 `{ <컬렉션>, count }` 를 공통 계약으로 방출한다고 명시한다. 반면 Parallel 노드 스펙은 `count` 필드를 "제거됨"으로 선언했다. 두 문서 중 하나가 잘못된 상태이며, 어느 쪽을 구현해도 나머지가 틀리게 된다.
- **제안**: Parallel 스펙의 `count` 제거 결정(`D2 결정`)을 공통 규약 §5·§9.1·§11 에 반영해 Parallel 만 `count` 를 제외하는 예외를 명시하거나, 반대로 Parallel 도 `count` 를 복원하도록 Parallel 스펙을 수정해야 한다. 어느 쪽이든 두 파일을 동시에 갱신해야 한다.

---

### [CRITICAL] WS Protocol `buttonConfig.timeout` / `timeoutAction` — Presentation 공통 규약의 무제한 대기 정책과 직접 모순

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §3 Blocking Mode 실행 흐름` — "사용자 인터랙션 대기 (외부 cancel/종료 전까지 **무제한 대기**)", §6.1 "버튼 클릭 시까지 **무제한 대기** (외부 cancel/종료 외에는 타임아웃 없음)"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.4` — `buttonConfig: { ..., "timeout": 300, "timeoutAction": "cancel" }` 예시 JSON
- **상세**: Presentation 공통 규약은 버튼 blocking 시 타임아웃 정책이 없음을 명시하고, 각 노드 스펙(`1-carousel.md`, `4-form.md` 등)도 동일하게 "무제한 대기"를 반복 명시한다. 그러나 WS Protocol 스펙의 `execution.waiting_for_input` 페이로드 예시에는 `buttonConfig.timeout: 300` 과 `buttonConfig.timeoutAction: "cancel"` 이 포함되어 있어, 타임아웃 기능이 존재하는 것처럼 보인다. 구현자가 두 스펙을 동시에 따를 수 없다.
- **제안**: WS Protocol spec §4.4 의 `buttonConfig` 예시에서 `timeout` / `timeoutAction` 필드를 제거하거나, Presentation 공통 규약 §3에 타임아웃 정책을 공식 도입(ButtonDef 에 `timeout` 필드 추가)하고 관련 노드 스펙을 일괄 갱신해야 한다. 현재 구현 착수 시 어느 필드가 실제로 존재하는지 불명확하다.

---

### [CRITICAL] WS Protocol `buttonConfig.nodeOutput.type` 판별자 — Principle 1.1.4 위반

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §4` — "노드 판별용 `type: 'carousel' | 'table' | ...` 래퍼는 사용하지 않는다 (Principle 1.1.4)"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.4` — `buttonConfig.nodeOutput: { "type": "carousel", "items": [...], "rendered": "..." }` 예시 JSON
- **상세**: Presentation 공통 규약(CONVENTIONS Principle 1.1.4)은 output에 `type: 'carousel'` 같은 노드 판별자를 사용하는 것을 명시적으로 금지한다. 그러나 WS Protocol 스펙의 `buttonConfig.nodeOutput` 예시에 `"type": "carousel"` 판별자가 포함되어 있다. WS 레이어가 실제로 이 필드를 생성한다면 Principle 위반, 단순 예시 오류라면 스펙 품질 문제다.
- **제안**: WS Protocol spec §4.4의 `buttonConfig.nodeOutput` 예시에서 `type` 판별자 필드를 제거하고, nodeOutput 구조를 Presentation 노드의 실제 `output` shape(`{ items }`, `{ rows, rendered }` 등)으로 교체하거나, `nodeOutput` 이 별도 shape 을 갖는다면 그 스키마를 Presentation 공통 규약 §7 에 명시해야 한다.

---

### [WARNING] 데이터 모델 `container_id` 허용 타입 — Parallel 컨테이너 지원 여부 불명확

- **target 위치**: `spec/4-nodes/1-logic/10-parallel.md` — Parallel을 "컨테이너 노드 (`executionMetadata.kind = 'parallel'`)"로 명시
- **충돌 대상**: `spec/1-data-model.md §2.6 Node.container_id` — "`container_id`가 참조하는 노드의 type은 `loop`, `foreach`, `map` 중 하나여야 함 (Background는 도입 시 추가)"
- **상세**: 데이터 모델은 `container_id` CHECK 제약 허용 타입 목록에 `parallel`을 포함하지 않는다. Parallel 노드가 컨테이너 노드임에도 자식 노드가 `container_id`를 통해 Parallel 을 참조할 수 없는 상태다. 단, Parallel의 분기는 `containerId` 멤버십이 아닌 `branch_N` 출력 포트 엣지로 구조를 정의하므로, 설계 의도는 Background 와 유사하게 포트 기반 구조일 수 있다. 그러나 데이터 모델 주석은 "Background는 도입 시 추가" 라고만 적혀 있어 Parallel 의 의도적 제외인지 누락인지 불명확하다.
- **제안**: `spec/1-data-model.md §2.6` 의 `container_id` CHECK 제약 설명에 Parallel 의 포트 기반 구조 의도를 명시적으로 기재해야 한다 ("Parallel 은 branch 포트 엣지 기반으로 동작 — `container_id` 불필요" 또는 허용 타입에 추가). Logic 공통 §3 컨테이너 패턴 설명도 함께 갱신이 필요하다.

---

### [WARNING] Parallel 노드 `skipPolicy` 누락 — Logic 공통 `errorPolicy` 테이블과 불일치

- **target 위치**: `spec/4-nodes/1-logic/0-common.md §4` — `errorPolicy` 값으로 `stop` / `skip` / `continue` 3가지 정의, Parallel 도 동일 적용
- **충돌 대상**: `spec/4-nodes/1-logic/10-parallel.md §1 설정` — `errorPolicy: stop | continue` 2가지만 정의 (`skip` 미포함)
- **상세**: Logic 공통 규약 §4는 `skip`을 독립된 정책으로 정의하고 "Map / ForEach / **Parallel**은 반복 중 에러 발생 시 다음 정책으로 분기된다"라고 명시한다. 그러나 Parallel 노드 스펙 §1에서는 `errorPolicy` enum 이 `stop | continue` 만 노출되어 있고 `skip` 이 없다. Parallel 에서 `skip` 이 의도적으로 제외된 것이라면 공통 §4의 테이블에서 Parallel 을 제외하는 각주가 필요하다.
- **제안**: Parallel 스펙 §1에 `skip` 미지원 이유를 명시하거나, 지원해야 한다면 schema 에 추가한다. Logic 공통 §4 테이블도 Parallel 의 `skip` 미지원 예외를 기재해야 한다.

---

### [WARNING] Carousel `buttonConfig` 필드 위치 — `config` 하위 vs 독립 필드

- **target 위치**: `spec/4-nodes/6-presentation/1-carousel.md §5.4` — `config.buttonConfig.buttons` / `config.buttonConfig.buttonItemMap` (즉 `config` 안에 `buttonConfig` 포함)
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §3 Blocking Mode` — "글로벌 버튼 + 모든 아이템 버튼을 합쳐서 `buttonConfig.buttons`에 포함" (top-level 처럼 기술)
- **상세**: 공통 규약 §3은 `buttonConfig`를 독립 top-level 처럼 기술하지만, Carousel 스펙 §5.4의 출력 예시 JSON에서는 `buttonConfig` 가 `config` 필드 내부에 중첩되어 있다. CONVENTIONS Principle 0의 5필드 invariant (`{ config, output, meta?, port?, status? }`)를 보면 `buttonConfig`는 `config` 안에 위치해야 맞다. 그러나 WS `buttonConfig`는 payload top-level에 위치한다. 레이어(NodeHandlerOutput vs WS payload)에 따라 위치가 다른 것이 의도인지 공통 규약 §3이 혼용해서 기술하는 것인지 명확하지 않다.
- **제안**: 공통 규약 §3을 "핸들러가 `config.buttonConfig.buttons`에 통합 목록을 작성하고, 엔진이 이를 WS `execution.waiting_for_input` payload 의 top-level `buttonConfig`로 추출해 전송한다"는 명확한 레이어 분리로 재기술해야 한다.

---

### [INFO] Logic 공통 §4 `skip` 설명 — ForEach/Map 은 구체적이지만 Parallel 은 포괄적

- **target 위치**: `spec/4-nodes/1-logic/0-common.md §4` — ForEach `skip` 시 `output.items[i] = null` + `output.skipped[]`, Map `output.mapped[i] = { _skipped: true, error }` 로 각각 구체화
- **충돌 대상**: `spec/4-nodes/1-logic/10-parallel.md §5.2` — `errorPolicy='continue'` 시 `branches[i]` 가 `{ status: 'rejected', error }` shape 으로 정의 — `skip` 케이스 shape 미정의
- **상세**: 공통 §4는 `skip` 정책의 "인덱스 보존 placeholder" 위치를 각 노드별로 구체화했지만 Parallel 의 `skip` 케이스 shape 은 정의되어 있지 않다 (`continue` shape 만 존재). 동기화 갱신이 필요하다.
- **제안**: Parallel `skip` 을 지원하지 않는다면 공통 §4 Parallel 행에 N/A 표시. 지원한다면 `branches[i]` 의 `skip` shape 을 Parallel 스펙 §5에 추가한다.

---

### [INFO] Node.category Enum — `trigger` 누락

- **target 위치**: `spec/4-nodes/0-overview.md §1.2` — `category` Enum 값으로 `trigger / logic / flow / ai / integration / data / presentation` 나열
- **충돌 대상**: `spec/1-data-model.md §2.6 Node` — `category | Enum | logic / flow / ai / integration / data / presentation` — `trigger` 없음
- **상세**: 노드 개요 spec에서는 `trigger`가 카테고리 값에 포함되어 있지만, 데이터 모델 Node 엔티티의 `category` 컬럼 설명에는 `trigger`가 누락되어 있다. `manual_trigger` 노드는 실제로 존재하므로 데이터 모델의 기술 누락으로 판단된다.
- **제안**: `spec/1-data-model.md §2.6 Node.category` Enum 값 목록에 `trigger`를 추가해 동기화한다.

---

## 요약

`spec/4-nodes/` 영역은 내부적으로 세밀하게 정의된 편이나, **Parallel 노드의 `count` 필드 존재 여부**가 Logic 공통 규약(0-common.md)과 Parallel 노드 스펙(10-parallel.md) 사이에서 명확히 모순되는 CRITICAL 충돌이 존재한다. 또한 **WS Protocol spec의 `buttonConfig.timeout` / `buttonConfig.nodeOutput.type` 판별자**가 Presentation 공통 규약(무제한 대기 + Principle 1.1.4)과 직접 모순되어, 구현 착수 전 두 spec 영역(4-nodes와 5-system)의 동기화가 반드시 필요하다. 나머지는 WARNING(Parallel `skip` 미지원 경계 불명확, 데이터 모델 `container_id` 허용 타입, buttonConfig 레이어 혼용 기술)과 INFO(카테고리 enum 동기화) 수준이다.

---

## 위험도

**HIGH**

CRITICAL 항목 2건이 구현 착수 시 서로 다른 동작을 유발하는 직접 모순이며, 특히 WS Protocol과 Presentation 노드 spec의 타임아웃/판별자 불일치는 버튼 클릭 처리 구현 방향을 결정하는 핵심 경계에 위치한다. 현재 브랜치명(`render-presentation-button-click-fix`)이 이 영역 수정임을 감안할 때, 구현 전 반드시 기획자(project-planner)에 의한 spec 통합 해결이 필요하다.
