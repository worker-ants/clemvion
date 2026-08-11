# Plan 정합성 검토 — spec/5-system/14-external-interaction-api.md §5.5 / plan `spec-sync-external-interaction-api-gaps.md`

## 검토 범위
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 §5.5 관련 체크박스 2건이 `[x]`
로 닫히고 "실측하니 티켓보다 넓었다" 절이 추가된 diff를, target 문서
`spec/5-system/14-external-interaction-api.md` 및 `spec/7-channel-web-chat/3-auth-session.md`
와 대조. `git diff origin/main -- <각 파일>` 로 정확한 변경분을 확인하고, 인용된
`interaction.service.ts` / `interaction.controller.ts` / `spec/data-flow/15-external-interaction.md`
§1.2 / `review/consistency/2026/08/11/11_10_16/cross_spec.md` 를 직접 열어 사실 주장을 대조했다.

## 확인 결과 요약 (지시된 4개 항목)

1. **체크박스 2건 실제 이행 여부 — 이행됨**
   - `spec/5-system/14-external-interaction-api.md` §5.5 응답 블록에 `400
     TOKEN_REFRESH_NOT_IN_WINDOW` / `400 TOKEN_REFRESH_FAILED` / `403
     TOKEN_REFRESH_FORBIDDEN` / `410 EXECUTION_TERMINATED` 가 실제로 추가됐고, §5.1 에러
     코드 표에도 대응 행 3개(400×2·403×1)가 신설되고 기존 `404`/`410` 행에 "§5.5 참조" 각주가
     붙었다(`git diff origin/main` 로 확인).
   - `spec/7-channel-web-chat/3-auth-session.md` §R4 의 "EIA §5.5 본문은 이 분기를 아직 담지
     않는다" 캐비엇 문장이 실제로 제거되고 "`410` 은 복구 불가" 근거 문장으로 교체됐다(diff 확인).
   - 이 저장소 규약("plan 체크박스 = 실제 상태")에 부합한다.

2. **새 절의 사실 주장 검증**
   - (a) "표에는 `410` 이 이미 있었다" — **참**. `git diff` 의 `410 Gone | EXECUTION_TERMINATED`
     행은 `-`/`+` 양쪽에 다 존재(각주만 추가), 원래부터 있던 행이다.
   - (b) "refresh 전용 3종이 표에 하나도 없었다" — **참**. `400 TOKEN_REFRESH_NOT_IN_WINDOW`·
     `400 TOKEN_REFRESH_FAILED`·`403 TOKEN_REFRESH_FORBIDDEN` 3행 모두 diff 의 순수 `+` 라인.
   - (c) "data-flow §1.2 는 이미 맞게 적고 있었다" — **참**. `spec/data-flow/15-external-interaction.md`
     는 이 diff 에서 전혀 변경되지 않았고(`git diff` 무출력), 기존 §1.2 (line 120-122)가 이미
     "`itk_*` 는 403", "만료 30분 이내에만 신규 발급", "terminal execution 은 410" 을 정확히
     서술하고 있었다.
   - "consistency 의 `cross_spec`·`rationale_continuity` 두 checker 가 독립적으로 잡았다
     (`11_10_16`)" 주장도 `review/consistency/2026/08/11/11_10_16/cross_spec.md` 에 실제로
     동일 취지의 WARNING("target 이 인용하는 EIA §5.5 가 `410` 분기를 문서화하지 않음")이 존재해
     확인됨 — 지어낸 이력이 아니다.

3. **잔여 미완 항목(분산 SSE fan-out · `nodeOutput` 키-allowlist)에 대한 영향 — 없음**
   plan 본문에서 이 두 항목은 §5.5/refresh-token 코드와 독립된 별개 리스트 항목이며, 이번
   diff 는 그 항목들의 텍스트·전제를 건드리지 않았다. `pending_plans` frontmatter 도 변경 없이
   그대로 plan 을 계속 참조한다(target 이 `status: partial` 유지와 일치).

4. **plan 이 `in-progress` 로 남는 것이 맞는가 — 맞다**
   `## 미구현 항목` 리스트에 `[ ]` 미해결 항목 2건(분산 SSE fan-out, `nodeOutput` 키-allowlist)이
   여전히 남아 있어 `plan/complete/` 로 이동할 조건을 충족하지 않는다. lifecycle 상 문제 없음.

## 발견사항

