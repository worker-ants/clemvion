# API 계약(API Contract) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 코드베이스 **전체** 의 HTTP/WebSocket/gRPC API 계약을 면밀히 검토한다.

## 사용자 강조 관점

병렬 작업으로 인한 API 계약 드리프트 위험:

1. **일관성** — 동일 도메인 컨트롤러의 응답·에러 형식·페이지네이션·필터 패턴이 일관되는가
2. **스펙 준수** — `spec/conventions/swagger.md`, `spec/5-system/` 의 API 정의 vs 실제 코드
3. **보안** — 인증/인가의 모든 진입점 균일 적용
4. **리팩토링** — DTO·응답 wrapping·error class 의 누적 중복

## 최근 병렬 작업 컨텍스트

- B-3: cafe24 요구사항/API 계약 Medium 7건 — API 계약 hot 한 영역
- `bb038f90 refactor(integrations): ai-review 후속 — W1·W2·W3·W4` — API 계약 영역 정리
- 최근 새로 추가된 webhook, install endpoint 의 응답 형식

## 검토 범위

- `codebase/backend/src/modules/*/controllers/`, `codebase/backend/src/modules/*/*.controller.ts`
- `codebase/backend/src/common/dto/`, `codebase/backend/src/common/filters/` — 응답 wrapping, 글로벌 에러
- `codebase/backend/src/common/swagger/` — Swagger 데코레이터 패턴
- `codebase/frontend/src/lib/api/` — 클라이언트측 API 호출 (계약 사용자 관점)
- `codebase/frontend/src/app/api/` — Next.js BFF
- `spec/5-system/` 특히 webhook, integration, auth 관련
- `spec/conventions/swagger.md`, `spec/conventions/` 기타

## 작업 지침

1. **하위 호환성**: 응답 필드 제거·이름 변경, status code 변경
2. **버전 관리**: `/api/v1/` 등 버전 prefix 일관성
3. **응답 형식**: 성공/에러 envelope 의 일관성 (`{ data: ... }` vs raw 객체 혼재)
4. **에러 형식**: `{ code, message, response }` 같은 표준 형식 일관 적용, code 명 규약
5. **요청 검증**: DTO validator decorator 일관성, optional/required 정의
6. **URL 설계**: REST naming (kebab-case, 복수형), nested resource
7. **페이지네이션**: cursor vs offset 일관성, max limit, default
8. **인증/인가**: Guard 누락, Public 데코레이터 의도성, role-based 검증
9. **rate-limit**: 적용 일관성
10. **Swagger 데코레이터**: `@ApiOperation`, `@ApiResponse` 누락·부정확

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

CRITICAL: breaking change·인증 누락·계약 위반. WARNING: 불일치·강화 필요. INFO: 정리 권고.
