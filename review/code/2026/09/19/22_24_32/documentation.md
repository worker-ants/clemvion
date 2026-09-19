# 문서화(Documentation) 리뷰 — SSRF 가드 통합 (3라운드, 수렴 확인)

## 배경

이번 라운드 diff 는 (1) 1·2라운드 리뷰가 지적한 문서화 WARNING 전량에 대한 조치 커밋(`fce34b77b`)과 (2) 그 이전 두 라운드의
`/ai-review`·`--impl-prep` 산출물이 저장소에 신규 파일로 커밋된 것으로 구성된다. 1라운드(`21_38_32`)·2라운드(`22_00_32`)
documentation 리포트가 지적한 항목을 전부 원본 대조로 재확인했고, 그 조치 자체가 새로 남긴 문서 결함 1건을 추가로 찾았다.

## 이전 라운드 WARNING 재확인 (전부 해소 확인)

- **CHANGELOG.md 누락(1라운드 WARNING)** — 해소 확인. `## Unreleased — HTTP · DB 노드가 IPv4-mapped IPv6 로 루프백 ·
  메타데이터에 닿았고, Send Email 은 CGNAT 를 막지 않았다` 항목이 선례(`0a040b96c`·`19d9dedca`)와 같은 형식으로 추가됐고,
  뚫려 있던 것 · 고친 것 · 배포 뒤 영향 · opt-out(`ALLOW_PRIVATE_HOST_TARGETS=true`) · LLM/S3 비대상까지 전부 담겼다.
- **`.env.example` 헤더가 Send Email 을 빠뜨림(1라운드 WARNING)** — 해소 확인. 헤더가 "HTTP Request, DB Query and Send
  Email (SMTP) nodes and their connection tests" 로 세 노드를 나열하고 `nodes/integration/send-email/smtp-host-guard.ts`
  경로와 IPv4-mapped 판정 방식까지 병기해 본문과 정합한다.
- **JSDoc 문단이 원래 이어지던 두 영어 문장 사이에 끼어듦(2라운드 WARNING)** — 해소 확인. 현재 `http-safety.ts` 모듈
  JSDoc 은 "Blocks URLs… Intended for Integration-backed requests…" 가 끊기지 않고 이어지고, 폴더 위치 설명 한국어
  문단은 "Self-hosted opt-in" 문단 뒤·`import` 문 앞으로 옮겨져 별도 문단으로 분리됐다.
- **"트래커에 따로 있다" 는 현재형 단언이 실제로는 미등재였던 문제(2라운드 WARNING)** — 해소 확인.
  `grep -n "http-safety" plan/in-progress/spec-draft-nullable-notation-followups.md` 로 직접 확인 — "공용 SSRF 가드
  `http-safety.ts` 를 `http-request/` 밖 중립 위치로" 항목이 실제로 등재돼 있다(4898행). JSDoc 의 인용도 참이 됐다.
- **유저 가이드가 Email(SMTP) 을 차단 대상 목록에서 빠뜨림(2라운드 WARNING, user_guide_sync)** — 해소 확인.
  `integration-management.mdx`/`.en.mdx` 모두 "Database, HTTP and Email (SMTP) connections … CGNAT" 로 갱신되고,
  "워크플로에서 그 연동을 쓰는 노드도 같은 규칙으로 막힌다" 문장도 추가됐다.
- **정규화 폴백(zone id) 분기 미실행(2라운드 WARNING, `SsrfBlockedError` 전용 아니지만 같은 조치 커밋)** —
  `http-safety.spec.ts` 에 `fe80::1%eth0` · `[fe80::1%25en0]` 를 차단으로 고정하는 `it.each` 가 실제로 추가됐다(확인).

## 새 발견사항

