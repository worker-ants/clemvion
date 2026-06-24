# Code Review 통합 보고서 (라이브 미리보기 동봉 위젯 서빙 버그픽스)

리뷰 대상 커밋: `33ad66b6` (proxy `/_widget` 예외 + 디렉토리→index.html rewrite + proxy 테스트 + spec)
리뷰 일시: 2026-06-24 09:47:47

> 통합 summary 의 terminal write 가 차단되어 main 이 멱등 persist. 상세는 동일 디렉터리 `<reviewer>.md`.

## 전체 위험도

**LOW** — 라이브 미리보기·설치 스니펫 동봉 위젯 서빙 버그픽스. Critical 0. WARNING 4건은 모두 운영 장애 무관(설계 표면·이중 방어·테스트 갭·SPEC-DRIFT).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `/_widget` prefix 전체를 인증 예외 — 향후 동적 라우트 추가 시 인증 누락 위험. 함수 내 startsWith 는 matcher 와 이중 | `proxy.ts` | prefix 구체화 또는 이중 방어 의도 주석 |
| 2 | 유지보수/부작용 | matcher + 함수 이중 방어 silent 불일치 가능 | `proxy.ts` | 의도 주석 또는 단일화 |
| 3 | 테스팅 | rewrite(404→200) 자동화 테스트 없음(수동 curl 만) | `next.config.ts`, `e2e/` | `/_widget/.../app/` 200 smoke e2e |
| 4 | SPEC-DRIFT | `2-navigation/10-auth-flow.md §7.1` proxy 제외 목록에 `/_widget` 미반영 | auth-flow §7.1 | 제외 목록에 `/_widget` 추가 |

## 참고 (INFO) — 요약 (상세 reviewer 파일)

I-1~4 보안(has_session hint-only 성격 §7.1 기재됨·redirect 소비측 검증·rewrite `..` 정규화·쿠키 위조 테스트), I-5~6 요구사항(middleware 연결 방식·rewrite afterFiles), I-7 프로세스(spec 직접수정), I-8 부작용(no-store 위젯자산), I-9~14 유지보수/테스트(쿠키명 상수화·단언 분리·prefix 오버랩·publicPaths 회귀·JSDoc), I-15~16 문서화(spec 파일링크·실행순서 주석).

## 처리

- Critical 0 → 차단 없음. 위험도 LOW.
- **fix(spec)**: W4 — auth-flow §7.1 제외 목록에 `/_widget` 추가.
- **dismiss(의도된 설계)**: W1·W2 — `/_widget` 하위는 전부 public 정적 번들(동적 라우트 없음)이라 prefix 예외가 적절. matcher(1차)+함수 startsWith(2차)는 의도된 defense-in-depth(matcher 정규식 회귀 시 함수가 방어). INFO1(has_session hint)은 §7.1 에 이미 명시.
- **defer(후속, 비차단)**: W3(rewrite e2e — dev curl 실측 + proxy 단위 6/6 으로 핵심 검증) + INFO 다수(JSDoc·상수화·캐시정책·경계테스트). RESOLUTION 에 등록.
- 코드(proxy.ts/next.config.ts) 동결 — 추가 코드변경은 가드 재무장 유발.
