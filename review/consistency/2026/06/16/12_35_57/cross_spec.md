# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/2-navigation/6-config.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-16

---

## 발견사항

### 충돌 없음 (주요 영역)

아래 항목들은 검토 과정에서 충돌이 없음을 확인한 영역이다.

1. **AuthConfig 데이터 모델** — target §A.2의 type별 config JSONB 스키마(`api_key`, `bearer_token`, `basic_auth`, `hmac`)와 `spec/1-data-model.md §2.17.1`의 정의가 완전 일치한다. 마스킹 정책(`***<last4>`) 참조도 §2.17.2를 SoT로 올바르게 포인터.

2. **ModelConfig 데이터 모델** — target Part B의 `kind`(chat/embedding/rerank), `dimension`, `is_default`(`(workspace_id, kind)` 당 1개) 정의가 `spec/1-data-model.md §2.16`과 일치한다. `KnowledgeBase.embedding_dimension` 파생 캐시 관계도 일치.

3. **AuthConfig 상태 전이** — `is_active` 필드, `last_used_at` 갱신 정책이 `spec/1-data-model.md §2.17`과 일치한다.

4. **Execution 집계 경로** — target §A.3의 `totalCalls`/`periodCounts`/`recentCalls`가 `Execution.trigger_id → Trigger.auth_config_id` 조인으로 산출한다는 서술이 `spec/1-data-model.md §2.13`의 "AuthConfig 호출 집계 경로 (SoT)" 주석과 일치한다.

5. **source_ip / response_code** — target §A.3 및 R-6의 `Execution.source_ip`(V096, VARCHAR 45)·`Execution.response_code`(V096, VARCHAR 10) 서술이 `spec/1-data-model.md §2.13`의 두 컬럼 정의와 완전 일치한다.

6. **LLM Client 프로바이더 집합** — target §B.2의 Chat 프로바이더(OpenAI/Anthropic/Google/Azure/Local), §B.5의 Embedding 프로바이더(OpenAI/Azure/Google/Local, Anthropic 미지원), §B.6의 Rerank 프로바이더(tei/cohere)가 `spec/5-system/7-llm-client.md §2`·§2.1의 정의와 일치한다.

7. **max_tokens 기본값 4096** — target §B.4 R-5의 4096 정정 주장을 검증하니, `spec/4-nodes/3-ai/1-ai-agent.md`의 `maxTokens` 예시값이 이미 4096으로 되어 있어 target이 요구하는 "동반 갱신"이 이미 완료된 상태로 일치한다.

8. **Webhook HMAC wiring** — target §R-2의 AuthConfig `hmac` type과 webhook HMAC 서명 검증 wiring이 `spec/5-system/12-webhook.md Rationale R-A` 포인터로 올바르게 참조된다.

---

### [WARNING] Model Config API 권한 서술의 역할 floor 모호성

- **target 위치**: `spec/2-navigation/6-config.md §3 "Model Config API"` — "mutation (POST / PATCH / DELETE) 은 Editor+ ([Spec 인증 §3.2])"
- **충돌 대상**: `spec/5-system/1-auth.md §3.2` 권한 매트릭스 — "Model Config: Owner CRUD / Admin CRUD / Editor CRUD / Viewer R"
- **상세**: target의 서술 자체는 `spec/5-system/1-auth.md §3.2`와 모순되지 않는다(Editor+ = Editor·Admin·Owner). 그러나 target이 §A의 Auth Config API(Admin+)와 §3의 Model Config API(Editor+)를 동일 섹션에 서술하면서, §A에서 쓴 "Admin+" 표현과 §3에서 쓴 "Editor+" 표현의 차이가 독자 혼란을 초래할 수 있다. spec/5-system/1-auth.md §3.2 주석("Model Config Editor CRUD 근거")이 이 의도적 차이를 명시하고 있으나, target 문서 내에는 이 근거 링크가 없다. 오독 시 "Model Config도 Admin+여야 하는 것 아닌가" 오해가 발생할 수 있다.
- **제안**: target §3 "Model Config API" 앞에 "Auth Config(Admin+)와 달리 Model Config는 Editor+이며, 근거는 [Spec 인증 §3.2 주석](../5-system/1-auth.md#32-리소스별-권한-매트릭스)"을 한 줄 명시하면 모호성 제거. 두 문서 간 충돌이 아닌 명시 부재이므로 WARNING으로 분류.

