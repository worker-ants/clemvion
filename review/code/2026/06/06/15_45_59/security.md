# 보안(Security) 리뷰 결과

## 발견사항

### 발견사항 없음 — INFO 수준 관찰 2건

- **[INFO]** `processFormResumeTurn` — sentinel 없는 폴백 분기에서 `payload` 원본이 그대로 폼 데이터로 사용됨
  - 위치: `execution-engine.service.ts`, `processFormResumeTurn` 내 `ExecutionEngineService.isFormSubmittedSentinel(payload)` 분기
  - 상세: sentinel 검증 실패 시 `payload` 를 `formData` 로 그대로 전달한다. 이 경로는 정상 `continueExecution` 경유가 아닌 "비정상 경로"이며, warn 로그를 남긴다. 실제 payload 는 BullMQ 큐를 통해 도달하므로 공격자가 직접 주입하기 어렵고, 하위 폼 처리 로직이 `allowedFields` 화이트리스트 필터링을 적용한다면 실질 위험은 낮다. 그러나 sentinel 없는 경로가 생산 트래픽에서 발화하지 않도록 모니터링이 필요하다.
  - 제안: 폴백 분기에서 단순 warn 에 그치지 않고 `payload` 를 완전히 reject(빈 formData 반환 또는 조기 return)하는 것이 더 방어적이다. 현재 warn 만 기록하고 처리를 계속한다.

- **[INFO]** e2e 테스트의 Raw SQL 쿼리에 사용자 입력 직접 삽입 위험 없음 (테스트 코드 한정)
  - 위치: `execution-park-resume.e2e-spec.ts`, `db.query(...)` 호출부
  - 상세: `$1` 파라미터 바인딩을 올바르게 사용하고 있으며 SQL 인젝션 위험 없음. 테스트 코드이므로 운영 영향 없음.
  - 제안: 현행 유지.

---

## 요약

이번 변경은 실행 엔진의 in-memory 상태 머신(`pendingContinuations`, `firstSegmentBarriers`, `firePayload` 폴링, `runAiConversationLoop` 장수 루프)을 완전히 제거하고, 모든 park·재개를 §7.5 DB-durable rehydration 단일 경로로 일원화한 대규모 리팩토링이다. 보안 관점에서 중요한 변화는 다음과 같다. (1) 인젝션·하드코딩 시크릿·암호화 관련 코드 변경 없음. (2) 인증/인가 경로는 변경 범위 밖이며 BullMQ 큐 진입 이전 단계에서 처리된다. (3) AI 메시지 길이 가드(`10_001` 자 초과 silent drop)는 유지됐고, 이제 `rehydrateAndResume` 진입 전에 동작함을 테스트로 검증한다. (4) in-memory resolver Map 제거로 동일 인스턴스 내 resolver 충돌·stomp·race condition 계열 취약점이 구조적으로 사라졌다. (5) `cancelParkedExecution` 은 `WAITING_FOR_INPUT` 가드가 있는 UPDATE 문으로만 취소를 수행하므로, RUNNING 중 cancel 은 no-op(DB 레벨 멱등) — 취소가 잘못된 상태를 덮어쓸 가능성이 없다. (6) `resume_call_stack` JSONB 컬럼은 버전 가드(`CALL_STACK_SCHEMA_VERSION`)가 있어 미래 버전 포맷에 대한 안전 종결이 보장된다. (7) `processFormResumeTurn` 의 sentinel 폴백 분기에서 payload 가 그대로 전달되는 부분이 방어적이지 않으나, 실질 공격 벡터는 BullMQ 큐 접근 권한이 필요하므로 INFO 수준이다. 전체적으로 이번 변경은 보안 측면에서 중립 이상이며, in-memory 상태 머신 제거로 복잡도 관련 잠재 위험이 감소했다.

## 위험도

LOW

---

STATUS: SUCCESS
