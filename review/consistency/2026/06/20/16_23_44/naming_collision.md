# 신규 식별자 충돌 검토 — spec-draft-port-id-uuid-slug

## 발견사항

### [WARNING] target 변경 #4 의 "user-set slug id" 표현이 ButtonDef.id 의 기존 정의와 의미 충돌

- **target 신규 식별자**: `user-set slug id` — `4-nodes/6-presentation/1-carousel.md` line 429 에 제안하는 표현. 미입력 시 "자동 slug" 라는 표기도 동반.
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/0-common.md` line 32: `id | String (UUID v4) | 자동 생성 | 불변 버튼 식별자. port 타입일 경우 동적 출력 포트 ID로 사용`
  - 동 파일 line 319: `button.id UUID v4 backfill` — 워크플로 에디터 UI 가 `crypto.randomUUID()` 로 id 를 생성, LLM render-tool 경로에서 누락 id 를 UUID v4 로 backfill 하도록 명시.
  - 동 파일 line 447, 451, 458: "id: UUID v4 자동 생성, 불변" 원칙 반복 명시.
  - `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/1-carousel.md` line 429 현행: "버튼 추가 시 UUID v4 자동 할당 (ID 불변)"
- **상세**: target 변경 #4 는 carousel:429 를 "버튼 추가 시 **user-set slug id** 부여(미입력 시 자동 slug, `^[a-zA-Z0-9_-]{1,64}$`), ID 불변" 으로 교체하겠다고 제안한다. 그러나 ButtonDef.id 의 SoT 인 `6-presentation/0-common.md §1` 은 `String (UUID v4)` 로 타입을 명시하고, §10.5 step 3 에서 UUID v4 backfill 로직을 확정하고 있다. ButtonDef.id 는 포트 ID 가 아니라 button 식별자(워크플로 에디터 UI 의 `crypto.randomUUID()` 생성)이며, 캐러셀 line 429 는 UI 에서 버튼을 추가할 때 id 가 자동 배정된다는 문맥이지, SoT `0-overview.md §1.3` 이 정의하는 "dynamic port ID = stable slug" 와 같은 메커니즘이 아니다.
  - target 의 "제외" 섹션은 "Presentation **ButtonDef.id** — 이미 user-set slug(`{"id":"approve"}`); UUID 가 아님" 이라고 서술하며 carousel:429 의 UUID 기술만 stale 이라고 본다. 그러나 `0-common.md` 는 ButtonDef.id 를 `UUID v4` 로 명시 정의하며 backfill 로직 전반이 이 정의를 근거로 설계돼 있다. 워크플로 에디터가 `{"id":"approve"}` 처럼 사용자가 slug 를 명시하면 그 값이 쓰이지만, 미지정 시 UUID v4 가 `crypto.randomUUID()` 로 배정되는 것이 현행 spec 의 의도다. "자동 slug" 라는 신규 용어는 현재 spec 어디에도 정의되지 않는다.
- **제안**: target 변경 #4 의 carousel:429 수정은 `4-nodes/6-presentation/0-common.md §1` ButtonDef.id 정의(UUID v4 자동 생성) 및 §10.5 step 3 backfill 명세와 공개적으로 모순된다. 수정 전에 ① `0-common.md §1` 의 `String (UUID v4)` 정의와 §10.5 backfillButtonUuids 로직을 동시에 교체하는지 결정하거나, ② carousel:429 의 변경 범위를 "UUID v4 자동 할당" 표현의 삭제 또는 `0-common.md §1` 로의 cross-reference 로 제한해야 한다. ButtonDef.id 전체를 slug 로 전환하는 것은 본 target 범위(포트 ID drift 4건 정정)를 벗어난 설계 변경이며, 현재 target 의 "제외" 절이 그 변경을 제외로 분류한 것과 상충한다.

---

### [INFO] target 이 도입하는 신규 용어 "stable slug id" 는 0-overview.md §1.3 SoT 에 이미 존재하나, 다른 3개 정정 대상 문서와 통합 후 용어 일관성 점검 권장

- **target 신규 식별자**: `stable slug id` (변경안 #1, #2, #3 에서 사용)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/0-overview.md` line 121: "동적 포트: config 항목이 보유한 **stable slug id**" 로 이미 사용.
  - `/Volumes/project/private/clemvion/spec/4-nodes/1-logic/2-switch.md` line 86: slug 검증 패턴 언급.
