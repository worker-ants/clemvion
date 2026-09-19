# 문서화(Documentation) 코드 리뷰 — SSRF 가드 통합 (2라운드)

## 배경

이번 라운드 diff 는 1라운드 리뷰(`review/code/2026/09/19/21_38_32/`)가 지적한 문서화 WARNING 2건
(CHANGELOG 누락, `.env.example` 헤더가 Send Email 을 빠뜨림)에 대한 조치 커밋(`a1e1a591b`)을 포함한다.
두 조치를 원본 대조로 확인했고, 그 조치 커밋 자체가 새로 만든 JSDoc 결함 2건을 추가로 찾았다.

## 뮤테이션 관찰

리뷰 중 `git status --short` 를 두 번 실행했는데, 첫 실행에서 `M codebase/backend/src/nodes/integration/http-request/http-safety.ts`
가 잠깐 나타났다가(`git diff`·`git diff --raw` 는 둘 다 빈 출력) 곧이은 재확인에서는 "working tree clean" 으로
사라졌다. 이 세션은 그 파일을 `Read` 만 했고 어떤 쓰기·`cp`·에디터 도구도 쓰지 않았다 — 동시에 같은 워크트리를
읽고 있는 다른 reviewer 가 순간적으로 뮤테이션했다가 스스로 원복한 것으로 보인다(병렬 fan-out 문서가 경고한
바로 그 패턴). 최종 확인 시점 기준 저장소는 이 세션의 출력 디렉터리(`review/code/2026/09/19/22_00_32/`) 외에
변경이 없다(`git status --short` 마지막 결과: `?? review/code/2026/09/19/22_00_32/` 뿐). 이 세션이 만든 잔여물은
없지만, 관측한 이상 상태이므로 기록해 둔다.

## 발견사항

- **[WARNING]** 모듈 JSDoc 에 삽입한 새 문단이 원래 이어져 있던 두 영어 문장 사이를 갈라놓아, "Intended for
  Integration-backed requests…" 문장이 마치 그 앞의 한국어 "폴더 위치" 문단에 이어지는 것처럼 읽힌다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 모듈 최상단 JSDoc (게이트 11~15)
  - 상세: 변경 전 원문은 "Blocks URLs that resolve to … CGNAT, or unique-local IPv6 ranges. Intended for
    Integration-backed requests where a workflow author should not be able to pivot to internal
    infrastructure…" 로, 가드의 차단 범위와 목적을 설명하는 한 흐름의 두 문장이었다. 이번 조치가 그 사이에
    "IPv4-mapped IPv6 판정" 한 문장과, 이어서 "공용인데 `http-request/` 폴더에 있는 이유: …" 로 시작하는
    한국어 근거 문단을 통째로 끼워 넣었는데, 그 한국어 문단이 끝나는 자리(`…트래커에 따로 있다(…).`) 바로
    뒤에 문단 구분(빈 줄) 없이 `Intended for Integration-backed requests…` 가 곧바로 붙는다(게이트 13→14).
    실제 diff 확인 결과 지금 파일에도 그대로 남아 있다 — 읽는 사람은 "Intended for Integration-backed
    requests…" 가 폴더 위치 근거 설명의 연장인 것으로 오독하기 쉽고, 원래 그 문장이 딸려 있던 "Blocks
    URLs…" 문장과의 연결은 시각적으로 끊긴다.
  - 제안: 한국어 "폴더 위치" 문단을 JSDoc 맨 끝(또는 별도 `@remarks` 성격의 마지막 문단)으로 옮기고,
    "Blocks URLs… IPv4-mapped IPv6 is judged by the IPv4 it carries." 바로 뒤에 "Intended for
    Integration-backed requests…" 를 다시 붙여 원래의 문장 흐름을 복원한다.

