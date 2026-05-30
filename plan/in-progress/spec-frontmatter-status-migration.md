---
worktree: spec-frontmatter-status-migration-027c17
started: 2026-05-29
owner: project-planner
---

# Plan — spec frontmatter `status` 전반 마이그레이션 (spec-only → 실상태)

> spec-impl-evidence 규약(2026-05-23 도입)의 `status` 라이프사이클을 프로젝트 전반에
> 적용한다. 현재 대부분 spec 이 전환기 기본값 `spec-only` 로 남아 있다.

## 동기 / 배경

- 트리거: PR #355 변경 7 조사 (project-planner, 2026-05-29). 단일 spec(`4-execution-engine`)
  frontmatter 전이를 검토하다 **프로젝트 전반 현상**임을 확인.
- **TTL 가드는 spec 별 생성일이 아니라 규약 도입일(2026-05-23) + 90일 = `2026-08-21` 공통 deadline**
  (`codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts:19-22`).
  현재(5/29) 모든 `spec-only` 가 TTL 내라 빌드 통과 — 하지만 **8/21 이후 `spec-only`
  잔존 시 build fail**. 그 전에 실상태로 전이해야 한다.
- 현황 (2026-05-29, `spec/**.md` frontmatter status 보유 104개):
  - `spec-only` **96** · `implemented` 6 · `partial` 2

## 전이 규칙 (spec-impl-evidence §3 요약)

| 목표 status | 조건 | `code:` | `pending_plans:` |
| --- | --- | --- | --- |
| `implemented` | 약속 surface 전부 구현 | ≥1 glob 매치 의무 | 없음 |
| `partial` | 일부 구현 | ≥1 매치 의무 | **≥1 (in-progress 실존) 의무** |
| `backlog` | 미구현(구현 plan 미작성) | 비어도 OK | — (단 `0-overview §6.3` 로드맵 매칭 권장) |
| `archived` | 폐기 | — | — |

> 가드 4종: `spec-frontmatter` / `spec-code-paths` / `spec-status-lifecycle` / `spec-pending-plan-existence` (frontend vitest).

## 분류 방법론 (per-spec)

각 spec 에 대해:
1. 본문이 약속한 surface 식별 (UI / API / 동작).
2. `code:` glob 후보 도출 (구현 모듈/컴포넌트/마이그레이션 경로).
3. 갭 판정 — 전부 구현되면 `implemented`, 미구현 잔존 시 `partial` (+ owning plan 확인/신설) 또는 `backlog`.
4. `/spec-coverage` 산출물을 1차 입력으로 활용 가능 (NLP 휴리스틱 — 최종 판정은 수동).
5. spec 본문의 stale "예정/미구현" 문구도 함께 정정.

## 배치 (도메인별)

| 배치 | 영역 | spec-only 수 | 상태 |
| --- | --- | --- | --- |
| B0 | `5-system/4-execution-engine` (anchor) | 1 | ✅ 본 PR 에서 worked example 로 전이 (아래) |
| B1 | `5-system/` 나머지 | 12 | ⏳ |
| B2 | `4-nodes/` (logic·flow·ai·integration·data·presentation·trigger) | ~33 | ⏳ |
| B3 | `3-workflow-editor/` | 5 | ⏳ |
| B4 | `2-navigation/` | 14 | ⏳ |
| B5 | `conventions/` (cafe24-api-catalog 18 + 기타 13) | ~31 | ⏳ |
| B6 | `7-channel-web-chat/` (architecture·widget-app·sdk·auth-session·security) | 5 | ⏳ — 모두 `status: spec-only` + `pending_plans: channel-web-chat-impl`. 구현 완료 시 `implemented` 전이 |

> 각 배치는 별 PR 권장 (리뷰 단위 관리 + consistency-check 부담 분산). cafe24-api-catalog 는
> 외부 API 카탈로그(레퍼런스 성격)라 `implemented` 또는 `archived`/`backlog` 일괄 판정 가능성 높음 — 우선 검토.

## B0 — execution-engine anchor (본 PR 실행분)

- [x] 본문 stale 정정: `_multiTurnState` legacy fallback "제거 예정"(§1.x) → 이미 제거됨 / presentation status "`resumed` 통일 예정"(§1.x) → 이미 통일됨.
- [x] frontmatter: `status: partial` + `code: codebase/backend/src/modules/execution-engine/**` + `pending_plans: [plan/in-progress/execution-engine-residual-gaps.md]`.
- [x] 미구현 surface(G1 WS start gate / G2 errorPolicy continue / G3 seq TTL)는 `execution-engine-residual-gaps.md` 가 인수.

## 권고 후속 흐름

1. B0 (본 PR) merge 후, B5(cafe24 카탈로그) → B1 → B2 → B3 → B4 순으로 배치 PR.
2. 각 배치는 project-planner 가 `/spec-coverage` 로 1차 분류 후 수동 확정 → frontmatter 적용 → `/consistency-check --spec`.
3. 8/21 deadline 전 완료. 미완 spec 은 `backlog` 로 임시 격하해 build fail 회피 가능 (단 `0-overview §6.3` 로드맵 등재 필요).

## 영향받지 않는 영역

- 코드 변경 없음 (frontmatter + spec 본문 문구 정정만). build-guard 는 frontend vitest.
- `implemented`(6)·`partial`(2) 기존 spec 은 대상 외.
