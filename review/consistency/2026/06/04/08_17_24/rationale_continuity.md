# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/spec-impl-evidence.md`
검토 모드: 구현 완료 후 검토 (--impl-done, diff-base=origin/main)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `§4 가드 수 4→5 번복` — 새 Rationale 항목 없음
  - target 위치: `spec/conventions/spec-impl-evidence.md §4` 제목("Build-time 가드 — frontmatter-evidence 5건") 및 Overview 문단
  - 과거 결정 출처: 동일 spec 문서의 구 §4 ("Build-time 가드 (4건)") 및 §6 Rollout 항목 3번 ("4개 가드 테스트 동반 작성")
  - 상세: 기존 spec §4는 "4개 build-time 가드" 라는 수를 명시하고, §6 Rollout 절에도 "4개 가드" 로 동일 수를 못박았다. target에서는 §4 표에 `spec-plan-completion.test.ts (Gate C)` 를 5번째 행으로 추가하고 표 제목을 "5건"으로 바꿨다. §6 Rollout 에도 "초기 4건 → 현재 §4 5건"이라는 주석이 붙었다. 그러나 `## Rationale` 절(R-1~R-7)에 Gate C를 선택한 이유, 4→5 결정 번복 근거, 기각된 대안을 설명하는 새 항목이 추가되지 않았다. Gate C 설계 결정(grandfathering cutoff=2026-06-04, `none`/`없음` sentinel, 빈 배열 거부 등)은 구현 코드(`spec-plan-completion.test.ts`)에만 존재하고 spec Rationale에는 기록이 없다.
  - 제안: `## Rationale` 에 `### R-8. Gate C — plan 완료 시점 spec_impact 선언 의무화` 항목을 추가하여 (a) 4→5 확장 배경, (b) grandfathering cutoff 선정 이유, (c) `none`/`없음` sentinel 채택 vs 빈 문자열 기각, (d) 완료 plan 범위(top-level만 vs 서브폴더 포함) 결정을 명시해야 한다.

---

### 발견사항 2

- **[WARNING]** `§4.0 지식저장소 무결성 가드` 신설 — 기존 "4건" 컨벤션 외부에 별도 family 도입, Rationale 부재
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.0` ("지식저장소 무결성 가드 (§4 5건과 별개, 본 문서가 SoT)")
  - 과거 결정 출처: 구 spec §4 ("Build-time 가드 (4건)") — 가드는 4건으로 닫힌 집합이었으며 별도 family 개념이 없었다. 구 Overview도 "4개 build-time 가드로 정합성을 강제"라고 단일 family로 기술했다.
  - 상세: target은 §4.0 절을 신설하고 `spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `plan-frontmatter.test.ts` (build 차단 3건) + Gate D (advisory 1건)을 "frontmatter-evidence 가드와 별개 family"로 분리하면서 이 문서를 SoT로 선언했다. 이는 기존 spec이 암묵적으로 가정한 "spec-impl-evidence.md = frontmatter evidence 전담"이라는 단일 책임 범위를 넘어 링크 무결성·area index·plan frontmatter까지 SoT 범위로 확장한 것이다. 이 새 family의 도입 근거, 기각된 대안(별도 spec 문서 분리, plan-lifecycle.md에 통합 등), 이 문서를 단일 SoT로 택한 이유가 Rationale에 없다.
  - 제안: `## Rationale` 에 `### R-9. §4.0 지식저장소 무결성 가드 — 별도 family 신설 근거` 항목을 추가하여 (a) 왜 별도 spec 문서가 아닌 본 문서를 SoT로 택했는지, (b) spec-link-integrity / spec-area-index / plan-frontmatter를 묶은 "지식저장소 무결성" 카테고리 설정 근거, (c) Gate D advisory 채택 이유(NLP 휴리스틱 → 비차단)를 명시해야 한다.

---

### 발견사항 3

