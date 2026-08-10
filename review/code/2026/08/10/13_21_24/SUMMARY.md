# Code Review 통합 보고서 — webchat 스트림 소유권 게이트 + spec status 정합성

- 대상: `claude/webchat-usewidget-extraction` · diff-base `origin/main` · `--route=all`
- changeset 28파일 (비-review 5: `use-widget.ts` · 회귀 테스트 1 · spec 1 · plan 2)
- forced 7명 **전원** 리포트 확보.

## BLOCK: NO

Critical 0 · **WARNING 3(전부 반영 완료 — `RESOLUTION.md` 참조)**.

## 전체 위험도

**LOW**.

## Critical / 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | maintainability · documentation | **`seedWaitingFromStatus` JSDoc `:457` 이 같은 블록 `:461-468` 과 정면 충돌** — "이중 스트림은 *호출부의 짝 가드*가 막는다" 는 옛 아키텍처 서술이 "게이트를 `openStream` 안으로 옮겼다" 바로 위에 남아 있었다 | **반영** — `:457` "`openStream` 진입 가드", `:463` "그 진입 가드" 로 정정 |
| 2 | scope | **워크스트림 A/B 혼재** — plan 이 "그 PR 범위 밖" 이라 적고도 같은 PR 에서 수행 | **반영** — 서술을 실제 이유(같은 파일·게이트 차단·최소 footprint)로 정정 |

> #1 은 두 reviewer 가 **독립적으로** 같은 줄을 지목했다. documentation 은 `git blame` 으로
> 그 문장이 2026-07-18(`2d9d202188`) 작성분이고 **오늘의 정정 커밋(`bf8d71802`)에서도
> 안 갱신됐음**을 짚었다 — 그 커밋 제목이 하필 "JSDoc·spec 의 옛 아키텍처 서술 정정" 이다.

## 0/0 을 낸 reviewer

| reviewer | 비고 |
|---|---|
| security | NONE — 게이트 이동은 보안 관점 긍정 |
| side_effect | NONE — `StreamClaim` 미-export, `openStream` 도 공개 `actions` 계약 밖이라 영향이 파일 내부 2곳으로 국한됨을 grep 실증 |
| requirement | 0/0 |
| testing | 0/0 (INFO 5) |

## 채택하지 않은 것 (근거)

| reviewer | 내용 | 판단 |
|---|---|---|
| maintainability | "union 덕에 3번째 분기가 생겨도 **컴파일러가** 미처리 케이스를 잡는다" 를 이번 변경의 이점으로 평가 | **사실이 아니라 채택 안 함.** 직전 라운드에서 프로브로 실측 — 호출부는 단순 문자열 비교라 exhaustiveness 검사가 아니고 tsc 는 3번째 variant 를 못 잡는다. 실제로 지켜 주는 것은 **부정 비교(fail-closed)** 다. 리뷰어의 호평이지만 근거가 틀렸다 |
| scope | INFO — 28파일 중 22개가 harness 산출물 | 규약이 요구하는 audit trail (CLAUDE.md 저장 규약) |
| maintainability | INFO — `StreamClaim` 리터럴 snake_case | 규약 위반 아님 |
| testing | INFO 5 | 커버리지 갭 아님 |

## 이 라운드가 잡은 것 — 같은 결함이 다섯 번째다

이 티켓에서 주석 drift 가 **다섯 번** 나왔다: 테스트 주석 → 의존성 배열 → JSDoc 요약문 →
spec 본문 → **이번 JSDoc 본문**. 전부 같은 형태다 — 구조를 바꾸고 그것을 설명하는 텍스트가
한 박자 늦는다.

특히 이번 것은 **"옛 아키텍처 서술을 정정한다" 는 제목의 커밋이 놓친 자리**다. 한 파일 안에
같은 서술이 여러 군데 있을 때 "고쳤다" 를 선언하는 시점에 **자매를 전수로 세지 않은** 결과다.

## 검증

- `pnpm --filter channel-web-chat test` — 23 files / **409 passed**
- `pnpm --filter channel-web-chat exec tsc --noEmit` — **0 errors**
- 문서 가드 19파일 **2878 passed**
- 선행 consistency `--spec` 2라운드 **BLOCK: NO** (`review/consistency/2026/08/10/13_12_16/SUMMARY.md`)
