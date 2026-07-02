# Code Review 통합 보고서 — 06 C-2 (fresh, resolution 후)

## 위험도: HIGH (Critical 1 = testing)

## Critical
1. [testing] 기존 negative 테스트(execution-engine.service.spec.ts:~10863, "Execution not WAITING → RESUME_CHECKPOINT_MISSING")가 WAITING∪RUNNING 확장으로 무효화 — status:RUNNING 을 reject 값으로 세팅했으나 이제 허용값이라 가드 통과, 후속 미설정 mock TypeError 가 catch 흡수해 false-green. → (a) terminal(CANCELLED 등) reject 로 교체 (b) RUNNING 허용 positive 테스트 추가.

## Warning
2. [testing] reparkAiResumeTurn 신규 nodeExec.status=WAITING 재설정이 미테스트(기존 W5 describe 는 nodeExec=null만). nodeExec={status:RUNNING} mock 테스트 추가.
3. [testing] claimResumeEntry segmentStartMs 부수효과 미검증. 성공/실패 케이스 단언 추가.
4. [architecture/side_effect] claimResumeEntry 가 updateExecutionStatus choke point 우회(raw UPDATE) + segmentStartMs 수동 복제. JSDoc 상호참조 1줄.
5. [side_effect] Execution 짝 UPDATE affected 미검사 — cancel-vs-resume 극단 케이스 이론적 짝 불일치. 방어/로그 검토.

## INFO (비차단)
8. plan 06-concurrency C-2 체크박스 미갱신(후속). 9. spec Rationale ALLOWED_TRANSITIONS 노트 정정(claim 은 assertTransition 우회). 11. dockerized e2e → 225 PASS 로 충족. 그 외 서비스 비대화·row-lock 주석 등.

## 재시도 필요(파일 유실): security·scope·documentation.
