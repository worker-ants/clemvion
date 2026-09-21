# 유지보수성(Maintainability) 리뷰

## 개요

이번 라운드의 실질 변경은 이전 리뷰(`review/code/2026/09/21/20_26_50/`)에서 나온 유지보수성/문서화
INFO·WARNING 을 해소하는 후속 커밋이다(`git log`: "헬퍼를 e2e 가이드에 넣고, 가드 대기 시간의
근거를 검사로 바꿨다"). 실제로 바뀐 것은 `codebase/backend/test/helpers/concurrency.ts` 내부
`VACUITY_GUARD_MS` 상수 위치·근거 서술 방식과 `PROJECT.md` 문서 한 줄이며, 9개 e2e spec 파일
(`*-delete-concurrency.e2e-spec.ts`)의 `raceUnderHeldLock()` 호출부 자체는 이전 라운드와 동일하다.
프로덕션 코드(`codebase/backend/src/**`) 변경 없음.

## 이전 라운드 발견사항의 해소 확인

이전 라운드(`20_26_50`)의 maintainability/architecture/documentation reviewer들이 지적한 세 가지
INFO/WARNING이 이번 diff에서 모두 실제로 고쳐졌음을 `Read`로 직접 확인했다.

1. **상수 선언 위치** — 이전엔 `VACUITY_GUARD_MS` 가 함수(당시 기준 줄 38~81) 아래(당시 기준 줄
   87)에 있어 사용 지점보다 늦게 나왔다. 지금은 `codebase/backend/test/helpers/concurrency.ts:17`
   (import 직후, 함수 정의 줄 61 이전)로 옮겨져 위→아래로 읽는 순서와 의존관계가 일치한다.
2. **근거 서술 중복** — 이전엔 "트리거 삭제 경로 lock_timeout 5초" 근거가 함수 본문 인라인 주석과
   상수 JSDoc 두 곳에 거의 같은 문장으로 중복됐다. 지금은 JSDoc(`concurrency.ts:6-16`)에만 근거를
   싣고, 함수 본문(`concurrency.ts:83`)은 "대기 시간의 근거는 `VACUITY_GUARD_MS` 선언부에 한 번만
   적는다" 로 참조만 한다 — 중복 제거.
   - 더 나아가, 근거가 **주석이 아니라 런타임 검사**(`concurrency.ts:19-24`, `if (VACUITY_GUARD_MS
     >= TRIGGER_DELETE_LOCK_TIMEOUT_MS) throw ...`)로 승격됐다. `TRIGGER_DELETE_LOCK_TIMEOUT_MS`
     가 실제로 `5_000`(`codebase/backend/src/modules/triggers/trigger-config-lock.ts:128`)임을
     확인했다 — "손으로 지키는 불변식"이었던 것이 모듈 로드 시점에 자동으로 깨지는 구조로
     바뀌어, 근거 문서와 실제 코드가 stale 해질 위험 자체가 사라졌다.
3. **`@throws` 문서 불완전** — 이전엔 공허성 가드 실패만 문서화되고 `fires.length < 2` 실패 경로가
   빠져 있었다. 지금은 `concurrency.ts:50-51` 에 두 `@throws` 항목이 모두 명시돼 있다.
4. **`PROJECT.md` 헬퍼 미언급 (WARNING)** — `PROJECT.md:337`에 "동시성 · race condition:
   `helpers/concurrency.ts` 의 `raceUnderHeldLock(locker, lock, fires)` 를 쓴다 — 손으로 쓰지 말
   것." 이 추가됐고, 락 전용 커넥션 분리·공허성 가드·선례 파일·`integration-rotate-concurrency`
   제외 사유까지 짧게 요약돼 있다(`PROJECT.md:337-342`). 다음 작성자가 참고할 진입 문서에 헬퍼가
   반영됐다.

## 발견사항

이번 라운드에서 새로 도입된 CRITICAL/WARNING 급 유지보수성 결함은 없음.

- **[INFO]** 공허성 가드 대기시간 검사가 모듈 최상위 레벨에서 즉시 `throw` 되도록 설계되어,
  실패 시 영향 범위가 "해당 테스트"가 아니라 "이 헬퍼를 import 하는 모든 스위트"로 확대된다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:19-24`
  - 상세: 프로덕션의 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 가 향후 `1_500`ms 이하로 낮아지면, 이
    조건문이 **모듈 평가 시점**(어떤 개별 테스트가 실행되기도 전, import 되는 순간)에 즉시
    던진다. 이는 "손으로 지키는 불변식을 조용히 깨지 않게 만든다"는 이 PR의 목표에 정확히
    부합하는 의도적 설계이고(JSDoc 도 "여기서 즉시 터진다" 로 명시), 개별 테스트 실패보다
    빠르고 명확한 신호다. 다만 부작용으로, 이 조건이 깨지면 이 헬퍼를 쓰는 9개 spec 파일
    **전체**가 (원인과 무관하게) 한꺼번에 "설정 오류"로 실패하게 되어, 실패 리포트만 보면
    "무엇이 고장났는지"보다 "얼마나 많은 스위트가 죽었는지"가 먼저 눈에 띌 수 있다.
  - 제안: 결함은 아니며 조치 불요 — 에러 메시지 자체가 원인(`raceUnderHeldLock: 공허성
    가드(...)가 프로덕션 잠금 대기 상한(...) 이상이다`)을 명확히 담고 있어 트리아지 비용은
    낮다. 기록만 남긴다.

## 정합성 확인 (문제 없음으로 판정한 것들)

- **함수 길이·복잡도**: `raceUnderHeldLock()` 은 41줄(`concurrency.ts:61-101`), 조기 검증 1개 +
  `try/finally` 1단 중첩. 순환 복잡도가 낮고 책임이 명확하다 — 이전 라운드 평가와 동일하게 유지.
  DRY 추출(9파일 11블록 → 헬퍼 1개)도 이번 라운드에서 변경되지 않고 그대로 보존됨을 재확인했다.
- **매직 넘버**: `1_500` 은 이름 있는 상수(`VACUITY_GUARD_MS`)로, 이제 그 상한 조건까지 코드로
  고정되어 있다. `60_000`/`120_000`(jest timeout)은 plan 근거(`e2e-race-helper.md` §D)대로
  헬퍼 밖에 그대로 남아 있고 이번 라운드에서도 변경되지 않았다.
- **네이밍·일관성**: `raceUnderHeldLock`/`locker`/`lock`/`fires`/`VACUITY_GUARD_MS` 모두 기존
  코드베이스·JSDoc과 일관된다. 9개 spec 파일의 호출 패턴·주석 스타일도 라운드 간 변경 없이 균일.
- **PROJECT.md 추가 문구**: 기존 리스트 항목(`helpers/db.ts`/`helpers/auth.ts` 소개)과 같은
  글머리표 스타일·톤을 따르고 있어 문서 내 일관성 위반 없음.

## 리뷰 대상 외 파일에 대한 참고

`review/code/2026/09/21/20_26_50/**` 와 `review/consistency/2026/09/21/19_59_55/**` 는 이번
작업이 거친 이전 `/ai-review`·`/consistency-check --impl-prep` 게이트의 정상 산출물이며(전
라운드 scope/side_effect reviewer가 이미 "정상 부산물"로 판정), 사람이 짠 애플리케이션 코드가
아니므로 가독성/네이밍/함수 길이 등 유지보수성 관점의 코드 리뷰 대상으로 취급하지 않았다.

## 요약

이번 라운드는 직전 리뷰가 지적한 유지보수성 INFO 2건(상수 선언 위치, 근거 서술 중복)과
documentation WARNING 1건(`PROJECT.md` 헬퍼 미언급)을 정확히 그 지적대로 해소했을 뿐 아니라,
근거를 "주석"에서 "런타임 assert"로 승격시켜 근본 원인(코드와 근거 문서의 stale 위험)까지
없앴다. 새로 도입된 CRITICAL/WARNING 급 유지보수성 결함은 없고, 남은 것은 의도된 설계 트레이드
오프(모듈 로드 시 즉시 실패) 하나뿐이며 이는 이 PR의 목적(공허성 가드가 조용히 무력화되지 않게
한다)과 일치하는 정당한 선택이다.

## 위험도

NONE
