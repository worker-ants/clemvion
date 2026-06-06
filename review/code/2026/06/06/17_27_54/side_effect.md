# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 파일 1: e2e spec — DB 직접 insert 에서 REST API 호출로 교체 (의도된 부작용 범위 확대)
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` 라인 49~68 (diff 기준)
- 상세: 기존에는 `db.query(INSERT INTO llm_config ...)` 로 DB 에 직접 행을 삽입해 encryption 경로를 완전히 우회했다. 변경 후 `POST /api/llm-configs` REST 경로를 경유하므로, 이 테스트가 생성하는 부작용 범위가 확대된다 — 단순 DB 행 삽입 1건 대신 (a) 컨트롤러 → 서비스 → AES-256-GCM 암호화 → DB INSERT, (b) 인증·권한 검증, (c) 응답 봉투 언랩 처리까지 포함된다. 이는 의도된 변경(항목 ④의 목표)이지만 테스트 격리 관점에서는 이전보다 더 많은 외부 서비스 경로를 발동한다.
- 제안: 현재 코드는 적절하다. `expect(llmCreateRes.status).toBe(201)` 실패 시 명확한 오류가 나므로 디버깅 가시성도 향상됐다. 추가 조치 불필요.

### [INFO] 파일 1: 기존 전역 변수 없음 — `llmConfigId` 스코프가 테스트 블록 내부로 한정 유지
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: 기존 코드에서도 `llmConfigId` 는 `it(...)` 블록 내부의 `const` 로 선언되어 테스트 간 공유 상태 없음. 변경 후에도 동일 스코프 유지 — 전역 변수 도입 없음. `db`, `ownerToken`, `workspaceId` 는 `describe` 블록 공유 상태이지만 이는 기존과 동일하다.
- 제안: 이상 없음.

### [INFO] 파일 2: docker-compose.e2e.yml — `ENCRYPTION_KEY` 값 변경 (32-char → 64-hex)
- 위치: `docker-compose.e2e.yml` 라인 880~886 (diff 기준)
- 상세: `ENCRYPTION_KEY` 를 `0123456789abcdef0123456789abcdef`(32자=16 byte) 에서 `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`(64자=32 byte)로 변경했다. 이 변경의 부작용:
  1. **기존 e2e DB 데이터와의 비호환**: e2e DB 는 ephemeral(`make e2e-down` 시 volume 제거)이므로, 이전 키로 암호화된 행이 잔류할 가능성이 없다. 부작용 없음.
  2. **`INTEGRATION_ENCRYPTION_KEY`(32자)는 그대로 유지**: 주석에서 "SHA-256 fallback 이라 길이 무관"으로 설명. 두 키가 다른 포맷을 쓰는 것이 명확히 문서화됐다. 혼동 위험 있으나 기능상 부작용 없음.
  3. **Image 캐시 공유 worktree 간 환경 변수 공유 이슈**: 헤더 주석 "Image 캐시 공유" 섹션에 설명된 대로, 여러 worktree 가 같은 `backend-e2e/backend:latest` image 를 공유한다. 그러나 `ENCRYPTION_KEY` 는 `environment:` 섹션(런타임 env)이지 Dockerfile build arg 가 아니므로 image 에 포함되지 않는다. 따라서 다른 worktree 의 실행에 영향 없음.
- 제안: 이상 없음. 다만 `INTEGRATION_ENCRYPTION_KEY` 도 명시적으로 SHA-256 derive 임을 주석에 설명한 것이 적절한 문서화다.

### [INFO] 파일 3: plan 파일 신규 추가 — 부작용 없음
- 위치: `plan/in-progress/exec-park-b2a-followup.md`
- 상세: 신규 계획 문서 추가. 어떤 런타임 상태·전역 변수·공개 API·환경 변수도 변경하지 않는다.
- 제안: 이상 없음.

### [INFO] 파일 4: spec/5-system/14-external-interaction-api.md — §8.3·§10.1 문서 변경 (인터페이스 변경 아님)
- 위치: `spec/5-system/14-external-interaction-api.md` §8.3 및 §10.1
- 상세: 기존 "JWT HS256, secret 은 trigger 별 분리" 라는 문장을 `itk_*` vs `iext_*` 로 분리 설명하도록 명확화했다. 이는 코드 동작을 변경하지 않고 spec 이 기존 구현을 정확하게 반영하도록 수정한 것이다. 공개 API 시그니처, 환경 변수, 이벤트/콜백 변경 없음.
- 제안: 이상 없음.

### [INFO] 파일 5: spec/5-system/7-llm-client.md — §7.1 신규 섹션 추가 (문서 변경)
- 위치: `spec/5-system/7-llm-client.md` §7.1
- 상세: `LLM_STUB_MODE` 환경 변수의 동작(캐시/decrypt 우선순위, 프로덕션 차단)을 문서화하는 새 섹션 추가. 코드 변경이 아니므로 런타임 부작용 없음. 단, spec 이 환경 변수 `LLM_STUB_MODE` 를 처음으로 공식 문서화함으로써 이 env 의 존재가 spec SoT 에 등재된다.
- 제안: 이상 없음.

### [INFO] 파일 6: spec/data-flow/3-execution.md — 시퀀스 다이어그램 텍스트 2줄 변경 (문서 변경)
- 위치: `spec/data-flow/3-execution.md` 라인 51, 113 (diff 기준)
- 상세: `resume_call_stack` (V087) 을 park 단계 commit 목록과 rehydration 재구성 목록에 추가했다. 기존 코드(`conversation_thread`, `user_variables`) 에 `resume_call_stack` 을 문서에 추가한 것으로, 이미 구현된 기능(PR-B2b, V087)의 누락 문서를 보완한다. 런타임 동작 변경 없음.
- 제안: 이상 없음.

---

## 요약

총 6개 파일 변경 중 의도하지 않은 부작용은 발견되지 않았다. e2e 테스트 파일(파일 1)의 핵심 변경 — DB 직접 insert 우회 제거 → REST API 정식 경로 사용 — 은 테스트가 발동하는 부작용 범위를 의도적으로 확대하는 것으로, 이는 항목 ④의 명시된 목표와 일치한다. `docker-compose.e2e.yml` 의 `ENCRYPTION_KEY` 변경(32자 → 64자)은 ephemeral e2e DB 환경에서 안전하며, image 캐시 공유 메커니즘상 런타임 env 변경은 다른 worktree 에 전파되지 않는다. 나머지 4개 파일은 모두 spec/plan 문서 변경으로 런타임 부작용이 없다. 전역 변수 도입, 예상치 못한 파일시스템 조작, 시그니처 변경, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 어느 파일에서도 확인되지 않는다.

## 위험도

NONE