- **[WARNING]** target EIA §5.2 "클라이언트 소비(현 단계)" 문단이 이미 닫힌 plan 항목을 "미배선
  (no-op)" 으로 계속 서술 — 형제 spec 문서와도 모순
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.2, "클라이언트 소비(현
    단계)" 콜아웃(428행) — "web-chat 위젯은 이벤트 리스너를 이미 등록했으나 소비 분기는 아직
    미배선(no-op)이라 ··· 이벤트 기반 감지로의 교체는 클라이언트 측 별도 후속이다"
    (`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를 그 후속 근거로 인용).
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §미구현 항목의
    "(후속) web-chat 위젯 클라이언트 소비" 항목 — **완료 (2026-07-17)** 로 이미 `[x]` 처리됨
    (`handleEiaEvent` 에 `execution.replay_unavailable` 소비 분기 추가).
  - 상세: 실제 코드(`codebase/channel-web-chat/src/widget/use-widget.ts:441-454`)에
    `execution.replay_unavailable` 케이스가 존재하고 `seedWaitingFromStatus` 로 재동기화하며,
    로컬 타이머(>5분) 기반 폴백 코드는 더 이상 발견되지 않는다 — plan 의 완료 서술이 코드와
    일치한다. 반면 같은 주제를 다루는 형제 문서 `spec/7-channel-web-chat/1-widget-app.md:104`
    는 이미 "서버 emit·위젯 리스너·소비 분기가 모두 구현됐다" 로 갱신되어 있어, EIA §5.2 만
    홀로 stale 하다 — 이번 diff 가 다루는 "§5.5 만 홀로 stale 했다" 결함과 **같은 클래스**의
    문제가 같은 문서(§5.2)에 이미 존재한다.
  - 제안: 이번 diff 의 범위 밖이라 이 PR 을 막을 이유는 아니지만, `plan/in-progress/
    spec-sync-external-interaction-api-gaps.md` 에 "EIA §5.2 클라이언트 소비 문단 stale" 항목을
    새로 등재하거나, 후속 소규모 patch 로 §5.2 문구를 "구현됨" 으로 갱신할 것을 권장.

- **[INFO]** 신규 §5.5 각주가 참조하는 "§3.3 표" 는 실제로는 §5.1 에러 코드 표를 가리킨다
  (section 번호 오기)
  - target 위치: `spec/5-system/14-external-interaction-api.md` 535행 부근, 신규 콜아웃
    "`410` 을 받은 시점엔 옛 토큰이 이미 무효다" 앞의 "**`410` 은 미존재도 포함한다**" 문단 —
    "(§3.3 표의 `404 EXECUTION_NOT_FOUND` 는 다른 엔드포인트 기준)".
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "실측하니
    티켓보다 넓었다" 절의 "§3.3 에러 코드 표에 하나도 없었다" 문장도 동일 오기를 공유.
  - 상세: 문서 헤딩을 확인하면 `404 EXECUTION_NOT_FOUND` 행이 있는 에러 코드 표는 `### 5.1
    인터랙션 명령 제출` 절 안에 있고, `### 3.3 인증` 은 `EIA-AU-01~08` 요구사항 표(에러 코드
    없음)다. "§3.3 표" 로 지칭하면 독자가 인증 요구사항 표에서 `404 EXECUTION_NOT_FOUND` 를
    찾다가 못 찾는다 — 바로 이 plan 항목이 등재된 계기(`11_10_16` 의 "인용이 가리키는 절이
    반대를 말한다")와 같은 성격의 셀프-레퍼런스 오류가, 그 오류를 고치는 이번 diff 안에 새로
    생겼다.
  - 제안: spec 535행과 plan "실측하니 티켓보다 넓었다" 절의 "§3.3" 를 "§5.1" 로 정정. (같은
    문단의 "Guard 선차단, §3.3 표" 참조(522행 부근)는 인증 매커니즘 일반을 가리키는 느슨한
    참조로 읽을 여지가 있어 이 항목에는 포함하지 않았다.)

## 요약
지시된 4개 확인 항목은 모두 통과한다 — 체크박스 2건은 실제 코드/문서 변경과 정확히 일치하고,
"티켓보다 넓었다" 절의 사실 주장 (a)(b)(c) 는 `git diff`·data-flow 문서·과거 consistency 세션
기록으로 전부 검증됐다. 남은 미완 항목(분산 SSE fan-out, `nodeOutput` 키-allowlist)은 이번
diff 와 무관하며 plan 이 `in-progress` 로 남는 것도 타당하다. 다만 검증 과정에서 부수적으로
두 가지를 발견했다: (1) 이번 diff 가 고친 "§5.5 만 홀로 stale" 과 같은 성격의 stale 서술이
같은 문서 §5.2 클라이언트 소비 문단에 남아 있고 이미 닫힌 plan 항목을 여전히 열린 것처럼
인용한다(WARNING), (2) 신규 §5.5 각주 하나가 실제로는 §5.1 인 에러 코드 표를 "§3.3" 으로
잘못 지칭한다(INFO, self-reference 오기). 둘 다 이번 diff 의 핵심 목적(§5.5 정정)을 막을
사유는 아니다.

## 위험도
LOW

BLOCK: NO
STATUS: OK
