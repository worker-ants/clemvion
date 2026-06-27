# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상: `spec/2-navigation/6-config.md`
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] R-1 범위 선언과 실제 적용 범위 불일치

- **target 위치**: `spec/2-navigation/6-config.md` — `## Rationale § R-1` 본문 마지막 "범위 한정" 단락
- **과거 결정 출처**: 동문서 R-1 자체 (내부 Rationale 일관성 문제)
- **상세**: R-1의 "범위 한정" 항은 "본 변경은 Config > Models (Chat 탭)의 `defaultModel` 필드에만 적용된다"고 명시한다. 그러나 §B.5(Embedding 탭)는 "모델 선택 UX: Chat 탭과 동일한 select-only 정책(자유 입력 fallback 없음, [Rationale R-1](#r-1-기본-모델-선택을-select-only-로-한정))"으로 R-1을 참조해 임베딩 탭에도 동일 정책을 적용한다. 범위 선언("Chat 탭에만")과 실제 적용("Chat + Embedding")이 불일치하며, 구현자가 R-1을 읽고 임베딩 탭의 select-only 정책 근거를 찾으려 할 때 혼동을 야기한다.
- **제안**: R-1의 "범위 한정" 단락을 "본 결정은 Config > Models의 Chat 탭 `defaultModel` 필드와 Embedding 탭 `defaultModel` 필드에 적용된다. Rerank 탭은 표준 model-list API 부재로 자유 입력을 허용한다(§B.6.2)."로 갱신해 실제 적용 범위를 명시한다.

---

### [INFO] SSRF 가드 메커니즘 — `ALLOW_PRIVATE_HOST_TARGETS` 원칙과의 암묵적 분기

- **target 위치**: `spec/2-navigation/6-config.md` — `## Rationale § R-4`, `§B.6.2` 리랭커 Base URL
- **과거 결정 출처**: `spec/2-navigation/4-integration.md` — Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" 항
- **상세**: 4-integration.md Rationale는 "별도 opt-in 플래그(`SMTP_BLOCK_PRIVATE_HOSTS` 안)를 신설하는 대신 기존 `ALLOW_PRIVATE_HOST_TARGETS`(HTTP Request / Database Query 가 이미 사용)를 재사용한다 — 노드별로 플래그가 갈리는 혼란을 막는다"고 확립했다. 반면 6-config.md R-4가 위임하는 LLM Client §5.5의 SSRF 가드는 env-var opt-out(`ALLOW_PRIVATE_HOST_TARGETS`) 대신 코드 레벨 provider 예외(`local`/`tei` 고정 허용)를 사용한다. 4-integration.md의 원칙 적용 범위가 "integration 노드" (워크플로 실행 컨텍스트)로 한정되고, ModelConfig 설정은 관리 컨텍스트라 직접 충돌은 아니다. 그러나 셀프호스팅 사용자 관점에서 HTTP Request 노드 사설 IP 허용(`ALLOW_PRIVATE_HOST_TARGETS=true`)과 ModelConfig base URL 사설 IP 예외(provider 코드 레벨 `local`/`tei` 고정) 간의 비대칭이 문서화되지 않아 운영 혼선 가능성이 있다.
- **제안**: R-4에 다음 보완 설명을 추가하는 것을 검토한다: "ModelConfig 레벨 SSRF 가드는 워크플로 노드의 `ALLOW_PRIVATE_HOST_TARGETS` env-var 경로와 분리된 코드 레벨 provider 예외를 사용한다 — 노드 실행 컨텍스트(런타임)와 설정 컨텍스트(관리)가 다르며, self-hosted Ollama/TEI는 provider 유형만으로 사설망 의도가 명백해 env-var 없이 허용한다."

---

## 요약

`spec/2-navigation/6-config.md`는 기각된 대안을 무근거로 재도입하거나 합의된 invariant를 위반하는 사례가 없다. R-3(ModelConfig 단일 화면 통합)는 이전 결정을 번복하되 "번복" 표기와 함께 상세한 새 Rationale를 명시하고 있어 결정 무근거 번복 기준에 해당하지 않는다. R-4(cohere Base URL 변경)·R-5(max_tokens 4096 정정)·R-7(action-POST Editor+ 게이트)는 모두 새 Rationale를 동반한다. 발견된 두 항목은 모두 INFO 수준이다: ① R-1의 범위 선언이 실제 적용(Chat + Embedding)보다 좁게 기술된 내부 정합 결함, ② 4-integration.md가 확립한 `ALLOW_PRIVATE_HOST_TARGETS` 통일 원칙과 LLM Client의 코드 레벨 provider 예외 메커니즘 간의 암묵적 분기(범위 차이로 직접 충돌은 아니나 문서화 보완 권장). 전체 Rationale 연속성은 양호하다.

---

## 위험도

LOW
