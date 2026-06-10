# Refactor 백로그 — 의존성 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 2 / Major 4 / Minor 9 — **spec/문서 대조(2026-06-10) 후 유효 9건 / 철회·종결 5건(M-1, M-3, m-3, m-5, m-7)**. C-1 은 Critical→Major 재분류.
> **spec 대조 판정 분포**: A 1 (m-9) / B 5 / C 2 (m-1, m-8 — Node 버전 문서 괴리) / D 2 / E 4. (registry/lock 실측 기반 — `npm audit`·`npm view` 실행 검증.)
> 전반 평가: NestJS 11 + Next.js 16 + TS 5.7 구성 합리적. lock 파일로 재현성 확보.
> 옵션 비교·권장안 보강 (2026-06-10)

## Critical → Major 재분류

- [ ] **C-1 [Critical→M] `jsonwebtoken` devDependencies 분류 오류 — 단 현재 런타임 오류는 미발현** — `backend/package.json:110` vs `interaction-token.service.ts:8-13`
  - **spec 대조**: B — EIA spec(§3.3/§7.3/§8.3)은 토큰 설계(HS256, sub/aud/exp/jti)만 규정 — 라이브러리 무관. **심각도 정정**: lock 실측 결과 `@nestjs/jwt@11.0.2`(prod dep)가 `jsonwebtoken: 9.0.3` 을 전이 설치 → `Dockerfile:43` 의 `npm prune --omit=dev` 후에도 유지 — **현재 프로덕션 오류 없음** (전이 의존에 우연히 기대는 fragile 상태). Critical → Major.
  - **개선 방안**: 1. (최소) `jsonwebtoken` 을 dependencies 로 이동 (`@types/jsonwebtoken` 은 devDeps 유지 가능) + `npm install` lock 재생성. 2. (구조, 선택) 이미 prod dep 인 `@nestjs/jwt` `JwtService` 로 교체 — websocket·webauthn 모듈이 이미 사용 중이라 일관성 개선. 에러 클래스 re-export(`TokenExpiredError`) 여부는 구현 시 확인.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. deps 이동 (최소) | 1줄 + lock 재생성으로 fragile 전이 의존 즉시 해소. 코드 무변경 — 회귀 ~0. 버전도 전이 설치본(9.0.3)과 동일해 거동 변화 없음 | 같은 기능 라이브러리 2계열(직접 `jsonwebtoken` + `@nestjs/jwt`) 병존 지속 — 모듈 간 일관성은 미개선 |
    | B. `@nestjs/jwt` `JwtService` 교체 (구조) | 직접 의존 제거의 근본 해소 + websocket·webauthn 과 토큰 처리 경로 단일화. `@nestjs/jwt` 가 prod dep 으로 `jsonwebtoken 9.0.3` 을 계속 공급하므로 런타임 동등 | `interaction-token.service.ts` 의 `reason: 'expired'\|'malformed'\|'audience_mismatch'` 매핑이 jsonwebtoken 에러 클래스 식별에 의존 — `@nestjs/jwt` 의 에러 re-export 여부 미확인(구현 시 검증 필요), verify 옵션 재매핑 회귀 위험. unit 선행 필수 |
  - **권장**: A — 본 항목의 본질은 "prune 후 우연 생존하는 fragile 전이 의존" 해소이며 A 가 회귀 0 으로 이를 즉시 달성한다. B 의 일관성 편익은 유효하나 reason 매핑 회귀 비용(에러 클래스 re-export 미확인)이 따르므로, A 적용 후 별도 리팩토링으로 분리 판단하는 것이 안전하다.
  - 검증: `npm run build && npm test -- interaction-token` + Docker 빌드 후 `node -e "require('jsonwebtoken')"` smoke + EIA e2e. / 회귀 위험: 방안 1 은 ~0, 방안 2 는 `reason: 'expired'|'malformed'` 매핑 회귀 — unit 선행. / spec 갱신: 불요.

