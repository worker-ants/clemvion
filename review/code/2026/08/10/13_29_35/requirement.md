# 요구사항(Requirement) Review

## 대상 및 방법

이번 라운드의 실질 delta 는 직전 라운드(`13_21_24`) 대비 `edebb1cc1` 커밋 1개뿐이다 —
`codebase/channel-web-chat/src/widget/use-widget.ts` JSDoc 2줄(자기모순 해소) +
`plan/in-progress/webchat-reload-rest-error-branches.md` provenance 문단 정정(12줄). 동작
변경 없음(문서/주석 전용). `git show edebb1cc1 --stat` 로 실제 변경 파일이 이 2개뿐임을 확인했고,
프롬프트에 포함된 나머지 파일(과거 review 산출물 27건 + spec 1건)은 이미 이전 라운드에서
검토·조치 완료된 이력 문서다.

검증한 것:
- `codebase/channel-web-chat/src/widget/use-widget.ts` 의 `openStream`/`seedWaitingFromStatus`
  JSDoc 을 직접 열어 "이중 스트림은 `openStream` 진입 가드가 막는다" / "그 진입 가드로" 문구가
  일관되게 반영됐고, 인접 문단(`SeedOutcome`/`StreamClaim` 정의, 두 호출부 `if (claim !== "opened"
  && claim !== "no_client") return;`)과 더 이상 모순하지 않음을 확인.
- `start()` 의 `useCallback` 의존성 배열(`:634`)에 `sessionEstablished` 잔재가 없음을 재확인(이전
  라운드 WARNING #2 정상 반영 유지).
- `seedWaitingFromStatus` 의 `catch` 블록(`:526-539`)이 상태코드 구분 없이 전부 soft-fail 함을
  직접 읽어, `spec/7-channel-web-chat/3-auth-session.md` §3.1 배너의 "404·복구불가 401 REST 분기·
  401→낙관적 refresh 는 미구현" 서술이 코드와 실제로 일치함을 확인.
- `plan/in-progress/webchat-reload-rest-error-branches.md` frontmatter(`worktree`/`started`/
  `owner`)가 `.claude/docs/plan-lifecycle.md` §4 의 3-필드 스키마와 일치, `spec/7-channel-web-chat/
  3-auth-session.md` frontmatter 의 `pending_plans:` 가 가리키는 대상과 실존 경로가 일치함을 확인
  (`spec/conventions/spec-impl-evidence.md` §3 `partial`+`pending_plans` 의무 규정 충족).
- TODO/FIXME/HACK/XXX: diff 범위 내 없음.

## 발견사항

- **[WARNING]** spec 본문에 이번 리팩터로 사라진 "짝 가드"(호출부 2곳에 복제된 가드) 아키텍처를
  가리키는 용어가 한 곳 남아 있음 — 같은 문서 바로 위 문단이 이미 "스트림 열기 자체가 막는다" 로
  정정했는데, 그 정정에서 이 자리만 빠졌다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:180` (§R7 "근거의 성격" 블록쿼트 —
    "이 불변식은 되감기 수정의 **3차 반복 끝에** 도달했고, **짝 가드**의 필요성은 …")
  - 상세: `git blame` 확인 결과 이 줄은 `c9e0e2ff7b`(2026-08-10 11:20, `openStream` 리팩터
    `ce6c81838`보다 이전)에 작성됐고, 이후 `bf8d71802`("JSDoc·spec 의 옛 아키텍처 서술 정정")와
    `edebb1cc1`("같은 JSDoc 블록이 자기와 모순하던 마지막 자리" 정정) 두 라운드 모두 이 줄을
    건드리지 않았다. 같은 파일 `:166`("이 가드는 '표면 되감기' 만 막는다. '이중 스트림' 은
    **스트림 열기 자체**가 막는다")·`:172`("**종전엔** 이 재확인이 호출부 2곳에 손으로 복제돼
    있었다")는 이미 과거형/현재 아키텍처로 정정됐는데, `:180` 만 "짝 가드"(paired guard, 호출부
    복제 가드를 가리키던 옛 용어)를 현재형으로 계속 쓴다. 문맥(같은 "3인 재현"·"seed 반환 직후
    동기 실행이라 원천 차단된다는 초기 판단이 오판" 서술이 `use-widget.ts:459-460` JSDoc 의
    `openStream` 게이트 근거와 정확히 대응)을 보면 `:180` 이 가리키는 것도 이중 스트림 게이트이며,
    같은 문서 안에서 그 게이트를 두 가지 다른 아키텍처(과거: 호출부 짝 가드 / 현재: 진입 단일
    가드)로 동시에 서술하는 자기모순이 남아 있다. 이 PR 이 정확히 같은 클래스의 결함(주석/문서가
    구조 변경을 한 박자 늦게 따라감)을 이미 5회 겪었다고 스스로 기록(`edebb1cc1` 커밋 메시지)한
    바로 그 패턴의 6번째 발생이다. 동작에는 영향 없음(문서 전용) — CRITICAL 은 아니다.
  - 제안: `:180` 의 "짝 가드의 필요성은" 을 `:166`/`:172` 와 동일한 현재 아키텍처 어휘로
    맞춘다(예: "진입 가드의 필요성은" 또는 "스트림 열기 진입 재확인의 필요성은").

- **[INFO]** 이번 delta(JSDoc 2줄 + plan 문서 12줄)는 순수 문서·주석 정정이라 기능 완전성·엣지
  케이스·에러 시나리오·반환값·비즈니스 로직 관점에서 새로 검토할 코드 경로가 없다. 위 발견사항
  외에는 이 delta 로 인한 새로운 결함을 찾지 못했다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:457-468`,
    `plan/in-progress/webchat-reload-rest-error-branches.md:17-23`

## 요약

이번 라운드(직전 `13_21_24` 대비 실질 delta = `edebb1cc1` 1개 커밋)는 동작 변경이 없는 순수
문서 정정이며, 목표(같은 JSDoc 블록 안의 자기모순 해소 + plan 문서의 "범위 밖" 자기모순 해소)를
정확히 달성했다 — `use-widget.ts` JSDoc·호출부·테스트 주석·plan 문서 서술이 서로 일관됨을 직접
읽어 확인했고, `spec/7-channel-web-chat/3-auth-session.md` 의 "미구현 REST 분기" 서술도 실제
`seedWaitingFromStatus` catch 블록 구현과 일치한다. 다만 같은 spec 문서 안에 이번 정정 대상과
**동일한 클래스**(이중 스트림 게이트를 가리키는 옛 "짝 가드" 용어 잔재)의 stale 참조가 한 곳
더 남아 있었다(`3-auth-session.md:180`) — 이 PR 의 여러 라운드가 정확히 이 종류의 drift 를
반복 추적·수정해 온 이력을 고려하면 같은 턴에 마저 정리하는 편이 낫다. 기능적 결함·spec 위반은
발견되지 않았다.

## 위험도

LOW
