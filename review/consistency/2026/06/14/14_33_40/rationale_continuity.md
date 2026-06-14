# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 문서: `spec/2-navigation/6-config.md`

---

## 발견사항

### 발견사항 없음 — Rationale 연속성 관점의 충돌 없음

`spec/2-navigation/6-config.md` 는 관련 Rationale 들과의 충돌이 없다. 상세 점검 결과:

**[INFO] R-3 (번복) 의 명시적 폐기 선언 — 적절히 처리됨**
- target 위치: `spec/2-navigation/6-config.md §B (Part B: Models)` 서두, `## Rationale R-3`
- 과거 결정 출처: 구 결정 — RerankConfig/LLMConfig 분리 sibling 리소스 + KB 내 piggyback embedding
- 상세: target 은 구 결정을 "이전 결정(폐기)" 로 명시하고, 번복 근거(공유 인프라·중복 CRUD·설정 화면 3곳 분산)를 R-3 에 명문화했다. 엔티티 통합 근거의 단일 진실은 `spec/1-data-model.md §2.16 Rationale` 로 위임 — 번복 절차가 올바르다.
- 제안: 없음. 이미 적절히 처리됨.

**[INFO] R-1 (select-only) — Rerank 탭 자유 입력 예외와의 관계**
- target 위치: `spec/2-navigation/6-config.md §B.6.2` ("기본 모델 | 기본 리랭커 모델 ID 자유 입력"), `## Rationale R-1` 본문 ("범위 한정: 본 변경은 Config > Models (Chat 탭)의 `defaultModel` 필드에만 적용")
- 과거 결정 출처: `## Rationale R-1` — "잘못된 모델 ID 가 저장되면 런타임 실패. select-only 로 강제해 구조적 차단"
- 상세: Rerank 탭은 표준 model-list API 가 없어 select 제공이 불가능하므로 자유 입력 예외가 불가피하다. R-1 이 명시적으로 "범위 한정: Chat 탭 `defaultModel` 에만 적용" 이라 선언해, 원칙이 Rerank 에 적용 안 되는 이유를 spec 본문에서 설명하고 있다. LLM 클라이언트 spec(`spec/5-system/7-llm-client.md §2.1`) 의 "리랭커는 표준 model-list API 없음" 결정과 일치.
- 제안: 없음. 예외 이유가 본문에 충분히 설명됨.

**[INFO] A.3 호출 이력 — 소스 IP/응답 코드 "Planned" 표기**
- target 위치: `spec/2-navigation/6-config.md §A.3` 표
- 과거 결정 출처: 해당 항목에 대한 Rationale 미존재 (plan/in-progress/spec-sync-config-gaps.md 에서 "결정 필요" 로 추적 중)
- 상세: 소스 IP·응답 코드 컬럼이 "Planned" 로 표기됐고, plan 파일이 "스키마·캡처 경로 결정 선행" 이라고 명시하고 있다. 이는 기각된 결정이 아니라 미결정 상태이며, 어떤 Rationale 의 합의 원칙도 위반하지 않는다. (webhook spec `WH-MG-05` 는 응답 코드 확인을 요구사항으로 명시하나, 본 config 화면의 구현 상태 추적일 뿐 충돌 아님.)
- 제안: 소스 IP/응답 코드 스키마 결정이 완료되면 §A.3 의 "Planned" 를 해제하고 Rationale 에 결정 근거(저장 위치·데이터 보존 정책)를 추가.

**[INFO] R-4 (cohere Base URL UI 미노출 + API optional) — 변경 이전 서술 정정**
- target 위치: `spec/2-navigation/6-config.md § B.6.2`, `## Rationale R-4`
- 과거 결정 출처: 구 spec 서술 — "cohere 는 Base URL 을 받지 않는다 — 공식 endpoint 고정"
- 상세: R-4 는 구 서술이 UI 기준으로만 맞고 API 계약과 불일치했음을 명시하고, UI 미노출/API optional override 로 정정했다. SSRF 가드 적용 여부도 명시. 기존 LLM 클라이언트 spec(`spec/5-system/7-llm-client.md §SSRF 가드`)의 "cohere baseUrl 선택 — 생략 시 기본 endpoint" 와 일치한다.
- 제안: 없음. 기존 코드 SoT 와 정합.

---

## 요약

`spec/2-navigation/6-config.md` 는 관련 Rationale 들과 충돌하지 않는다. 가장 중요한 번복(R-3 — ModelConfig 단일 화면 통합)은 "이전 결정(폐기)" 라는 명시적 표기와 함께 번복 근거를 R-3 에 직접 작성했으며, 엔티티 통합 근거의 단일 진실을 `spec/1-data-model.md §2.16` 로 위임해 Rationale 연속성 원칙을 준수했다. select-only 정책(R-1)의 Rerank 예외는 "범위 한정" 선언으로 충돌 없이 격리됐고, AuthConfig inline auth 폐기(`spec/5-system/12-webhook.md Rationale`) 및 SSRF 가드 재사용(LLM 클라이언트 spec) 과의 정합도 유지된다. 소스 IP·응답 코드 컬럼의 "Planned" 표기는 기각된 대안이 아닌 미결정 상태이며, plan 파일(`plan/in-progress/spec-sync-config-gaps.md`)이 별도 추적 중이다.

---

## 위험도

NONE
