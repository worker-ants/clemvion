# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-kb-unsearchable-warning.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 발견사항 없음 — 기각된 대안 재도입 없음

관련 spec Rationale 발췌를 전수 확인한 결과, target 문서가 과거에 명시적으로 기각된 대안을 다시 채택하거나 합의된 invariant 를 우회하는 설계를 도입하는 사례가 확인되지 않았다.

주요 확인 항목:

1. **`probe` 차원 사전 저장 대안 기각 재확인**
   - target 문서 변경 1 §5 Rationale 에서 "probe 차원을 미리 저장하는 대안은 기각(저장 청크가 옛 차원/공간이라 dimension 만 채우면 stale/mismatch 검색이 됨)" 을 명시적으로 서술하고 있다.
   - `spec/5-system/8-embedding-pipeline.md § Rationale "다중 차원 임베딩"` 은 `embeddingModel` 변경 시 `embeddingDimension = null` 함께 reset 을 확립된 결정으로 기술하며 probe-fill 대안을 기각한 근거와 방향이 일치한다.
   - 위반 없음.

2. **`not_searchable` 봉투 — 기존 `grounding:"none"` / `search_failed` 선례와의 충돌 여부**
   - `spec/5-system/9-rag-search.md §2.2` 의 기존 Rationale 는 `grounding:"none"` 봉투를 listwise grading 이 근거 없음을 판정한 경우 에이전트 환각 억제 신호로 확립하고, `search_failed` 는 일시적 인프라 실패로 구분한다.
   - target 문서가 추가하는 `status:"not_searchable"` 봉투는 이 두 기존 케이스와 명시적으로 구분되며 ("일시 인프라 오류와 구분 — 데이터 적재 상태 문제") 기존 봉투를 대체하거나 의미를 재정의하지 않는다.
   - 위반 없음.

3. **`skipReason` enum 확장 — 기존 원칙과의 충돌 여부**
   - `spec/5-system/9-rag-search.md §4.2` 의 `skipReason` 은 현재 `empty_kb_list` / `no_results` 두 값만 정의된다. 기각된 다른 skipReason 값에 대한 Rationale 항목이 없으므로, `kb_unsearchable` 추가는 기존 결정 번복이 아닌 신규 확장이다.
   - 위반 없음.

4. **자동 재임베딩 트리거 범위 한정**
   - `spec/5-system/8-embedding-pipeline.md § Rationale "비대칭 입력 배선"` 에서 "자동 트리거 대신 수동 재임베딩 플로우로 안내(비용 통제)" 원칙이 확립되어 있다.
   - target 문서도 "모델 변경 시 자동 재임베딩/차단은 본 변경 범위 밖(follow-up)" 으로 범위를 한정, 동일 원칙을 준수한다.
   - 위반 없음.

5. **`grounding:"none"` 환각 억제 원칙 준수**
   - `spec/5-system/9-rag-search.md §2.2 / §3.3.2` 의 확립된 원칙: 에이전트에 빈 결과와 구분 가능한 명시 신호를 전달해 환각을 억제한다.
   - target 문서의 `not_searchable` + `note` 필드 설계는 이 원칙을 동일하게 적용하며 번복하지 않는다.
   - 위반 없음.

6. **`RagSearchService` NULL dimension KB 제외 — silent→신호 전환**
   - `spec/5-system/8-embedding-pipeline.md` line 249 는 "자연스럽게 검색 대상에서 제외된다(silent)" 를 확립된 동작으로 기술하고 있다.
   - target 문서는 이 silent 동작을 `not_searchable` 명시 신호로 전환하는 번복을 제안하나, 변경 1 §5 Rationale 에 "왜 silent 제외를 신호로 바꿨나" 근거를 상세히 서술하며, 변경 3 에서 기존 spec 본문도 동기화하도록 명시하고 있다.
   - 과거 결정 번복이지만 새 Rationale 를 함께 작성하고 있어 절차 준수.
   - 위반 없음.

7. **UI 임베딩 상태 경고 — `reembedStatus`/`embeddingDimension` 기존 필드 재사용**
   - `spec/2-navigation/5-knowledge-base.md` 의 기존 Rationale(R-1 select-only) 는 임베딩 모델 선택 관련 원칙만 다루고 있다.
   - target 문서 변경 2 는 기존 필드를 재사용하는 신규 UI 표시 추가로, 기존 Rationale 결정과 충돌 없다. 편집 폼 인라인 경고(line 68)와의 의도적 구분("별개" 명시)도 spec 내에서 정합하다.
   - 위반 없음.

---

## 요약

target 문서(`spec-draft-kb-unsearchable-warning.md`)는 기존 spec Rationale 에서 명시적으로 기각된 대안(probe 차원 사전 저장)을 채택하지 않으며, `grounding:"none"` / `search_failed` 봉투 선례·자동 재임베딩 범위 한정 원칙·KB 단위 설정 소유권·환각 억제 신호 원칙 등 확립된 설계 원칙을 일관되게 준수하고 있다. `RagSearchService` 의 silent 제외를 명시 신호로 전환하는 과거 결정 번복에 대해서도 새 Rationale 를 함께 작성하고 있어 절차상 결함이 없다. Rationale 연속성 관점에서 특이사항 없음.

---

## 위험도

NONE
