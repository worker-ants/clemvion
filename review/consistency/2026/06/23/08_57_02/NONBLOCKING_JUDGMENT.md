# impl-done BLOCK:YES — 비차단 판정 (developer)

대상: M-8 1단계 (commit `b135e6c6`), `/consistency-check --impl-done spec/2-navigation`
판정: **비차단 진행** (작업 규약: behavior-preserving refactor 와 직교한 pre-existing Critical 은 근거 기록 후 비차단 + planner 위임)

## Critical (BLOCK 사유) — pre-existing·직교·미변경

**Convention Compliance C-1**: `spec/conventions/cafe24-api-catalog/application.md` 의
`applications_list`·`webhooks_list` row 가 `status: supported` 이나 cafe24 공식 docs 미검증
→ `_overview.md §2` "supported 시 docs 필수" 규약 위반.

### 비차단 근거 (git 실측)

1. **본 브랜치 미변경**: `git diff origin/main..HEAD --name-only | grep cafe24` → 빈 결과.
   본 PR(M-8 1단계, frontend 트리거 API 레이어)은 `spec/conventions/cafe24-api-catalog/` 를
   전혀 건드리지 않는다.
2. **origin/main 에 이미 존재**: 두 row(`status: supported`)는 `git show
   origin/main:spec/conventions/cafe24-api-catalog/application.md` 에 이미 존재 — pre-existing.
3. **프로젝트가 이미 인지·추적**: origin/main 의 같은 파일 §하단에 ⚠ "docs 부재 seed
   (applications_list, webhooks_list)" 주석 + 운영 검증/제거 결정 트랙
   `plan/in-progress/cafe24-backlog-residual.md §G-2` 명시.
4. **영역 직교**: 본 브랜치 변경 영역은 `codebase/frontend/src/{app/(main)/triggers,
   components/triggers,lib/api}` + `plan/in-progress/refactor` + `review/**` 뿐 — cafe24
   카탈로그와 0 중첩.
5. **M-8 미유발**: summary 자체가 "M-8 1단계 리팩터링이 새로 유발한 위반은 없음" 명시.

⇒ M-8 1단계의 behavior-preserving 변경과 **완전 직교한 pre-existing 규약 위반**이며 이미
별도 트랙(cafe24-backlog §G-2)에서 관리 중. 본 PR 차단 사유로 부적절 → **비차단 진행**,
cafe24 catalog status/escape-hatch 결정은 **project-planner / cafe24-backlog 트랙**에 위임.

(참고: 직전 `--impl-prep`(07_55_57)에서는 동일 cafe24 사안이 WARNING(W-4)로 분류됐다 —
checker 간 severity 편차. 기저 상태는 동일하며 pre-existing·추적 중.)

## Warning

- **Naming W-3**: frontend `TriggerDetail`(lib/api/triggers.ts) ↔ backend `TriggerDetail`
  (triggers.service.ts) 동명 → **M-8 2단계 defer**. 이름은 본 PR 이 신설한 게 아니라
  `trigger-detail-drawer.tsx` 에 이미 존재하던 타입을 `lib/api/triggers.ts` 로 relocate 한 것 —
  collision 은 pre-existing. 2단계 카드 분리 시 `TriggerDetailView` 등으로 개칭 검토(또는 backend
  `TriggerWithSchedule` 개칭, planner).
- **Convention W-1/W-2**: 10-auth-flow error= (historical-artifact 레지스트리 등재, 위반 아님) /
  Coverage Matrix 수동 갱신 → 조치 불요·무관.

## INFO

전부 비차단: 감사 액션 과거분사 표기(planner) / R-7·R-4·R-CC-10·R-14 정합 확인(긍정) / spec 구조
nit / M-8 2단계 6카드 결정(plan 이미 "별개 결정" 명시) 등. RESOLUTION(`review/code/.../08_49_58/`)
및 plan §M-8 에 근거 기록됨.
