# Code Review 통합 보고서

## 전체 위험도
**LOW** — round-3 fix(`865e6b93`, rerun-modal `router.push` slug 부착 1줄 수정 + 회귀 테스트 3종 + RESOLUTION 문서 갱신)는 실질 버그를 정확히 고쳤고 신규 Critical/공격표면 없음. 다만 "동일 defect class(slug 누락) 재발 방지"를 위한 구조적 강제 장치 부재라는 관점의 WARNING 2건이 architecture/maintainability 리뷰에서 각각 지적됨.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | slug 프리픽스 부착이 순수 관례(convention)에 의존 — 강제 장치 부재. 같은 컴포넌트 안에서 동일 패턴이 한 곳(원본 링크)엔 있고 다른 곳(재실행 성공 네비게이션)엔 누락된 채 두 리뷰 라운드를 통과한 전례. `router.push`/`replace` 직접 호출부가 ~30곳 이상으로 늘어난 지금 동일 defect class 재발 가능성이 구조적으로 남아있음 | `codebase/frontend/src/components/executions/rerun-modal.tsx:288-292` 및 `buildWorkspaceHref` 소비처 전반 | `useWorkspaceRouter()` 같은 얇은 래핑 훅(`push`/`replace` 내부에서 항상 `buildWorkspaceHref` 적용)으로 API 표면에서 강제하거나, 최소한 raw 문자열을 `router.push`/`replace` 에 직접 넘기는 패턴을 금지하는 custom ESLint 룰(`no-restricted-syntax`) 도입 검토 |
| 2 | maintainability | 실행 상세 경로 템플릿(`/workflows/${workflowId}/executions/${id}`)이 동일 파일 내 2곳(원본 링크·재실행 성공 네비게이션)에 리터럴로 중복 — 이번 버그(멀티라인 표기 때문에 grep 이 두 번째 인스턴스를 놓침)의 근본 원인이자, 세 번째 사용처가 생기면 동일 누락이 재발할 여지가 그대로 남음 | `codebase/frontend/src/components/executions/rerun-modal.tsx` 약 971-975행(재실행 성공)·1003-1007행(원본 링크) | `buildExecutionHref(slug, workflowId, executionId)` 같은 작은 헬퍼로 두 호출부를 통합해 경로 형식 변경/누락 재발을 구조적으로 제거 (WARNING #1 의 ESLint/훅 강제와 별개로, 이 파일 국소 중복은 저비용으로 지금 해소 가능) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `isSafeRedirectPath`(`error-page.tsx`)가 `buildWorkspaceHref` 대비 약한 open-redirect 방어(`//`만 방어, CR/LF/tab/백슬래시 미방어) — 현재 소비 경로 없어 도달 불가능(dead code)하나 이미 RESOLUTION W3 로 defer 기록됨 | `codebase/frontend/src/lib/workspace/href.ts` 컨텍스트 / `error-page.tsx` | 신규 조치 불요. `redirect=` 파라미터 소비 기능이 실제 추가되는 시점에 `buildWorkspaceHref` 수준 정규화 재사용 트래킹 유지 |
| 2 | security | `router.push` 문자열에 `workflowId`/`result.id` 이스케이프 없이 템플릿 삽입 — 백엔드 응답 값이라 공격자 직접 통제 어렵고 항상 `/workflows/` 로 시작해 프로토콜-상대 URL 불가, 실질 위험 낮음 | `rerun-modal.tsx:971-976` | 조치 불요 |
| 3 | architecture | fix 자체는 기존 확립된 패턴(`buildWorkspaceHref`/`useWorkspaceSlug`)을 정확히 재사용 — 신규 결합/레이어 위반 없음 | `rerun-modal.tsx:288-292` | 없음(긍정 사항) |
| 4 | architecture | 테스트 보강이 mock 최소화로 실제 동작 직접 검증(`it.each` 파라미터화, 실 zustand 스토어 액션 호출) | `href.test.ts:38-49`, `workspace-store.test.ts:96-131` | 없음(긍정 사항) |
| 5 | scope | 커밋 1개에 4개 작업항목(W1 real bug·W2 문서정정·W5/W6 테스트보강) 번들 — 프로젝트 컨벤션상 "구현 완료 후 리뷰 라운드 fix 일괄 처리"에 해당해 scope violation 아님 | 커밋 `865e6b93` 전체 | 조치 불요 |
| 6 | scope | 이전 라운드(2026/07/08 18_24_41)의 완료된 RESOLUTION.md 를 사후 정정(9→9중7 산출) — 사실 오류 정정이며 의사결정 변경 아님 | `review/code/2026/07/08/18_24_41/RESOLUTION.md` | 조치 불요. 향후엔 과거 문서 직접 수정보다 신규 RESOLUTION 에 각주 남기는 편이 이력보존상 더 안전할 수 있음(경미) |
| 7 | scope | `href.test.ts` 기존 단일 `it` → `it.each` 구조 변경 + 케이스 3개 추가 — 커밋 메시지(W6)와 RESOLUTION 표에 명시적으로 일치 | `href.test.ts` | 조치 불요 |
| 8 | scope | W3(open-redirect 유틸 통합)·W4(순환 lint 강제)는 의도적으로 본 커밋 제외 후 defer 기록 — scope 규율 준수 사례 | RESOLUTION.md 조치 항목 표 | 없음(긍정 사항) |
| 9 | side_effect | 기본 네비게이션 목적지 변경(bare path → slug-prefixed)이 실제 소비처 2곳(실행 상세 페이지·에디터 결과 drawer)에 영향 — 다만 `buildWorkspaceHref` 의 slug-없음 폴백 + catch-all 라우트 설계로 최종 도달 URL 은 이전과 동일, 리다이렉트 홉만 감소 | `rerun-modal.tsx:968-977` | 조치 불요(의도된 버그 수정). `onSuccess` 신규 소비처 추가 시 기본 네비게이션 변경 사실 인지 필요 |
| 10 | side_effect | `ReRunModalProps` 공개 시그니처 불변(JSDoc 문구만 갱신) | `rerun-modal.tsx:47-73` | 조치 불요 |
| 11 | side_effect | 테스트의 zustand persist 스토어 리셋(`localStorage` 쓰기)은 테스트 격리 목적의 의도된 통제된 부작용 | `rerun-modal.test.tsx:110`, `workspace-store.test.ts` | 조치 불요 |
| 12 | side_effect | RESOLUTION.md 2건이 코드 fix 와 동일 커밋 포함 — `review/**` 는 개발자 쓰기 허용 경로, 런타임 부작용 없음 | `review/code/2026/07/08/18_24_41/RESOLUTION.md`, `review/code/2026/07/09/08_18_37/RESOLUTION.md` | 조치 불요 |
| 13 | maintainability | 신규 slug 라우팅 테스트 2건이 mock 셋업(5줄가량)을 거의 그대로 반복 | `rerun-modal.test.tsx:290-329` | 필수 아님. 유사 셋업이 3곳 이상으로 늘어나면 `renderAndSubmit()` 류 헬퍼 추출 권장 |
| 14 | maintainability | `it.each` 튜플 타입이 `string \| null` 유니온으로 넓어져 콜백 내 수동 캐스팅 필요 | `href.test.ts` 약 1353-1368행 | 저비용 개선(우선순위 낮음): `as const` 튜플 또는 명시적 타입 파라미터로 캐스트 없이 타입 좁히기 |
| 15 | testing | slug-present 분기가 이전까지 테스트되지 않아 real bug 은폐(이번 커밋으로 해소, 두 분기 모두 회귀 고정) | `rerun-modal.test.tsx` 신규 테스트 | 신규 조치 없음(이미 반영). 향후 유사 네비게이션 fix 시 "활성 워크스페이스 있음/없음" 두 분기를 기본 테스트 매트릭스로 삼을 것 권장 |
| 16 | testing | `href.test.ts` `it.each` 매트릭스에 slug+LF, slug+이중backslash 조합 미포함(backslash/CR 2개만) — 정규화 로직상 실질 위험 낮음 | `href.test.ts:1353-1368` | 우선순위 낮음(defer 가능). 필요 시 LF+slug 케이스 1줄 추가로 매트릭스 대칭 완성 |
| 17 | testing | ai-review 파이프라인 disk-write 갭(reviewer 미산출)이 라운드마다 반복 — 코드 자체 이슈는 아니나 검증 신뢰도에 영향(이번 라운드도 requirement reviewer 미산출로 재현, 하단 참고) | RESOLUTION.md 두 파일의 "리뷰 커버리지 갭" 절 | 코드 변경 범위 밖. 참고용 기록 |
| 18 | documentation | 실제 버그 수정 지점(`router.push(buildWorkspaceHref(...))`)에 인라인 설명 주석 없음 — 자매 호출부(원본 링크)엔 spec 참조 주석이 있으나 이번 fix 지점엔 없어 향후 동일 누락 재발 여지 | `rerun-modal.tsx` 약 971행 | `// 원본 링크(위)와 동일 패턴 — bare path 회귀 방지(round-3 W1)` 정도의 짧은 주석 추가 권장 |
| 19 | documentation | 이번 fix에 대한 별도 CHANGELOG 항목 없음 — 기존 Unreleased phase 1 항목 서술과 이미 일치해 합리적 판단 | `CHANGELOG.md` | 조치 불요 |
| 20 | documentation | `onSuccess` JSDoc 갱신 + 이전 라운드 RESOLUTION.md 리뷰어 커버리지 서술 정정(W2) — 모범적 처리 | `rerun-modal.tsx`, `review/code/2026/07/08/18_24_41/RESOLUTION.md` | 없음(긍정 사항) |
| 21 | documentation | 테스트 파일 인라인 주석 품질 양호("왜"를 설명하는 주석 존재) | `rerun-modal.test.tsx`, `href.test.ts` | 없음(긍정 사항) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 공격표면 없음. `isSafeRedirectPath` 비대칭은 기존 defer(W3) 대상, dead code |
| architecture | LOW | fix 자체는 건전(기존 패턴 재사용). slug 강제 장치 부재라는 구조적 WARNING 1건 |
| requirement | — | 산출 파일 없음(disk-write 갭). 아래 "발견 없는 에이전트" 참고 |
| scope | NONE | 커밋 번들 4항목 전부 커밋 메시지·RESOLUTION 표와 1:1 대응, 무관 변경 없음 |
| side_effect | NONE | 네비게이션 목적지 변경은 최종 도달 URL 불변(폴백+catch-all), 프로덕션 부작용 없음 |
| maintainability | LOW | 경로 템플릿 리터럴 중복(이번 버그 근본원인)이라는 WARNING 1건, 나머지는 테스트 코드 수준 사소 개선 |
| testing | LOW | slug-present 분기 신규 커버로 은폐됐던 버그 클래스 해소. 잔여 갭은 전부 저위험 INFO |
| documentation | LOW | JSDoc/RESOLUTION 정정 모범적. 실제 fix 지점 인라인 주석 누락만 아쉬움 |

## 발견 없는 에이전트

- **requirement**: manifest 상 `status=success` 로 보고되었으나 `requirement.md` 파일이 디스크에 존재하지 않음(disk-write 갭). 내용을 통합할 수 없었음 — RESOLUTION.md(2026/07/08 18_24_41, 2026/07/09 08_18_37)에 기록된 반복적 disk-write 갭(testing 리뷰어가 지적)이 이번 라운드에도 requirement 리뷰어에서 재현된 것으로 보임. **재확인 필요**: requirement 관점(요구사항 충족 여부, spec 대비 SPEC-DRIFT 등) 검토가 이번 통합 보고서에서 누락되었으므로, 필요 시 requirement-reviewer 단독 재실행을 권장.

## 권장 조치사항
1. (선택, 저비용·즉시 가능) `rerun-modal.tsx` 내 중복된 실행 상세 경로 템플릿을 `buildExecutionHref(slug, workflowId, executionId)` 헬퍼로 통합해 이번 버그의 재발 여지(리터럴 중복)를 구조적으로 제거.
2. (후속 트래킹, 범위 밖 아님이나 이번 PR 필수는 아님) `router.push`/`router.replace` raw 문자열 직접 호출을 막는 custom ESLint 룰 또는 `useWorkspaceRouter()` 래핑 훅 도입 검토 — slug 프리픽스 부착을 컴파일러/린터 레벨에서 강제해 "관례 의존" 구조적 갭 해소.
3. (선택) `router.push(buildWorkspaceHref(...))` 호출부에 원본 링크와 동기화됨을 명시하는 짧은 인라인 주석 추가.
4. **requirement reviewer 미산출건 확인** — disk-write 갭으로 이번 라운드 requirement 관점 검토가 누락됨. 필요 시 단독 재실행하여 SPEC-DRIFT 등 요구사항 정합 여부 확인.
5. (defer 유지, 조치 불필요) `isSafeRedirectPath` 강도 통합(W3)·순환 lint 강제(W4)는 기존 RESOLUTION 결정대로 계속 defer.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 소스 코드 변경 시 항상 적용되는 규칙에 의해 강제 포함됨; `architecture` 는 router 자체 판단으로 선택됨)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 본 diff(1줄 네비게이션 fix + 테스트/문서)와 무관 — 구체 사유 텍스트는 prompt manifest 에 미제공 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 — 백엔드 API 변경 없음(FE 전용 fix) |
  | user_guide_sync | 상동 — 사용자 대면 문서/가이드 변경 없음 |