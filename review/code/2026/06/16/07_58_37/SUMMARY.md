# Code Review 통합 보고서

> 대상: Auth Config RBAC UI Guard (config-c1b-auth-rbac-guard)
> 일시: 2026-06-16 07:58:37
> 변경 요약: Authentication 페이지의 모든 mutation 액션 버튼(Add Config · Toggle · Reveal · Edit · Regenerate · Delete)을 `{isAdmin && (...)}` 단일 RBAC 가드로 통합

---

## 전체 위험도

**LOW** — 보안·기능적 결함 없음. 서버 사이드 `@Roles('admin')` 이중 방어 확인. WARNING 3건은 테스트 커버리지 충실도 및 UX 일관성 관련이며 런타임 버그 아님.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `useHasRole` mock이 역할 계층(ROLE_LEVEL)을 무시하는 boolean 플래그로 단순화됨. `owner` 역할이 admin+ 로 버튼을 보여야 하는 시나리오, `editor`/`viewer` 명시 숨김 시나리오 미검증. | `authentication-form.test.tsx` L105–108 | `roleState`에 `role: WorkspaceRole` 두고 mock이 `ROLE_LEVEL[role] >= ROLE_LEVEL['admin']` 계산하도록 수정하거나 `owner`/`editor` 파라미터화 테스트 추가. |
| 2 | Testing | `isActive=false` 행의 `Activate` 버튼 admin 가드 미검증. `MUTATION_BUTTON_NAMES`에 `/^Activate$/` 없음. `page.tsx`의 두 라벨 분기 중 한쪽만 커버. | `authentication-form.test.tsx` L263; `page.tsx` L1009–1011 | `existing.isActive = false` fixture 추가 또는 `MUTATION_BUTTON_NAMES`에 `/^Activate$/` 포함 및 비-admin fixture 두 개(isActive=true/false)로 커버. |
| 3 | Requirement / UX | 비-admin 사용자에게 Actions 테이블 열 헤더(`<th>`)가 여전히 렌더됨. 버튼 셀은 빈 `<td>`로 렌더되어 빈 컬럼이 의미 없이 공간 차지. 기능 버그·권한 우회 아님, UI 일관성 문제. | `page.tsx` — `{t("common.actions")}` `<th>` | 비-admin에서 Actions th/td 자체를 숨기거나, 빈 td 허용을 명시적으로 결정으로 문서화. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | XSS — 서버 응답값(`config.name` 등)을 JSX에 직접 렌더링하나 React 기본 이스케이프로 위험 없음. `dangerouslySetInnerHTML` 미사용 확인. | `page.tsx` L962, L1204, L1210 | 현 상태 유지. 향후 HTML 렌더링 시 새니타이징 필수. |
| 2 | Security | 테스트 코드에 `"wfk_live_abc123"` 더미 키 포함 — 실 키 포맷(`wfk_live_`) 노출. 운영 자격증명 아님. | `authentication-form.test.tsx` L211 | 즉각 조치 불필요. 원하면 `"test_dummy_key_abc"` 같은 중립 값으로 대체 가능. |
| 3 | Security | UI 가드(`isAdmin`)는 Zustand 클라이언트 스토어 기반. 실제 권한 강제는 백엔드 `@Roles('admin')` — depth-of-defense 정상. | `page.tsx` L562; `role-gate.tsx` L40–43 | 현 상태 양호. |
| 4 | Security | Reveal 흐름 — 백엔드 `@Roles('admin')` + 비밀번호 재확인 + audit_log. UI도 `isAdmin` 조건부 가드. 이중 방어 충족. | `page.tsx` L705–722; `auth-configs.controller.ts` L178–211 | 현 상태 양호. |
| 5 | Security | IP Whitelist 클라이언트 검증(toast) + 백엔드 `@IsIpOrCidr` DTO 이중 방어 확인. | `authentication-form.test.tsx` L189–204 | 현 상태 양호. |
| 6 | Security | 평문 키(`revealedSecret`, `generatedKey`) 30초 자동 클리어 — `useEffect` + `clearTimeout` 패턴. | `page.tsx` L580–596 | 현 상태 양호. |
| 7 | Requirement | `useHasRole("admin")` 가 `ROLE_LEVEL` 계층 비교(`>=`)로 Owner 포함 — spec `Owner/Admin=CRUD` 정책과 정합. | `spec/5-system/1-auth.md` L337; `role-gate.tsx` | 이슈 없음. |
| 8 | Requirement | Reveal spec 정합 확인 — spec `Auth Config Reveal: Owner/Admin` = `isAdmin && (...)` 가드와 일치. | `spec/5-system/1-auth.md` L338 | 이슈 없음. |
| 9 | Requirement | `isActive=false` 픽스처 미추가로 `"Activate"` 라벨 미커버 — 동일 코드 경로라 실질 버그 위험 없음. | `authentication-form.test.tsx` L262–268 | INFO 수준. 필요 시 fixture 추가. |
| 10 | Scope | 세 파일(test, page.tsx, plan) 모두 PR 선언 목적에 직접 대응. 범위 초과 수정 없음. | PR 전체 diff | 해당 없음. |
| 11 | Testing | `MUTATION_BUTTON_NAMES` 배열이 "edit form §A.2" describe 블록 내부에 있으나 `Add Config`(헤더 버튼) 포함 — 의미적 불일치. | `authentication-form.test.tsx` L261–268 | 별도 `describe("RBAC visibility guard")` 블록으로 분리 권장. |
| 12 | Testing | `roleState.isAdmin = true` 초기화가 `afterEach`에만 있고 `beforeEach`에 없음 — `afterEach` 실패 시 stale 상태 전파 가능성. | `authentication-form.test.tsx` L245–257 | `beforeEach` 블록에 `roleState.isAdmin = true` 추가(방어적 중복). |
| 13 | Testing | 비-admin 사용자 row click(usage 드로어=읽기) 허용 경로에 대한 회귀 테스트 없음. | `page.tsx` L993 주석 | `it("non-admin can still click a row to open the usage drawer", ...)` 추가 권장. |
| 14 | Testing | Reveal/Regenerate/Delete 버튼 aria-label이 i18n 런타임 값에 의존 — 번역 변경 시 false-negative 가능성. | `authentication-form.test.tsx` L43–44 | 우선순위 낮음. 번역 키 import 단언으로 regression 감지 향상 가능. |
| 15 | Documentation | 테스트 파일 상단 JSDoc이 RBAC 가드 테스트 범위를 반영하지 않음 — §A.2 만 언급. | `authentication-form.test.tsx` L1–6 | JSDoc에 `§3.2 RBAC 가드` 추가. |
| 16 | Documentation | `MUTATION_BUTTON_NAMES` 상수 위에 `Add Config`가 헤더 버튼임을 설명하는 주석 없음. | `authentication-form.test.tsx` L38–45 | 짧은 주석 보완 권장. |
| 17 | Documentation | `page.tsx` 인라인 주석에 Reveal이 Admin+인 spec 근거("평문 노출 + audit") 미요약. | `page.tsx` L989–992 | 한 줄 주석으로 근거 인라인 완결 권장. |
| 18 | Documentation | plan 파일 "비고"의 `"page.tsx:81-89"` 라인 참조가 리팩토링 후 stale 가능성. | `plan/in-progress/spec-sync-config-gaps.md` 비고 | 라인 번호 → 함수/변수명 참조로 대체 권장. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 이중 방어(클라이언트 UI + 서버 `@Roles`) 정상. 30초 자동 클리어 확인. 신규 취약점 없음. |
| requirement | LOW | spec §3.2 RBAC 매트릭스 정합 확인. Actions 헤더 th 비-admin 노출 UX 미완성(WARNING). |
| scope | NONE | 세 파일 모두 PR 목적에 직접 대응. 범위 초과 없음. |
| testing | LOW | 핵심 admin/비-admin 이진 검증 추가됨. 역할 계층 mock 단순화·`Activate` 라벨 미커버 WARNING. |
| documentation | NONE | 전반적으로 우수. JSDoc·인라인 주석 보완 기회(INFO만). |
| side_effect | — | 출력 파일 부재 — 재시도 필요 |
| maintainability | — | 출력 파일 부재 — 재시도 필요 |

