# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` `rows[]` (22개 change_type) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 적재해 대조했다. 이번 diff(`CHANGELOG.md`, backend SSRF 가드 통합 파일 다수, `06-integrations-and-config/integration-management.{mdx,en.mdx}`, plan/tracker, 이전 라운드 리뷰 산출물)를 매트릭스 22행에 매칭한 결과는 아래와 같다.

## 발견사항

- **[INFO]** `integration-provider-change`(통합 신규/제공자 변경) trigger 는 매칭됐고, 대응 동반 갱신은 **이미 이번 changeset 안에 포함**돼 있음 — 갭 없음 확인
  - 변경 파일: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts`(신규) · `codebase/backend/src/nodes/integration/http-request/http-safety.ts`(IPv4-mapped/CGNAT 판정 통합) · `codebase/backend/src/modules/integrations/integrations.service.ts`
  - 매트릭스 항목: `integration-provider-change` — targets: `"codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키"`
  - 확인: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`(게이트 80) · `integration-management.en.mdx`(게이트 69) 가 이번 diff 에 포함되어 "사설망·loopback·CGNAT(`100.64.0.0/10`) 같은 내부 주소로 향하는 Database · HTTP · Email(SMTP) 연동은 …" / "Database, HTTP and Email (SMTP) connections aimed at private, loopback or CGNAT (`100.64.0.0/10`) addresses are …" 로 이미 갱신돼 있다. dict 키 변경은 필요 없음 — 이번 변경은 `.tsx` 를 건드리지 않고 서비스 유형(Email/SMTP)도 신규가 아니라 기존 provider 의 차단 대역만 확장했기 때문이다.
  - 근거: 직전 라운드(`review/code/2026/09/19/22_00_32/user_guide_sync.md`)가 바로 이 갭을 WARNING 으로 지적했고(당시 diff 엔 두 mdx 파일이 없었음 — `22_00_32/meta.json` 파일 목록에 부재), `RESOLUTION.md`(2라운드) W1 항목이 커밋 `fce34b77b` 로 조치했다고 기록. 이번 라운드(`22_24_32`) 의 diff 에 그 커밋 결과가 실제로 들어와 있음을 파일 내용 대조로 재확인했다 — 재발 없음.
  - `<ImplAnchor kind="ui-entry">` 의무(convention `user-guide-evidence.md`) 는 이 편집에는 적용되지 않는다 — 수정된 문단은 `## 연동 테스트·수정·회전` 절의 `<Callout type="note">` 안이고, `integrations-coverage.test.ts` 의 `findGuiFlowSections()` 판별 신호(heading 에 bareword `GUI` 또는 본문에 `**…GUI…**` bold)가 이 절엔 없어 "GUI flow 절" 로 잡히지 않는다 — anchor 누락이 아니라 애초에 대상이 아님.

