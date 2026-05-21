# 변경 범위(Scope) 리뷰

검토 대상: chat-channel-telegram-0c106c 워크트리 PR 변경 전체
검토 일시: 2026-05-22

---

## 발견사항

### [INFO] plan/in-progress 파일 2종 — 범위 적합
- **위치**: 파일 1 (`node-config-required-defaults-sweep.md`), 파일 2 (`presentation-button-render-investigation.md`)
- **상세**: 두 파일 모두 `new file` 이며 이 PR 의 worktree(`chat-channel-telegram-0c106c`) 가 아닌 별개 worktree 를 담당 plan(`worktree: node-config-required-defaults-sweep`, `worktree: button-cap-spec-validator`)으로 참조하고 있다. 즉 본 PR 이 생성한 plan 이 아니라 이미 완료·참조되고 있는 다른 작업의 plan 문서다. `node-config-required-defaults-sweep.md` 의 §후속 follow-up 과 `presentation-button-render-investigation.md` 의 §관련 문서 색인이 Chat Channel spec 과 무관한 node schema sweep / 버튼 렌더 조사 내용만 담고 있다.
- **제안**: 이 두 plan 파일이 어떤 경위로 이 PR 에 포함되었는지 확인 필요. 내용 자체는 Chat Channel 과 무관하다. Chat Channel spec 작업 흐름을 설명하는 §참고 링크 등에서 참조·언급은 되어 있으나, plan 파일 원본이 이 워크트리에서 신규 생성되는 것은 scope 관점에서 의아하다. 다만 `plan/in-progress/` 에 생성되는 것이므로 main 워크트리와의 병합 시 독립적으로 존재해야 하는 파일들로 볼 수도 있다. 병합 충돌 및 파일 소유권을 검토할 것.

### [INFO] review/consistency 산출물 3세트 (Round 1 / Round 2 / impl-prep) — 범위 적합
- **위치**: 파일 3~25 (review/consistency/2026/05/21/ 세 디렉토리)
- **상세**: Chat Channel spec 작성 전후의 consistency check 결과물로, CLAUDE.md 의 `project-planner` 의무 절차(`consistency-check --spec`, `consistency-check --impl-prep`) 에 따라 생성된 정상 산출물이다. 범위 이탈 없음.

### [WARNING] spec/2-navigation/4-integration.md — Chat Channel 과 무관한 기존 내용 수정
- **위치**: 파일 27, `spec/2-navigation/4-integration.md`, diff 3곳
- **상세**: 이 파일에서 변경된 내용은 세 군데이며 모두 Cafe24 Private App 관련 기존 spec 서술이다.
  1. 다이어그램에서 `(install_token 보존)` 주석 제거 (line 601)
  2. `expired` 상태 전이 설명에서 `install_token=NULL` 텍스트 제거 (line 613)
  3. `pending_install` 자기 루프 설명에서 `install_token 보존` 텍스트 제거 (line 615)
  4. Rationale `(c)` 항의 상세 설명을 단축 (line 1349, `cafe24-backlog-residual.md F-3 follow-up` 참조 문구 제거)

  이 변경들은 Chat Channel 기능과 직접 관계가 없다. Cafe24 `install_token` 관련 서술 정리는 최근 커밋 `0a51c8bb` ("cafe24 §6 다이어그램에 install_token 보존/소거 가시화 + line 1349 dangling reference 정정") 와 주제적으로 연속되는 내용이나, 해당 커밋은 이미 main 에 머지된 상태이다. 즉 이 PR 이 cafe24 관련 수정을 별도로 추가하고 있다.

  특히 Rationale `(c)` 항 단축은 기존 서술 `"본 프로젝트의 에러 코드는 의미 기반 명명을 원칙으로 하나, CAFE24_PRIVATE_APP_ALREADY_CONNECTED 는 historical artifact 예외로 등록한다 (2026-05-15 신설 당시 Private 흐름 한정이었으나 이후 app_type 무관으로 확장). 신규 코드는 이 예외를 따르지 않으며 처음부터 의미 정확한 이름을 부여한다. (※ 의미 기반 명명 원칙의 정식 규약화는 별 plan 으로 추적 — cafe24-backlog-residual.md F-3 follow-up 참조)"` 를 `"spec/conventions/swagger.md 의 의미 기반 명명 원칙에서 본 코드는 historical artifact 예외로 등록한다. 신규 코드는 이 예외를 따르지 않으며 처음부터 의미 정확한 이름을 부여한다."` 로 대폭 단축하며, 역사적 맥락과 follow-up 추적 참조를 삭제한다. 이는 Chat Channel 기능과 무관한 기존 spec 내용의 의도되지 않은 수정이다.
