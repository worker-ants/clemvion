## 성능 리뷰 결과

### 발견사항

- **[INFO]** `getEnabledProviders()` 의 `process.env` 반복 접근
  - 위치: `auth-oauth.service.ts:80-86`
  - 상세: `AUTH_OAUTH_PROVIDERS.filter()` 내부에서 `process.env[...]` 를 매 항목마다 접근한다. 현재는 providers가 2개뿐이라 실질적 비용은 미미하지만, providers가 늘어날 경우 루프마다 환경변수 해시 조회가 반복된다.
  - 제안: 서비스 초기화(`constructor`) 시점에 활성 provider 목록을 한 번 계산해 인스턴스 변수로 캐시하거나, `OAUTH_STUB_MODE` 변경이 런타임에 발생하지 않는다면 module-level 상수로 고정한다.

- **[INFO]** `Cache-Control: public, max-age=300` 설정이 SSO 활성화 여부 변경 시 즉각 반영을 막음
  - 위치: `auth.controller.ts:371`, `auth-providers.ts:18`
  - 상세: 백엔드 Cache-Control 5분 + Next.js `revalidate: 300` 조합은 의도적 설계이나, 서버가 재배포되어 provider 설정이 바뀌어도 최대 10분(CDN 캐시 + ISR 캐시 중첩)간 이전 값이 클라이언트에 노출될 수 있다.
  - 제안: 현재 구조(배포 시 캐시 갱신)로 충분하다면 문제 없음. 다만 스펙 문서에 이 지연을 명시해 두는 것이 좋다(이미 spec에는 5분 캐싱이라고만 기재됨).

- **[INFO]** `fetchEnabledOauthProviders`가 SSR 요청마다 Cold-start 시 네트워크 왕복을 유발할 수 있음
  - 위치: `auth-providers.ts:15-25`
  - 상세: Next.js `fetch` 캐시는 프로세스 재시작 또는 첫 요청 시 캐시 미스가 발생한다. 백엔드와 Next.js가 동일 컨테이너가 아닌 경우 SSR 렌더링 경로에 불필요한 내부 HTTP 왕복이 추가된다. 현재 providers 목록은 실질적으로 정적에 가까운 데이터임에도 매 Cold-start마다 네트워크를 탄다.
  - 제안: 환경변수에서 직접 읽는 방식(`NEXT_PUBLIC_OAUTH_PROVIDERS=google,github`)을 고려하거나, `revalidate: 3600`(1시간)으로 늘려 Cold-start 비용을 줄인다. 또는 Next.js ISR의 `tags`를 활용해 배포 시 명시적 revalidate를 트리거하는 방식도 유효하다.

- **[INFO]** `getEnabledProviders` 테스트 내 `process.env` 직접 조작
  - 위치: `auth-oauth.service.spec.ts:137-159`
  - 상세: 테스트마다 `process.env`를 직접 set/delete하는 방식은 테스트 격리가 `afterEach` 에 의존하지 않고, 만약 테스트가 병렬 실행되면(Jest `--runInBand` 미사용 시) 환경변수 상태 충돌이 발생할 수 있다. 성능보다 신뢰성 이슈이나 CI 환경에서의 플레이키 테스트로 이어질 수 있음.
  - 제안: `jest.replaceProperty(process, 'env', { ...process.env, OAUTH_STUB_MODE: 'true' })` 패턴이나 `jest.spyOn` 을 활용해 테스트 스코프 격리를 강화한다.

---

### 요약

이번 변경은 OAuth provider 목록을 백엔드에서 동적으로 조회해 SSO UI 노출 여부를 제어하는 가볍고 적절한 구현이다. 성능 측면에서 중대한 문제는 없으며, `Cache-Control` + Next.js `revalidate` 를 통한 5분 캐싱 전략이 API 호출 비용을 효과적으로 제거한다. 다만 `getEnabledProviders()` 가 런타임 호출마다 `process.env` 를 재조회하는 점, SSR Cold-start 시 내부 HTTP 왕복이 발생하는 점, 그리고 테스트의 환경변수 직접 조작으로 인한 격리 취약성은 서비스 규모가 커질 경우 개선 여지가 있다.

### 위험도

**LOW**