### 발견사항

- **[INFO]** 동일 파일 내 timeout 지정 방식의 잔존 불일치
  - 위치: `codebase/frontend/e2e/workspaces/members.spec.ts:981-985` (전역 컨텍스트, 이번 diff 는 :864-865 만 수정) / `codebase/frontend/e2e/auth/*.spec.ts` 등
  - 상세: 이번 변경으로 positive `toBeVisible({ timeout: 5_000/3_000 })` 리터럴 10곳은 제거되어 전역 기본값(10_000)을 상속하도록 통일됐다. 그러나 `members.spec.ts` 같은 파일 안에는 전역값과 동일한 `{ timeout: 10_000 }` 이 여전히 명시적으로 남아 있어(예: `owner@example.com` 어서션), 같은 테스트/파일 내에서 "명시 timeout"과 "암묵적 상속"이 혼재한다. 파일만 단독으로 읽는 후속 유지보수자는 왜 어떤 assertion 은 timeout 을 명시하고 다른 건 안 하는지 근거를 찾기 어렵다(근거는 커밋 메시지·`RESOLUTION.md` 에만 기록됨, 스펙 파일 내부 주석엔 없음).
  - 제안: 이미 RESOLUTION.md 에 "전역동일 `{10_000}` 은 스코프 밖 후속 cleanup" 으로 명시되어 있으므로 즉시 조치는 불필요하나, 후속 cleanup PR 착수 시 일괄 제거 대상 목록에 포함하거나, 잔존 리터럴 옆에 짧은 주석("전역 기본과 동일 — 후속 제거 후보")을 남기면 파일 단독 가독성이 개선된다.

- **[INFO]** 여러 e2e 스펙 파일에 걸친 `mockOauthProviders`/`mockOauth` 헬퍼 중복 (이번 diff 로 도입된 것은 아님)
  - 위치: `codebase/frontend/e2e/auth/login.spec.ts:99-107`, `register.spec.ts:480-488`, `password-reset.spec.ts:296-304`
  - 상세: 세 파일 모두 이름만 다르고 구현이 동일한 OAuth providers mock 헬퍼를 각자 정의하고 있다. 이번 커밋이 새로 만든 코드는 아니고 diff 자체는 timeout 리터럴 제거에 국한되지만, 리뷰 대상 파일에 반복적으로 나타나는 패턴이라 참고로 남긴다.
  - 제안: 우선순위 낮음. 향후 e2e 공용 fixture/helper 모듈로 추출하면 중복이 줄어들지만, 이번 PR 스코프와는 무관하므로 즉시 조치 불필요.

- **[INFO]** Tier 라벨의 크로스 파일 문서 의존
  - 위치: `docker-compose.e2e.yml:206-213`(신규 주석), `codebase/frontend/playwright.config.ts:15-20`
  - 상세: 새로 추가된 `docker-compose.e2e.yml` 주석이 "playwright.config Tier 2 주석 참조" 라고 안내한다. 정확한 참조지만, Tier 1/2/3 라벨의 정의는 `playwright.config.ts` 에만 존재해 `docker-compose.e2e.yml` 단독으로는 의미가 완전히 파악되지 않는다(사소, 기존 패턴과 동일 스타일).
  - 제안: 조치 불필요(비차단). 두 파일이 서로 참조를 명시해 추적성은 이미 확보됨.

### 요약

이번 변경은 로직 추가 없이 e2e 스펙 6개 파일에서 전역 `expect.timeout` 을 가리던 하드코딩 sub-global timeout 리터럴 10곳을 제거하고, `playwright.config.ts`·`docker-compose.e2e.yml` 주석을 실제 동작(Tier 2 prod 빌드, retry/flaky 집계)에 맞게 정합화한, 범위가 매우 좁고 위험도가 낮은 순수 정리성 변경이다. 오히려 이전에 존재하던 "글로벌 설정을 국소적으로 무력화하는 매직 넘버" 문제를 해소해 일관성과 가독성을 개선했으며, 새로 도입된 함수/조건/중첩은 없어 복잡도·네이밍 관점의 리스크도 없다. 유일하게 남는 것은 동일 파일 내 일부 `{ timeout: 10_000 }` 리터럴이 여전히 잔존해 국소적 스타일 혼재를 남긴다는 점인데, 이는 커밋 메시지와 `RESOLUTION.md` 에 "의도적 스코프 제외"로 이미 문서화되어 있어 결함이라기보다 후속 cleanup 후보에 가깝다.

### 위험도
NONE