# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `isSmtpHostBlocked` 의 구현 모듈 경로가 이동했다 (인터페이스 위치 변경)
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` (신규, `common/utils/smtp-host-guard.ts` 삭제)
  - 상세: `common/utils/smtp-host-guard.ts` 를 삭제하고 `nodes/integration/send-email/smtp-host-guard.ts` 로 옮겼다(plan 상 의도적 — `common → nodes` 역방향 import 회피). `isSmtpHostBlocked(host: string): Promise<boolean>` 시그니처 자체는 그대로다. 저장소 전수 grep(`grep -rn "common/utils/smtp-host-guard" codebase/`)으로 옛 경로를 참조하는 곳이 0건임을 확인했고, 새 경로를 쓰는 임포터는 `integrations.service.ts:13`, `integrations.service.spec.ts:27`, `send-email.handler.ts:24`, `send-email.handler.spec.ts:4` 넷뿐이며 전부 이번 diff 에서 동반 갱신됐다. jest 설정(`jest.config.ts`)에도 옛 경로 하드코딩이 없다. 실제 파괴적 영향은 없고, 이 리뷰가 소집된 시점 기준으로는 완결된 이동이다.
  - 제안: 조치 불필요. 향후 이 모듈을 다시 옮길 때도 같은 grep 전수 확인을 반복할 것.

- **[INFO]** `isBlockedHostname` (공개 함수, `http-safety.ts`)의 판정 범위가 넓어짐 — 기존 호출자 관점의 동작 변화
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 의 `isBlockedIPv6` 함수 (canonicalIPv6/mappedIPv4 도입)
  - 상세: IPv4-mapped IPv6 표기(`::ffff:127.0.0.1` 등 3가지 모양)가 이제 품고 있는 IPv4 주소의 대역으로 재판정되어 추가로 차단된다. `isBlockedHostname` 은 HTTP Request 노드 · DB Query 노드 · 그 연결 테스트가 공유하는 공개 함수라, 이 변경으로 그 세 소비자 모두의 차단 범위가 동시에 넓어진다(대상 공인 IP 를 품은 mapped 주소는 여전히 통과 — 테스트로 확인됨). 의도된 보안 수정이며 plan/consistency 리뷰에서 이미 실측·승인된 변경이라 결함으로 보지 않지만, "공개 인터페이스의 동작 변경이 기존 사용자에게 미치는 영향" 관점에서는 세 소비자 모두가 이 변경에 자동으로 연동된다는 점을 명시해 둔다.
  - 제안: 조치 불필요(의도된 fail-closed 강화). 배포 노트/릴리스 메모에 "IPv4-mapped IPv6 리터럴을 사설 대상에 사용하던 기존 통합"이 있다면 이제 차단됨을 남기면 좋다.

- **[INFO]** SMTP 연결 테스트 경로의 DNS lookup 네트워크 호출은 신규가 아님 — 대체된 구현으로 동일하게 유지
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` (`assertSafeOutboundHostResolved` 호출), 비교 대상 `codebase/backend/src/common/utils/ssrf.util.ts` 의 `resolvesToPrivate`
  - 상세: 옛 구현(`ssrf.util.ts`)도 hostname 이 IP 리터럴이 아니면 `dns.lookup(hostname, { all: true })` 를 호출했다. 새 구현(`http-safety.ts` 의 `assertSafeOutboundHostResolved`)도 동일하게 리터럴 fast-path 이후 `lookup(hostname, { all: true })` 를 호출한다. 즉 `IntegrationsService.testEmailTransport` · `SendEmailHandler` 양쪽에서 "SSRF 가드가 새로 DNS 조회라는 외부 I/O 를 추가했다"는 우려는 반증됨 — 기존에도 있던 네트워크 side effect가 구현체만 바뀐 것이다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/ssrf-guard-integration-unify.md` 및 `review/consistency/2026/09/19/21_02_09/**` 신규 파일 — 예상된 harness 산출물
  - 위치: `plan/in-progress/ssrf-guard-integration-unify.md`, `review/consistency/2026/09/19/21_02_09/*`, `scripts/backend-typecheck-baseline.json`
  - 상세: 이 diff 에 포함된 파일시스템 변경(플랜 문서 신설, consistency-check 산출물 신설, 타입체크 ratchet baseline 197→194 갱신)은 모두 CLAUDE.md 워크플로가 요구하는 정규 산출물이며, 코드 변경(`http-safety.spec.ts` mock 타입 수정)이 실제로 타입 오류 3건을 해소했다는 근거와 일치한다. 예상치 못한 파일시스템 부작용이 아니다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 SMTP SSRF 가드를 `http-safety.ts` 공용 구현으로 통합하고, IPv4-mapped IPv6 우회를 막는 정규화 로직을 추가한 보안 강화 PR이다. 부작용 관점에서 검토한 결과: (1) `isSmtpHostBlocked` 구현 파일 이동은 4개 호출자 전부가 동반 갱신됐고 옛 경로 참조가 저장소 전체에 0건임을 grep 으로 직접 확인했다 — 끊어진 임포트나 잔존 참조 없음. (2) `isBlockedHostname` 의 차단 범위 확장은 HTTP/DB/DB-연결테스트 세 소비자에 동시 적용되는 공개 인터페이스 동작 변경이지만, 의도된 fail-closed 보안 수정이며 spec·plan·consistency-check 로 사전 승인된 범위다. (3) SMTP 경로의 DNS lookup 네트워크 호출은 신규가 아니라 기존에도 있던 것이 구현체만 교체됐다 — 새로운 외부 I/O 도입은 없다. (4) 전역 변수 신설, 환경변수 신규 사용, 이벤트/콜백 변경은 없다. 신규 파일(plan/consistency 산출물, ratchet baseline)은 워크플로 규약에 맞는 예상된 산출물이다. 리뷰 과정에서 저장소에 어떤 쓰기도 하지 않았으며(`git status --short` 로 확인 — 세션 시작 시점과 동일), 뮤테이션 원복이 필요한 상황도 없었다.

## 위험도

LOW
