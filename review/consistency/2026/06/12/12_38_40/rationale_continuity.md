# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-code-node-followups.md`
참조 spec: `spec/4-nodes/5-data/2-code.md`

---

## 발견사항

### [INFO] 변경 1 — isolate 풀 재사용 기각 근거가 기존 Rationale 와 완전 정합

- **target 위치**: 변경 1 (1-c) `### dayjs per-exec 재컴파일 → 힙 스냅샷` 기각 항목 (a)
- **과거 결정 출처**: `spec/4-nodes/5-data/2-code.md` `## Rationale` — "격리 방식 `isolated-vm` 전환" 절: "per-exec isolate 생성·메모리 하드 리밋·dispose·실행 간 상태 비공유" 를 핵심 보안 불변으로 명시
- **상세**: target 의 기각 항목 (a) "isolate 풀 재사용 — per-exec dispose(메모리 격리) 불변 위반" 은 기존 Rationale 가 세운 격리 불변(per-exec dispose, 실행 간 상태 비공유)을 올바르게 인용·재확인하고 있다. 충돌 없음.
- **제안**: 현행 유지 가능. 다만 기각 근거를 명시할 때 기존 Rationale 의 "격리 불변" 절 내부 참조(`§Rationale — 격리 방식 isolated-vm 전환`)를 명시적 cross-ref 로 달면 연속성 추적이 더 명확해진다.

### [INFO] 변경 1 — BOOTSTRAP 까지 스냅샷 기각 근거 기술 방식 확인

- **target 위치**: 변경 1 (1-c) 기각 항목 (b) "BOOTSTRAP 까지 스냅샷 — host 콜백/§7.3 삭제가 per-exec 상태·바인딩 의존이라 불가"
- **과거 결정 출처**: `spec/4-nodes/5-data/2-code.md` `## Rationale` — "격리 방식 isolated-vm 전환" 의 `$helpers`·`console` 브리지 정책: "host 클로저를 `Reference`/`ivm.Callback` 으로 브리지하므로 host realm 에서 실행"
- **상세**: 기각 항목 (b) 는 기존 Rationale 에 기록된 "host 콜백은 per-exec 바인딩" 원칙과 정합하여 스냅샷 범위를 "순수 JS(dayjs)만" 으로 한정한 결정을 올바르게 설명한다. 충돌 없음.
- **제안**: 현행 유지 가능.

### [INFO] 변경 3 — 128MB 하드코딩을 환경변수화하는 결정의 Rationale 신규 작성 확인

- **target 위치**: 변경 3 (3-c) `### 메모리 한도 환경변수화 (2026-06-12)`
- **과거 결정 출처**: `spec/4-nodes/5-data/2-code.md` `## Rationale` — "격리 방식 isolated-vm 전환": "isolate 단위 메모리 하드 리밋(128MB, `CODE_MEMORY_LIMIT`)" 이 보안 불변의 일부로 기술됨
- **상세**: 기존 Rationale 는 128MB 를 보안 목적의 하드 리밋으로 확립했다. target 은 이를 환경변수화하면서 (a) 기본값 128MB 불변, (b) 안전 상한 512MB clamp, (c) "무제한 env 기각" 을 새 Rationale 에 명시해 기존 보안 원칙("단일 노드가 호스트 메모리를 과점하지 못하게") 을 유지한다. 명시적 번복이 아니라 운영 튜닝 허용을 보안 상한으로 제한하는 확장이므로 원칙 위반이 아니다. 그러나 기존 Rationale 의 128MB 언급이 "하드코딩 근거" 를 명시하지 않아(보안 상한으로서의 근거보다 구현 예시에 가깝게 기술), 환경변수화가 해당 결정의 번복인지 확장인지 모호한 여지가 있다.
- **제안**: 3-c Rationale 에 "기존 §Rationale isolated-vm 전환 절이 128MB 를 보안 불변으로 확립했으나, 해당 결정의 의도는 **상한을 정함으로써 호스트 OOM 을 막는 것** 이었으므로 clamp 를 둔 env 조정은 그 원칙의 확장이다" 라는 명시적 연결 문장을 한 줄 추가하면 연속성이 완전해진다.

### [INFO] 변경 2 — base64 silent 강제변환 폐기와 기존 Rationale 의 `$helpers` 표면 언급 관계

- **target 위치**: 변경 2 (2-b) `### $helpers 입력 타입 계약 — base64 비문자열 TypeError 정렬`
- **과거 결정 출처**: `spec/4-nodes/5-data/2-code.md` `## Rationale` 에는 base64 의 silent `String()` 강제변환에 관한 별도 Rationale 항이 없음
- **상세**: 기존 Rationale 에 base64 의 입력 타입 정책을 명시한 항목이 없으므로, target 이 새 행동을 도입하면서 "기각된 대안의 재도입" 이나 "합의 원칙 위반" 에 해당하지 않는다. silent 강제변환은 기존 spec 에서 의도된 결정으로 기술된 적 없이 구현상 존재한 상태였으며, target 의 2-b Rationale 는 그 비대칭을 명시하고 TypeError 정렬의 근거와 하위호환 영향을 설명한다. 대안("현행 silent 유지") 기각도 명시되어 있다. 절차 상 문제 없음.
- **제안**: 현행 유지 가능.

---

## 요약

Rationale 연속성 관점에서 target 문서(`spec-draft-code-node-followups.md`)는 기존 `spec/4-nodes/5-data/2-code.md ## Rationale` 에서 확립한 핵심 원칙(isolated-vm per-exec isolate·dispose 불변, 격리 경계 보안, 호스트 OOM 방지 상한)을 모두 계승하고 있다. 세 변경 모두 기각된 대안을 재도입하거나 합의 원칙을 우회하지 않으며, 각각 신규 Rationale 절을 함께 제시하여 번복 근거 부재 문제도 없다. 단, 변경 3(메모리 환경변수화)에서 기존 128MB 확립 결정과의 명시적 연결이 미약해 "하드코딩 번복인지 상한 유지 확장인지" 에 대한 연속성 문장 한 줄 보강을 권장한다. 전반적으로 위험 수준은 낮다.

---

## 위험도

LOW
