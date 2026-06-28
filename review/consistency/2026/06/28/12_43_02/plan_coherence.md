# Plan 정합성 검토 결과

## 검토 범위

- **Target**: `spec/5-system/` (impl-done 검토, diff-base=origin/main)
- **실제 변경 파일**: `spec/5-system/12-webhook.md`, `spec/5-system/3-error-handling.md`
- **연동 변경 파일**: `spec/4-nodes/7-trigger/1-manual-trigger.md`, 코드 파일 다수

## 발견사항

### [INFO] WH-NF-02 인증 webhook 1MB 게이트 — spec 반영 완료, 구현은 open

- target 위치: `spec/5-system/12-webhook.md` WH-NF-02 요구사항(106행), §3.1 표(184행), §8(382행)
- 관련 plan: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/plan/in-progress/spec-sync-webhook-gaps.md` 세 번째 항목 ("본문 크기 분리 임계 — 인증 webhook 1MB 게이트", 체크박스 미완료)
- 상세: 사용자가 2026-06-28 옵션 C를 승인해 spec 에 결정 반영은 완료됐다. 그러나 plan 의 해당 체크박스(`[ ]`)는 "남은 구현 (developer): `/api/hooks/*` 라우트 스코프 body-parser limit(1MB) + 표준 413 게이트" 가 미완료 상태로 남아 있다. 이번 target 변경(spec 본문)은 이미 결정된 방향을 정확히 반영하고 있으며, 구현 gap 은 plan 에서 명확히 추적되고 있다. spec 내 "Planned" 표기도 유지되어 있어 충돌 없음.
- 제안: 현재 상태 정합. 별도 조치 불필요 — 구현 완료 시 plan 체크박스를 갱신하면 됨.

### [INFO] INVALID_SCHEMA 코드 — 3-error-handling.md 는 추가, 12-webhook.md §5.2 본문에는 누락

- target 위치: `spec/5-system/12-webhook.md` §5.2 400 응답 형식 (309–317행 신규 블릿 목록)
- 관련 plan: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/plan/in-progress/spec-sync-webhook-gaps.md` 두 번째 항목 ("400 검증 실패 필드 목록 surface", 체크 완료)
- 상세: `spec/5-system/3-error-handling.md §1.7`(140행) 및 `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 는 `INVALID_SCHEMA` 를 세 번째 field code 로 포함했다. 그러나 `spec/5-system/12-webhook.md §5.2` 의 신규 블릿(`error.details[]` 항목)은 `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` 만 나열하고 `INVALID_SCHEMA` 를 누락했다. plan의 spec-sync-webhook-gaps.md 는 `INVALID_SCHEMA` 를 구현된 것으로 기록하고 있으므로, 12-webhook.md §5.2 만 불완전하다.
- 제안: `spec/5-system/12-webhook.md §5.2` 의 `error.details[]` 설명 블릿에 `INVALID_SCHEMA`(스키마 구조 위반) 를 추가해 3-error-handling.md, manual-trigger.md, 코드(`toTriggerParameterErrorDetails`), plan 기록과 일치시킨다. `project-planner` 가 단독 1줄 수정으로 해소 가능하며, `consistency-check --spec` 후 merge 하면 된다.

## 요약

이번 target 변경(`spec/5-system/12-webhook.md`, `spec/5-system/3-error-handling.md`)은 `spec-sync-webhook-gaps.md` 에서 추적하던 두 갭(400 필드 목록 surface, 인증 webhook 본문 크기 결정)을 spec 수준에서 충실히 반영하고 있다. 미해결 결정을 일방적으로 우회하거나, 선행 plan 이 미해소된 전제를 가정하거나, 후속 항목을 무효화하는 사례는 발견되지 않는다. 다만 신규 field code `INVALID_SCHEMA` 가 `3-error-handling.md` 와 `1-manual-trigger.md` 에는 추가됐지만 `12-webhook.md §5.2` 본문에는 누락되어 동일 영역 내 문서 간 소규모 불일치가 존재한다. 이는 비차단 INFO 수준이며, `12-webhook.md §5.2` 에 1행 추가로 해소된다.

## 위험도

LOW
