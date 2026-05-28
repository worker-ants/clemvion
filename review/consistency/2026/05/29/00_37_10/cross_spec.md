# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 문서: `spec/2-navigation/6-config.md`
검토 시각: 2026-05-29

---

## 발견사항

### 1. 충돌 없음 — 데이터 모델 일관성

- **[INFO]** AuthConfig 엔티티 정의 cross-reference 정합
  - target 위치: `spec/2-navigation/6-config.md §A.2`, `§A.4`, `§3 API`
  - 충돌 대상: `spec/1-data-model.md §2.17`, `§2.17.1`, `§2.17.2`
  - 상세: target 이 기술하는 4가지 type (`api_key` / `bearer_token` / `basic_auth` / `hmac`), config JSONB 스키마 (`wfk_<hex24>` / `wft_<hex32>` / `whs_<hex32>` prefix), 마스킹 규칙(`***<last4>`), 평문 노출 3경로(create / regenerate / reveal) 가 데이터 모델의 §2.17.1·§2.17.2 와 완전히 일치한다. target 이 명시적으로 "단일 진실은 §2.17.2" 를 포인트하고 있어 이중 정의 위험이 없다.
  - 제안: 현상 유지.

- **[INFO]** LLMConfig 엔티티 정의 cross-reference 정합
  - target 위치: `spec/2-navigation/6-config.md §B.2`, `§3 API`
  - 충돌 대상: `spec/1-data-model.md §2.16`
  - 상세: target 의 `default_model` 필드, `is_default` 불리언, API Key 암호화 저장 패턴이 데이터 모델과 일치한다. target 의 `provider` 드롭다운 옵션(OpenAI / Anthropic / Google AI / Azure OpenAI / Local) 은 데이터 모델 §2.16 의 `provider: String` 자유 문자열과 모순이 없다.
  - 제안: 현상 유지.

---

### 2. 충돌 없음 — API 계약 일관성

- **[INFO]** LLM Config API endpoint 정합
  - target 위치: `spec/2-navigation/6-config.md §3 LLM Config API`
  - 충돌 대상: `spec/5-system/7-llm-client.md §5.5`
  - 상세: target 의 `POST /api/llm-configs/preview-models` 엔드포인트는 LLM Client spec §5.5 와 동일한 경로·동작(저장 전 임시 클라이언트로 `listModels` 1회 호출)을 기술한다. target 이 "저장 전 폼 자격증명으로 모델 목록 미리보기" 라고 표현하는 것과 §5.5 의 "폼 자격증명 기반 preview" 가 일치한다.
  - 제안: 현상 유지.

- **[INFO]** 수정 플로우에서 기존 저장 모델 ID 처리 — LLM client spec 에 미반영
  - target 위치: `spec/2-navigation/6-config.md §B.2 수정 플로우`
  - 충돌 대상: `spec/5-system/7-llm-client.md §5.5`
  - 상세: target §B.2 는 "기존에 저장된 모델 ID 가 새로 불러온 목록에 없을 경우 placeholder option 을 노출" 하는 편집 UX 를 기술한다. 이 동작은 순수 프런트엔드 select 렌더링 로직이므로 백엔드 API 계약(`/llm-configs/:id/models` 응답 shape)에는 영향이 없다. 하지만 §5.5 는 이 UX 분기를 명시적으로 다루지 않는다. 구현 시 혼선이 없으려면 이 분기가 프런트엔드 책임임을 양쪽이 공유해야 한다.
  - 제안: INFO 수준 — 충돌은 아니므로 차단 불필요. 구현 착수 전 확인으로 충분.

---

### 3. 충돌 없음 — RBAC 모델 일관성

- **[INFO]** Reveal 권한 기술 일관성
  - target 위치: `spec/2-navigation/6-config.md §A.4 권한`, `§3 API /reveal 행`
  - 충돌 대상: `spec/5-system/1-auth.md §3.2 RBAC 매트릭스 (Auth Config Reveal ✅ Owner/Admin, — Editor/Viewer)`, `spec/1-data-model.md §2.17.2`
  - 상세: target 은 "Owner / Admin → Reveal 가능, Editor / Viewer → 403 FORBIDDEN" 을 기술하고, auth spec §3.2 매트릭스와 §2.17.2 의 "Admin+" 기준이 동일하다. 세 문서 모두 일관된 Admin+ 제한을 표현하고 있다.
  - 제안: 현상 유지.

