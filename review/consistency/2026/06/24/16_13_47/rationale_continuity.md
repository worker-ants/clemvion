# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-draft-m4-park-entry-sync.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 발견사항 1

- **[WARNING]** A3 의 "§4 런타임 플러그인 로딩 미구현 invariant" 근거 출처가 부정확
  - target 위치: `plan/in-progress/spec-draft-m4-park-entry-sync.md` §A3 마지막 화살표 라인 "→ §4 '런타임 플러그인 로딩 미구현' invariant 유지, Rationale 번복 아님"
  - 과거 결정 출처: `spec/4-nodes/0-overview.md §4` ("런타임 플러그인/마켓플레이스 로딩 경로는 존재하지 않는다 — 빌트인 정적 등록만") 및 동 `spec/4-nodes/0-overview.md` L57 ("[런타임 플러그인/마켓플레이스 로딩 경로는 여전히 부재 — §4]")
  - 상세: target 의 A3 는 `spec/5-system/4-execution-engine.md` 에 추가할 park-entry registry Rationale 항목을 기술하면서 "§4 '런타임 플러그인 로딩 미구현' invariant" 를 유지한다고 주장한다. 그러나 `spec/5-system/4-execution-engine.md §4` 는 "Worker 모델 (per-node task queue → execution-level intake 큐)" 을 다루며, "런타임 플러그인 로딩 미구현" 이라는 invariant 이름은 존재하지 않는다. 해당 invariant 는 `spec/4-nodes/0-overview.md §4` 의 노드 마켓플레이스/동적 로딩 미구현 선언이 SoT 다. park-entry registry 는 기존 빌트인 정적 디스패치를 내부 추출한 것이므로 동적 플러그인 로딩 invariant 와 관계가 없고, 언급 자체가 혼동을 야기한다. park-entry 추출이 실제로 건드리는 Rationale 은 `spec/5-system/4-execution-engine.md §Rationale "resume turn dispatch registry 추출 (#507)" — 동일 패턴 연속` 이며, "§4 런타임 플러그인 로딩 미구현" 참조는 엉뚱한 출처를 가리키는 서술이다.
  - 제안: A3 의 해당 라인에서 "§4 '런타임 플러그인 로딩 미구현' invariant 유지" 구절을 삭제하거나, 정확한 SoT(`spec/4-nodes/0-overview.md §4` 의 노드 동적 로딩 미구현)를 명시하되 park-entry registry 와의 관련성을 재검토할 것. 가장 간결한 수정안: 해당 괄호 구절을 제거하고 "behavior-preserving 리팩토링 (resume 측 #507 동일 패턴 연속, Rationale 번복 아님)" 으로만 요약.

### 발견사항 2

- **[INFO]** A2 blockquote 의 `getInteractionType` 참조 — spec 내 SoT 미선언
  - target 위치: `plan/in-progress/spec-draft-m4-park-entry-sync.md` §A2 blockquote 본문 "`buttons`/`ai` 는 런타임 cached `meta.interactionType`(`getInteractionType`)로 선택"
  - 과거 결정 출처: `spec/conventions/interaction-type-registry.md §1.2` 매트릭스 ("Backend emit 위치" 열 — 각 enum 값의 emit 로직 기술)
  - 상세: `getInteractionType` 함수는 spec 어디에도 단일 진실로 선언되지 않은 구현 세부 함수명이다. spec 에는 `WaitingInteractionType` 값 선택 로직만 기술하면 충분하며, 특정 helper 함수명을 spec note 에 직접 노출하면 구현 변경 시 spec 이 stale 해진다. resume 측 §1.2 기존 blockquote 도 함수명을 노출하지 않는다.
  - 제안: A2 blockquote 에서 "`getInteractionType`" 함수명 참조를 제거하고, "런타임 캐시된 `meta.interactionType`" 로만 서술하거나 구현 파일 참조 없이 추상 로직만 기술.

### 발견사항 3

- **[INFO]** A3 Rationale 추가 항목이 `execution-engine §Rationale "resume turn dispatch registry 추출 (#507)"` 기존 항목과의 연결을 명시하지 않음
  - target 위치: `plan/in-progress/spec-draft-m4-park-entry-sync.md` §A3 Rationale 추가 내용
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` L1372 "resume turn dispatch registry 추출 (#507, 2026-06-06)" 항목
  - 상세: 기존 Rationale 항목 L1372 는 "resume turn dispatch registry 추출" 을 단독 항목으로 기재하며, "새 blocking 노드 타입은 registry 항목 1개 등록으로 plug-in 된다" 는 확장 원칙도 이미 명시되어 있다. A3 가 추가하려는 park-entry registry 항목은 해당 기존 항목의 직접 병행 (대칭 패턴) 임을 내부 cross-link 로 연결하면 문서 연속성이 명확해진다. 현재 target 은 "위 resume 측(#507)과 대칭" 이라고만 적어 두 항목 사이의 spec 내 교차 참조가 부재하다.
  - 제안: 추가 Rationale 항목 내에 `([위 "resume turn dispatch registry 추출 (#507)"](execution-engine.md#rationale) 과 대칭)` 형식의 내부 링크를 포함해 두 항목을 양방향 참조로 연결.

---

## 요약

target 문서(`plan/in-progress/spec-draft-m4-park-entry-sync.md`)는 전반적으로 기존 Rationale 결정과 정합하며, 기각된 대안을 재도입하거나 합의된 설계 원칙을 번복하는 내용은 발견되지 않는다. M-4 park-entry registry 는 `spec/5-system/4-execution-engine.md §Rationale "resume turn dispatch registry 추출 (#507)"` 의 직접 대칭 패턴이고, behavior-invariant 특성도 명확히 기술되어 있다. 단 하나의 주목할 문제는 A3 의 "§4 런타임 플러그인 로딩 미구현 invariant" 참조인데, 이 invariant 는 실제로 `spec/4-nodes/0-overview.md §4`(노드 마켓플레이스 동적 로딩 미구현)에 속하며 `spec/5-system/4-execution-engine.md §4`(Worker 모델)에는 존재하지 않는다. 혼동 유발 가능성이 있어 WARNING 등급으로 분류했으나, park-entry registry 자체의 Rationale 연속성에는 영향이 없다. 그 외 두 건의 INFO(구현 세부 함수명 노출, 기존 Rationale 항목 cross-link 부재)는 보강 제안 수준이다.

---

## 위험도

LOW
