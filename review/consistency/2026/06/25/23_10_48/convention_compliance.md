# Convention Compliance Review — refactor 03 m-3 (integrations/new split)

**검토 모드**: `--impl-done` (구현 완료 후 검토)
**diff-base**: `origin/main`
**검토 일시**: 2026-06-25

---

## 발견사항

### [INFO] `use-unsaved-changes-warning.ts` 에 `"use client"` 지시어 포함 — lib/ 파일 관례와 비일관 여부

- **target 위치**: `/codebase/frontend/src/lib/hooks/use-unsaved-changes-warning.ts` 1행
- **위반 규약**: `spec/conventions/` 내 프론트엔드 파일 배치 규약은 별도 명문화되어 있지 않음. 동일 경로 peer 파일(`use-copy-to-clipboard.ts`, `use-page-param.ts`)도 `"use client"` 를 포함하고 있어 해당 hooks 디렉토리의 확립된 패턴임을 확인 — 실질 규약 위반 아님.
- **상세**: peer 파일들도 동일 패턴을 사용하므로 기존 관례를 올바르게 따른 것.
- **제안**: 변경 없음. 향후 `lib/hooks` 가이드라인을 `spec/conventions/` 에 추가할 때 이 패턴을 명문화 대상으로 포함 가능.

### [INFO] `use-oauth-popup-return.ts` — `"use client"` 지시어 없이 브라우저 전용 API 사용

- **target 위치**: `/codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` 1-5행
- **위반 규약**: `spec/conventions/` 에 프론트엔드 `"use client"` 의무화 규칙 없음. 동일 디렉토리 peer 파일(`use-cafe24-pending-polling.ts`, `use-makeshop-pending-polling.ts`)도 `"use client"` 없이 클라이언트 훅을 사용하는 동일 패턴. 파일 자체가 `"use client"` 컴포넌트 트리에서만 import 되므로 런타임 영향 없음.
- **상세**: 규약 위반이 아니라 `lib/integrations/` 디렉토리의 기존 패턴을 따름.
- **제안**: 변경 없음.

### [INFO] 계획 문서의 컴포넌트 배치 방안과 실제 구현 위치 소폭 차이

- **target 위치**: `plan/in-progress/refactor/03-maintainability.md` §m-3 "개선 방안 1"
- **위반 규약**: `spec/conventions/` 에 명문화된 규약 없음.
- **상세**: plan §m-3 "개선 방안 1" 은 `components/integrations/steps/` 를 예시 배치 위치로 언급했으나, 실제 구현은 `app/(main)/integrations/new/_components/` (라우트-로컬 배치, impl-prep I1 결정)로 진행했다. Next.js App Router 관행과 일치하며 `spec/conventions/` 어느 항목도 명시적으로 위반하지 않는다.
- **제안**: 변경 없음. plan "개선 방안"은 예시 수준이며 impl-prep I1 결정이 이를 갱신한다.

---

## 요약

정식 규약(`spec/conventions/**`) 관점에서 이번 refactor 03 m-3 구현(integrations/new/page.tsx 1444→448줄 분할)은 규약 위반 사항이 없다. 신규 파일(auth-step.tsx, test-step.tsx, cafe24-private-pending-step.tsx, makeshop-pending-step.tsx, use-oauth-popup-return.ts, use-unsaved-changes-warning.ts)은 각각 Next.js 파일 명명 규약(kebab-case), 라우트-로컬 컴포넌트 배치(Next.js App Router 관행), `lib/integrations/` 및 `lib/hooks/` 디렉토리의 기존 패턴을 충실히 따른다. audit-actions, error-codes, swagger, spec-impl-evidence 등 규약 문서가 요구하는 사항(audit log 코드, API DTO 명명, frontmatter 의무)은 본 변경 범위(프론트엔드 컴포넌트 분리 리팩터)와 직접 교차하지 않는다. spec 변경 없음 선언도 분석 결과와 일치한다.

## 위험도

NONE
