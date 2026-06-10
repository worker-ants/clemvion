# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/5-knowledge-base.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 발견사항 없음 — 주요 검토 항목 전부 정합

아래는 각 점검 관점별 검토 결과다.

---

### [INFO] R-3 Rationale 에서 "③ 배너 강화" 채택 근거가 plan 문서 인용에만 의존

- **target 위치**: `spec/2-navigation/5-knowledge-base.md §2.4.1` + `## Rationale R-3`
- **과거 결정 출처**: `plan/in-progress/kb-model-change-reembed-followup.md` (§ 정책 결정 항)
- **상세**: R-3 본문이 "자동 트리거(비용 부담)·저장 차단(UX 마찰) 대신 **③ 배너 강화** 를 택했다"고 서술하며 `kb-model-change-reembed-followup.md` 의 정책 결정을 참조한다. plan 문서가 SoT 이지만 plan 은 `complete/` 로 이동하거나 폐기될 수 있어, 기각된 두 대안(①②)의 기각 사유(비용·마찰)가 spec R-3 자체에도 직접 서술되어 있어 self-contained 하다. 따라서 연속성 상 문제는 없고, 보완이 있다면 plan 이 complete 될 때 spec R-3 의 참조 링크가 유효성을 잃지 않도록 note 추가하는 정도다.
- **제안**: plan 이 `complete/` 로 이동한 뒤에도 R-3 의 "근거는 followup 의 정책 결정"이라는 인라인 서술이 충분히 자급자족 되므로 별도 수정은 선택 사항이다.

---

## 합의 원칙·기각 대안 검토 요약

| 검토 항목 | 출처 Rationale | target 의 처리 | 판정 |
|---|---|---|---|
| 임베딩 모델 select-only (자유 입력 불가) | `spec/2-navigation/6-config.md R-1` | §2.2 에서 동일 정책 명시, R-1 cross-reference | 정합 |
| probe 차원을 `embedding_dimension` 에 미리 저장하지 않음 | `spec/5-system/9-rag-search.md Rationale "왜 probe 차원을 미리 저장하지 않나"` | §2.2 임베딩 테스트 항에서 "probe 는 read-only 검증 — 측정한 차원을 `embedding_dimension` 에 미리 저장하지 않는다" 명시, RAG 검색 Rationale 참조 | 정합 |
| `embedding_dimension = NULL` KB 검색 사전 차단 (silent 제외 폐기) | `spec/5-system/9-rag-search.md Rationale "왜 검색 불가를 명시 신호로 바꿨나"` | §2.2.1 목록 카드 경고 + §2.4.1 배너에서 명시 신호 유지 | 정합 |
| 자동 트리거(①) 기각 — 비용 부담 | `plan/in-progress/kb-model-change-reembed-followup.md` + `spec/5-system/8-embedding-pipeline.md Rationale "재임베딩 정합성"` | R-3 에서 자동 트리거는 graph 추출 LLM 비용 부담으로 기각됨을 재확인. §2.4.1 배너 CTA 는 기존 `POST /re-embed` 재사용, 새 API/상태 전이 없음 | 정합 |
| 저장 차단(②) 기각 — UX 마찰 | `plan/in-progress/kb-model-change-reembed-followup.md` | R-3 에서 명시 기각. target 은 저장 차단 없이 배너+CTA 경로로 구현 | 정합 |
| 재임베딩은 사용자 명시 실행 (비용 통제 원칙) | `spec/5-system/8-embedding-pipeline.md Rationale "모델 변경 정책"` | §2.2 경고 + §2.4.1 CTA 모두 ConfirmModal 경유 사용자 확인 후 실행 | 정합 |
| `POST /re-embed` 는 `reembed_status='idle'` 일 때만 진입, 진행 중 409 | `spec/2-navigation/5-knowledge-base.md §3 API` (기존 결정) | §2.4.1 에서 `in_progress` 시 CTA 숨김 — 409 항상 실패할 동작을 노출하지 않는다는 R-3 설명 일관 | 정합 |
| KB 소유권 원칙 — 검색 파라미터 KB 단위 | `spec/5-system/9-rag-search.md Rationale "왜 KB 단위인가"` | 배너/경고가 KB 단위로 적용됨 | 정합 |

---

## 요약

target 문서(`spec/2-navigation/5-knowledge-base.md`)는 관련 spec 의 `## Rationale` 에 기록된 모든 주요 결정과 정합하다. 핵심 검토 항목인 (a) 임베딩 모델 select-only 원칙, (b) probe 차원 미저장 원칙, (c) `embedding_dimension = NULL` KB 의 명시 신호 노출(silent 제외 폐기), (d) 자동 트리거·저장 차단 두 대안의 기각 유지, (e) 수동 사용자 확인(비용 통제) 원칙 모두 target 에서 기각된 대안의 재도입 없이 일관되게 따르고 있다. 신규 추가된 `§2.4.1 검색 불가 배너`와 `R-3` 는 기존 `POST /re-embed` API 와 상태 전이를 변경하지 않고 조치 동선만 발견 지점으로 끌어온 것으로, RAG 검색 Rationale 의 "자동화는 정책 결정 필요" 유보와 충돌하지 않는다. INFO 수준의 보완 제안 1건만 존재한다.

---

## 위험도

NONE