- **[WARNING]** 새로 등재된 트래커 항목이 아직 존재하지 않는 `plan/complete/ssrf-guard-integration-unify.md` 를
  현재형으로 인용한다 — 같은 클래스의 결함이 이 PR 에서 세 번째로 발생
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4892
    (`2026-09-19 등재 · \`plan/complete/ssrf-guard-integration-unify.md\` «비대상»).`)
  - 상세: 이번 diff 가 새로 추가한 트래커 항목("LLM 프로바이더 · S3 의 SSRF 가드가 CGNAT · `::` 를 막지 않는다")은
    근거 문서로 `plan/complete/ssrf-guard-integration-unify.md` 를 인용한다. 그런데 그 plan 은 실제로는
    `plan/in-progress/ssrf-guard-integration-unify.md` 에 있고(`ls plan/complete/ssrf-guard-integration-unify.md` →
    No such file or directory), 그 plan 자신의 체크리스트(파일 17 diff, 게이트 73~75)도 `/ai-review` 수렴 ·
    `--impl-done` · "트래커 두 항목 해소 + `ssrf.util` 항목 등재 · 이 plan `plan/complete/` 로" 를 전부 `[ ]`
    (미완료)로 남겨 두고 있다 — 즉 이 plan 을 `plan/complete/` 로 옮기는 일은 아직 일어나지 않았고, 그 일이
    일어나는 시점(plan 자신이 예고하는 "마무리 커밋")은 지금이 아니다. 이 저장소는 `plan/complete/<name>.md`
    인용을 "이미 종결된 근거 문서"라는 뜻으로 광범위하게 쓰는 관례가 있고(같은 파일에 이미 수십 건의
    선례), 그 관례를 따르는 독자가 이 인용을 그대로 열어 보면 존재하지 않는 경로를 만난다. 정확히 같은
    클래스의 결함(현재형으로 아직-참이-아닌 상태를 서술)이 1라운드·2라운드 documentation 리뷰에서 각각 한 번씩
    이미 지적됐고(`http-safety.ts` JSDoc 의 "트래커에 따로 있다"), 이번엔 그 조치 자체가 만든 새 항목에서
    같은 패턴이 세 번째로 재발했다.
  - 제안: 이 plan 이 실제로 `plan/complete/` 로 옮겨지기 전까지는 `plan/in-progress/ssrf-guard-integration-unify.md`
    로 인용하거나(정확한 현재 경로), "마무리 커밋에서 `plan/complete/`로 이관 예정"처럼 예정형으로 적는다.
    이 plan 을 닫는 마무리 커밋에서 실제로 이관하면서 이 인용도 함께 `plan/complete/` 로 정정하는 것이 가장
    낮은 비용이다(그 커밋이 어차피 "트래커 두 항목 해소"를 하므로 같은 손길로 가능).

## 점검했으나 문제 없음

- `common/utils/smtp-host-guard.{ts,spec.ts}` → `nodes/integration/send-email/smtp-host-guard.{ts,spec.ts}` 이동 후
  옛 경로 참조 잔존 없음(`grep` 0건, import 4곳 모두 새 경로).
- `SMTP_BLOCK_PRIVATE_HOSTS` phantom 식별자 — 현재 코드·문서 어디에도 살아있는 참조가 없음(리뷰/plan 히스토리
  기록에만 남아 있고, 이는 의도된 이력 보존).
- `isSmtpHostBlocked`/`SsrfBlockedError`/`canonicalIPv6`/`mappedIPv4` JSDoc — 실측 근거(macOS · `node:24-alpine`,
  `EHOSTUNREACH`/`ENETUNREACH`)와 판정 규칙을 구체적으로 남겨 코드와 정확히 일치.
- `integrations.service.ts`(`testEmailTransport`) · `send-email.handler.ts` 의 주석 정정("SMTP_BLOCK_PRIVATE_HOSTS
  opt-in" → "ALLOW_PRIVATE_HOST_TARGETS=true 아니면 차단하는 opt-out")이 실제 구현(`isPrivateHostsAllowed`)과 일치.
- `EMAIL_HOST_BLOCKED` 의 `ERROR_KO` 라벨 미매핑(2라운드 INFO)은 이 PR 이전부터 있던 별개 트래커 항목("`ERROR_KO`
  매핑을 아무도 읽지 않는다")으로 이미 처분돼 있어 재지적하지 않는다.

## 뮤테이션 검증

리뷰 중 저장소 파일을 수정하지 않았다 — `Read`/`Bash(grep, ls, sed -n, git status --short)` 만 사용했다.
마지막 확인 시점 `git status --short` 결과는 `?? review/code/2026/09/19/22_24_32/`(이 세션의 출력 디렉터리) 뿐이다.

## 요약

1라운드·2라운드 documentation 리뷰가 지적한 6건(CHANGELOG 누락, `.env.example` 헤더, JSDoc 문단 순서, JSDoc 의
트래커 미등재 단언, 유저 가이드 Email 누락, 정규화 폴백 회귀 테스트)은 전부 이번 조치 커밋(`fce34b77b`)에서
정확하게 해소됐음을 원본 대조로 확인했다. 다만 같은 커밋이 새로 추가한 트래커 항목 하나가 아직 `plan/complete/`
로 옮겨지지 않은 plan 을 `plan/complete/…` 경로로 현재형 인용해, 같은 PR 에서 이미 두 번 지적된 "아직 참이 아닌
상태를 현재형으로 서술" 패턴이 세 번째로 재발했다(WARNING). 병합을 막을 사유는 아니며, 이 plan 을 닫는 마무리
커밋에서 함께 정정하면 된다.

## 위험도

LOW
