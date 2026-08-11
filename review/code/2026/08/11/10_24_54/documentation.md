# 문서화(Documentation) Review — `10_24_54`

## 검증 배경

직전 라운드(`10_02_22`)에서 이 reviewer 가 낸 **CRITICAL(Gate C `spec_impact` 누락)** 과
**WARNING(CHANGELOG 미반영)** 의 반영 여부, 그리고 오케스트레이터가 요청한 3가지를 실제 소스를
`Read`/`git diff origin/main...HEAD`/`grep` 으로 직접 열어 확인했다(프롬프트 인용이 아니라 저장소
현재 상태 기준).

## 확인 (a) — `spec_impact` 가 실제로 건드린 spec 과 정확히 일치하는가

`plan/complete/webchat-reload-rest-error-branches.md` frontmatter:

```yaml
spec_impact:
  - spec/7-channel-web-chat/3-auth-session.md
  - spec/0-overview.md
```

`git diff origin/main...HEAD -- 'spec/**'` 로 실제 diff 를 낸 spec 파일을 전수 대조한 결과 **정확히
이 두 파일뿐**이다(`spec/0-overview.md` 1줄, `spec/7-channel-web-chat/3-auth-session.md` 27줄). 다른
스펙 문서(예: EIA §5.5·§8.3, `1-widget-app.md`)는 이 diff 안에서 **참조**만 되고 편집되지 않았으므로
`spec_impact` 에 없는 것이 맞다 — `plan-lifecycle.md §5`("본 작업이 건드린 spec 파일들")의 정의와
정확히 일치한다. 넓지도 좁지도 않다. Gate C 가드(`spec-plan-completion.test.ts`)를 포함한 frontend
전체 스위트를 실행해 **5927 passed / 284 files** 확인(회귀 없음).

`worktree: (unstarted)` → `spec-small-followups` 로 함께 정정된 것도 확인(직전 라운드 C2 지적의
동반 원인이었던 필드).

## 확인 (b) — CHANGELOG 신규 항목이 구현보다 넓게 약속하지 않는가 (특히 "위협 모델이 좁다")

`CHANGELOG.md` 에 추가된 두 번째 `## Unreleased` 항목의 문장을 원문 그대로 인용한다:

> 위협 모델은 좁다 — 위젯은 cross-origin iframe 이라 **호스트 페이지 스크립트는 이 콘솔을 못 읽는다**
> (초기 서술이 그렇게 적혀 있었고 틀렸다). 실제 노출면은 devtools·콘솔 수집 확장·버그리포트 덤프,
> 그리고 **same-origin 임베드**다.

이 서술을 `spec/7-channel-web-chat/0-architecture.md` §2.1 과 대조했다:

> *예외*: admin 콘솔 **내부 미리보기**는 cross-origin 격리가 목적이 아니므로 **same-origin 동봉
> 위젯**을 실제 `src` iframe 으로 로드한다(§4.1·§R5 carve-out).

즉 "same-origin 임베드" 노출면은 지어낸 것이 아니라 실제로 spec 이 명문화한 carve-out(관리자
라이브 미리보기)과 일치한다 — **과소 서술도 과대 서술도 아니다.** "cross-origin iframe 이라 호스트
스크립트가 못 읽는다"는 같은 §2.1 의 "interaction token·대화 내용을 호스트 스크립트로부터 격리(보안
경계)" 서술과도 부합한다.

같은 문장이 `codebase/channel-web-chat/src/lib/eia-client.ts:190-195` `redactToken` JSDoc 에도
있고, **양쪽이 문구까지 동일한 근거로 일치**한다(직전 라운드 W3 "정정의 사본을 테스트 파일에
빠뜨렸다"의 재발 여부를 `grep -rn "호스트 페이지\|콘솔을 읽" codebase/channel-web-chat/src/` 로
전수 확인 — `eia-client.ts` 한 곳에만 있고 사본 누락 없음).

CHANGELOG 항목의 나머지 구체적 주장(4-state 갈래, 지수 백오프 상한 5분, `401`/`410` 만 종단,
`sessionRef.current` 를 읽는 호출부 등)도 각각 `use-widget.ts`(`SeedOutcome`/`shouldAbortAfterSeed`/
`seedWaitingFromStatus`)와 `use-token-refresh.ts`(`retryDelayMs`/`TOKEN_REFRESH_RETRY_MAX_DELAY_MS`/
`isTerminalAuthError` 분기)의 실제 코드와 1:1로 대조해 과대 약속이 없음을 확인했다.

