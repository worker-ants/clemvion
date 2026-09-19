# 부작용(Side Effect) 리뷰 — SSRF 가드 통합 2라운드 (SMTP CGNAT / IPv4-mapped IPv6, resolution 커밋 포함)

## 검토 방법

`http-safety.ts`/`smtp-host-guard.ts`(신·구)/`integrations.service.ts`/`send-email.handler.ts`/`database-query.handler.ts`/
`http-request.handler.ts`/`http-redirect.ts`/`http-connection-tester.ts`/`database-connection-tester.ts` 를 `Read` 로 직접 열어
1라운드 리뷰(`review/code/2026/09/19/21_38_32/side_effect.md`) 의 결론을 재검증했다. 저장소 전수 `grep` 으로 (1) 옛 경로
`common/utils/smtp-host-guard` 잔존 참조, (2) `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`/`isBlockedHostname`
호출자 전체, (3) `err.name`/`.constructor.name` 기반 분기가 신규 `SsrfBlockedError` 와 충돌하는지 확인했다. 저장소 파일은
수정하지 않았다(`git status --short` — 세션 시작 시점과 동일, 이번 리뷰 세션 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 신규 `SsrfBlockedError` 는 `Error` 서브클래스라 기존 `instanceof Error` 판별자와 충돌하지 않는다 (확인됨, 결함 아님)
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` `class SsrfBlockedError extends Error`
    (파일 8, 게이트 47~52) — 소비 지점: `http-request.handler.ts`(`catch (err)`, 일반 `Error` 처리),
    `database-connection-tester.ts:138`(`err instanceof Error ? err.message : String(err)`),
    `database-query.handler.ts`(bare `catch`), `http-redirect.ts`(`catch (err)`)
  - 상세: `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 가 던지는 오류 타입이 익명 `Error` 에서 `SsrfBlockedError`
    로 바뀌었지만, 메시지 포맷(`SSRF_BLOCKED: …`)은 그대로다. 저장소 전수 grep(`err.name ===`, `.constructor.name`)으로
    "AbortError" 류 판별자만 있고 SSRF 오류 경로에서 `error.name === 'Error'` 또는 `constructor === Error` 로 좁게 비교하는
    코드는 없음을 확인했다 — 이번 diff 밖의 4개 호출부(위 목록) 모두 `instanceof Error` 또는 무조건 catch 라 회귀 없음.
  - 제안: 조치 불필요. 확인용 기록.

- **[INFO]** `isBlockedHostname`(공개 함수)의 차단 범위 확장이 diff 밖의 기존 호출자 3곳에도 자동 전파된다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` `isBlockedIPv6`(파일 8, 게이트 116~129,
    `canonicalIPv6`/`mappedIPv4` 신설) — 전파 대상(diff 밖, 이번 리뷰에서 `Read` 로 직접 확인): `http-request.handler.ts`
    (`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 호출), `database-query.handler.ts:261`
    (`assertSafeOutboundHostResolved` 호출), `database-connection-tester.ts:137`(동일)
  - 상세: 이 세 파일은 이번 diff 에 포함되지 않았지만 `http-safety.ts` 의 공유 판정 함수를 그대로 import 하므로, IPv4-mapped
    IPv6 표기에 대한 차단 확장이 코드 수정 없이 자동으로 적용된다. 이는 plan(`plan/in-progress/ssrf-guard-integration-unify.md`)
    이 의도한 "세 노드가 한 표를 공유" 의 정확한 결과이며 새로운 결함은 아니다 — 다만 "함수가 예상 외의 공유 상태/동작을
    바꾸는지" 관점에서, diff 에 나타나지 않는 세 소비자가 동시에 동작 변경을 받는다는 사실은 명시해 둔다(1라운드
    side_effect.md 도 동일하게 기록).
  - 제안: 조치 불필요.

