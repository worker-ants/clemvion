# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 파일 2: e2e 테스트 — 순수 포맷팅 변경 혼재
- 위치: `/Volumes/project/private/clemvion/codebase/backend/test/graph-warning-save.e2e-spec.ts` diff 전체
- 상세: 기능 변경(params 단언 추가)과 무관한 인라인 객체 리터럴의 멀티라인 리포맷팅이 다수 포함됨 (trigger→outer, outer→middle, middle→inner, trigger→outer(B케이스), trigger→solo(C케이스) 등 5개 edge 객체). 의미 변경은 없고 가독성 개선이나 linter 적용으로 보인다. 실질 변경(params 단언)과 순수 포맷 변경이 하나의 diff 에 섞여 있어 리뷰 노이즈가 발생한다.
- 제안: 포맷 변경만 별도 커밋으로 분리하거나, 의도적 리포맷임을 커밋 메시지에 명시하면 리뷰 부담이 줄어든다. 기능적 문제는 없음.

### [INFO] 파일 10: `core.ts` — `interpolate` visibility 변경
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/core.ts` line 31
- 상세: `function interpolate` → `export function interpolate` 로 visibility 변경. `backend-labels.ts` 에서 import 해 재사용하기 위한 목적으로 작업 범위 내 정당한 변경이다. 단, 기존에 이 함수가 내부 전용(`private`)으로 설계된 의도가 있었다면, 이를 export 하는 것이 아키텍처 결정일 수 있다. 현재 코드 맥락상 동일 모듈 내에서 이미 사용 중이므로 외부 노출도 자연스럽고, 작업 범위의 요구사항(translateBackendError/translateGraphWarning 구현)과 직결된다.
- 제안: 문제 없음. 다만 향후 `interpolate` 는 공개 API로 간주되므로 signature 변경 시 주의 필요.

### [INFO] 파일 16: 플랜 문서 — Phase 3 설명 업데이트 정확도
- 위치: `/Volumes/project/private/clemvion/plan/in-progress/backend-msg-i18n-impl.md` Phase 3 체크리스트
- 상세: "저장 거부 toast/title 이 `translateBackendError('GRAPH_VALIDATION_FAILED', ...)` 적용" 항목이 원래 Phase 3 에 있었으나 완료 체크리스트 업데이트 시 `translateBackendError` 대신 `translateGraphWarning` 으로 실제 구현된 내용으로 대체됐다. 이는 구현 중 설계 보정으로 plan 이 코드와 일치하며 정당하다.
- 제안: 문제 없음.

---

## 요약

16개 파일의 변경은 전체적으로 작업 범위("동적·코드 기반 backend 메시지 localization — Phase 1~5 구현")와 긴밀하게 연결되어 있다. `types.ts`, `parallel.ts`, `evaluator.ts` (shared package) → `workflow-response.dto.ts`, `graph-warning-save.e2e-spec.ts` (backend) → `backend-labels.ts`, `core.ts`, `custom-node.tsx`, `editor-toolbar.tsx`, `editor-store.ts` (frontend) → 테스트 가드 (`backend-labels.test.ts`, `no-internal-refs.test.ts`) → 문서 (`validation-errors.mdx`, `.en.mdx`) → plan 업데이트 로 이어지는 수직 일관성이 유지된다. 요청하지 않은 기능 추가, 무관한 파일 수정, 의도하지 않은 설정 변경은 발견되지 않았다. 유일한 지적사항은 e2e 테스트 파일에서 기능 변경과 순수 포맷팅 변경이 섞여 있다는 점(INFO 수준)이며, 기능·의미 측면에서는 범위 이탈이 없다.

## 위험도

LOW
