# 변경 범위(Scope) 리뷰 — commit e34ef03f8

대상: `git show e34ef03f8` (fresh, 이전 review 13_35_47 의 testing CRITICAL 조치 커밋)

- `.github/workflows/web-chat-checks.yml` (+31/-2)
- `codebase/channel-web-chat/src/lib/presentation.test.ts` (+2/-2)
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (+4)
- `review/code/2026/07/11/13_35_47/{RESOLUTION,SUMMARY,maintainability,scope,side_effect,testing}.md`, `meta.json`, `_retry_state.json` (신규 8개, 이전 리뷰 세션의 산출물 커밋)

## 발견사항

- **[INFO]** 리뷰 산출물(`review/code/2026/07/11/13_35_47/**`) 8개 파일이 코드 변경과 같은 커밋에 포함됨
  - 위치: `review/code/2026/07/11/13_35_47/*`
  - 상세: 소스 변경(3파일)과 무관해 보일 수 있으나, CLAUDE.md·프로젝트 메모리("e2e/ai-review 는 수행 후 체크하고 그 갱신을 PR 커밋에 포함(review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋)")에 따른 표준 관행이며 이번 커밋이 바로 그 review 의 RESOLUTION 조치이므로 동봉이 자연스럽다. scope 위반 아님.
  - 제안: 조치 불필요.