- **[INFO]** `isSmtpHostBlocked` 가 "판정 아닌 오류는 재던진다" 는 새 실패 모드를 얻었으나, 실제 도달 가능 경로가 없다
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts`(파일 12, 게이트 20~31) —
    호출부 `codebase/backend/src/modules/integrations/integrations.service.ts` `testEmailTransport`(게이트 1596,
    가드 호출이 `try` 진입 전)
  - 상세: 옛 구현(`common/utils/ssrf.util.ts` 의 `isPrivateHost`/`resolvesToPrivate`, 이번 diff 밖 파일을 직접 열어 확인)은
    모든 코드 경로가 `try/catch` 로 스스로 오류를 흡수해 boolean 만 반환했다 — 즉 `isSmtpHostBlocked` 는 사실상 절대
    throw 하지 않았다. 새 구현은 `assertSafeOutboundHostResolved` 의 catch 블록에서 `SsrfBlockedError` 가 아닌 오류를
    명시적으로 rethrow 한다(게이트 27~29). 다만 `assertSafeOutboundHostResolved` 자신은 DNS 조회 실패를 내부에서 흡수하고
    (`http-safety.ts` 게이트 194~201, fail-open) 그 외에는 `SsrfBlockedError` 만 던지므로, 정상 문자열 입력에서는 이
    rethrow 경로에 실제로 도달하지 않는다(신규 테스트도 `jest.doMock` 으로 인위 재현). `testEmailTransport` 의 가드 호출이
    `try` 밖에 있어, 만약 도달한다면 `{success:false,...}` 구조화 응답 대신 처리되지 않은 예외로 전파되지만 — 이는 1라운드
    security.md/api_contract.md 가 이미 INFO 로 낮게 평가했고 이번 재검증에서도 동일 결론이다(현재 코드로는 이론적 경로).
  - 제안: 조치 불필요(이번 PR 스코프 밖). 후속으로 `testEmailTransport` 의 가드 호출도 넓은 `try` 안에 두면 방어적으로
    더 안전해진다 — 1라운드 RESOLUTION 이 이미 이 사실을 기록.

- **[INFO]** 모듈 이동(`common/utils/smtp-host-guard` → `nodes/integration/send-email/smtp-host-guard`) 후 옛 경로 참조 0건
  - 위치: 저장소 전수 grep(`grep -rn "common/utils/smtp-host-guard" codebase/`) — 0건. 코드상 참조 4곳
    (`integrations.service.ts:13`, `integrations.service.spec.ts:27`, `send-email.handler.ts:24`,
    `send-email.handler.spec.ts:4`) 전부 새 경로로 갱신 확인.
  - 상세: `plan/complete/spec-draft-integration-connection-tests.md` 등 일부 **문서**(코드 아님)가 옛 경로를 언급하지만
    이는 side effect 리뷰 범위(런타임 동작)가 아니라 문서 정합성 문제라 documentation/consistency 리뷰 관점.
  - 제안: 조치 불필요(코드 관점).

- **[INFO]** 파일시스템 부작용은 CLAUDE.md 워크플로가 요구하는 예상된 산출물 범위 안
  - 위치: `plan/in-progress/ssrf-guard-integration-unify.md`(신규), `review/code/2026/09/19/21_38_32/**`(1라운드 리뷰
    산출물, 이번 diff 에 커밋됨), `review/consistency/2026/09/19/21_02_09/**`(신규), `scripts/backend-typecheck-baseline.json`
    (197→194, 자동 생성 ratchet baseline — 손 편집 아님)
  - 상세: 전부 `--impl-prep`/`/ai-review` 워크플로가 요구하는 정규 산출물이며, 코드 변경(`http-safety.spec.ts` mock 타입
    수정)이 실제 타입 오류 3건을 해소했다는 근거(`1e07cf5cf`)와 baseline 숫자가 일치한다. 예상 밖의 파일 생성·삭제 없음.
  - 제안: 조치 불필요.

- **[INFO]** 환경변수·네트워크 호출 — 신규 없음
  - 상세: `ALLOW_PRIVATE_HOST_TARGETS` 는 기존과 동일한 단일 지점(`http-safety.ts` `isPrivateHostsAllowed()`)에서만
    읽는다 — 새 `smtp-host-guard.ts` 는 이 env var 를 직접 읽지 않고 `assertSafeOutboundHostResolved` 위임으로 중앙화했다
    (옛 `common/utils/smtp-host-guard.ts` 는 자체적으로 `process.env.ALLOW_PRIVATE_HOST_TARGETS` 를 다시 읽었다 — diff 로
    이 중복 읽기가 제거됨, 개선). `dns.lookup` 호출 횟수·경로도 옛 `ssrf.util.resolvesToPrivate` 와 새
    `assertSafeOutboundHostResolved` 가 각각 hostname 당 최대 1회로 동일 — 신규 외부 I/O 없음(1라운드 side_effect.md 의
    같은 결론을 코드 대조로 재확인).

## 요약

이번 2라운드 diff(1라운드 조치 커밋 `a1e1a591b` 포함)를 소스 코드 직접 대조로 재검증한 결과, 부작용 관점에서 새로 발견된
CRITICAL/WARNING 은 없다. 에러 타입을 `Error` → `SsrfBlockedError` 로 좁힌 변경은 `instanceof Error` 판별자에 의존하는
diff 밖 4개 호출부 전부와 호환되며(직접 대조 완료), 메시지 포맷 불변으로 문자열 매칭 소비자도 영향 없다. 공유 판정 함수
(`isBlockedHostname`)의 차단 범위 확장은 diff 에 나타나지 않는 3개 소비자(HTTP handler·DB Query handler·DB connection
tester)에도 자동 전파되지만 이는 plan 이 명시한 의도된 결과다. `isSmtpHostBlocked` 가 얻은 "판정 아닌 오류 재던짐" 경로는
현재 코드상 도달 불가능(옛 구현은 아예 throw 하지 않았다는 점까지 직접 대조로 확인)하고, 도달 시의 파급(비구조화 예외)도
1라운드에서 이미 INFO 로 정확히 평가돼 있다. 모듈 이동은 grep 전수 확인으로 잔존 참조 0건, 신규 env var·네트워크 호출·
전역 변수·이벤트/콜백 변경은 없다. 리뷰 중 저장소에 어떤 쓰기도 하지 않았다.

## 위험도

LOW