- [ ] **C-2 hono override 버전이 CVE fix 미달 — 실노출면 낮음(클라이언트 전용)** — `backend/package.json` overrides
  - **spec 대조**: B — hono 는 `@modelcontextprotocol/sdk`(spec `11-mcp-client.md:525` 가 채택 명시)의 **전이 의존**. override `^4.12.18` 핀 결정의 근거 기록은 spec/plan/git 어디에도 없음. `npm audit` 실측으로 CVE 4건 재확인(모두 patched `>=4.12.21`). **단 backend 는 MCP client 로만 SDK 사용 — hono 서버를 띄우지 않아 4건(IP restriction/Set-Cookie/JWT middleware/path routing) 모두 서버 기능 취약점이라 실공격면 거의 없음** — audit-clean 목적의 저비용 정리.
  - **개선 방안**: 1. `overrides.hono` → `^4.12.21` + `npm install`. 2. `npm audit` 로 4건 소거 확인. 3. override 사유를 package.json 인접 주석 또는 본 항목에 기록 (m-6 핀 정책과 묶음).
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. override `^4.12.21` 상향 | 결정적 floor — lock 재생성·fresh worktree resolve 에서도 >=4.12.21(CVE 4건 patched) 보장. `npm install` 시 현 lock 의 4.12.19 가 override 를 불만족하게 되어 재해석이 강제됨 — audit 즉시 0 | overrides 항목 유지 = m-6 의 "사유 미기록" 상태 지속(같은 PR 에서 사유 주석으로 해소 가능) |
    | B. override 제거 (SDK 전이 `^4.11.4` 위임) | overrides 표면 축소 — SDK 자체 범위에 위임하는 단순한 상태 | **lock 실측: 현재 4.12.19 가 `^4.11.4` 를 만족하므로 제거만으로는 `npm install` 이 취약 버전을 그대로 유지 — CVE 미해결**. `npm update hono` 를 병행하면 최신(4.12.25)으로 가지만, `^4.11.4` 범위가 취약 구간(4.11.4–4.12.20)을 계속 허용해 향후 어떤 resolve 에서도 floor 무보장 |
  - **권장**: A — 제거(B)는 lock 메커니즘상 현 취약 버전(4.12.19)을 소거하지 못하고, 일회성 `npm update` 로 우회해도 SDK 의 `^4.11.4` 가 취약 구간을 재허용해 회귀 가능성이 남는다. patch floor 를 override 로 못 박는 A 가 유일하게 결정적이며, 사유 주석(방안 3)으로 m-6 의 비판도 함께 해소된다.
  - 검증: build + MCP client unit + `make e2e-test` + audit 0 moderate. / 회귀 위험: patch 상향 — 매우 낮음. / spec 갱신: 불요.

## Major

- [x] ~~**M-1 ts-jest ^29 + jest ^30 메이저 불일치 (7개 패키지)**~~ — **철회 (2026-06-10 registry 실측)**
  - **사유**: E — `ts-jest@29.4.6` 의 peerDependencies = `"jest": "^29.0.0 || ^30.0.0"` — **ts-jest 29.4.x 가 곧 Jest 30 공식 지원 라인** (ts-jest 는 Jest 메이저와 버전을 정렬하지 않음 — versioning 오해). 현 조합으로 전 패키지 테스트 통과 중. (선택 cosmetic: 7개 패키지의 ts-jest 선언을 `^29.4.10` 으로 통일.)

- [ ] **M-2 `@vitejs/plugin-react` 메이저 불일치 (^6 vs ^4) + jsdom (^29 vs ^25)** — `channel-web-chat/package.json`
  - **spec 대조**: B — channel-web-chat spec/README/plan 에 버전 결정 기록 없음 — 생성 시점 스캐폴드 잔재. 둘 다 React 19.2.4 + vitest 4 메이저 — 통일 비용 낮음.
  - **개선 방안**: 1. `@vitejs/plugin-react` `^4` → `^6.0.1`, `jsdom` `^25` → `^29.0.1` + `npm install`. 2. (주의) channel-web-chat 은 worktree 에서 node_modules 실복사 환경 — 로컬 재설치 필요.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 통일 (`plugin-react ^6.0.1`, `jsdom ^29.0.1`) | monorepo 메이저 정렬 — frontend 와 동일 라인. 스캐폴드 잔재 정리로 향후 React/vitest 업그레이드 시 일괄 격차 방지. 둘 다 React 19.2.4 + vitest 4 호환이라 통일 비용 낮음 | jsdom 25→29 DOM 거동 변화로 단위 테스트 일부 수정 가능(테스트 한정, 런타임 무관). worktree 실복사 환경이라 로컬 재설치 수반 |
    | B. 현상 유지 | 비용 0 — 현재 테스트·빌드 통과 중. 영향이 테스트 도구 한정이라 방치해도 프로덕션 위험 없음 | 버전 결정 기록 없는 drift 지속 — 시간이 갈수록 메이저 격차(6 vs 4, 29 vs 25)가 벌어져 후행 통일 비용 증가 |
  - **권장**: A — 영향면이 테스트 환경에 한정되어 회귀가 발생해도 런타임 무관하고, React 19 + vitest 4 라는 공통 기반 위라 지금이 통일 비용이 가장 낮은 시점이다. 깨지는 테스트가 있어도 jsdom 거동 차이의 국소 수정으로 끝난다.
  - 검증: `npm run test && npm run build && npm run typecheck`. / 회귀 위험: jsdom 25→29 DOM 거동 변화로 단위 테스트 일부 깨질 수 있음 — 테스트 한정, 런타임 무관. / spec 갱신: 불요.

