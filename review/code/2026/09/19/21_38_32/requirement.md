# 요구사항(Requirement) 충족 리뷰 — 통합 노드 SSRF 가드 단일화 (SMTP CGNAT / IPv4-mapped IPv6)

## 발견사항

- **[INFO]** DNS 조회 실패 시 fail-open 정책이 SMTP 가드 신규 파일에도 그대로 이어지나, 이 invariant 는 어느 spec Rationale 에도 명문화돼 있지 않다 (기존 상태 그대로 이월된 것이며 이번 diff 가 새로 만든 문제는 아님).
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` (파일 10, 게이트 14)
  - 상세: `assertSafeOutboundHostResolved` 가 DNS 조회 실패 시 통과시키는 기존 동작을 SMTP 경로에도 이식했다. 동작 자체는 HTTP/DB 가드와 대칭이라 정합하지만, spec 문언에 "DNS 해석 실패 시 차단하지 않는다" 는 문장이 없다 — 같은 시점의 `consistency-check`(파일 20 `rationale_continuity.md`, INFO #4)도 동일 사항을 이미 별도로 지적해 트래커/문서 보강을 권고했다.
  - 제안: 코드 수정 불필요. spec Rationale 보강은 별도 `project-planner` 턴 사안(이미 consistency 리포트에 등재됨). 중복 보고 방지를 위해 CRITICAL/WARNING 격상 안 함.

## 상세 검증 (문제 없음으로 확인된 항목)

- **spec fidelity — 정확히 일치**: `spec/2-navigation/4-integration.md` §5.5(523행)·Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일"(1226~1228행), `spec/4-nodes/4-integration/3-send-email.md` §4 step7(97행), `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 콜아웃(106행), `spec/4-nodes/4-integration/1-http-request.md` §4 step8/§8.2/§8.3 을 모두 직접 열어 대조했다. 세 노드가 "동일 메커니즘·플래그" 를 쓴다는 spec 문언은 이번 변경 이전부터 존재했고(`spec_impact: none` 이 맞다), 종전 코드(`common/utils/ssrf.util` 기반 SMTP 가드)가 CGNAT·`::`(unspecified) 를 통과시켜 spec 과 실제로 어긋나 있었다. 이번 diff 는 spec 문언 쪽이 항상 옳았고 **코드가 틀려 있던 사례** — SPEC-DRIFT 가 아니라 정상적인 버그 수정이다.
- **IPv4-mapped IPv6 정규화 로직 검증**: `canonicalIPv6`/`mappedIPv4`(`http-safety.ts` 게이트 79~99) 를 Node REPL 로 직접 실측 — `::ffff:127.0.0.1`, `::ffff:10.0.0.5`, `::ffff:6440:1`(→100.64.0.1), `::ffff:0.0.0.0`, 대문자·전체형·괄호 없는 형이 모두 diff 가 명시한 정규화 형(`::ffff:7f00:1` 등)으로 수렴함을 확인했고, zone-id(`fe80::1%eth0`) 처럼 `URL` 파서가 거부하는 입력은 원문 그대로 fallback 되는 것도 확인했다. 정규식 `^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$` 는 RFC4291 IPv4-mapped 압축형과 정확히 일치하며 오탐/누락 케이스를 찾지 못했다.
- **회귀 없음 확인**: `codebase/backend` 에서 `common/utils/smtp-host-guard` 를 참조하는 잔여 import 가 없음을 grep 으로 확인(파일 이동이 깨끗하게 완료됨). `ssrf.util` 은 의도된 비대상(LLM/S3)에만 남아 있음을 확인.
- **테스트 실행**: 리뷰 중 리포지토리를 변경하지 않고 `npx jest http-safety.spec.ts smtp-host-guard.spec.ts send-email.handler.spec.ts integrations.service.spec.ts` 를 실행 — 4 suites / 218 tests 전부 GREEN. plan 문서(`plan/in-progress/ssrf-guard-integration-unify.md`)가 주장하는 RED→GREEN 전환·뮤턴트 검증 결과와 모순되는 점 없음.
- **에러 시나리오 / 반환값**: `isSmtpHostBlocked` 는 SSRF 판정(`SSRF_BLOCKED:` prefix)만 `true` 로 삼키고 그 외 예외는 재던진다 — 신규 테스트("SSRF 판정이 아닌 오류는 «막힘» 으로 바꾸지 않고 그대로 던진다")가 이 경계를 정확히 커버한다. 빈 host(`''`, `undefined`)는 `false` 반환 — 기존 동작과 동일하게 유지.
- **엣지 케이스**: CGNAT 경계값(`100.64.0.0`/`100.127.255.255`)과 바로 바깥 값(`100.63.255.255`/`100.128.0.0`)을 대조군으로 테스트했고, 공인 IPv4 를 품은 mapped 주소(`::ffff:8.8.8.8`)가 오탐으로 막히지 않는지도 확인됐다 — 실측(README 상 macOS·node:24-alpine)까지 결합된 근거라 신뢰도가 높다.
- **TODO/FIXME**: 신규/변경 파일 전체에서 미완성을 시사하는 TODO/FIXME/HACK/XXX 주석 없음.
- **의도-구현 일치**: 주석 정정("SMTP_BLOCK_PRIVATE_HOSTS opt-in" → "ALLOW_PRIVATE_HOST_TARGETS=true 아니면 차단하는 opt-out")이 실제 구현(`isPrivateHostsAllowed` 로직, 기본 차단)과 정확히 일치.
- **e2e**: `integration-connection-test.e2e-spec.ts` B2 케이스가 HTTP(`[::ffff:127.0.0.1]`)·DB(`::ffff:127.0.0.1`)·Email(`100.64.0.1`) 세 경로 모두 각 서비스 전용 차단 코드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)와 host/IP 미노출 메시지를 단언 — spec 의 각 코드 표(§5.3/§5.4/§5.5, `4-integration.md` 1110/1114/1119행)와 필드까지 일치.

## 요약

`common/utils/ssrf.util` 기반이던 SMTP SSRF 가드를 HTTP Request/DB Query 가 이미 쓰던 `http-safety.ts` 로 통합하고, 그 판정 로직 자체에 IPv4-mapped IPv6(`::ffff:a.b.c.d`) 정규화를 추가해 표기만 바꾼 루프백/메타데이터/CGNAT 우회를 막은 변경이다. spec(`4-integration.md` §5.5, `3-send-email.md`/`1-http-request.md`/`2-database-query.md` §4)은 이미 "세 노드가 동일 메커니즘·플래그를 쓴다" 고 명시하고 있었고, 실측(원문 실행 결과 표까지 plan 문서에 기록)으로 종전 구현이 그 spec 약속에 미달했음을 증명한 뒤 코드를 spec 에 맞춘 것으로, 방향이 명확한 정상적 버그 수정이다. IPv4-mapped 정규화 로직을 직접 재현·검증했고, import 경로 이전에 잔여 참조가 없음을 확인했으며, 관련 unit/e2e 테스트를 리포지토리 변경 없이 재실행해 전부 GREEN 임을 확인했다. 유일한 지적 사항(DNS fail-open 이 spec Rationale 에 미문서화)은 이번 변경이 새로 만든 문제가 아니라 기존부터 있던 gap이고, 이미 동시에 수행된 consistency-check 가 INFO 로 별도 등재해 문서화 예정이므로 이 리뷰에서는 추가 조치가 필요한 CRITICAL/WARNING 이 없다.

## 위험도

NONE
