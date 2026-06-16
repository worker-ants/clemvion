# 의존성(Dependency) 리뷰 결과

## 발견사항

### 1. otplib v12 → v13 메이저 업그레이드

- **[INFO]** `otplib` 12.0.1 → 13.4.1 메이저 버전 업그레이드
  - 위치: `codebase/backend/package.json`, `codebase/backend/package-lock.json`
  - 상세: v13 은 순수 ESM 패키지 구조로 재작성되어 `@otplib/plugin-crypto` / `@otplib/plugin-thirty-two`(deprecated) 대신 `@otplib/plugin-crypto-noble`(`@noble/hashes ^2.2.0`) / `@otplib/plugin-base32-scure`(`@scure/base ^2.2.0`) 로 대체. `jest.config.ts` 에 `otplib|@otplib|@scure|@noble` transformIgnorePattern 추가로 ESM 문제 올바르게 대응.
  - 추가된 전이 의존성: `@otplib/hotp`, `@otplib/totp`, `@otplib/uri`, `@otplib/plugin-base32-scure`, `@otplib/plugin-crypto-noble`, `@noble/hashes@^2.2.0`, `@scure/base@^2.2.0` — 모두 MIT 라이선스.
  - `@noble/hashes` / `@scure/base` 는 Paul Miller(paulmillr) 계열 암호화 프리미티브로 감사 이력이 있는 신뢰도 높은 라이브러리. 의존성 추가 필요성 정당함.
  - `totp.service.ts` 에 `verifySync({ epochTolerance })` 신 API 적용 완료, v12 `authenticator.check` 참조 없음.
  - `totp.service.spec.ts` 에 RFC 6238 표준 벡터 기반 cross-version 호환 테스트 포함 — 마이그레이션 안전성 확보.
  - 제안: 이슈 없음. `@noble/hashes@2.2.0` 은 `node >= 20.19.0` engines 를 명시하며 프로젝트 floor(`>=24`)와 정렬됨.

### 2. @types/node v22 → v24 업그레이드

- **[INFO]** `@types/node` `^22.10.7` → `^24` (backend, channel-web-chat 모두)
  - 위치: `codebase/backend/package.json`, `codebase/channel-web-chat/package-lock.json`
  - 상세: `undici-types` `~6.21.0` → `~7.18.0` 전이 업데이트. `engines.node >=24` 정책(PROJECT.md 신규 섹션)과 정렬. 내부 앱 `>=24` 로 통일됨.
  - 제안: 이슈 없음. 외부 SDK(`@workflow/sdk` 등)는 `>=20` 유지가 맞으며 이번 변경 범위에는 포함되지 않음 — 일관됨.

### 3. jsdom v25 → v29 업그레이드 (channel-web-chat)

- **[INFO]** `jsdom ^25` → `^29.0.1`
  - 위치: `codebase/channel-web-chat/package-lock.json`
  - 상세: 메이저 버전 4단계 점프. v29 는 의존성 구조가 대폭 변경됨: `nwsapi` 제거, `@asamuzakjp/dom-selector` / `@bramus/specificity` / `css-tree` 신규 진입; `http-proxy-agent` / `https-proxy-agent` / `form-data` / `iconv-lite` 제거, `@exodus/bytes` / `undici@^7.25.0` 신규 진입. 모두 MIT 라이선스.
  - `canvas` peer dependency 도 `^2.11.2` → `^3.0.0` 변경됨. canvas 를 직접 사용하지 않는 경우 optional 이므로 런타임 영향 없음.
  - `lru-cache` 버전이 jsdom 로컬 스코프에 11.5.1 (BlueOak-1.0.0 라이선스). BlueOak-1.0.0 은 MIT 보다 관대한 Permissive 라이선스이며 프로젝트와 충돌 없음.
  - 제안: 이슈 없음. vitest devDependency 범위 내 변경.

### 4. @vitejs/plugin-react v4 → v6 업그레이드 (channel-web-chat)

- **[WARNING]** `@vitejs/plugin-react ^4` → `^6.0.1` — vite peerDependency 가 `^4|^5|^6|^7` → `^8.0.0` 으로 변경됨
  - 위치: `codebase/channel-web-chat/package-lock.json`
  - 상세: v6 은 내부 번들러를 Babel 에서 Rolldown 으로 전환하여 `@babel/core` / babel JSX 플러그인 / `@types/babel__core` 등 제거. `@rolldown/pluginutils` 가 `1.0.0-beta.27` → `1.0.1` 안정 버전으로 변경됨.
  - v6 은 vite `^8.0.0` 이 peer로 요구됨. `package-lock.json` 에는 vite 버전이 명시되어 있으나 본 diff 에서 vite 자체 버전 변경 여부가 visible 하지 않음. 만약 vite 가 v7 이하에 머물러 있다면 peerDependency 미충족 경고가 발생할 수 있음.
  - 제안: `codebase/channel-web-chat/package.json` 의 vite 버전을 확인하여 `^8` 로 이미 맞춰졌는지 검증 권장. lock 파일 상 `@vitejs/plugin-react` 노드 engines 가 `^20.19.0 || >=22.12.0` 으로 명시되어 있고 프로젝트 floor `>=24` 와 정렬됨.

