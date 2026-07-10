---
title: 카탈로그 §1.9 신설 — 워크스페이스 멤버 직접 추가 에러 코드 등재
worktree: workspace-membership-codes-7c3d20
started: 2026-07-10
owner: project-planner
spec_impact:
  - spec/5-system/3-error-handling.md
---

## 배경

#893(auth 잔여 3코드) Rationale 이 "별도 완결성 pass" 로 남긴 **workspace 직접-추가 경로**
UPPER_SNAKE 코드 등재. 이들은 초대 흐름 lowercase 코드(`already_a_member`·`workspace_type_mismatch`,
`workspace-invitations.service.ts`, error-codes.md §3 historical-artifact)의 **동일 의미·별개 wire 코드**
(다른 모듈 `workspaces.service.ts`)라, 카탈로그에 등재해 그 구분을 공용 가시화한다.

## 코드 ground truth (직접-추가 경로 `addMemberByEmail`, 전수 코드검증)

| 코드 | status | trigger | 발행처 |
| --- | --- | --- | --- |
| `CANNOT_ASSIGN_OWNER` | 403 (`ForbiddenException`) | 직접 추가 시 `role=owner` 부여 시도 | `workspaces.service.ts:238` |
| `ALREADY_A_MEMBER` | 409 (`ConflictException`) | 이미 멤버인 사용자 재추가 | `workspaces.service.ts:254` |
| `WORKSPACE_TYPE_MISMATCH` | 403 (`ForbiddenException`) | non-team 워크스페이스에 직접 추가 | `workspaces.service.ts:763` |

