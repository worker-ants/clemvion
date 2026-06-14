# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)  
Target scope: `spec/5-system/` (diff vs origin/main)  
변경 파일: `3-error-handling.md` · `4-execution-engine.md` · `6-websocket-protocol.md`

---

## 발견사항

### [INFO] `EXECUTION_INTERNAL_ERROR` vs `INTERNAL_ERROR` — 동명 혼동 가능성 주석으로 해소됨
- target 위치: `spec/5-system/6-websocket-protocol.md` §4.2 에러 코드 표 + §6 `INTERNAL_ERROR` 행 주석
- 충돌 대상: `spec/5-system/6-websocket-protocol.md` §6 (WsErrorCode 표) 의 기존 `INTERNAL_ERROR`
- 상세: 신규 코드 `EXECUTION_INTERNAL_ERROR` (`ErrorCode` enum, continuation 평면 ack 전용)와 기존 `INTERNAL_ERROR` (`WsErrorCode` enum, transport/enqueue 실패 전용)은 "내부 오류" 라는 의미가 겹쳐 혼동될 수 있다. target 문서는 `INTERNAL_ERROR` 행에 "`WsErrorCode` 의 transport 레벨 코드 … `EXECUTION_INTERNAL_ERROR` 와 **별개 scope**" 라는 주석을 추가해 명시적으로 분리했다. 이중 등록 자체는 의도적이며 두 코드의 enum 소속·surface 모두 일관성 있게 기술되어 있어 실질적 모순은 없다.
- 제안: 현재 주석으로 충분히 해소됨. 추가 조치 불필요.

### [INFO] `EXECUTION_MESSAGE_TOO_LONG` 메시지 최대 길이(10000자) 수치가 `6-websocket-protocol.md` 에만 기술됨
- target 위치: `spec/5-system/6-websocket-protocol.md` §4.2 에러 코드 표 (`EXECUTION_MESSAGE_TOO_LONG` 행, "10000자")
- 충돌 대상: `spec/5-system/4-execution-engine.md` §7.5.2 (동일 코드 언급) / `spec/5-system/3-error-handling.md` §1.5 (등재만)
- 상세: `6-websocket-protocol.md` 의 `EXECUTION_MESSAGE_TOO_LONG` 행은 "최대 길이(10000자)" 수치를 명시하지만, `4-execution-engine.md` §7.5.2 와 `3-error-handling.md` §1.5 의 동일 코드 항목은 수치 없이 "최대 길이 초과" 로만 기술한다. 수치가 단일 spec 파일에만 박혀 있어 다른 소비자(frontend·API 문서)가 참조 문서에 따라 수치를 찾지 못할 수 있다. 모순은 아니지만 동기화 부재.
- 제안: `4-execution-engine.md` §7.5.2 의 해당 코드 설명에 "(10000자)" 를 추가하거나, 수치 SoT 를 `6-websocket-protocol.md` 로 명시하는 인라인 링크를 추가. 마이너 동기화 이슈로 blocking 아님.

### [INFO] `3-error-handling.md §1.5` 에 추가된 두 코드의 WS-only 섹션 분류 일관성
- target 위치: `spec/5-system/3-error-handling.md` §1.5 신규 행 2개
- 충돌 대상: `spec/5-system/3-error-handling.md §1.5` 서두 ("WebSocket ack 응답 전용이며 REST API 에는 적용되지 않는다")
- 상세: `EXECUTION_MESSAGE_TOO_LONG`·`EXECUTION_INTERNAL_ERROR` 는 continuation ack 전용 코드이므로 §1.5 의 WS-only 분류에 정합한다. 기존 §1.5 등재 코드들이 "도메인 spec 이 SoT" 로 참조하는 구조와 동일하게, 신규 두 코드도 SoT 를 `4-execution-engine.md §7.5.2` 로 참조하고 있어 일관성이 있다. 실질 모순 없음.
- 제안: 조치 불필요.

---

## 요약

이번 변경(`spec/5-system/3-error-handling.md` · `4-execution-engine.md` · `6-websocket-protocol.md`)은 WS continuation ack 에서 내부 에러 메시지 누출을 차단하는 `ExecutionError` 타입 계층 도입과 두 신규 에러 코드(`EXECUTION_MESSAGE_TOO_LONG`, `EXECUTION_INTERNAL_ERROR`) 등재로 구성된다. 세 파일 간 교차 참조가 정합하며, 기존 `spec/conventions/error-codes.md` 의 명명 원칙(`EXECUTION_*` 네임스페이스 확장·기존 코드 이름 유지·`UPPER_SNAKE_CASE`)과 `spec/5-system/3-error-handling.md` §1.5 의 WS-only 분류 구조를 모두 준수한다. `INTERNAL_ERROR` (WsErrorCode·transport 레벨)와 `EXECUTION_INTERNAL_ERROR` (ErrorCode·continuation 평면 ack) 의 동명 혼동 가능성은 §6 표 주석으로 scope 를 분리해 해소했다. CRITICAL·WARNING 등급의 spec 간 직접 모순은 발견되지 않았으며, `6-websocket-protocol.md` 에만 박힌 메시지 길이 수치(10000자) 동기화가 INFO 수준 개선 포인트로 남는다.

---

## 위험도

LOW
