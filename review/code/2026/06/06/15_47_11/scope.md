# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] pending_plans 에 rag-dynamic-cut.md 추가
- 위치: frontmatter `pending_plans` 배열 (line 35)
- 상세: `plan/in-progress/rag-dynamic-cut.md` 를 pending_plans 에 추가. 이번 작업의 명시적 목적이므로 적절한 변경.
- 제안: 없음.

### [INFO] §2.1 top_k 설명 업데이트
- 위치: diff line 44 (KB tool parameters 테이블)
- 상세: `top_k` description 을 "Default: <ragTopK>" 에서 동적 컷 의미를 담은 설명으로 교체. D1 동적 컷 도입의 직접 결과로 필수 변경.
- 제안: 없음.

### [INFO] §2.1 하단 bullet 업데이트
- 위치: diff line 53
- 상세: `top_k` / `threshold` 설명 bullet 에서 `top_k` 의 동적 컷 의미 명시. D1 설계 반영 필수 변경.
- 제안: 없음.

### [INFO] §3.1 파라미터 테이블 $3/$4 설명 확장
- 위치: diff lines 63-64
- 상세: `$4` 를 고정 topK 에서 '회수 폭(recall LIMIT)'으로 재정의하고 각주 추가. D1 의 회수 폭 변경 반영.
- 제안: 없음.

### [INFO] §3.1 각주 및 회수·컷 분기 블록쿼트 추가
- 위치: diff lines 68-70
- 상세: `[^recall]` 각주와 회수·컷 분기 blockquote 신설. §3.4 를 본문에 연결하는 내부 참조 역할.
- 제안: 없음.

### [INFO] §3.3.1 rerank_mode 테이블 off/cross_encoder/cross_encoder_llm 셀 내용 수정
- 위치: diff lines 81-83
- 상세: `off` 는 byte-identical 조항 폐기 후 동적 컷 경로로 재기술. `cross_encoder_llm` 은 "항상 grading" → "conditional escalate" 로 변경(D2). 두 변경 모두 이번 작업 범위(D1 + D2 conditional escalate) 에 직접 해당.
- 제안: 없음.

### [INFO] §3.3.2 흐름 3~5단계 업데이트
- 위치: diff lines 94-97
- 상세: `cross_encoder_llm` step 3 를 conditional escalate 로 수정, step 4-5 를 §3.4 동적 컷·inject-cap 으로 재기술. D1·D2 반영.
- 제안: 없음.

### [INFO] §3.3 bullet — v1 결정 2026-06-06 갱신
- 위치: diff line 104
- 상세: "v1 결정"을 conditional escalate + P0 골든셋 후속 분리로 갱신. 이전 구 결정 폐기 문서화.
- 제안: 없음.

### [INFO] §3.3 bullet — grader '근거 없음' 전달 신설
- 위치: diff line 105
- 상세: listwise grading 이 모든 survivor 를 무관으로 판정할 때 메타 노출 정책 추가. §4.2 `gradingNoGrounding` 필드와 연계된 신규 행동 spec. D2 conditional escalate 의 부속 정책으로 이번 작업 범위 내.
- 제안: 없음.

### [INFO] §3.4 신규 섹션 추가 (동적 점수 컷)
- 위치: diff lines 112-135
- 상세: 이번 작업의 핵심 변경(D1). wide 회수·동적 점수 컷 알고리즘·상수(RAG_RECALL_K/RAG_INJECT_TOKEN_BUDGET/RAG_MAX_INJECT_COUNT)·토큰 추정·적용 경로·실패 처리를 전면 기술. 요청된 변경 그 자체.
- 제안: 없음.

### [INFO] §4.2 rerank 서브객체에 gradingNoGrounding 필드 추가
- 위치: diff line 144, 152-154
- 상세: `gradingNoGrounding` 진단 필드 추가 및 `llmGradingApplied`·`cutoffApplied` 의미 확장 설명. D1·D2 에 맞춘 진단 schema 갱신으로 범위 내.
- 제안: 없음.

### [INFO] §6 에러 처리 테이블에 동적 점수 컷 행 추가
- 위치: diff line 163
- 상세: 동적 점수 컷의 실패 모드 명세(별도 없음). §3.4 완결성 보완.
- 제안: 없음.

### [INFO] Rationale 섹션 대규모 확장
- 위치: diff lines 172-185
- 상세: byte-identical 폐기·D1 동적 컷·D2 conditional escalate·ragTopK optional 화·회수폭/예산 내부 상수 근거 등 7개 항목 추가/갱신. 모두 이번 변경의 설계 근거로 spec 규약(Rationale 섹션 의무) 에 따른 필수 기록.
- 제안: 없음.

---

## 요약

변경은 `spec/5-system/9-rag-search.md` 단일 파일에 집중되어 있으며, 변경 내용 전체가 `rag-dynamic-cut` 계획(D1 동적 점수 컷 + D2 conditional escalate 갱신)의 직접 반영이다. pending_plans 추가, §3.4 신규 섹션, §2.1·§3.1·§3.3·§4.2·§6 수정, Rationale 확장 모두 이번 작업 의도 내에 있으며, 불필요한 리팩토링·무관한 파일 수정·포맷팅 노이즈·임포트 변경 등은 없다. 의도 이상의 변경이 검출되지 않는다.

## 위험도

NONE

STATUS: SUCCESS