- [x] ~~**M-3 `pdf-parse ^2.x` — 타 maintainer 포크 (공급망 리스크)**~~ — **철회 (2026-06-10 registry 실측)**
  - **사유**: E — npm maintainer 는 `mehmet.kozan` 단독이며 **v1.1.1(2018)과 v2 전 버전을 같은 계정이 발행** — "원작자와 다른 maintainer 의 포크" 가 registry 데이터와 불일치 (원작자 본인의 v2 리라이트). 라이브러리 채택 자체는 spec 명시(`3-ai/_product-overview.md:159`, `8-embedding-pipeline.md:67`).
  - (잔여 정리) `@types/pdf-parse ^1.1.5` 는 **사실상 미사용** — `pdf.parser.ts:15` 가 인라인 캐스트로 자가 타입 정의. → `npm uninstall @types/pdf-parse` 또는 v2 번들 타입으로 정식 import 전환. 검증: `npm run build && npm test -- pdf.parser`.

- [ ] **M-4 `dayjs` 버전 스큐 — 현재 미발현(단일 dedupe), 예방 정렬** — `packages/expression-engine/package.json:14`
  - **spec 대조**: B — 버전 기록 없음. **보정**: lock 실측 — `^1.11.13 ∩ ^1.11.20` → 1.11.20 단일 dedupe (인스턴스 2개 아님). `dayjs.extend` 사용처도 backend transform.handler 1곳뿐(expression-engine 은 plugin 미사용) — 원안의 plugin 공유 버그는 현재 미발현. 향후 backend 가 ^1.12 로 가는 순간 중첩 설치 발생 — 예방 차원 유효, 긴급도 낮음.
  - **개선 방안**: 1. expression-engine 의 dayjs → `^1.11.20` + 3개 lock 재생성.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 정렬 (`^1.11.20`) | 선언 1줄 + lock 재생성 — 회귀 사실상 0(현재도 1.11.20 단일 dedupe 로 동작 중이라 설치 결과 불변). backend 가 `^1.12` 로 가는 순간 발생할 중첩 설치를 선제 차단 | 현재 미발현 문제에 대한 작업 — 즉시 편익 없음. 단독 PR 로는 가치가 낮아 다른 의존성 정리에 동승해야 효율적 |
    | B. 보류 | 비용 0 — lock 실측상 단일 dedupe(1.11.20)로 실문제 없음 | 시한부 안전 — backend 범위가 `^1.12` 진입하는 순간 중첩 설치 + plugin 비공유 위험이 발현하며, 그 시점엔 원인 추적 비용이 더 큼 |
  - **권장**: A — 변경이 선언 1줄이고 설치 결과가 현 상태와 동일해 위험이 없는 반면, 보류는 backend 의 minor 상향이라는 통제 밖 트리거에 노출된다. 단 단독 작업으로는 과소하므로 C-2/m-6 등 같은 의존성 정리 PR 에 묶어 처리한다.
  - 검증: expression-engine `npm test` + backend unit(transform customParseFormat 경로). / 회귀 위험: patch 수준 — 매우 낮음. / spec 갱신: 불요.

## Minor

