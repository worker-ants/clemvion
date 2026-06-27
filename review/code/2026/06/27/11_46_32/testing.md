# Testing Review

## 발견사항

### [WARNING] e2e 케이스 H 에 `preview-models` Editor+ 게이트 검증 누락
- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 케이스 H (추가된 블록 전체)
- 상세: 케이스 H 의 제목과 코드 주석이 "spec §3·R-7" 을 SoT 로 명시한다. R-7 은 `:id/test` 와 `preview-models` 두 action-POST 모두를 Editor+ 로 묶는다. 그러나 e2e H 는 `:id/test`(viewer→403 / editor→200) 와 `:id/models`(viewer→404) 만 검증하고 `POST /api/model-configs/preview-models` viewer→403 은 포함하지 않는다. `previewModels` 의 `@Roles('editor')` 데코레이터는 이전 PR 에서 이미 부착된 pre-existing 가드이므로 이 PR 의 직접 변경 범위는 아니다. 그러나 케이스 H 가 spec §3·R-7 의 전체 인가 계약을 커버하는 테스트로 읽히는 상황에서, `preview-models` 가드가 추후 실수로 제거되더라도 이 e2e 에서 잡히지 않는다. 단위 테스트(`previewModels method has 'editor' role metadata`)는 메타데이터 레벨에서만 확인하고 실 HTTP 차단을 검증하지 않는다.
- 제안: 케이스 H 에 `POST /api/model-configs/preview-models` viewer→403 단언을 추가한다. `preview-models` 는 body(dto) 가 필요하므로 `.send({ provider: 'openai', apiKey: 'sk-test' })` 형태로 전달하면 된다. 가드는 핸들러보다 먼저 실행되므로 실제 provider 호출 없이 viewer 에게 403 이 반환된다.

---

### [WARNING] e2e `editorTest.body.data.success` 단언이 내부 에러 처리 로직에 결합
- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:409–410` (`expect(editorTest.body.data.success).toBe(false)`)
- 상세: 이 단언은 "존재하지 않는 UUID 로 `testConnection` 을 호출했을 때 내부 catch 가 NotFound 를 흡수하고 `{ success: false }` 를 반환한다"는 구현 세부사항에 의존한다. 목적이 "authz 가드 통과 검증"이라면 `expect(editorTest.status).not.toBe(403)` + `expect(editorTest.status).toBe(200)` 만으로 충분하다. 만약 `LlmService.testConnection` 이 미존재 설정에 대해 404 를 throw 하도록 에러 처리가 변경된다면, authz 와 무관한 이유로 이 단언이 깨진다. 주석(`200 자체가 역할 가드 통과의 증거`)이 이를 인지하고 있으나 body 단언이 그 의도를 넘어선 결합을 만든다.
- 제안: `expect(editorTest.body.data.success).toBe(false)` 를 제거하거나, 주석으로 "구현 의존 단언: testConnection best-effort 정책(미존재→200{success:false}) 검증 — authz 단언이 아님" 을 명시해 의도를 구분한다.

---

### [INFO] `preview-models` 에 대한 e2e `owner` 계층 긍정 경로 미포함 (완성도)
- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 케이스 H
- 상세: 케이스 H 는 viewer(1) →403 / editor(2) →pass 계층을 검증하지만 admin(3) 또는 owner(4) 의 통과 여부는 테스트하지 않는다. `ROLE_HIERARCHY` 에서 admin/owner 는 editor 보다 높으므로 자동 통과된다. 별도 RBAC 케이스들(C·D·E)이 `workspacesService.getMemberRole` 의 계층 로직을 커버하고 있으므로 여기서 중복 검증할 필요는 낮다. 완성도 관점에서만 언급한다.
- 제안: 낮은 우선순위. 현행 커버리지로 충분하다고 판단되면 생략 가능.

---

### [INFO] `X-Workspace-Id` 헤더 미전송 시 RolesGuard 거부 경로 테스트 없음
- 위치: `codebase/backend/src/common/guards/roles.guard.ts:64` (`if (!workspaceId) return false`)
- 상세: `RolesGuard` 는 workspaceId 를 특정할 수 없을 때 false 를 반환해 거부한다. 이 경로를 검증하는 단위 테스트나 e2e 가 이 PR 의 변경 범위에 없다. 기존 RBAC 테스트에서도 해당 경로를 명시적으로 다루지 않는다. 이 PR 의 `testConnection` authz 추가와 직접 관련은 낮지만, 가드의 완전한 동작 명세 차원에서 갭이다.
- 제안: 별건 개선 사항으로 RolesGuard 전용 단위 테스트(`roles.guard.spec.ts`)가 없다면 추후 생성 시 workspaceId 미전달 케이스를 포함한다.

---

## 요약

이번 변경의 핵심인 `testConnection`에 `@Roles('editor')` 추가와 `listModels` Viewer+ 유지는 세 계층(메타데이터 단위 테스트, 위임 단위 테스트, e2e RBAC 통합 테스트)에 걸쳐 적절히 검증된다. 단위 테스트의 `Reflect.getMetadata` 패턴은 NestJS 데코레이터 검증의 관용적 방식이며, `beforeEach` 에서 독립적으로 mock 이 초기화되어 테스트 격리도 양호하다. e2e 케이스 H 는 "존재하지 않는 UUID + 가드 선실행" 전략을 통해 실 provider 호출 없이 authz 게이트를 검증하는 영리한 설계다. 다만 케이스 H 가 R-7 전체 계약(test + preview-models 두 action-POST)을 명시적으로 참조하면서 `preview-models` viewer→403 e2e 는 누락되어 spec-referenced 커버리지에 갭이 있고, `editorTest` 의 body 단언이 내부 에러 처리 구현에 결합된 점은 주의가 필요하다. 전반적으로 인가 변경에 대한 테스트 품질은 충분하며 Critical 이슈는 없다.

## 위험도

LOW
