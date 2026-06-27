# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] e2e 가드 테스트에 서비스 구현 세부사항이 결합됨

- **위치**: `codebase/backend/test/workspace-rbac.e2e-spec.ts` L408–411 (케이스 H, editor testConnection 블록)
- **상세**: 역할 가드 통과를 확인하는 목적으로 작성된 e2e 테스트가 `expect(editorTest.status).toBe(200)` + `expect(editorTest.body.data.success).toBe(false)` 를 단언한다. 이 두 단언은 가드 통과 증거(`not.toBe(403)`)를 넘어, "미존재 config 에서 `testConnection` 이 예외를 삼키고 `200 { success: false }` 를 반환한다" 는 서비스 구현 세부사항에 결합된다. 해당 동작은 테스트 주석("best-effort 라 미존재도 200{success:false}")으로 명시돼 있으나, `spec/2-navigation/6-config.md §3` 및 `spec/5-system/7-llm-client.md §8.3` 어느 쪽도 "config 미존재 시 testConnection 은 200 + success:false 를 반환한다" 를 명시하지 않는다. 결과적으로 가드 외 서비스 동작이 스펙 외부 근거에 의존한다. 현재 구현에서는 e2e pass 확인됐으므로 테스트 자체는 정상 동작하지만, 향후 서비스가 미존재 config 에 대해 NotFound(404)를 전파하는 방향으로 변경되면 역할 가드가 올바르더라도 이 테스트가 실패하게 된다.
- **제안**: 가드 핵심 단언(`not.toBe(403)`) 은 그대로 두되, 현재 동작 문서화 목적 주석에 "서비스 구현 변경 시 이 단언도 갱신 필요" 를 명시하는 정도로 충분하다. 또는 가드 통과 단언만 분리(`.not.toBe(403)` 단독)하고 서비스 behavior 는 별도 service-level 테스트로 위임하는 방안도 고려할 수 있다. 스펙 갱신이 필요하다면 `spec/5-system/7-llm-client.md §8.3` LlmService.testConnection 절에 "config 미존재 시 best-effort 흡수 → `{ success: false }` 반환" 행동 명세를 추가할 수 있다.

---

## 기능 완전성 및 Spec Fidelity 검토 결과

### 점검 1 — 기능 완전성

세 가지 엔드포인트의 역할 계약이 모두 구현됐다.

| 엔드포인트 | 코드 | Spec §3 요건 | 일치 |
|---|---|---|---|
| `POST :id/test` | `@Roles('editor')` | Editor+ (과금 action-POST) | ✅ |
| `POST preview-models` | `@Roles('editor')` (기존) | Editor+ (과금 action-POST) | ✅ |
| `GET :id/models` | `@Roles` 없음 (Viewer+) | Viewer+ (조회) | ✅ |

단위 테스트는 `Reflect.getMetadata('roles', ...)` 로 데코레이터 존재 여부를 직접 검증하고, e2e 테스트는 실 인프라에서 viewer 403 / editor 통과 / listModels viewer 통과를 확인한다. behavior change 범위(Viewer 의 직접 API 호출 차단, UI 진입경로 없음)가 스펙 R-7 서술과 일치한다.

### 점검 2 — 엣지 케이스

`missingId = '00000000-0000-4000-8000-000000000000'` 를 사용해 entity 미존재 상황에서 가드 동작을 검증했다. viewer → RolesGuard 가 핸들러 진입 전에 차단해 entity 존재 여부와 독립적으로 403 을 반환한다는 점이 주석으로 명확히 설명돼 있다. 경계값(빈 컬렉션, null 역할)은 이 변경의 직접 범위가 아니며 기존 가드 로직에 위임된다.

### 점검 3 — TODO/FIXME

변경된 코드에 TODO, FIXME, HACK, XXX 주석이 없다.

### 점검 4 — 의도와 구현 간 괴리

단위 테스트 설명(`"editor 이상 권한 필요"`, `"Viewer+ 유지"`)과 실제 메타데이터 단언이 일치한다. e2e 케이스 H 제목이 asserting 하는 두 invariant(viewer 403, listModels viewer 통과)가 코드 단언과 일치한다.

