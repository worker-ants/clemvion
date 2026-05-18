---
worktree: TBD
started: 2026-05-18
owner: project-planner
---

# spec/0-overview.md 말미에 `## Rationale` 섹션 신설

## 배경

`spec-overview-ui-patterns-followup-2026-05-16` PR 의 consistency-check (`review/consistency/2026/05/18/17_22_08`) W-3 로 발견.

- CLAUDE.md §명명 컨벤션 — "본문 끝에 `## Rationale` 섹션 권장".
- `spec/0-overview.md` 는 이 권장을 따르지 않고 아키텍처 결정 근거가 본문에 산재:
  - **S3 키 설계** (object storage 키 prefix·partition 전략)
  - **Flyway 선택** (DB migration 도구로 Prisma migration 대신 Flyway 채택한 배경)
  - **Redis 큐 도입 배경** (실행 엔진의 BullMQ 채택 사유, 단일 process 대안 기각 경위)
  - 그 외 본문에 "X 를 택한 이유" / "Y 를 거부한 이유" 형태로 inline 산재된 결정들
- 결정 근거가 본문 latest 기술 사이에 섞여 있어 (a) 본문이 길어지고 (b) 옛 결정의 폐기·재도입 시 추적 어려움.

## 작업 범위

- [ ] 새 worktree 생성 (`spec-overview-rationale-<slug>`)
- [ ] `spec/0-overview.md` 본문을 처음부터 읽으며 "결정 근거" 성격 문장 식별 (S3 키 설계 / Flyway / Redis 큐 / 그 외):
  - 본문 latest 상태 기술과 결정 근거를 분리
  - 결정 근거는 `## Rationale` 후보 항목으로 모음
- [ ] 문서 말미에 `## Rationale` 섹션 신설:
  - 각 결정마다 `### <짧은 제목> (날짜 — 기억나지 않으면 git blame 으로 추정)`
  - 결정의 배경 · 채택안 · 기각된 대안 · trade-off 의 4분 구성
- [ ] 본문에서 옮긴 문장은 본문에서 latest-only 기술로 압축 (중복 X). 본문이 결정 근거를 단축 언급하더라도 자세한 근거는 Rationale 로 hyperlink.
- [ ] consistency-check --spec 통과 (rationale-continuity 가 새 섹션을 검증)
- [ ] PR + merge → complete 이동

## 위험

- 본문에 산재한 결정 근거를 어디까지 "결정 근거" 로 식별할지 판단의 영역. 너무 많이 옮기면 본문이 latest state 만 남아 가독성이 떨어지고, 너무 적게 옮기면 Rationale 섹션의 가치가 약함. 1차 작업 후 follow-up 으로 미세 조정 예상.
- git blame 으로 결정 날짜를 추정해야 하는 경우가 많음 — 정확한 날짜보다 "<연도-월> 결정" 수준의 근사로 충분.
