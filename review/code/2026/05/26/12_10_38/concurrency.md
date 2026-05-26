# 동시성(Concurrency) 리뷰 결과

## 발견사항

해당 없음.

변경 대상 파일 전체(파일 1–11)는 React 클라이언트 컴포넌트와 테스트 코드로 구성되어 있다. 핵심 변경 내용은 `llmConfigsApi.getAll()` 호출을 `llmConfigsApi.list()` 로 교체하고, 이중 응답 형태(`{ data: LlmConfigData[] } | LlmConfigData[]`)를 정규화하던 IIFE/useMemo 블록을 제거해 타입이 정립된 배열 반환으로 단순화한 것이다.

구체적으로 동시성 리뷰 관점별 확인 결과:

1. **경쟁 조건** — 변경 전후 모두 동일 QueryKey(`"llm-configs"` / `LLM_CONFIGS_QUERY_KEY`)를 사용하는 TanStack Query 캐시를 공유한다. Query 캐시는 단일 직렬 상태 머신으로 관리되므로 여러 컴포넌트가 동시에 동일 키를 구독해도 경쟁 조건이 없다. 이 구조는 변경 전과 동일하며 변경으로 새 위험이 도입되지 않는다.

2. **데드락** — React 단일 스레드 이벤트 루프 환경이며 락 메커니즘이 없다. 해당 없음.

3. **동기화** — TanStack Query의 `staleTime: 30_000` 설정이 유지되며 중복 네트워크 요청을 억제한다. 변경 없음.

4. **스레드 안전성** — 브라우저 JavaScript는 단일 스레드 모델이다. 해당 없음.

5. **async/await** — `queryFn: () => llmConfigsApi.list()` 는 Promise를 반환하는 올바른 async 함수 호출이다. await 누락 없음. useEmbeddingModelLoader 내부의 mutation 스냅샷 비교(`snapshot !== effectiveConfigId`) 역시 기존 코드와 동일하게 유지되며 in-flight stale 응답 가드가 작동한다.

6. **원자성** — 상태 초기화(모델 목록·에러 메시지·hasAttemptedLoad 리셋)는 render-phase의 `prevResetKey !== resetKey` 조건에서 일괄 수행된다. 이 패턴은 React 공식 권장 "reset state on prop change" 방식이며 단일 렌더 사이클에서 처리되므로 원자성 문제가 없다. 변경 전과 동일 구조.

7. **이벤트 루프** — 새로운 동기 블로킹 코드 없음. 제거된 IIFE(`(() => { ... })()`)는 경량 동기 연산이었으나 제거 후 오히려 단순해졌다.

8. **리소스 풀링** — 해당 없음. 별도의 커넥션 풀이나 스레드 풀 관리가 존재하지 않는다.

## 요약

이번 변경은 `llmConfigsApi` 의 응답 타입 정규화를 API 레이어로 이전하고, 컴포넌트 레벨의 이중-형태 분기 코드를 제거한 리팩터링이다. 동시성 관련 구조(쿼리 캐시 공유, staleTime, in-flight 가드, render-phase 리셋)는 변경 전과 동일하게 유지되거나 단순화되었으며, 새로운 경쟁 조건, 데드락, 동기화 누락, async/await 오용은 발견되지 않는다.

## 위험도

NONE
