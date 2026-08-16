# Plan 정합성 검토 — spec-draft-eia-error-masking-catalog.md (재검토, 14_04_55 후속)

## 발견사항

- **[INFO]** 선행 plan(`eia-terminal-error-sanitize.md`)이 이미 머지됐는데 체크리스트·위치가 stale
  - target 위치: frontmatter `pending_plans: - plan/in-progress/eia-terminal-error-sanitize.md` /
    Overview("#1177 이 ... 넣었다. **구현은 끝났는데** ...")
  - 관련 plan: `plan/in-progress/eia-terminal-error-sanitize.md` 체크리스트 마지막 항목
    (`- [ ] push 게이트 통과 → PR`, 181행)
  - 상세: `git log --oneline -- plan/in-progress/eia-terminal-error-sanitize.md` 로 실측하면
    해당 작업은 커밋 `107c8038f`(`#1177`, 2026-08-16 14:03)로 이미 origin/main 에 머지됐다
    (현재 브랜치가 origin/main 과 동일 커밋을 포함). 그런데 plan 파일 자체는 여전히
    `plan/in-progress/` 에 있고 마지막 체크박스(`push 게이트 통과 → PR`)가 `[ ]` 미체크 상태다.
    target 의 Overview 는 "구현은 끝났다" 고 정확히 서술하는데, 그 근거 plan 문서는 스스로
    "아직 안 끝났다" 는 표식(미체크 + `in-progress/` 위치)을 달고 있어 문서 간 상태가 어긋난다.
    이 문서 자체가 이미 지적한 동형 사례(`eia-terminal-emit-facade.md` 체크리스트 stale,
    #1174 머지 후 미갱신)와 같은 패턴이다.
  - 제안: target 의 필수 작업은 아니나(§6.4/R17 카탈로그 반영과는 독립), 같은 세션에서 함께
    닫는 편이 값싸다 — `eia-terminal-error-sanitize.md` 마지막 체크박스를 `[x]` 로 갱신하고
    `plan/complete/` 로 이동. 하지 않는다면 최소한 target 의 "트래커 3곳 동기화" 조치 항목에
    "선행 plan 자체의 완료 표식은 별건" 이라고 한 줄 남겨 다음 사람이 다시 헷갈리지 않게 한다.

- **[INFO]** §R17 신설 불릿의 R-5 인용이 여전히 열려 있는 I1 결정의 한쪽 논거를 미리 배제한다
  - target 위치: 변경안 ① §R17 5번째 불릿의 "내부 REST 와의 비대칭은 아직 미결이다" 하위 항목,
    괄호 안 `14-execution-history.md R-5` 인용부
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` I1
    ("의도된 비대칭이면 R17 의 `llmCalls` 선례처럼 caveat 로 명시하고, 아니면 REST 에도 적용을
    검토한다 — **둘 중 하나를 고르는 것이 이 항목이다**")
  - 상세: `14_04_55` 라운드가 CRITICAL 로 잡았던 "미결 결정을 조용히 확정" 문제 자체는 해소됐다
    — 현재 draft 는 결론을 내리지 않고 "이 문서는 그 사실만 기록하고 어느 쪽이 옳은지는 정하지
    않는다" 라고 명시적으로 선을 긋는다(실측 확인, target 본문 90~96행 상당). 다만 바로 이어지는
    괄호가 `spec/2-navigation/14-execution-history.md` R-5(`"안전성은 롤 게이팅이 아니라 서버
    boundary masking parity 에 의존"`, 실측 확인 — 원문과 정확히 일치)를 근거로 **"내부라서
    원문이어도 된다" 는 결론은 성립하지 않는다** 고 못박는다. 이는 I1 의 두 선택지 중 "의도된
    비대칭(내부는 원문 유지)" 쪽의 가장 자연스러운 정당화를 사실상 미리 무너뜨리는 논증이라,
    이 문장이 **영구 spec 본문**(§R17)에 실리면 향후 I1 을 실제로 결정할 사람에게 "이미 절반은
    답이 나와 있다" 는 인상을 줄 수 있다. R-5 인용 자체는 기존 spec 문구를 정확히 옮긴 것이라
    허위는 아니고, "사실 기록" 원칙에서 완전히 벗어난 것도 아니다 — 다만 이 세션이 같은 문서에서
    이미 한 번 "미결 결정을 조용히 확정할 뻔했다" 고 자인한 만큼 재확인 가치가 있다.
  - 제안: 필수 수정은 아니나, `--spec` 재검토 시 이 괄호가 "결정하지 않는다" 는 바로 앞 문장과
    긴장 없이 읽히는지 한 번 더 확인할 것. 필요하면 "이 논증도 I1 결정 시 함께 검토할 재료"
    정도로 한 단계 낮추는 문구를 덧붙이는 편이 안전하다.

## 확인했으나 문제 없음 (14_04_55 대비 정정 검증)

- `14_04_55` CRITICAL #1(인용 오류 — `execution.ai_message` 불릿을 반대로 인용해 I1 을
  암묵적으로 확정)은 해소됐다. 현재 draft 는 그 인용을 뺐고, I1 을 열어 둔 채
  `spec-sync-external-interaction-api-gaps.md` 로 명시적으로 포인터만 남긴다.
