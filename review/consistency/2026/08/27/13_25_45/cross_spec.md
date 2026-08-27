# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-done)

## 검토 방법 메모

target 프롬프트 번들은 `spec/5-system/` 의 19개 파일 본문과 실제 diff 를 예산 초과로
전부 생략했다. 대신 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/masking-residuals-0b195b`,
CWD 와 동일)에서 `git diff origin/main...HEAD` 로 실제 변경분을 직접 확인했다 —
`spec/2-navigation/14-execution-history.md` · `spec/3-workflow-editor/4-ai-assistant.md` ·
`spec/4-nodes/3-ai/1-ai-agent.md` · `spec/5-system/4-execution-engine.md` ·
`spec/conventions/egress-masking.md` · `spec/conventions/node-output.md` 6개 spec 파일이
"node `config` echo 마스킹 시점을 storage(엔진 boundary)에서 egress(REST/WS)로 이전" 결정을
반영해 갱신됐다(plan `masking-expression-egress-split.md`, `spec_impact` 6건과 일치).
이 변경은 직전 라운드(`review/consistency/2026/08/24/19_26_06/cross_spec.md`)가 지적한
CRITICAL(`14-execution-history.md` R-5 "storage-time 마스킹" vs `4-ai-assistant.md` "read-time
마스킹" 정면 모순)을 해소하기 위한 정정이며, 6개 spec 전체가 상호 일치하는 새 서술("DB 는
원문, 마스킹은 egress 에서만")로 수렴했음을 확인했다.

## 발견사항

- **[WARNING] R-5 의 보안 근거 문구가 바뀌었는데("boundary masking parity" → "egress masking
  parity"), target 영역(`spec/5-system/`) 안의 다른 두 문서가 옛 문구를 그대로 직접 인용 중**
  - target 위치: `spec/5-system/14-external-interaction-api.md:1529-1530` (§R17, "내부 읽기
    경로" 결정의 근거 문단) · `spec/5-system/6-websocket-protocol.md:196` (값-패턴 마스킹 적용
    범위 근거)
  - 충돌 대상: `spec/2-navigation/14-execution-history.md:469` — 이번 PR 이 R-5 본문을
    "즉 안전성은 **롤 게이팅이 아니라 서버 boundary masking parity** 에 의존한다" 에서
    "즉 안전성은 **롤 게이팅이 아니라 서버 egress masking parity** 에 의존한다" 로 고쳤다
    (diff 확인 완료 — `handler-output.adapter.ts` 의 boundary masking 자체가 제거됐으므로
    "boundary" 라는 단어가 더 이상 지시 대상을 갖지 않는다).
  - 상세: `14-external-interaction-api.md` §R17 은 `Execution.error`/`nodeExecutions[].error`
    내부 읽기 경로 마스킹 결정의 근거로 *"[실행 내역 R-5] 의 '안전성은 롤 게이팅이 아니라 서버
    **boundary masking parity** 에 의존' 원칙"* 을 **직접 인용부호로** 지목한다. 그러나 R-5 원문은
    이제 그 문구를 담고 있지 않다 — 인용이 출처와 문자 그대로 어긋난다. `6-websocket-protocol.md`
    도 동일 문구를 "EIA §R17 의 boundary masking parity 원칙과 같은 근거" 로 재인용해 stale
    문구가 2차 전파됐다. `git diff origin/main...HEAD --stat` 로 두 파일 모두 이번 PR에서
    **전혀 손대지 않았음**을 확인했다.
    같은 세션의 코드 리뷰 라운드(`review/code/2026/08/27/10_53_52/RESOLUTION.md` WARNING 5)가
    이미 한 번 "미러 스윕이 4곳을 놓쳤다"(`maskSensitiveFields boundary` 문구 — `ai-turn-executor.ts`
    2곳·`node-output.md`·`4-execution-engine.md`)며 스윕해 정정했으나, 그 스윕은 다른 문자열
    (`maskSensitiveFields boundary`)만 훑었고 이번에 발견한 문자열(`boundary masking parity`,
    R-5 자신의 보안 결론 문장을 지칭하는 별개 문구)은 포함하지 않아 이번 라운드까지 남았다.
    또한 `spec/2-navigation/14-execution-history.md:467` 자신의 "R-5 의 대상 범위(2026-08-16
    추가)" 상단 박스도 *"R-5 의 '**boundary masking parity**' 원칙은..."* 이라 같은 옛 문구를
    포함해 **같은 문서 안에서도** 467행(옛 문구 인용)과 469행(정정된 문구) 이 어긋난다 — 교차
    문서 문제의 근본 원인이 이 자기-인용에서 시작된 것으로 보인다.
  - 제안: `spec/5-system/14-external-interaction-api.md:1530` · `spec/5-system/6-websocket-protocol.md:196`
    의 "boundary masking parity" 를 "egress masking parity" 로 정정. 겸사겸사
    `spec/2-navigation/14-execution-history.md:467` 의 forward-reference 인용도 같은 값으로
    맞추면 자기-인용 drift 까지 함께 닫힌다. 세 곳 모두 의미 변화 없이 인용 문구만 R-5 현재
    본문과 문자 그대로 맞추는 3줄 수정이다.

- **[INFO] 그 외 target 영역(`spec/5-system/`) 6개 관점(데이터 모델·API 계약·요구사항 ID·상태
  전이·RBAC·계층 책임) 검토 결과 추가 충돌 없음**
  - `git diff --stat` 기준 이번 PR 은 API 엔드포인트·요구사항 ID·상태 머신을 변경하지 않았고,
    Config 탭 RBAC 결론("viewer 도 조회 가능, egress masking 이 안전성 근거")도 6개 spec 문서
    전체에서 일관되게 갱신됐다. "safe-by-construction → safe-by-convention" 계층 책임 이동은
    이미 R-5 정정 블록과 코드 리뷰(`10_53_52` WARNING 2·3)에서 대가로 명시·수용된 결정이라
    별도 미해결 충돌로 보지 않는다. `spec/4-nodes/4-integration/1-http-request.md` 등 credential
    을 raw config 로 받을 수 있는 노드(HTTP Request custom 헤더 등)의 "크로스-노드 자격증명
    릴레이" 잔여 위험도 R-5 항목 1이 이미 명시적으로 인지·수용했다.

## 요약

이번 PR 은 직전 라운드가 지적한 CRITICAL(config 마스킹 시점에 대한 두 spec 문서의 정면 모순)을
6개 spec 동시 갱신으로 정확히 해소했고, `spec/5-system/` 자체의 데이터 모델·API·요구사항
ID·상태 전이·RBAC·계층 책임 6대 관점에서 새로운 정면 충돌은 발견되지 않았다. 다만 R-5 의 보안
결론 문구 자체가 "boundary masking parity" → "egress masking parity" 로 바뀌었는데, 그 문구를
직접 인용하는 target 영역 내 두 문서(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md`)
가 옛 문구를 그대로 남겨 인용-출처 불일치가 생겼다 — 같은 세션에서 이미 한 번 발생한 "미러
스윕 누락" 패턴이 다른 문자열로 재발한 사례다. 기능·보안 판단에는 영향이 없는 3줄짜리 문구
정정이지만, 이 PR 의 성격(마스킹 잔여물 정리)상 남겨 두면 다음 사람이 "boundary" 라는 이미
사라진 개념을 SoT 로 착각할 수 있다.

## 위험도

LOW
