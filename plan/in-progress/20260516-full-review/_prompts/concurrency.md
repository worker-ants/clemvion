# 동시성(Concurrency) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 코드베이스의 동시성·async 패턴을 면밀히 검토한다.

## 사용자 강조 관점

병렬 작업으로 인한 동시성 결함 위험:

1. **일관성** — async/await 사용 패턴, lock 사용 일관성
2. **스펙 준수** — replay 방지, 순차 보장 등 spec 정의 사항
3. **보안** — race condition 으로 인한 권한 우회·중복 처리
4. **리팩토링** — Promise.all vs sequential 의 누적된 잘못된 선택

## 최근 병렬 작업 컨텍스트

- B-1-3: timestamp replay Redis nonce — 동시성·원자성 핵심 영역
- B-5-8: install endpoint — concurrent install 시나리오
- WebSocket broadcast — pub/sub 동시성
- execution-engine 워크플로 동시 실행 — race condition 위험

## 검토 범위

- `codebase/backend/src/modules/execution-engine/` — 워크플로 실행 동시성
- `codebase/backend/src/modules/integrations/` — OAuth nonce, replay
- `codebase/backend/src/modules/websocket/` — broadcast
- `codebase/backend/src/modules/schedules/` — 스케줄 동시 트리거
- `codebase/backend/src/modules/triggers/`
- `codebase/frontend/src/lib/websocket/`, `codebase/frontend/src/lib/stores/` — 클라이언트 동시 상태

## 작업 지침

1. **경쟁 조건**: read-modify-write 패턴, unique check + insert
2. **데드락**: 여러 lock 의 순서, DB transaction 안에서 외부 호출
3. **원자성**: Redis nonce (SETNX or SET NX), DB unique constraint 활용
4. **async/await 정합성**: `forEach(async ...)`, missing `await`, `Promise.all` vs sequential 의 의도성
5. **이벤트 루프 블로킹**: sync 작업, 큰 JSON parse
6. **WebSocket 동시성**: 같은 user 의 여러 connection 처리, broadcast 안전성
7. **scheduler 안전성**: cron 중복 fire, leader election
8. **state 일관성**: 프론트엔드 Zustand store 동시 업데이트

## 출력 형식

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <path>:<line>
  - 상세
  - 제안

### 요약
1 문단

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: 운영에서 즉시 데이터 손상·권한 우회 가능. WARNING: 부하 증가 시 위험. INFO: 모범 사례.
