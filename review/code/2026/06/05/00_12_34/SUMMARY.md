# Code Review SUMMARY — feat(ai-agent) 메모리 임베딩 모델 선택 + recall/watermark 정합성

- Overall risk: LOW
- Critical: 0 (1 발견 → 같은 세션 내 수정 완료)
- Warning: 0

> 이 환경에서는 sub-agent fan-out 을 구동하는 Workflow/Agent tool 이 deferred
> 목록에 없어 호출 불가였다. main Claude 가 diff 전수를 다관점으로 수기 검토했고,
> 발견한 Critical 1건은 push 전 같은 세션에서 수정·재검증했다.

## 검토 범위
HEAD(14c6cc86): codebase 8파일 + spec 3파일. 임베딩 모델 선택, recall queryText
fallback, BullMQ dedup↔watermark 원자성, expires_at 엔티티 컬럼, spec doc-sync.

## 관점별 결과

### Correctness/Concurrency (M1) — Critical 1건 발견·수정
발견: scheduleExtraction 의 nonce dedup 검출은 BullMQ jobId dedup 이 jobIdKey
EXISTS 인 한(완료-보존 job 포함) 발동하는데 opts 가 removeOnComplete:100 으로
완료 job 을 retain → 직전 추출이 완료된 뒤에도 다음 enqueue 가 완료 job 으로
dedup-drop(false) 돼 watermark 가 영원히 전진 못하는 livelock 위험.
수정: removeOnComplete:true 로 완료 job 즉시 제거 → dedup 은 실제 in-flight job
에만 발동(=M1 이 보존해야 하는 케이스). fire-and-forget producer 라 완료 job
보존 불필요. 회귀 테스트 단언 갱신.

### Security — 통과
workspace_id 격리 무변경. embeddingModel 은 식별자 문자열로 파라미터 바인딩
경로로만 흐름. enqueueNonce 는 내부 마커(보안 토큰 아님).

### Database — 통과
AgentMemory.expiresAt 는 엔티티-마이그레이션(V080) 정합 보정. 새 컬럼/마이그레이션
없음. 데코레이터 스타일 기존 일치.

### Requirement/Doc-sync — 통과
spec 3종 갱신이 코드와 정합. V073 인덱스 실제 정의 (workspace_id, scope_key,
created_at) 확인 후 반영.

### Testing — 통과
신규 회귀: 임베딩 모델 recall/extraction 전달, M1 미전진+재수락 재snapshot,
M2 fallback, service 반환계약. 499 passed.

### Maintainability — 통과
기존 패턴 준수. 주석 근거 명시.

## 검증
- npm run build exit 0
- jest agent-memory ai-agent — 15 suites / 499 tests passed
- eslint(touched): 0 error, 1 warning(pre-existing)
