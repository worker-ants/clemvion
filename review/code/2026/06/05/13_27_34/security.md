# 보안(Security) 코드 리뷰

리뷰 일시: 2026-06-05
대상: rag-rerank-followup 브랜치 변경 (파일 17개)

---

## 발견사항

### [INFO] 리뷰 대상이 전부 spec·review 문서(Markdown)임 — 실행 가능 코드 없음

- 위치: 파일 1~17 전체
- 상세: 이번 diff 에 포함된 모든 파일은 `spec/**/*.md`, `review/**/*.md` 형태의 문서 파일이다. SQL, TypeScript, Python, 셸 스크립트 등 실행 가능한 코드는 한 줄도 포함되지 않는다. 따라서 인젝션, 하드코딩 시크릿, 암호화 알고리즘, 의존성 취약점 등 코드 수준 보안 점검 항목은 적용 대상이 없다.

---

### [INFO] API 키 마스킹 정책이 spec 에 명시됨 — 구현 의존

- 위치: `spec/2-navigation/6-config.md` §C.2 "마스킹" 항목
- 상세: `"저장 후 응답에서 api_key 는 항상 마스킹된다 (LLMConfig 와 동일 정책)"` 라는 명시가 추가됐다. Rerank Config 의 API 키 마스킹이 spec 상에서 요건으로 정의된 것은 긍정적이다. 보안 관점의 실질적 위험은 이 정책이 실제 구현체(`rerank-config.controller.ts` 또는 해당 서비스 레이어)에서 LLMConfig 와 동일하게 적용되고 있는지 여부에 있으나, 본 diff 에 구현 코드가 포함되어 있지 않아 직접 검증할 수 없다.
- 제안: 구현 코드 리뷰 시 `maskSensitiveFields` 또는 동등 로직이 RerankConfig 응답에 적용되는지 확인한다.

---

### [INFO] SSRF 가드 참조가 spec 에 포함됨 — 구현 의존

- 위치: `spec/2-navigation/6-config.md` §C.2 "Base URL" 필드 설명
- 상세: `"tei 필수 (SSRF 가드 — 사설망 예외, LLM Client §5.5)"` 가 명시됐다. RerankConfig 의 자가 호스팅 endpoint Base URL 에 SSRF 가드를 적용하는 것이 spec 수준에서 요건으로 정의된 것은 긍정적이다. 실질적 보안은 구현 코드에서 LLMConfig 의 SSRF 가드 인프라가 RerankConfig 에도 재사용되는지 여부에 달려 있다.
- 제안: 구현 리뷰 시 `rerank-config` 서비스의 URL 유효성 검사에 SSRF 가드가 실제로 활성화되어 있는지 확인한다.

---

### [INFO] Agent Memory 삭제 API — 워크스페이스 교차 차단 정책이 spec 에 명시됨

- 위치: `spec/5-system/17-agent-memory.md` §6 "격리" 항목
- 상세: `"단건 삭제도 WHERE id = $1 AND workspace_id = $ws 로 워크스페이스 교차 삭제를 차단한다 (다른 워크스페이스의 id 를 알아도 삭제 불가 → 404)"` 가 명시됐다. IDOR(Insecure Direct Object Reference) 방어 요건이 spec 에 명확히 기술된 것은 올바른 방향이다. 구현이 이 조건을 실제로 지키는지(단순 `WHERE id = $1` 만 사용하는 잘못된 구현이 없는지)는 구현 코드 리뷰 시 검증해야 한다.
- 제안: 구현 리뷰 시 `DELETE /agent-memories/:id` 쿼리에 `workspace_id` 조건이 포함되어 있는지 확인한다.

---

### [INFO] Rerank Config CRUD — 권한 매트릭스 명시

- 위치: `spec/5-system/1-auth.md` §3.2 권한 매트릭스 변경
- 상세: `Rerank Config | CRUD | CRUD | R | R` 행이 추가됐다. 인가 요건이 명확히 정의된 것은 긍정적이다. 구현 레이어에서 owner/admin 만 CRUD 를 실행하고 viewer 가 write API 를 직접 호출해도 403 이 반환되는지는 별도 구현 리뷰 범위다.

---

### [INFO] `conversation_thread` JSONB 컬럼에 민감 정보 포함 여부 주의

- 위치: `spec/1-data-model.md` §Execution 테이블 `conversation_thread` 컬럼 추가
- 상세: `"waiting_for_input park 진입 시 ExecutionContext.conversationThread 전체 스냅샷을 commit"` — 대화 스레드 전체가 DB JSONB 컬럼에 저장된다. spec 은 `_resumeState` 의 credential-strip 을 명시하고 있으나(`stripControlFields()`), `conversationThread` 에 사용자가 입력한 민감한 대화 내용(예: 비밀번호, 개인정보 포함 텍스트)이 plain JSONB 로 저장된다는 점은 저장소 접근 제어(DB 수준 암호화, 컬럼 수준 접근 제한) 관점에서 검토할 필요가 있다. 단 이는 신규 취약점이 아니라 기존 `NodeExecution.output_data` JSONB 와 동일한 보안 특성이다.
- 제안: 신규 컬럼이라 DB 암호화·접근 제어 정책이 기존 JSONB 컬럼과 동등하게 적용되는지 인프라 리뷰 시 확인한다.

---

## 요약

이번 변경은 전체가 spec 및 리뷰 산출물 문서(Markdown)로만 구성되어 있어 코드 수준 보안 취약점(인젝션, 하드코딩 시크릿, 안전하지 않은 암호화, 의존성 취약점 등)이 직접 도입될 여지가 없다. 보안 관점에서 주목할 변경은 세 가지다: (1) RerankConfig API 키 마스킹과 SSRF 가드 정책이 spec 에 명시됐으나 구현 코드가 이를 실제로 지키는지는 구현 리뷰 시 별도 검증이 필요하다. (2) Agent Memory 삭제 API 의 IDOR 방어(workspace_id 교차 차단) 요건이 spec 에 명확히 정의됐으나 구현 레이어 확인이 필요하다. (3) `Execution.conversation_thread` JSONB 컬럼에 대화 스냅샷 전체가 저장되므로 기존 JSONB 컬럼과 동등한 DB 수준 보안 정책이 적용되는지 확인한다. 문서 자체에서 CRITICAL 또는 HIGH 위험을 직접 유발하는 항목은 발견되지 않는다.

---

## 위험도

NONE
