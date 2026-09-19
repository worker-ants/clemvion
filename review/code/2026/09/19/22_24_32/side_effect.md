# 부작용(Side Effect) 리뷰 — 통합 노드 SSRF 가드 하나로 (SMTP CGNAT / IPv4-mapped IPv6, 3라운드 누적)

## 검토 방법

`http-safety.ts`(diff는 프롬프트에서 생략돼 `git diff origin/main -- <path>` 로 직접 확인) · `smtp-host-guard.ts`(신·구) ·
`integrations.service.ts` · `send-email.handler.ts` 를 직접 열람하고, `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`/
`isBlockedHostname` 의 저장소 전수 호출자(`database-query.handler.ts` · `http-request.handler.ts` · `http-redirect.ts` ·
`database-connection-tester.ts`)를 `grep` 으로 찾아 에러 타입 변경(`Error` → `SsrfBlockedError`)·차단 범위 확장(IPv4-mapped)의
전파 영향을 직접 대조했다. 옛 경로(`common/utils/smtp-host-guard`) 잔존 참조·`isBlockedHostname` 외부 소비자도 저장소 전수
grep 으로 확인(각각 0건 / 파일 내부 한정). 1·2라운드 자체 side_effect 리뷰(`review/code/2026/09/19/21_38_32/side_effect.md`,
`.../22_00_32/side_effect.md`)가 이미 같은 항목을 코드 대조로 검증해 두었으므로, 그 결론을 재확인하고 3라운드에서 새로
추가된 변경분(CHANGELOG·`.env.example`·mdx 문서·트래커 등재·RESOLUTION/SUMMARY 산출물)만 추가로 점검했다.

## 발견사항

- **[INFO]** (관측된 이상 상태 — 이번 PR 의 결함 아님) 리뷰 도중 `http-safety.ts` 가 커밋되지 않은 상태로 변경되는 것을 관측했다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` — `PRIVATE_V4_RANGES` 의 CGNAT 항목
    (`isBlockedIPv4` 바로 위, `// 100.64.0.0/10 (CGNAT)` 주석 줄)
  - 상세: 이 리뷰 세션 안에서 `git diff origin/main -- <path>` 를 두 차례 실행했는데, 첫 번째 실행에는 없던 변경이 두 번째
    `git status --short`/`git diff` 확인 시점에 나타났다 — CGNAT 상한이 `ipToInt(100, 127, 255, 255)` 에서
    `ipToInt(100, 126, 255, 255)` 로 바뀌어 있었다(커밋되지 않은 워킹트리 변경, `git log` 어느 커밋에도 없음). 이 파일이
    가리키는 커밋(`bb4c5381b` HEAD)의 실제 diff·PR 산출물(CHANGELOG·plan·테스트)은 전부 `100.127.255.255` 상한을 전제로
    작성돼 있어, 이 변경은 이번 PR 이 만든 것이 아니라 **같은 워크트리를 동시에 쓰는 다른 병렬 리뷰어의 일시적 뮤테이션**
    (예: 경계값 뮤턴트 테스트)으로 보인다. CLAUDE.md 부작용 리뷰 규약이 "관측한 이상 상태는 그대로 보고하라" 고 명시하므로
    기록한다. 이 리뷰는 이 워킹트리 편차를 원인으로 지목하거나 조치하지 않았다 — `git checkout`/`restore` 를 쓰지 않았고
    저장소에 어떤 쓰기도 하지 않았다(`git status --short` 로 확인, 아래 참고).
  - 제안: 조치 불필요(이번 리뷰 대상 PR 의 부작용이 아님). 다른 리뷰어의 뮤테이션 테스트가 이 시점에 진행 중이었을 가능성이
    높으므로, 통합 조율자는 이 파일의 최종 커밋 상태(`git diff origin/main -- <path>` 를 리뷰 종료 후 재확인)만 신뢰할 것.

