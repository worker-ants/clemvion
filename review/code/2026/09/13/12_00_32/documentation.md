# 문서화(Documentation) 리뷰

## 검토 범위

실질 변경 파일 25개(`git diff origin/main --stat -- codebase/ CHANGELOG.md PROJECT.md` 로 재확인,
23파일·+914/-61) — `CHANGELOG.md`·`PROJECT.md`, LLM/통합 테스트-커넥션 응답 필드 정정
(`llm.service.ts`/두 DTO/두 spec), 프런트 API 클라이언트·컴포넌트 테스트, 유저 가이드 MDX 6종,
신규 build-time 가드 3파일(`guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`/
`guide-sanitized-message-parity.test.ts`), `plan/in-progress/*.md` 2건. 프롬프트에 실린 나머지
파일(26~138)은 이전 리뷰 라운드(1~4)의 산출물(`review/code/**`, `review/consistency/**`)이며
이번 변경분의 문서화 품질과는 별개 대상이라 코드/스펙 본문 관점에서만 대조용으로 참고했다.
`plan/in-progress/guide-error-code-truth.md` 전문과 `git log`로 라운드별 커밋을 대조해 CHANGELOG·
PROJECT.md가 **최종 상태**를 반영하는지 실측했다.

## 발견사항

- **[WARNING]** CHANGELOG 의 "가드 추가" 서술이 이 PR 이 실제로 만든 가드 **2건 중 1건만** 반영한다 — 라운드 1~4 진행 중 스코프가 넓어졌는데 CHANGELOG 는 갱신되지 않았다
  - 위치: `CHANGELOG.md:59-62` (해당 없음 — 최소 하나가 **빠져 있어서** 인용할 게이트가 없다. 실제로는 이 자리 근처에 추가돼야 한다)
  - 상세: 실측(`git log --oneline -- CHANGELOG.md`)으로 CHANGELOG 를 건드린 커밋은 `911d9d7dd`(라운드 0/초안)·`de99def86`(라운드 2)·`137784219`(라운드 3) 셋뿐이다. 그런데:
    1. `guide-sanitized-message-parity.test.ts` 는 라운드 1 커밋 `a68457936`(*"내 주장의 마지막 층이 비어 있었다"*)에서 신설됐다 — `git show a68457936 -- CHANGELOG.md` 는 **빈 diff**다. 이 가드는 8갈래 문장표가 `sanitize-error.util.ts` 를 손으로 베낀 것이라 무가드였던 걸 고친, 이 PR 본문의 핵심 결함 중 하나를 닫는 신규 build-time 테스트인데 CHANGELOG 어디에도 이름이 없다(`grep -n "parity\|sanitize-error\|8갈래" CHANGELOG.md` → 8갈래 언급은 있지만 가드 이름은 없음).
    2. 라운드 4 커밋 `42680d5f9`(*"가드가 막으라고 만든 결함을 가드가 통과시켰다 — CRITICAL 해소"*)가 `integrations.mdx`/`integrations.en.mdx` 에 `MAKESHOP_UNRESOLVED_PATH_PARAM` 관련 `<Callout>` 을 추가했다(consistency 게이트가 CRITICAL 로 잡은 자리) — `git show 42680d5f9 -- CHANGELOG.md` 도 빈 diff다. CHANGELOG 의 "통합 노드 가이드" 항목(`CHANGELOG.md:57`)은 여전히 *"`MAKESHOP_API_ERROR` → `MAKESHOP_404` + 실재 코드 계열 설명"* 까지만 적고, 이 PR 이 스스로 낸 CRITICAL 을 고친 사실은 언급하지 않는다.
  - 반면 `PROJECT.md` 는 두 가드를 **모두** 정확히 등재했고(`PROJECT.md:300-301`, 가드 2건 + `guide-error-code-existence` 의 "한계: 존재 검사이지 방출 검사가 아니다" 캐비엇까지), `plan/in-progress/spec-draft-nullable-notation-followups.md:3243-3257` 도 두 가드를 표로 병기하며 `code:` frontmatter 목록 갱신 대상까지 정확히 등재했다. 즉 **개발자 카탈로그(PROJECT.md)·planner 트래커는 최종 상태를 정확히 따라잡았는데, 사용자/운영자가 보는 CHANGELOG 만 라운드 0 시점 스냅샷에 멈춰 있다.**
  - 제안: CHANGELOG 의 두 번째 Unreleased 항목("유저 가이드가 적던 에러 코드 5종...")에 (a) `guide-sanitized-message-parity` 가드 한 줄 추가, (b) `guide-error-code-existence` 가드 설명에 "존재 검사이지 방출 검사가 아니다(예: `MAKESHOP_UNRESOLVED_PATH_PARAM` 은 메시지 접두로만 실려 통과한다)" 캐비엇 병기, (c) "통합 노드 가이드" 불릿에 `<Callout>` 로 전용 코드 부재 사례를 명시했다는 한 줄 추가.

