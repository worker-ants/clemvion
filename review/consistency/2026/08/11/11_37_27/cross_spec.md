# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat` (impl-done)

## 직전 라운드(`11_10_16`) WARNING 처분 검증

**대상**: `3-auth-session.md §3.1`/`§R4` 가 "재차 `401`·`410` 이면 종료" 의 근거로 EIA §5.5 를
인용했는데, §5.5 본문이 `410` 을 문서화하지 않는다는 지적.

**처분**: 인용을 코드 SoT(`interaction.controller.ts` 의 `@ApiGoneResponse`)로 교체하고, EIA
본문 갭을 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 새 섹션(`§5.5 가
410... 을 담지 않는다`, 2026-08-11 등재)으로 분리 등재.

**검증 결과 — 충분하다고 판정**:

1. **코드 인용이 정확하다** — `codebase/backend/src/modules/external-interaction/interaction.controller.ts:149`
   에 실제로 `@ApiGoneResponse({ description: 'EXECUTION_TERMINATED' })` 가 `refreshToken` 메서드
   바로 위에 있고, `interaction.service.ts` 의 `refreshToken()` 이 `TERMINAL_STATUSES.has(execution.status)`
   일 때 `GoneException({ error: { code: 'EXECUTION_TERMINATED', ... } })` 를 던진다(라인 252-259).
   draft 가 인용한 심볼·라인 모두 워킹트리 코드와 정확히 일치한다.
2. **`410` 이 시스템 전역 컨벤션과 정합한다** — `spec/5-system/3-error-handling.md:167` 이 이미
   `EXECUTION_TERMINATED | 410` 을 카탈로그에 등재해 뒀고, `spec/5-system/14-external-interaction-api.md`
   §5.1(EIA-IN-12)·§3.2 도 "종료된 execution 에 대한 명령은 `410 Gone`" 을 이미 요구사항으로
   못박아 뒀다 — `refresh-token` 의 `410` 은 **새 상태 코드를 들여오는 것이 아니라** 기존
   EIA-IN-12 원칙을 한 endpoint 더 적용한 것뿐이다. cross-spec 관점에서 신규 모순이 아니다.
