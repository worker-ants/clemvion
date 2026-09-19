# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[WARNING]** 통합 관리 유저 가이드가 "Database · HTTP만 사설/loopback 차단" 이라고 적어, Email(SMTP)이 같은 가드로 통합됐다는 이번 변경의 사용자 가시 사실을 반영하지 못함
  - 변경 파일: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts`(신규), `codebase/backend/src/nodes/integration/http-request/http-safety.ts`(IPv4-mapped/CGNAT 판정 통합), `codebase/backend/src/modules/integrations/integrations.service.ts`(SMTP 연결 테스트 가드 배선)
  - 매트릭스 항목: `integration-provider-change` (통합 신규/제공자 변경) — targets: `"codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키"`. PROJECT.md §변경 유형→갱신 위치 167행 동일 인용, §자주 누락 218행 "회색 지대는 보수적으로 '갱신 필요'로 분류" 도 적용됨
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` 80행, `integration-management.en.mdx` 69행
  - 상세: 두 페이지 모두 "사설망·loopback 같은 내부 주소로 향하는 **Database · HTTP** 연동은 보안을 위해 테스트가 차단되고 실패로 표시돼요" (EN: "Database and HTTP connections aimed at private or loopback addresses are blocked...") 라고만 적혀 있어 Email(SMTP)이 제외돼 있음. 같은 페이지 74행은 Email 이 "실제로 접속해서 확인(SMTP 로그인까지)" 되는 서비스라고 이미 밝히는데, 정작 그 접속이 사설/루프백/CGNAT 대상이면 차단된다는 사실은 안내되지 않음. 이번 PR 은 정확히 이 SMTP 가드를 HTTP/DB 와 "같은 구현" 으로 통합했고(smtp-host-guard.ts 주석: "HTTP Request · DB Query 노드와 **같은 구현**을 쓴다"), CHANGELOG 는 "CGNAT 주소의 SMTP 서버... 는 이제 막힌다" 는 배포 후 사용자 가시 동작 변화를 명시적으로 예고함. 자체 호스팅 SMTP relay 운영자가 왜 연결 테스트가 갑자기 실패하는지 유저 가이드에서 확인할 방법이 없음
  - 제안: 80행/69행 문장에 "Email(SMTP)" 를 Database·HTTP 목록에 추가하고, 필요하면 CGNAT 대역도 차단 대상에 포함된다는 문구를 보강. 자체 호스팅 예외(`ALLOW_PRIVATE_HOST_TARGETS`)는 기존과 같이 "운영자가 내부 주소를 허용한 설치는 예외" 문구가 Email 에도 적용됨을 명확히

- **[INFO]** `EMAIL_HOST_BLOCKED` 에러 코드가 `backend-labels.ts` 의 `ERROR_KO` 매핑에 없어 ko 로케일 사용자에게 영문 fallback 메시지가 노출됨 — 단, 이 코드는 이 diff 이전(#550/#553)부터 존재해 이번 PR 이 신설한 trigger 는 아님(`error-codes.ts` 는 `origin/main` 대비 무변경 — `git diff --stat` 확인)
  - 변경 파일: 해당 없음(트리거 파일 `codebase/backend/src/nodes/core/error-codes.ts` 는 이번 diff 에 없음) — 인접 관찰
  - 매트릭스 항목: `new-error-code` (신규 errorCode 발행) — 엄밀히는 이번 diff 가 이 행의 glob trigger(`error-codes.ts`)를 건드리지 않아 "매칭"은 아니지만, 이번 PR 이 바로 이 코드의 발생 조건(사설·CGNAT SMTP host)을 확장한 당사자라 회색 지대로 기재
  - 누락된 동반 갱신: `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO.EMAIL_HOST_BLOCKED` (참고로 `HTTP_BLOCKED`·`DB_HOST_BLOCKED` 는 이미 매핑돼 있음 — 568~593행)
  - 상세: 이번 PR 의 e2e(`integration-connection-test.e2e-spec.ts` B2)와 handler 코드 모두 `EMAIL_HOST_BLOCKED` 를 실제로 발생시키는 경로를 넓혔음(CGNAT 100.64.0.0/10 대역도 이제 이 코드로 막힘). 이 코드에 대해서만 ko 매핑이 없어, ko 로케일 사용자가 SMTP 연결 실패 시 이 셋 중 유독 영문 메시지를 볼 가능성이 이번 변경으로 실질적으로 늘어남
  - 제안: 이번 PR 범위에 포함시키거나(선호), 범위를 좁게 유지하려면 최소한 PR/plan 본문에 이 기존 갭을 명시하고 후속 plan 으로 등재(PROJECT.md 172행의 기존 완화 절차와 동일 패턴)

- 나머지 매트릭스 행(새 노드 추가/노드 schema 변경/신규 UI 문자열/신규 섹션 디렉토리/인증 흐름/표현식 언어/실행·디버깅 흐름/신규 warningCode)은 검토 결과 **불일치 없음**:
  - "새 노드 추가" — `nodes/**` glob 은 매칭되지만, 신규 노드 디렉토리(`<cat>/<name>/`)가 생긴 것이 아니라 기존 `send-email` 노드 내부의 유틸리티 파일 이동/신설(`smtp-host-guard.ts` moved from `common/utils/`)이라 이 change_type(새 노드) 자체가 성립하지 않음
  - "노드 schema 변경" — 필드·라벨·타입 변경 없음. 차단 코드(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)·문구는 CHANGELOG 가 명시적으로 "그대로다" 라고 확인
  - "신규 UI 문자열" — `.tsx` 변경 없음(모두 backend `.ts`/`.spec.ts`/md)
  - "신규 섹션 디렉토리" — 해당 없음
  - "인증·권한·세션 흐름 변경" — `modules/auth/**` 변경 없음
  - "표현식 언어 변경" — `packages/expression-engine/**` 변경 없음
  - "05-run-and-debug" 갱신 필요 여부 확인 결과, `run-results.mdx`/`.en.mdx` 는 이미 `EMAIL_HOST_BLOCKED`·`HTTP_BLOCKED`·`DB_HOST_BLOCKED` 를 일반적 "사설망·loopback 주소" 문구로만 설명하고 있어 이번 CGNAT/IPv4-mapped 세부는 그 일반화 수준을 벗어나지 않음 → 갱신 불요로 판단

## 요약

매트릭스 22개 trigger 행 중 이번 diff(`CHANGELOG.md`, backend SSRF 가드 통합 8개 코드/테스트 파일, e2e, plan)에 실질 매칭된 것은 "통합 신규/제공자 변경"(semantic) 1건이며, 그에 대응하는 유저 가이드 갱신(`06-integrations-and-config/integration-management.{mdx,en.mdx}` 의 사설망 차단 안내에 Email 누락)이 같은 변경 set 에 없어 WARNING 1건으로 판정. 그 외 인접 관찰로 기존(이번 PR 이전부터 존재)의 `EMAIL_HOST_BLOCKED` ko 매핑 공백을 INFO 로 부기했으며 이는 이번 diff 의 확정 trigger는 아니다. "새 노드 추가"·"신규 warningCode/errorCode"·"신규 UI 문자열"·"신규 섹션 디렉토리"·"인증 흐름"·"표현식 언어"·"실행·디버깅 흐름" 등 나머지 행은 모두 무관 또는 이미 충족.

## 위험도

MEDIUM
