# 부작용(Side Effect) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 **최근 ~50 커밋** 의 의도치 않은 부작용을 점검한다.

## 사용자 강조 관점

병렬 작업이 누적되면 부작용 발견이 어렵다:

1. **일관성** — 같은 함수 시그니처가 한쪽은 갱신·한쪽은 미갱신
2. **스펙 준수** — spec 의 invariant 가 깨졌는지
3. **보안** — 부작용으로 인한 권한 누출·로그 시점 변경
4. **리팩토링** — 시그니처 변경의 호출처 영향

## 최근 병렬 작업 컨텍스트

- `bb038f90` 같은 묶음 refactor 의 시그니처 변경 점검
- cafe24 영역의 알림 타입 신설(A-1)이 다른 알림 사용처에 영향을 주지 않는지
- 새 Redis nonce 모듈(B-1-3) 도입이 기존 redis 사용에 영향

## 검토 범위

- 최근 50 커밋 (`git log -50 --stat`)
- 시그니처 변경 한 함수의 모든 호출처 (Grep)
- 전역/공유 객체 변경 (config, store, 환경변수)

## 작업 지침

1. **의도치 않은 상태 변경**: 함수가 입력 객체를 mutate, store 안의 referenced 값 변경
2. **전역 변수**: module-level mutable state, singleton 의 lifecycle
3. **파일/네트워크 부작용**: 함수 시그니처 상 pure 처럼 보이는데 file·network·DB write
4. **시그니처/인터페이스 변경**: TS interface, NestJS service method, public API 의 변경이 호출처에 반영되었는지
5. **이벤트/콜백 부수 효과**: 이벤트 emit 추가가 기존 listener 에 영향
6. **로깅 부작용**: 로그 추가가 PII 노출 (security 와 연계)
7. **import 부작용**: side-effectful import (polyfill, monkey-patch)
8. **공유 모듈 변경**: `common/`, `shared/`, `packages/` 의 변경이 의도 외 모듈에 영향

## 출력 형식

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <path>:<line> 또는 <commit-hash>
  - 상세
  - 제안

### 요약
1 문단

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: 호출처가 깨졌는데 미발견. WARNING: 잠재적 회귀. INFO: 권고.
