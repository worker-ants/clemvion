# 신규 식별자 충돌 검토 — naming_collision (델타 라운드)

대상: `spec/5-system/14-external-interaction-api.md` (§R14 제목 변경 + §5.2 서술 정정),
연동 변경: `spec/5-system/3-error-handling.md` §1.6.

## 확인 절차 및 근거

### 1. R14 제목 변경("토큰 실패 status 통일" → "토큰 **검증** 실패 status 통일")에 따른 앵커 슬러그 변경

- `grep -rni "#r14"` 를 `spec/` `plan/` `codebase/` 전체에 적용 — **0건**. R14 절을 가리키는 markdown fragment 링크(`#r14-...`)가 저장소 어디에도 존재하지 않는다.
- 기존 `[EIA §R14](./14-external-interaction-api.md)` 형태의 인용(`spec/5-system/3-error-handling.md:171`)은 **파일 링크만**이고 fragment 를 붙이지 않아 제목 변경의 영향을 받지 않는다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "§R14" 텍스트 인용도 마찬가지로 fragment 링크가 아니다.
- `14-external-interaction-api.md#` 로 시작하는 다른 fragment 링크들(§3.3/§3.4/§7.1/§7.3 등, `spec/2-navigation/2-trigger-list.md`·`spec/5-system/4-execution-engine.md`·`spec/5-system/15-chat-channel.md`·`spec/7-channel-web-chat/*` 등)은 모두 R14 절이 아닌 다른 절을 가리켜 무관.
- 결론: 이번 제목 변경으로 죽는 참조 없음. (직전 PR 의 재번호 dead-reference 이력과 달리, 이번 건은 fragment 인용 자체가 없어 재현되지 않음.)

### 2. §1.6 신규 3종의 철자가 §5.1 표·코드 3곳 모두 일치하는가

대상 3종: `TOKEN_REFRESH_NOT_IN_WINDOW` / `TOKEN_REFRESH_FAILED` / `TOKEN_REFRESH_FORBIDDEN`.

| 소스 | 확인 |
|---|---|
| target §5.1 표 (`14-external-interaction-api.md:359-360,366`) | 3종 모두 정확한 철자로 등재 |
| `3-error-handling.md` §1.6 표 (line 168-170) | 3종 모두 동일 철자로 등재, status(400/400/403)·비고도 §5.1 과 정합 |
| 코드 (`interaction.controller.ts:147`, `interaction.service.ts:224,236,244`) | 3종 모두 literal 문자열로 실사용 — 철자 일치 |

세 곳 모두 오탈자 없이 정확히 일치. 충돌·drift 없음.

### 3. `IEXT_REFRESH_WINDOW_SEC` 등 인용 심볼이 §1.6 쪽에서도 실재하는가

- `3-error-handling.md:168` 의 `TOKEN_REFRESH_NOT_IN_WINDOW` 행에 `IEXT_REFRESH_WINDOW_SEC` 가 target §5.1(`14-external-interaction-api.md:359`)과 동일하게 언급됨.
- 코드 SoT: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:39` — `const IEXT_REFRESH_WINDOW_SEC = 30 * 60;`, 사용처 `:300`.
- `spec/data-flow/15-external-interaction.md:121` 에도 동일 심볼 인용 — 3곳(§5.1 / §1.6 / data-flow) 모두 정합.

## 신규 식별자 충돌 관점 발견사항

없음 — 이번 델타가 도입/재등재한 식별자(에러 코드 3종, R14 제목, `IEXT_REFRESH_WINDOW_SEC`)는 기존 사용처와 충돌하지 않으며, 새로 깨진 anchor 참조도 없다.

## 요약

R14 제목 변경은 이 절을 가리키는 fragment 링크가 저장소 전역에 하나도 없어 dead-anchor 를 만들지 않는다(기존 참조는 전부 파일 링크 또는 순수 텍스트 인용). §1.6 에 새로 등재된 에러 코드 3종(`TOKEN_REFRESH_NOT_IN_WINDOW`/`TOKEN_REFRESH_FAILED`/`TOKEN_REFRESH_FORBIDDEN`)은 §5.1 표·코드와 철자·status 가 세 곳 모두 일치하며, 인용 심볼 `IEXT_REFRESH_WINDOW_SEC` 도 §1.6·§5.1·data-flow·코드 전체에서 동일하게 실재한다. 신규 식별자 충돌 관점에서 이번 델타는 문제 없음.

## 위험도

NONE

BLOCK: NO
STATUS: OK
