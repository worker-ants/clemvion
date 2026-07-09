# 테스트(Testing) 리뷰 — ai-review 후속: sub-global timeout 상속 + prod빌드 주석 정합 (session 16_38_12 후속)

## 발견사항

- **[INFO]** 감사 완료성은 grep 으로 재검증됨 — 남은 sub-global timeout override 없음
  - 위치: `codebase/frontend/e2e/**/*.spec.ts` 전수
  - 상세: 커밋이 주장한 "10곳" 을 diff 로 세어보면 `login.spec.ts`(3)+`password-reset.spec.ts`(2)+`register.spec.ts`(2)+`register-invitation.spec.ts`(1)+`background-run-section.spec.ts`(1)+`members.spec.ts`(1) = 10 으로 정확히 일치한다. `grep -rn "timeout: [0-9_]*" codebase/frontend/e2e`로 재확인한 결과, 신규 전역 기본(10_000)보다 **낮은** 하드코딩 override 는 더 이상 남아있지 않다 — `web-chat/console.spec.ts`의 `PAGE_READY_TIMEOUT`(15_000, `helpers/mock-auth.ts`)·`DIALOG_TIMEOUT`(10_000)과 `workspaces/slug-routing.spec.ts`의 `15_000`은 모두 전역 기본과 같거나 그 이상이라 override 문제(전역 slack 을 무력화)에 해당하지 않는다. W1 이 주장한 "override 제거로 전역 상속 회복"이 실제로 완전하다.
  - 제안: 없음 (검증 확인용 긍정 기록).

- **[INFO]** `web-chat/console.spec.ts` 는 이번 diff 로 손대지 않았고, 해당 스펙의 flake 완화는 여전히 Tier 1(retries)+Tier 2(prod 빌드)에만 의존
  - 위치: `codebase/frontend/e2e/web-chat/console.spec.ts:108` (`DIALOG_TIMEOUT = 10_000`)
  - 상세: 원 리뷰(session 16_38_12) WARNING 1 이 지목한 "커밋이 명시한 3개 플레이키 스펙 중 2개(`web-chat-console`·`members`) 미개선" 중, 본 후속 커밋은 `members.spec.ts` 는 실제로 override 를 제거해 개선했으나 `web-chat-console.spec.ts` 는 `DIALOG_TIMEOUT` 값이 신규 전역 기본과 이미 동일(10_000)해 "고칠 게 없다"는 판단으로 미변경 상태다. 이 판단 자체는 RESOLUTION.md 에 명시적으로 근거가 기록되어 타당하나, 결과적으로 `web-chat-console` 스펙 하나는 Tier 3(전역 timeout 상향)의 실질적 수혜를 받지 못한 채로 남는다 — 이는 새 결함이 아니라 원래부터 그랬던 상태의 재확인이지만, 커밋 메시지가 "지목된 flaky 스펙에도 Tier 3 slack 이 실제 적용된다"고 서술하는 것과는 `web-chat-console` 기준으로는 정확히 일치하지 않는다(값 자체가 이미 전역과 같아 "적용은 되지만 개선 효과는 0"인 특수 케이스).
  - 제안: 커밋 메시지나 RESOLUTION 에 "web-chat-console 은 이미 전역과 동일값이라 대상 제외"임을 한 줄 명시하면 추적성이 더 좋아진다(비차단, 이미 RESOLUTION 에 유사 취지 기록 있음).

- **[INFO]** 재발 방지 가드(lint rule / CI grep check) 부재 — 동일 anti-pattern 재발 가능성
  - 위치: 프로젝트 전역(`codebase/frontend/e2e/**`, `playwright.config.ts`)
  - 상세: "sub-global 하드코딩 timeout 이 전역 `expect.timeout` 을 override 해 Tier 3 slack 을 무력화한다"는 패턴이 두 차례(session 16_38_12 원 리뷰 → 본 후속 커밋)에 걸쳐 지적·수정되었다. 그러나 향후 새 스펙 작성자가 `toBeVisible({ timeout: 5_000 })` 처럼 전역 기본보다 낮은 값을 다시 박아 넣는 것을 막을 구조적 장치(ESLint 커스텀 룰, 혹은 CI 에서 `grep -rn "timeout: [0-9_]*" e2e`로 전역 기본 미만 값을 검출하는 스크립트)가 없다. 순수 discipline(리뷰 의존)에만 기대는 상태다.
  - 제안: 저비용 예방책으로 CI lint 단계에 "전역 `expect.timeout` 미만의 명시적 `toBeVisible`/`toHaveText` 등 timeout override 검출" 스크립트를 추가하거나, 최소한 `PROJECT.md` e2e 작성 패턴 섹션에 "sub-global timeout 은 전역 기본 이상으로만 지정" 컨벤션을 명문화. 비차단이나 재발 이력이 있어 WARNING 수준으로 볼 여지도 있음.

