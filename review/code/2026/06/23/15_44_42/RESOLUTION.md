# RESOLUTION — web-chat 콘솔/SDK 사용자 가이드 리뷰 (docs)

대상 SUMMARY: `review/code/2026/06/23/15_44_42/SUMMARY.md` (documentation reviewer 단독, Critical 0, WARNING 3, INFO 4).

## 조치 항목

| # | 발견 | 조치 |
|---|---|---|
| W-1 | `web-chat-sdk.en.mdx` frontmatter 누락(locale pair 위반 주장) | **FALSE — 미조치**. 컨벤션상 `.en.mdx` 는 frontmatter 없이 본문만(PROJECT.md §파일 구조, `_i18n-conventions.md`). 동일 폴더 EN 파일도 4개가 frontmatter 없음. registry·locale·spec-link 가드 통과가 반증. reviewer 가 "모두 포함"으로 과장. |
| W-2 | `web-chat-sdk.en.mdx` §4 BYO-UI 예제(`byo-ui-headless.ts`) 참조 누락 | **fix** — §4 에 `packages/web-chat-sdk/examples/byo-ui-headless.ts`(+`snippet.html`·`npm-usage.ts`) 참조 복원 |
| W-3 | `web-chat-sdk.mdx` §4 동일 | **fix** — KO 동일 복원 |
| INFO-1·2 | boot config 필드 표에 `appearance.primaryColor`·`position`·`zIndex`·`launcher.suggestions` 누락 | **fix** — KO/EN 표 보강 |
| INFO-3·4 | 콘솔 가이드 RBAC Callout "삭제" 언급하나 콘솔 UI 에 삭제 기능 없음 | **fix** — KO/EN Callout 에서 "삭제"/"deleting" 제거(현재 동작만 서술). 인스턴스 삭제는 콘솔 외 surface 라 가이드에서 언급하지 않음 |

## TEST 결과

- **docs 가드**: 통과 — `src/lib/docs` 17 files / 2312 tests passed (registry·impl-anchor-existence·integrations-coverage·no-internal-refs·locale·spec-link-integrity·spec-frontmatter 등 포함).
- lint/unit/build: 본 변경은 `codebase/frontend/src/content/docs/**` MDX 본문 전용(코드·dict 변경 0). e2e 면제 화이트리스트(`content/docs/**`) 부분집합 — e2e 비대상. docker/e2e 환경은 이전과 동일 차단(DeadlineExceeded), 본 docs 변경과 무관.

## 보류·후속 항목
- 없음. (W-1 은 컨벤션상 정상이라 미조치.)
