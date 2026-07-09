# Rationale 연속성 검토 결과

## 검토 범위 메모

- 대상: `spec/2-navigation/` (impl-done, diff-base=`origin/main`)
- 실제 코드 diff(`origin/main..HEAD`, 워크트리 `slug-routing-hardening-94580e`)를 절대경로로 직접 확인한 결과, 이번 변경은 **spec 무변경 순수 FE 리팩터**다 (`git diff origin/main --stat -- spec/` 결과 0건). `plan/in-progress/slug-routing-hardening.md` 도 스스로 "순수 FE 리팩터(spec/API/데이터모델 무변경)"라고 명시.
- 코드 변경 내역(B-1~B-4): `buildExecutionHref` 헬퍼 도입(실행경로 리터럴 통합, slug 누락 latent 버그 3건 수정) · `no-raw-execution-href.test.ts` guard 신설 · `lib/workspace/safe-path.ts` 로 open-redirect 정규화 공용화(`buildWorkspaceHref` + `isSafeRedirectPath` 공유) · `WorkspaceSummary`/`WorkspaceRole` 타입을 `lib/workspace/types.ts` 로 분리(store ↔ resolve-fallback 순환 제거).
- 따라서 본 검토는 (a) 위 코드 변경이 `spec/2-navigation/_layout.md` · `9-user-profile.md §3` · `0-dashboard.md` · `1-workflow-list.md` · `14-execution-history.md` · `11-error-empty-states.md` 등에 기록된 기존 Rationale(특히 "URL slug = FE 라우팅 SoT", "backend 인가 SoT 는 별도", "에디터/`docs`/`(auth)` 는 phase 1 slug 밖", open-redirect 방어)와 충돌하는지, (b) target 문서(스냅샷) 자체가 각 스펙 말미 `## Rationale` 이 기각한 대안을 재도입하는지를 점검했다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 해당 없음).

### 확인한 항목 (근거를 위해 기록)

- **`buildExecutionHref` 도입** — `_layout.md` §2.2, `9-user-profile.md` §3 이 못박은 "URL slug = FE 라우팅 SoT" 원칙을 재도입도 위반도 하지 않고 오히려 **강화**한다. 이 헬퍼가 고친 3건(대시보드 최근 실행 row-click · 실행 목록 row-click · 실행 상세 prev/next)은 이전에 slug 를 빠뜨리던 latent 회귀였고, 원칙과 어긋나던 코드를 원칙에 맞춘 것 — "결정의 번복"이 아니라 원칙에 대한 정합화다.
- **에디터 canvas 예외 보존** — `_layout.md` / `9-user-profile.md §3` 은 "에디터(`/workflows/[id]`)는 phase 1 에서 slug 밖"이라 명시. `workflows/page.tsx` 의 `case "edit": router.push(\`/workflows/${workflow.id}\`)` 는 이번 diff 에서 변경되지 않았고, 신설 guard 테스트(`no-raw-execution-href.test.ts`)도 "에디터 canvas 경로(executions 아님)"를 명시적으로 non-match 케이스에 고정해 이 예외를 침해하지 않는다.
- **`buildWorkspaceHref` 의 slug-null bare fallback 유지** — `_layout.md` 의 "slug 가 없으면 bare path 반환 → catch-all 이 흡수" 서술과 `buildExecutionHref` 의 slug=null 테스트(`falls back to the bare path when slug is null`)가 일치한다. 동작 변경 없음.
- **open-redirect 방어 강화(`safe-path.ts`)** — 기존 `isSafeRedirectPath`(선두 `/` 검사)를 대체하되 정규화 로직은 이미 `href.ts` 에 있던 것과 동일 규칙을 공유 모듈로 옮긴 것뿐이며, 새로 발견된 우회(`\`·tab/CR/LF)에 대한 방어를 대칭적으로 넓힌 것 — 기존 spec 에 이 구체 정규화를 다루는 Rationale 항목은 없어(코드 레벨 보안 강화) 충돌 대상 자체가 없다.
- **`resolveFallbackWorkspace` 동작 불변** — `11-error-empty-states.md` §1.3 이 SoT 로 지목하는 `resolveFallbackWorkspace`(무효/비멤버 slug → FE 레벨 편의 redirect, 인가 경계 아님)의 로직은 이번 diff 에서 import 경로만 `@/lib/workspace/types` 로 바뀌었고 함수 동작은 무변경.
- **backend 인가 SoT 불변** — 이번 diff 는 frontend-only이며 `X-Workspace-Id` / header-first 인가 모델(`9-user-profile.md §3`, `data-flow/12-workspace.md` Rationale)에 해당하는 backend 코드는 손대지 않았다.
- **target 문서(스냅샷 본문) 자체의 자기 정합성** — 제공된 `spec/2-navigation/*.md` 스냅샷(0-dashboard·1-workflow-list·10-auth-flow·11-error-empty-states·13-user-guide·14-execution-history·15-system-status) 을 각자의 `## Rationale` 과 대조한 결과, 각 문서가 자신의 Rationale 이 채택한 결정(예: 워크플로우 목록의 "공유=워크스페이스 단위"·태그 필터 단일 free-text 하향, import permissive config 정책, 폴더 계층 무결성 양방향 강제, 403 CTA=대시보드, docs breakpoint 분리 등)과 어긋나는 서술을 재도입한 곳은 없었다.

## 요약

이번 --impl-done 대상(워크트리 `slug-routing-hardening-94580e`, PR #865 후속 하드닝 B)은 spec 변경이 전혀 없는 순수 FE 리팩터이며, 실제 코드 diff 를 직접 검증한 결과 `spec/2-navigation/_layout.md` §2.2·`9-user-profile.md` §3 에 잠긴 "URL slug = FE 라우팅 SoT / backend 인가 SoT 는 별도 / 에디터·docs·(auth) 는 phase 1 slug 밖" 원칙을 위반하거나 기각된 대안을 재도입하는 부분이 없다. 오히려 이 원칙과 어긋나던 3건의 latent 버그(슬러그 누락 broken-link)를 고쳐 원칙과의 정합성을 강화했고, `resolveFallbackWorkspace`·backend 인가 모델 등 기존 Rationale 이 명시한 invariant 는 그대로 보존됐다. Rationale 연속성 관점에서 차단 사유 없음.

## 위험도
NONE
