# Scope Review

리뷰 대상 브랜치: `claude/refactor-02-c2-llm-modelconfig-93cae7`
변경 의도: C-2 cluster 4 — LlmModelConfigController swagger 규약 정합 (`c92f4e35`)

---

## 발견사항

### [WARNING] `plan/complete/web-chat-loader-queue-replay-arguments.md` — 무관한 파일 수정
- **위치**: `plan/complete/web-chat-loader-queue-replay-arguments.md`, `spec_impact` 필드
- **상세**: 이 파일은 webchat 로더 command-queue replay 버그 수정(`webchat-queue-replay-arguments` worktree)의 plan 문서다. 본 브랜치(`claude/refactor-02-c2-llm-modelconfig-93cae7`)의 변경 의도인 LlmModelConfigController swagger 정합과 무관하다. 변경 내용(`spec_impact: []` → `spec_impact: none`)은 YAML 타입 교정이지만, 완전히 다른 기능 영역의 완료 plan 파일이 이 PR에 포함됐다.
- **제안**: 해당 YAML 교정을 별도 커밋/PR로 분리하거나 해당 feature worktree의 후속 커밋으로 처리할 것. 또는 plan 파일 정합성 정리 목적이라면 그 의도를 커밋 메시지에 명시.

---

### [INFO] `PROVIDER_PROBE_THROTTLE` 상수 추출 — 미세 리팩토링
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`, 추가된 L45 (`const PROVIDER_PROBE_THROTTLE`) 및 L55, L64, L73
- **상세**: 3개 핸들러에 중복된 `{ default: { limit: 10, ttl: 60_000 } }` 리터럴을 상수로 추출한 변경이다. swagger 규약 정합(입력 검증 추가)의 직접 요건은 아니나, 동일 파일 내 3곳의 완전 동일한 객체를 SoT 상수로 묶는 것이라 범위 일탈 규모가 최소하다. 동작 영향 없음.
- **제안**: 허용 가능한 수준이나, commit message가 "swagger 규약 정합" 단일 목적으로 기술돼 있으므로 리팩토링 의도를 명시했으면 더 명확했을 것. 코드 품질 개선으로 수용 가능.

---

### [INFO] `ParseEnumPipe` import 및 적용 — 정합 범위 내
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`, import 및 `listModels` `@Query` 데코레이터
- **상세**: `type` 쿼리 파라미터에 `ParseEnumPipe`를 추가해 `'chat' | 'embedding'` 외 값을 400으로 거부하는 변경이다. 이전에는 런타임 타입 검증 없이 서비스 레이어에 도달했다. swagger 규약 정합 및 입력 하드닝의 직접 목적에 부합한다.
- **제안**: 범위 내 정상 변경. 추가 조치 불필요.

---

### [INFO] `plan/in-progress/refactor/02-architecture.md` 업데이트 — 정합 범위 내
- **위치**: `plan/in-progress/refactor/02-architecture.md`, C-2 cluster 4 항목
- **상세**: PR #714(`000d8963`) 머지 완료 및 authz follow-up PR #716(`3e102ed3`) 머지 완료를 기록하는 plan 파일 갱신이다. 본 브랜치의 작업 완료 상태를 추적하는 의도된 수정이다.
- **제안**: 정상적인 plan lifecycle 갱신. 조치 불필요.

---

## 요약

변경 범위 관점에서 3개 파일 중 2개는 의도된 범위(`llm-model-config.controller.ts` swagger 입력 검증 + `02-architecture.md` plan 완료 기록) 내에 있다. `plan/complete/web-chat-loader-queue-replay-arguments.md`의 `spec_impact` 필드 교정은 webchat 로더 기능의 완료 plan 파일로서, LlmModelConfigController 작업과 무관한 파일이 PR에 혼입된 사례다. 해당 변경 자체는 trivial하고 기능 영향이 없으나 scope 원칙상 분리가 바람직하다. `PROVIDER_PROBE_THROTTLE` 상수 추출은 미세 DRY 개선으로 동일 파일 내 동일 값 3중복을 해소한 것이어서 실질 위험은 없다.

## 위험도

LOW
