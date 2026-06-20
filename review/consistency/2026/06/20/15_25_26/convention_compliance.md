# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes` (구현 완료 후 검토, diff-base=origin/main)
검토 규약: `spec/conventions/**`

---

## 발견사항

### [CRITICAL] `1-logic/0-common.md §7` 동적 포트 ID 규약 위반 — UUID v4 vs. 안정 slug

- **target 위치**: `spec/4-nodes/1-logic/0-common.md` §7 "포트 ID 불변성 (동적 포트)" (라인 137–142)
- **위반 규약**: `spec/4-nodes/0-overview.md` §1.3 "포트 정의 (PortDef)" — 동적 포트 ID 규약 (라인 147–149)
- **상세**:
  - `0-overview.md §1.3`은 동적 포트 ID 를 **stable slug id** (`^[a-zA-Z0-9_-]{1,64}$`)로 정의하며, "UUID v4 는 사용하지 않는다" 고 명시적으로 금지한다. 검증·해석 단일 출처는 `nodes/core/port-id.util.ts` + `lib/node-definitions/resolve-dynamic-ports.ts` 로 규정되어 있다.
  - 반면 `1-logic/0-common.md §7`은 동일한 동적 포트 생성 규칙을 "생성 시 **UUID v4** 를 할당" 으로 기술하고 있다.
  - 두 문서가 같은 도메인 개념(동적 포트 ID)에 대해 정반대의 규칙을 선언한다. 구현·프론트엔드 동작은 `0-overview.md §1.3`(slug 기반)을 따르고 있으므로, `0-common.md §7`의 UUID v4 기술이 잘못된 stale 내용이다.
  - 이 invariant 가 채택되면 다른 시스템(`port-id.util.ts`, `resolve-dynamic-ports.ts`, Switch/Filter 포트 처리 등)이 가정하는 slug 형식 invariant 가 깨진다.
- **제안**: `1-logic/0-common.md §7` 의 동적 포트 설명을 `0-overview.md §1.3` 과 일치하도록 수정한다. "생성 시 UUID v4 를 할당" 을 "config 항목이 보유한 **stable slug id** 를 포트 ID 로 사용한다 (`^[a-zA-Z0-9_-]{1,64}$`). 형식을 벗어나면 인덱스 기반 fallback(`case_0`, `branch_1` 등). UUID v4 는 사용하지 않는다." 로 교체하고, 단일 출처(`port-id.util.ts`) 참조를 추가한다.

---

### [WARNING] `1-logic/0-common.md §9` `background` 노드 `status` 필드 기술 — 미정의 값 언급

- **target 위치**: `spec/4-nodes/1-logic/0-common.md` §9 5필드 표 `status` 행 (라인 177)
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 — `status` 필드 값 열거 (`waiting_for_input`, `resumed`, `ended`)
- **상세**:
  - `0-common.md §9` 의 `status` 설명은 "background 만 `'background_running'` 등 가능" 이라고 기술한다.
  - `node-output.md Principle 0` 은 `status` 값으로 `waiting_for_input`, `resumed`, `ended` 만 열거한다. `background_running` 은 Principle 0 의 어디에도 정의되지 않은 값이다.
  - `12-background.md §5.1` 의 실제 출력 예시에는 `status` 필드가 없으며(미설정), Background 핸들러는 `port: 'main'` 만 반환한다. `background_running` 이 실제로 발행되는 값인지 아닌지 모호하다.
  - 정의되지 않은 status 값을 규약 준수 문서에 언급하는 것은 독자 혼선을 일으킨다.
- **제안**: `0-common.md §9` 의 `status` 행을 "Logic 노드는 모두 비-블로킹이므로 일반적으로 `undefined`" 로 수정하거나, `background_running` 이 실제로 발행되는 값이라면 `node-output.md Principle 0` 의 status 값 목록에 공식 등재한 뒤 이 문서에서 인용한다.

---

### [WARNING] `0-overview.md §1.0` 의 공유 디렉토리 prefix 컨벤션 — `_` 유무 혼재 기술

- **target 위치**: `spec/4-nodes/0-overview.md` §1.0 노드 컴포넌트 구조 (라인 80)
- **위반 규약**: CLAUDE.md — 명명 컨벤션 일관성 원칙
- **상세**:
  - `0-overview.md §1.0` 은 카테고리 내부 공유 유틸/베이스 클래스 위치로 `<category>/_shared/`·`<category>/_base/`·`<category>/shared/` 를 혼용 가능한 것으로 기술하며 "디렉터리 prefix 컨벤션(`_` 유무)은 카테고리별로 혼재한다" 고 명시적으로 인정한다.
  - spec 이 규약을 정의하는 문서로서 "혼재" 를 기술하고 규칙을 확정하지 않는 것은 규약의 단일 진실(SoT) 역할을 이행하지 못한다. 이로 인해 신규 카테고리 추가 시 개발자가 어떤 패턴을 따를지 불분명하다.
  - 이는 conventions 위반이라기보다 규약이 미확정 상태를 문서화한 것이지만, spec 문서로서는 권장 기본값(예: `_shared/` 우선)을 최소한 명시해야 한다.
