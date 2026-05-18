---
worktree: TBD (per-item)
started: 2026-05-18
owner: project-planner
---

# spec/0-overview.md & 규약 follow-up 묶음 (2026-05-18)

## 출처

`spec-overview-ui-patterns-followup-2026-05-16` PR 의 consistency-check (`review/consistency/2026/05/18/17_22_08`) 에서 발견된 다음 항목들을 한 plan 으로 묶어 추적한다. 각 항목은 worktree 를 별도로 두어 진행할 수 있으며, 한 항목이 끝날 때마다 본 plan 의 해당 § 체크박스를 `[x]` 로 갱신한다. 모든 항목이 끝나면 본 plan 을 `plan/complete/` 로 `git mv`.

분리 통합한 원본 plan (2026-05-18 시점 in-progress 정리에서 흡수):
- `spec-data-model-filter-node-type-2026-05-18.md` (W-2)
- `spec-overview-cafe24-roadmap-classification-2026-05-18.md` (I-1)
- `spec-overview-rationale-section-2026-05-18.md` (W-3)
- `claude-md-naming-convention-root-spec-2026-05-18.md` (I-5)

---

## §1. spec/1-data-model.md §2.6 Node.type enum 에 `filter` 추가 (W-2)

### 배경
- `spec/0-overview.md §6.1` 와 `spec/4-nodes/0-overview.md` 는 Filter 노드를 구현 완료된 logic 노드로 명시.
- `spec/1-data-model.md §2.6` 의 `Node.type` enum **전체 목록에는 `filter` 가 누락**되어 있어 spec 간 직접 모순.
- DB enum 정의에 실질적 영향 가능 — consistency-check 보고서가 "우선순위 높음" 분류.

### 작업
- [ ] 새 worktree (`spec-data-model-filter-<slug>`)
- [ ] `spec/1-data-model.md §2.6` Node.type 전체 목록 확인 — `filter | 배열 필터링` 행 추가, Map/ForEach 등 다른 누락도 함께 점검
- [ ] `spec/4-nodes/_product-overview.md` §4.6~§4.7 사이 Filter 섹션 보완
- [ ] DB / Prisma 측 검증 — `codebase/backend/prisma/schema.prisma` 의 Node.type enum 에 `filter` 가 이미 있는지 확인, 누락 시 migration 추가 (운영 중 enum 변경 영향 검토)
- [ ] consistency-check --spec 통과
- [ ] PR + merge

### 위험
- enum 변경은 비파괴적이나 코드 배포 ↔ migration 순서 어긋남 시 에러 응답 가능. 별 PR 본문에서 명시.
- `4-nodes/_product-overview.md` Filter 섹션의 충실도 검토 필요.

---

## §2. spec/0-overview.md §6.2 Cafe24 분류 정합화 (I-1)

### 배경
- `spec/0-overview.md §6.2` 섹션 제목은 **"백엔드만 존재 / 부분 구현 (🚧)"**.
- 그러나 §6.2 안의 Cafe24 통합 항목 본문은 **"모두 구현 완료 (PR #20-#67)"** 로 명시 — 분류와 본문 직접 모순.
- 사용자/외부 reader 가 "Cafe24 는 부분 구현" 으로 오해할 수 있어 로드맵 신뢰성 영향.

### 작업
- [ ] 새 worktree (`spec-overview-cafe24-classification-<slug>`)
- [ ] 결정: 다음 두 안 중 택일
  - **(A)** Cafe24 항목을 §6.2 → §6.1 (구현 완료 ✅) 로 이동. §6.3 로드맵에 남은 확장 (Internal MCP Bridge 패턴 확장) 만 별도로 유지.
  - **(B)** §6.2 안에서 Cafe24 항목의 분류 컬럼을 "구현 완료 — 남은 확장은 §6.3 참조" 로 명시.
- [ ] §6 의 다른 항목도 함께 점검 (같은 분류 혼동이 있는지)
- [ ] consistency-check --spec 통과
- [ ] PR + merge

### 위험
- 작은 분류 작업이지만 §6 전체 구조에 손대면 다른 항목 분류도 재검토 필요. scope 가 §6 전체 정리로 번지면 별 plan 으로 다시 분리.