- **상세**: 용어 자체는 SoT 에 이미 확립되어 있으므로 충돌이 아니다. 단, 변경안 #2 (`3-workflow-editor/1-node-common.md`) 에서 같은 용어가 "워크플로 에디터" 영역에도 동기화될 경우, 두 영역(`3-workflow-editor/` vs `4-nodes/`) 이 동일 개념을 기술하는지 독자가 이중으로 확인해야 하는 구조가 생긴다. 변경 후 해당 행에 `(SoT: 노드 §1.3 / port-id.util.ts)` 크로스레퍼런스가 명시되므로 큰 혼동은 없을 것이다.
- **제안**: INFO 수준. 변경안 #1~#3 은 SoT 의 기존 용어를 전파하는 것으로 충돌이 없다. 진행 가능.

---

### [INFO] `4-nodes/0-overview.md` 에 `## Rationale` 섹션 신설은 기존 파일 내 섹션명 충돌 없음

- **target 신규 식별자**: `## Rationale` 섹션 (0-overview.md 신설)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/4-nodes/0-overview.md` 전체 302줄 검색 결과 `## Rationale` 섹션이 현재 부재함을 확인.
- **상세**: `spec/0-overview.md` 등 다른 cross-cutting 문서들이 이미 `## Rationale` 섹션을 사용하는 컨벤션(`spec/0-overview.md` Rationale 섹션 다수 존재)과 일치하며, 같은 파일 내 중복 섹션도 없다.
- **제안**: 충돌 없음. 진행 가능.

---

### [INFO] 변경 #1 과 #3 이 각각 다른 문서에서 "ND-AG-20" 요구사항 ID 를 다르게 기술하는 현상 — 요구사항 ID 충돌 없으나 단일 ID 두 문서 동기화 주의

- **target 신규 식별자**: ND-AG-20 의 본문을 변경 #3(`4-nodes/3-ai/_product-overview.md` line 80) 에서 교체.
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/_product-overview.md` line 80: `ND-AG-20 | 조건 동적 추가/제거 — 포트 ID는 생성 시 UUID v4로 할당되어 불변 유지된다`
  - `/Volumes/project/private/clemvion/spec/4-nodes/_product-overview.md` line 211: `ND-AG-20 | 조건의 동적 추가/삭제, 포트 ID 불변 유지` (간략 버전, UUID 언급 없음)
- **상세**: target 은 `3-ai/_product-overview.md` 의 ND-AG-20 만 수정한다. 같은 ID 가 `4-nodes/_product-overview.md` 에도 요약 형태로 존재한다. target 이 수정하는 문서의 ND-AG-20 을 교체한 후, `_product-overview.md` 의 간략 요약 행은 UUID 언급이 없으므로 직접 모순은 생기지 않는다. ID 충돌(같은 ID 가 다른 의미로 등재되는 사태)은 없다.
- **제안**: INFO 수준. `_product-overview.md` 의 요약 행은 UUID 언급이 없으므로 별도 수정 불요. 단, 두 문서가 같은 ID 를 다른 상세도로 기술하므로 추후 ND-AG-20 검색 시 두 위치를 함께 확인해야 한다.

---

## 요약

target 이 도입하는 신규 식별자 중 실질적 충돌은 변경 #4(`carousel:429`)의 "user-set slug id / 자동 slug" 표현 하나다. 이 표현은 `6-presentation/0-common.md §1` 의 `ButtonDef.id = String (UUID v4), 자동 생성` 정의 및 §10.5 backfillButtonUuids 로직과 정면 충돌한다. ButtonDef.id 를 slug 로 전환하는 것은 본 target 의 명시적 제외 사항("Presentation ButtonDef.id — 이미 user-set slug; UUID 아님") 임에도 carousel line 429 에서 그 전환을 암시하는 신규 표현을 도입하므로, 수정 범위를 명확히 해야 한다. 나머지 변경(#1·#2·#3, `## Rationale` 신설)은 기존 식별자와 충돌이 없다.

## 위험도

MEDIUM
