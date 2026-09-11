# 문서화(Documentation) Review — chat-channel-binder T2

## 발견사항

- **[WARNING]** 신규 클래스 JSDoc 이 아직 존재하지 않는 `plan/complete/...` 경로를 가리킨다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:18`
  - 상세: 클래스 JSDoc 이 `` `TriggersService` 에서 그대로 옮겨왔다 (동작 보존, `plan/complete/impl-chat-channel-binder-t2.md`) `` 라고 적는다. 그런데 이번 diff 가 실제로 신설하는 plan 파일(파일 7)은 `plan/in-progress/impl-chat-channel-binder-t2.md` 이고, 그 파일 자체의 체크리스트(`plan/in-progress/impl-chat-channel-binder-t2.md:189` — `- [ ] plan/complete/ 이동`)가 아직 미체크다. 즉 지금 시점에 이 JSDoc 이 가리키는 경로에는 파일이 없다.
    이 저장소의 기존 관례는 반대다 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 가 갖는 동일 패턴(`plan/complete/c1-engine-split.md` 참조)은 그 plan 이 실제로 `plan/complete/` 로 이동한 **한참 뒤**(#1022, C-1 체인 종료 스펙싱크 `d3ccae700` 이후)에 추가됐다. 이번 건은 plan 이 아직 `in-progress` 인 시점에 완료-후 경로를 선반영했다는 점에서 그 관례와 어긋난다.
  - 제안: `plan/complete/` 이동이 이 PR 의 마무리 커밋에서 실제로 일어난다면(체크리스트 순서상 `/ai-review` 이후 예정), 그 커밋과 함께 경로가 유효해지므로 최종 push 전에 plan 이동 여부를 확인만 하면 된다. 만약 plan 이동이 누락된 채 병합되면 이 링크는 깨진 채로 남으므로, `--impl-done` 또는 마무리 체크 시 "plan/complete/ 이동 완료 여부"를 이 JSDoc 참조와 함께 대조할 것.

- **[WARNING]** `setupChatChannel` 이동으로 인해 3개 spec 문서의 "현재형" 소유 서술이 스테일해진다 (이미 트래커에 등재되어 있음 — 교차 확인)
  - 위치: `spec/conventions/secret-store.md:146`, `spec/conventions/chat-channel-adapter.md:369`, `spec/data-flow/14-chat-channel.md:29` (모두 diff 밖의 기존 spec 파일 — 직접 `Read` 로 대조)
  - 상세: 세 곳 모두 `setupChatChannel` 을 `triggers.service.ts.setupChatChannel` / `TriggersService.setupChatChannel` / `triggers.service.ts` 소유로 현재형 서술한다. 이번 diff 로 그 메서드는 `ChatChannelBinderService`(`chat-channel-binder.service.ts`)로 옮겨졌으므로, 위 서술은 존재하지 않는 클래스/파일을 가리키는 사실 오류가 된다.
    이 자체는 이미 `--impl-prep`(`review/consistency/2026/09/11/17_39_32`) WARNING #2 로 발견돼 `plan/in-progress/spec-draft-nullable-notation-followups.md`(파일 8, 게이트 2288~2308행)에 planner 항목으로 정확히 등재돼 있다 — 자기-반증형 소정정 조건 1 불성립(이 문장들을 developer 가 쓴 게 아니라 이전 planner 턴이 씀)이라 developer 가 직접 못 고치는 것도 맞게 판단했다. 새로 발견한 결함이 아니라 **독립 교차 확인**으로 적는다.
  - 제안: 이미 세워진 처분대로 `--impl-done` 라운드에서 planner 가 3곳을 `ChatChannelBinderService.setupChatChannel` 로 갱신. 추가로 없음.

- **[INFO]** `15-chat-channel.md` §7 구현 파일 구조 다이어그램 + frontmatter `code:` 미등재 (이미 트래커에 등재됨)
  - 위치: `spec/5-system/15-chat-channel.md` (frontmatter `code:`, §7) — diff 밖
  - 상세: 신규 2파일(`chat-channel-binder.service.ts`, `trigger-callback-url.ts`)이 spec frontmatter `code:` 명시 목록과 §7 구현 파일 구조 다이어그램에 없다. T1(`chat-channel-input-rules.ts`)이 이미 만든 같은 결함 클래스의 3번째 재발이며, `plan/in-progress/spec-draft-nullable-notation-followups.md:2213-2219`(파일 8)에 "glob 전환으로 재발 차단" 대안까지 함께 등재돼 있어 처분이 이미 확정돼 있다. 조치 불요, 정보성 교차 확인.
  - 제안: 없음 (이미 처분 확정).

- **[INFO]** 관측된 저장소 이상 상태 — 공유 워크트리에 커밋되지 않은 수정이 남아 있음 (본 리뷰어가 만든 것이 아님)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (on-disk, `setupChannel` 실패 catch 블록의 `fallbackConfig` 객체 — 커밋 `a2e5b7e16` 대비 `git diff` 로 확인)
  - 상세: 이 리뷰 세션이 파일을 읽은 시점에 `git status`가 해당 파일을 modified 로 표시했고, `git diff` 결과 `fallbackConfig.chatChannel` 값이 커밋된 `internalCfg` 에서 `sanitizedCfg` 로 바뀌어 있었다. 이는 병렬로 도는 다른 reviewer 의 뮤테이션 검증 흔적으로 보인다(동시 fan-out 규약 문서가 경고하는 정확히 그 상황). 본 리뷰어는 이 변경을 만들지 않았고, 되돌리지도 않았다(`git checkout`/`restore` 는 규약상 금지). 문서화 관점 자체(JSDoc·주석)는 이 라인 근방에 없어 본 리뷰의 판정에는 영향이 없었지만, 다른 reviewer 가 이 잔여물을 실제 결함으로 오인할 수 있어 투명하게 보고한다.
  - 제안: 이 세션 종료 시점에 `git status --short` 로 재확인하고, 커밋 `a2e5b7e16` 기준 원복 여부를 orchestrator 가 확인할 것.

## 긍정적으로 확인된 사항 (참고용)

- `chat-channel-binder.service.ts` 클래스/메서드 JSDoc 은 이 코드베이스 기준으로도 이례적으로 두껍고 정확하다 — "왜 클래스인가", "경계(있다/없다 표)", "왜 `chat-channel/` 이 아니라 `triggers/` 인가", "로그 접두를 의도적으로 남긴 이유"까지 근거와 함께 서술하고, 인용하는 스펙 앵커(`§5.4.1.1`, `R-CC-21`, `CCH-AD-02/03`, `CCH-SE-01`, `WH-MG-04`)와 회귀 캐너리 테스트 제목(`server-issued 서명은 PATCH 에서도 재저장된다`, `카드 편집 PATCH 후에도 inboundSigningRef 가 살아남는다`, `setupChannel 이 실패해도(degraded) inboundSigningRef 를 잃지 않는다`, `app.url 이 undefined 이면 fallback`)을 전부 `triggers.service.spec.ts` 에서 실제로 확인했다 — 인용이 정확하다.
- `trigger-callback-url.ts` 의 docstring 도 `getAppBaseUrl()` 과의 개념 중복을 스스로 지목하고 왜 지금 통합하지 않는지(소스가 다름 — `ConfigService` vs `process.env` 직접 접근, 9~14개 테스트 모듈의 통제권 상실)를 근거와 함께 남겨 두었다. `--impl-prep` W4 에 대한 대응으로 적절하다.
- `triggers.module.ts` 의 이동 관련 주석("TriggersService 와 ChatChannelBinderService 가 …단방향… 둘 다 쓴다")과 `triggers.service.ts` 의 잔류 주석("3-쓰기 표는 `chat-channel-binder.service.ts` 의 JSDoc 에 있다")은 이동 후 실제 구조와 정확히 일치한다 — 흔한 "이동 후 주석 갱신 누락" 패턴이 여기서는 없었다.
- README 업데이트: 불필요 — 사용자 대면 기능·설정 변경 없음, 순수 내부 리팩터(클래스 이동).
- CHANGELOG 업데이트: 불필요 — 동작 보존이 명시적 설계 제약(plan `spec_impact: none`)이고, 동일 계열 선행 커밋 T1(`ba634a4b0`, chat-channel 검증 함수 추출)도 CHANGELOG 항목을 추가하지 않았다(전례와 일치).
- 신규 환경변수/설정 옵션 없음 — `APP_URL`/`app.url` 은 기존 키를 그대로 재사용.
- API 문서: 이번 diff 자체는 엔드포인트 계약을 바꾸지 않는다(내부 이동). `rotate-bot-token` 엔드포인트의 OpenAPI 데코레이터 부재는 실측 결과(`triggers.controller.ts` `rotateBotToken`) 사실이나, 이 PR 이 만든 갭이 아니라 사전 존재 갭이며 이미 `--impl-prep` W3 · `spec-draft-nullable-notation-followups.md`(파일 8) 에 developer 항목으로 별도 등재돼 있어 이번 diff 범위 밖으로 정확히 처분됐다.

## 요약

이 PR 은 순수 이동(behavior-preserving move)이라는 주장에 걸맞게 문서화 수준이 이 저장소 평균을 크게 웃돈다 — 설계 근거·기각한 대안·회귀 캐너리 포인터를 전부 실측으로 검증 가능한 형태로 남겼고, 세 스펙 문서 스테일화·frontmatter 미등재 같은 파생 문서 부채는 스스로 발견해 정확한 절차(자기-반증형 소정정 조건 미충족 → planner 턴 위임)로 트래커에 등재해 두었다. 독립적으로 발견한 새 결함은 하나뿐이다 — 신규 클래스 JSDoc 이 아직 `plan/in-progress/` 에 있는 plan 파일을 `plan/complete/...` 경로로 선반영해, 이 저장소의 기존 관례(완료·이동 후에만 그 경로를 인용)와 어긋난다. 영향은 낮다(깨진 링크 하나, 체크리스트상 마무리 커밋에서 자연 해소될 가능성). 그 외에는 병렬 리뷰어가 남긴 것으로 보이는 미커밋 뮤테이션이 공유 워크트리에서 관측돼 투명성 차원에서 별도로 보고한다.

## 위험도

LOW
