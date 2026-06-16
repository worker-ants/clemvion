# Cross-Spec 일관성 검토 결과

- **target**: `spec/2-navigation/6-config.md`
- **검토 기준**: 2026-06-16

---

## 발견사항

### [INFO] SSRF 가드 예외 provider 표현 불일치 — `tei`/`local` vs `tei` 단독

- **target 위치**: `spec/2-navigation/6-config.md` §B.6.2 Base URL 필드 설명, Rationale R-4
- **충돌 대상**: `spec/5-system/7-llm-client.md` §5.5 SSRF 가드, §4.1 RerankClientFactory Rationale
- **상세**: LLM client §5.5 의 SSRF 가드 규칙은 `local` 프로바이더만 사설망 예외로 명시한다. §4.1 RerankClientFactory Rationale 은 "SSRF 가드(`tei`/`local` 사설망 예외)는 §5.5 규칙을 재사용한다"라고 기술해 `tei` 도 예외에 포함시킨다. target 문서 R-4 는 `local` rerank provider 가 Dropped 됐으므로 "rerank 에선 `tei` 만 예외"라고 올바르게 좁혀 기술한다. 그런데 LLM client §4.1 Rationale 자체는 "`tei`/`local` 사설망 예외"를 함께 언급하며 아직 `local` 이 살아있는 것처럼 표현되어 있어, §5.5 의 `local` 단독 예외 규칙 및 §2.1 의 `local` Dropped 결정과 일관성이 부족하다. target 문서 자체의 서술은 정합적이므로 target 이 아닌 `7-llm-client.md §4.1 Rationale` 이 갱신 대상이다.
- **제안**: `spec/5-system/7-llm-client.md` §4.1 RerankClientFactory Rationale 의 "SSRF 가드(`tei`/`local` 사설망 예외)" 표현을 "SSRF 가드(`tei` 사설망 예외 — `local` rerank 는 Dropped)"로 정정해 §2.1 Dropped 결정 및 target 문서 R-4 와 일치시킨다.

---

### [INFO] max_tokens 기본값 명시가 AI 노드 spec 에서 누락

- **target 위치**: `spec/2-navigation/6-config.md` §B.4 모델 파라미터 기본값, Rationale R-5
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` 노드 설정 패널 예시
- **상세**: target Rationale R-5 는 `max_tokens` 기본값을 2048 → 4096 으로 정정하며 "AI Agent 노드 설정 패널 예시(`spec/4-nodes/3-ai/1-ai-agent.md`)의 `maxTokens` 예시값도 동일하게 4096 으로 동반 갱신해 spec 내부 정합을 유지한다"고 선언한다. AI 노드 spec 실제 파일에서 `maxTokens: 4096` 예시가 확인되어 갱신은 이미 반영된 것으로 보인다. 다만 target 이 약속한 "동반 갱신"이 실제 완료됐는지 두 문서가 명확히 cross-link 하지 않아 향후 양쪽 중 하나만 수정됐을 때 모니터링이 어렵다.
- **제안**: 검토 필요 없음. 현재 두 파일 모두 4096 이므로 실질 불일치 없음. 단 R-5 의 "동반 갱신" 약속이 이미 이행됐음을 R-5 에 "(완료)" 표기로 명시하면 추후 중복 작업을 방지할 수 있다.

---

### [INFO] Reveal 실패 응답 코드 표현 — `AUTH_FAILED` vs `AUTH_REQUIRED` 용어 혼재 가능성

- **target 위치**: `spec/2-navigation/6-config.md` §A.4 Reveal 흐름, 3단계 응답 설명
- **충돌 대상**: `spec/5-system/2-api-convention.md` §에러 응답 기본값 (401=`AUTH_REQUIRED`, 403=`FORBIDDEN`)
- **상세**: target §A.4 는 Reveal 흐름에서 "실패: 401 (잘못된 password) / 403 (Editor·Viewer)"라고 HTTP 상태코드와 의미만 기술하고 애플리케이션 에러 코드는 명시하지 않는다. API 규약에 따르면 401 의 기본 코드는 `AUTH_REQUIRED`, 403 은 `FORBIDDEN` 이다. 해당 엔드포인트가 비밀번호 불일치 시 실제로 `AUTH_REQUIRED` (표준 401 기본값) 를 반환하는지 `AUTH_FAILED` (별도 코드) 를 반환하는지 target 이 명시하지 않아, 구현자가 API 규약 기본값을 사용할지 별도 코드를 신설할지 판단해야 한다. target `§R-6` 은 비활성 인증 설정의 webhook 응답을 `401 AUTH_FAILED` 로 명시하는데, reveal 실패 응답 코드는 그보다 불명확하다.
- **제안**: target §A.4 Reveal 흐름 3단계를 "401 `AUTH_REQUIRED` (잘못된 password) / 403 `FORBIDDEN` (Editor·Viewer)"처럼 애플리케이션 에러 코드까지 명시해 API 규약과의 정합을 확인 가능하게 한다.

---

## 요약

target `spec/2-navigation/6-config.md` 는 `spec/1-data-model.md`, `spec/5-system/1-auth.md`, `spec/5-system/7-llm-client.md` 와 주요 항목(ModelConfig 단일 테이블, AuthConfig 엔티티 필드, RBAC 매트릭스, SSRF 가드 에러코드 `MODEL_CONFIG_INVALID`, max_tokens 기본값 4096, Reveal 권한 Admin+)에서 일관성을 유지하고 있다. 발견된 세 건 모두 INFO 등급이며, 그 중 실질적 불일치는 `spec/5-system/7-llm-client.md §4.1 RerankClientFactory Rationale` 의 `tei`/`local` 표현이 `local` Dropped 결정을 반영하지 못한 것으로, target 이 아닌 참조 문서가 갱신 대상이다. 나머지 두 건은 명확성 향상 제안이다.

---

## 위험도

LOW

STATUS: SUCCESS
