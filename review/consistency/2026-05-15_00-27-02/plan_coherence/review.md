## 발견사항

### [INFO] `cafe24-pending-polish.md` 변경 3/4 체크박스 미갱신

- **target 위치**: `spec/1-data-model.md` §2.10 `install_token_issued_at`, `mall_id` 필드
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` 변경 3 (mall_id TOCTOU race 방어) · 변경 4 (pending_install TTL 정리) — 해당 체크박스 다수 unchecked 상태
- **상세**: `cafe24-data-model-strengthen.md` plan이 "cafe24-pending-polish.md 변경 3/4의 advisory lock·decrypt 비용·mall_id plain 컬럼 관련 항목을 완료 처리한다"고 기술하고 있으나, `cafe24-pending-polish.md` 자체의 체크박스에는 이 사실이 반영되지 않았다. 다만 `cafe24-pending-polish.md` 상단에 "변경 0~5 + ai-review 2 round 모두 처리 완료 → PR #18 머지 대기. 미체크 항목들은 범위 외 follow-up" 이라고 명시되어 있어 실질적 충돌은 아님.
- **제안**: `cafe24-pending-polish.md` 변경 3/4 관련 체크박스를 현재 plan 참조와 함께 [x] 표시하거나, 해당 plan이 PR #18 머지 후 `complete/`로 이동될 때 정리 필요.

---

### [INFO] `install_token` 부분 인덱스 UNIQUE 선언 deferred — spec과 일치

- **target 위치**: `spec/1-data-model.md` §3 인덱스 표 `(install_token) WHERE install_token IS NOT NULL` 행
- **관련 plan**: `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 B 3번 — "install_token DB UNIQUE 제약 V0XX 결정 — 별도 UNIQUE 제약은 deferred"
- **상세**: V043 인덱스 행에 UNIQUE 표기가 없고 V045 인덱스 행에는 명시적 UNIQUE가 있다. plan의 "deferred" 결정과 완전히 일치하므로 충돌 아님.
- **제안**: 운영 시점 재평가 예정 항목이므로 현 상태 유지. 향후 UNIQUE 추가 시 spec §3에 V0XX 주석과 함께 갱신 필요.

---

## 요약

`spec/1-data-model.md` §2.10 및 §3의 변경 내용(`install_token_issued_at` V044, `mall_id` V045 + partial UNIQUE 인덱스)은 현재 worktree의 `cafe24-data-model-strengthen.md` plan과 완전히 정합한다. 다른 in-progress plan 중 동일 spec 파일을 동시에 수정 중인 worktree는 없으며, 미해결 설계 결정(mall_id 방식 선택)은 사용자가 명시적으로 확정한 사항이다. INFO 2건은 추적 가독성 관련 사항으로 구현 착수를 블로킹하지 않는다.

## 위험도

**NONE** — 구현 착수에 blocking 없음.