---
worktree: cafe24-spec-cleanup-f4d8e2
started: 2026-05-16
owner: project-planner
---

# Cafe24 spec drift 정리 — F-2 + F-3 (PR #75 follow-up)

PR #75 의 후속 follow-up 3건 중 F-2, F-3 만 처리 (F-1 보류 — 별 plan).

## 변경 대상

### F-1 (보류 — 별 plan 으로 분리)

`spec/data-flow/integration.md` → `1-integration.md` rename 은 본 plan 범위 외. `spec/data-flow/` 폴더 내 12 파일이 모두 plain-named (audit.md, auth.md, execution.md, file-storage.md, ...) — integration.md 단독 rename 시 폴더 내 일관성 깨짐. 데이터-flow 폴더 전체 rename 또는 명명 규약 예외 명시는 별 PR 로 분리 (별 영향 범위가 12 파일 + cross-link 다수).

### F-2 (본 plan — 처리됨)

`spec/0-overview.md`:
- §6.3 미구현 (❌) 표에서 "Cafe24 통합" 행 제거.
- §6.2 부분 구현 (🚧) 표에 "Cafe24 통합" 행 추가 — 구현 상태 (단일 노드, MCP Bridge, Public/Private OAuth, App URL, leaky-bucket, BullMQ refresh, 백그라운드 갱신) 모두 명시. spec link 유지.
- §6.3 "Internal MCP Bridge 패턴 확장" 행 본문에 "Cafe24 (구현 완료, §6.2) 이후" 로 컨텍스트 갱신.

### F-3 (본 plan — 처리됨)

`spec/1-data-model.md` §2.19 Notification.type 컬럼 설명에 `integration_expired` 발사 정책 inline 추가:
- `expired` 전이에만 발사 (token_expires_at 만료 + install_timeout).
- `error(auth_failed)`, `error(network)`, `error(insufficient_scope)` 전이는 알림 미발사 — UI 배지로만 통지.
- 향후 `integration_action_required` 타입 신설 검토.
- `spec/2-navigation/4-integration.md §11.2` cross-link.

## 변경 파일 (2건)

1. `spec/0-overview.md` — §6.2, §6.3
2. `spec/1-data-model.md` — §2.19 Notification.type 컬럼 설명

## 진행 순서

- [x] 1. 본 draft 작성.
- [ ] 2. `/consistency-check --spec plan/in-progress/spec-draft-cafe24-spec-cleanup.md`.
- [ ] 3. Critical 0 건 확인 후 spec 수정.
- [ ] 4. plan/complete/ 이동 + PR 생성.

## 후속 follow-up

- F-1: `spec/data-flow/` 폴더 전체 명명 규약 정합화 (12 파일 rename + cross-link 갱신) — 별 plan/PR.
- Medium 30+ 항목들 — 별 plan 으로 분리.
