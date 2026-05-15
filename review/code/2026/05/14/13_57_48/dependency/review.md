## 의존성 리뷰

### 발견사항

- **[INFO]** `crypto` 빌트인 모듈 신규 심볼 사용
  - 위치: `integration-oauth.service.ts:4`, `integration-oauth.service.cafe24.spec.ts:2`
  - 상세: `createHmac`, `timingSafeEqual`을 Node.js 내장 `crypto` 모듈에서 추가 import. 외부 패키지 없음. `timingSafeEqual` 사용으로 HMAC 비교 시 타이밍 공격을 방어하는 것이 적절함.
  - 제안: 없음.

- **[INFO]** `ForbiddenException` 추가 import
  - 위치: `integration-oauth.service.ts:4`, `integrations.controller.ts`
  - 상세: 이미 의존하는 `@nestjs/common`에서 심볼 하나 더 추가. 신규 패키지 없음.
  - 제안: 없음.

- **[INFO]** Express `Request` 타입 및 `Req` 데코레이터 추가 import
  - 위치: `integrations.controller.ts:8,12`
  - 상세: `@nestjs/common`의 `Req`와 `express`의 `Request` 타입 — 둘 다 이미 프로젝트 의존성. `rawQuery` 추출 목적.
  - 제안: 없음.

- **[INFO]** `Copy` 아이콘 추가 import
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx:8`
  - 상세: 이미 사용 중인 `lucide-react`에서 아이콘 하나 추가. 번들 크기 영향 없음 (tree-shaking 적용).
  - 제안: 없음.

- **[INFO]** 내부 모듈 간 타입 의존 추가
  - 위치: `integrations.service.ts:16` — `BeginResult` 타입을 `integration-oauth.service.ts`에서 import
  - 상세: 두 서비스 간 타입 공유가 단방향으로 유지되고 순환 의존 없음. `integrations.service.ts` → `integration-oauth.service.ts` 방향이 기존 구조와 일치.
  - 제안: 없음.

- **[INFO]** `rawQuery` 추출 방식
  - 위치: `integrations.controller.ts` — `req.url.split('?', 2)[1]`
  - 상세: Express의 `req.url`은 raw URL을 유지하므로 HMAC 검증에 필요한 원본 인코딩 보존에 적합. 단, 리버스 프록시가 `req.originalUrl`과 `req.url`을 다르게 처리할 경우 `req.url`이 프록시 경로 변환 이후 값일 수 있음. 현 구성에서는 문제없으나 NestJS + Express 표준 스택 기준으로 `req.originalUrl` 사용이 더 방어적임.
  - 제안: `req.url` → `req.originalUrl`로 변경 고려 (리버스 프록시 환경 대비).

---

### 요약

이번 변경에서 신규 외부 패키지는 단 하나도 추가되지 않았다. 새로운 심볼은 모두 Node.js 내장 `crypto`, 기존 `@nestjs/common`, 기존 `express`, 기존 `lucide-react`에서 가져온 것이며, 내부 모듈 간 타입 공유도 단방향 의존으로 순환 참조가 없다. 의존성 관점에서 리스크 요인이 전무하다.

### 위험도

**NONE**