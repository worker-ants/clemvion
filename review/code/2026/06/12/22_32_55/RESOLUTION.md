# Resolution — 04 후속 하드닝 배치 리뷰

위험도 **LOW / Critical 0 / WARNING 3** — reviewer 가 3건 모두 "런타임 버그 없는 개선 권고 수준" 으로 명시. 본 라운드 이후 **codebase/ 미수정**(리뷰 유효성 유지). WARNING 은 수동 disposition 으로 처리.

## WARNING disposition

| # | 발견 | disposition |
| --- | --- | --- |
| W1 | guard 의 `extractClientIpFromHeaders(headers as Record<string,string\|string[]\|undefined>)` 강제 캐스트 | **현재 안전** — `pickFirst` 가 `Array.isArray`/`typeof === 'string'` 으로 narrowing 하므로 비-string 값은 무시된다(런타임 버그 없음). 캐스트 제거(파라미터를 `Record<string, unknown>` 으로 확장 + pickFirst narrowing)는 타입 위생 개선 — **별도 follow-up 권고**(본 PR 은 행동 불변 DRY 통합이 목표라 타입 시그니처 추가 변경은 범위 분리). |
| W2 | `client-ip.spec.ts` env 스냅샷을 describe 콜백 평가 시점에 취득 | **파일 단독 실행에서 위험 없음**(reviewer 동의). 동일 파일의 기존 describe(들)도 같은 `const orig` 패턴이라, 신규 블록만 바꾸면 오히려 비일관. 파일 전체를 `beforeEach` 스냅샷으로 통일하는 건 별도 테스트 정리 작업으로 둔다. |
| W3 | `COOKIE_DOMAIN` 운영 문서 확인 | **premise 어긋남** — `COOKIE_DOMAIN` env 는 **존재하지 않는다**. cookieDomain 은 `app.config.ts computeCookieDomain(FRONTEND_URL, APP_URL)` 으로 **자동 유도**되며, 이미 `1-auth §2.3` 표 + Rationale 2.3.A 에 문서화됨. 조치 불요. |

## INFO 확인/disposition
- **I1 (1a 건전성 — 확인 완료)**: `'dev-jwt-secret'` 이 `INSECURE_JWT_SECRETS`(`production-guards.ts:33`)에 **포함됨** → WS fallback 통일이 production 부팅 가드로 실제 차단된다. 1a 의도 충족.
- **I2 (E2E fixture)**: WS module 의 `?? 'dev-jwt-secret'` 은 `jwt.secret` config 가 미설정일 때만 쓰인다. E2E/통합은 `JWT_SECRET`(NODE_ENV=test) 을 주입하므로 `jwt.secret` = 실 테스트 secret 이고 fallback 경로 미도달 → fixture 영향 없음(변경은 미설정 시에만 유효). 직전 라운드에서 머지된 main e2e 188 PASS 로 부팅·서명 경로 정상 확인됨.
- **I4 (단일화 절반)**: hooks/guard 의 thin wrapper 는 **로직 단일화(공유 코어 위임) 후 잔존하는 pass-through** 다 — drift 의 원인이던 CF-게이트/XFF 파싱 로직은 한 곳(`client-ip.ts`)뿐이고, guard wrapper 는 **export+테스트 표면 보존**(guard.spec import)·return-type(`undefined`) 변환 목적이라 의도적으로 남긴다.
- **I3/I5/I6/I7/I8**: 감사 액션 구현·테스트 헬퍼(withEnv/EnrichedSocket)·JWT 만료 상수·`as never` 정리 — 중장기 점진 개선(본 PR 범위 밖).

## 검증
- backend 182 + web-chat 18 unit PASS, 빌드 타입체크(tsconfig.build) exit 0.
- 리뷰가 현재 codebase(commit 564f7834) 전체 커버, 이후 코드 무수정.
