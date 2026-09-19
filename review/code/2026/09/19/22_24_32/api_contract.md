# API 계약(API Contract) 리뷰 — 3라운드 (SSRF 가드 통합, 수렴 확인)

## 개요

이번 라운드의 diff 는 누적본으로, 1·2라운드에서 이미 검토된 코드 변경(`http-safety.ts` IPv4-mapped IPv6 판정 보강,
`smtp-host-guard.ts` 를 `common/utils` → `nodes/integration/send-email/` 로 이전하며 `http-safety` 구현으로 통일,
`SsrfBlockedError` 클래스 도입)과, 2라운드 WARNING 조치 커밋(`fce34b77b` — 가이드 문서에 Email(SMTP)·CGNAT 반영,
JSDoc 문단 복원, 정규화 폴백 테스트, 트래커 등재)및 그 리뷰 산출물 커밋(`bb4c5381b`, `77cf6aa7a` 등, `review/**` 문서만)을
포함한다. `bb4c5381b` 이후 `codebase/**` 를 건드리는 신규 커밋은 없다 — 즉 API 계약 관점에서 볼 코드 표면은 2라운드
시점과 동일하다.

`integrations.controller.ts`(라우트·DTO·데코레이터)는 이번 diff 에도 포함되지 않는다. 변경은 여전히 (1) SSRF 판정
로직 자체(IPv4-mapped IPv6 정규화, CGNAT 대역)와 (2) SMTP 가드의 구현 이전(모듈 경로만 이동, 시그니처
`isSmtpHostBlocked(host: string): Promise<boolean>` 불변)에 국한된다.

## 발견사항

- **[INFO]** 하위 호환성 — CGNAT·IPv4-mapped host 를 쓰던 기존 통합의 "조용한 차단 전환" 은 1·2라운드에 이미 지적·해소된 사안, 이번 라운드도 그 상태 유지를 재확인
  - 위치: `CHANGELOG.md` (신규 `## Unreleased` 항목, "배포 뒤 보일 수 있는 것" 단락), `codebase/backend/.env.example`
    게이트 368~372(적용 대상이 "HTTP Request, DB Query and Send Email (SMTP)" 로 확장되고 IPv4-mapped 판정 방식 병기)
  - 상세: HTTP Request(모든 인증 방식·리다이렉트 홉)·Database Query·Send Email(연결 테스트·발송)이 이제 하나의 가드
    (`http-safety.ts`)를 쓰면서, 종전에 통과하던 입력(IPv4-mapped IPv6 표기의 사설/루프백 대상, SMTP 의 CGNAT
    `100.64.0.0/10` 및 `::`)이 배포 시점부터 별도 스키마·요청 변경 없이 차단으로 바뀐다. 이는 같은 엔드포인트가
    같은 요청 바디에 대해 이전과 다른 응답(`success:false` + 새 차단)을 반환하게 되는 실질적 동작 계약 변경이지만,
    (a) `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 이 이미 존재하는 기존 메커니즘을 그대로 재사용하고, (b) `CHANGELOG.md`
    가 뚫려 있던 것·고친 것·배포 뒤 보일 수 있는 것·opt-out 방법을 명시적으로 기록했으며, (c) 에러 코드
    (`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)와 응답 봉투(`{success, code, message}`)는 그대로 재사용해
    신규 계약을 만들지 않는다. 문서화된 의도적 보안 수정으로 자리 잡았으므로 이번 라운드도 조치 불요.
  - 제안: 없음 — 조치 완료 상태 유지.

- **[INFO]** `testEmailTransport`(`/integrations/preview-test`, `/integrations/:id/test`) 의 `isSmtpHostBlocked` 호출이 여전히 try/catch 밖 — 1·2라운드부터 있던 낮은 우선순위 잔존 사안, 재조치 요구 아님
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `testEmailTransport` 메서드,
    `if (await isSmtpHostBlocked(credentials.host as string))` 호출부(주석이 "SSRF 완화(opt-in)" → "SSRF 가드(기본 ON)" 로
    정정된 바로 그 지점). 바로 아래 `transporter.verify()` 호출만 별도 `try/catch` 로 감싸 `EMAIL_CONNECT_FAILED` 로
    변환한다.
  - 상세: `smtp-host-guard.ts` 는 이제 "판정(`SsrfBlockedError`)이 아닌 오류는 그대로 재던진다"를 `instanceof` 로
    명확히 계약화했다(1라운드 조치). `assertSafeOutboundHostResolved` 내부 구현이 향후 SSRF 판정 외의 오류를 던지는
    경우가 늘면, 이 호출부는 그 오류를 흡수하지 못하고 `preview-test`/`:id/test` 응답이 구조화된
    `{success:false, code, message}` 대신 처리되지 않은 예외(500, 응답 봉투 붕괴)로 나갈 수 있는 이론적 지점이 그대로
    남아 있다. `send-email.handler.ts` 의 발송 경로는 `isSmtpHostBlocked` 호출이 넓은 `try` 안에 있어 이 비대칭이
    연결 테스트 경로에만 있다(직접 확인: `send-email.handler.ts` L173~180 은 최상위 `try` 블록 내부).
  - 제안: 이번 PR 스코프 밖(1·2라운드와 동일 결론). 후속으로 발송 경로처럼 넓은 `try` 로 감싸 응답 봉투 일관성을
    방어적으로 보장하는 편을 권한다 — 재조치를 요구하는 것은 아니다.

