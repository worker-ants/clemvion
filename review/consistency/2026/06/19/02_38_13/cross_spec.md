# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전)
**대상 spec**: `spec/5-system/4-execution-engine.md`
**검토 일시**: 2026-06-19

---

## 발견사항

검토 결과, 현 `spec/5-system/4-execution-engine.md` 와 다른 영역 spec 간의 **직접 모순은 없다.** 아래는 구현 착수 전 주의해야 할 잠재적 불일치·동기화 권장 항목이다.

### [INFO] `spec-sync-execution-engine-gaps.md` 가 `plan/complete/` 로 이동됐으나 frontmatter `pending_plans:` 참조 잔류

- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 라인 11
  ```
  - plan/in-progress/spec-sync-execution-engine-gaps.md
  ```
- 충돌 대상: 해당 파일은 현재 `plan/complete/spec-sync-execution-engine-gaps.md` 에 존재 (`plan/in-progress/` 경로 없음)
- 상세: frontmatter 가 이미 complete 된 plan 을 `in-progress` 경로로 참조하므로, spec 의 `pending_plans:` 링크가 깨진 상태다. 구현 착수 시 도구가 해당 plan 을 미완으로 오인할 수 있다.
- 제안: frontmatter 에서 해당 줄을 삭제하거나 `plan/complete/spec-sync-execution-engine-gaps.md` 로 교정.

### [INFO] `§7.5.2` 의 `RESUME_*` 후행 이벤트 누출 차단 원칙이 WS 이벤트 빌더 경로에서 명시적으로 미완

- target 위치: `spec/5-system/4-execution-engine.md §7.5.2` 끝 주석
  > "worker 측 비동기 실패(`RESUME_*`, §7.5.1)는 본 동기 ack 변환 경로 밖이다 — 후행 `execution.cancelled` 이벤트로 통지되며, 동일 누출 차단 원칙(내부 message 미노출, code 만)은 그 이벤트 빌더에도 적용된다(**별도 경로라 본 변경 범위 밖, 후속 점검 항목**)."
- 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.2` — continuation 에러 코드 표. `spec/5-system/3-error-handling.md §1.5`
- 상세: spec 본문이 스스로 "본 변경 범위 밖, 후속 점검 항목"으로 표기한 미완 영역. WS `execution.cancelled` 이벤트 빌더(worker 측 RESUME_* 실패 경로)의 내부 message 누출 차단이 spec 상에서 확정되지 않아, 구현 시 동기 ack 경로와 비동기 cancelled 이벤트 경로의 보안 게이트 일관성이 깨질 수 있다.
- 제안: LLM error passthrough 구현 범위가 이 경로(worker 측 비동기 cancelled 이벤트)를 건드린다면, 구현 전 `spec/5-system/4-execution-engine.md §7.5.2` 주석을 정식 spec 절로 확정하고 `spec/5-system/6-websocket-protocol.md` 에 동기화.

### [INFO] `§7.5` rehydration 의 outbound routing context 재등록 — 실패 시 best-effort 처리가 채널 어댑터 에러 전달에 영향

- target 위치: `spec/5-system/4-execution-engine.md §7.5` rehydration 시퀀스 중 `outbound routing context 재등록` 단계
  > "best-effort: 등록 실패 시 warn 로그만 남기고 rehydration 은 계속."
- 충돌 대상: 동일 §7.5 의 `RESUME_INCOMPATIBLE_STATE` graceful 안내 조건
  > "graceful 안내가 외부 채널에 실제로 도달하려면 outbound routing context 재등록 단계가 선행돼야 한다."
- 상세: 두 명제가 모순으로 보인다 — 재등록 실패 시 best-effort(rehydration 계속) 이지만, 재등록 없이는 RESUME_INCOMPATIBLE_STATE 에러가 채널에 도달하지 못한다. 충돌이라기보다 "best-effort 실패 + 채널 미전달" 의 허용 trade-off가 spec 에 명시되지 않은 정도의 미완이다. 모순이 아닌 이유는 두 문장이 "fail-safe 동작(실행 계속)"과 "best-case 동작(채널 전달)"을 각각 설명하기 때문이다. 다만 LLM error passthrough 구현이 이 경로를 건드린다면 채널 전달 실패 허용 여부가 구현 의사결정에 영향을 준다.
- 제안: 구현 시 이 trade-off 를 확인하고, 필요 시 spec 에 "best-effort 실패 = 채널 전달 없음, 수용된 trade-off" 로 명시.

### [INFO] `§9.2` Redis 키 표의 `exec:seq:<executionId>` — sliding-window TTL `DEL` 가 best-effort로만 명시됨

- target 위치: `spec/5-system/4-execution-engine.md §9.2` `exec:seq:<executionId>` 행
  > "terminal event 발송 후 best-effort `DEL`"
- 충돌 대상: `spec/5-system/6-websocket-protocol.md §2.2 seq` 정책, `spec/5-system/14-external-interaction-api.md §R7`
- 상세: seq 공유 정책(`WS envelope seq` / `SSE id:` / `Outbound Notification seq` 공유)의 TTL 정리가 best-effort `DEL` 에만 의존하는데, DEL 실패 시의 메모리 누수 허용도가 spec 에 명시되지 않았다. 중대 충돌은 아니며 동작에 영향을 주지 않는다. 단, LLM error passthrough 구현이 execution 종료 경로를 건드린다면 terminal DEL 누락 시의 메모리 누수 범위를 인지해야 한다.
- 제안: 구현 관심사로만 메모. spec 변경 불필요.

---

## 요약

`spec/5-system/4-execution-engine.md` 와 관련 영역(`spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/1-data-model.md`) 간의 **직접 모순(CRITICAL/WARNING 등급 충돌)은 발견되지 않는다.** 데이터 모델(Execution 상태 머신, NodeExecution 상태), API 계약(continuation BullMQ 큐·메시지 타입·ack shape), 에러 코드 어휘(`EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG`·`RESUME_*`·`INVALID_EXECUTION_STATE`), 상태 전이(waiting_for_input → failed, WFI → cancelled), RBAC, 계층 책임(엔진 sink 정책, Integration Handler 베이스)이 모두 정합하다. 발견된 4건은 모두 INFO 등급으로, frontmatter 경로 오기 1건과 spec 자체가 "후속 점검 항목"으로 표기한 미완 설명 영역 2건, best-effort 정책 명시 미완 1건이다. LLM error passthrough 구현 착수에 대한 BLOCK 사유는 없다.

## 위험도

LOW

STATUS: SUCCESS
