# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] [SPEC-DRIFT] `spec/2-navigation/6-config.md §B.3` — embedding probe embed 동작 미명시
- 위치: `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` L172-177
- 상세: 현행 §B.3 은 "간단한 API 호출(모델 목록 조회 등)로 연결 확인"만 기술하며 embedding 종류에 대한 probe embed 분기와 dimension 자동 감지·자동 저장 동작이 없다. 코드는 `config.kind === 'embedding'` 분기를 추가해 probe embed 로 연결을 검증하고 `dimension` 을 반환·저장하는 로직을 명확히 구현했다. 이는 의도적이고 합리적인 개선이며 되돌리는 것이 오답이다.
- 제안: 코드 유지 + spec 갱신. `plan/in-progress/spec-update-embedding-testconnection.md §3` 의 제안 변경("chat/embedding 분기 명시" 항목)을 `spec/2-navigation/6-config.md §B.3` 에 반영.

### [INFO] [SPEC-DRIFT] `spec/2-navigation/6-config.md §B.5` — dimension 행이 "수동 입력" 전제
- 위치: `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` L202
- 상세: §B.5 표의 `차원(dimension)` 행은 수동 입력 필드로 기술돼 있고 자동 감지·read-only 전환 동작이 없다. 코드(`model-config-form-dialog.tsx`)는 `editConfig?.dimension != null` 시 `readOnly` + hint 텍스트로 전환하는 UX 를 명확히 구현했다. 의도적 개선이며 spec 이 낡음.
- 제안: 코드 유지 + spec 갱신. `plan/in-progress/spec-update-embedding-testconnection.md §4` 의 `차원(dimension)` 행 교체 내용을 `spec/2-navigation/6-config.md §B.5` 에 반영.

### [INFO] [SPEC-DRIFT] `spec/5-system/7-llm-client.md §8.3` — 서비스 레이어 testConnection probe 전략 미기술
- 위치: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` L374, L412
- 상세: §8.3 은 "기존 chat / testConnection / resolveConfig 유지" 만 기술하며 embedding probe 전략(`client.embed(['connection test'], defaultModel)` + `vectors[0].length` dimension 추출), kind-agnostic `ModelConfigService.findEntity` 채택, 반환 타입 확장(`{ success, dimension? }`)이 반영돼 있지 않다. `LLMClient.testConnection()` 인터페이스(§3.1)는 불변이나 서비스 레이어 행동 spec 이 구현을 따라오지 못했다.
- 제안: 코드 유지 + spec 갱신. `plan/in-progress/spec-update-embedding-testconnection.md §1·§2` 의 `§8.3` 추가 및 Rationale 항목을 `spec/5-system/7-llm-client.md` 에 반영.

### [INFO] [SPEC-DRIFT] `spec/2-navigation/6-config.md §3 API 표` — test 엔드포인트 응답 shape 미기술
- 위치: `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` L276
- 상세: `POST /api/model-configs/:id/test` 행은 "연결 테스트 (chat/embedding 만 — rerank 미제공)" 만 기술하고 응답 shape(`{ success }` vs `{ success, dimension? }`)이 없다. 코드는 kind 별 응답을 명확히 구분한다.
- 제안: 코드 유지 + spec 갱신. `plan/in-progress/spec-update-embedding-testconnection.md §5` 의 API 표 보강 내용을 반영.

### [WARNING] rerank kind 가 testConnection 에 도달할 경우 spec 과 구현 간 암묵적 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/backend/src/modules/llm/llm.service.ts` L250-279, `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` L276, L242
- 상세: spec §B.6.2 와 §3 API 표는 "rerank 연결 테스트 미제공"을 명시하고 있다. 그러나 `LlmService.testConnection` 코드는 rerank 를 명시적으로 거부하지 않는다 — `config.kind === 'embedding'` 분기만 있고 rerank 는 `else`(chat 과 동일 경로인 `client.testConnection()`) 를 탄다. 실제로 spec 이 "연결 테스트 미제공"이라 하는 것은 UI 레벨(버튼 미노출)이고, API 레벨에서 rerank configId 로 호출하면 `client.testConnection()` 이 실행된다. 이것이 의도인지(UI 가드가 충분) 아니면 서비스 레이어에서도 방어가 필요한지 불명확하다. 추가된 테스트 `calls client.testConnection() for kind=rerank` 는 실제로 rerank 호출이 성공(`{ success: true }`)을 반환함을 검증한다 — spec 의 "미제공"과 구현 동작이 충돌할 수 있다.
- 제안: (a) spec 이 "UI 레벨 미노출, API 레벨은 허용"의 뜻이라면 spec 문구를 명확히 하고 코드는 현재대로 유지. (b) spec 이 "API 레벨도 차단"의 뜻이라면 `LlmService.testConnection` 에 `if (config.kind === 'rerank') return { success: false, error: '...' }` 또는 controller 레이어 가드를 추가. 판단은 `project-planner` 에게 위임 필요.

