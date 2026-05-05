### 발견사항

해당 없음

변경된 12개 파일 전부 프론트엔드 접근성(a11y) 개선 작업의 산출물입니다:
- CSS 색상 변수 조정 (`--muted-foreground` 대비비 보강)
- 링크 스타일 변경 (`hover:underline` → `underline`)
- 아이콘 `aria-hidden="true"` 추가
- E2E axe 테스트 케이스 추가 (`/forgot-password` 페이지)
- Plan/PRD 문서 상태 갱신

`authApi.forgotPassword()`, `authApi.resetPassword()` 등 API 호출 코드가 포함된 파일도 리뷰 대상에 있으나, diff 범위 내 수정은 전부 스타일 클래스(`className`) 변경뿐이며 API 호출 로직·요청 구조·응답 처리 어느 것도 변경되지 않았습니다.

---

### 요약

모든 변경사항은 WCAG 2.1 AA 접근성 준수를 위한 UI 레이어 수정(색 대비, 링크 밑줄, ARIA 어트리뷰트, e2e 테스트)에 집중되어 있으며, 백엔드 API 계약·엔드포인트·요청/응답 스키마에 영향을 주는 변경은 없습니다.

### 위험도

**NONE**