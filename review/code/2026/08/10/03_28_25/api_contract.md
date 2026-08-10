STATUS=success ISSUES=0

### 발견사항
없음

### 요약
리뷰 대상 4개 파일(`plan-scan.ts`, `plan-scan.test.ts`, `plan-frontmatter.test.ts`, `spec-links.ts`)은 모두 `plan/`·`spec/` 마크다운 트리를 스캔해 라이프사이클 프론트매터 불변식과 문서 내 상대링크 무결성을 검증하는 개발 도구/테스트 코드다. HTTP 엔드포인트, 컨트롤러, 요청/응답 스키마, 라우팅, 인증/인가 등 API 계약과 관련된 요소가 전혀 없어 이번 변경은 API 계약 리뷰 범위 밖이다.

### 위험도
NONE