- **제안**: `spec/2-navigation/4-integration.md` 의 변경 3곳을 이 PR 에서 제거하고, 필요하다면 별도 cafe24 spec 정리 PR 로 분리할 것. 특히 Rationale `(c)` 단축은 향후 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드의 역사적 맥락을 추적하기 어렵게 만들 수 있다.

### [INFO] spec/5-system/2-api-convention.md — 예외 규약 추가, 범위 연관 있음
- **위치**: 파일 34, `spec/5-system/2-api-convention.md`
- **상세**: Chat Channel의 `rotate-bot-token` endpoint 가 기존 "중첩 2단계 제한" 을 초과하는 문제를 consistency-check (파일 20, 23_49_16/convention_compliance.md) 가 WARNING 으로 지적했고, 이를 해소하기 위해 RPC-style sub-channel action 예외 조항을 추가했다. 이 변경은 Chat Channel spec 작업의 consistency-check Warning 해소를 위한 것이므로 간접적으로 범위 내에 있다. 다만 기존 EIA endpoint(`notification/rotate-secret`, `interaction/revoke-token`) 까지 소급 예외로 포함시켜 API convention 자체를 수정하고 있다는 점에서 영향 범위가 해당 spec 파일 이상으로 확장된다.
- **제안**: 이 변경 자체는 Chat Channel 작업의 부산물로 정당화 가능하며 BLOCK 수준은 아니다. 다만 API convention 변경이 별도 리뷰 없이 이 PR 에 포함되었음을 기록한다.

### [INFO] spec/1-data-model.md / spec/4-nodes/7-trigger/0-common.md / spec/5-system/12-webhook.md / spec/5-system/14-external-interaction-api.md — Chat Channel 연동 수정, 범위 적합
- **위치**: 파일 26, 28, 31, 32
- **상세**: 모두 Chat Channel spec 신설에 따른 cross-reference 추가, EIA 요구사항 보강(EIA-AU-08 신설, EIA-IN-06 비고 추가, R10 설명 확장), webhook 처리 흐름 갱신이다. consistency-check Round 2 의 Warning 해소 항목(`W-1`, `W-2`, `W-3`)에 직접 대응하는 변경이며 범위 이탈 없다.

### [INFO] spec/4-nodes/7-trigger/providers/_overview.md / telegram.md, spec/5-system/15-chat-channel.md, spec/conventions/chat-channel-adapter.md — 핵심 신설 파일들, 범위 적합
- **위치**: 파일 29, 30, 33, 35
- **상세**: 본 PR 의 주 목적인 Chat Channel Telegram 어댑터 spec 신설 파일들이다. 범위 이탈 없음.

---

## 요약

변경 범위 관점에서 이 PR 은 대부분 Chat Channel Telegram 기능의 spec 신설·관련 spec 갱신·consistency review 절차에 충실하다. 핵심 문제는 `spec/2-navigation/4-integration.md` (파일 27) 에서 발생하는데, Chat Channel 기능과 무관한 Cafe24 `install_token` 관련 다이어그램 주석 제거 및 Rationale `(c)` 항의 기존 내용 단축이 포함되어 있다. 이 변경들은 최근 머지된 cafe24 spec 커밋과 주제가 겹치며, 이 PR 의 의도된 범위를 벗어난다. 특히 Rationale `(c)` 항 단축은 역사적 맥락 정보 손실을 유발한다. 나머지 변경은 모두 Chat Channel spec 작업의 정상 범위 내에 있으며, plan 파일 2종(`node-config-required-defaults-sweep.md`, `presentation-button-render-investigation.md`) 의 출처(worktree 소유권)도 확인이 권장된다.

---

## 위험도

LOW

`spec/2-navigation/4-integration.md` 의 무관한 수정이 있으나, 기능적 변경이 아닌 문서 서술 변경이므로 시스템 동작에는 영향이 없다. 다만 cafe24 spec 의 역사적 맥락이 이 PR 에서 의도치 않게 소실될 수 있어 LOW 로 평가한다.

---

STATUS=success ISSUES=1 PATH=/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-telegram-0c106c/review/code/2026/05/22/00_52_38/scope.md RESET_HINT=
