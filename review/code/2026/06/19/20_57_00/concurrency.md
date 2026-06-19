# 동시성(Concurrency) 리뷰

## 발견사항

### 발견사항 1

- **[INFO]** 워치독 서브쉘과 스테이지 프로세스 간 TIMEOUT_MARKER 파일 공유 — 경쟁 조건 없음
  - 위치: `.claude/tools/run-test.sh` 라인 193–216 (워치독 블록)
  - 상세: `TIMEOUT_MARKER` 파일은 워치독 서브쉘이 쓰고(`:`>`"$TIMEOUT_MARKER"`), 메인 쉘이 `wait "$FUNC_PID"` 완료 후 읽는다. `wait`가 배리어 역할을 하므로 실질적인 경쟁 조건은 없다. 이론적으로 TERM 신호 이후 `sleep 15` 대기 중 메인 쉘의 `wait "$FUNC_PID"`가 반환되어 워치독이 `kill -KILL` 실행 전에 종료될 수 있으나, FUNC 프로세스 그룹이 이미 TERM으로 종료된 뒤 wait가 반환되는 정상 경로이므로 KILL 누락이 실질 문제가 되지 않는다.
  - 제안: 현재 설계로 충분. 마커 쓰기 타이밍(TERM 전에 마커 작성)은 타임아웃 판정을 보수적으로 잡는 의도적 설계로 이해되어 변경 불필요.

### 발견사항 2

- **[INFO]** `set -m` (job control) 사용 범위 최소화 확인
  - 위치: `.claude/tools/run-test.sh` 라인 188–191
  - 상세: `set -m`은 스크립트 전체 쉘의 job control 모드를 변경하나, `FUNC_PID=$!` 직후 `set +m`으로 즉시 복원한다. 독립 실행 스크립트로 사용되는 경우 부모 프로세스에 영향 없음. `source`로 포함 시 부모 쉘 모드가 일시 변경되는 사이드 이펙트가 있으나, 이 스크립트는 직접 실행용으로 설계되어 있으므로 실용적 위험 없음.
  - 제안: 현재 상태 양호. 주석에 목적 설명이 명시되어 있어 유지보수성도 확보됨.

### 발견사항 3

- **[INFO]** `forceExit: true` — 오픈 핸들 마스킹
  - 위치: `codebase/backend/jest.config.ts` (forceExit 추가); `codebase/backend/test/jest-e2e.json` (forceExit 추가)
  - 상세: `forceExit`는 TypeORM 풀, Redis/BullMQ 클라이언트, 타이머 등 오픈 핸들을 닫지 않고 프로세스를 강제 종료한다. 리소스 누수 자체는 해결되지 않으며 teardown 버그를 숨길 위험이 있다. 그러나 테스트 전용 설정이고 운영 배포와 무관하다.
  - 제안: 주석에 이미 `--detectOpenHandles`로 근본 원인을 찾아 `afterAll`에서 닫으라는 지침이 명시되어 있어 의도가 명확하다. 중장기적으로 오픈 핸들 근본 수정을 별도 태스크로 추적 권장.

---

## 요약

변경 핵심은 `run-test.sh`의 워치독 구현으로, 프로세스 그룹 기반 TERM→KILL 패턴을 순수 bash로 구현했다. `FUNC_PID` 백그라운드 프로세스와 워치독 서브쉘 간 통신은 파일 마커 단 하나이며, `wait "$FUNC_PID"`가 동기화 배리어 역할을 하여 실질적 경쟁 조건이 없다. `set -m` 노출 범위도 최소화되어 있다. Jest `forceExit`는 테스트 환경 한정 오픈 핸들 마스킹으로 동시성 관점에서 위험하지 않다. 전체적으로 동시성 설계가 안전하며 차단 수준의 위험 요소는 발견되지 않았다.

## 위험도

LOW
