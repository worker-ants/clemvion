# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/2-navigation/6-config.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-16

---

## 발견사항

### [INFO] `LLM_MODEL_NOT_FOUND` 에러 코드 섹션 참조 오류

- **target 위치**: `spec/2-navigation/6-config.md §R-1` (기본 모델 선택 Rationale)
- **충돌 대상**: `spec/5-system/7-llm-client.md §6` (에러 처리)
- **상세**: target 의 R-1 에서 `LLM_MODEL_NOT_FOUND(404) 는 Planned — [LLM Client §5](../5-system/7-llm-client.md)` 라고 링크한다. 그러나 `spec/5-system/7-llm-client.md §5` 는 "5. 프로바이더별 매핑" 이며, `LLM_MODEL_NOT_FOUND` 를 Planned 코드로 열거한 절은 **§6 에러 처리** 다. 링크 앵커는 없고 텍스트 포인터만 `§5` 로 돼 있어 독자가 잘못된 섹션으로 유도된다.
- **제안**: `[LLM Client §5](../5-system/7-llm-client.md)` → `[LLM Client §6](../5-system/7-llm-client.md)` 로 섹션 번호 정정.

---

## 양호한 항목 (충돌 없음)

다음 교차-영역 항목은 검토 결과 모순 없이 일관적으로 정의돼 있다.

1. **RBAC — Model Config (Editor+)**: target §3 "mutation은 Editor+" ↔ `spec/5-system/1-auth.md §3.2` 권한 매트릭스 "Model Config | CRUD | CRUD | CRUD | R". 일치.

2. **RBAC — Auth Config (Admin+)**: target §3 "mutation은 Admin+" ↔ `spec/5-system/1-auth.md §3.2` "Auth Config | CRUD | CRUD | R | R". 일치. target §A.4 의 활성 토글(isActive)도 Update에 해당해 Admin+ 로 명시된 것도 동일 매트릭스에 근거가 있다.

3. **Auth Config Reveal 권한**: target §A.4 "Admin+ 만 노출, Editor·Viewer 는 403" ↔ `spec/5-system/1-auth.md §3.2` "Auth Config Reveal | ✅ Owner/Admin | ✅ Admin | — | —". 일치.

4. **Reveal audit 액션 (`auth_config.reveal`)**: target §A.4 에서 `audit_log`에 `action='auth_config.reveal'` 기록 ↔ `spec/5-system/1-auth.md §4.1` 구현된 액션 목록에 `auth_config.reveal` 포함. 일치.

5. **ModelConfig.dimension vs KnowledgeBase.embedding_dimension**: target §B.3·§B.5 "ModelConfig.dimension = SoT, KnowledgeBase.embedding_dimension = 파생 캐시" ↔ `spec/1-data-model.md §2.16` (`dimension: "SoT"`) · `§2.11` (`embedding_dimension: "파생 캐시"`). 일치.

6. **SSRF 가드 예외 규칙 (tei/local)**: target §B.6.2 "rerank 에선 `tei` 만 예외 — `local` 리랭커 provider 는 Dropped" ↔ `spec/5-system/7-llm-client.md §4.1` RerankClientFactory "rerank 에는 `local` provider 가 없다 — §2.1 Dropped", `§2.1` "Local Dropped(2026-06-05 결정)". 일치.

7. **ModelInfo.type 필터**: target §B.2 "`type === 'chat'` 모델만 노출", §B.5 "`type === 'embedding'` 모델만 노출" ↔ `spec/5-system/7-llm-client.md §3.5` `ModelInfo.type: 'chat' | 'embedding'`. rerank 가 `listModels` 를 쓰지 않는 것도 §B.6.2 "자유 입력" 및 LLM Client §2.1 Dropped 와 일치.

8. **preview-models 경로**: target §3 `POST /api/model-configs/preview-models` ↔ `spec/5-system/7-llm-client.md §5.5` 에서 동일 경로 정의. 일치.

9. **testConnection kind-agnostic 조회**: target §B.3 "설정 조회는 `ModelConfigService.findEntity`(kind 무관)" ↔ `spec/5-system/7-llm-client.md §8.3` "설정 조회는 `ModelConfigService.findEntity(configId, workspaceId)`(**kind 무관**)". 일치.

10. **LLM_MODEL_NOT_FOUND Planned 상태**: target §R-1 이 이 코드를 "Planned" 로 표기하고, `spec/5-system/7-llm-client.md §6` 도 동일하게 "미구현(Planned)" 로 표기. 현재 `LLM_CONNECTION_ERROR` 로 수렴한다는 설명도 일치.

11. **max_tokens 기본값 4096 (R-5)**: target §B.4·§R-5 에서 4096 으로 정정함. `spec/1-data-model.md §2.16` 의 `default_params` 필드는 "기본 파라미터 (temperature, max_tokens 등)" 만 정의하고 값을 고정하지 않아 충돌 없음.

---

## 요약

`spec/2-navigation/6-config.md` 는 데이터 모델(`spec/1-data-model.md §2.16·§2.17·§2.11·§2.13`), RBAC 매트릭스(`spec/5-system/1-auth.md §3.2`), LLM Client 에러·SSRF 규칙·팩토리 계층(`spec/5-system/7-llm-client.md`), 감사 로그 액션 목록(`spec/5-system/1-auth.md §4.1`)과 전반적으로 일관적이다. 단 §R-1 에서 `LLM_MODEL_NOT_FOUND` Planned 설명의 외부 링크가 LLM Client §5(프로바이더별 매핑)를 가리키고 있는데, 실제 해당 내용은 §6(에러 처리)에 있어 독자 네비게이션을 잘못 유도할 수 있다. 이는 단순 섹션 번호 오기이며 의미 충돌은 아니다.

---

## 위험도

LOW