---

## 발견 없는 에이전트

scope, documentation — 의미있는 발견 없음(NONE 위험도).

---

## 권장 조치사항

1. **(WARNING·Testing)** `useHasRole` mock에 실제 역할 계층 반영: `role: WorkspaceRole`을 roleState에 두고 `ROLE_LEVEL[role] >= ROLE_LEVEL['admin']`으로 계산하도록 수정. `owner` 역할 시나리오 커버 추가.
2. **(WARNING·Testing)** `isActive=false` fixture 추가로 `Activate` 버튼의 admin 가드 검증.
3. **(WARNING·Requirement/UX)** 비-admin 사용자에게 Actions `<th>` 열 헤더 표시 여부를 명시적으로 결정: 숨기거나 "빈 컬럼 허용" 결정을 주석/문서로 기록.
4. **(INFO·Testing)** 비-admin row click(usage 드로어) 허용 경로 회귀 테스트 추가.
5. **(INFO·Testing)** `beforeEach`에 `roleState.isAdmin = true` 방어 초기화 추가.
6. **(INFO·Documentation)** 테스트 파일 JSDoc에 `§3.2 RBAC 가드` 범위 추가 및 plan 파일 라인 번호 참조를 변수명 참조로 교체.
7. **(재시도 필요)** `side_effect` / `maintainability` reviewer 출력 파일 부재 — 워크플로 재실행 또는 수동 리뷰 수행.

---

## 라우터 결정

라우터 사용됨 (routing_status=done).

- **실행 (forced — router_safety)**: `security`, `requirement`, `scope`, `side_effect`, `testing`, `documentation`, `maintainability` (7명 전원 강제 포함)
- **제외**: 아래 표 (7명)
- **강제 포함(router_safety)**: security, requirement, scope, side_effect, testing, documentation, maintainability

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 제외 |
| architecture | 라우터 제외 |
| dependency | 라우터 제외 |
| database | 라우터 제외 |
| concurrency | 라우터 제외 |
| api_contract | 라우터 제외 |
| user_guide_sync | 라우터 제외 |

---

## 재시도 필요

- `side_effect` (출력 파일 `/review/code/2026/06/16/07_58_37/side_effect.md` 부재)
- `maintainability` (출력 파일 `/review/code/2026/06/16/07_58_37/maintainability.md` 부재)