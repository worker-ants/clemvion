## 리뷰 결과

### 발견사항

---

**[INFO] `@slack/web-api` 추가 — 적절한 공식 클라이언트**
- 위치: `backend/package.json`, `package-lock.json`
- 상세: Slack 공식 SDK. MIT 라이선스. Node ≥ 18 요구사항이 프로젝트 환경과 일치함. `^7.15.0` 캐럿 고정은 minor/patch 업데이트를 허용하는 표준 방식으로 적절함.
- 제안: 이슈 없음

---

**[WARNING] `axios` 중복 추가 (간접 의존성이 production으로 승격)**
- 위치: `package-lock.json` `node_modules/axios` 항목 (version `1.15.0`)
- 상세: `@slack/web-api`가 `axios ^1.13.5`를 요구하여 기존 devDependency 전용이던 `axios`가 production 번들에 포함됨. 동시에 프런트엔드(`client.ts`)도 `axios`를 직접 사용 중이나, **백엔드**는 HTTP 요청을 `fetch` (Node 18 내장)로 직접 처리하는 `HttpRequestHandler`를 이미 보유하고 있음. 즉 백엔드에 `axios`가 두 번 존재하는 형태 (`@slack/web-api`의 transitive + Slack 사용).
- 제안: 현시점에서는 교체 불필요 — `@slack/web-api`의 의존성이므로 통제 불가. 단, 추후 `@slack/web-api`가 `fetch` 기반으로 마이그레이션하면 `axios`를 제거 가능.

---

**[WARNING] `follow-redirects` 전이 의존성 — 이전 버전 CVE 이력 확인 필요**
- 위치: `package-lock.json` `node_modules/follow-redirects` version `1.15.11`
- 상세: `axios → follow-redirects` 체인. `follow-redirects` 1.15.x 라인에서 과거 CVE-2024-28849 (credential leak via redirects) 등이 보고된 바 있음. `1.15.11`은 현재 최신 패치이나, 서버사이드 HTTP 요청을 대량 처리하는 환경에서 리다이렉트 체이닝 공격 가능성을 인지해야 함.
- 제안: `npm audit` 실행 후 취약점 없음을 확인. `HttpRequestHandler`에서는 이미 내장 `fetch` + `AbortController`를 사용하므로 `follow-redirects` 노출 범위는 Slack SDK 내부로 한정됨.

---

**[INFO] `eventemitter3` 버전 중복 (v4 + v5)**
- 위치: `package-lock.json` `node_modules/eventemitter3` (v5.0.4), `node_modules/p-queue/node_modules/eventemitter3` (v4.0.7)
- 상세: `p-queue ^6`이 `eventemitter3 ^4`를, `@slack/web-api`가 `eventemitter3 ^5`를 요구하여 두 버전이 중복 설치됨. npm의 정상적인 deduplication 결과이며 런타임 오류는 없으나 번들 크기가 소폭 증가함.
- 제안: `p-queue`를 v7+로 업그레이드하면 하나로 통합 가능하나, `@slack/web-api` 내부 의존성이므로 현재는 허용 범위 내.

---

**[INFO] `asynckit`, `combined-stream`, `delayed-stream`, `form-data`, `mime-db`, `mime-types`, `is-stream`, `p-finally`, `p-timeout` — devOnly 플래그 제거**
- 위치: `package-lock.json` 다수 항목
- 상세: 기존 `"dev": true`이던 패키지들이 `form-data` (axios 의존) 체인으로 인해 production 의존성으로 승격됨. 기능적 문제는 없으나, 이전에 dev 전용이었던 이유(기존 axios가 devDep)가 사라진 부작용임.
- 제안: 이슈 없음 — 의도된 결과.

---

**[INFO] `is-electron` 포함 (서버 환경에서 불필요)**
- 위치: `package-lock.json` `node_modules/is-electron` version `2.2.2`
- 상세: `@slack/web-api` 내부에서 Electron 환경 감지용으로 포함. 백엔드(NestJS)에서는 항상 `false`를 반환하므로 실질적 영향 없음. 크기도 무시할 수준(< 1KB).
- 제안: 이슈 없음.

---

**[INFO] `SendEmailHandler`의 `nodemailer` 직접 임포트 — 기존 `@nestjs-modules/mailer` 미활용**
- 위치: `send-email.handler.ts`, `package.json`
- 상세: `package.json`에 `@nestjs-modules/mailer`와 `nodemailer`가 이미 존재하는데, 핸들러가 `nodemailer`를 직접 사용하여 NestJS DI 컨테이너를 우회하고 매 실행마다 새 `Transporter`를 생성함. 이는 의도된 설계(통합별 credentials로 동적 생성)로 보이나, 커넥션 풀링 없이 `finally { transporter.close() }`로 즉시 닫는 방식.
- 제안: SMTP 처리량이 높을 경우 커넥션 풀(예: `smtp.pool: true`) 또는 캐싱 레이어 도입을 고려. 현재 스펙 범위에서는 허용 가능.

---

**[INFO] 프런트엔드 `paramsSerializer` 추가 — axios 배열 직렬화 수정**
- 위치: `frontend/src/lib/api/client.ts`
- 상세: 의존성 추가는 없음. 기존 `axios` 동작의 설정 변경으로, `serviceType` 배열 쿼리 파라미터 전송 문제를 해결함. 주석으로 배경이 명확히 문서화되어 있음.
- 제안: 이슈 없음. 다만 다른 API 호출이 기존 `foo[]=` 형식을 기대하지 않는지 확인 필요 (전역 변경이므로).

---

### 요약

`@slack/web-api ^7.15.0` 단일 직접 의존성 추가가 핵심 변경이며, MIT 라이선스·공식 SDK·Node 18+ 호환성 모두 적절하다. 이 추가로 인해 `axios`, `follow-redirects`, `form-data`, `eventemitter3 v4/v5` 등 여러 전이 의존성이 production 번들에 편입되었는데, 이는 npm 정상 동작의 결과이며 기능적 문제는 없다. 주목할 점은 `follow-redirects` 이력 CVE이지만 `1.15.11`이 현재 최신 패치이므로 `npm audit` 확인 후 클린하면 이슈 없다. 프런트엔드의 `paramsSerializer` 변경은 전역 axios 인스턴스에 적용되므로 다른 엔드포인트에 미치는 회귀를 E2E 테스트로 검증하는 것이 권장된다.

### 위험도

**LOW**