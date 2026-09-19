# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** SSRF 가드 통합(보안 관련 동작 변경)인데 `CHANGELOG.md` 항목이 없다
  - 위치: `CHANGELOG.md` (루트) — 이번 브랜치(`origin/main..HEAD`, 커밋 `a14fb8f8f`·`6a7d70ce8`·`1e07cf5cf`·`103906807`)의 diff 에 `CHANGELOG.md` 변경이 전혀 없음(`git diff --stat origin/main -- CHANGELOG.md` 결과 없음).
  - 상세: 이 저장소는 `CHANGELOG.md` 를 "## Unreleased — <제목>" 형식으로 PR 단위 능동 관리한다. 바로 직전 두 커밋이 정확히 같은 클래스(통합 노드 SSRF/연결 검증 동작 변경)를 다뤘고 둘 다 CHANGELOG 항목을 추가했다 — `0a040b96c`("Database·HTTP 연결 테스트가 실제로 접속한다 — 틀린 비밀번호·토큰도 «Connection successful» 이던 것")와 `19d9dedca`("지우거나 바꾼 웹훅 경로를…"). 이번 PR 은 그보다 실질 위험이 크다 — HTTP/DB 는 IPv4-mapped IPv6 표기(`[::ffff:127.0.0.1]` 등)로 루프백·클라우드 메타데이터에 **실제로 닿았고**(macOS·`node:24-alpine` 실측, 200 응답), SMTP 는 CGNAT(`100.64.0.0/10`)를 통과시켰다 — 즉 기존에 뚫려 있던 SSRF 우회를 막는 보안 수정이다. 배포 환경(특히 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 내부 SMTP relay/CGNAT 대역을 의도적으로 쓰던 self-host 배포)에 동작 변화가 생길 수 있어, 운영자가 릴리스 노트에서 놓치면 안 되는 종류의 변경이다.
  - 제안: 두 선례와 같은 형식으로 "## Unreleased — …" 항목을 추가한다. 무엇이 뚫려 있었는지(IPv4-mapped IPv6 → 실제 루프백/메타데이터 도달, SMTP CGNAT 통과), 무엇을 고쳤는지(`http-safety.ts` 단일 판정기로 통합), 배포 후 영향(CGNAT 대역을 쓰던 self-host SMTP relay 는 이제 기본 차단되며 `ALLOW_PRIVATE_HOST_TARGETS=true` 로만 우회 가능)을 명시하면 두 선례와 형식이 맞는다.

- **[WARNING]** `.env.example` 의 `ALLOW_PRIVATE_HOST_TARGETS` 헤더 주석이 "적용 대상" 목록에서 Send Email 을 빠뜨려, 이번 통합 이후 더 오도하게 됐다
  - 위치: `codebase/backend/.env.example` (라인 367-369 — grep 결과 기준, 파일 내 실제 줄 번호)
    ```
    # Integration network safety (SSRF guard)
    # Applies to outbound calls made by the HTTP Request and DB Query nodes
    # (see codebase/backend/src/nodes/integration/http-request/http-safety.ts).
    ```
  - 상세: 이 헤더는 "HTTP Request and DB Query nodes" 만 `http-safety.ts` 를 쓴다고 적는다. 바로 아래 본문(372번째 줄 부근)은 "integration-backed nodes (HTTP Request / Database Query / Send Email SMTP)" 라고 Send Email 을 포함해 적어 헤더와 본문이 이미 서로 다른 범위를 가리킨다. 이번 PR(`plan/in-progress/ssrf-guard-integration-unify.md` 항목 2)이 정확히 SMTP 가드를 `http-safety.ts` 판정 로직으로 흡수하는 작업이라, 이제는 헤더가 가리키는 "see .../http-safety.ts" 파일을 Send Email(`nodes/integration/send-email/smtp-host-guard.ts` 경유)도 실제로 쓴다 — 헤더만 읽는 사람은 이 사실을 놓친다. 같은 plan 항목 3이 `integrations.service.ts`/`send-email.handler.ts` 의 stale 주석은 정정했지만 이 파일은 범위 밖으로 남았다.
  - 제안: 헤더를 "Applies to outbound calls made by the HTTP Request, DB Query, and Send Email (SMTP) nodes" 로 넓히고, 참조 파일에 `nodes/integration/send-email/smtp-host-guard.ts` 도 함께 적어 본문과 정합시킨다. 차단 사유는 아니다.