- `14_04_55` CRITICAL #2(§6.4 캐비엇의 `[§R17](#r17-…)` 미완성 앵커 — build 가드 위반)도
  해소됐다. 현재 draft 는 plain-text `§R17` 참조로 낮춰 anchor 의존을 제거했다(실측: 대상
  블록에 markdown 링크 문법 없음).
- `14_04_55` WARNING #1(트래커 체크박스 동기화 계획 누락)도 해소됐다. 현재 draft 의 체크리스트에
  "spec 반영 후 트래커 3곳 동기화 ... `spec-sync-external-interaction-api-gaps.md` 의 W1 은
  체크하고 I1 은 열어 둔다, `eia-terminal-error-sanitize.md` 후속 첫 항목도 체크" 가 명시됐고,
  frontmatter `pending_plans` 에도 `eia-terminal-error-sanitize.md` 가 추가됐다(실측 확인).
- `14_04_55` WARNING #2(§R17 신설 불릿 표제가 3번째 불릿과 `error` 토큰을 공유해 혼동 소지)도
  해소됐다. 현재 표제가 이벤트명(`execution.failed`)·DB 컬럼명(`Execution.error`)·"3번째 불릿의
  `outputData` 기반 `error` 와 다른 컬럼" 을 표제 자체에 명시한다.
- §R17 신설 불릿 삽입 위치("3번째 불릿 뒤, `nodeOutput` allowlist 불릿 앞")는
  `spec/5-system/14-external-interaction-api.md:1441~1457` 실측과 정확히 일치한다(현재 불릿은
  4개뿐이고 순서도 target 서술과 같다).
- §6.4 캐비엇 삽입 대상("두 인용 블록: `code` nullable / `error` 전 경로 object")도
  `spec/5-system/14-external-interaction-api.md:791~806` 실측과 일치한다.
- target 이 인용하는 사실 근거(`getStatus` 의 `error` 는 `stripAndRedact(execution.outputData)`
  — `interaction.service.ts:454`, `GET /api/executions/:id` 는 `execution.error ?? null` 원문 —
  `executions.service.ts:862`)를 코드로 직접 대조해 정확함을 확인했다.
- target 이 respect 하는 미해결 항목(I1 — 내부 REST/WS 비대칭, "잔여 갭" — 자격증명 없는
  연결 문자열, `interaction.triggerToken` SecretResolver 미경유)은 모두 target "범위 밖"
  절 또는 체크리스트에서 명시적으로 열어 둔 채이며, target 이 이 셋 중 어느 것도 일방적으로
  결정하지 않는다 — 충돌 없음.
- 같은 worktree 의 자매 spec-draft(`spec-draft-eia-62-waiting-payload.md`,
  `spec-draft-eia-notification-payload-contract.md`)는 §6 도입부·§6.2 봉투 등 다른 절을 다루며
  target 의 §R17/§6.4 삽입 지점과 겹치지 않는다(둘 다 spec 반영 완료 상태 — 실측).

## 요약

`14_15_45` 시점의 target 은 직전 `14_04_55` 라운드가 낸 CRITICAL 2건 + WARNING 2건을 전부
실측 가능한 형태로 해소했다 — 미결 트래커 항목(I1)을 더 이상 암묵적으로 확정하지 않고,
anchor placeholder 를 제거했으며, tracker 체크박스 동기화 절차와 `pending_plans` 를 보강했다.
새로 발견된 것은 차단급이 아니라 INFO 2건뿐이다: (1) target 이 전제로 삼는 선행 plan
`eia-terminal-error-sanitize.md` 자체는 이미 머지됐는데 그 plan 문서의 체크박스·위치가
still `in-progress` 로 stale 하고, (2) §R17 신설 불릿의 R-5 인용이 "결정하지 않는다" 는
선언 바로 옆에서 I1 의 한 선택지를 사실상 배제하는 논증을 담고 있어 재확인 가치가 있다.
둘 다 target 의 핵심 변경안(§R17 5번째 불릿·§6.4 캐비엇)을 막을 사유는 아니다.

## 위험도
LOW
