# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md` (구현 완료 후 검토, --impl-done)
실제 변경 범위: `codebase/backend/test/execution-park-resume.e2e-spec.ts` (spec 파일 자체 변경 없음)
diff-base: `origin/main`

---

## 발견사항

### 발견사항 없음 — 충돌 부재

분석 대상 diff 는 e2e 테스트 파일 1건만 수정한다. 변경 내용은 다음과 같다.

**변경 전**: `execution-park-resume.e2e-spec.ts` 내 `llm_config` 테이블에 직접 SQL INSERT 로 LLM 설정 row 를 생성 (DB 우회 경로, `ENCRYPTION_KEY` 포맷 불일치로 인한 API 경로 회피).

**변경 후**: `POST /api/llm-configs` REST API 를 정식 경로로 호출하고 `201 Created` + `{ data: { id } }` 응답을 검증한다.

아래 6개 관점에서 전수 점검하였으며 충돌 없음을 확인했다.

**1. 데이터 모델 충돌**

테스트가 보내는 request body 필드 (`provider`, `name`, `apiKey`, `defaultModel`, `defaultParams`, `isDefault`) 는 `spec/1-data-model.md §2.16 LLMConfig` 엔티티 정의 (`provider`, `name`, `api_key`, `default_model`, `default_params`, `is_default`) 와 대응하며, `CreateLlmConfigDto` (`codebase/backend/src/modules/llm-config/dto/create-llm-config.dto.ts`) 의 camelCase 필드와 일치한다. 모순 없음.

**2. API 계약 충돌**

`POST /api/llm-configs` 는 `spec/2-navigation/6-config.md §API` 에 명시된 엔드포인트. 응답 코드 `201` 은 `spec/5-system/2-api-convention.md §6 HTTP 상태 코드` 의 "201 — 생성 성공" 규칙과 일치. 응답 shape `{ data: { id } }` 는 `TransformInterceptor` 래핑 규약 (`spec/5-system/2-api-convention.md §5.1`) 과 일치. 모순 없음.

**3. 요구사항 ID 충돌**

diff 내 신규 요구사항 ID 부여 없음.

**4. 상태 전이 충돌**

변경은 LLM 설정 생성에만 관여하며, `LlmConfig` 엔티티에는 상태 머신이 없다. `Execution` / `NodeExecution` 상태 전이와 무관. 모순 없음.

**5. 권한·RBAC 모델 충돌**

테스트는 `ownerToken` (`Authorization: Bearer ${ownerToken}`) + `X-Workspace-Id` 로 호출한다. `spec/2-navigation/6-config.md §API` 는 llm-config mutation 이 Editor+ 권한을 요구하고 Owner 는 Editor 이상이므로 정합. 모순 없음.

**6. 계층 책임 충돌**

변경은 테스트가 API 표면을 직접 호출하도록 개선한 것이며, 기존 DB 직접 접근을 제거함으로써 오히려 spec 계층 규약(E2E 테스트는 공개 API 경유 원칙)에 더 부합하게 되었다. 모순 없음.

---

## 요약

이번 diff 는 `exec-park-resume.e2e-spec.ts` 의 테스트 픽스처 준비 방식을 DB 직접 INSERT 에서 정식 `POST /api/llm-configs` API 호출로 교체한 것으로, spec 파일 자체를 변경하지 않는다. 변경된 request body 필드명·응답 코드·응답 shape 모두 `spec/1-data-model.md`, `spec/2-navigation/6-config.md`, `spec/5-system/2-api-convention.md` 와 완전히 일치하며, 다른 spec 영역과의 직접 모순·잠재 충돌·명명 비일관성을 포함해 어떤 cross-spec 문제도 발견되지 않았다.

---

## 위험도

NONE
