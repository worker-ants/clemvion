# Plan 정합성 검토 — spec/data-flow/ (--impl-done)

## 검토 대상 요약

diff 범위(`origin/main`(8a2d13031) → HEAD(e7ad5ca1f), 3 커밋)는 `IdempotencyInterceptor`
의 캐시 엔트리 내부 `responseJson` 손상 방어(fail-open 완성) + 그 뒤 자기 자신의
`/ai-review` 라운드가 지적한 문서/테스트 드리프트 정정뿐이다. `spec/data-flow/**` 자체는
이번 diff 에서 변경되지 않았다.

## 발견사항

없음.

이 작업은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "캐시 엔트리 내부
`responseJson` 손상은 무방비" 항목(이미 `18_07_36` testing INFO 1 로 등재)을 정확히
집행한 것이고, 그 plan 체크박스 갱신([ ] → [x], "완료 (2026-08-12,
`eia-idem-responsejson-guard`)" 서술 추가)이 **이번 diff 안에 함께 포함**돼 있다
(`plan/in-progress/backend-lint-gate-broken-on-main.md:618`). 즉 구현과 plan 기록이
같은 커밋 묶음에서 동기화됐다.

같은 plan 파일에 남아 있는 다른 미해결 항목들을 전수 확인했으나 이번 diff 와 충돌하거나
선행조건으로 얽힌 것이 없다:

- `readKey`/`hashBody` 경계값 테스트 부재 (line 632, 선재 갭, 이번 diff 범위 밖 — 그대로 유지)
- `CCH-SE-02` update dedup 미배선 (line 635, chat-channel in_process_trusted 경로 — HTTP
  인터셉터를 안 타므로 이번 diff 와 무관)
- EIA Redis 키가 실행엔진 §9.1/§9.2 레지스트리에 없음 (line 647, 키 네이밍 자체는
  이번 diff 에서 안 건드림)
- idempotency fail-open 구간 관측·중복억제 (line 532, concurrency WARNING, "Redis 장애"
  축이라 이번 diff 의 "캐시 엔트리 손상" 축과 다른 문제)

`spec/data-flow/15-external-interaction.md` 의 idempotency 관련 서술(§1.2 시퀀스 · §2.2
Redis 표 · §외부 의존 "전 경로 fail-open(warn) — 가용성 우선" · Rationale "idempotency
저하" 문단)은 3-세그먼트 캐시 키·R8 닫힌 목록(`2xx`·`409`·`410`)·fail-open 요구를 이미
정확히 반영하고 있어(`plan-in-progress/spec-draft-eia-r8-alignment.md` 와
`eia-idempotency-key-scope` 선행 planner 턴에서 이미 정합화됨), 이번 diff 의 코드
docstring 확장("다섯 경로 표")이 그 SoT 와 충돌하지 않는다.

## 참고 (INFO, 비차단)

- **`plan/in-progress/spec-draft-eia-r8-alignment.md`** 는 체크리스트 전 항목이 `[x]`
  이고 미해결 후속이 없어 보이나 `status: in-progress` 로 `plan/in-progress/` 에 남아
  있다. 이번 diff 가 만든 상태는 아니고(그 문서 자체는 이번 diff 에서 변경되지 않음),
  이번 diff 와 같은 EIA R8 영역이라 눈에 띄어 남긴다 — `plan/complete/` 이동 대상인지
  다음 planner 턴에서 확인할 만하다.

## 요약

이번 PR 은 자기 완결적인 fail-open 하드닝 + 자체 리뷰 루프 정정이며, `spec/data-flow/`
가 이미 정합화돼 있는 R8/캐시-키-스코프 서술과 충돌하지 않는다. `plan/in-progress/`
의 관련 미해결 항목(경계값 테스트·CCH-SE-02 dedup·Redis 키 레지스트리·fail-open 구간
관측) 중 이번 diff 와 선행조건·결정 축이 겹치는 것이 없고, 정작 이 작업이 겨냥한 plan
항목은 같은 diff 안에서 체크박스까지 동기화됐다. 후속 항목 누락이나 미해결 결정 우회는
발견되지 않았다.

## 위험도
NONE