### [INFO] 빈 벡터 배열 엣지 케이스 처리 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/backend/src/modules/llm/llm.service.ts` L269-270
- 상세: `vectors[0]?.length` 가 0이거나 배열이 비어 있을 때 `dimension` 을 omit 하고 `{ success: true }` 만 반환하는 처리가 명확하다. 테스트 케이스 `returns success without dimension when probe embed yields empty vector` 가 `vectors = []` 케이스를 커버한다. 단, `vectors[0].length === 0` 케이스(빈 벡터가 존재하지만 길이가 0인 경우)는 falsy 처리로 omit 되는데, 이는 실제 임베딩 API 에서 발생하지 않는 경우이므로 INFO 수준이다.
- 제안: 현재 처리 수용 가능.

### [INFO] dimension 자동 저장 실패 시 silent 처리 — 비즈니스 로직 완전성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/components/models/model-config-manager.tsx` L435-439
- 상세: 연결 테스트 성공 후 `modelConfigsApi.update(config.id, { dimension: dim })` 실패를 catch 로 무시한다. 테스트 `still reports success when dimension auto-persist fails` 가 이를 커버한다. `plan/in-progress/spec-update-embedding-testconnection.md` 도 "자동 저장 실패는 best-effort" 로 명시한다. 비즈니스 규칙이 코드에 일관되게 반영됐다.
- 제안: 이상 없음.

### [INFO] dimension 동일 값 중복 저장 방지 로직
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/components/models/model-config-manager.tsx` L435
- 상세: `if (dim !== config.dimension)` 조건으로 기존 저장값과 동일할 때 PATCH 를 호출하지 않는다. 테스트 `does not persist when detected dimension equals stored dimension` 가 검증한다. 불필요한 API 호출 방지 로직이 올바르게 구현됐다.
- 제안: 이상 없음.

### [INFO] dimensionAutoDetected 판정 기준이 editConfig 기준 — 생성 모드 잠금 방지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/components/models/model-config-form-dialog.tsx` L65-67
- 상세: `editConfig?.dimension != null` 으로 저장된 설정의 dimension 존재 여부로 read-only 를 판정한다. 인라인 주석에 "live form 값이 아니라 저장된 editConfig 기준으로 판정해야 생성 모드에서 첫 입력에 필드가 잠기지 않는다"고 명확히 기술돼 있다. 테스트 `renders the dimension field read-only when editing a config that already has a dimension` 가 커버한다.
- 제안: 이상 없음.

### [INFO] i18n 키 양 언어 완전성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/lib/i18n/dict/en/models.ts`, `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/lib/i18n/dict/ko/models.ts`
- 상세: `dimensionAutoHint`, `dimensionManualHint`, `connectionSucceededDim` 세 키가 en/ko 양 파일에 모두 추가됐다. `connectionSucceededDim` 의 `{{dimension}}` 파라미터 치환 패턴도 양 언어에서 일치한다.
- 제안: 이상 없음.

---

## 요약

이번 변경은 embedding 설정의 연결 테스트에서 `MODEL_CONFIG_NOT_FOUND` 로 실패하던 회귀를 수정하고(`ModelConfigService.findEntity` kind-agnostic 전환), probe embed 로 `dimension` 을 자동 감지·저장하는 기능을 추가한 것이다. 핵심 기능(kind-agnostic 조회, embedding probe, dimension 자동 저장, read-only 폼 UX, i18n)은 완전하게 구현됐고, 엣지 케이스(빈 벡터, 저장 실패, 동일 값 중복 저장 방지)도 적절히 처리됐다. spec 관점에서는 `spec/2-navigation/6-config.md §B.3·§B.5·§3 API 표`와 `spec/5-system/7-llm-client.md §8.3` 이 구현보다 낡아 있는 SPEC-DRIFT 4건이 식별됐다 — 이는 코드가 틀린 것이 아니라 spec 이 따라오지 못한 것이며, `plan/in-progress/spec-update-embedding-testconnection.md` 에 이미 반영 draft 가 준비돼 있다. 유일한 WARNING 은 rerank kind 가 서비스 레이어 `testConnection` 에 도달했을 때의 동작(현재 chat 과 동일하게 `client.testConnection()` 호출)이 spec 의 "rerank 연결 테스트 미제공" 문구와 암묵적으로 충돌할 수 있다는 점이다 — UI 가드가 충분한지, API 레벨 방어도 필요한지 spec 소유자 판단이 필요하다.

## 위험도

LOW

STATUS: SUCCESS