- **[INFO]** `sdk-client` job 신설 — 범위 판단
  - 위치: `.github/workflows/web-chat-checks.yml` (신규 job, +26줄)
  - 상세: 커밋 메시지가 "C1b" 로 명명한 별도 항목이지만, 동일 review 세션(13_35_47)의 `SUMMARY.md`(“추가 발견: web-chat-checks.yml paths 에 codebase/packages/sdk/** 가 있으나 @workflow/sdk 를 도는 job 자체가 없다… → 조치: (2) @workflow/sdk job 신설”)와 `RESOLUTION.md`(C1b 행, `fixed`)에 명시적으로 등재된 액션 아이템이다. 즉 "다음에 하고 싶은 확장"이 아니라 **같은 리뷰가 이미 지시한 fix 항목**이며, C1(widget job typecheck)과 동일한 근본 문제(paths 트리거는 있는데 실제로 도는 job 이 없어 가드가 GH CI 에서 미발화)의 대칭 사례다. `client.spec.ts:43,47` 에 실제로 이 job 이 검증 대상으로 삼는 `@ts-expect-error` negative 가 존재함을 직접 확인했고, `pnpm --filter @workflow/sdk test/build` 로컬 재현 결과도 green(33 tests passed, tsc 0)이라 job 내용도 실제 스크립트와 정합한다. **scope creep 아님** — 리뷰가 발견한 갭을 리뷰가 발견한 세션 안에서 메운 것.
  - 제안: 조치 불필요.

- **[INFO]** lint step 의도적 생략 — 근거 검증
  - 위치: `.github/workflows/web-chat-checks.yml` `sdk-client` job 주석("lint 는 SDK 에 eslint.config 부재라 생략")
  - 상세: `codebase/packages/sdk/package.json` 에 `"lint": "eslint \"src/**/*.ts\""` 스크립트는 존재하지만 `codebase/packages/sdk/` 에 `eslint.config.*` 파일이 없어(디렉터리 검색 0건) 실제 실행 시 ESLint 9 가 "couldn't find an eslint.config.(js|mjs|cjs) file" 로 즉시 실패함을 로컬 재현으로 확인했다. 이 gap 은 **이번 커밋이 만든 것이 아니라 기존 상태**이며, 커밋이 이를 고치려 하지 않고(=범위 확장 안 함) 정확한 주석과 함께 lint step 을 생략한 것은 오히려 범위를 좁게 유지한 올바른 판단이다.
  - 제안: 조치 불필요(eslint.config 부재 자체는 별도 후속 과제 후보이나 이번 커밋 범위 밖).

- **[INFO]** maintainability 조치의 최소성 확인
  - 위치: `use-widget-eager-start.test.ts:92-98`(주석 추가, 1개소만) vs `:219,648,801`(동일 트릭 3곳, 주석 미추가)
  - 상세: 이전 리뷰의 maintainability WARNING 은 "공용 헬퍼로 추출하거나, 안 한다면 최초 등장 한 곳에만 주석"을 권고했고, RESOLUTION.md 는 헬퍼 추출을 후속(`§리뷰 후속`)으로 명시적으로 defer 했다. 실제 diff 도 정확히 첫 occurrence 1곳에만 4줄 주석을 추가하고 나머지 3곳·4곳의 `installControllableSse` 미재사용 구조는 손대지 않았다 — 권고안을 초과하지도 미달하지도 않는 최소 조치.
  - 제안: 조치 불필요.

- **[INFO]** `presentation.test.ts` 수정 범위 확인
  - 위치: `:143, :291` 두 곳 각 1줄, `items[0]!.buttons!` → `items[0].buttons!`
  - 상세: maintainability WARNING(같은 파일 내 다른 5곳과 비일관적인 불필요 assertion)이 지목한 정확히 그 두 지점만 수정. 파일의 다른 부분(assertion 없는 `items[0].title` 등)엔 손대지 않아 최소 diff.
  - 제안: 조치 불필요.

- **[INFO]** `test-stages.sh` — 변경 없음 확인(의도된 배제)
  - 상세: 이전 커밋(`029abcd86`)에서 이미 harness 배선이 끝난 파일이라 이번 CRITICAL 조치(GH Actions 배선)와 무관 — `git show e34ef03f8 --stat` 에 미포함. 정확히 지시대로 "실제 CI" 파일만 건드림.
  - 제안: 조치 불필요.

## 프롬프트 대비 검증 요약

1. **의도된 findings 만 반영**: C1(widget typecheck)·C1b(sdk-client job, 이 review 가 발견한 추가 갭)·maint-comment(1곳 주석)·maint-redundant(items[0]! 2곳) 넷 모두 RESOLUTION.md 의 "fixed" 항목과 1:1 대응. `maint-dup`(헬퍼 추출)은 RESOLUTION 에서 명시적으로 `deferred`, 코드에도 반영되지 않음(위 확인) — 요청 이상의 변경 없음.
2. **sdk-client job**: scope creep 아님 — 동일 세션 testing 리뷰가 발견하고 SUMMARY/RESOLUTION 이 명시적으로 지시한 fix.
3. **`--stat`**: `web-chat-checks.yml` + `presentation.test.ts` + `use-widget-eager-start.test.ts` + review artifact 8개(신규, 이전 세션 산출물 커밋) — 그 외 파일 없음. 확인 완료.
4. **무관 변경**: 없음. EventSource stub 헬퍼 추출(deferred 항목)은 코드에 반영되지 않았음을 grep 으로 직접 확인(3곳 미주석 상태 유지) — 올바르게 범위 밖으로 유지됨.
5. **커밋 메시지 정확성**: C1/C1b/maintainability 서술 모두 실제 diff·리뷰 artifact 와 정합. `tsc 0`·`build/test 재통과` 주장은 `pnpm --filter channel-web-chat typecheck`(0 errors), `pnpm --filter @workflow/sdk build`(0 errors), `pnpm --filter @workflow/sdk test`(33 passed)로 직접 재현해 정확함을 확인(e2e 252 는 시간상 재실행하지 않았으나 직전 리뷰 RESOLUTION.md 의 동일 수치와 일치해 grafting/fabrication 정황 없음).

## 요약

이 커밋은 이전 review(13_35_47)의 testing CRITICAL 이 지시한 조치(widget job Typecheck step, sdk-client job 신설, 부정확 주석 정정)와 maintainability WARNING 두 건(EventSource stub 대표 주석, redundant `items[0]!` 제거)을 정확히 그 범위 안에서만 반영했다. `sdk-client` job 신설은 언뜻 새 기능 추가처럼 보이지만 동일 리뷰 세션이 "추가 발견"으로 명시하고 SUMMARY/RESOLUTION 에 fix 항목으로 등재한 것이므로 scope creep 이 아니라 정확한 이행이다. deferred 로 명시된 EventSource stub 공용 헬퍼 추출은 코드에 반영되지 않았음을 직접 확인했고, `test-stages.sh` 등 무관 파일도 건드리지 않았다. 포맷팅·임포트·불필요 리팩토링·설정 변경 등 다른 항목에서도 이탈 없음.

## 위험도

NONE
