# Rationale 연속성 검토 결과

검토 범위: V-16/V-17 + ai-review fix (topK @IsInt, Update DTO JSDoc, Swagger §3.4 제거, ws→워크스페이스).
diff-base: origin/main. 변경 성격: 코드측 문서/검증 정정, spec 변경 없음.

---

## 발견사항

### 발견사항 없음 — 전 항목 정합

아래 변경 클러스터 각각에 대해 과거 Rationale 과의 충돌 여부를 점검했다.

---

#### 클러스터 A — `topK @IsInt` 및 `default: 5` 제거 (`rag-search.dto.ts`)

- target 위치: `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` — `@IsNumber()` → `@IsInt()`, `default: 5` 제거
- 과거 결정 출처: `spec/5-system/9-rag-search.md § Rationale` — "왜 `ragTopK` 기본값(5)을 제거(optional)했나" 항 및 §3.4 동적 점수 컷 도입(D1, 2026-06-06)
- 평가: spec Rationale 이 "D1 동적 컷 도입으로 '고정 기본 주입 수' 개념 자체가 사라진다 … 기본값 제거는 자연스러운 귀결"이라고 명시하며 `default` 제거를 합의된 결정으로 못 박았다. `@IsInt` 는 spec §3.4·§2.2 가 `top_k` 를 정수(integer) 계약으로 명시함에 따른 validator 정정이다(`@IsNumber()` 가 소수점 허용으로 계약보다 관대했던 오류). 두 변경 모두 합의된 설계 방향과 일치한다.
- 등급: 해당 없음 (충돌 없음)

---

#### 클러스터 B — `create-knowledge-base.dto.ts` / `update-knowledge-base.dto.ts` JSDoc 및 description 갱신

- target 위치: `rerankMode` description 에서 "후속 구현" 문구 제거, `cross_encoder_llm` 설명을 "조건부(conditional escalate) listwise LLM grading" 으로 갱신, `ws default` → `워크스페이스 default` 확장
- 과거 결정 출처: `spec/5-system/9-rag-search.md §3.3.2` 및 §Rationale "왜 D2 conditional escalate 를 지금 도입하나" 항 — 기존 v1 결정("항상 grading") 을 번복하고 conditional escalate 를 현행 v1 설계로 확정(2026-06-06 갱신). "후속 구현" 표기는 해당 결정 이전 상태.
- 평가: 기존 DTO JSDoc 의 "후속 구현" 및 "항상 grading" 표현은 spec 갱신 이전 초안 문구였다. spec Rationale 이 conditional escalate 를 v1 현행 결정으로 정식 채택하고 있으므로, 코드 문서를 spec 에 맞춰 정정하는 본 변경은 합의 원칙 위반이 아니라 오히려 정합 복원이다. `ws` 약어를 `워크스페이스` 로 확장한 것은 가독성 개선으로 spec 표현과 일치한다.
- 등급: 해당 없음 (충돌 없음)

---

#### 클러스터 C — `web-chat-sdk/README.md` 및 `byo-ui-headless.ts` — `firstMessage` → `profile`

- target 위치: `README.md` 코드 예제의 `{ firstMessage }` → `{ profile }`, `startHeadlessChat` 함수 시그니처의 `firstMessage: string` 파라미터 제거, 댓글로 §R6 참조 추가
- 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §R6` — "`firstMessage` 메커니즘은 폐기한다 … webhook payload 는 `profile` 만 싣는다 … 첫 사용자 텍스트도 일반 `submit_message` 로 보낸다" (전환 결정 채택, 사용자 2026-06-06). §R6 는 초기 lazy 모델(firstMessage 동봉) 이 명시적으로 기각된 대안임을 기록.
- 평가: spec R6 가 `firstMessage` 메커니즘 폐기와 `profile`-only webhook 을 합의된 설계로 확정했다. 코드 예제와 헬퍼 함수가 폐기된 `firstMessage` 를 그대로 유지하는 것이 오히려 기각된 lazy 모델 잔재였다. target 변경은 R6 결정을 코드 문서에 반영한 정합 복원이다.
- 등급: 해당 없음 (충돌 없음)

---

## 요약

이번 diff 의 모든 변경은 spec Rationale 에서 이미 합의·확정된 결정을 코드측 문서에 늦게 반영하는 정합 복원 성격이다. `topK` 의 `default: 5` 제거와 `@IsInt` 정정은 `spec/5-system/9-rag-search.md §Rationale` 의 D1 동적 컷·ragTopK 기본값 제거 결정과 일치하고, `cross_encoder_llm` 설명 갱신은 같은 spec §Rationale 의 "항상 grading → conditional escalate" 번복 결정(2026-06-06)을 반영한다. `firstMessage` → `profile` 변경은 `spec/7-channel-web-chat/1-widget-app.md §R6` 의 firstMessage 폐기·eager-start 채택 결정을 구현 예제에 적용한 것이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, 암묵적 invariant 충돌 중 어느 것도 발견되지 않았다.

## 위험도

NONE
