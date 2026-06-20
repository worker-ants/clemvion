# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/4-nodes`, diff-base=`origin/main`

---

## 발견사항

### [INFO] DI 등록 메커니즘 변경에 대한 Rationale 섹션 부재
- **target 위치**: `spec/4-nodes/0-overview.md` §1.0 (부팅 등록 단락 및 §4 구현 상태 note)
- **과거 결정 출처**: 해당 없음 (기존 spec 에 등록 메커니즘에 대한 `## Rationale` 절이 존재하지 않음)
- **상세**: diff(origin/main → impl) 에서 두 가지 실질 변경이 이루어졌다. (1) 부팅 단락이 `bootstrap(ALL_NODE_COMPONENTS, …)` 직접 호출에서 `NODE_COMPONENT` DI 토큰 + `NodeComponentsModule` 경유 등록으로 변경됐다. (2) §4 구현 상태 note 가 "정적 배열 → DI 토큰 카탈로그"로 교체됐다. 두 변경 모두 behavior-preserving 리팩터(등록 집합·동작 불변)이며, plan 파일(`refactor-m5-node-di-layer1.md`)에는 "런타임 플러그인/마켓플레이스 로딩 미구현 invariant 유지, Rationale 번복 아님"이 명시되어 있다. 그러나 spec 본문에 DI 전환 이유("노드 추가가 중앙 파일을 건드리지 않게 하고 향후 동적 등록 seam을 연다")는 본문 괄호 주석으로 삽입됐을 뿐, `## Rationale` 절이 없는 doc 에서 공식 결정 근거로 영속화되지 않았다. 기각된 대안(NestJS multi-provider 방식 — "주입 시 배열로 조립되지 않아 채택하지 않음"이 plan 에 있으나 spec 에 없음)도 `## Rationale`로 남겨지지 않았다.
- **제안**: `spec/4-nodes/0-overview.md` 에 `## Rationale` 절을 신설하고, DI 등록 전환 결정(`useValue` 단일 배열 선택 이유, multi-provider 기각 사유, `ALL_NODE_TYPES` 정적 소비 분리 결정 D-2)을 기록한다. 단, 기존 Rationale과의 충돌이 없고 해당 문서에 과거 `## Rationale`이 아예 없어 **기각된 결정의 재도입이나 합의 위반은 발생하지 않는다**.

---

### [WARNING] `spec/4-nodes/1-logic/0-common.md §7` — UUID v4 동적 포트 ID 규칙 지속 잔재
- **target 위치**: `spec/4-nodes/1-logic/0-common.md §7 포트 ID 불변성 (동적 포트)`, 줄 140
- **과거 결정 출처**: `spec/4-nodes/0-overview.md §1.3` (target diff 내 포함) — `"(UUID v4 는 사용하지 않는다.)"` 명시. `spec/4-nodes/1-logic/2-switch.md §1.3` — `id` 필드를 `String (slug)` 으로 정의하고 slug 형식 강제를 명문화. `spec/4-nodes/6-presentation/1-carousel.md:429` — 버튼에 "UUID v4 자동 할당" 잔재 존재.
- **상세**: `0-overview.md §1.3`은 이미 slug 기반 포트 ID로 현행화("UUID v4는 사용하지 않는다") 되어 있다. 반면 `1-logic/0-common.md §7`은 여전히 "동적 포트: 생성 시 **UUID v4** 를 할당"이라고 기재한다. 이는 동일 spec 영역 내에서 `§1.3`(UUID 폐기 선언)과 `0-common.md §7`(UUID 사용 선언)이 상충하는 상태다. 본 DI 리팩터 target 범위 내에 두 문서가 모두 포함되어 있으므로 rationale 연속성 관점에서 검토 대상이다. plan `refactor-m5-node-di-layer1.md`는 C-1 을 "pre-existing drift — 범위 밖, 별도 planner 작업"으로 명시했지만, **target 문서 번들 자체에 충돌 내용이 공존**하므로 규칙(2) "합의된 원칙 위반"에 해당한다. `0-overview.md §1.3`의 "UUID v4는 사용하지 않는다" 결정이 합의 원칙이라면, `0-common.md §7`은 이를 무시하고 UUID v4를 명시하는 구 텍스트를 유지하고 있다. 새 Rationale 부재 상태에서의 원칙 위반이다.
- **제안**: `spec/4-nodes/1-logic/0-common.md §7`의 "생성 시 UUID v4 를 할당" 문구를 slug 기반 ID(`^[a-zA-Z0-9_-]{1,64}$`) + fallback(`case_0`, `branch_1`) 규칙으로 교체한다. 단, 이 수정은 planner 위임 항목으로 분류되어 있으므로 dev PR 에 포함하지 않고 별도 planner 작업으로 처리한다. 그러나 **이 충돌을 방치한 채 impl-done 검토를 통과하면 spec 내 원칙 불일치가 영속화**된다. 해소 전까지는 `0-overview.md §1.3`이 SSOT임을 `0-common.md §7`에 cross-reference 주석으로라도 명시하는 것을 권고한다.

---

## 요약

M-5 노드 DI 리팩터(`spec/4-nodes` 대상)의 Rationale 연속성은 전반적으로 양호하다. 핵심 변경인 "DI 등록 전환(정적 배열 → `NODE_COMPONENT` 토큰)"은 §4의 "런타임 플러그인/마켓플레이스 로딩 미구현" invariant를 명시적으로 보존했으며, 과거 기각된 대안을 재도입하거나 합의 원칙을 번복하지 않았다. 다만 spec 문서 자체에 `## Rationale` 절이 없어 기각된 NestJS multi-provider 방안 등 설계 결정 근거가 spec 내에 영속화되지 못한 점이 INFO 수준 보완 사항이다. 보다 주목할 점은 pre-existing drift인 `1-logic/0-common.md §7`의 UUID v4 잔재로, 이는 `0-overview.md §1.3`("UUID v4는 사용하지 않는다")과 정면 충돌하는 WARNING 수준 사안이다. 이 충돌이 현 impl-done 범위에서 수정되지 않은 채 planner 위임으로 남겨진 점은 계획상 의도된 결정이나, spec 내 불일치가 영속화되는 위험이 있어 경고로 표기한다.

---

## 위험도

LOW
