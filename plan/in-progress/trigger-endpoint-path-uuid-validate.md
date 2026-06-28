---
worktree: trigger-endpoint-validate-bb15e3
started: 2026-06-28
owner: developer
spec_impact: none
---

# V102 CHECK 제약 VALIDATE 승격 (V103)

> 선행: PR #750 (V102 `chk_trigger_endpoint_path_uuid` NOT VALID 추가). INFO #1/#5 후속.

## 배경

V102 는 레거시 비-UUID `endpoint_path` 가능성 때문에 `NOT VALID`(기존 행 미검증)로 추가됐다.
운영 전수 조회 결과 `endpoint_path IS NOT NULL` row 4건 전부 v4 UUID(비-UUID 0건, 2026-06-28
사용자 확인)이므로 `VALIDATE CONSTRAINT` 로 승격해 제약을 완전 강제한다.

## 변경

- `V103__trigger_endpoint_path_uuid_validate.sql` — pre-flight 위반 0건 가드 → `ALTER TABLE
  trigger VALIDATE CONSTRAINT chk_trigger_endpoint_path_uuid`. 짧은 SHARE UPDATE EXCLUSIVE lock.

## 부수 — 기존 Gate C 회귀 2건 (TEST WORKFLOW 중 발견·수정)

origin/main 누적 pre-existing red(spec/plan-only PR 이 frontend unit 미실행 — 메모리
feedback_spec_impact_gate_c_list 재발):
- `plan/complete/webchat-usewidget-split.md`: `spec_impact: []` → `none` (빈 리스트는 Gate C 불허).
- `plan/complete/webchat-spec-polish-followups.md`: `spec_impact` 누락 → 머지가 touch 한
  spec/7-channel-web-chat 5파일 리스트 등록.

## 체크리스트

- [x] V103 migration 추가
- [x] (부수) Gate C 회귀 2건 수정
- [x] TEST: lint·unit·build PASS · **e2e 219/219 PASS** (Flyway 가 V103 적용)
- [x] `/ai-review` (11_30_45) — CRITICAL=0·WARNING=1, WARNING 은 검증 결과 안전(`.conf` 없음=transactional default, e2e 적용 성공). RESOLUTION.md 기록
- [ ] `/consistency-check --impl-done`