- 본문 SoT: [`data-flow/12-workspace §1.9`](../data-flow/12-workspace.md#19-멤버-직접-추가-기가입-사용자) — 세 코드 trigger + lowercase 구분 note 문서화됨(정식 body SoT).
- **USER_NOT_FOUND**(404, 미가입 이메일)·**WORKSPACE_NOT_FOUND**(404, 워크스페이스 미존재)도 이 경로가 던지나 **generic 코드**(전역 CRUD 공용, 다수 발행 site)라 직접-추가 distinctive 아님 → 등재 제외, note 로만 언급.
- **근접명명 주의**: `ALREADY_A_MEMBER`(UPPER, 직접추가) ≠ `already_a_member`(lowercase, 초대 흐름, error-codes.md §3). `WORKSPACE_TYPE_MISMATCH`(UPPER) ≠ `workspace_type_mismatch`(lowercase). `NOT_A_MEMBER`(§1.2, #893, 전환·탈퇴)와도 별개.

## 배치 결정

§1.2(인증/인가)는 401/403/423 뿐이라 `ALREADY_A_MEMBER`(409)가 이질적이고, 세 코드는 같은 직접-추가
경로라 분리 금물. → §1.5~§1.8 이 쓰는 **"도메인 spec 참조" 서브섹션 패턴**대로 **신규 §1.9
"워크스페이스 멤버 직접 추가 에러 코드 (도메인 spec 참조)"**(status 열, SoT=data-flow §1.9)에 함께 등재.
(#893 의 `NOT_A_MEMBER` 는 전환/탈퇴 경로라 §1.2 flat 유지 — 직접-추가 경로 3코드와 다른 sub-domain.)

## 변경 — `spec/5-system/3-error-handling.md`

### 1) §1 intro 도메인 목록에 §1.9 추가
- 현재: "...webhook §1.7·KB/Graph RAG §1.8)"
- → "...KB/Graph RAG §1.8·워크스페이스 멤버 직접추가 §1.9)"

### 2) §1.8 뒤(현 L186 다음, `---` 앞)에 §1.9 서브섹션 신설
```
### 1.9 워크스페이스 멤버 직접 추가 에러 코드 (도메인 spec 참조)

`POST /api/workspaces/:id/members`(`WorkspacesService.addMemberByEmail`, 기가입 사용자 직접 합류) 전용 코드. 정의·트리거 SoT 는 [data-flow/12-workspace §1.9](../data-flow/12-workspace.md#19-멤버-직접-추가-기가입-사용자)이고 본 절은 공용 카탈로그 가시성 등재다. 모두 `UPPER_SNAKE_CASE`([conventions/error-codes.md](../conventions/error-codes.md)).

| 코드 | status | 설명 | 도메인 SoT |
|------|--------|------|-----------|
| `CANNOT_ASSIGN_OWNER` | 403 | 직접 추가로 `role=owner` 부여 불가(owner 는 소유권 이전 경로로만) | [data-flow §1.9](../data-flow/12-workspace.md#19-멤버-직접-추가-기가입-사용자) |
| `ALREADY_A_MEMBER` | 409 | 이미 멤버인 사용자 재추가 | [data-flow §1.9](../data-flow/12-workspace.md#19-멤버-직접-추가-기가입-사용자) |
| `WORKSPACE_TYPE_MISMATCH` | 403 | non-team 워크스페이스에 직접 추가 시도 | [data-flow §1.9](../data-flow/12-workspace.md#19-멤버-직접-추가-기가입-사용자) |

> 위 UPPER_SNAKE 코드는 초대 흐름(`workspace-invitations.service.ts`)의 lowercase `already_a_member`·`workspace_type_mismatch`(§1.2 초대 발급·수락, [error-codes.md §3](../conventions/error-codes.md#3-historical-artifact-예외-레지스트리) historical-artifact)와 **동일 의미·별개 wire 코드**다(다른 모듈·케이스 컨벤션, 의도적 분리·통합 금지). 같은 경로의 `USER_NOT_FOUND`(404, 미가입 이메일)·`WORKSPACE_NOT_FOUND`(404, 워크스페이스 미존재)는 `workspaces.service` 전역 CRUD 공통 generic 코드라 직접-추가 distinctive 가 아니어서 본 절 미등재다. 전환·탈퇴 경로의 `NOT_A_MEMBER`(403)는 §1.2.
```

### 3) Rationale 신규 bullet
```
- **§1.9 워크스페이스 멤버 직접 추가 코드 등재 (#893 후속 완결성 pass)**: #893 이 "별도 pass" 로 남긴 직접-추가 경로(`addMemberByEmail`) UPPER_SNAKE 코드 `CANNOT_ASSIGN_OWNER`(403)·`ALREADY_A_MEMBER`(409)·`WORKSPACE_TYPE_MISMATCH`(403)를 §1.5~§1.8 도메인-참조 패턴으로 §1.9 신설 등재. SoT=data-flow §1.9. 초대 흐름 lowercase 동명 코드와 wire-별개임을 note 로 명시(error-codes.md §3 정합). §1.2(401/403/423)에 409 를 섞지 않고 status 열 서브섹션으로 둔 것은 §1.5~§1.8 선례. generic `USER_NOT_FOUND`(404)는 도메인 코드 아니라 제외.
```

## 워크플로 (project-planner)
- [x] consistency-check --spec (18_01_11) — **BLOCK:NO** (naming_collision NONE·rationale_continuity NONE "모범 사례"; convention·naming FS-flakiness → journal 복구 전수 확보). cross_spec WARNING 2(USER_NOT_FOUND §1.1 오참조·WORKSPACE_NOT_FOUND 비대칭) 반영
- [x] spec 반영 (§1 intro·§1.9 신설·Rationale bullet + #893 tail pointer) + **spec-link-integrity 11/11 PASS**
- [x] plan complete 이동 (커밋 259d311dd spec 반영 → 본 chore(plan))

## 범위 밖
- 그 외 workspace 코드(`SOLE_OWNER_CANNOT_LEAVE`·`CANNOT_REMOVE_OWNER`·`OWNER_ROLE_PROTECTED`·`TARGET_*` 등 role/membership 관리)는 별도 pass — 본 pass 는 직접-추가 경로 distinctive 코드에 한정.
- 초대 흐름 lowercase 코드는 error-codes.md §3 이 SoT (등재 아님, historical-artifact).