---

## §3. spec/0-overview.md 말미에 `## Rationale` 섹션 신설 (W-3)

### 배경
- CLAUDE.md §명명 컨벤션 — "본문 끝에 `## Rationale` 섹션 권장".
- `spec/0-overview.md` 는 이 권장을 따르지 않고 결정 근거가 본문에 산재:
  - **S3 키 설계** (object storage 키 prefix·partition 전략)
  - **Flyway 선택** (DB migration 도구로 Prisma migration 대신 Flyway 채택한 배경)
  - **Redis 큐 도입 배경** (BullMQ 채택 사유, 단일 process 대안 기각 경위)
  - 그 외 본문에 "X 를 택한 이유" / "Y 를 거부한 이유" 형태로 inline 산재된 결정들
- 결정 근거가 본문 latest 기술 사이에 섞여 있어 (a) 본문이 길어지고 (b) 옛 결정의 폐기·재도입 시 추적 어려움.

### 작업
- [ ] 새 worktree (`spec-overview-rationale-<slug>`)
- [ ] `spec/0-overview.md` 본문을 처음부터 읽으며 "결정 근거" 성격 문장 식별 (S3 키 설계 / Flyway / Redis 큐 / 그 외)
- [ ] 문서 말미에 `## Rationale` 섹션 신설 — 각 결정마다 `### <짧은 제목>` + 배경·채택안·기각된 대안·trade-off 4분 구성
- [ ] 본문에서 옮긴 문장은 본문에서 latest-only 기술로 압축, 자세한 근거는 Rationale 로 hyperlink
- [ ] consistency-check --spec 통과 (rationale-continuity 가 새 섹션을 검증)
- [ ] PR + merge

### 위험
- "결정 근거" 식별 판단의 영역 — 너무 많이 옮기면 본문 가독성 저하, 너무 적게 옮기면 Rationale 가치 약함. 1차 작업 후 follow-up 으로 미세 조정 예상.
- git blame 으로 결정 날짜 추정 — 정확한 날짜보다 "<연도-월> 결정" 수준의 근사로 충분.

---

## §4. CLAUDE.md §명명 컨벤션 — 루트 레벨 `spec/0-overview.md` 항목 명시 (I-5)

### 배경
- `spec/0-overview.md` 가 `spec/` 루트에 위치 (영역 폴더 안이 아님).
- CLAUDE.md §명명 컨벤션 표는 **`spec/<영역>/0-overview.md`** 패턴만 명시 — 영역 안의 0-overview 자리만 다룸.
- 결과: 규약과 실제 파일 위치가 불일치. 새 작성자가 CLAUDE.md 만 보고는 루트 `spec/0-overview.md` 의 역할을 모름.

### 작업
- [ ] 새 worktree (`claude-md-naming-root-spec-<slug>`)
- [ ] `CLAUDE.md` §명명 컨벤션 표에 루트 레벨 행 추가:
  - `spec/0-overview.md` (루트, 0- prefix 동일) — "제품 전체 개요 + 시스템 아키텍처 개요. 영역 폴더 위 cross-cutting 진입 문서."
- [ ] 다른 루트 레벨 파일 (`spec/1-data-model.md`, `spec/6-brand.md` 등) 도 함께 검토 — 같은 미명시 패턴이 있으면 한 묶음으로 추가
- [ ] `spec/0-overview.md §8 문서 맵` 과 CLAUDE.md 사이의 정합성 확인
- [ ] PR + merge

### 비고
- 본 변경은 `CLAUDE.md` (프로젝트 규약) 수정이라 consistency-check 의 spec 검토 대상이 아님 — 직접 PR.
- scope 가 작아 spec 본문 변경 없음.

---

## 처리 순서 권장

§4 (CLAUDE.md) → §3 (Rationale 섹션) → §2 (§6.2 분류) → §1 (Node.type enum) 순서가 의존성·위험 측면에서 가장 안전:
- §4 는 spec 수정 없이 규약 정정만 — scope 가장 작음, 가장 먼저
- §3 는 §6.2 본문에도 영향 줄 수 있어 §2 보다 먼저
- §1 은 DB enum 영향 검토가 가장 무거움 — 마지막
