# 성능(Performance) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 코드베이스 **전체** 를 성능 관점에서 면밀히 검토한다. 누적 상태 audit 이다.

## 사용자 강조 관점

병렬 작업 누적으로 성능 회귀 위험:

1. **일관성** — 같은 패턴이 한쪽은 최적화, 다른 쪽은 미적용
2. **스펙 준수** — `spec/conventions/` 의 성능 관련 규약
3. **보안** — DoS 잠재 (정규식 ReDoS, 무제한 페이지네이션 등)
4. **리팩토링** — 알고리즘·자료구조 선택 일관성

## 최근 병렬 작업 컨텍스트

- cafe24 OAuth 영역 다수 변경 — DB 쿼리·외부 API 호출 패턴 점검
- 모든 워크플로 노드 (`codebase/backend/src/nodes/`) 가 성능 hot path
- WebSocket, execution-engine 영역의 동시성·메모리 사용

## 검토 범위

- `codebase/backend/src/modules/` — execution-engine, workflows, statistics, websocket, llm 우선
- `codebase/backend/src/nodes/` — 노드 실행 hot path
- `packages/expression-engine/` — 사용자 표현식 평가 hot path
- `codebase/frontend/src/components/editor/` — workflow editor 렌더링 성능
- `codebase/frontend/src/lib/stores/` — Zustand 류 상태 관리
- `spec/5-system/` — 비기능 요구사항

## 작업 지침

1. **N+1 쿼리** — `findOne` / `find` 가 loop 안에 있는지, eager/lazy loading 일관성
2. **블로킹 I/O** — `await` 누락, sync file I/O, sync crypto
3. **메모리 누수** — 이벤트 리스너 cleanup, WebSocket 리스너, setInterval/setTimeout
4. **알고리즘 복잡도** — O(n²) loop, 정렬 후 indexOf 등
5. **캐싱** — 동일 입력 반복 호출 (config, schema, node definition)
6. **번들 크기** — frontend dynamic import 누락, 큰 lib 전체 import
7. **DB 인덱스 활용** — `WHERE`·`ORDER BY`·`JOIN` 컬럼이 인덱스를 타는지 (database-reviewer 와 협업 영역)
8. **ReDoS** — 사용자 입력을 정규식으로 처리하는 곳
9. 결과는 `output_file` 에 Write. STATUS 한 줄만 반환.

## Performance-specific 강조 포인트

- expression-engine 의 evaluator hot path
- execution-engine 의 노드 체이닝 비용
- WebSocket broadcast scale-out 가능성
- Cafe24 API 외부 호출 retry/timeout/backoff
- frontend re-render 폭증 (불필요 useEffect dep)

## 출력 형식

`output_file` 에 markdown Write:

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <path>:<line>
  - 상세: 측정 가능한 영향 (예: "1k row 에서 N+1 → 1001 쿼리")
  - 제안: 권장 수정

### 요약
1 문단

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: 운영 부하 시 즉각 장애. WARNING: 사용량 증가 시 문제. INFO: 작은 최적화.
