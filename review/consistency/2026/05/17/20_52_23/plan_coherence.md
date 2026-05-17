### 발견사항

- **[INFO]** Target plan의 구현 대상 영역 메타데이터가 비어 있음
  - target 위치: prompt_file의 "Target 문서" 섹션 — `구현 대상 영역: cafe24-call-401-retry` 하위 `(없음)` 표기
  - 관련 plan: `plan/in-progress/cafe24-call-401-retry.md`
  - 상세: orchestrator가 target 문서로 `cafe24-call-401-retry` 식별자를 넘겼으나, diff/context가 수집되지 않아 target 섹션이 `(없음)`으로 비어 있다. plan 파일 자체는 존재하고 내용이 명확하므로, plan 파일을 직접 기준으로 정합성 점검을 진행한다.
  - 제안: orchestrator의 diff 수집 단계에서 plan 문서 범위가 포함되는지 확인 권장. 이번 체크는 plan 파일 내용을 직접 읽어 진행했으므로 분석에 영향 없음.

- **[INFO]** `spec-update-cafe24-call-401-retry.md`의 머지 의존성 선행 조건 미완료 상태
  - target 위치: `plan/in-progress/spec-update-cafe24-call-401-retry.md` §머지 의존성
  - 관련 plan: `plan/in-progress/spec-update-cafe24-test-connection.md` §머지 의존성
  - 상세: `spec-update-cafe24-call-401-retry.md`는 코드 PR(`cafe24-401-refresh-a3f2c1`) 머지 후 spec 갱신을 진행하도록 의존성을 명시하고 있다. 한편 `spec-update-cafe24-test-connection.md`도 같은 spec 파일(`spec/2-navigation/4-integration.md`)의 §5.8을 갱신 대상으로 삼고 있으며, 그쪽은 `cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f` 3개 worktree 머지 전 착수를 금지한다. `spec-update-cafe24-call-401-retry.md`의 갱신 대상은 §10.5로 섹션이 달라 직접 충돌 가능성은 낮으나, 두 spec 갱신 PR이 같은 파일에 동시에 열리면 충돌 리스크가 있다. plan에는 "두 갱신을 한 PR로 묶어도 자연스러움"이라는 단서가 있어 조율 가능성은 열려 있다.
  - 제안: spec 갱신 단계(project-planner)에서 `spec-update-cafe24-test-connection.md`의 머지 선행 조건이 해소된 후 두 갱신을 단일 PR로 묶는 것을 권장. 현 구현 PR 단계에서는 영향 없음.

- **[INFO]** `node-output-redesign/cafe24.md`와 target plan의 대상 파일 부분적 중첩
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` §갭 위치 — `cafe24-api.client.ts`의 `executeWithRateLimit()`
  - 관련 plan: `plan/in-progress/node-output-redesign/cafe24.md` §구현 분석 — `cafe24-api.client.ts`를 분석 대상으로 포함
  - 상세: `node-output-redesign/cafe24.md`는 `cafe24-api.client.ts`의 구현 분석을 포함하며, 아직 미처리 항목(`(spec)`, `(test)`, `(impl)` 체크박스)이 남아 있다. 그러나 이 plan의 개선안은 spec cursor 표기, 테스트 회귀 보강, sanitizeConfigEcho 검증 등이며, `executeWithRateLimit()`의 401 분기 로직을 직접 수정하는 내용은 없다. 따라서 코드 변경 영역 충돌은 없고 분석 중첩에 그친다. `node-output-redesign/cafe24.md`에 `cafe24-401-refresh-a3f2c1` worktree의 frontmatter가 없고, README.md의 worktree 필드도 별도 워크트리를 명시하지 않는다.
  - 제안: 현 target plan 작업 완료 후, `node-output-redesign/cafe24.md`의 §구현 분석 §4의 "401/403 → `Integration.status` 자동 전이" 설명이 자동 회복 패턴 도입 후에도 여전히 정확한지 확인 권장.

- **[INFO]** `cafe24-oauth-invalid-scope-handler.md`의 `markAuthFailed` 참조와 target plan의 403 분기 동작
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` §비목표 — "403 분기 동작 변경" 금지 명시
  - 관련 plan: `plan/in-progress/cafe24-oauth-invalid-scope-handler.md` — `cafe24-api.client.ts markAuthFailed`의 `requiresCafe24Approval` 추가 언급
  - 상세: `cafe24-oauth-invalid-scope-handler.md`는 향후 `markAuthFailed`에 `requiresCafe24Approval` 인자를 추가할 예정임을 언급하고 있다. target plan은 403 분기를 변경하지 않는다고 명시했으므로 직접 충돌은 없으나, target PR이 `markAuthFailed` 호출 경로를 손대면 향후 `requiresCafe24Approval` 추가 시 merge 복잡도가 생길 수 있다. target plan의 403 비목표 명시가 이 리스크를 사전에 차단하고 있다.
  - 제안: target PR의 401 retry helper가 403 분기를 bypass하는 구조임을 PR description에 명시하면, 이후 `cafe24-oauth-invalid-scope-handler.md` 진행자가 충돌 없이 진입할 수 있다.

- **[INFO]** `20260516-full-review/RESOLUTION.md`의 deferred 항목 C-12와 target plan의 관계
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` §비목표 — `cafe24-backlog-residual.md B-5-8 alt`와 무관 명시
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` §의사결정 보류 C-12 — "Cafe24 OAuth callback/refresh e2e — HTTP stub 컨테이너 추가가 e2e 인프라 변경 사안"
  - 상세: target plan은 `refreshAccessToken`을 통한 토큰 갱신 경로를 unit 테스트(T-1~T-5)로 커버한다. full-review C-12는 e2e 인프라 변경이 필요한 OAuth callback/BullMQ refresh e2e를 지칭하며 target plan과 범위가 다르다. target plan의 단위 테스트가 부분적으로 B-5-8 alt의 필요성을 완화할 수 있으나 plan 간 명시적 연결이 없다.
  - 제안: target plan 완료 후, `cafe24-backlog-residual.md` B-5-8 alt의 시나리오 (b) `callback invalid_grant → error(auth_failed) 전이`가 target의 T-3와 중첩되는지 확인하고, 중복 시 B-5-8 항목을 부분 체크 처리하면 추적 정확도가 올라간다.

### 요약

`cafe24-call-401-retry` target plan은 `cafe24-api.client.ts`의 `executeWithRateLimit()` 401 분기에 한정된 단일 목적 구현으로, plan에 선언된 비목표(403 변경 금지, spec 직접 수정 금지, rate-limit 429 변경 금지)가 명확히 경계를 설정하고 있다. 현재 in-progress plan들과의 CRITICAL 충돌(미해결 결정 우회, 동일 코드 영역의 동시 worktree 수정)은 발견되지 않는다. spec 갱신 위임(`spec-update-cafe24-call-401-retry.md`)이 `spec-update-cafe24-test-connection.md`와 같은 spec 파일의 다른 섹션을 대상으로 하는 잠재 중첩이 있으나, 두 plan 모두 직렬화 의도가 기술되어 있고 "한 PR로 묶는 것이 자연스럽다"는 단서가 있어 WARNING 수준에 미치지 않는다. 전반적으로 plan 정합성은 양호하다.

### 위험도
LOW