- **[INFO]** `isSmtpHostBlocked` 의 JSDoc 이 빈 host 입력의 fail-open 을 언급하지 않는다
  - 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` — `export async function isSmtpHostBlocked` 위 JSDoc 블록
  - 상세: 구현은 `if (!trimmed) return false;` 로 빈/공백 host 를 무조건 통과시키고, 테스트(`smtp-host-guard.spec.ts` "returns false for empty host")도 이를 검증한다. 그런데 JSDoc 은 DNS 해석 실패의 fail-open 은 설명하면서 빈 문자열 입력의 fail-open 은 언급하지 않는다 — 보안 판정 함수라 이 edge case 도 계약의 일부로 문서화해 두면 향후 호출부 추가 시 "빈 host 를 왜 막지 않았지" 라는 재조사를 줄인다.
  - 제안: JSDoc 에 "빈/공백 host 는 판정 대상이 아니므로 통과시킨다(호출부가 필수 필드 검증을 이미 마쳤다고 가정)" 한 줄 추가 권장. 필수 아님.

## 점검했으나 문제 없음 (양성 확인)

- 파일 이동(`common/utils/smtp-host-guard.{ts,spec.ts}` → `nodes/integration/send-email/smtp-host-guard.{ts,spec.ts}`) 이후 옛 경로(`common/utils/smtp-host-guard`) 참조가 코드·spec 어디에도 남지 않음(`grep` 0건) — import 4곳(`integrations.service.ts`, `integrations.service.spec.ts`, `send-email.handler.ts`, `send-email.handler.spec.ts`) 모두 새 경로로 갱신됨.
- `nodes/core/error-codes.ts` 의 "SoT 는 `http-safety.ts`(HTTP/DB/Email 공용)" 주석 — 이번 변경 전에는 거짓이었으나(SMTP 가 별도 `ssrf.util` 사용) 이번 통합으로 이제 실제로 참이 됨. 코드 정정 불필요, 확인만.
- `integrations.service.ts`(`testEmailTransport`)·`send-email.handler.ts` 의 주석이 옛 phantom 식별자 `SMTP_BLOCK_PRIVATE_HOSTS`(존재한 적 없는 opt-in 플래그)에서 실제 동작(`ALLOW_PRIVATE_HOST_TARGETS=true` opt-out, 기본 ON)으로 정정됨 — 새 문구가 실제 동작·CGNAT 포함 여부와 정확히 일치.
- `http-safety.ts`/`smtp-host-guard.ts`(신규 파일) 의 모듈·함수 JSDoc — `canonicalIPv6`/`mappedIPv4`/`isSmtpHostBlocked` 모두 "무엇을·왜"(실측 근거 macOS·`node:24-alpine`, 대안 표기가 안 닿은 근거 `EHOSTUNREACH`/`ENETUNREACH`)를 구체적으로 남겨 향후 재검토 비용을 낮춘다. spec 문서(§5.5, §4) 앵커도 실제로 존재함을 확인.
- `http-safety.spec.ts` 의 새 mock 오버로드 우회 주석("`jest.mocked(lookup)` 은 단일 주소 오버로드로 잡혀 배열을 거부한다")이 실제 타입체크 ratchet 결과(3→4→0, baseline 197→194)와 일치.
- `plan/in-progress/ssrf-guard-integration-unify.md` 자체가 실측표·근거·비대상 사유를 상세히 기록해 이번 변경의 배경 문서화 역할을 충분히 수행함.

## 요약

핵심 구현 파일(`http-safety.ts`, `smtp-host-guard.ts`)의 JSDoc 은 실측 근거·spec 앵커까지 갖춰 이례적으로 충실하고, 옛 phantom 식별자(`SMTP_BLOCK_PRIVATE_HOSTS`) 주석 정정도 정확하며 파일 이동에 따른 stale import 도 없다. 다만 이번 변경이 "SSRF 우회를 실제로 막는" 보안 관련 동작 변경임에도 직전 두 유사 커밋과 달리 `CHANGELOG.md` 항목이 빠져 있고(WARNING), `.env.example` 의 `ALLOW_PRIVATE_HOST_TARGETS` 헤더 주석이 Send Email 을 적용 대상에서 빠뜨려 이번 통합으로 오히려 더 오도하게 됐다(WARNING). 둘 다 병합을 막을 사유는 아니지만 릴리스 문서화 관례상 보완을 권한다.

## 위험도

LOW