---

### [INFO] PATCH /api/model-configs/:id/set-default 의 HTTP method 선택

- **target 위치**: `spec/2-navigation/6-config.md §3 "Model Config API"` — `PATCH /api/model-configs/:id/set-default`
- **충돌 대상**: `spec/5-system/2-api-convention.md` (API 규약 — 검토 범위 외이나 API 명명 일관성 관점에서 언급)
- **상세**: POST가 아닌 PATCH를 사용한 것이 sub-resource path(`/set-default`)와 조합될 경우 일부 REST 컨벤션에서 POST가 더 자연스럽다는 견해가 있다. 그러나 `spec/1-data-model.md §2.16`의 `is_default partial unique` 설계와 target §3 설명("기존 is_default를 false로 초기화 후 대상만 true")은 일관되며, 다른 spec 영역에서 이 endpoint shape를 다르게 정의한 부분은 발견되지 않았다. INFO 수준으로만 기록.
- **제안**: 현행 유지 가능. 변경 필요 없음.

---

### [INFO] §A.4 Reveal 흐름에서 "현재 로그인 비밀번호" 재확인 — OAuth-only 사용자 예외 미언급

- **target 위치**: `spec/2-navigation/6-config.md §A.4 Reveal 흐름` — "현재 로그인 비밀번호 재확인 다이얼로그"
- **충돌 대상**: `spec/5-system/1-auth.md §1.1` — "OAuth 단독 가입 사용자는 `password_hash` = NULL"
- **상세**: target의 Reveal 흐름은 "현재 로그인 비밀번호 재확인"을 필수로 서술하나, OAuth-only 가입 사용자는 비밀번호가 없다. spec/5-system/1-auth.md §1.1.A가 "OAuth-only 사용자도 비밀번호 재설정으로 password_hash를 설정할 수 있다"고 하나, Reveal 흐름이 이 케이스에서 어떻게 동작하는지(예: 비밀번호 미설정 사용자에게 403 반환 vs 대체 확인 수단 제공 등)가 명시되지 않았다. 실무 구현에서 `password_hash IS NULL` 분기가 존재해야 하나 target 문서에 서술이 없다. 직접 모순은 아니지만 gap이다.
- **제안**: target §A.4 Reveal 흐름에 "OAuth-only 사용자(`password_hash IS NULL`)는 비밀번호 재확인 불가 → 403 반환 또는 비밀번호 설정 안내" 등 케이스를 명시하거나, `spec/5-system/1-auth.md §1.1.A`를 참조하도록 주석 추가. 충돌이 아닌 누락이므로 INFO.

---

## 요약

`spec/2-navigation/6-config.md`(target)는 다른 spec 영역과의 데이터 모델·API 계약·RBAC 매트릭스·상태 전이·엔티티 참조 관계에서 직접적인 모순을 갖지 않는다. AuthConfig·ModelConfig 엔티티 정의, 집계 경로, 마스킹 정책, 프로바이더 집합, max_tokens 기본값 모두 `spec/1-data-model.md`, `spec/5-system/1-auth.md`, `spec/5-system/7-llm-client.md`, `spec/4-nodes/3-ai/1-ai-agent.md`와 정합한다. 발견된 WARNING 1건(Model Config API 권한 역할 floor 모호성)은 두 문서 간 모순이 아닌 target 내 근거 링크 누락이며, INFO 2건은 edge case 미서술이다. CRITICAL 수준의 충돌은 없다.

---

## 위험도

LOW