- **[WARNING]** 같은 문단이 "중립 위치로 옮기는 것은 … 트래커에 따로 있다" 고 현재형으로 단언하지만,
  실제로 그 항목은 아직 트래커에 없다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` 모듈 JSDoc (게이트 11~13,
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 참조)
  - 상세: `grep -n "http-safety" plan/in-progress/spec-draft-nullable-notation-followups.md` 로 트래커
    파일을 직접 확인했다 — `smtp-host-guard.ts`/`ssrf.util.ts` 구현 이원화 항목(게이트 4778 부근)은 있지만,
    "`http-safety.ts` 를 `http-request/` 밖 중립 위치로 옮겨야 한다" 는 항목은 존재하지 않는다(0건).
    같은 세션의 `plan/in-progress/ssrf-guard-integration-unify.md` 체크리스트도 마지막 항목("트래커 두
    항목 해소 + `ssrf.util` 항목 등재 · 이 plan `plan/complete/` 로")을 아직 `[ ]`(미완료)로 남겨 두어,
    등재가 "이번 조치 커밋 시점"이 아니라 "마무리 커밋" 때 일어날 예정임을 스스로 밝히고 있다(`RESOLUTION.md`
    W2 행: "트래커 등재(마무리 커밋)"). 즉 JSDoc 은 지금 시점에는 참이 아닌 사실을 현재형으로 적어 뒀다 —
    지금 이 링크를 따라간 사람은 해당 항목을 찾지 못한다.
  - 제안: 마무리 커밋에서 트래커 항목을 실제로 추가할 때까지는 JSDoc 문구를 "…트래커에 등재할 예정이다"
    처럼 예정형으로 두거나, 이 plan 을 닫는 커밋에 트래커 항목 추가를 반드시 포함시켜 JSDoc 의 현재형
    서술과 실제 상태를 맞춘다(이 plan 체크리스트 마지막 항목이 그 커밋을 이미 예고하고 있으므로, 실행만
    빠뜨리지 않으면 된다).

## 점검했으나 문제 없음 (1라운드 WARNING 조치 확인)

- **CHANGELOG.md** — 1라운드 WARNING(#5/#7, 보안 관련 동작 변경인데 CHANGELOG 항목 없음)이 정확히
  선례 형식(`## Unreleased — <제목>`)으로 해소됐다. 무엇이 뚫려 있었는지(IPv4-mapped IPv6 실제 도달 실측,
  SMTP CGNAT 통과) · 무엇을 고쳤는지(세 노드 단일 가드, mapped 판정 규칙) · 배포 뒤 영향(`ALLOW_PRIVATE_HOST_TARGETS=true`
  opt-out, LLM/S3 는 비대상)을 모두 담아 다른 두 선례 항목과 형식·정보량이 일치한다.
- **`.env.example` 헤더** — 1라운드 WARNING(#6, Send Email 누락으로 본문과 불일치)이 해소됐다. 헤더가
  이제 "HTTP Request, DB Query and Send Email (SMTP) nodes and their connection tests" 로 세 노드를
  모두 나열하고, SMTP 쪽 실제 구현 경로(`nodes/integration/send-email/smtp-host-guard.ts`)와 IPv4-mapped
  IPv6 판정 방식까지 병기해 본문과 헤더가 정합한다.
- **`isSmtpHostBlocked` JSDoc 의 빈 host 설명** — 1라운드 INFO(빈 host fail-open 이 JSDoc 에 없음)가
  새 파일(`codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts`)의 JSDoc 마지막
  문단("빈 host 와 DNS 해석 실패는 막지 않는다 — …")으로 해소됐고, 실제 구현(`if (!trimmed) return false;`)·
  테스트(`smtp-host-guard.spec.ts` "returns false for empty host"/"returns false for a missing host")와
  정확히 일치한다.
- **주석 정정(`SMTP_BLOCK_PRIVATE_HOSTS` phantom → `ALLOW_PRIVATE_HOST_TARGETS`)** — `integrations.service.ts`
  `testEmailTransport`, `send-email.handler.ts` 두 곳 모두 "SSRF 가드 (기본 ON) … `ALLOW_PRIVATE_HOST_TARGETS=true`
  로만 끈다" 로 정정됐고, 실제 `isPrivateHostsAllowed()` 로직(기본 차단, 플래그가 `'true'` 일 때만 통과)과
  정확히 일치한다 — 존재한 적 없는 옛 이름의 흔적이 남지 않았다.
- **`SsrfBlockedError`/`canonicalIPv6`/`mappedIPv4` JSDoc** — 실측 근거(macOS · `node:24-alpine`,
  `EHOSTUNREACH`/`ENETUNREACH`)와 정규화 규칙을 구체적으로 남겨 코드와 정확히 일치함을 확인했다.
- **`http-safety.spec.ts` 신규 mock 오버로드 주석** — "`jest.mocked(lookup)` 은 단일 주소 오버로드로 잡혀
  배열을 거부한다" 는 설명이 plan 체크리스트가 기록한 타입체크 ratchet 실측(3→4→0, baseline 197→194,
  `scripts/backend-typecheck-baseline.json` diff 로 재확인)과 일치한다.

## 요약

1라운드가 지적한 CHANGELOG·`.env.example`·JSDoc(빈 host) 문서화 갭은 이번 조치 커밋에서 정확하고 충실하게
해소됐다. 다만 그 조치 커밋이 `http-safety.ts` 모듈 JSDoc 에 새로 끼워 넣은 "공용 가드가 왜 `http-request/`
폴더에 있는가" 설명 문단은 (1) 원래 이어져 있던 두 영어 문장 사이에 끼어들어 문단 구분 없이 붙으면서 읽는
흐름을 깨뜨리고, (2) "트래커에 따로 있다" 는 현재형 서술이 실제로는 아직 등재되지 않은 상태(plan 체크리스트
자체가 "마무리 커밋" 때로 못박아 둠)를 가리켜, 지금 시점 기준으로는 정확하지 않다. 둘 다 병합을 막을 사유는
아니지만, 다음 사람이 이 JSDoc 만 읽고 트래커를 뒤졌다가 못 찾거나 문장을 오독할 수 있으므로 이번 plan 을
닫기 전에 정리를 권한다.

## 위험도

LOW