- **[INFO]** `§6 Rollout 변경` — 이력 주석 방식 채택, 대안 문서화 없음
  - target 위치: `spec/conventions/spec-impl-evidence.md §6 Rollout 정책` 항목 3번
  - 과거 결정 출처: 구 spec §6 항목 3 ("4개 가드 테스트 동반 작성")
  - 상세: target은 구 §6 항목 3을 "frontmatter-evidence 가드 테스트 동반 작성 (초기 4건 → 현재 §4 5건; §4.0 지식저장소 무결성 가드 3건은 후속 kb-quality 에서 확장)" 으로 수정하여 이력 흔적을 인라인 주석으로 남겼다. 이 방식 자체는 충돌이 아니나, 컨벤션 spec에서 이력 주석을 Rollout 절에 인라인으로 두는 패턴이 다른 spec들과 일관적이지 않다(다른 spec은 Rationale에 이력을 기술하고 본문은 최신 상태만 기술하는 "latest-only 사실 기술" 원칙을 따름 — `spec/0-overview.md` Rationale 첫 문단 참조).
  - 제안: §6 항목 3의 인라인 주석은 제거하고, 4→5 확장 이력을 R-8(위 발견사항 1 제안)에 통합하는 것이 spec 본문 latest-only 원칙과 더 정합적이다.

---

### 발견사항 4

- **[INFO]** `plan-frontmatter.test.ts` — plan-lifecycle.md SoT 중복 참조 경계 불명확
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.0 표` (`plan-frontmatter.test.ts` 행 비고 `[plan-lifecycle §4]`)
  - 과거 결정 출처: 해당 없음 (신규 가드). 단, `spec/conventions/spec-impl-evidence.md §1` 적용 대상은 `spec/**` 이고, plan lifecycle은 `.claude/docs/plan-lifecycle.md`를 SoT로 별도 정의해왔다.
  - 상세: `plan-frontmatter.test.ts`는 `plan/in-progress/*.md`의 frontmatter를 검증하는 가드인데, 이를 spec-impl-evidence.md §4.0이 SoT로 흡수했다. plan frontmatter 규약의 SoT는 `.claude/docs/plan-lifecycle.md §4`이고, spec-impl-evidence는 spec/conventions 하위 문서다. 두 문서가 같은 가드를 각자 SoT로 선언하는 경우 drift 위험이 있다. 현재는 `§4.0 표` 가 `plan-lifecycle §4` 를 참조로 표기해 충돌은 아니지만, 가드 명세 변경 시 어느 문서를 먼저 수정해야 하는지 불명확하다.
  - 제안: `§4.0` 비고에 "가드 규약 SoT = `.claude/docs/plan-lifecycle.md §4`, 본 절은 가드 파일 등재 위치만 선언"이라는 구분을 명시하거나, plan-lifecycle.md에 역방향 링크를 추가해 단일 진실 출처를 명확히 한다.

---

## 요약

`spec/conventions/spec-impl-evidence.md`의 target 버전은 기존 "4개 build-time 가드" 컨벤션을 frontmatter-evidence 5건(Gate C 추가)과 지식저장소 무결성 가드 별도 family(3건+Gate D)로 확장했다. 이 확장은 기존 결정을 실질적으로 번복하는 규모이나, `## Rationale` 절(R-1~R-7)에는 Gate C 채택 근거, 4→5 확장 결정, §4.0 별도 family 신설 이유를 설명하는 새 항목이 추가되지 않았다. 기각된 대안(별도 spec 문서 분리 등)도 기록이 없어 Rationale 연속성 관점에서 두 개의 WARNING 수준 미비가 발생했다. 구현 코드(test 파일) 자체는 기존 Rationale에서 명시적으로 거부된 접근 방식을 재도입하는 사례는 없으며, 설계 원칙(글로브 허용·TTL 90일·역방향 plan 링크 등)도 위반하지 않는다. 필요한 조치는 기존 Rationale과 충돌 해소가 아니라 새 결정에 대한 Rationale 항목 추가다.

## 위험도

MEDIUM