## 확인 (c) — 이 PR 이 만든 문서·주석 중 코드와 어긋나는 것이 남았는가 (전수)

다음을 개별적으로 열어 대조했고, 전부 일치했다:

- `SeedOutcome`(`use-widget.ts:76-111`) 4-리터럴 union ↔ `shouldAbortAfterSeed`(:130-138) 화이트리스트
  ↔ CHANGELOG "4-state" 서술 ↔ `3-auth-session.md` §3.1/§R4 서술 — 네 문서가 동일한 갈래(ended/
  stale/continue/refresh_deferred)를 일관되게 서술.
- `applyRefreshedToken`(`session-store.ts:110-133`) JSDoc 이 "두 갱신 경로가 복제" 라고 주장하는
  호출부 2곳을 `grep` 으로 확인 — `use-token-refresh.ts:151`, `use-widget.ts:542`. 잔존 `saveSession`
  직접 호출(`use-widget.ts:808`)은 다른 목적(최초 세션 저장)이라 JSDoc 의 주장과 충돌하지 않음.
- `sseErrorDetail`(`use-widget.ts:470-476`) 헬퍼가 실재 — 직전 라운드(`10_02_22`) maintainability
  WARNING(인라인 삼항식을 헬퍼로 뽑으라는 제안)이 이번 커밋에서 실제로 반영됨.
- 종료조건 문서 자리(§3.1-3, §R4, storage 정리 조건)가 전부 `401`/`410` 쌍으로 갱신됐고, "최초 401
  트리거" 를 가리키는 자리(§R3 참조·§3.1 step2 도입부)만 `401` 단독으로 남아 있다 — `16_42_07`
  라운드가 정립한 두 축(종료-조건 vs 최초-401)의 구분과 일치, 재발 아님.
- `plan/in-progress/webchat-reload-rest-error-branches.md` 는 삭제됐고, 그 경로를 가리키던 형제
  plan 링크(`webchat-command-failure-is-not-termination.md`, `webchat-usewidget-extraction.md`)는
  모두 `../complete/webchat-reload-rest-error-branches.md` 로 갱신됨 — `grep -rn
  "in-progress/webchat-reload-rest-error-branches"` 결과 0건(dangling 링크 없음).
- `spec/0-overview.md` 가 가리키는 `../plan/complete/webchat-reload-rest-error-branches.md` 실존
  확인.
- `use-widget.ts`/`use-token-refresh.ts`/`session-store.ts`/`eia-client.ts` 전체에서
  `TODO`/`FIXME`/`XXX`/"미구현"/"Planned" 류 잔존 마커 0건(grep).
- `3-auth-session.md` frontmatter `pending_plans:` 필드가 제거되고 `status: implemented` 로 승격 —
  본문의 "여전히 미구현(Planned)" 배너도 함께 "구현됐다" 로 갱신되어 frontmatter/본문 불일치(직전
  라운드 원인이었던 결함 클래스) 없음.

## 발견사항

없음 — 이번 라운드에서 신규 CRITICAL/WARNING 없음.

## 요약

직전 라운드에서 이 reviewer 가 낸 CRITICAL(Gate C `spec_impact` 누락)과 WARNING(CHANGELOG 미반영)
모두 정확히 반영됐고, 반영물 자체도 재검증 대상이던 세 축 — spec_impact 의 정확한 범위, CHANGELOG
"위협 모델이 좁다" 서술의 사실성, PR 이 만든 문서/주석 전수의 코드 일치 — 에서 어긋남을 찾지 못했다.
특히 "same-origin 임베드" 노출면 서술은 `0-architecture.md §2.1` 의 admin 콘솔 미리보기 carve-out과
문구까지 대응해, 지어낸 위협 모델 축소가 아니라 spec 이 실제로 정의한 예외에 근거한 정확한 서술임을
확인했다. 이 브랜치가 반복해 온 "정정의 사본을 한쪽에만 적용" 형태도 이번엔 재발하지 않았다(cross-
origin 정정 문구가 `eia-client.ts` 한 곳에만 있고 사본 누락 없음을 grep 으로 확인).

## 위험도

NONE
