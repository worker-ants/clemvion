# 문서화(Documentation) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 코드베이스 **전체** 의 문서화 품질을 면밀히 검토한다. spec/, 코드 docstring/JSDoc, README, CHANGELOG, API 문서, 주석 모두 대상.

## 사용자 강조 관점

병렬 작업으로 인한 문서·코드 drift 위험:

1. **일관성** — spec 본문·코드·README 간 정합성
2. **스펙 준수** — `spec/conventions/` 의 문서 규약 (Swagger, ## Rationale 섹션 등)
3. **보안** — 시크릿/내부정보가 문서에 노출
4. **리팩토링** — 문서 구조의 정리 필요성

## 최근 병렬 작업 컨텍스트

- spec/ 자체가 116 MD 파일 — 단일 진실 소스
- 최근 docs-consolidation(2026-05-12) 이후 spec/ 으로 통합 — 옛 경로 잔존 여부 점검
- `_product-overview.md`, `0-overview.md`, `N-name.md`, `## Rationale` 패턴 일관성
- nested ISO 리뷰 경로 전환(2026-05-16) 후 옛 flat 경로 잔존 여부

## 검토 범위

- `spec/` 전부 (116 MD)
- `README.md`, `frontend/AGENTS.md`, `frontend/CLAUDE.md`, `CLAUDE.md`
- `backend/src/**` 의 JSDoc / 핵심 함수 주석
- `frontend/src/**` 의 JSDoc
- `packages/*/README.md`
- `frontend/src/content/docs/` — 사용자 docs

## 작업 지침

1. **spec 본문 vs 코드**: 데이터 모델·API·UI 명세가 코드와 일치하는가
2. **docstring 누락/오류**: public API, 복잡한 함수
3. **README 최신성**: 실행 방법·환경변수·구조도가 현 상태 반영
4. **CHANGELOG**: 큰 변경 추적되는지 (있다면)
5. **예제 코드**: 동작하는가, deprecated API 미사용
6. **conventions 준수**: `spec/conventions/swagger.md` 등의 정식 규약
7. **Rationale 섹션**: spec 본문 끝 `## Rationale` 권장 패턴
8. **옛 경로 잔존**: `prd/`, `memory/`, `user_memo/` 같은 deprecated 경로 참조

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

CRITICAL: 문서가 코드와 정반대를 말함. WARNING: 누락·옛 정보. INFO: 정리 권고.