- **[INFO]** 에러 타입 좁힘(`Error` → `SsrfBlockedError`)이 diff 밖 4개 호출부와 호환됨 — 회귀 없음 (재확인)
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` `export class SsrfBlockedError extends Error`;
    소비 지점 `http-request.handler.ts`(`err instanceof Error` 일반 처리) · `http-redirect.ts`(`catch (err)`) ·
    `database-query.handler.ts`(bare `catch`) · `database-connection-tester.ts`(`err instanceof Error ? err.message : …`)
  - 상세: `SsrfBlockedError` 는 `Error` 서브클래스이고 메시지 포맷(`SSRF_BLOCKED: …`)도 그대로라, `instanceof Error` ·
    `err.message` 문자열 접두어 어느 쪽에 의존하는 호출부도 깨지지 않는다. `err.name === 'AbortError'` 류의 좁은 판별자와도
    충돌하지 않는다(`SsrfBlockedError.name = 'SsrfBlockedError'`). 4개 호출부를 `Read` 로 직접 열어 재확인했다.
  - 제안: 조치 불필요.

- **[INFO]** 공유 판정 함수(`isBlockedHostname`) 차단 범위 확장이 diff 밖 3개 소비자에 코드 수정 없이 자동 전파된다 — 의도된 결과
  - 위치: `isBlockedIPv6`/`mappedIPv4`/`canonicalIPv6`(`http-safety.ts`, `PRIVATE_V4_RANGES` 아래 새 헬퍼들) — 전파 대상:
    `http-request.handler.ts` · `database-query.handler.ts`(`assertSafeOutboundHostResolved` 호출) ·
    `database-connection-tester.ts`(동일)
  - 상세: 세 파일 모두 이번 diff 에 포함되지 않았지만 공유 판정 함수를 그대로 import 하므로 IPv4-mapped IPv6 차단 확장이
    자동 적용된다. `plan/in-progress/ssrf-guard-integration-unify.md` 가 "세 노드가 한 표를 공유" 하도록 명시적으로 설계한
    결과이며, spec(`4-integration.md` §5.5 등)이 이미 요구하던 동작이라 새로운 결함이 아니다. 다만 diff 에 나타나지 않는
    호출부가 동시에 동작 변경을 받는다는 사실은 side effect 관점에서 명시해 둔다.
  - 제안: 조치 불필요.

- **[INFO]** `isSmtpHostBlocked` 가 "판정이 아닌 오류는 재던진다" 새 실패 모드를 얻었으나 현재 코드로는 도달 불가능한 이론적 경로
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` — `isSmtpHostBlocked` 의
    `if (err instanceof SsrfBlockedError) return true; throw err;` 블록. 호출부:
    `integrations.service.ts` `testEmailTransport`(가드 호출이 `try` 진입 **전**) · `send-email.handler.ts` 발송 경로
  - 상세: 옛 구현(`common/utils/ssrf.util.ts` 기반)은 모든 경로가 boolean 만 반환해 사실상 절대 throw 하지 않았다. 새
    구현은 `assertSafeOutboundHostResolved` 의 catch 에서 `SsrfBlockedError` 가 아닌 오류를 명시적으로 rethrow 하는데,
    `assertSafeOutboundHostResolved` 자신은 DNS 조회 실패를 내부에서 흡수(fail-open)하고 그 외에는 `SsrfBlockedError` 만
    던지므로 정상 입력에서는 이 경로에 도달하지 않는다(신규 테스트도 `jest.doMock` 으로 인위 재현). `testEmailTransport` 의
    가드 호출이 넓은 `try` 밖에 있어, 만약 도달하면 `{success:false,...}` 구조화 응답 대신 처리되지 않은 예외로 전파되지만
    — 1·2라운드 RESOLUTION 이 이미 이 사실을 인지하고 스코프 밖(후속)으로 명시적으로 defer 했다.
  - 제안: 조치 불필요(이번 PR 스코프 밖, 이미 문서화된 defer).

- **[INFO]** 모듈 이동(`common/utils/smtp-host-guard` → `nodes/integration/send-email/smtp-host-guard`) — 옛 경로 참조 0건, 시그니처 불변
  - 위치: 저장소 전수 `grep -rn "common/utils/smtp-host-guard" codebase/` — 0건. `isSmtpHostBlocked(host: string): Promise<boolean>`
    시그니처는 이동 전후 동일.
  - 상세: import 4곳(`integrations.service.ts` · `integrations.service.spec.ts` · `send-email.handler.ts` ·
    `send-email.handler.spec.ts`)이 모두 새 경로로 갱신됐다. `ALLOW_PRIVATE_HOST_TARGETS` 읽기도 옛 구현은
    `smtp-host-guard.ts` 자체와 `ssrf.util.ts` 양쪽에서 중복 확인했으나, 새 구현은 `assertSafeOutboundHostResolved` 위임
    한곳으로 중앙화됐다(중복 읽기 제거, side effect 감소 방향).
  - 제안: 조치 불필요.

