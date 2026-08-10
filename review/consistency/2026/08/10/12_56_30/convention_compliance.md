# 정식 규약 준수 검토 — `spec/7-channel-web-chat/3-auth-session.md`

검토 모드: spec draft (`--spec`)

## 검토 방법 메모

prompt 에 번들된 `spec/conventions/**` 발췌본은 컨텍스트 예산 초과로 거의 전부가 `cafe24-api-catalog/**`
(target 문서와 무관한 영역) 로 채워져 있었고, target 문서가 실제로 인용·의존하는
`swagger.md`·`error-codes.md`·`spec-impl-evidence.md`·`conversation-thread.md`·
`interaction-type-registry.md`·`execution-context.md` 는 본문 헤더만 남고 **잘렸다**
(`review/consistency/…/_prompts/convention_compliance.md` 의 "⚠ 본문 생략됨 — 컨텍스트 예산 초과").
이는 기존에 반복 관측된 harness 결함(`feedback_consistency_spec_mode_budget.md` 계열)과 동형이라,
워크트리 절대경로로 위 6개 규약 원본 + 대응 코드(`codebase/channel-web-chat/src/lib/*.ts`,
`src/widget/use-widget.ts`)를 직접 Read/Grep 하여 대조했다. `spec/conventions/**` 목록 자체
(`ls`)와도 대조해 번들에 없던 파일이 실재함을 확인했다.

## 발견사항

