# 유지보수성(Maintainability) 리뷰 — SSRF 가드 통합 (2라운드)

## 컨텍스트

1라운드 리뷰(`review/code/2026/09/19/21_38_32/`)의 maintainability WARNING(메시지 접두어 매직스트링 계약)은 `a1e1a591b`
에서 `SsrfBlockedError` 전용 클래스 도입으로 해소됐다 — `smtp-host-guard.ts` 가 `err instanceof SsrfBlockedError` 로
판별하며, 재던짐 테스트도 mock 이 그 클래스를 내보내도록 갱신됐다(양성 확인, 재론 없음). 이번 라운드는 그 1라운드 조치
커밋(`a1e1a591b`) 자체가 새로 들여온 결함이 있는지를 중심으로 봤다.

## 발견사항

- **[WARNING]** 1라운드 조치가 JSDoc 문장을 언어·주제가 다른 두 문단 사이에 끼워 넣어 원래 이어지던 영어 문장의
  선행절이 끊겼다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:11-15`
  - 상세: 원래는 `Blocks URLs that resolve to loopback, link-local, private (RFC 1918), CGNAT, or
    unique-local IPv6 ranges.` 바로 뒤에 `Intended for Integration-backed requests where a workflow
    author should not be able to pivot to internal infrastructure...` 가 한 문단으로 이어졌다(SSRF 가드의
    "무엇을 막나" → "왜 막나"로 자연스럽게 이어지는 한 문장). 이번 라운드(1라운드 WARNING #2 "공용 가드가
    `http-request/` 폴더에 있다"에 대한 최소 조치)에서 `공용인데 http-request/ 폴더에 있는 이유: ...
    (plan/in-progress/spec-draft-nullable-notation-followups.md)` 라는 완전히 다른 주제(파일 물리적 위치의
    역사적 이유)의 한국어 문단을 그 사이에 새로 끼워 넣었는데, 새 문단과 `Intended for Integration-backed
    requests` 사이에 문단 구분(빈 줄) 없이 같은 문단으로 이어 붙여, 지금은 "...트래커에 따로 있다(...).
    Intended for Integration-backed requests..." 로 읽힌다 — 폴더 위치 설명 문장 바로 뒤에, 원래 다른
    문단에 속하던 영어 문장이 그 문단의 결론처럼 붙어버려 두 문단 다 무엇을 말하는지 헷갈리게 됐다.
    실제 diff 상으로도 `+` 로 추가된 한국어 3줄(게이트 11-13)이 기존 문장 `Intended for Integration-backed`
    바로 앞에 삽입된 것으로 확인된다(`http-safety.ts:11-15` 및 diff `@@ -1,8 +1,16 @@` 블록). 기능에는
    영향 없는 문서 전용 결함이지만, 이 파일 헤더는 "SSRF 가드가 왜 이 폴더에 있는지" 를 설명하는 유일한
    문서(트래커 참조 링크 포함)라 다음 사람이 두 문단의 경계를 오독하기 쉽다.
  - 제안: 두 문단 사이에 빈 줄(`*` 만 있는 줄)을 넣어 별도 문단으로 분리하거나, 폴더 위치 한국어 문단을
    파일 맨 끝(또는 "Two layers" 문단 뒤)으로 옮겨 "Blocks URLs..." → "Intended for..." 영어 문장이
    끊기지 않고 이어지도록 되돌린다.

- **[INFO]** (양성 확인) 1라운드 WARNING #3·#4 회귀 테스트가 정확히 지적된 케이스를 커버함
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.spec.ts` (IPv4-compatible ·
    SIIT · NAT64 · 6to4 4종 `it.each`, "mapped 가 아닌 IPv4 내장 표기는 통과" 블록),
    `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.spec.ts` ("returns false for a
    missing host" 케이스)
  - 상세: 지적된 대안 표기 4종과 `undefined` host 입력이 정확히 테스트로 고정됐다. 재론 불필요.

- **[INFO]** (양성 확인) `SsrfBlockedError` 는 코드베이스의 기존 `XxxError extends Error` 관례
  (`IntegrationError`, `Cafe24AuthFailedError`, `MakeshopRateLimitedError` 등, `this.name = 'ClassName'`
  패턴 포함)를 그대로 따른다 — 신규 관례를 만들지 않았다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts:47-52`

- **[INFO]** (양성 확인) `smtp-host-guard.spec.ts` 의 `jest.isolateModules` + `require` 재주입 패턴은
  이 코드베이스에 이미 있는 관례(`src/instrumentation.spec.ts`, `src/nodes/data/code/code.handler.spec.ts`)와
  같은 모양이라 신규 스타일이 아니다.

- 그 외 실제 코드 변경분(`http-safety.ts` 의 `canonicalIPv6`/`mappedIPv4`/`isBlockedIPv6`,
  `smtp-host-guard.ts` 신규 파일, `integrations.service.ts`/`send-email.handler.ts` 의 import 경로·주석
  정정)은 함수 길이·중첩 깊이·순환 복잡도 모두 낮고(전부 조기 반환의 단일 레벨 분기, 최대 5~6개 분기), CIDR
  대역은 전부 주석으로 의미가 달려 있어 매직넘버로 보지 않았다. `review/code/**`·`review/consistency/**`·
  `scripts/backend-typecheck-baseline.json` 은 산출물/생성 파일이라 유지보수성 관점 코드 리뷰 대상이 아니다.

## 뮤테이션 검증

저장소 파일을 수정하지 않았다 — 정적 열람(Read/Grep)만으로 판단했다. `git status --short` 대조 불필요(변경 없음).

## 요약

1라운드에서 지적된 매직스트링 계약(WARNING #1)은 `SsrfBlockedError` 도입으로 깔끔히 해소됐고, 나머지 조치(회귀
테스트 4종, undefined-host 테스트)도 정확히 지적된 케이스를 고정해 재론할 거리가 없다. 다만 그 조치 커밋
(`a1e1a591b`)이 폴더 위치 설명을 위해 `http-safety.ts` 헤더 JSDoc 에 삽입한 한국어 문단이 문단 구분 없이 기존
영어 문장 바로 앞에 붙어, "무엇을 막는가" 설명과 "왜 이 폴더에 있는가" 설명이 한 문단처럼 읽히는 새로운 readability
회귀를 만들었다(WARNING). 기능·테스트에는 영향이 없는 순수 문서 결함이며, 빈 줄 하나로 고칠 수 있는 낮은 비용의
수정이다. 그 외 실질 코드(핵심 판정 로직·SMTP 가드 어댑터)는 함수가 짧고 단일 책임을 지키며, 네이밍·에러 클래스
관례·테스트 구조 모두 기존 코드베이스 패턴과 일관된다.

## 위험도

LOW
