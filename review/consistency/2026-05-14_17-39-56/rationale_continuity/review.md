충분한 정보를 수집했습니다. 분석 결과를 작성합니다.

---

## 발견사항

### **[WARNING] `spec/4-nodes/4-integration/4-cafe24.md` §6 auto-delete 전이가 draft 에서 누락됨**

- **target 위치**: DRAFT의 "영향받는 연관 문서" 목록 (`spec/4-nodes/4-integration/4-cafe24.md` §9.4, §9.8, §337, §10 CHANGELOG) — §6 없음
- **과거 결정 출처**: `spec/4-nodes/4-integration/4-cafe24.md` §6 상태 전이 (현행)
  ```
  └── install timeout / manual delete ──▶ (삭제)
  ```
- **상세**: DRAFT 2D 는 `spec/2-navigation/4-integration.md` §6 의 `→ (삭제)` 화살표를 `→ [expired]` 로 번복하며 "번복 acknowledgment" 를 명시한다. 그러나 `spec/4-nodes/4-integration/4-cafe24.md` 의 §6 상태 전이에도 동일한 `install timeout / manual delete ──▶ (삭제)` 경로가 현존하며, 이 파일은 draft 의 패치 대상에서 누락되었다. 적용 후 두 spec 이 **동일 상태 전이를 서로 다른 결론** (expired vs. 삭제) 으로 묘사하게 된다.
- **제안**: 영향받는 연관 문서에 `spec/4-nodes/4-integration/4-cafe24.md` §6 를 추가하고, DRAFT 2J 에 §6 상태 전이 다이어그램 및 전이 표 갱신 항목을 포함시킨다.

---

### **[WARNING] `spec/4-nodes/4-integration/4-cafe24.md` 에 Rationale 부재 — 번복 근거가 타 파일에만 존재**

- **target 위치**: DRAFT 2J-2 (`spec/4-nodes/4-integration/4-cafe24.md` §9.8 "식별 전략" 갱신)
- **과거 결정 출처**: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 (현행 본문 내 암묵적 Rationale):
  > "HMAC 이 `client_secret` 에 묶여 있어, 같은 `mall_id` 에 복수의 `pending_install` Integration 이 있어도 HMAC 검증을 통과한 것이 정확한 타깃이다."
- **상세**: 이 문장은 in-memory 100건 스캔 + trial HMAC 방식의 설계 근거다. Draft 는 이를 "install_token 단일 row 조회" 로 번복하고 새 Rationale 를 `spec/2-navigation/4-integration.md` 의 새 `## Rationale` 섹션(DRAFT 2I) 에 기록한다. 그러나 `spec/4-nodes/4-integration/4-cafe24.md` 자체에는 `## Rationale` 섹션이 없고 CHANGELOG 만으로 처리된다. `4-cafe24.md` 만 읽는 구현자는 왜 식별 전략이 바뀌었는지 이 파일 내에서 추적할 수 없다. 프로젝트 공통 규약("아키텍처 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale` 섹션")에도 어긋난다.
- **제안**: DRAFT 2J 에 `spec/4-nodes/4-integration/4-cafe24.md` 의 `## Rationale` 섹션 신설을 추가한다. 최소한 "식별 전략 변경 이유는 `spec/2-navigation/4-integration.md` ## Rationale '식별 키 승격' 항목 참조" 형식의 cross-reference 를 넣어 설계 의도가 단절되지 않도록 한다.

---

### **[INFO] `install_token` 의 암호화 대상 여부가 기존 Rationale 와 명시적으로 대비되지 않음**

- **target 위치**: DRAFT 1B (`install_token` 컬럼 정의), DRAFT 3D (`spec/data-flow/integration.md` §2.1 갱신)
- **과거 결정 출처**: `spec/data-flow/integration.md` ## Rationale — "`credentials` JSONB AES 암호화" 및 "`last_error` 도 암호화"
- **상세**: 기존 Rationale 는 "DB dump / replica 노출 시 외부 시스템 자격증명이 새어 나간다" 는 이유로 credentials 와 last_error 를 AES 암호화 대상으로 명시한다. `install_token` 은 32바이트 random hex 로 App URL path 에 노출되는 퍼블릭 식별자이므로 평문 저장이 맞지만, 이 판단이 draft Rationale 2I 에 없다. 구현자가 "민감 필드 암호화" 원칙을 기계적으로 적용해 install_token 까지 암호화할 경우 install_token 인덱스 기반 단일 row 조회가 불가해진다.
- **제안**: DRAFT 2I 또는 DRAFT 3D 텍스트 보강에 "`install_token` 은 App URL path 에 공개 포함되는 식별자로 평문 저장 — credentials/last_error 의 암호화 정책 대상이 아님" 한 줄을 추가한다.

---

### **[INFO] `status_reason` 확장과 `last_error` 암호화 정책의 관계 미언급**

- **target 위치**: DRAFT 1C (`status_reason` 행 replace), DRAFT 2I Rationale
- **과거 결정 출처**: `spec/data-flow/integration.md` ## Rationale — "`last_error` 도 암호화"
- **상세**: Draft 2I Rationale 는 "`last_error` 와 `status_reason` 이 같은 값을 중복 보존하는 이유" 를 설명하며 "status_reason 은 plain string 컬럼으로 더 가볍게 유지된다" 고 언급한다. 그러나 기존 Rationale 에서 last_error 가 암호화 대상인 이유("OAuth 응답 본문에 token 일부 포함 가능")를 status_reason 이 평문 저장인 이유와 대비해 설명하지 않는다. status_reason 의 분기 코드 값 (`oauth_token_exchange_failed` 등) 이 token 정보를 포함하지 않음을 근거로 명시하면 설계 연속성이 더 명확해진다.
- **제안**: DRAFT 2I Rationale 의 "`last_error.code` 와 `status_reason` 중복 보존 이유" 단락에 "status_reason 은 에러 분류 코드(snake_case)만 담아 민감 정보를 포함하지 않으므로 평문 저장" 한 줄을 추가한다.

---

## 요약

Draft 의 주요 번복 결정(install timeout → expired 전환, install_token path 식별, error code 분리)은 모두 DRAFT 2I 에 명시적 Rationale 를 갖추고 있어 **의사결정 연속성이 전반적으로 양호하다**. 다만 `spec/4-nodes/4-integration/4-cafe24.md` §6 의 `→ (삭제)` 전이가 패치 대상에서 누락되어 적용 후 두 spec 이 같은 상태 전이를 다른 결론으로 묘사하게 되는 점이 가장 중요한 미비다. 또한 번복 Rationale 가 `4-integration.md` 에만 신설되고 `4-cafe24.md` 에는 없어, 이 파일을 단독으로 참조하는 개발자가 설계 배경을 추적하지 못하는 문제가 WARNING 수준으로 존재한다.

## 위험도

**MEDIUM** — Critical 위배는 없으나, `4-cafe24.md` §6 누락으로 인한 spec 간 상태 전이 불일치가 구현 단계에서 혼란을 일으킬 수 있다.