- **[INFO]** Auth Config CRUD 권한 — Editor/Viewer Read-only
  - target 위치: 명시적 CRUD 권한 기술 없음
  - 충돌 대상: `spec/5-system/1-auth.md §3.2` (Auth Config: Owner/Admin=CRUD, Editor/Viewer=R)
  - 상세: target 은 화면 상의 "+ Add Auth Method" 버튼이 어느 역할에 표시되는지 기술하지 않는다. auth spec §3.2 에 따르면 Editor·Viewer 는 Read-only 라 이 버튼이 미표시여야 하지만, target 화면 구조(§A.1)에는 역할에 따른 버튼 가시성 제어가 명시되어 있지 않다. 구현 시 auth spec §3.2 를 준거로 삼아야 하지만 UI spec 의 명시가 없어 구현자가 놓칠 가능성이 있다.
  - 제안: WARNING 격상 검토 여부는 구현 착수 판단에 맡기되, 구현 시 `spec/5-system/1-auth.md §3.2` 의 Editor/Viewer=R 정책에 따라 CUD 버튼(Add / 재생성 / 삭제)을 숨겨야 함을 명심할 것.

---

### 4. 충돌 없음 — select-only 모델 선택 정책 일관성

- **[INFO]** select-only 정책이 knowledge-base spec 에도 반영 완료
  - target 위치: `spec/2-navigation/6-config.md §B.2 기본 모델 선택 UX`, `Rationale R-1`
  - 충돌 대상: `spec/2-navigation/5-knowledge-base.md §2.2`, `Rationale R-1`
  - 상세: target Rationale R-1 은 AI 노드(`spec/4-nodes/3-ai/1-ai-agent.md`)의 `model` 필드는 범위 외(Expression 허용 유지)라고 명시하고, 5-knowledge-base.md §2.2 는 동일 정책을 임베딩 모델에도 적용한다고 cross-reference 한다. 세 문서 간 범위 분리가 일관적으로 기술되어 있다.
  - 제안: 현상 유지.

---

### 5. 충돌 없음 — 계층 책임 일관성

- **[INFO]** LLM Config 삭제 엔드포인트 누락
  - target 위치: `spec/2-navigation/6-config.md §3 LLM Config API` — `DELETE /api/llm-configs/:id` 행 있음
  - 충돌 대상: `spec/5-system/7-llm-client.md` — 삭제 엔드포인트 미언급
  - 상세: target 의 API 표에 `DELETE /api/llm-configs/:id` 가 있고, LLM Client spec 은 삭제 경로를 명시하지 않는다. 두 문서의 관심사가 다르므로(UI spec vs 백엔드 LLM 클라이언트 구현) 충돌이 아니다.
  - 제안: 현상 유지.

- **[INFO]** `preview-models` 권한 — LLM Client spec `editor 이상` vs target 미언급
  - target 위치: `spec/2-navigation/6-config.md §3 LLM Config API preview-models 행` — 권한 기술 없음
  - 충돌 대상: `spec/5-system/7-llm-client.md §5.5` — "권한: editor 이상"
  - 상세: target API 표의 `POST /api/llm-configs/preview-models` 행에는 권한 제약이 기술되어 있지 않다. 다른 엔드포인트들도 target 에서 권한을 명시하지 않고 auth spec §3.2 를 암묵적 준거로 삼는 패턴이므로 충돌은 아니다. auth spec §3.2 는 LLM Config를 Owner/Admin=CRUD, Editor/Viewer=R 로 정의하는데 "editor 이상" 은 이 정의와 약간 다르다(Viewer 는 읽기만 가능하므로 preview 호출이 허용되지 않아야 하지만, §5.5 는 `editor 이상` 이라 Viewer 도 preview 불가임은 동일).
  - 제안: INFO 수준 — 실질 충돌 없음. 구현 시 §5.5 의 `editor 이상` 을 준거로 삼으면 된다.

---

## 요약

`spec/2-navigation/6-config.md` 는 데이터 모델(`spec/1-data-model.md §2.16–2.17`), RBAC 정책(`spec/5-system/1-auth.md §3.2`), LLM Client 백엔드 계약(`spec/5-system/7-llm-client.md §5.5`), 그리고 연관된 knowledge-base select-only 결정(`spec/2-navigation/5-knowledge-base.md §2.2`)과 직접적인 모순을 갖지 않는다. 모든 cross-reference 는 올바른 단일 진실(SoT)을 가리키고 있으며, 마스킹 정책·Reveal 권한·select-only 모델 선택·preview-models 엔드포인트의 정의가 다른 영역 spec 과 일관되게 기술되어 있다. INFO 등급의 관찰 사항으로, 화면 구조(§A.1)에 역할별 CUD 버튼 가시성이 명시되어 있지 않아 구현 시 auth spec §3.2 를 별도로 확인해야 하는 부분이 있으나, 이는 UI spec 이 RBAC 세부를 auth spec 에 위임하는 일반적인 패턴이므로 구현 착수를 차단할 이유는 없다.

## 위험도

NONE

---

STATUS: SUCCESS
