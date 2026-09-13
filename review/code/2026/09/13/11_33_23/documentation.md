# 문서화(Documentation) 리뷰

## 검토 범위

`guide-error-code-truth` 배치(`origin/main...HEAD`, 이미 3라운드 `/ai-review`(`10_12_19` →
`10_40_34` → `11_07_36`) + 3라운드 `/consistency-check` 처분이 끝난 상태). 총 28개 실질 변경
파일(+ 이전 라운드 자신의 `review/**` 산출물 24개는 문서화 관점에서 실질 대상이 아니므로
훑기만 함) — CHANGELOG, backend DTO 2종 + 서비스 1종 + spec/spec 2종, frontend API 클라이언트,
MDX 유저 가이드 6개, 신규 build-time 가드 3개(`guide-error-code-scan.ts` ·
`guide-error-code-existence.test.ts` · `guide-sanitized-message-parity.test.ts`), plan 트래커
2개. 프롬프트가 절단한 파일(`llm-model-config.controller.spec.ts`,
`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`, plan 파일 2종)은 저장소 원본을
`Read`로 직접 열어 전문을 확인했다. 저장소 파일은 뮤테이션하지 않았다(`Read`/`grep`만 사용).

## 발견사항

- **[WARNING]** 신규 build-time 가드 2건이 `PROJECT.md`의 "자동 가드(build-time 차단)" 카탈로그에
  등재되지 않았다 — 이 PR 이 직접 쓸 수 있는 문서인데도 누락됐다
  - 위치: `PROJECT.md:289-307` (`### 자동 가드 (build-time 차단)` 절, `codebase/frontend/src/lib/docs/__tests__/` 아래 모든 가드를 낱개 bullet 로 나열하는 카탈로그) — 이 절은 `impl-anchor-existence.test.ts`(299행)부터 `spec-plan-completion.test.ts`(306행)까지 같은 디렉터리의 모든 `.test.ts` 가드를 한 줄씩 등재하고 있다.
  - 상세: 이번 PR 이 같은 디렉터리(`codebase/frontend/src/lib/docs/__tests__/`)에 신설한 `guide-error-code-existence.test.ts`·`guide-sanitized-message-parity.test.ts` 두 테스트 파일이 이 카탈로그에 없다. 순수 스캐너 모듈(`guide-error-code-scan.ts`, `impl-anchor-parse.ts`처럼 헬퍼는 이 목록에 안 실리는 게 기존 관례)은 대상이 아니지만, 두 `.test.ts` 는 이 목록이 잡는 정확한 대상이다. `PROJECT.md` 는 `spec/**`·`.claude/**` 거버넌스 문서와 달리 **developer 가 직접 쓸 수 있는 문서**임이 이 저장소 자체 기록으로 확인된다(`plan/in-progress/spec-draft-nullable-notation-followups.md:1841` — *"이 표에서 제외 — developer 소유 문서다"*, 그리고 `:612` — 유사한 갭을 이전 PR 이 같은 turn 에 `PROJECT.md` 를 직접 고쳐 닫은 선례). 즉 이 갭은 `spec/conventions/user-guide-evidence.md §2.1` 관계표 갭(§D, `plan/in-progress/spec-draft-nullable-notation-followups.md:3243-3264` 에 이미 planner 백로그로 정확히 등재됨 — `developer` 는 `spec/` 을 못 쓰므로 정당한 위임)과 **표면은 같지만 소유가 다르다**. 후자는 이미 3라운드 리뷰를 거치며 두 번이나 좁게 등재됐다가 정정된 이력이 있는데(같은 파일 3258-3262행), 정작 developer 소유인 `PROJECT.md` 쪽은 어느 라운드에서도 지목되지 않았다. CHANGELOG(52-118행)가 이 가드를 `user-guide-evidence.md` 의 "가드 가족"이라고 명시적으로 자리매김하고 있는 것과 대비하면, 그 가족의 실행 카탈로그인 `PROJECT.md` 만 갱신에서 빠진 셈이다.
  - 제안: `PROJECT.md:299` (`impl-anchor-existence.test.ts` 항목) 근처에 `guide-error-code-existence.test.ts`·`guide-sanitized-message-parity.test.ts` 두 줄을 추가하고, 각각 한 줄 설명(가이드가 적은 에러 코드 토큰의 실재성 / 8갈래 실패 문장의 SoT 대조)을 붙인다. `spec/` 을 거치지 않는 developer 소유 문서이므로 이번 PR 안에서 바로 처리 가능하다.