- [ ] **m-1 `@types/node` 불일치 — 단 "Node 22" 전제 자체가 문서 괴리 (floor 결정 선행)** — frontend `^20`, sdk `^20.0.0`, backend `^22.10.7`
  - **spec 대조**: **C(문서 괴리)** — 원안 전제 "실행환경 Node 22" 가 어느 문서와도 불일치: Dockerfile 은 `node:24-alpine`, CI `node-version: '24'`, README:88 "Node.js 20+", `.nvmrc` 없음. 타입을 floor(20)에 맞출지 운영(24)에 맞출지 **결정이 선행**돼야 하는 항목.
  - **개선 방안**: 1. Node 지원 floor 결정 (권장: 운영·CI 와 일치하는 24 를 운영 기준으로, README "20+" 단일화 여부 포함) — **m-8 과 한 PR**. 2. 결정값으로 backend/frontend/sdk `@types/node` 동일 메이저 통일 + `npm install`. 3. README:88 동기화.
  - **옵션 비교** (m-8 과 단일 결정 — 사용자 결정 자료):
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. floor 20 유지 (전 패키지 `@types/node ^20`) | README "20+"·기존 engines 선언(web-chat/sdk `>=20`)과 무변경 정합 — 문서 수정 최소. 외부 SDK 소비자 호환폭 최대 | 운영(node:24)·CI(24)와 타입이 2메이저 괴리 — Node 22/24 에만 있는 API 를 타입이 차단하거나, 반대로 런타임 거동과 타입이 어긋남. Node 20 은 공식 릴리스 일정상 2026-04 EOL 경과 — EOL 라인을 floor 로 약속하는 모순 |
    | B. 24 상향 통일 (전 패키지 `^24` + README "24+") | 운영·CI·Docker 와 단일 정렬 — 문서 괴리(판정 C)의 가장 단순한 해소. 타입이 실행환경과 일치해 신규 API 안전 사용 | README "20+" 약속 파기 — 외부 배포 의도의 `@workflow/sdk` 소비자 중 Node 20/22 사용자를 명목상 배제(engines 는 advisory 지만 호환 신호). backend `@types/node ^22` 사용 코드의 타입 상향 컴파일 에러 가능(빌드가 즉시 검출) |
    | C. 이원화 (sdk `>=20` 유지 / 내부 backend·frontend·packages 24) | 외부 SDK 호환폭 보존 + 내부는 운영과 정렬 — 두 목적을 동시에 충족. 개선 방안 1 의 기존 권장 방향과 일치 | 정책이 2개 — README·PROJECT.md 에 "내부 개발 24 / SDK 소비 20+" 이원 기준 명시 필요. sdk 의 Node 20 지원이 실보장이 되려면 CI 에 20 테스트 leg 추가 검토(없으면 명목 보장) |
  - **권장**: C — 운영·CI·Docker 가 이미 24 로 수렴해 있어 내부 floor 는 24 가 자연스럽고, 외부 배포 의도가 있는 sdk 만 보수적 floor(>=20)를 유지하면 README "20+" 의 의미를 "SDK 소비 기준" 으로 재정의해 괴리를 해소할 수 있다. 단 Node 20 이 EOL 라인이라는 점에서 sdk floor 를 22 로 올리는 변형도 합리적 — **최종 floor 는 사용자 결정 사항** (m-8 과 한 PR 로 처리).
  - 검증: 각 패키지 build + unit. / 회귀 위험: 타입 상향 신규 컴파일 에러(빌드가 즉시 검출). / spec 갱신: 불요 (README/PROJECT.md 영역).