- **제안**: `0-overview.md §1.0` 에 권장 기본 패턴을 추가한다(예: "신규 카테고리는 `<category>/_shared/` 를 기본 위치로 사용한다"). 또는 `spec/conventions/` 에 디렉토리 명명 규약 항목을 신설하고 이 문서에서 참조한다.

---

### [INFO] `1-logic/0-common.md §9` 의 Principle 9 인용 방식 — 비일관 인라인 기술

- **target 위치**: `spec/4-nodes/1-logic/0-common.md` §9.1 (라인 179–195)
- **위반 규약**: `spec/conventions/node-output.md` Principle 9 출처 인용 형식
- **상세**:
  - `0-common.md §9.1` 은 컨테이너 노드 핸들러↔엔진 오버라이트 컨트랙트를 상당히 상세하게 재서술한다. 이 내용은 `node-output.md Principle 9` 이 이미 정의한 규약의 인라인 재복사에 해당한다.
  - `0-overview.md §4.3` 은 "상세 계약은 [실행 엔진 §5. 노드 핸들러 계약]으로 참조" 라고 위임하는 방식을 취하는 반면, `0-common.md §9.1` 은 위임 없이 전체를 재서술한다. 단일 진실 원칙상 conventions 의 Principle 9 가 SoT 이고 `0-common.md` 는 Logic 카테고리 특이 사용 패턴만 기술해야 한다.
  - 재복사로 인해 추후 Principle 9 변경 시 `0-common.md §9.1` 이 stale 될 위험이 있다.
- **제안**: `0-common.md §9.1` 을 Logic 카테고리 특이 항목(핸들러 반환 형태의 노드별 차이)만 남기고, 공통 컨트랙트는 `node-output.md Principle 9` 로 위임 인용하도록 축약한다.

---

### [INFO] `cafe24-api-catalog/application.md` 의 `_overview.md` 파일 — `_product-overview.md` 패턴과의 차이

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` 파일 이름
- **위반 규약**: CLAUDE.md "정보 저장 위치" — `_product-overview.md` 명명 컨벤션
- **상세**:
  - CLAUDE.md 는 영역 폴더의 제품 정의·요구사항 진입 문서를 `_product-overview.md` 로 명명하도록 규정한다.
  - `cafe24-api-catalog/_overview.md` 는 `_product-overview` 대신 `_overview` 를 사용한다. 이 파일은 카탈로그 인덱스·규약 문서로 제품 PRD 성격이 아니므로, 명명이 달라도 CLAUDE.md 의 `_product-overview.md` 규약과 직접 충돌하지는 않는다.
  - 그러나 `_` prefix 사용 + 진입 역할을 가진 파일임을 감안할 때, 검토 시점 혼동 여지를 최소화하려면 CLAUDE.md 의 어느 카테고리에 속하는지 명확히 해두는 것이 좋다.
- **제안**: 본 파일은 카탈로그 메타(conventions) 문서로서 `_product-overview.md` 패턴 적용 대상이 아님을 파일 도입부에 명시 주석으로 남기거나, `spec/conventions/spec-impl-evidence.md §1` 의 lifecycle frontmatter 예외 목록에 이미 등재되어 있으므로 현 상태 유지도 무방하다. 변경 불요 (정보 제공 목적).

---

## 요약

`spec/4-nodes` 영역의 정식 규약 준수 관점에서 가장 심각한 발견은 `1-logic/0-common.md §7` 과 `0-overview.md §1.3` 사이의 **동적 포트 ID 규약 직접 충돌**(CRITICAL)이다. 두 문서가 동일한 동적 포트 ID 생성 방식에 대해 각각 UUID v4 와 stable slug 로 상반된 내용을 선언하고 있으며, 구현은 slug 기반이므로 `0-common.md §7`이 stale/잘못된 정보다. 이를 즉시 수정해야 다른 시스템이 가정하는 port-id invariant 가 유지된다. 추가로 `status: 'background_running'`의 미정의 값 언급(WARNING) 과 카테고리 내부 디렉토리 prefix 미확정(WARNING) 이 규약의 단일 진실 역할을 약화시킨다. 나머지 발견은 인라인 재복사로 인한 stale 위험(INFO)과 명명 패턴 정합성(INFO)에 관한 것으로 차단 사항은 아니다.

---

## 위험도

**HIGH**

(CRITICAL 1건 — 동적 포트 ID 규약 직접 충돌, 구현 인터페이스 invariant 영향)