- **[INFO]** CHANGELOG 의 "실행 결과·에러 처리 가이드" 항목이 라운드 3 에서 추가된 실재 코드 5종(그중 2종은 SSRF 방어 코드 `DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)을 구체적으로 언급하지 않는다
  - 위치: `CHANGELOG.md:55-56`
  - 상세: 라운드 3(`review/code/2026/09/13/11_07_36` requirement WARNING#1)이 지적한 대로, 최초 커밋은 은퇴 코드 2종만 노드-종류별 표로 대체했는데 spec §1.4 대비 5종(그중 SSRF 관련 `*_HOST_BLOCKED` 2종 포함)이 여전히 누락돼 있었고 이를 라운드 3 커밋(`137784219`)에서 보강했다. CHANGELOG 불릿은 *"노드 종류별 코드표(HTTP·DB·Email·LLM·Code·Sub-workflow)로 바꿨다"* 로만 남아 있어 이 보강이 CHANGELOG 상 별도로 드러나지 않는다. 사용자에게 배포 영향(신규로 문서화되는 SSRF 차단 코드)이 있는 항목이라 완전히 무해하지는 않다.
  - 제안: 위 WARNING 정정 시 함께 반영 가능 — "노드 종류별 코드표로 바꾸며 spec 카탈로그 대비 누락돼 있던 5종(SSRF 차단 코드 2종 포함)도 보강" 정도로 한 문구 추가.

## 확인해 본 항목 — 문제 없음

- JSDoc/인라인 주석: `LlmService.testConnection`(`llm.service.ts:299-322`), 두 DTO(`integration-response.dto.ts:456-489`, `model-config-response.dto.ts:48-58`), 신규 가드 3파일 전부 — 근거·기각한 대안·실측 수치·자기 한계까지 코드에 남겨 검증했고 전부 현재 코드와 일치한다(예: `MAKESHOP_UNRESOLVED_PATH_PARAM` 관련 주석이 `makeshop.handler.ts:435-436`·`:360` 실제 구현과 정확히 일치, `plan/.../spec-draft-nullable-notation-followups.md:3266` 의 MCP 3종 등재도 실재).
- 컨트롤러 HTTP 왕복 테스트(`llm-model-config.controller.spec.ts`)의 describe 블록 상단 docstring — "왜 단위 프로브로 부족한가" 근거가 실제 검증 계층과 일치.
- MDX 문서(ko/en 6파일) — 신설 표·Callout 이 ko/en 쌍으로 대칭 반영됐고, `<ImplAnchor kind="api-endpoint">` 심볼(`testConnection`)이 실제 컨트롤러에 존재함을 확인.
- `guide-sanitized-message-parity.test.ts` — SoT 를 import 대신 텍스트로 읽는 이유, vacuity floor 근거가 코드 주석에 명시돼 있고 실제 vitest 로 검증 가능한 구조.
- README: 해당 가드 폴더(`codebase/frontend/src/lib/docs/__tests__/`)에는 애초에 README 가 없고 카탈로그 SoT 는 PROJECT.md 로 일원화돼 있어 별도 README 업데이트 불요.
- 설정/환경변수: 신규 env·config 옵션 없음.

## 요약

코드·테스트·MDX 가이드 본문의 문서화 품질은 매우 높다 — 근거·기각한 설계·실측 수치·자기
반증까지 남긴 JSDoc/인라인 주석이 전부 현재 코드와 대조해 정확했고, 4라운드에 걸친 리뷰가
이미 자기모순·낡은 주석을 스스로 잡아냈다. 유일한 잔여 결함은 **CHANGELOG.md 가 라운드 0
시점에 멈춰 있다는 것**이다 — 이 PR 자신이 라운드 1·4 에서 새 가드(`guide-sanitized-message-
parity`)를 추가하고 자신이 낸 CRITICAL(`MAKESHOP_UNRESOLVED_PATH_PARAM`)을 고쳤는데, 그 사실이
CHANGELOG 에는 반영되지 않았다. PROJECT.md 와 plan 트래커는 두 가드 모두 정확히 등재해
대비된다 — 즉 개발자용 카탈로그는 최신인데 배포 노트만 낡았다.

## 위험도

LOW
