## 발견사항

### [INFO] `sendMessage` 스트리밍 종료 정리 범위 확장
- **위치**: `frontend/src/lib/stores/assistant-store.ts` — `sendMessage` 함수 마지막 `set` 블록
- **상세**: 기존 코드는 `m.id === assistantId` 로 단 하나의 row 만 `streaming: false` 처리했으나, 변경 후 `m.streaming` 전체 스캔으로 바뀌었다. auto_resume 으로 push 된 새 row 를 정리하기 위해 필요한 변경이고 주석으로 의도가 명시되어 있다. 단, `isStreaming` 가드가 동시 스트림을 차단하므로 실질적 부작용은 없다.
- **제안**: 현재 변경이 적절하나, 향후 동시 스트림을 허용하는 리팩토링 시 이 점을 재검토할 것.

### [INFO] `STALL_MAX_ATTEMPTS` 상수 프론트-백엔드 중복 선언
- **위치**: `frontend/src/lib/stores/assistant-store.ts:67`
- **상세**: 백엔드 `MAX_STALL_ROUNDS = 2` 와 동일한 값을 프론트가 `STALL_MAX_ATTEMPTS = 2` 로 별도 선언. rehydrate 시 `autoResumeAttempt` 만으로 "N/M" 포맷을 구성하기 위해 불가피한 중복이며, 주석에 동기화 책임이 명시되어 있다.
- **제안**: 유지보수 체크리스트(§10)에 이미 기재되어 있어 별도 조치 불필요.

### [INFO] `persistAssistantTurn` 에러 경로에도 `resumeMeta` 전달
- **위치**: `workflow-assistant-stream.service.ts` 두 에러 블록 (`~line 386`, `~line 780`)
- **상세**: LLM 연결 에러 발생 시에도 `consecutiveStallRounds > 0` 이면 `autoResumed=true` 가 에러 row 에 기록된다. 에러가 stall 복구 진행 중에 발생한 경우를 정확히 표현하는 논리적 결정으로 범위 이탈이 아니다.

---

## 요약

12개 파일 전체가 "stall 자동 복구 시 메시지 박스 분리 + `auto_resume` SSE 이벤트" 라는 단일 기능 범위에 집중되어 있다. DB 마이그레이션 → 엔티티 → 서비스 로직 → SSE 타입 → 프론트 스토어 → UI 컴포넌트 → i18n → 테스트 → 스펙/메모리 문서까지 연관 레이어를 빠짐없이 커버하며, 의도와 무관한 리팩토링, 포맷팅 잡음, 불필요한 임포트 변경은 발견되지 않았다. `sendMessage` 의 스트리밍 정리 범위 확장은 새 기능이 만드는 다수의 streaming row 를 올바르게 처리하기 위해 필요한 최소 변경이다.

## 위험도

**NONE**