- **[CRITICAL] frontmatter `status: implemented` 가 본문이 스스로 인정한 미구현 표면과 모순**
  — `spec-impl-evidence.md §3` 직접 위반
  - target 위치: frontmatter (L2 `status: implemented`) vs 본문 `### 3.1 재로드 복원 시퀀스` 상단 경고 박스
    (L85) 및 2단계 세부 분기(L92–104)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (`status` 라이프사이클) — "`implemented`: 모든
    약속 구현 완료" / "`partial`: 일부 구현됨 — `pending_plans:` **의무**"
  - 상세:
    - §3.1 상단 경고 박스가 명시한다 — "**`404`·복구불가 `401` REST 분기와 `401 → 낙관적 refresh 1회`
      는 여전히 미구현(Planned)** — 그 외 status·오류는 `catch` soft-fail 후 SSE 로 진행한다. 이 잔여
      REST 오류 분기·낙관적 refresh 완전 구현은 후속 결정으로 남긴다." 반면 바로 아래 2단계 절차는
      이 미구현 분기를 **현재형 규범 문장**("...시도 → 성공 시 SSE 재연결로 복원, 재차 `401` 이면 종료로
      간주")으로 서술해, 같은 절 안에서 "아직 없다"와 "이렇게 동작한다"가 공존한다.
    - 코드로 직접 확인: `codebase/channel-web-chat/src/widget/use-widget.ts` 의 `seedWaitingFromStatus`
      (L480–542)는 `client.getStatus()` 를 단일 `try/catch` 로 감싸고, catch 블록은 상태 코드를
      구분하지 않는 generic soft-fail(`console.warn` 후 `"continue"` 반환)만 수행한다. `eia-client.ts`
      의 `getStatus()`(L95–102) 도 `410` 만 특별 처리하고 `404`/`401` 은 동일한 `EiaError` 로 뭉뚱그린다.
      즉 §3.1 이 서술하는 "`404 EXECUTION_NOT_FOUND` → storage 정리 후 `[ended]`" 분기와
      "`401` → 낙관적 `refresh-token` 1회" 분기는 **코드에 존재하지 않는다** — 박스 서술이 정확하다.
      (`200`+terminal 종료 분기만 L503–506 `if ((TERMINAL_EVENTS...).includes(...))` 로 실제 구현돼 있고,
      박스도 이 부분만 "구현됨"으로 정확히 구분한다.)
    - `spec-impl-evidence.md §3`: `status: implemented` 는 "모든 약속 구현 완료" 를 의미하며, 일부만
      구현된 경우 `partial` + `pending_plans:`(의무 필드, §2.1/§4)를 요구한다. 현재 frontmatter 에는
      `pending_plans:` 가 없고(=`implemented` 선언과 정합), 정작 본문은 v1 잔여 갭을 "목표 계약이며
      완전 구현은 후속 결정" 이라고 명시한다 — 즉 "구현을 아직 책임지는 plan 이 없는 빈 약속" 상태다.
      이는 `spec-impl-evidence.md` 의 Overview/§Rationale R-5 가 명시적으로 막으려는 실패 유형과
      정확히 같은 모양이다("spec 가 plan 을 가리키지 않아 '어떤 plan 도 책임지지 않는 빈 약속' 으로
      영구 누락" — 텔레그램 chat-channel 케이스).
    - **이 자리는 신규 발견이 아니다.** `git log -S "미구현(Planned)"` 로 추적하면 2026-07-05 커밋
      `6b25ccc3e`("docs(spec): cross-audit V-13 하향·V-18 보류…") 가 바로 이 갭을
      **"초기 '정합 종결' 오판을 consistency-check CRITICAL 이 정정"** 했다고 커밋 메시지에 직접
      기록하며 경고 박스를 추가했다 — 그러나 그 시점 조치도 `status` 를 그대로 `implemented` 로 두고
      본문에 캐비엇만 달았다. 이후 1개월 넘게(오늘 08-10 커밋 `24d7a0760` 까지) `status` 는 계속
      `implemented` 로 유지된 채, "구현됨" 으로 승격된 부분(200+terminal)과 "미구현" 으로 **남은
      부분(404/401/refresh)** 이 계속 공존한다 — 즉 한 번 CRITICAL 로 지적된 뒤 문서화만 되고
      frontmatter 규약 위반 자체는 해소되지 않았다.
    - `plan/in-progress/**` 전수 검색(`낙관적 refresh|401.*refresh|재로드.*401`) 결과 이 잔여 갭을
      추적하는 `plan/in-progress/*.md` 가 **현재 없다**(매칭되는 것은 전부 `plan/complete/**`의
      과거 spec-draft 산출물). 인접한 `plan/in-progress/webchat-command-failure-is-not-termination.md`
      는 §3.1-3 storage 정리 조건을 다루지만 이 REST 분기 구현 자체를 책임지지 않는다.
  - 제안: 아래 둘 중 하나로 규약 정합을 회복한다.
    1. **frontmatter 를 `partial` 로 낮추고 `pending_plans:` 를 신설** — 잔여 REST 분기(404/복구불가
       401/낙관적 refresh) 구현을 추적할 `plan/in-progress/<name>.md` 를 만들어 가리킨다. `status`
       라이프사이클 §3 이 요구하는 정확한 조합이며, 향후 세션이 "빈 약속" 을 다시 놓치지 않게 한다.
    2. **v1 영구 축소 결정이면(구현 의도 없음)** §3.1 본문의 404/401/refresh 절차를 현재형 규범 문장
       ("...한다")에서 명확한 "목표(v2) 설계이며 현재는 미적용" 톤으로 다시 쓰고, `status: implemented`
       가 정당화되도록 "약속"의 경계 자체를 좁힌다(=지금 문서가 실제로 보장하는 것만 §3.1 로 남기고
       나머지는 별도 "향후 설계" 절로 분리). 이 경우도 `pending_plans:` 없이 `implemented` 를 유지하려면
       본문에 정상 동작으로 서술된 문장이 남아 있으면 안 된다 — 지금처럼 "구현됨" 캐비엇과 "미구현"
       캐비엇이 같은 절 안에 있는 상태는 두 옵션 어느 쪽도 아니다.
    이번 라운드에서 굳이 조치하지 않더라도, 최소한 이 gap 을 추적할 plan 링크를 남기지 않는 현재
    상태는 규약이 명시적으로 금지하는 조합("일부 미구현" + "누구도 책임지는 plan 없음")이라는 점만은
    이번 검토로 재확인해 기록해 둔다.

- **[INFO] Rationale 항목 번호가 `R3`부터 시작(`R1`/`R2` 없음)**
  - target 위치: `## Rationale` 첫 항목 `### R3. 토큰 전략 — per_execution 단일`
  - 위반 규약: 없음 — CLAUDE.md/SKILL.md 가 요구하는 것은 "Overview / 본문 / Rationale" 3섹션
    구성뿐이고 Rationale 항목의 연속 번호 규칙은 어떤 `spec/conventions/*.md` 에도 없다
    (`plan/in-progress/webchat-spec-rationale-followup.md` 의 실측: `§N.N`/`§N`/`§RN` 표기가
    이미 수렴한 관행이나 이를 정식 규약으로 명문화할 자리(`spec/conventions/`)가 아직 없다고 그
    plan 자체가 명시).
  - 상세: 동일 영역의 `2-sdk.md` 는 `R2`부터, `1-widget-app.md` 는 `R4`부터 시작하는 등 `7-channel-web-chat/`
    전체가 같은 패턴(리비전 중 항목 이동/병합으로 번호가 남음)이라 본 target 만의 편차가 아니다.
    직전 회차(2026-08-10 12:06 세션)가 `2-sdk.md` 에 대해 이미 동일 판정(비위반)을 내렸다 — 본
    target 에도 같은 근거가 그대로 적용된다.
  - 제안: 규약 위반이 아니므로 수정 의무 없음. 가독성 개선을 원하면 "R1/R2 는 다른 절로 흡수·삭제됨"
    각주 정도가 선택지.

## 점검 관점별 확인 내역 (위 CRITICAL 외 위반 없음 확인)

1. **명명 규약**
   - `id: web-chat-auth-session` — kebab-case, `spec-impl-evidence.md §2.1` 준수. basename(`3-auth-session`)
     과 다르지만 동일 영역 형제 문서 전부(`web-chat-architecture`/`web-chat-sdk`/`web-chat-widget-app`/
     `web-chat-security`/`web-chat-admin-console`)가 `web-chat-*` 접두를 동일하게 쓰는 영역 전체의
     의도된 패턴 — 위반 아님.
   - 에러 코드 `EXECUTION_NOT_FOUND` — `error-codes.md §1` `UPPER_SNAKE_CASE` 준수. EIA 식별자
     표기(`EIA-IN-12`, `EIA-AU-04`, `EIA-RL-07`)도 해당 spec 문서 내부 표기 관례와 일치.
   - `Authorization: Bearer iext_*` — `swagger.md §2-1` 이 등록한 `interaction-token` Bearer scheme
     (`iext_<JWT>`/`itk_<opaque>`)과 정확히 일치.

2. **출력 포맷 규약**
   - `202 { data: { executionId, status, interaction: {...} } }` / `GET .../embed-config → { data: {...} }`
     — `swagger.md §2-5`(TransformInterceptor `{ data }` 래핑) 및 §Rationale "§5 ApiOkPaginatedResponse
     single-wrap" 서술과 정합. SSE 프레임은 언랩 비대상이라는 R5 서술도 swagger.md §1-4/§2-5 의
     "SSE 는 인터셉터를 거치지 않는다" 전제와 일치.
   - R5 의 `interact` ack(`InteractAckDto` `{ executionId, accepted, currentStatus }`) 서술 — swagger.md
     §5-2 `ApiAcceptedWrappedResponse` 패턴과 정합(단일 객체 202).
   - §3.1 의 `context.conversationThread` 열거(`turns[]`/`source`/`totalChars`/`nextSeq`) — 실제
     `conversation-thread.md §1.2/§1.3` 필드 정의와 대조해 정합. 별도 DTO 로 재선언하지 않고 열린
     object 로 위임하는 것도 `swagger.md §1-4` "SoT 이중화 회피" 예외 사유와 정합.

3. **문서 구조 규약**
   - Overview / 본문(§1–§3.1) / Rationale(§R3–§R8) 3섹션 구성 — CLAUDE.md·SKILL.md 의 권장 구조 준수.
   - frontmatter 스키마(`id`/`status`/`code`) — `spec-impl-evidence.md §2` 형식 자체는 유효(키 구성·타입
     모두 정상). `code:` 5개 경로(`session-store.ts`/`api-base.ts`/`eia-client.ts`/`use-widget.ts`/
     `use-token-refresh.ts`) 전부 실존 파일로 확인 — `status ∈ {partial, implemented}` 의 "≥1 매치"
     요건은 형식적으로 충족(단, 위 CRITICAL 이 지적하는 것은 형식이 아니라 `status` **값** 자체의 정합성).

4. **API 문서 규약**
   - 본 문서는 위젯(소비자) 관점 spec 이라 `@nestjs/swagger` 데코레이터·DTO 를 직접 선언하지 않음 —
     `swagger.md` 는 본문이 인용하는 백엔드 계약(§2-5/§5/§1-4)의 정합성 확인 대상으로만 적용했고
     위반 없음.

5. **금지 항목**
   - `error-codes.md §1` "클라이언트는 코드의 의미로 분기하며 이름 부분 문자열을 파싱하지 않는다" —
     본문 어디서도 에러 코드 문자열을 파싱하는 로직을 규정하지 않음.
   - `swagger.md §1-4` "닫힌 union 을 `additionalProperties` 로 뭉개지 않는다" — 본 문서는 DTO 를
     선언하지 않으므로 비대상.

## 요약

핵심 발견은 1건 CRITICAL이다 — frontmatter `status: implemented` 가 본문 §3.1 이 스스로 명시한
"404·복구불가 401 REST 분기·401 낙관적 refresh 는 미구현(Planned)" 과 직접 모순하고, 코드
(`use-widget.ts`/`eia-client.ts`)로도 미구현이 확인된다. 이는 `spec-impl-evidence.md §3` 의
`implemented`/`partial` 정의를 정면으로 위반하며, 공교롭게도 이 컨벤션이 막으려는 정확한 실패
유형("plan 이 책임지지 않는 빈 약속")과 형태가 같다. 2026-07-05 에 한 번 CRITICAL 로 지적된 뒤
문서화(경고 박스)만 되고 frontmatter 자체는 1개월 넘게 정정되지 않은 채 남아 있다 — 재발이 아니라
**미해소 잔존**이다. 그 외 명명·출력 포맷·문서 구조·API 문서 규약 관점에서는 위반이 확인되지 않았고,
Rationale 번호가 R3 부터 시작하는 점은 영역 전체의 기존 관행이라 INFO 로만 남긴다.

## 위험도

HIGH