- **[INFO]** `EMAIL_HOST_BLOCKED` 가 `backend-labels.ts` `ERROR_KO` 매핑에 없음 — 그러나 이번 PR 이 만든 갭이 아니고, 매핑을 추가해도 사용자 화면에 영향이 없는 것으로 이미 확인돼 있음
  - 변경 파일: 해당 없음 — 트리거 파일 `codebase/backend/src/nodes/core/error-codes.ts` 는 `origin/main` 대비 이번 diff 에서 무변경(`git diff origin/main --stat -- codebase/backend/src/nodes/core/error-codes.ts` 결과 없음). `EMAIL_HOST_BLOCKED` 자체는 `f5a90993d`(#350)부터 존재하는 기존 코드
  - 매트릭스 항목: `new-error-code`(신규 errorCode 발행) — glob trigger(`error-codes.ts`)가 이번 diff 를 매칭하지 않아 엄밀 매칭은 아니다. 다만 이번 PR 이 SMTP host 를 `http-safety.ts` 로 통합하면서 CGNAT(`100.64.0.0/10`) 도 이 코드로 막게 돼, 발생 조건을 실질적으로 넓힌 당사자라 인접 관찰로 남긴다(참고로 `HTTP_BLOCKED`·`DB_HOST_BLOCKED` 는 `ERROR_KO`에 이미 매핑돼 있음 — `codebase/frontend/src/lib/i18n/backend-labels.ts:588`, `592`).
  - 직전 라운드 RESOLUTION(`review/code/2026/09/19/22_00_32/RESOLUTION.md` INFO 3)이 "추가하지 않는다"고 명시적으로 처분했고, 근거로 든 기존 트래커 항목 — `plan/in-progress/spec-draft-nullable-notation-followups.md:3833`("`ERROR_KO` 의 API 에러 코드 매핑을 아무도 읽지 않는다") — 을 직접 열어 검증했다: `ERROR_KO` 를 읽는 유일한 함수 `translateBackendError` 의 **프로덕션 호출부가 0건**(정의 + 자기 테스트뿐)이라고 실측·기록돼 있다. 즉 `EMAIL_HOST_BLOCKED` 를 `ERROR_KO` 에 추가해도 지금 구조에서는 사용자에게 보이는 문자열이 전혀 바뀌지 않는다 — CRITICAL 판정 기준("매핑 없으면 사용자에게 영문 그대로 노출")의 전제인 "매핑이 있으면 번역되어 노출된다"가 이 코드베이스에서는 성립하지 않는 것으로 이미 실측됨. 재조사 불필요, CRITICAL 로 올리지 않음.

- **[INFO]** `05-run-and-debug/run-results.{mdx,en.mdx}` 의 `*_HOST_BLOCKED` 설명이 CGNAT/IPv4-mapped 세부를 언급하지 않음 — 일반화 수준이라 갱신 불요로 판단(독립 재확인)
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`(게이트 181 부근) / `.en.mdx`(동일) — "`*_HOST_BLOCKED` 는 노드가 사설망·loopback 주소로 요청하려 할 때 서버가 **미리 막은** 경우예요" / "`*_HOST_BLOCKED` means the server blocked the request before it left — the node tried to reach a private or loopback address"
  - 상세: 문장이 차단 대역을 exhaustive 하게 나열하지 않고 "워크플로우 밖으로 나가면 안 되는 주소" 라는 동작 클래스만 설명한다 — RFC1918·link-local 도 원래부터 이 문장에 나열돼 있지 않았으므로, 이번에 CGNAT·IPv4-mapped 가 추가됐다고 이 문장이 거짓이 되지는 않는다. `integration-management.mdx` 사례(WARNING 이었던 것)와 다른 점은, 거기는 "Database · HTTP **만**" 이라고 서비스 목록을 배타적으로 못박아 Email 배제가 명시적 오류였던 반면, 여기는 대역을 아예 나열하지 않아 배타적 주장이 없다는 것.
  - 직전 라운드도 같은 결론(갱신 불요)이었고, 이번에 문장을 직접 재대조해 독립 확인했다. 조치 불요.

- 나머지 매트릭스 행은 이번 diff 와 무관하거나 이미 충족 확인:
  - `new-node`(새 노드 추가) — `codebase/backend/src/nodes/**` glob 은 매칭되지만(예: `smtp-host-guard.ts` 신규 파일), **신규 노드 디렉토리**(`<cat>/<name>/`)가 아니라 기존 `send-email` 노드 내부의 유틸 파일 이동/신설이라 change_type 자체가 성립하지 않음
  - `node-schema-change` — 필드·라벨·타입 변경 없음(CHANGELOG 가 "차단 응답·코드와 문구는 그대로다" 라고 명시)
  - `new-ui-string` — `.tsx` 변경 0건(전부 backend `.ts`/`.spec.ts`/`.mdx`/`.md`)
  - `new-userguide-section-dir` — 신규 `docs/<NN>-<name>/` 디렉토리 없음
  - `auth-session-flow-change` — `codebase/backend/src/modules/auth/**` 변경 없음
  - `expression-language-change` — `codebase/packages/expression-engine/**` 변경 없음
  - `env-runtime-change` — `.env.example` 헤더 주석만 정정(Send Email 을 적용 대상에 추가·경로 명시), `ALLOW_PRIVATE_HOST_TARGETS` 자체는 기존 변수라 신규 env var 트리거 아님. README.md 갱신 불요
  - `userguide-gui-flow-section` — 위 첫 발견사항에서 서술한 대로 이 편집은 "GUI flow 절" 판별 신호가 없어 비대상

## 요약

매트릭스 22개 행 중 이번 changeset 에 실질 매칭된 것은 `integration-provider-change`(통합 신규/제공자 변경) 1건이며, 대응하는 유저 가이드 갱신(`06-integrations-and-config/integration-management.{mdx,en.mdx}` 의 Email(SMTP)·CGNAT 반영)이 **직전 라운드(22:00:32) WARNING → 같은 브랜치 커밋(`fce34b77b`)으로 이미 조치되어 이번 diff 안에 포함**돼 있음을 파일 내용 대조로 확인했다. 인접 관찰 2건(`EMAIL_HOST_BLOCKED` 의 `ERROR_KO` 부재 · `run-results.mdx` 일반화 문구)은 모두 이번 PR 이 만든 갭이 아니며, 전자는 `translateBackendError` 프로덕션 호출부 0건이라는 기존 실측 때문에 매핑을 더해도 무의미함이 이미 확인돼 있고, 후자는 애초에 exhaustive 목록이 아니라 갱신이 불필요하다. 나머지 21개 행은 무관.

## 위험도

NONE
