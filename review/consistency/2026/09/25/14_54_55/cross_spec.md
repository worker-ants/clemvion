# Cross-Spec 일관성 검토 — spec draft: 경로 파라미터 워크스페이스도 가드가 검사, 가드 거부는 코드를 갖는다

대상: `plan/in-progress/spec-draft-workspace-path-guard.md`

## 방법 노트

`_prompts/cross_spec.md` 번들은 예산 초과로 이 draft 가 직접 편집을 겨누는 9개 spec 파일
(`data-flow/12-workspace.md`, `5-system/{1-auth,2-api-convention,3-error-handling,13-replay-rerun}.md`,
`2-navigation/{6-config,9-user-profile}.md`, `conventions/{error-codes,swagger}.md`)을 포함해 대부분의
본문이 **"컨텍스트 예산 초과 — 의도된 절단"** 으로 비어 있었다(`feedback_consistency_spec_mode_budget`
선례와 동일 증상). 번들 대신 워크트리의 실제 `spec/**`·`codebase/backend/src/**` 파일을 직접 읽고,
draft 가 인용하는 원문 문장·코드 경로(`RolesGuard`, `workspaces.controller.ts`, `executions.controller.ts`,
`auth-configs.controller.ts` 등)를 grep/Read 로 대조해 검증했다.

## 발견사항