### 5. engines.node >=24 정책 선언 (PROJECT.md + package.json/lock 전 패키지)

- **[INFO]** backend, packages/*, channel-web-chat 모두 `engines.node >=24` 추가
  - 위치: `codebase/backend/package.json`, `codebase/backend/package-lock.json` 내 로컬 패키지 블록들
  - 상세: `packages/chat-channel-validation`, `packages/expression-engine`, `packages/graph-warning-rules`, `packages/node-summary` 모두 `>=24` 선언. `channel-web-chat` `>=20` → `>=24`.
  - `expression-engine` 의 `dayjs` 가 `^1.11.13` → `^1.11.20` 패치 업: 모두 MIT.
  - 제안: 이슈 없음. `engines` 는 `engine-strict` 미사용 시 advisory로, CI 환경 pinning과 일관성 확보 목적으로 적절함.

### 6. 제거된 deprecated 의존성 정리

- **[INFO]** `thirty-two@1.0.2`, `@otplib/plugin-thirty-two@12.0.1`, `@otplib/plugin-crypto@12.0.1`, `@otplib/preset-default@12.0.1`, `@otplib/preset-v11@12.0.1` 제거
  - 위치: `codebase/backend/package-lock.json`
  - 상세: 이전 v12 프리셋들은 모두 "Please upgrade to v13" deprecated 마커를 달고 있었음. 깔끔하게 제거됨. 공급망 위험 감소.
  - 제안: 이슈 없음.

### 7. channel-web-chat의 esbuild 제거 및 rolldown 전환

- **[INFO]** `esbuild@0.27.7` 및 `@esbuild/*` 플랫폼 바이너리 전량 제거, `@rolldown/binding-*@1.0.3` 으로 대체
  - 위치: `codebase/channel-web-chat/package-lock.json`
  - 상세: `@vitejs/plugin-react v6` + vite v8 이 내부 번들러를 rolldown 으로 전환함에 따른 자연스러운 대체. `@rolldown/binding-*` 은 모두 MIT. `@rolldown/pluginutils` beta → `1.0.1` 안정 버전.
  - 제안: 이슈 없음.

### 8. undici@^7.25.0 신규 직접 의존성 (jsdom v29)

- **[INFO]** `undici@^7.25.0` 이 jsdom v29 의 직접 의존성으로 진입
  - 위치: `codebase/channel-web-chat/package-lock.json`
  - 상세: jsdom 의 HTTP 요청 처리를 `undici` 가 담당. devDependency 스코프 내 테스트 전용. MIT 라이선스.
  - 제안: 이슈 없음.

### 9. 버전 고정 정책 문서화

- **[INFO]** `PROJECT.md` 에 버전 핀 정책 명문화: caret 기본, exact·tilde 핀 시 `"//pin"` 주석 필수
  - 위치: `PROJECT.md` 신규 섹션 "버전·도구 정책"
  - 상세: `dompurify`, `marked`(sanitize 공급망), `three ~0.184.0`(0.x semver), `react`/`react-dom`(monorepo 전역) 예시로 근거 유형 명시. 현재 lock 파일 변경 내 exact pin(otplib 하위 패키지 `@otplib/*` 상호 참조 예: `"@otplib/core": "13.4.1"`)은 v13 otplib 내부 구조 설계이지 프로젝트 직접 pin이 아님 — 적절.
  - 제안: 이슈 없음. 정책 자체가 잘 정리됨.

### 10. uglify-js devOptional 플래그 변경

- **[INFO]** `uglify-js@3.19.3` 의 `"dev": true` 플래그 제거
  - 위치: `codebase/backend/package-lock.json`
  - 상세: optional 은 유지되나 dev 마킹 해제. 실제 빌드/런타임 포함 여부에는 영향 없음 (optional 이므로 누락 허용).
  - 제안: 이슈 없음.

---

## 요약

이번 변경은 크게 세 축으로 구성된다. (1) otplib v12 → v13 메이저 업그레이드 — deprecated 플러그인 제거, ESM 전용 암호화 프리미티브(`@noble/hashes`, `@scure/base`) 도입, jest transform 패턴 갱신, RFC 6238 호환 테스트 완비로 마이그레이션이 안전하게 완료됨. (2) Node 24 floor 정책 통일 — backend/packages/channel-web-chat 모두 `engines.node >=24` 선언 및 `@types/node` 동기화, PROJECT.md 에 버전 핀 정책 명문화. (3) channel-web-chat 의 `@vitejs/plugin-react v4→v6` + `jsdom v25→v29` 업그레이드 — Babel 제거, rolldown 전환, jsdom 최신화(undici 기반 HTTP, 새 DOM 셀렉터 스택). 모든 신규 의존성은 MIT(일부 BlueOak-1.0.0) 라이선스로 프로젝트와 호환되며 알려진 취약점은 발견되지 않음. `@vitejs/plugin-react v6` 의 vite `^8` peer 요구사항 충족 여부만 별도 확인이 권장된다.

## 위험도

LOW
