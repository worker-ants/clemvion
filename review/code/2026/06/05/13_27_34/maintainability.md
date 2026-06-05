# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: rag-rerank-followup 관련 spec 문서 변경 (파일 1~26)
리뷰 일시: 2026-06-05

---

## 발견사항

### [WARNING] 버전 태그 표기 방식이 문서 간 비일관
- **위치**: `spec/1-data-model.md` — `rerank_mode` 셀에 `(V082)`, `RerankConfig` 소개 문단에 `(V081)` 인라인 삽입; `spec/2-navigation/6-config.md` Part C → `[데이터 모델 §2.16.1](../1-data-model.md#2161-rerankconfig-planned)` 링크 앵커가 `-planned` 접미사를 유지하는 반면 동일 섹션의 실제 앵커는 `(Planned)` 텍스트를 heading 에 유지한다는 주석이 추가됨
- **상세**: 마이그레이션 버전 태그(`V081`, `V082`, `V084`)를 셀 설명 문자열 안에 인라인으로 삽입(`(V082)`, `V081)`)하는 패턴이 일부 셀에는 적용되고 다른 셀에는 없다. 또한 `6-config.md`의 `#2161-rerankconfig-planned` 앵커는 실제 heading 문자열과 맞지 않는 상태로 유지된다는 주석이 있는데, 이 주석 자체가 링크 대상 앵커가 stale 임을 인정하는 것이다. 유사한 패턴의 다른 spec 링크에는 이러한 "anchor 안정성 유지" 주석이 없어 일관성이 없다.
- **제안**: 마이그레이션 버전 태그는 셀 값에 인라인 삽입하지 않고 별도 "버전" 열을 두거나 각주 패턴으로 통일한다. stale 앵커를 유지해야 할 경우 `#2161-rerankconfig-planned` 처럼 링크 텍스트에서도 `-planned`를 빼 독자가 `Planned`가 아님을 혼동하지 않게 한다.

---

### [WARNING] `spec/2-navigation/6-config.md` Part C 에 Rationale 절 없음
- **위치**: `spec/2-navigation/6-config.md` — `## Part C: Rerank (리랭커 설정)` 추가 섹션
- **상세**: Part A(인증)·Part B(LLM)는 기존 문서에 Rationale 절이 있으나, 이번에 추가된 Part C(Rerank)에는 "왜 LLMConfig와 별도 sibling 리소스로 관리하는가", "왜 워크스페이스 설정 화면에 두는가" 등 설계 결정 근거가 없다. `spec/1-data-model.md §2.16.1`에 구현 상태 주석이 추가됐을 뿐 해당 화면 설계의 Rationale는 기록되지 않았다.
- **제안**: Part C 하단에 짧은 `### Rationale` 항을 추가해 "LLMConfig와 동일 패턴 — API Key·endpoint를 가진 provider resource이므로 동일 관리 화면 진입"의 근거를 명시한다. 기존 `spec/5-system/7-llm-client.md §3.6`에서 RerankConfig가 LLMConfig의 sibling임을 선언하고 있으므로 cross-reference로 처리해도 된다.

---

### [INFO] `spec/5-system/17-agent-memory.md` 섹션 번호 이동으로 기존 앵커 무효화 가능성
- **위치**: `spec/5-system/17-agent-memory.md` — 기존 `## 6. v2 로드맵`이 `## 7. v2 로드맵`으로 renumber되고 신규 `## 6. 메모리 관리 API` 삽입
- **상세**: 기존 `§6` 앵커(`#6-v2-로드맵`)를 참조하던 문서가 있다면 자동으로 `#7-v2-로드맵`으로 업데이트되지 않는다. `spec/5-system/_product-overview.md`의 `AGM-*` 요구사항 링크나 외부 plan 참조가 해당 앵커를 사용할 수 있다. 이번 diff에서 `5-system/_product-overview.md`의 `AGM-12/13`이 `§6` 앵커로 새로 추가됐으므로 최신 링크는 정합하나, 변경 전 `§6` 앵커 참조가 존재했을 경우 silent 404 상태가 된다.
- **제안**: 섹션 renumber 시 기존 앵커 참조 전수 검색(`grep -r "17-agent-memory.md#6"`)을 수행해 stale 링크를 함께 업데이트한다.

