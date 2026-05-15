# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-draft-cafe24-private-followup.md`
대상 파일: `spec/2-navigation/4-integration.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** 변경 2 의 "N ≤ 2 상한" 구조적 보장 근거가 cross-spec 과 부분 불일치
  - target 위치: plan 문서 "변경 2 — N ≤ 2 상한의 구조적 보장 근거" 항 ("한 workspace 의 1 + 다른 workspace 의 1 = 최대 2, 같은 workspace 안에선 1 보장")
  - 충돌 대상: `spec/1-data-model.md §3 인덱스` — "V046: `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL UNIQUE`"
  - 상세: V046 부분 UNIQUE 는 `(workspace_id, mall_id)` 복합 키 기준으로, **하나의 workspace 안에서** 같은 mall_id 를 가진 cafe24 통합을 최대 1행으로 제한한다. 그러나 회복 분기의 스캔 쿼리(line 1009: "같은 mall_id 의 cafe24 row 들 조회")는 workspace 를 가로질러 mall_id 만으로 조회하므로 서로 다른 workspace 가 같은 Cafe24 mall 에 연결한 경우 N 은 workspace 수만큼 커질 수 있다. plan 이 "보통 1~2건" 이라 표현한 것은 실무적 추정으로 수용 가능하지만, "N ≤ 2 상한의 구조적 보장"이라고 spec 에 명시하면 data-model 의 UNIQUE 제약이 실제로 보장하지 않는 상한을 보장하는 것처럼 읽힌다.
  - 제안: Rationale 보강 문구를 "같은 workspace 안에서는 V046 partial UNIQUE 로 최대 1행이 보장되므로, 회복 분기 스캔의 현실적 결과는 1~2건(workspace 수 × 1)" 으로 수정하거나, "상한" 표현 대신 "실무적으로 소수" 로 완화한다. data-model spec 을 함께 갱신할 필요는 없다.

### 발견사항 2

- **[INFO]** 변경 1 의 toast.info / inline alert UI 결정이 §3.4 공통 UI 패턴 및 §0-overview §3.4 와 명시적으로 정합되어야 한다
  - target 위치: plan 문서 "변경 1 — 분기 ② UI" (inline alert amber 톤, 즉시 toast.info, onMutate reset, refetch 미실행)
  - 충돌 대상: `spec/0-overview.md §3.4 상태 표시 패턴` — "Toast: 성공/실패/정보 알림"
  - 상세: 현행 `spec/0-overview.md §3.4` 는 Toast 를 성공/실패/정보 알림으로 정의하고, Badge/Skeleton 도 규정하지만 "inline alert (amber 톤 영구 표시)" 패턴은 별도로 명시하지 않는다. 이번 변경에서 도입하는 amber inline alert 는 새 UI 패턴이다. 충돌은 아니지만, 다른 화면 spec 개발자가 같은 패턴을 "신규" 로 발명하는 것을 막으려면 §3.4 또는 conventions 에 inline alert 패턴을 추가하는 것이 권장된다.
  - 제안: 본 변경 자체는 `spec/2-navigation/4-integration.md §4.4` 국소 변경으로 채택해도 무방하다. 단, 후속 plan 으로 `spec/0-overview.md §3.4` 에 "Inline Alert: 사용자가 진행 중인 외부 작업 동안 계속 참조해야 하는 안내 — amber 톤 고정 표시" 패턴을 추가하면 전체 제품의 패턴 일관성이 높아진다. 이번 spec 반영을 차단하는 사유는 아님.

### 발견사항 3

- **[INFO]** 변경 3 — flat 경로 참조 교정은 다른 spec 파일의 동일 flat 경로 참조가 있는지 전수 확인 권장
  - target 위치: plan 문서 "변경 3 — line 903 경로 교체"
  - 충돌 대상: 해당 없음 (다른 spec 에서 동일 flat 경로를 참조하는 곳을 grep 으로 확인한 결과 `spec/2-navigation/4-integration.md line 903` 이 유일)
  - 상세: `review/consistency/2026-05-14_18-23-55` flat 경로를 참조하는 spec 파일은 `spec/2-navigation/4-integration.md` 한 곳으로 확인됐다. nested ISO 경로 `review/consistency/2026/05/14/18_23_55` 의 실제 디렉토리도 존재함을 확인. 교정 자체는 단순한 경로 동기화로 cross-spec 충돌 없음.
  - 제안: 교정 시 다른 spec 파일에서도 flat 경로(`2026-MM-DD_HH-mm-ss` 패턴) 참조가 남아있으면 함께 갱신하는 것이 권장된다. 이번 변경 범위(`4-integration.md` 단독)는 문제없다.

---

## 요약

이번 draft 의 3가지 변경은 모두 `spec/2-navigation/4-integration.md` 내부 정합성 보강과 Rationale 보충을 목적으로 한다. 데이터 모델(`spec/1-data-model.md`), API 계약(§9.2), 상태 전이(§6), callback flow(§10)는 변경되지 않으며 다른 spec 파일과의 직접 충돌은 없다. 다만 변경 2 에서 제안하는 "N ≤ 2 상한의 구조적 보장" 문구가 V046 partial UNIQUE 의 실제 범위(workspace-scoped)와 회복 분기 스캔의 실제 범위(workspace-cross) 사이의 미묘한 불일치를 내포하고 있어, 해당 표현을 정확히 다듬을 필요가 있다. CRITICAL 등급 충돌은 없으며, 상기 WARNING 을 보완하면 바로 spec 반영이 가능하다.

---

## 위험도

LOW
