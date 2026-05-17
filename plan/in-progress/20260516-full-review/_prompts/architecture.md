# 아키텍처(Architecture) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 코드베이스 **전체** 의 아키텍처 건전성을 면밀히 검토한다.

## 사용자 강조 관점

병렬 작업으로 인한 구조 침식 위험:

1. **일관성** — 레이어 책임의 경계 일관성
2. **스펙 준수** — `spec/0-overview.md` 의 아키텍처 결정과 코드 부합
3. **보안** — 모듈 경계가 보안 경계 역할 (워크스페이스 격리)
4. **리팩토링** — 누적된 강결합·순환 의존성

## 최근 병렬 작업 컨텍스트

- cafe24 integration 영역에 30+ 커밋 누적 — 책임 비대화 위험
- `codebase/backend/src/nodes/` 와 `codebase/backend/src/modules/execution-engine/` 의 경계
- `codebase/packages/` 가 codebase/backend/frontend 어디에 의존하는지

## 검토 범위

- `spec/0-overview.md`, `spec/data-flow/` — 시스템 아키텍처
- `codebase/backend/src/modules/` 의 모듈 분할
- `codebase/backend/src/common/` vs `codebase/backend/src/shared/` 의 역할 차이
- `codebase/packages/` — 패키지 경계
- `codebase/frontend/src/app/` (route group) vs `components/` vs `lib/`

## 작업 지침

1. **SOLID**: SRP(단일 책임), DIP(추상에 의존), OCP
2. **결합도/응집도**: 모듈이 너무 많은 다른 모듈을 import 하는가
3. **레이어 책임**: 컨트롤러가 비즈니스 로직을, 서비스가 HTTP 응답 형성을 하는가
4. **순환 의존성**: 모듈 간 cycle (`madge` 류 도구 가능하면 활용)
5. **모듈 경계**: codebase/backend/modules 간 직접 import vs event/queue
6. **패키지 경계**: `codebase/packages/*` 가 codebase/backend/frontend 내부를 import 하지 않는지
7. **디자인 패턴**: Adapter, Strategy, Factory 의 적용 일관성
8. **DI 사용**: NestJS DI 가 적절히 활용되는지
9. **이벤트 vs 함수 호출**: WebSocket·notification 흐름의 결합도

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

CRITICAL: 다음 큰 변경의 비용을 폭증시키는 구조 결함. WARNING: 점진 개선 필요. INFO: 리팩토링 권고.