## 긍정적으로 확인한 사항 (참고)

- **JSDoc**: `LlmService.testConnection` 의 JSDoc(`llm.service.ts:299-322`)이 필드명 변경 근거와 새 `@returns` shape(성공/실패 양쪽)을 정확히 반영한다. 리뷰 라운드 1 이 지적했던 "시그니처 중간에 근거 주석이 낀다" 문제도 실제 파일을 열어 확인한 결과 이미 JSDoc 블록 안으로 옮겨져 있다.
- **주석 정확성**: `latencyMs` 제거·`code` 추가에 딸린 DTO 주석(`model-config-response.dto.ts:52-58`, `integration-response.dto.ts:459-488`)이 "생산자 0건 실측" · "정반대 방향 결함" 등 구체적 근거를 남기고, 실제 `IntegrationTestResult` 인터페이스·서비스 grep 결과와 대조해도 정확했다(직접 확인).
- **인라인 주석·테스트 문서화**: `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts` 는 판정 축을 좁혀온 과정(3→3′→3″, 39종→66종)과 각 결정의 실측 근거를 표로 남기고, vacuity floor·대조군·비대상 케이스를 모두 이름 붙여 테스트로 고정했다 — 이 저장소의 문서화 관례 중 상위권.
- **CHANGELOG**: 필드 리네임·필드 제거·에러 코드 정정 세 갈래를 표와 근거로 분리해 "배포 시 확인" 배너까지 갖췄고, 실제 diff(서비스 `error→message`, DTO `latencyMs`/`meta` 제거·`code` 추가)와 1:1로 대응함을 확인했다.
- **예제 코드**: `models{,.en}.mdx` 의 8갈래 문장표는 `sanitize-error.util.ts` 반환 리터럴과 신규 가드(`guide-sanitized-message-parity.test.ts`)로 양방향 대조돼 있어, 예시가 수기 사본으로 낡는 것을 build-time 에 차단한다. `integrations{,.en}.mdx` 의 `MAKESHOP_404` 예시 교체 + 코드 계열 설명도 실제 backend 발행 코드와 일치했다.
- **spec 정합**: `run-results{,.en}.mdx` 의 노드-종류별 코드표가 `spec/5-system/3-error-handling.md §1.4` 카테고리 표(HTTP 미발행 `HTTP_TIMEOUT` 제외까지)와 정확히 일치함을 직접 대조로 확인했다.
- **문서화 갭의 절차적 처리**: `spec/2-navigation/6-config.md` 의 `testConnection` 실패 shape 미문서화, `user-guide-evidence.md §2.1` 관계표 3→5건 갱신 등 `spec/` 소관 갭은 developer 권한 밖이라 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정확히 위임돼 있다(직접 확인) — 위 WARNING 은 이 위임 자체가 아니라 **developer 소유 문서(`PROJECT.md`)에서 같은 성격의 갱신이 빠진 것**을 지적한다.

## 요약

이 PR 은 이미 3라운드의 코드 리뷰·정합성 검토를 거치며 자기 문서화(JSDoc·CHANGELOG·인라인 근거·가드 docstring·plan 트래커)를 매우 촘촘하게 쌓아 왔고, `spec/` 소관 문서 갭은 developer 권한 경계에 맞춰 정확히 planner 백로그로 위임돼 있다. 다만 이번 리뷰에서 새로 확인한 한 가지 — `PROJECT.md` 의 build-time 가드 카탈로그가 이 PR 이 신설한 가드 2건을 누락한 것 — 은 `spec/` 이 아니라 developer 가 직접 쓸 수 있는 문서에서 난 갭이라 이번 PR turn 안에서 바로 닫을 수 있다. 그 외 JSDoc·주석 정확성·MDX 예제·spec 대조는 모두 실측으로 정확함을 확인했다.

## 위험도

LOW
