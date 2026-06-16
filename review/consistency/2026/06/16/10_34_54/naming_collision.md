# 신규 식별자 충돌 Check — spec/2-navigation/6-config.md

## 발견사항

### 발견사항 없음 (에러 코드 교체 — 충돌 아님)

이번 diff 에서 식별자 관점의 실질 변경은 4종이다. 각각을 검토한다.

---

### [INFO] `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 교체 — 레이어 구분 명확

- **target 신규 식별자**: target 이 B.6.2 및 R-4 두 곳에서 `RERANK_CONFIG_INVALID` 를 `MODEL_CONFIG_INVALID` 로 교체했다.
- **기존 사용처**:
  - `spec/5-system/9-rag-search.md:339,368,374` — `RERANK_CONFIG_INVALID` 가 검색 실행(rerank 호출) 레이어 전용 에러로 여전히 존재한다.
  - `spec/5-system/9-rag-search.md:374` 에 "**에러 레이어 구분**: `RERANK_CONFIG_INVALID` 은 검색 실행(rerank 호출) 레이어 전용 에러이고, `MODEL_CONFIG_INVALID` / `MODEL_CONFIG_NOT_FOUND` 은 설정 CRUD(`/api/model-configs`) 레이어 전용이다." 라고 명시되어 있다.
  - `spec/5-system/3-error-handling.md:48` — `MODEL_CONFIG_INVALID` 는 설정 CRUD 레이어 전용으로 정의되어 있다.
- **상세**: target 이 교체한 맥락(B.6.2 rerank SSRF 가드 400 응답, R-4 cohere SSRF 차단)은 `/api/model-configs` CRUD 경로에서 발생하는 설정 검증 실패다. `9-rag-search.md` 의 `RERANK_CONFIG_INVALID` 는 검색 실행 시 rerank 설정이 미구성/미지원일 때 내부 진단용으로 쓰이는 별개 레이어다. 두 코드는 발행 레이어·발행 주체·HTTP 가시성이 다르며, `9-rag-search.md §374` 가 이미 레이어 분리를 선언하고 있다. 따라서 충돌이 아니다.
- **제안**: 교체 후 target(`MODEL_CONFIG_INVALID`) 과 `9-rag-search.md`(`RERANK_CONFIG_INVALID`) 의 레이어 구분이 유지되므로 추가 조치 불필요. 단, target(B.6.2 본문)에도 "SSRF 가드는 설정 CRUD 레이어(`MODEL_CONFIG_INVALID`)" 라는 괄호 주석이 있어 독자가 `9-rag-search.md §374` 의 레이어 구분 노트와 교차 확인 가능하다.

---

### [INFO] `LLM_MODEL_NOT_FOUND` — Planned 표기 추가 (신규 식별자 아님)

- **target 변경 내용**: R-1 에서 "`LLM_MODEL_NOT_FOUND` 로 실패한다" 를 "현재 클라이언트 계층은 `LLM_CONNECTION_ERROR` 로 수렴하며, 모델 미존재를 세분화한 `LLM_MODEL_NOT_FOUND`(404) 는 Planned" 로 교체했다.
- **기존 사용처**: `spec/5-system/7-llm-client.md:345` — 동일하게 "미구현(Planned)" 으로 표기하며 `LLM_CONNECTION_ERROR` 가 현재 실 발행 코드임을 명시한다.
- **상세**: 이번 변경은 기존에 구현 완료로 오해될 수 있던 문구를 7-llm-client.md 의 Planned 표기와 일치시킨 것이다. 신규 식별자 도입이 아니며, 기존 `LLM_MODEL_NOT_FOUND` 의 의미 변화도 없다.
- **제안**: 추가 조치 불필요.

---

### [INFO] Admin+ RBAC 기술 확장 — `useHasRole("admin")`, `@Roles('admin')`, `ROLE_LEVEL`

- **target 신규 식별자**: `useHasRole("admin")`, `@Roles('admin')`, `ROLE_LEVEL` 이 §A.4 권한·API 표 도입 단락에 추가됐다.
- **기존 사용처**:
  - `spec/2-navigation/9-user-profile.md:225,289` — 동일한 `useHasRole("admin")`, `ROLE_LEVEL` 을 같은 의미(Admin+ 이상 포함)로 사용 중이다.
  - `spec/data-flow/1-audit.md:134` — `@Roles('admin')` 동일 의미.
- **상세**: target 이 사용하는 이름·의미가 기존 사용처와 완전 일치한다. 새로운 의미가 도입되지 않았다.
- **제안**: 추가 조치 불필요.

---

### [INFO] 신규 R-2 bullet — "변경 액션 버튼 전체를 Admin+ UI 가드로 통일"

- **target 신규 식별자**: R-2 Rationale 절에 새 bullet 이 추가됐다.
- **기존 사용처**: R-2 ID 는 이전 버전부터 "AuthConfig 도메인 — Webhook 인증 wiring" 절이다. 새 bullet 은 기존 R-2 절 내부에 추가된 항목이며, ID 자체를 새로 부여한 것이 아니다.
- **상세**: 신규 Rationale ID 가 아니고 기존 절의 서술 확장이므로 ID 충돌 없음.
- **제안**: 추가 조치 불필요.

---

## 요약

target(`spec/2-navigation/6-config.md`) 이 이번 diff 에서 도입하거나 변경한 식별자는 모두 기존 spec 에서 이미 같은 의미로 사용 중인 것들이다. 가장 주목할 변경인 `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 교체는, `spec/5-system/9-rag-search.md` 에 `RERANK_CONFIG_INVALID` 가 검색 실행 레이어 전용으로 잔존하지만 해당 파일이 이미 두 레이어를 명시적으로 구분하고 있으므로 의미 충돌이 없다. 에러 코드 네임스페이스(`MODEL_CONFIG_*` = CRUD 레이어, `RERANK_*` = 검색 실행 레이어)는 일관되게 유지된다. 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 관점에서 신규 충돌은 발견되지 않았다.

## 위험도

NONE