- [ ] **m-2 테스트 프레임워크 이원화 — "장기 통일" 에서 "정책 문서화" 로 축소** —
  - **spec 대조**: D — `PROJECT.md:26` 이 이원화를 **현황으로 명시** (run-test.sh wrapper 가 양쪽을 묶어 운용). M-1 철회로 "결합 시 리스크 증폭" 논거 소멸 — 통일 편익이 마이그레이션 비용을 정당화 못 함 (생태계 기본값 준수가 사실상 의도).
  - **개선 방안**: 1. PROJECT.md §빌드·테스트에 1줄 정책 추가: "backend·packages=jest / frontend·channel-web-chat=vitest, 신규 패키지는 소속 스택을 따른다". 2. packages/* vitest 이행은 별도 트리거(jest 가 막는 ESM 의존 등장) 전까지 보류.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. PROJECT.md 1줄 정책 문서화만 | 비용이 문서 1줄 — `PROJECT.md:26` 이 이미 현황으로 명시한 이원화를 "의도된 정책" 으로 격상해 신규 패키지의 프레임워크 선택 기준 제공. run-test.sh wrapper 운용 유지 | 이원화 자체는 지속 — 기여자가 두 프레임워크의 mock/assertion 차이를 계속 인지해야 함 |
    | B. packages/* vitest 이행 | packages 가 frontend 측과 도구 통일 — ESM 의존 수용성 개선 | backend 는 jest(NestJS 표준)로 남으므로 완전 통일이 아님 — 오히려 backend·packages 가 갈라져 "소속 스택을 따른다" 원칙과 충돌. M-1 철회로 "ts-jest 결합 리스크" 논거 소멸 — 마이그레이션 비용을 정당화할 편익 부재 |
  - **권장**: A — M-1 철회로 통일의 핵심 논거가 사라졌고, backend 가 jest 에 남는 한 B 는 통일이 아니라 분할선 이동에 불과하다. 정책 1줄로 의도를 명문화하고, vitest 이행은 jest 가 실제로 막는 의존이 등장하는 시점의 별도 트리거로 미룬다.
  - 검증: 문서 변경뿐. / spec 갱신: 불요 (PROJECT.md 가 SoT).

- [x] ~~**m-3 frontend axios 잔량 적음 → fetch 통일**~~ — **철회 (2026-06-10 실측 — 전제 수치 오류)**
  - **사유**: E — 실측: axios import **11개 파일** vs fetch 5개 파일. `lib/api/client.ts` 가 `axios.create` 기반 **중앙 apiClient** (withCredentials·커스텀 paramsSerializer — backend ValidationPipe 호환 주석 명시·workspace 헤더 주입) — axios 가 주 경로, fetch 가 잔량. fetch 전환은 interceptor·직렬화·타입가드 전면 재구현의 중규모 마이그레이션 — ~13KB 절감 대비 비용 과대.
  - (역방향 대체 후보) 산발 fetch 5건을 apiClient 로 수렴하는 일원화 — 단 SSE/스트리밍(assistant) 은 fetch 유지 필수. 필요 시 별건 등재.

- [ ] **m-4 마크다운 렌더러 이원화 — sanitize 정책 매트릭스 문서화가 본체** — marked(web-chat) vs react-markdown(frontend assistant 패널 1곳)
  - **spec 대조**: D — web-chat 측 선택은 문서화됨(README:68, plan, `4-security.md:34` 가 sanitize 의무를 위젯 책임으로 명시). frontend 측은 무문서. 번들 환경이 달라(경량 CSR vs React 트리) 이원화 자체는 합리 — "문서화 우선" 결론 유지.
  - **개선 방안**: 1. `spec/7-channel-web-chat/4-security.md` sanitize 행에 정책 매트릭스 1절 (위젯: marked+DOMPurify allowlist·noopener / 메인 앱: react-markdown 기본 escape·raw HTML 미허용) — **planner 위임**. 2. 양쪽 XSS unit 을 동일 페이로드 셋(script 주입·`javascript:` 링크·이벤트 핸들러 속성)으로 정렬.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 정책 매트릭스 문서화 + XSS 페이로드 셋 정렬 | web-chat 의 marked 선택은 이미 문서화된 결정(README:68, `4-security.md:34`)이라 존중 — 실보안 가치는 "두 렌더러의 sanitize 정책이 명시·검증되는가" 이고 A 가 그것을 직접 달성. planner 위임 1절 + 테스트 정렬로 저비용 | 렌더러 2개 유지보수 지속 — 향후 마크다운 기능 추가 시 양쪽 구현 필요 |
    | B. react-markdown 통일 | 단일 렌더러 — sanitize 정책·테스트도 한 곳으로 수렴 | 위젯은 임베드 번들 경량성이 우선 — marked+DOMPurify 대비 react-markdown 트리 도입은 번들 비대. 문서화된 기존 결정의 번복이며 `4-security.md` 의 sanitize 의무 재설계 수반 — frontend 측 사용처가 assistant 패널 1곳뿐이라 통일 편익 자체가 작음 |
  - **권장**: A — 이원화는 번들 환경 차이에서 온 합리적 결과이고 무문서인 쪽(frontend)의 기록 공백이 실제 문제다. 정책 매트릭스 문서화와 동일 XSS 페이로드 셋 정렬이 통일 없이도 보안 동등성을 검증 가능하게 만들며, 비용은 B 의 수십분의 일이다.
  - 검증: `npm test -- safe-html` + `npm test -- markdown-renderer`. / spec 갱신: 위 1 이 본체 (planner).

- [x] **m-5 `@nestjs/config ^4` — NestJS 11 대응 정상 (기록용)** — 독립 versioning 확인, 조치 불요 (2026-06-10).

- [ ] **m-6 버전 핀 정책 비일관 — "패키지 내부까지 비일관" 으로 보정** —
  - **spec 대조**: B — 핀 정책 문서 0건. **보정**: channel-web-chat 도 전부 exact 아님(dompurify/marked/react 만 exact, next 는 caret) + frontend 에 `three ~0.184.0` tilde — 패키지 *내부*까지 비일관.
  - **개선 방안**: 1. PROJECT.md 에 3줄 정책: (a) 기본 caret, (b) lock 이 재현성 SoT, (c) exact/tilde 는 사유 주석 필수(예: three 는 0.x semver 특성). 2. 정책 확정 후 web-chat 의 exact 들을 caret 완화하거나 사유 명기.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. PROJECT.md 3줄 정책 (기본 caret / lock = 재현성 SoT / exact·tilde 는 사유 주석 필수) | 비일관의 *원인*(정책 부재)을 제거 — 의도 있는 핀(three 의 0.x semver 특성, sanitize 경로의 dompurify/marked)은 사유 명기로 보존하면서 무사유 핀만 선별 정리. 향후 신규 의존성의 판단 기준 제공 | 기존 exact 들의 사유 발굴·주석 작업 필요 — 사유 불명 핀은 git 고고학 또는 "사유 없음 → caret 완화" 판정 비용 |
    | B. caret 일괄 완화 | 기계적 단순 — 표면 일관성 즉시 달성, 정책 논의 불요 | 의도적 핀의 사유 확인 없이 일괄 완화 — sanitize 핵심 라이브러리(dompurify/marked)의 고정 의도가 있었다면 소실. lock 이 이미 재현성을 보장하므로 완화의 실익도 제한적 — 일관성 *형식* 만 얻고 "왜 핀했나" 정보는 영구 유실 |
  - **권장**: A — 문제의 본질은 "핀이 섞여 있다" 가 아니라 "어떤 핀이 의도이고 어떤 것이 우연인지 구분 불가" 이다. 정책 3줄 + 사유 주석 의무가 그 구분을 영구화하며, B 는 정보를 버리면서 lock 이 이미 제공하는 재현성 외에 얻는 것이 없다.
  - 검증: web-chat install+test+build. / 회귀 위험: lock 고정이라 즉시 영향 없음. / spec 갱신: 불요 (PROJECT.md).

- [x] ~~**m-7 three.js 번들 — dynamic import 적용 확인**~~ — **종결 = 기적용 확인 (2026-06-10)**
  - **사유**: E — `graph-visualization.tsx:31` 에서 `dynamic(() => import("./graph-3d-renderer"), ...)` + docstring "부모에서 next/dynamic + ssr:false 로 lazy load" — **이미 적용됨**. (선택: 빌드 청크 리포트에서 three 분리 1회 확인.)

- [ ] **m-8 `engines.node` 미선언 — floor 결정 선행 (제안값 22 는 출처 불명)** —
  - **spec 대조**: **C(문서 괴리)** — 원안 `>=22.0.0` 이 README("20+")·기존 선언(web-chat/sdk `>=20`)·운영(`node:24`) 어느 쪽과도 불일치. m-1 과 동일한 floor 결정 선행 — README·engines·@types/node 를 단일 결정으로 정렬.
  - **개선 방안**: 1. floor 결정 — **`packages/sdk` 는 외부 배포 의도(`@workflow/sdk`)가 있으므로 보수적 floor(>=20) 유지 권장**, 내부 앱(backend/frontend/내부 packages)만 운영 floor. 2. 결정값으로 미선언 패키지에 `engines` 추가. 3. m-1·README 와 같은 PR.
  - **옵션 비교** (m-1 과 단일 결정 — 사용자 결정 자료):
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 전 패키지 `>=20` | 기존 선언(web-chat/sdk `>=20`)·README "20+" 와 무변경 정합 | 운영 node:24·CI 24 와의 괴리를 engines 가 공식화 — "20 에서 돌아간다" 는 보장을 아무 CI leg 도 검증하지 않음. Node 20 은 2026-04 EOL 경과 |
    | B. 전 패키지 `>=24` | 운영·CI·Docker 와 완전 정렬 — 검증되는 환경만 약속. 문서 괴리 일괄 종결 | 외부 배포 의도 `@workflow/sdk` 의 소비자 호환폭 축소 — README "20+" 파기 수반 |
    | C. 이원화 (sdk `>=20` / 내부 `>=24`) | sdk 의 외부 호환 보존 + 내부 앱은 실검증 환경만 약속 — 개선 방안 1 의 권장과 일치 | 기준 2개를 README·PROJECT.md 에 명시 유지해야 함. sdk `>=20` 의 실보장에는 CI Node 20 leg 검토 필요 |
  - **권장**: C — 내부 앱의 engines 는 "실제로 빌드·테스트되는 환경"(24)만 약속하는 것이 정직하고, sdk 는 외부 배포 의도상 보수 floor 가 표준 관행이다. engines 는 engine-strict 미사용 시 advisory 라 어느 안이든 즉시 회귀는 없으므로, 결정의 본질은 README·CI·Docker 문서 일관성이며 **최종 floor 는 m-1 과 묶어 사용자가 결정**한다.
  - 검증: `npm install` 경고 없음(engines 는 advisory — engine-strict 미사용 확인) + CI. / 회귀 위험: 거의 없음. / spec 갱신: 불요.

- [ ] **m-9 otplib — "유지관리 정지" 전제 오류, 올바른 조치는 ^13 업그레이드** ⚠️ **(A — 라이브러리 선택은 spec 명시)** — `backend/package.json:68` (v12.0.1)
  - **spec 대조**: **A** — `1-data-model.md:66` "two_factor_secret | TOTP secret (**otplib base32**)" — spec 데이터 모델이 otplib 지정. **전제 반증**: otplib 는 활발히 유지 중 — 13.0.2(2026-01)~13.4.1(2026-05-30) 연속 릴리스. "2021년 정지" 는 v12 라인 한정 과거 사실. **남는 문제**: 사용 버전이 4년 stale 한 12.0.1 — 직접 구현(원안)이 아니라 **^13 메이저 업그레이드**가 올바른 조치. **사용자 보고 대상(기존 secret 호환성 게이트).**
  - **개선 방안**: 1. 항목을 "otplib ^13 업그레이드" 로 재정의 — 영향 코드는 `totp.service.ts` 단일 파일(4 API: options/generateSecret/keyuri/check), v13 의 import 경로·crypto 플러그인(`@otplib/plugin-crypto-noble`·base32-scure) 재편 대응. 2. **게이트: 기존 발급 secret 호환성** — v12 발급 base32 secret 이 v13 디코딩과 동일한지 cross-version 회귀 테스트 (기존 사용자 2FA lockout 방지). 3. `npm install otplib@^13` + totp unit + 2FA e2e.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `^13` 업그레이드 | 4년 stale(12.0.1, 2021) 해소 — 13.x 는 활발한 현행 라인(13.0.2 2026-01 ~ 13.4.1 2026-05-30)이라 향후 보안 패치 수용 가능. spec 의 "otplib base32" 표기는 버전 무관이라 spec 정합 유지. 영향 코드가 `totp.service.ts` 단일 파일(4 API)로 국소적 | v13 의 import 경로·crypto 플러그인(`@otplib/plugin-crypto-noble`·base32-scure) 재편 대응 필요. **cross-version secret 호환성 게이트 필수** — v12 발급 base32 secret 의 v13 디코딩 동일성, 기본 옵션(window·step) 차이 검증 실패 시 기존 사용자 2FA lockout. 회귀 위험 중간 |
    | B. v12 유지 | 비용 0, lockout 위험 0 — 현행 동작이 검증된 상태 | v12 라인은 2021 이후 릴리스 정지 — TOTP 라는 보안 크리티컬 경로에서 향후 CVE 발생 시 패치 라인 부재. stale 이 누적될수록 업그레이드 격차·비용 증가 — 미루는 만큼 게이트 비용이 사라지는 게 아니라 이연될 뿐 |
  - **권장**: A — 보안 크리티컬 경로(2FA)를 패치 라인이 끊긴 버전에 두는 위험이 cross-version 게이트의 일회성 비용보다 크다. 단 게이트(v12 발급 secret 회귀 테스트) 선행이 절대 조건이며, 본 항목은 **사용자 보고·승인 후 착수** 대상이다.
  - 검증: `npm test -- totp` + 2FA 가입·로그인 e2e + v12 secret cross-version check 케이스. / 회귀 위험: **중간** — secret 인코딩/기본 옵션(window·step) 차이 = 사용자 lockout. cross-version 테스트 선행 필수. / spec 갱신: 불요 ("otplib base32" 표기는 버전 무관).
