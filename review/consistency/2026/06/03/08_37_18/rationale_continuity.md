# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-spec-drift-resolve.md`
검토 일시: 2026-06-03
검토 모드: spec draft (--spec)

---

## 발견사항

### 발견사항 없음 — 전 항목 Rationale 연속성 충족

두 변경 모두 새 Rationale 를 작성하며 과거 결정을 명시적으로 번복·해소하고 있고, 기각된 대안도 각 Rationale 항에 함께 기록되었다. 구체 확인 결과:

#### 변경 1 — Parallel `count` 복원 (결정 B)

- **과거 결정의 위치**: `spec/4-nodes/1-logic/10-parallel.md` §5.2 의 "`count` 필드는 제거됨 (P1.1 직교성 — `branches.length` 가 SSOT)" 노트. 이 노트가 **drift** 였음을 target 이 명확히 서술하고 있다.
- **Rationale 연속성**: 워크트리 버전의 `## Rationale` 에 `"done 출력의 count 필드 — 컨테이너 공통 규약 정합 (2026-06-03 spec-drift 결정 B)"` 항목이 신설되어, 과거 노트가 spec drift 였다는 사실과 두 대안(A: Parallel 만 예외, B: count 복원)의 비교·기각 근거가 모두 기록되었다.
- **합의된 원칙과의 정합**: `spec/conventions/node-output.md` Principle 9.2 및 `spec/4-nodes/1-logic/0-common.md` §5·§9.1·§11 은 변경 없이 이미 `{ branches, count }` 를 명시하고 있었고, 변경 B 는 이들과 일치하는 방향이다. Principle 1.1 직교성 원칙은 `count = branches.length` 중복을 지적하지만, 공통 규약의 컨테이너 균일성 우선 결정이 Rationale 에 명시되어 있어 원칙 충돌이 Rationale 로 정당화된다.
- **암묵적 invariant**: `0-common.md §11 / 테이블 §9.1` 은 `parallel → { branches, count }` 를 명시하며 오버라이트 컨트랙트에도 이미 `count` 가 있었다. 이를 다시 제거하는 방향이 아니라 복원하는 방향이므로 invariant 위반 없음.

#### 변경 2 — WS §4.4 `buttonConfig` 예시 정정 (C2=타임아웃 제거, C3=nodeOutput 판별자 폐지)

- **과거 결정의 위치**: WS 프로토콜 spec §4.4 예시의 `timeout: 300` / `timeoutAction: "cancel"` 및 `nodeOutput: { "type": "carousel", ... }` 판별자 래퍼.
- **Rationale 연속성**: 워크트리 버전의 `## Rationale` 에 `"§4.4 buttonConfig 예시 정정 — 타임아웃 제거 + nodeOutput 판별자 폐지 (2026-06-03 spec-drift 결정 C2·C3)"` 항목이 신설되어, 두 변경이 모두 다른 SoT 와의 정합 정정임을 기술하고 기각된 대안도 각각 명시되었다.
- **C2 합의 원칙 정합**: `spec/4-nodes/6-presentation/0-common.md §3·§6.1` 의 "버튼 클릭까지 무제한 대기" 원칙이 SoT 이며, 타임아웃 제거는 이 원칙과 일치한다. 예시가 stale 이었음을 Rationale 가 서술하고 있어 결정 번복이 아니라 표현 정정이다.
- **C3 합의 원칙 정합**: `spec/4-nodes/6-presentation/0-common.md §4 Principle 1.1.4` (`type` 판별자 래퍼 금지) 가 합의된 원칙이며, 변경 C3 는 이 원칙을 준수하는 방향이다. 기각된 대안(`nodeOutput 전용 별도 스키마 신설`)도 Rationale 에 기록되었다.
- **암묵적 invariant**: `NodeHandlerOutput` 5필드 invariant (`{config, output, meta?, port?, status}`) 를 유지하며 예시를 일치시키는 변경이므로 invariant 우회 없음.

---

## 요약

두 변경 모두 신규 정책 도입이 아니라 기존 SoT(공통 규약·Principle·엔진 코드)와 어긋난 spec 예시·노트를 정정한 drift 해소다. 변경 1(Parallel count 복원)과 변경 2(WS buttonConfig 예시 정정) 각각에 대해 워크트리의 `## Rationale` 에 과거 drift 경위·채택 결정 근거·기각 대안이 모두 명문화되어 있다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, 암묵적 invariant 우회 사례는 발견되지 않는다. Rationale 연속성 관점에서 이 draft 는 충분한 문서화를 갖추고 있으며 past decision 과의 충돌이 없다.

---

## 위험도

NONE
