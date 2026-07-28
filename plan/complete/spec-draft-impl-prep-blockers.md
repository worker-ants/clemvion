---
title: "spec draft — impl-prep 게이트 차단 2건 정정 (auth RBAC 표 · graph-rag 엔티티 명명)"
worktree: spec-impl-prep-blockers-9e21b4
started: 2026-07-28
owner: project-planner
status: complete
priority: P1
spec_impact:
  - spec/5-system/1-auth.md
  - spec/1-data-model.md
  - spec/5-system/10-graph-rag.md
---

## Overview

`spec/5-system/` 영역의 **기존 spec 결함 2건**을 정정한다. 둘 다 코드로 검증된 사실이며
`spec/` 만 낡았다(SPEC-DRIFT 역류).

발견 경로: `retry-turn` P1(원자 claim) 착수 전 의무 `--impl-prep spec/5-system/`
(`review/consistency/2026/07/28/17_21_27`) 이 **BLOCK: YES / Critical 3건**을 냈다. 그중 1건
(`retry_last_turn` 원자성)은 그 작업 자신의 것이고, 나머지 2건이 본 draft 대상이다.

**왜 별 PR 인가.** 두 건은 `retry-turn` 작업과 무관한 auth·graph-rag 영역 결함인데,
`--impl-prep` 이 **디렉터리 단위 scope 만 지원**해(`--impl-prep spec/5-system/4-execution-engine.md`
는 usage 에러) 같은 영역의 모든 결함이 함께 차단 사유가 된다. 우회(`DISABLE_...`)는 이 저장소가
전에 교착을 만든 경로라 택하지 않는다 — 실제로 정정 비용이 우회보다 싸다(각각 한 줄~각주).

## 변경 1 — `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스 "멤버 관리" 행

### 실측

| 확인 | 결과 |
|---|---|
| spec 현재 | `\| 멤버 관리 \| CRUD \| CRU \| R \| R \|` — Admin 에 **D 없음** |
| 코드 | `WorkspacesService.removeMember()` 가 `assertAdmin(workspaceId, requesterId)` 만 요구 |
| `assertAdmin` | `ADMIN_ROLES = new Set(['owner', 'admin'])` — **admin 통과** |
| 실제 제약 | owner 인 멤버는 제거 불가(`CANNOT_REMOVE_OWNER`), 자기 자신은 `leaveWorkspace` 로 위임. **역할이 admin 이라 막히는 것이 아니다** |

즉 Admin 은 멤버를 삭제할 수 있고 spec 표만 그것을 반영하지 못했다. 같은 문서 §3.1 의 Admin
역할 서술("멤버 관리"가 핵심 권한)과도, `spec/2-navigation/9-user-profile.md` §6.1·§4.2
(Admin 삭제 가능 명시)와도 어긋난다 — **표 한 칸만 소수 의견**이다.

### 변경 후

`| 멤버 관리 | CRUD | CRUD | R | R |`

별도 행인 `| Admin 역할 부여 | ✅ | — | — | — |`(Owner 전용)은 **그대로 유지**한다. "멤버를
제거할 수 있다" 와 "관리자 역할을 부여할 수 있다" 는 다른 권한이고, 후자는 실제로 Owner 전용이다.

**근거는 `1-auth.md` 자신의 `## Rationale` 로 이관한다** (`--spec` 검토 WARNING #1 — 변경 2 는
대상 문서 Rationale 에 각주를 남기는데 변경 1만 plan 에만 남기면 비대칭이고, plan 이 아카이브되면
근거가 소실된다).

owner 멤버 제거 불가는 역할 매트릭스가 아니라 **대상 조건**이므로 표에 넣지 않고 각주로 단다:

> Admin 의 멤버 삭제는 대상이 Owner 인 경우 거부된다(`CANNOT_REMOVE_OWNER`). 이는 역할 권한이
> 아니라 대상 조건이라 위 매트릭스가 아닌 본 각주로 기술한다.

## 변경 2 — Graph RAG 엔티티 명명이 TypeORM `@Entity` 와 실제 충돌

### 실측

| spec 표기 | 실제 클래스 |
|---|---|
| `Entity` (`1-data-model.md` §2.12.2) | `GraphEntity` (`entity.entity.ts:40`) |
| `Relation` (§2.12.3) | `GraphRelation` (`relation.entity.ts:25`) |
| `ChunkEntity` (§2.12.4) | `GraphChunkEntity` (`chunk-entity.entity.ts:25`) |

코드는 TypeORM 의 `@Entity` 데코레이터 심볼과 겹치는 것을 피하려 `Graph` 접두를 붙였는데,
spec 두 문서는 접두 없는 이름만 쓴다. 구현을 찾는 독자가 `Entity` 로 grep 하면 TypeORM
데코레이터 수백 건에 묻힌다.

### 변경 후

**`spec/1-data-model.md`** — §2.12.2/§2.12.3/§2.12.4 제목에 구현 식별자를 병기한다:

- `### 2.12.2 Entity (구현: \`GraphEntity\`)`
- `### 2.12.3 Relation (구현: \`GraphRelation\`)`
- `### 2.12.4 ChunkEntity (구현: \`GraphChunkEntity\`)`