3. **독립된 제3의 spec 영역이 이미 같은 사실을 문서화하고 있었다** — `spec/data-flow/15-external-interaction.md:120-122`
   ("refresh-token: `POST /:id/refresh-token` 은 `iext_*` 만 대상(`itk_*` 는 403)... **terminal
   execution 은 410**.") 이 이번 라운드 이전부터 이미 `410` 을 명시하고 있다. 즉 `5-system/14
   §5.5` 본문만 뒤처진 outlier였고, `data-flow/15` 는 처음부터 정합했다. 이는 draft 의 새 서술이
   **다른 spec 영역과 충돌하는 게 아니라 오히려 그 영역과 일치**함을 강하게 뒷받침한다.
4. **갭 등재 문서 자체도 정확하다** — `spec-sync-external-interaction-api-gaps.md` 의 새 섹션이
   인용하는 라인 번호·심볼이 실제 코드와 일치하고, 체크리스트("§5.5 에 410 응답 추가" · "R4
   caveat 제거")가 실행 가능한 후속 작업으로 남아 있다.

**결론**: 이 처분은 draft 를 SoT 를 code(사실)로 정확히 재정박시켰고, EIA §5-system/14 본문의
소유 갭은 정직하게 별도 문서로 밀어냈다. 재작업 불요.

## 발견사항

- **[WARNING]** `1-widget-app.md §3.1` 상태표가 `refresh-token` 의 `410` 을 반영하지 않음(오래된 서술)
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md §3.1`/`§R4` (2026-08-10 갱신분)
  - 충돌 대상: `spec/7-channel-web-chat/1-widget-app.md` §3.1 상태 전이표, "토큰 만료/서버 타임아웃" 행
    (`git blame` 상 2026-07-11 최종 수정 — 이번 라운드 대상 밖)
  - 상세: `1-widget-app.md` 는 "`410 Gone` 은 *명령*(interact/cancel) 응답 전용이라 상태조회엔
    안 나타남" 이라 적는다. 이번 라운드에서 `3-auth-session.md` 가 `refresh-token` 도 종료된
    execution 에 `410` 을 낸다는 사실을 code SoT 로 명문화했는데(§3.1-2, §R4), `1-widget-app.md`
    의 이 괄호 예시 목록에는 `refresh-token` 이 없다. **다만 기능적 모순은 아니다**:
    (a) 이 표 행 자체가 "재로드 상태 분기 SoT = `3-auth-session §3.1`" 이라고 명시적으로
    위임하고 있어 독자가 실제 분기 로직을 오인할 가능성은 낮고, (b) `3-auth-session.md` 자신도
    `EIA-IN-12` 를 인용할 때는 `(interact)` 로 정확히 좁혀 쓴다(§3.1-2, "EIA-IN-12 의 `410
    Gone`은 명령(interact)에 대한 응답 전용" — 이건 GET 상태조회와의 대조용이라 정확함).
    `1-widget-app.md` 쪽만 예시 나열이 불완전한 채로 남아 있다.
  - 제안: `1-widget-app.md §3.1` 의 해당 괄호를 "명령(interact/cancel/refresh-token)" 으로
    갱신하거나, EIA-IN-12 인용 없이 "명령 계열 endpoint" 로 일반화해 향후 endpoint 추가 때마다
    예시 목록을 손대지 않게 한다. CRITICAL 아님 — SUMMARY 기록만으로 충분, 이번 턴에서
    spec/code 수정 불요.

- **[INFO]** 갭 추적 문서에 `data-flow/15` 상호 참조를 추가하면 향후 감사가 빠르다
  - target 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"§5.5 가 410... 을 담지 않는다"
  - 충돌 대상: `spec/data-flow/15-external-interaction.md:120-122`
  - 상세: 위 §"직전 라운드 WARNING 처분 검증" 항목 3 에서 확인했듯 `data-flow/15` 는 이미 `410`
    을 정확히 서술하고 있다. 갭 문서가 "EIA §5.5 본문만 갱신하면 된다" 는 인상을 주는데,
    `data-flow/15` 를 근거로 곁들이면 "이미 다른 영역은 맞았다" 는 사실이 명시돼 리뷰 부담이
    준다. 순수 명명/상호참조 보강 — 필수 아님.

## 요약

이번 검토의 핵심 질문 — 직전 라운드 WARNING("§R4 가 인용한 EIA §5.5 가 `410` 을 문서화하지
않는다") 처분이 충분한가 — 에 대해 **충분하다**고 판정한다. 인용을 코드 SoT 로 바꾼 것이
`interaction.controller.ts`/`interaction.service.ts` 실제 코드와 정확히 일치하며, `410` 자체는
시스템 전역 에러 카탈로그(`3-error-handling.md`)와 EIA 자신의 EIA-IN-12 요구사항이 이미 정의해
둔 상태 코드라 새 모순을 들여오지 않는다. 더 나아가 `spec/data-flow/15-external-interaction.md`
가 이번 라운드 이전부터 독립적으로 같은 사실("refresh-token 의 terminal execution 은 410")을
서술하고 있어, draft 의 신규 서술이 다른 spec 영역과 **오히려 정합**함을 재확인했다. 이번
diff(`codebase/channel-web-chat` 프런트엔드 전용, `isTerminalAuthError`/`redactToken`/
`applyRefreshedToken`/재시도 백오프)는 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC·계층
책임 어느 축에서도 다른 spec 영역과 새로운 CRITICAL 모순을 만들지 않는다. 유일한 잔여 항목은
`1-widget-app.md §3.1` 표의 오래된(2026-07-11) 괄호 예시가 이번에 새로 명문화된 `refresh-token`
의 `410` 사례를 아직 나열하지 않는 것인데, 그 행 자체가 실제 분기 SoT 를 `3-auth-session.md`
로 명시 위임해 두고 있어 기능적 오독 위험이 낮다 — WARNING 으로 기록하고 코드/spec/plan 은
변경하지 않는다(이번 라운드 지시대로 게이트 루프를 닫기 위해 SUMMARY 기록에 그친다).

## 위험도

LOW

STATUS=success ISSUES=2 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-small-followups/review/consistency/2026/08/11/11_37_27/cross_spec.md RESET_HINT=
