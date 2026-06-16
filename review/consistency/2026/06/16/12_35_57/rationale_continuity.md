# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/6-config.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-16

---

## 발견사항

- **[INFO]** §B.6.2 "rerank 연결 테스트 미제공" — Rationale 앵커 인용 불일치
  - target 위치: `spec/2-navigation/6-config.md` §B.6.2 본문 "연결 테스트 미제공" 줄 및 §B.3 테이블 주석
  - 과거 결정 출처: `spec/2-navigation/6-config.md` 자체 R-3 "ModelConfig 단일 화면 통합" — "유지되는 것" 불릿
  - 상세: §B.6.2 는 "리랭커는 표준 model-list/test API 가 없어 Chat/Embedding 탭과 달리 연결 테스트를 제공하지 않는다 ([Rationale R-3])" 와 같이 R-3 를 이유 출처로 인용하고 있다. 그러나 R-3 는 통합 화면 전환의 번복 결정이며, "연결 테스트 미제공(표준 model-list API 부재)" 를 변경하지 않고 유지함을 단순 나열한 것이다 — 미제공의 근거 자체를 설명하는 항목이 아니다. 실제 이유("표준 model-list/test API 가 없어")는 body text 에 올바르게 기술되어 있고 `spec/5-system/7-llm-client.md §8.3` 도 같은 사실("rerank 는 표준 test API 부재로 연결 테스트 미제공(§2.1)")을 명시한다. 따라서 내용 자체는 옳으나, R-3 가 이 정책을 설명하는 Rationale 가 아니어서 인용 앵커가 독자에게 혼란을 줄 수 있다. 기각된 대안 재도입이나 원칙 위반은 아님.
  - 제안: §B.6.2 의 "(Rationale R-3)" 앵커를 삭제하거나, body text 에 이미 있는 이유("리랭커는 표준 model-list/test API 가 없어")로 자체 완결되도록 남기고 R-3 참조를 제거한다. 또는 Rationale 섹션에 별도 항목(예: "R-7. Rerank 연결 테스트 미제공 이유")을 간략히 추가해 앵커를 정합화한다.

---

## 이슈 없음 항목 (합의 원칙 준수 확인)

| 영역 | 확인 결과 |
|---|---|
| R-1 (select-only 모델 선택) | Chat/Embedding 에만 적용. Rerank 의 자유 입력(표준 model-list API 부재)은 R-1 의 명시 범위 한정("Config > Models Chat 탭의 `defaultModel` 필드에만 적용") 과 정합. 자유 입력 fallback 재도입 아님 |
| R-2 (AuthConfig Webhook wiring) | bearer_token 자동 발급 강제, 사용자 입력 토큰 금지, 마스킹 + Reveal 3경로, 30초 자동 hide, 편집 폼 shallow-merge — 모두 R-2 에서 결정한 원칙과 일치 |
| R-3 (ModelConfig 단일 화면 통합, 번복) | 이전 결정(폐기) 명시 + 번복 근거 작성 규약 충족. sibling RerankConfig / piggyback embedding 이 본문에 재도입된 흔적 없음. 구 alias 제거 완료 주석도 통합과 정합 |
| R-4 (cohere Base URL UI 미노출 + API optional) | 종전 "cohere Base URL 불허" 번복 근거 명시. SSRF 가드 적용 범위·local rerank Dropped 사실(`spec/5-system/7-llm-client.md §2.1`) 참조와 일치 |
| R-5 (max_tokens 4096 정정) | 구 spec 2048 은 "구현에 한 번도 적용된 적 없음" 근거 명시. SPEC-DRIFT 정정으로 기각된 대안 재도입 아님 |
| R-6 (소스 IP·응답 코드·기간별 호출 수) | 전용 call-log 엔티티 도입 대신 Execution 행 재사용 결정 근거 명시. 캘린더 버킷 대신 롤링 윈도 채택 근거 명시. WH-MG-05 이행 정합 |
| Model Config mutation 권한 (Editor+) | §3 API 주석 "mutation (POST / PATCH / DELETE) 은 Editor+" 가 `spec/5-system/1-auth.md §3.2` 매트릭스 `Model Config: CRUD(Owner/Admin/Editor), R(Viewer)` 와 일치 |
| Auth Config mutation 권한 (Admin+) | §3 API 및 §A.4 가 Auth Config CRUD = Owner/Admin, Editor/Viewer = R 로 `spec/5-system/1-auth.md §3.2` 와 정합 |

---

## 요약

`spec/2-navigation/6-config.md` 의 Rationale 연속성은 전반적으로 양호하다. R-3 의 명시적 번복 결정, R-4 의 종전 서술 정정, R-5 의 SPEC-DRIFT 정정, R-6 의 구현 승격 등 모든 결정 번복에는 이유가 수반되어 있으며, 과거 Rationale 에서 기각된 대안(sibling RerankConfig, embedding piggyback, 사용자 입력 bearer token, 자유 모델 입력 fallback 등)의 근거 없는 재도입은 발견되지 않는다. 단일 INFO 수준 지적 사항으로, §B.6.2 에서 rerank 연결 테스트 미제공의 이유 출처로 R-3 를 인용하고 있으나 R-3 는 이 정책의 근거 항목이 아닌 유지 나열이라 인용 앵커가 다소 오해를 유발한다 — 내용 자체는 body text 에서 올바르게 설명되고 있어 합의 원칙 위반이나 기각 대안 재도입은 아니다.

---

## 위험도

LOW
