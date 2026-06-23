# Code Review 통합 보고서 (docs — web-chat 콘솔/SDK 가이드, 커밋 98f37c12)

router: documentation reviewer 단독 선별(docs-only). **Critical 0, WARNING 3, INFO 4.**

## Critical
없음.

## WARNING — 처분
| # | 발견 | 처분 |
|---|---|---|
| 1 | `web-chat-sdk.en.mdx` frontmatter 누락(locale pair 위반 주장) | **FALSE** — 컨벤션상 `.en.mdx` 는 frontmatter 없이 본문만(PROJECT.md §파일 구조, `_i18n-conventions.md`). registry·locale 가드 통과가 반증. reviewer 오판. |
| 2 | `web-chat-sdk.en.mdx` §4 BYO-UI 예제(`byo-ui-headless.ts`) 참조 제거 | **fix** — 예제 파일 실존 시 참조 복원 |
| 3 | `web-chat-sdk.mdx` §4 동일 참조 제거 | **fix** — 동일 복원 |

## INFO — 처분
| # | 발견 | 처분 |
|---|---|---|
| 1·2 | boot config 필드 표에 `appearance.position`·`zIndex`·`launcher.suggestions` 누락 | **fix** — 표 보강(KO/EN) |
| 3·4 | RBAC Callout 에 "삭제" 언급하나 콘솔 UI 에 삭제 기능 없음(인스턴스=트리거, 삭제 미구현) | **fix** — 콘솔 가이드 Callout 에서 "삭제" 제거(현재 동작만 서술) |

## 처리
W-1 FALSE(컨벤션 확인). W-2·3 예제 참조 복원, INFO-1·2 필드 표 보강, INFO-3·4 삭제 언급 정리 → docs 가드 재통과 → 종결.
