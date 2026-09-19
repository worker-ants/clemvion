# API 계약(API Contract) 리뷰 — 2라운드 (SSRF 가드 통합, resolution 반영분)

## 개요

이번 라운드의 diff 는 (1) 1라운드 WARNING/INFO 에 대한 실제 코드 조치(`a1e1a591b` 등: `SsrfBlockedError` 클래스화, 테스트 보강, `CHANGELOG.md`·`.env.example` 갱신)와 (2) 1라운드 자체의 리뷰 산출물(`review/code/.../21_38_32/*`, `review/consistency/.../21_02_09/*`)이 저장소에 신규 파일로 커밋된 것으로 구성된다. REST 컨트롤러·DTO·라우트·버전·인증/인가 데코레이터는 이번 diff 에도 포함되지 않는다 — `integrations.controller.ts` 자체 변경 없음, `integrations.service.ts`/`send-email.handler.ts` 는 import 경로 교체 + 주석 정정만. 따라서 API 표면(엔드포인트 시그니처)에 대한 신규 계약 변경은 이번 라운드에도 없고, 1라운드에서 제기된 "동일 엔드포인트가 특정 입력에 대해 이제는 다른 결과를 반환한다"는 동작 계약 변경 하나가 이번 라운드에 어떻게 처리됐는지가 검토의 핵심이다.

## 발견사항