- **[WARNING]** 정정 대상 Rationale 문단에 새 정정과 모순되는 옛 문장이 그대로 남는다
  - target 위치: draft **C-1 (d)** — `spec/data-flow/12-workspace.md` §Rationale
    「`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증 강도 비대칭」의 "왜 경로 파라미터는
    엄격해도 되는가" 문단 끝에 정정을 **추가**만 하고 원문은 그대로 둔다(draft 도 "원문은 유지" 라고
    명시).
  - 충돌 대상: 같은 파일·같은 문단의 기존 두 번째 문장 — "거기서 400 을 내도 뒤바뀔 인가 응답이
    없다 — **없는 리소스는 어차피 404** 이고, 400 과 404 는 '그 리소스에 접근할 수 있는가' 를 누설하지
    않는다."(`spec/data-flow/12-workspace.md` 393~394행)
  - 상세: draft 가 덧붙이는 정정은 첫 문장("`:id` 는 인가 판정의 입력이 아니라 리소스 지목이다")만
    "워크스페이스 `:id` 에 한해 더는 참이 아니다"로 부정한다. 그런데 바로 다음 문장인 "없는 리소스는
    어차피 404"도 워크스페이스 `:id` 에는 **참이 아니다** — draft 자신의 §A 실측이 그 근거다: 11개
    서비스 메서드 중 9개가 "인가가 먼저"라 `getMemberRole`이 부재 워크스페이스와 비멤버를 구분하지
    못하고 **둘 다 403**(`NOT_A_MEMBER`, 코드 없는 403이 아니게 될 것)으로 응답한다(§A "그래서 인가가
    먼저인 한 존재 오라클이 없다", §B Rationale "부재와 비멤버를 구분하지 않는다"). 즉 워크스페이스
    `:id`에 대해 존재하지 않는 워크스페이스는 이 draft **이전에도, 이후에도** 404가 아니라 403을
    받는다 — "없는 리소스는 어차피 404"라는 근거 문장은 이 draft가 정정 대상으로 삼은 첫 문장과 같은
    정도로 워크스페이스 `:id`에 대해 거짓인데, 정정문은 첫 문장만 짚고 두 번째 문장은 침묵한다. 정정
    뒤에도 문단을 순서대로 읽으면 "리소스 지목이 아니다(정정 인정) → 그런데 없는 리소스는 여전히
    404다(미정정 원문)"라는 내적 모순이 남는다.
  - 제안: 같은 (d) 정정 안에 "없는 리소스는 어차피 404" 절도 함께 한정한다 — 예: "(워크스페이스
    `:id`는 예외 — 부재 워크스페이스도 존재 오라클 없이 403 `NOT_A_MEMBER`로 응답한다. `:memberId`·
    `:invitationId`는 여전히 404.)" 정도로 짧게 보강. C-1(e) "부재와 비멤버를 구분하지 않는다" 절과도
    직접 연결되므로 상호 참조를 붙이면 두 번 흩어진 같은 사실이 한 곳에서 설명된다.

- **[INFO]** "코드를 명시한 자리" 전수 집계(C-9)와 실제 편집 범위가 한 파일만큼 어긋난다
  - target 위치: draft **C-9** `spec/5-system/2-api-convention.md` "전수 방법(Critical 대응)" 단락 —
    "코드를 명시한 자리는 … 여섯이다"(1-auth §1.5.4·13-replay-rerun·6-config §A.4·3-error-handling·
    12-workspace·2-api-convention).
  - 충돌 대상: 같은 draft의 **C-6** `spec/2-navigation/9-user-profile.md` — 워크스페이스 설정 GET 행
    "비-멤버 403" → "비-멤버 403 `NOT_A_MEMBER`" 로 코드를 **추가**한다.
  - 상세: 실제로는 잘못이 아니다 — C-9의 "코드를 명시한 자리"는 **이미 코드가 적혀 있어 가드 이관 시
    stale 해지는 자리**만 센 것이고, C-6은 원래 코드가 **전혀 없던** 자리에 새로 채우는 것이라 census
    모집단이 다르다(방법 자체는 자기충족적). 다만 "전수 방법"이라는 표제가 "코드가 붙는 모든 자리"로
    오독될 위험이 있고, 실제로 이 draft가 코드를 신규로 붙이는 자리(C-6, C-7 일부)는 "전수"가 아니라
    개별 발견에 의존한다 — `2-navigation/`·`5-system/` 전역에서 "역할 게이트된 라우트의 bare 403"을
    체계적으로 훑은 별도 전수는 없다(직접 grep으로 재확인한 결과 이번 케이스는 6-config·9-user-profile
    두 곳 외에 남은 곳은 못 찾았지만, 그 확인이 draft 자체에는 기록돼 있지 않다).
  - 제안: C-9 "전수 방법" 문단에 "이 census는 *기존에 코드가 있어 stale해지는 자리*만 포괄하며, C-6·
    C-7처럼 *새로 코드를 붙이는* 자리는 별도"라는 한 줄 스코프 명시를 더하면 다음 리뷰어가 "전수"라는
    단어로 완전성을 오해하지 않는다.

## 실측으로 반증되지 않은 항목 (참고 — 확인만, 지적 아님)

아래는 cross-spec 관점에서 문제 될 수 있어 보였으나 실제 코드/spec 대조로 draft의 서술이 정확함을
확인한 것들이다(음성 결과도 기록해 다음 검토자가 같은 지점을 또 파지 않도록):

- `1-auth.md §1.5.4` 의 `forbidden` vs 실제 코드 `admin_required` 불일치 — `workspace-invitations.service.ts:541`
  에서 `code: 'admin_required'` 직접 확인. draft C-3의 "지금 spec 은 forbidden, 코드는 admin_required 로
  이미 어긋나 있다" 는 정확하다.
- `error-codes.md §3` 레지스트리의 "별개 코드 … 의도적 분리" 문장이 `workspace_not_found`·`user_not_found`
  두 코드만 지목하고 `admin_required`는 그 문장 범위 밖이라는 draft C-4의 주장 — 원문(76~78행) 대조로
  확인.
- `RolesGuard` 코드 없는 403(`ForbiddenException`, 기본 `FORBIDDEN`) 및 docstring의 "가드 거부에 코드를
  부여하려면 전 경로를 함께 바꿔야 한다(별도 작업)" 문구 — `roles.guard.ts` 원문과 정확히 일치.
- 15곳 경로 바인딩 census(`workspaces.controller.ts`의 13곳 무가드 + `transferOwnership`) · `executions.controller.ts`의
  `re-run`(`@Roles('editor')`) vs `getChain`(`@WorkspaceId()`만) 비대칭 · `auth-configs.controller.ts`의
  5개 라우트 전부 `@Roles('admin')` — 전부 코드 원문과 일치.
- `OWNER_REQUIRED`가 코드·프런트(`workspace/settings/page.tsx`)에는 있으나 spec 카탈로그엔 없다는 C-2의
  주장, `EDITOR_REQUIRED`가 신규(기존 코드베이스에 부재)라는 전제 — grep 결과와 일치.
- WebSocket `FORBIDDEN`(`6-websocket-protocol.md`)이 `RolesGuard`와 무관한 별도 발행 경로라는 C-9의 제외
  판단 — `handleSubscribe` 자체 발행 확인, 정확.
- `spec/data-flow/1-audit.md §2.1`의 `GET /audit-logs`(`@Roles('admin')`) 서술은 명시적 코드를 인용하지
  않아 C-9의 "코드를 명시한 6곳" 밖에 있는 게 맞다(수정 불필요).

## 요약

draft는 이례적으로 근거가 촘촘하다 — 인용하는 모든 spec 원문·코드 라인을 실제 파일과 대조했고 전부
일치했으며, error-codes 레지스트리·swagger 체크리스트·error-handling 카탈로그·replay-rerun 표·
user-profile API 표·config 권한 서술까지 9개 영역의 편집 지점이 실제 원문과 정확히 물린다. Cross-spec
충돌(데이터 모델·API 계약·요구사항 ID·RBAC)로 분류할 CRITICAL은 찾지 못했다. 유일하게 실질적인
지적은 draft가 직접 손대는 `data-flow/12-workspace.md`의 Rationale 문단 안에서, 새로 붙이는 정정이
문단의 앞 문장만 부정하고 뒤 문장("없는 리소스는 어차피 404")은 그대로 남겨 같은 문단 안에 모순이
생기는 것(WARNING) — draft 자신의 §A 실측이 이미 그 반증 근거를 갖고 있으므로 같은 편집 안에서 함께
닫을 수 있다. 나머지 하나는 "전수 방법" 표제의 스코프 명확화를 권하는 INFO 수준이다.

## 위험도

LOW
