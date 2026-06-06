# API 계약(API Contract) 리뷰 결과

**대상 파일**: `spec/5-system/9-rag-search.md`
**변경 유형**: Spec 문서 갱신 (RAG 동적 컷 D1 도입, conditional escalate D2 도입)

---

## 분석 범위 판정

변경 파일은 `.md` spec 문서이며 직접적인 HTTP API 엔드포인트/컨트롤러/라우터 코드가 아니다. 그러나 본 spec 은 두 가지 API 계약을 직접 정의한다.

1. **KB tool 인터페이스** (`kb_*` — LLM 이 호출하는 tool API): `query` / `top_k` / `threshold` 파라미터 스키마
2. **응답 메타데이터 스키마** (`meta.ragDiagnostics.rerank` 서브객체): `gradingNoGrounding` 신규 필드, `cutoffApplied` 의미 확장

두 계약 모두 API 소비자(LLM 에이전트, 프론트엔드 run-results UI, 외부 API 클라이언트)에게 직접 노출되므로 API 계약 관점 분석이 적용된다.

---

## 발견사항

### [WARNING] `top_k` 파라미터 의미론 변경 — LLM 클라이언트 동작 변경 가능
- **위치**: §2.1 KB tool 정의 (`top_k` description), §3.1 파라미터 표 `$4` 행, Rationale `ragTopK 기본값(5) 제거` 항목
- **상세**: 기존 spec 에서 `top_k` 는 "기본값 `ragTopK`(5)" 를 가진 파라미터였다. 이번 변경으로 기본값이 폐기되고 "미지정 시 §3.4 동적 점수 컷(internal ceiling 12)이 지배"하는 선택적 상한 override 로 의미가 바뀐다. LLM 에이전트가 `top_k` 를 omit 했을 때의 결과 수가 이전과 달라진다 (이전: 항상 5 이하 / 이후: 최대 12 또는 token-budget 도달 시까지). 이는 LLM 프롬프트 엔지니어링·컨텍스트 윈도우 계획에 영향을 줄 수 있다.
- **하위호환성**: spec 은 이를 의도적 breaking change 로 명시하고 있으며, 새 `top_k` description 에 "dynamic token-budget cut applies" 를 LLM 에 안내한다. LLM 소비자 입장에서 behavior 변경이 있으나 스키마 구조 자체(필드명, 타입)는 유지된다. 관리된 breaking change.
- **제안**: 이미 spec 내 Rationale 에 충분한 근거가 기술되어 있다. 구현 측에서 기존 `ragTopK` 기본값 5 를 사용하던 클라이언트/테스트가 새 동작(최대 12)을 예상하도록 업데이트됐는지 구현 리뷰 시 확인 권장.

### [WARNING] `rerank.cutoffApplied` 의미 확장 — 기존 소비자 혼란 가능
- **위치**: §4 ragDiagnostics, 신규 bullet 세 번째 항목
- **상세**: `cutoffApplied` 필드의 의미가 확장된다. 기존에는 리랭크 점수 임계(θ) 컷에만 해당했으나, 이제 token-budget 컷 / inject-cap 컷 중 어느 것이든 적용 시 `true` 로 변경된다. 필드가 제거되거나 타입이 바뀐 것은 아니나, `cutoffApplied=true` 의 해석이 달라진다. 이 필드를 파싱하는 프론트엔드/외부 클라이언트가 "점수 임계 컷 여부"로 사용했다면 오탐이 발생할 수 있다.
- **제안**: spec 에는 "별도 `dynamicCutApplied` 필드는 v1 미신설(진단 schema 증식 회피)" 이유가 명시되어 있다. 의도적 결정이나, 기존 소비자가 이 필드를 사용 중이라면 릴리즈 노트·마이그레이션 가이드에 의미 변경을 명시 권장.

### [INFO] `rerank.gradingNoGrounding` 신규 필드 추가 — 하위호환 문제 없음
- **위치**: §4 ragDiagnostics rerank 서브객체 스키마 (신규 `gradingNoGrounding: false` 항목)
- **상세**: 신규 필드가 추가(추가적 확장)되며 기존 필드는 제거되지 않는다. 기존 클라이언트가 이 필드를 무시해도 동작에 지장 없다. 스키마 확장이므로 하위호환성 위반 없음.
- **제안**: 이상 없음.

### [INFO] `off` 경로 동작 변경 — "byte-identical 하위호환" 조항 폐기 명시
- **위치**: §3.3.1 모드 표 `off` 행, Rationale `byte-identical 조항 폐기` 항목
- **상세**: 기존 리랭킹 spec 의 "off = 현행과 byte-identical" 조항이 폐기된다. `off` 경로도 이제 wide 회수(LIMIT 50) + app-layer 동적 컷을 거치므로 동일 쿼리에 대해 반환되는 청크 수·내용이 달라질 수 있다. 이는 `off` 경로 소비자(신규 클라이언트 포함) 에 동작 변경이다.
- **하위호환 판단**: spec 에서 새 하위호환 정의를 "리랭커 인프라 없이 동작" 으로 재정의했다. 새 동작(최대 12 청크 대 기존 최대 5)이 일반적으로 품질 향상이므로 소비자에게 유해한 변경은 아니나, 응답 크기·토큰 비용이 증가할 수 있다. 의도된 변경임이 명확히 문서화되었다.
- **제안**: 이상 없음.

### [INFO] `rerank.llmGradingApplied` 의미 정밀화 — `false` 포함 케이스 확장
- **위치**: §4 ragDiagnostics, 첫 번째 신규 bullet
- **상세**: `llmGradingApplied=false` 가 기존에는 "grading 미적용" 하나의 케이스만 의미했으나, 이제 "escalate 미발생" + "grading 실패 강등" 두 케이스를 포함한다. `mode`·`error` 필드로 구분 가능하도록 안내되어 있다. 타입 변경 없음.
- **제안**: 이상 없음.

---

## 요약

이번 변경은 RAG 동적 컷(D1) 도입 및 conditional escalate(D2) 를 반영한 spec 갱신이다. API 계약 관점에서 두 가지 관리된 breaking change 가 존재한다. 첫째, `top_k` 파라미터의 기본값(5) 폐기로 미지정 시 주입 청크 수가 최대 12 로 증가한다 — 스키마 구조 변화는 없으나 LLM 소비자 동작에 영향이 있다. 둘째, `rerank.cutoffApplied` 의 의미가 "점수 임계 컷"에서 "임의 컷(θ/token-budget/inject-cap) 중 하나라도 적용"으로 확장된다. 두 변경 모두 spec 내 Rationale 에 의도·근거가 명시되어 있으며 신규 KB/노드 config 필드 추가 없이 기존 인터페이스를 최대한 유지하려는 설계 원칙을 따르고 있다. `gradingNoGrounding` 신규 필드는 순수 추가 확장이라 하위호환 문제 없음. 전체적으로 계약 관리가 적절히 수행된 변경이나, 구현 단계에서 기존 소비자(테스트, 프론트엔드 진단 UI)가 새 동작을 올바르게 반영하는지 확인이 권장된다.

---

## 위험도

**LOW**

두 breaking change 가 모두 의도적이며 spec 내에서 명시적으로 문서화되었다. 스키마 구조(필드명·타입) 변화는 없고, 신규 필드는 하위호환 추가 방식이다.
