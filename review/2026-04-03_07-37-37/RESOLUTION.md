# Code Review 이슈 조치 내용

## CRITICAL

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `layout` 기본값 불일치 (`'horizontal'` vs `'card'`) | `carousel.handler.ts`에서 `?? 'card'`로 수정, 테스트 기대값도 `'card'`로 변경 |

## WARNING

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `javascript:` URL 스킴 미검증 | `sanitizeUrl()` 함수 추가, static/dynamic 양쪽 image 필드에 적용 |
| 2 | `escapeHtml()`에서 단따옴표 미이스케이프 | `'` → `&#39;` 이스케이프 추가, 정규식 기반 단일 패스로 개선 |
| 3 | `descriptionField` 유효성 검증 누락 | 스펙을 optional(`✗`)로 수정하여 구현과 일치시킴 |
| 5 | React `key={i}` 인덱스 사용 | `CarouselItem`에 `id` 필드 추가, `addItem`에서 고유 ID 부여, `key={item.id ?? i}` 사용 |
| 6 | Static 모드 `config.items` undefined 크래시 | `Array.isArray(config.items)` 가드 추가, 누락 시 빈 배열로 처리 |
| 8 | 모드 전환 시 이전 모드 필드 잔존 | `handleModeChange`에서 이전 모드 전용 필드를 destructuring으로 제거 후 새 모드 필드만 전달 |
| 9 | Dynamic 모드 `image` 필드 undefined 변경 | `sanitizeUrl()` + `\|\| undefined` 패턴으로 빈 문자열 및 위험 URL 모두 처리 |

### WARNING 미조치 사항

| # | 발견사항 | 미조치 사유 |
|---|----------|------------|
| 4 | ESLint 주석 제거 (`execution-engine.service.spec.ts`) | 이번 변경에서 해당 파일을 수정하지 않았으며, 기존 코드의 lint 이슈임 |
| 7 | 캔버스 요약 포맷 static 모드 미반영 | 캔버스 요약 컴포넌트는 별도 파일이며 이번 변경 범위 외 (향후 개선 대상) |

## INFO

| # | 발견사항 | 조치 |
|---|----------|------|
| 4 | 출력 스키마에 `layout` 필드 누락 | 스펙 출력 예시에 `"layout": "card"` 추가 |
| 5 | `javascript:` URL XSS 테스트 누락 | 테스트 케이스 추가 |
| 6 | Dynamic 모드 null 입력 처리 미테스트 | null 입력 시 빈 배열 반환 검증 테스트 추가 |
| 7 | `toStr()` 비문자열 입력 미테스트 | number/boolean 필드 변환 테스트 추가 |
| 8 | 이미지 속성 XSS 이스케이프 미테스트 | `"` 이스케이프 검증 및 `'` 이스케이프 검증 테스트 추가 |

## 검증 결과

- Backend lint: carousel handler 파일 lint 에러 0건
- Backend tests: 312 passed (신규 33개 포함)
- Frontend lint: clean
- Frontend build: 성공