- **[INFO]** e2e 회귀 테스트가 에러 응답 형식·상태 코드·비노출 정책 불변을 계속 고정 — 확인
  - 위치: `codebase/backend/test/integration-connection-test.e2e-spec.ts` `it.each` B2 블록
  - 상세: 신규 B2 케이스(HTTP `[::ffff:127.0.0.1]`, DB `::ffff:127.0.0.1`, Email `100.64.0.1`)가 기존 A/B 케이스와
    동일하게 HTTP 상태 `[200, 201]` 유지 + `{success:false, code, message}` 봉투 + 차단 대상 host/IP 미노출
    (`/ffff|100\.64|127\.0\.0\.1/` 불포함, CWE-209 정찰 면 축소)을 단언한다. 신규 에러 코드 없음, 기존 3종
    (`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`) 재사용 — 클라이언트 파싱 로직에 영향 없음.
  - 제안: 없음.

## 점검했으나 해당 없음

- **버전 관리**: 엔드포인트 버전 표기·변경 없음.
- **요청 검증**: 요청 바디 스키마(`PreviewTestDto` 등) 변경 없음 — `dispatchTest` 의 `validateCredentials` 필수 필드
  검증이 가드 호출보다 선행하는 구조도 그대로.
- **URL/경로 설계, 페이지네이션**: 신규/변경 라우트 없음, 목록 API 아님.
- **인증/인가**: `integrations.controller.ts` 자체가 이번 diff 에 없다 — 가드 데코레이터 변경 없음.
- 내부 모듈 경로 변경(`common/utils/smtp-host-guard` → `nodes/integration/send-email/smtp-host-guard`)과
  `SsrfBlockedError` export 신설은 공개 REST API 표면이 아니라 백엔드 내부 모듈 간 계약 — architecture/maintainability
  리뷰 축의 관심사(이미 별도 라운드에서 다룸: architecture WARNING 2 는 "수렴 예외" 로 트래커 등재됨)이며 API 계약
  리뷰에서 중복 지적하지 않는다.

## 뮤테이션 검증

이번 리뷰에서 저장소 파일을 수정하지 않았다. `Read`/`Grep` 으로 프롬프트 대상 diff, `integrations.service.ts`·
`send-email.handler.ts` 의 현재 코드, `http-safety.ts` 전체, 1·2라운드 산출물(`review/code/.../21_38_32/`,
`review/code/.../22_00_32/`)만 대조했다. `git status --short` 는 확인하지 않았다(파일 쓰기 자체가 없었음).

## 요약

이번은 3라운드이며 `bb4c5381b`(2라운드 SUMMARY·RESOLUTION 커밋, `review/**` 문서만) 이후 `codebase/**` 를 건드리는
신규 커밋이 없다 — API 계약 관점의 코드 표면은 2라운드와 동일하다. 1라운드에서 유일했던 API 계약 WARNING("CGNAT·
IPv4-mapped host 를 쓰던 기존 통합이 조용히 차단 전환된다")은 2라운드에 `CHANGELOG.md`·`.env.example` 갱신으로 이미
해소됐고, 이번 라운드도 그 해소 상태가 유지됨을 재확인했다. 응답 봉투(`{success, code, message}`)·기존 에러 코드
3종·HTTP 상태 코드·라우트·인증 데코레이터 어느 것도 변경되지 않았다. `testEmailTransport` 의 가드 호출이 try/catch
밖에 있다는 낮은 우선순위 INFO 만 1라운드부터 그대로 잔존하며, 재조치를 요구하지 않는다. Critical·Warning 없음 —
`codebase/` 수정 0 라운드로 수렴.

## 위험도

LOW