- **[INFO]** 1라운드 API 계약 WARNING(하위 호환성 — CGNAT·IPv4-mapped host 를 쓰던 기존 통합이 조용히 차단 전환)이 `CHANGELOG.md`·`.env.example` 갱신으로 해소됨 — 확인
  - 위치: `CHANGELOG.md` 게이트 3~20(신규 `## Unreleased` 항목, 특히 게이트 18~20 "배포 뒤 보일 수 있는 것" 단락), `codebase/backend/.env.example` 게이트 368~372(헤더가 "HTTP Request, DB Query and Send Email (SMTP)" 로 확장되고 `smtp-host-guard.ts` 경로·IPv4-mapped 판정 방식이 병기됨)
  - 상세: 1라운드 api_contract 리포트(`review/code/2026/09/19/21_38_32/api_contract.md` WARNING #1, 같은 라운드 SUMMARY.md WARNING #7)가 지적한 "CGNAT(`100.64.0.0/10`)·IPv4-mapped IPv6 표기의 host 를 쓰던 기존 통합 설정이 코드 배포 시점부터 별도 요청 변경 없이 조용히 차단 전환된다"는 사실이, 이번 CHANGELOG 항목에 뚫려 있던 것·고친 것·배포 뒤 보일 수 있는 것·opt-out 방법(`ALLOW_PRIVATE_HOST_TARGETS=true`)까지 명시적으로 기록됐다. 에러 코드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)와 응답 봉투(`{success, code, message}`)는 이번 라운드도 그대로 재사용해 신규 계약을 만들지 않는다.
  - 참고(조치 불필요): 이 동작 변화 자체는 여전히 실재한다 — self-host 배포가 CGNAT SMTP relay 나 IPv4-mapped 표기의 사설 대상을 쓰고 있었다면 이번 배포로 실제 차단이 걸린다. 다만 이는 "문서화되지 않은 breaking change" 가 아니라 "문서화된 의도적 보안 수정"이 되었으므로 API 계약 관점에서 더 이상 조치가 필요한 결함이 아니다.

- **[INFO]** `testEmailTransport` 의 SSRF 가드 호출이 여전히 try/catch 밖 — 1라운드 INFO 그대로 미조치(RESOLUTION 상 의도적 "조치 없음")
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `testEmailTransport` 메서드 내 `if (await isSmtpHostBlocked(credentials.host as string))` 호출부(게이트 1596 부근). 바로 아래 `transporter.verify()` 호출만 `try/catch` 로 감싸 `EMAIL_CONNECT_FAILED` 로 변환한다.
  - 상세: 이번 라운드 diff 는 이 메서드에서 import 경로 교체와 주석 정정(게이트 1594~1596)만 했을 뿐 try/catch 구조는 손대지 않았다. `smtp-host-guard.ts` 는 "판정(`SsrfBlockedError`)이 아닌 오류는 그대로 재던진다"를 이제 `instanceof` 로 명확히 계약화했으므로(1라운드 WARNING #1 조치), 향후 `assertSafeOutboundHostResolved` 내부 구현이 SSRF 판정 외의 오류를 더 자주 던지도록 바뀌면 `preview-test`/`:id/test` 엔드포인트가 구조화된 `{success,false,code,message}` 응답 대신 처리되지 않은 예외(500)를 반환할 수 있는 지점은 그대로 남아 있다. RESOLUTION.md(INFO 10)가 "새 경로 없음"으로 조치 없이 넘긴 항목과 동일 — 재지적이 아니라 잔존 확인.
  - 제안: 이번 PR 스코프는 아님. 후속으로 `send-email.handler.ts` 처럼 넓은 try 안에 두거나 별도 catch 로 감싸 응답 봉투 일관성을 방어적으로 보장하는 편을 권한다(1라운드와 동일 권고, 재조치 요구 아님).

- **[INFO]** e2e 회귀 테스트가 에러 응답 형식·상태 코드 불변을 계속 고정 — 1라운드와 동일 패턴 유지 확인
  - 위치: `codebase/backend/test/integration-connection-test.e2e-spec.ts` 신규 `it.each` B2 블록(게이트 120~169)
  - 상세: 신규 B2 케이스는 기존 A/B 케이스와 동일하게 HTTP 상태 `[200, 201]` 유지 + `{success:false, code, message}` 봉투 + `message` 에 차단 대상 host/IP 미노출(`/ffff|100\.64|127\.0\.0\.1/` 불포함)을 단언한다. 신규 에러코드 없음, 기존 3종 재사용 — 클라이언트 파싱 로직 영향 없음. 이번 라운드에서 코드 변경(`SsrfBlockedError` 도입) 이후에도 이 계약이 깨지지 않았음을 e2e 로 재확인.
  - 제안: 없음.

## 점검했으나 해당 없음

- **버전 관리**: 엔드포인트 버전 표기·변경 없음(1라운드와 동일).
- **요청 검증**: 요청 바디 스키마(`PreviewTestDto` 등) 변경 없음.
- **URL/경로 설계, 페이지네이션**: 신규/변경 라우트 없음, 목록 API 아님.
- **인증/인가**: 컨트롤러·가드 데코레이터 변경 없음.
- 내부 모듈 경로 변경(`common/utils/smtp-host-guard` → `nodes/integration/send-email/smtp-host-guard`)과 `SsrfBlockedError` export 신설은 공개 REST API 표면이 아니라 백엔드 내부 모듈 간 계약 — architecture/maintainability 리뷰 축의 관심사이며 이번 API 계약 리뷰에서는 중복 지적하지 않음.

## 뮤테이션 검증

이번 리뷰에서 저장소 파일을 수정하지 않았다. `Read` 로 프롬프트 대상 diff 와 1라운드 산출물(`review/code/.../21_38_32/api_contract.md`, `RESOLUTION.md`)만 대조했다.

## 요약

1라운드에서 API 계약 관점 유일한 WARNING 이었던 "CGNAT·IPv4-mapped host 를 쓰던 기존 통합이 별도 안내 없이 조용히 차단 전환된다"는 지적은 이번 라운드의 `CHANGELOG.md`(배포 영향·opt-out 안내)와 `.env.example`(적용 대상 헤더 확장) 갱신으로 해소됐다 — 에러 코드·응답 봉투 자체는 처음부터 바뀌지 않았고 신규 계약도 도입되지 않는다. `testEmailTransport` 의 가드 호출이 여전히 try/catch 밖에 있어 이론적으로 응답 봉투를 벗어난 예외 전파 가능성이 남아 있다는 점은 1라운드부터 있던 낮은 우선순위 INFO 로, 이번 라운드도 의도적으로 미조치 상태이며 재차 확인만 남긴다. Critical/Warning 없음.

## 위험도

LOW
