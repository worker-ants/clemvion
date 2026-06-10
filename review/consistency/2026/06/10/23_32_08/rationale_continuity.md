# Rationale 연속성 검토 결과

검토 모드: spec draft (--spec)
Target: `plan/in-progress/spec-update-ws-resumed-ack.md`
검토 기준 spec Rationale 출처:
- `spec/5-system/6-websocket-protocol.md ## Rationale`
- `spec/5-system/4-execution-engine.md ## Rationale`
- `spec/0-overview.md ## Rationale`

---

## 발견사항

### INFO — target Rationale 가 spec 에 이미 적용·반영된 상태

- target 위치: `plan/in-progress/spec-update-ws-resumed-ack.md § Rationale`
- 과거 결정 출처:
  - `spec/5-system/6-websocket-protocol.md ## Rationale` — `"resumed 의미 재정의 — '재개 성공' → 'enqueue 수락' (2026-06-10 spec-sync, refactor 06 M-1)"` 항
  - `spec/5-system/4-execution-engine.md ## Rationale` — `"RESUME_* 동기 ack 노출 폐기 — 후행 EXECUTION_CANCELLED 이벤트로 일원화 (2026-06-10 spec-sync, refactor 06 M-1)"` 항
- 상세: target plan 이 제안한 양 변경(`resumed` 의미 재정의 + `§7.5` 동기 ack 서술 정정)은 이미 spec 본문과 ## Rationale 에 모두 착지해 있다. spec 본문 `6-websocket-protocol.md:245`에 `resumed | boolean | 재개 시작 수락(enqueue) 여부`로 정정됐고, `4-execution-engine.md:967`에 "이 셋 모두 worker 측 비동기(post-enqueue) 실패이므로 동기 ack 가 아니라 후행 `EXECUTION_CANCELLED` 이벤트로 사용자에게 통지된다"로 수정됐다. 두 ## Rationale 섹션 모두 번복 사유(`always-enqueue 모델`, `대안 B 기각`, `코드 무변경`)를 명시적으로 기록하고 있다.
- 제안: target plan 은 이미 완료 처리(`spec_impact` frontmatter 추가 후 `plan/complete/`로 이동)해도 무방하다.

### INFO — `retry_last_turn resumed:false` 경계 구분 — Rationale 기록 정합

- target 위치: `plan/in-progress/spec-update-ws-resumed-ack.md` "retry_last_turn(별 명령)의 `resumed: false` 분기" 주석
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md ## Rationale "§4.2 submit_form/click_button payload·ack 정정"`, `6-websocket-protocol.md:236` (`retry_last_turn 은 예외` 노트)
- 상세: target 이 "retry 는 RESUME_* 적용 대상 아님, 4종 continuation ack 한정" 이라는 경계를 서술한 것은 `spec:236`의 `retry_last_turn 은 예외` 노트 및 RESUME_* 적용 대상 표(`spec:306`)와 완전히 일치한다. 기각된 대안 재도입이나 원칙 위반 없음.

---

## 요약

target plan 문서(`spec-update-ws-resumed-ack.md`)가 제안한 두 spec 정정 — (1) WS §4.2 `resumed` 필드 정의를 "재개 성공" 에서 "enqueue 수락"으로, (2) 엔진 §7.5 `RESUME_*` 노출 경로를 동기 ack 에서 후행 `EXECUTION_CANCELLED` 이벤트로 — 은 `spec/5-system/6-websocket-protocol.md` 및 `spec/5-system/4-execution-engine.md` 의 본문과 ## Rationale 섹션에 모두 착지 완료돼 있다. 과거 Rationale 에서 명시적으로 기각된 대안(대안 B: worker 동기 대기 반환)은 재도입되지 않았고, `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"`의 always-enqueue invariant를 정면으로 따르고 있다. 결정 번복이 있었으나(옛 "재개 성공" 정의) 그 사유가 두 ## Rationale 항에 모두 명시돼 있어 무근거 번복이 아니다. Rationale 연속성 관점에서 충돌·위반 사항 없음.

## 위험도

NONE