- **[INFO]** 회귀 테스트 유효성 — assertion 로직 불변, timeout 값만 조정되어 회귀 위험 없음
  - 위치: `login.spec.ts`, `password-reset.spec.ts`, `register.spec.ts`, `register-invitation.spec.ts`, `background-run-section.spec.ts`, `members.spec.ts` 전체
  - 상세: 10곳 모두 `.toBeVisible({ timeout: N })` → `.toBeVisible()` 형태로 변경 옵션만 제거됐고 matcher 대상(정규식·selector)·assertion 순서·mock 설정은 전혀 손대지 않았다. 제거된 값(5_000/3_000)은 모두 새 전역 기본(10_000)보다 **작으므로** 실질적으로 대기 시간이 늘어나는 방향으로만 작동해 기존에 통과하던 케이스를 깨뜨릴 이론적 경로가 없다(`.not.toBeVisible` negative 케이스는 대상에서 제외되어 "사라짐 확인" 류 타이밍에 영향 없음). RESOLUTION.md 가 기록한 `e2e PASS(247 tests, retry 없이 clean)` 실행 결과도 이 판단과 일치한다.
  - 제안: 없음 (검증 확인).

- **[INFO]** 신규 production 코드 없음 → 신규 유닛/통합 테스트 불필요, 스코프 적절
  - 위치: 전체 diff
  - 상세: 변경은 e2e 스펙의 timeout 옵션 제거, `playwright.config.ts`/`docker-compose.e2e.yml` 주석, 신규 후속 plan 문서, 이전 세션 리뷰 산출물(SUMMARY/RESOLUTION 등) 커밋뿐이다. 테스트 대상이 되는 production 로직 변경이 없으므로 신규 테스트 케이스가 필요하지 않다는 판단은 타당하다.
  - 제안: 없음.

- **긍정 확인**: 테스트 가독성 개선 — 매직넘버 제거로 assertion 이 더 짧고 일관됨(전역 기본 위임), `.not.toBeVisible`과 전역-동일값 사례는 명확한 기준(negative·redundant 은 미대상)으로 스코프가 좁게 유지되어 "왜 이 10곳만 고쳤는지"가 RESOLUTION.md 에 정확히 추적된다. 테스트 격리·mock 사용은 이번 diff 로 전혀 변경되지 않아 이전 리뷰의 긍정 평가가 그대로 유효하다.

## 요약

이번 후속 커밋은 직전 리뷰(session 16_38_12)의 testing WARNING 1(하드코딩 sub-global timeout 이 전역 slack 을 무력화)을 실제로 정확하게 해소한다 — grep 재검증 결과 전역 기본(10_000) 미만의 override 는 더 이상 남아있지 않고, 커밋이 주장한 "10곳"도 diff 카운트와 정확히 일치한다. assertion 로직 자체는 불변이라 회귀 위험이 없고, 실제 e2e 실행(247 tests, retry 없이 clean)으로 뒷받침된다. 다만 `web-chat-console.spec.ts`는 값이 이미 전역과 동일해 "손댈 게 없는" 케이스로 남아 커밋 메시지의 일반적 서술과는 미묘한 불일치가 있고(문서화 수준의 사소한 갭), 같은 anti-pattern(전역 미만 sub-global timeout)이 두 세션에 걸쳐 반복 지적된 점을 볼 때 재발 방지용 구조적 가드(lint/CI grep)가 없다는 점이 유일하게 남는 개선 여지다. 둘 다 비차단.

## 위험도
LOW
