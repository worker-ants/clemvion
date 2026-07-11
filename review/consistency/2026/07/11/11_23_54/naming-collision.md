# 신규 식별자 충돌 검토 — LlmUsageLog §2.16.1 → §2.24 재번호

- target: `spec/1-data-model.md` (`LlmUsageLog` §2.16.1 → 신설 top-level §2.24로 이동), 연동 갱신 `spec/data-flow/7-llm-usage.md`
- base: `origin/main` (`1682777fe`)

## 발견사항

0건 — CRITICAL/WARNING/INFO 모두 없음. 4개 점검 항목을 아래에 근거와 함께 기록한다.

### 점검 1 — `§2.24` 넘버 가용성

`spec/1-data-model.md` 전체의 top-level `### 2.N` 헤딩을 순서대로 확인한 결과:

```
spec/1-data-model.md:808:### 2.23 AgentMemory
spec/1-data-model.md:826:### 2.24 LlmUsageLog
```

- `§2.23 AgentMemory` (`spec/1-data-model.md:808`) 가 이번 변경 전 마지막 top-level 엔티티였고, 그 바로 다음(`:826`)에 신설 `§2.24 LlmUsageLog` 가 이어진다. 중간에 다른 `2.24`가 끼어들지 않는다.
- `spec/` 전체에서 `§2.24` 문자열을 재검색해도 신규 3곳(`1-data-model.md:38` 다이어그램 주석, `1-data-model.md:608` 크로스링크, `1-data-model.md:826` 본 헤딩, `data-flow/7-llm-usage.md:133` 크로스링크) 모두 같은 신설 엔티티를 가리킬 뿐, 별개 의미의 기존 `§2.24`는 존재하지 않는다.
- 결론: `§2.24` 는 이번 변경 전 미사용 번호였고, 충돌 없이 확보됐다.

### 점검 2 — 구 `§2.16.1` 넘버 해제 여부

`spec/` 전체에서 `2.16.1` / `2161-llmusagelog` 패턴을 재검색한 결과, 헤딩(`### 2.16.1 ...`)으로 정의된 곳은 더 이상 없다. 유일한 매치는 `spec/1-data-model.md:832` 의 **Rationale 산문** 한 줄로, "구 `§2.16.1` 은 `unified-model-management` 이전 RerankConfig 의 번호였다"는 배경 설명일 뿐 실제 헤딩 정의가 아니다.

- `spec/1-data-model.md` 의 `### 2.16 ModelConfig` (`:577`) 아래에는 더 이상 `2.16.1` 자식 서브섹션이 없다 (구 `2.16.1 LlmUsageLog` 전체 표가 삭제되고 한 줄 포인터 주석으로 대체됨, `:608`).
- 결론: `§2.16.1` 은 spec/ 내에서 완전히 미사용 상태로 해제됐고, 과거 RerankConfig 의미와의 잠재 충돌도 해소됐다. (참고: `plan/complete/rag-rerank-impl.md` 등 6개 완료 plan 문서가 역사적으로 `§2.16.1`=RerankConfig 를 가리키며 여전히 그 표기를 담고 있으나, 이는 완료된 과거 문서의 서술이라 spec 재번호와 직접 충돌하지 않는다.)

### 점검 3 — 신규 앵커 `#224-llmusagelog` 충돌 여부

`spec/1-data-model.md` 전체에서 `LlmUsageLog` 문자열을 포함하는 헤딩은 `### 2.24 LlmUsageLog` (`:826`) 단 하나뿐이며, `spec/` 전체를 통틀어도 동일하다. GitHub 스타일 앵커 슬러그화 규칙(소문자화, 마침표 제거, 공백→하이픈)을 적용하면 `2.24 LlmUsageLog` → `224-llmusagelog` 로, 이는 파일 내 유일한 매치이므로 기존 앵커와 충돌하지 않는다.

- 참조하는 두 크로스링크 — `spec/1-data-model.md:608` 의 `[§2.24 LlmUsageLog](#224-llmusagelog)` 와 `spec/data-flow/7-llm-usage.md:133` 의 `[데이터 모델 §2.24](../1-data-model.md#224-llmusagelog)` — 모두 동일한 단일 헤딩을 정확히 가리킨다.
- 결론: 앵커 충돌 없음.

### 점검 4 — `§2.16 ModelConfig` 구조 정합성

`spec/1-data-model.md:577`~`:610` 확인 결과:

```
603: #### Rationale (ModelConfig 통합)
605: - **단일 테이블 (kind 판별)**: ...
606: - **임베딩 1급화**: ...
608: > **`LlmUsageLog` 위치**: ... §2.16 은 chat/embedding/rerank **설정**만 다룬다.
610: ### 2.17 AuthConfig
```

- `#### Rationale (ModelConfig 통합)` (`:603`) 의 두 불릿(`:605`, `:606`) 다음에 신설 포인터 인용문(`:608`)이 오고, 바로 이어서 `### 2.17 AuthConfig` (`:610`) 로 넘어간다. 구 `2.16.1` 전체 필드 표/인덱스 서술이 빠진 자리를 한 줄 포인터로 대체했을 뿐 헤딩 레벨(`###`→`####`→`###`)이 끊기거나 orphan 서브헤딩이 남지 않는다.
- 결론: `§2.16` 섹션은 구조적으로 well-formed 하며 `§2.17`로 정상 이어진다.

## 요약

target 이 도입하는 신규 식별자(`§2.24` top-level 섹션, 앵커 `#224-llmusagelog`)는 `spec/` 내 기존 사용처와 충돌하지 않는다. `§2.24`는 종전 미사용 번호였고 마지막 top-level 엔티티 `§2.23 AgentMemory` 바로 뒤에 순서대로 이어진다. 구 `§2.16.1`(RerankConfig 의 과거 번호였던 자리에 `LlmUsageLog` 표가 얹혀 있던 상태)은 이번 변경으로 spec/ 내에서 완전히 해제되어, RerankConfig 의미와의 잠재적 재사용 충돌 우려도 해소됐다. 신규 앵커는 파일 내 유일하며, `§2.16 ModelConfig` 섹션도 자식 서브섹션 제거 후에도 헤딩 계층이 끊기지 않고 `§2.17 AuthConfig` 로 정상 연결된다. 다만 `plan/complete/*`(예 `rag-rerank-impl.md`) 등 완료된 plan 문서들이 여전히 "§2.16.1 = RerankConfig" 표기를 과거 서술로 담고 있는데, 이는 이미 완료·보관된 문서이므로 이번 target 의 신규 식별자와 직접 충돌하지는 않는다.

## 위험도

NONE

STATUS: DONE