**`spec/5-system/10-graph-rag.md`** — §2.3/§2.4/§2.5 헤더에도 동일하게 병기한다
(`--spec` 검토 WARNING #4 — 각주 1개만 두면 "grep 가독성" 근거가 정작 그 문서 안에서
관철되지 않는다). 추가로 Rationale `#### 도메인 용어` 절 끝에 각주 1개:

> **구현 식별자 주의**: 위 도메인 용어(`Entity`/`Relation`/`ChunkEntity`)의 실제 클래스명은
> `GraphEntity`/`GraphRelation`/`GraphChunkEntity` 다. TypeORM 의 `@Entity` 데코레이터와 심볼이
> 겹쳐 `Graph` 접두를 붙였다(DTO 도 `GraphEntityDto` 등). 도메인 문서는 접두 없는 용어를
> 유지하되, 구현을 찾을 때는 접두형으로 grep 할 것.

도메인 용어 자체는 바꾸지 않는다 — 접두는 **구현 언어의 제약**이지 제품 개념이 아니다.

## 변경 3 — `retry_last_turn` 원자성(Critical #2) 의 spec 갱신 항목 등재

이 건은 **본 draft 에서 고치지 않는다.** 코드(P1 원자 claim)와 **동반돼야** 하는 spec 갱신이라,
후속 developer PR 에서 코드와 같은 커밋으로 처리하는 것이 맞다. 여기서는 **유실 방지 등재만** 한다
(`spec-update-node-cancellation-shutdown-classification.md` 에 `#10` 으로).

`--impl-prep` 이 지목한 갱신 지점:

- `4-execution-engine.md` §4.1 각주 — 현재 crash re-drive 항목에 잘못 연결돼 있어
  `retry_last_turn` 전용 근거로 재연결
- §7.4 / §8 — 신규 claim 위치 반영 + 각주
- §7.5 — "spawn 단계 원자성만으론 불충분한 이유" 대칭 Rationale 항목 신설
- `plan/complete/exec-intake-queue-impl.md` 의 2026-06-06 PASS 판정과 현재 CRITICAL 사이의
  간극을 **기록**한다. 단 인과는 실측으로 다시 잡았다:

  | 주장 | 판정 |
  |---|---|
  | `--impl-prep` finding: "2026-06-06 PASS 가 DI 리팩터 `#638`(2026-06-19)로 무효화" | **틀림** |
  | `--spec` checker 정정: "배제 로직은 `3213a4a55`(2026-05-30)부터 존재" | **이것도 틀림** |
  | 실측(`git log -S "claimResumeEntry" -- continuation-execution.processor.ts`) | `claimResumeEntry` 는 **2026-07-03 (`44f956e9c`, #791 "06 C-2 재개 진입 DB 원자 claim")** 에 도입 |

  따라서 정확한 서술은 **"2026-06-06 PASS 는 원자 claim 도입(2026-07-03) 이전이라 이 축을
  애초에 검증한 적이 없다"** 이다. 무효화된 것이 아니라 **스코프 밖**이었다. 2026-05-30 부터
  있던 것은 `retry_last_turn` **job type** 이지 배제 조건이 아니다 — 배제 조건은 claim 이
  존재해야 성립하므로 2026-07-03 이전에는 있을 수 없다.

  교훈: 중간 문서를 거친 인과 주장은 **양쪽 다 틀릴 수 있다.** `git log -S` 로 원 도입 시점을
  직접 잡는 것 외에 확정 방법이 없다.

## 비목표

- `--impl-prep` 의 디렉터리-only scope 와 알파벳순 예산 초과(이번에도 정작 대상인
  `4-execution-engine.md` 가 5개 checker 중 4개 프롬프트에서 생략됨 — **최소 6번째 재발**)는
  하네스 결함이고 이미 `harness-consistency-summary-downgrade-rule.md` 에 등재돼 있다.
  본 draft 에서 손대지 않되, 재발 관측 한 줄을 그 plan 에 추가한다.
- 코드 변경 없음.

## Rationale

**왜 무관한 2건을 내 작업 PR 에 끼워 넣지 않는가.** `retry-turn` P1 은 실행 엔진 동시성
변경이고 이 둘은 auth·graph-rag 문서 정정이다. 한 PR 에 섞으면 리뷰어가 서로 무관한 세 영역을
동시에 봐야 하고, 되돌릴 때도 함께 딸려간다. 게이트를 여는 것이 목적이므로 **게이트 차단분만**
분리해 먼저 올린다.

**왜 우회하지 않는가.** `--impl-prep` 의 BLOCK:YES 를 우회하는 선택지가 있으나, 이 저장소는
전에 그 경로에서 교착을 겪었고 "권한 밖 spec drift 면 planner 턴으로 근본 정정하는 편이 쌌다"
는 결론이 남아 있다. 이번에도 실제 수정량은 표 한 칸 + 제목 3개 + 각주 1개다.

**기각한 대안 — RBAC 표에서 "멤버 관리" 행을 세분화.** `멤버 초대`/`멤버 제거`/`역할 변경` 으로
쪼개면 정밀해지지만, 매트릭스가 길어지고 다른 리소스 행들과 입도가 어긋난다. owner 대상 제약은
역할 권한이 아니라 대상 조건이므로 각주가 맞는 자리다.
