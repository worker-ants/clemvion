# Rationale 연속성 검토 — `spec/7-channel-web-chat/3-auth-session.md`

## 검토 방법 메모

번들 프롬프트(`_prompts/rationale_continuity.md`)는 target 이 직접 참조하는 4개 spec —
`spec/5-system/14-external-interaction-api.md`, `spec/5-system/12-webhook.md`,
`spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/4-security.md` —
의 본문을 **컨텍스트 예산 초과로 전부 절단**했다(prompt 상 명시). 이 4개는 target 의 Overview·
본문·Rationale 전체가 가장 밀접하게 의존하는 문서라 번들 누락 상태로는 판정이 불가능해,
`Read` 로 직접 원문을 열어 대조했다(`spec/5-system/14-external-interaction-api.md` §R4·R16·R17·
R-replay-unavailable·R19, `spec/5-system/12-webhook.md` §3.1·Rationale, `spec/7-channel-web-chat/
1-widget-app.md` 전문, `spec/7-channel-web-chat/4-security.md` 전문). 또한 target 파일의 최근
커밋 이력(`git log`/`git show`)으로 §R7 의 당일(2026-08-10) 변경 배경을 확인했다.

## 발견사항

- **[INFO]** §R7 "표면 되감기 방어" 최근 개정은 모범적인 Rationale 갱신 사례 — 문제 아님
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §R7 (라인 155~186)
  - 과거 결정 출처: 동일 문서 §R7 자신(commit `24d7a0760`, 2026-08-10 당일)
  - 상세: 직전 버전은 "이중 스트림은 **호출부**의 짝 가드가 막는다 / 호출부가 스트림 열기 직전에도
    재확인한다"였으나, 오늘 커밋에서 "**스트림 열기 진입 자체**에서 소유권을 재확인"하는 구조로
    번복됐다. 이는 사전 통지 없는 무근거 번복이 아니라 — (a) 실제 리팩터(코드가 `code:` frontmatter
    로 `use-widget.ts` 를 evidence 로 삼는데 산문이 옛 구조를 서술해 spec-drift 상태였음을
    `ai-review` 가 지적) 를 문서에 반영한 것이고, (b) 새 blockquote 에 "종전엔 호출부 2곳에 손으로
    복제돼 있었다 → 3번째 진입점이 생기면 잊혀지는 재발 패턴 → 열기 진입으로 옮겨 구조적으로
    강제" 라는 **명시적 새 Rationale**을 동반한다. 점검 관점 3("결정의 무근거 번복")의 요건인
    "번복 시 새 Rationale 동반"을 정확히 충족하는 사례다.
  - 제안: 조치 불필요. 다만 이 패턴(가드를 호출부 복제 → 단일 진입점 강제)이 다른 web-chat 표면
    (예: `use-token-refresh.ts` 의 유사 재확인 로직)에도 있다면 동일 원칙 적용 여부를 코드 리뷰
    단계에서 확인할 가치는 있다(본 checker 범위 밖).

- **[INFO]** 번들 예산 초과로 최인접 spec 4건이 자동 검토에서 누락 — 수동 보완으로 문제 없음 확인
  - target 위치: 전체 문서(특히 Overview·§1·§2·§3.1·R3·R4·R5·R6)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md`(§R4 per_execution default,
    §R16 ack body, §R17 conversationThread 노출, §R-replay-unavailable, §R19 idle-wait),
    `spec/5-system/12-webhook.md`(§3.1 envelope, WH-SC-01), `spec/7-channel-web-chat/1-widget-app.md`
    (§R6 eager-start, §R9 coalesce/cancel), `spec/7-channel-web-chat/4-security.md`(§R1~R6)
  - 상세: 직접 대조한 결과 target 의 모든 교차 인용(§R3↔EIA§R4, §R5↔webhook§3.1, §R6↔EIA§R19/
    widget-app§R9, §R8↔4-security §"저장 세션의 발급-origin 바인딩")이 원본과 정합했고, 기각된
    대안 재도입이나 원칙 위반은 발견되지 않았다. 다만 이는 `--spec` 모드 예산 문제(기존 프로젝트
    메모리에도 기록된 이슈: "consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다")의
    반복 사례이며, 매번 수동 보완에 의존하는 것은 취약하다.
  - 제안: 본 checker 자체의 조치 사항은 아니나, orchestrator/번들러 쪽에서 target 문서가 frontmatter
    `> 관련:` 으로 명시 링크한 문서는 예산 우선순위를 최상위로 고정하는 방안을 고려할 만하다(이미
    알려진 백로그 항목일 가능성 높음 — 중복 등록 불필요, 참고용 기록만).

검토한 교차 인용 중 반증되지 않은 것들(참고, 발견사항 아님): §R3(per_execution 단일)↔EIA §R4
"per_execution 을 default 로"는 근거·문구가 완전히 일치. §R4(재로드 401 낙관적 refresh)는
EIA-AU-04(jti blacklist) invariant 를 우회하지 않고 그 안에서 동작을 설명. §R5(`{ data }` 언랩)는
webhook §3.1 이 실제로 명시한 `TransformInterceptor` 래핑과 일치하며 `interact` ack 비소비 서술도
EIA §R16 정정 이력과 모순 없음. §R6(sessionStorage)의 EIA-RL-07 backstop 인용은 EIA §R19 원문과
일치. §R8(apiBase 바인딩)은 4-security.md 의 대응 표 행·위협축 문단과 상호 참조가 양방향으로
정합. §2 의 "boot config 에 인증 토큰 필드를 두지 않는다"는 2-sdk.md §4 `BootConfig` 주석과
일치. §1 의 `auth_config_id IS NULL`·V066 cleanup 인용은 실제 마이그레이션 파일
(`V066__trigger_config_strip_inline_auth.sql`)과 webhook.md 본문 서술이 존재해 조작된 이력이 아님을
확인.

## 요약

`spec/7-channel-web-chat/3-auth-session.md` 는 기각된 대안(예: per_trigger 채택, boot 세대 비교
가드, 항상-종료/항상-refresh 단순화, fail-open 세션 복원, 경로까지 지우는 origin 정규화 등)을
각 Rationale 항목(§R3~§R8)에서 명시적으로 나열하고 왜 기각했는지 근거를 남기는 형태로 매우
꼼꼼히 작성돼 있으며, 오늘(2026-08-10) 있었던 §R7 의 실제 구조 변경도 무근거 번복이 아니라 새
Rationale 을 동반한 정당한 개정이었다. EIA·webhook·security·widget-app 네 개의 최인접 spec 을
직접 열어 대조한 결과 target 의 모든 교차 인용이 원본 Rationale 과 정합했고, 과거에 기각된
결정의 재도입이나 합의된 invariant(예: EIA-AU-04, "미설정 시 CORS 차단", "빈 목록≠전체 개방")
우회도 발견되지 않았다. 유일한 특이사항은 조립 번들이 컨텍스트 예산 문제로 이 네 문서를 통째로
누락했다는 점이며, 이는 target 자체의 결함이 아니라 검토 파이프라인의 알려진 취약점이다.

## 위험도

NONE
