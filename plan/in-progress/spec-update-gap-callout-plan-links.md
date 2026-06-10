---
worktree: trigger-schedule-sync-f88604
started: 2026-06-10
owner: resolution-applier
---
# Spec Update Draft — 구현 갭 callout 에 plan 링크 추가

## 분류
SPEC-DRIFT (spec 문서 추적성 개선)

## 원본 발견사항
SUMMARY Warning #8: 다수 구현 갭 callout(`10-triggers §1.4`, `14-chat-channel §1.1`, `15-external-interaction §1.5`, `7-llm-usage §1.3`, `12-workspace §3.1`) 에 수정 plan 파일 링크가 없어 수정 일정·책임 추적 불가.

## 제안 변경

각 갭 callout 끝에 해당 plan 파일 링크를 추가한다. plan 파일이 없는 경우 신규 생성 후 링크.

| 위치 | 갭 내용 | plan 파일 (기존/신규) |
|------|---------|----------------------|
| `spec/data-flow/10-triggers.md §1.4` | Trigger→Schedule 역방향 동기화 | `plan/in-progress/trigger-schedule-reverse-sync.md` (기존 — 이미 구현 완료, 갭 표기 해소 draft 별도) |
| `spec/data-flow/14-chat-channel.md §1.1` | `rateLimitPerMinute` 미구현 | `plan/in-progress/spec-sync-chat-channel-gaps.md` (기존 확인 후 미포함 시 신규) |
| `spec/data-flow/15-external-interaction.md §1.5` | `promoteRotatedNotificationSecrets` 의 `secretRef` 우선순위 | 신규 plan 파일 필요 (Critical #3 ESCALATE 후 생성) |
| `spec/data-flow/7-llm-usage.md §1.3` | AI 노드 attribution NULL | `plan/in-progress/spec-sync-execution-gaps.md` (기존 확인 후 미포함 시 신규) |
| `spec/data-flow/12-workspace.md §3.1` | `pruneExpired` 스케줄러 없음 | `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` (기존 확인 후 미포함 시 신규) |

각 callout 추가 예시 (`15-external-interaction §1.5`):
```markdown
> **[미해소] 구현 갭 — secret rotation 우선순위**: ...기존 텍스트...
> 수정 추적: `plan/in-progress/<name>.md`
```

**우선순위**: spec §1.4 의 trigger-schedule 갭 표기는 별도 spec-update-trigger-schedule-sync.md 로 동시 처리. 나머지 4곳은 본 draft 의 작업 범위.