- **[INFO]** 환경 변수 · 네트워크 호출 — 신규 없음, 차단 대상은 실제 연결 시도 전에 걸러짐
  - 상세: `ALLOW_PRIVATE_HOST_TARGETS` 는 여전히 `http-safety.ts` `isPrivateHostsAllowed()` 단일 지점에서만 읽는다. `testEmailTransport`
    는 가드 호출이 `createTransport`/`transporter.verify()` 보다 먼저라, 차단 대상(CGNAT `100.64.0.1`, mapped 루프백 등)에
    실제 연결 시도가 발생하지 않는다(e2e B2 케이스로 확인). `dns.lookup` 호출 경로·횟수도 옛 `ssrf.util.resolvesToPrivate` 와
    동일하게 hostname 당 최대 1회 — 새 외부 I/O 는 없다.
  - 제안: 조치 불필요.

- **[INFO]** 파일시스템 부작용은 CLAUDE.md 워크플로가 요구하는 예상 산출물 범위 안
  - 위치: `plan/in-progress/ssrf-guard-integration-unify.md`(신규) · `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (트래커 항목 추가) · `review/code/2026/09/19/{21_38_32,22_00_32}/**`(1·2라운드 리뷰/RESOLUTION 산출물) ·
    `review/consistency/2026/09/19/21_02_09/**` · `scripts/backend-typecheck-baseline.json`(197→194, 자동 생성 ratchet)
  - 상세: 전부 `--impl-prep`/`/ai-review` 워크플로가 요구하는 정규 산출물이며, ratchet 숫자 감소는 `http-safety.spec.ts`
    mock 타입 수정으로 타입 오류 3건이 실제로 해소된 것과 일치한다(`baseline.json` 에서 해당 파일 항목 자체가 삭제됨).
    예상 밖의 파일 생성·삭제는 없다.
  - 제안: 조치 불필요.

## 리뷰 중 저장소 변경 여부

이 리뷰 세션은 저장소에 어떤 파일도 쓰지 않았다(`Read`/`Bash grep`/`git diff`/`git status` 만 사용). 위에 기록한 CGNAT 상한
편차는 **다른 프로세스**가 만든 것이며, 이 리뷰가 만들거나 복구를 시도한 것이 아니다. 리뷰 종료 시점 `git status --short`:
`M codebase/backend/src/nodes/integration/http-request/http-safety.ts`(다른 프로세스 소유, 미조치) ·
`?? review/code/2026/09/19/22_24_32/`(이번 리뷰 산출물, 예상됨).

## 요약

3라운드 누적 diff(CHANGELOG·`.env.example`·mdx 문서 갱신, 트래커 등재, 1·2라운드 RESOLUTION/SUMMARY 산출물 포함)를 직접
소스 대조로 재검증한 결과 부작용 관점에서 새로 발견된 CRITICAL/WARNING 은 없다. 에러 타입을 `Error` → `SsrfBlockedError`
로 좁힌 변경은 diff 밖 4개 호출부 전부와 호환되고, 공유 판정 함수의 차단 범위 확장은 3개 소비자에 자동 전파되지만 이는
spec 이 요구하고 plan 이 명시한 의도된 결과다. 모듈 이동은 잔존 참조 0건, `isSmtpHostBlocked` 시그니처 불변, 신규
env var·네트워크 호출·전역 변수·이벤트/콜백 변경 없음. 다만 리뷰 도중 이 워크트리의 `http-safety.ts` 가 **다른 프로세스에
의해** 커밋되지 않은 상태로 변경되는 것을 관측했다(CGNAT 상한 `100.127.255.255` → `100.126.255.255`, 어느 커밋에도 없음) —
이번 PR 의 부작용이 아니라 병렬 세션의 뮤테이션 테스트로 추정되므로 조치하지 않았고, 통합 조율자는 최종 병합 전 이 파일의
커밋 상태를 재확인해야 한다.

## 위험도

LOW