---

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md` Config echo 정책 문단이 과도하게 장문화
- **위치**: `spec/4-nodes/3-ai/1-ai-agent.md` — `Config echo 정책` blockquote
- **상세**: `summaryModel?`, `extractionModel?` 두 필드 추가에 따라 해당 blockquote에 필드 목록이 인라인으로 확장됐다. 이미 이전에도 긴 문단이었는데 이번 변경으로 단일 문장이 더 길어졌다(`memoryStrategy?/memoryTokenBudget?/.../embeddingModel?/summaryModel?/extractionModel?`). 독자가 어떤 필드가 echo 대상인지 파악하기 위해 전체 인라인 목록을 스캔해야 한다.
- **제안**: echo 대상 optional 필드 목록을 blockquote 본문에서 분리해 별도 indented 목록이나 테이블로 추출한다. 새 필드 추가 시 목록만 업데이트하면 되고 의도(echo 정책 설명 문단)와 내용(필드 열거)의 분리가 명확해진다.

---

### [INFO] `spec/conventions/conversation-thread.md §9` 섹션 표제 추가가 전후 섹션 구분을 흐림
- **위치**: `spec/conventions/conversation-thread.md` — `## 9. 미리보기 UI 렌더 규칙` 앞에 2줄 개요 문단 삽입
- **상세**: 기존에는 `## 9.`가 바로 하위 절(`### 9.1`)로 이어졌는데, 이번에 `## 9.` 직하에 짧은 요약 문단이 추가됐다. 이 자체는 좋으나 같은 파일에서 `## 8.4`가 그 앞에 삽입되면서 `## 8.`와 `## 9.` 사이에 `## 8.4`만 존재하는 구조가 됐다(`8.1~8.3` 없이 `8.4`가 유일한 소절). 독자 입장에서 `8.1~8.3`이 어딘가 있을 것으로 기대할 수 있다.
- **제안**: `## 8.4`를 독립 절로 두려면 `## 8.`를 상위 섹션으로 만들거나(현재 `## 8.`가 없음), `## 8.4`를 `## 8. Durable Park Resume`로 승격해 번호 체계를 명확히 한다.

---

### [INFO] 검토 문서(review/consistency) 파일이 리뷰 대상에 포함
- **위치**: 파일 1·2 (`review/consistency/2026/06/05/11_50_51/plan_coherence.md`, `rationale_continuity.md`)
- **상세**: 이 두 파일은 일관성 검토 산출물 문서로, 코드가 아니라 분석 결과 문서다. 유지보수성 관점에서 리뷰할 구체적인 코드 구조가 없으며 해당 문서 자체는 spec 관리 프로세스의 일환이다. 구조·네이밍·포맷(섹션 헤더, 등급 표기, Stale skip 목록 의무 기재)은 기존 consistency-check 규약을 잘 따르고 있다. 특이사항 없음.

---

### [INFO] `spec/5-system/4-execution-engine.md` Rationale 신규 항목 4개가 단일 섹션에 집중적으로 추가
- **위치**: `spec/5-system/4-execution-engine.md §Rationale` — `active-running 직렬화 불변식`, `한도 출처`, `판정 >=`, `타임아웃 판정 비원자성` 4개 bullet 추가
- **상세**: 각 bullet이 1~3문장으로 잘 정제되어 있고 "배경 → 채택 → 기각 대안" 형식을 따른다. 그러나 4개가 동일 PR(PR2a) 관련 결정이라 서로 강하게 연관되는데 독립 bullet로 분리되어 있어 맥락을 종합하려면 네 bullet을 오가야 한다.
- **제안**: PR2a 관련 Rationale 4개를 `#### PR2a — active-running 누적 타임아웃` 소절로 묶어 관련 결정의 응집도를 높이면 나중에 PR2b Rationale 추가 시에도 구분이 명확해진다.

---

## 요약

변경된 26개 파일은 대부분 spec 문서이며 전반적으로 기존 프로젝트의 문서화 규약(frontmatter, 섹션 구성, 링크 패턴)을 잘 준수한다. 유지보수성 관점의 주요 우려는 두 가지다: 마이그레이션 버전 태그를 셀 설명 안에 인라인으로 삽입하는 패턴이 일부에만 적용되어 일관성이 없고(`(V081)`, `(V082)` 등), 기존 앵커와 어긋나는 `-planned` 접미사 링크를 "anchor 안정성"이라는 이유로 유지하되 이에 대한 주석이 해당 파일에만 국소적으로 있어 다른 참조 문서에서 오해를 유발할 수 있다. 또한 `17-agent-memory.md`의 섹션 renumber로 인한 stale 앵커 가능성, `ai-agent.md` Config echo 정책 문단의 장문화, `conversation-thread.md`의 `§8.4` 단독 존재로 인한 번호 체계 이상은 INFO 수준이나 장기적으로 문서 탐색 비용을 높인다. 신규 `Part C: Rerank` 섹션에 Rationale가 없는 점은 프로젝트 규약(spec 문서 3섹션 구성 의무)에 비추어 보완이 권장된다.

---

## 위험도

LOW