### 점검 5 — 에러 시나리오

`@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 가 `testConnection` 에 추가돼 swagger 문서가 403 케이스를 명시한다. `previewModels` 는 기존에 이미 동일 데코레이터를 보유 중이었다. `listModels` 는 `@Roles` 부재(Viewer+)이므로 403 응답 문서화가 불필요하며 누락이 아니다.

### 점검 6 — 데이터 유효성

이 변경은 역할 게이트 추가에 국한된다. 입력 데이터 유효성 검증 로직(ParseUUIDPipe, DTO 검증)은 변경되지 않았다.

### 점검 7 — 비즈니스 로직

Spec R-7 이 규정하는 비즈니스 규칙:
- "과금 provider 호출 → Editor+" : `testConnection` 에 `@Roles('editor')` 로 구현 ✅
- "`preview-models` 와의 대칭" : 두 action-POST 가 동일 가드를 보유 ✅
- "`:id/models` 는 Viewer+ 유지" : `listModels` 에 `@Roles` 없음 ✅
- "behavior change = 직접 API 호출 갭 차단" : e2e H 가 이 경계를 정확히 검증 ✅

### 점검 8 — 반환값

컨트롤러 메서드는 변경 전과 동일한 반환 경로를 유지한다. 역할 가드는 인증 실패 시 `RolesGuard` 가 403 을 throw 하고 핸들러 코드에는 도달하지 않으므로 반환값 경로에 영향 없다.

### 점검 9 — Spec Fidelity

참조 spec: `spec/2-navigation/6-config.md §3 Model Config API` + Rationale R-7, `spec/5-system/7-llm-client.md §5.5` + §8.3.

| Spec 명세 | 구현 | 판정 |
|---|---|---|
| `6-config.md §3` — `POST :id/test` 행: "Editor+ — 과금 action-POST" | `@Roles('editor')` | ✅ |
| `6-config.md §3` — `GET :id/models` 행: "Viewer+ — 조회" | `@Roles` 없음 | ✅ |
| `6-config.md R-7` — "`preview-models` 와의 대칭" | `testConnection` 가 `previewModels` 와 동형 가드 보유 | ✅ |
| `7-llm-client.md §8.3` L452 — "`LlmModelConfigController.testConnection` 의 `@Roles('editor')` 로 강제" | `@Roles('editor')` | ✅ |
| `7-llm-client.md §5.5` L322 — preview-models 권한: "editor 이상" | `@Roles('editor')` (기존) | ✅ (기존) |

spec 과 구현 사이 불일치 없음. 이번 변경 이전 consistency review (`review/consistency/2026/06/27/11_20_31/SUMMARY.md`) 의 W-1 ("POST :id/test·GET :id/models 역할 규칙이 spec §3 에 미기재") 은 planner 가 spec §3 표와 R-7 을 먼저 갱신했고, 이번 PR 이 그 spec 을 코드에 반영해 W-1 을 해소했다.

---

## 요약

이번 변경은 `LlmModelConfigController.testConnection` 에 `@Roles('editor')` + `@ApiForbiddenResponse` 를 추가하고, 역할 계약을 단위 테스트(메타데이터 reflection) 및 e2e(실 인프라 viewer/editor 분기)로 검증한다. 구현은 `spec/2-navigation/6-config.md §3 Model Config API` 표와 Rationale R-7, `spec/5-system/7-llm-client.md §8.3` 이 규정하는 Editor+ / Viewer+ 인가 계약을 line-level 로 충족한다. 발견된 유일한 관심사는 e2e 케이스 H 에서 "가드 통과 증거" 단언(`not.toBe(403)`)이 서비스 best-effort 동작(미존재 config → 200+success:false)에 결합돼 있다는 점이며, 이는 명시된 설계 의도이고 현재 e2e pass 가 확인됐으므로 즉각적 차단 사유가 없다.

---

## 위험도

LOW
