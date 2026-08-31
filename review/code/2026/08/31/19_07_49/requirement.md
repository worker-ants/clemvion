# 요구사항(Requirement) Review

## 검토 방법

이 브랜치는 `origin/main`(`ead37afd4`) 대비 11개 커밋으로, 이미 두 차례 `/ai-review` 라운드
(`review/code/2026/08/31/18_30_55`, `18_46_06`)가 돌았고 그 라운드가 낸 WARNING을 반영한 fix
커밋(`0883c4e43`, `f3ece1fc6`)까지 포함된 **최종 상태**다. 직전 두 라운드의 자체 보고를 그대로
신뢰하지 않고, 저장소를 직접 `Read`/`Grep`/`git log -p -L`/`pytest` 로 재검증했다(뮤테이션 없음,
`git status --short` 로 최종 clean 확인 — 세션 산출물 디렉터리만 untracked).

핵심 검증 항목: (1) `consistency_orchestrator.py` 신설 census 헬퍼 + 신규 테스트 14건 실행,
(2) `.claude/tests/README.md` 카탈로그 가드 재실행, (3) `workflow-assistant.controller.ts` 7개
라우트 전수 `@ApiUnauthorizedResponse` 부착 확인 + `swagger.md §2-4` 원문 대조, (4)
`notifications-channel-authorizer.ts` 의 "emit 구현·배선 완료" 주장을 실제 호출 체인
(`notifications.service.ts:511` → `websocket.service.ts:576`)으로 검증, (5) WS §4.x 절 재배치가
`spec/5-system/6-websocket-protocol.md` **자기 자신** 안에서 완전한지 전수 재검증(직전 두 라운드가
확인한 항목들과 별개로 `§4\.[0-9]` 패턴 전체를 grep 해 문맥 대조).

## 발견사항

- **[WARNING]** `spec/5-system/6-websocket-protocol.md` 자체 안에 §4.6→§4.7 절 재배치를 반영하지
  못한 bare-prose 인용이 한 곳 더 남아 있다 — 이 PR이 정확히 이 결함 클래스(썩은 절 번호 인용)를
  3라운드에 걸쳐 스윕하던 대상 파일 안에서, 그 3라운드 모두가 놓친 네 번째 인스턴스다.
  - 위치: `spec/5-system/6-websocket-protocol.md:979` — `**seq 기반 정밀 재전송은 SSE 전송
    표면의 메커니즘이다.** ... **SSE 어댑터**가 \`Last-Event-Id\` 헤더로 제공한다 (§4.6,
    [Spec EIA §5.2 SSE 이벤트 스트림](./14-external-interaction-api.md))`
  - 상세: 이 PR은 §4.3(KB 문서 이벤트)을 신설 삽입하며 뒤따르는 절을 §4.4(알림)→§4.5,
    §4.5(시스템)→§4.6, §4.6(외부 표면 매핑)→§4.7 로 순연시켰다. 현재 헤딩 시퀀스를 직접
    확인하면(`grep -n '^### 4\.' spec/5-system/6-websocket-protocol.md`) `4.1·4.2·4.3·
    4.4(+4.4.5/4.4.6)·4.5·4.6·4.7` 로 정확하다. 그런데 979번째 줄은 "## 6. 재연결 → 6.2 놓친
    이벤트 복구" 절에서 SSE `Last-Event-Id` 재전송 메커니즘을 EIA §5.2와 함께 인용하며 그 대상을
    "§4.6"이라 부른다 — 그 내용(외부 SSE 표면으로의 매핑)은 지금 §4.7("외부 표면 매핑
    (External Interaction API)", line 875 "본 §4.7 의 매핑 표가 권위적이며")이 다루는 주제이지,
    §4.6("시스템 이벤트" — `auth.token_expired`/`system.maintenance`/`error`)이 다루는 주제가
    아니다. `git log -p -L 975,982:...` 로 이 줄의 이력을 확인한 결과 2026-07-08 커밋
    (`74a744f4a`)에서 작성된 이후 이번 재배치 커밋(`50caf1a85`, `f3ece1fc6`)이 손대지 않았다 —
    당시(재배치 전) §4.6 = 외부 표면 매핑이었으므로 그때는 정확했던 인용이, 이번 재배치로
    조용히 stale해졌다. 3라운드 모두 "notification.new"/"§4.4" 주변 문맥(±5줄)만 훑는 grep을
    썼고, 이 줄은 그 검색어(주어)와 무관해 대상에 걸리지 않았다 — round 3(`f3ece1fc6`)이
    "후보 8건, 4건 결함/4건 오탐"으로 마무리했다고 기록했지만 이 인스턴스는 애초에 그 8건
    후보에 없었다.
  - 제안: `§4.6` → `§4.7` 로 정정(가능하면 markdown 링크로 `#47-외부-표면-매핑-external-
    interaction-api` 앵커까지 부여). 이 결함 클래스가 3라운드째 재발한 근본 원인은 스윕이
    특정 주제어("notification.new") 기준 grep이었다는 점이므로, 후속으로는 절 이동이 있을 때마다
    `grep -n '§4\.[0-9]' <파일>` 전체 목록을 헤딩 시퀀스와 1:1 대조하는 절차를 권고한다(이번
    검증에 사용한 방법 그대로).

## 확인 완료 — 결함 아님 (직접 검증)

- `codebase/frontend/src/lib/websocket/use-execution-events.ts` 등 프론트엔드 다수 파일과
  `codebase/backend/src/nodes/ai/**`, `websocket-events.types.ts`, `websocket.service.ts`,
  `websocket.service.spec.ts` 의 잔존 `§4.4` 인용들은 **전부 다른 절**("사용자 입력 대기 이벤트
  상세" — `execution.waiting_for_input`/`tool_call_started`/`llmCalls` 등)을 가리키며, 이 절은
  재배치 대상이 아니다(재배치 전후 모두 §4.4). 오탐 후보로 전수 확인했으나 결함 없음.
- `spec/data-flow/8-notifications.md:349` 의 "본 문서 §4.6 follow-up"은 그 문서 **자신의**
  `### 4.6 WebSocket 동기화 (follow-up)` 헤딩(line 186)을 가리키는 자기참조로, `6-websocket-
  protocol.md`의 재배치와 무관 — round 2·3이 이미 정확히 판정했고 재확인 결과도 일치.
- `notifications-channel-authorizer.ts:12`의 갱신된 주석("emit 은 구현·배선 완료")은 실제 호출
  체인으로 검증됨: `NotificationsService.notify()` → `notifications.service.ts:511`
  `emitNotificationEvent` → `websocket.service.ts:576`. 과장 없음.
- `.claude/tests/README.md` 카탈로그 가드(`test_tests_readme_catalog.py`, 5 tests)와 신설
  `test_consistency_scope_census.py`(14 tests) 모두 로컬 재실행 GREEN.
- `workflow-assistant.controller.ts` 7개 라우트(`list`/`latest`/`findOne`/`create`/`update`/
  `remove`/`sendMessage`) 전부 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰
  만료' })` 부착 확인(`grep` 전수) — `spec/conventions/swagger.md:230` 원문과 문구 완전 일치.
  클래스 레벨 `@ApiBearerAuth`만 있고 `@Public` 미부착이라 401 문서화 대상이라는 전제도 유효.
  이 데코레이터·회귀 테스트는 인가 로직·응답 바디·URL을 전혀 바꾸지 않는 순수 additive
  문서화라 기능 완전성/엣지 케이스/에러 시나리오 관점에서 위험이 없다.
- `_scope_delta_census`/`_count_diff_files`(consistency_orchestrator.py)는 scope prefix 매칭이
  형제 디렉터리로 새지 않도록 `scope_rel + "/"` 를 쓰고, `_SCOPE_HITS_DISPLAY_LIMIT`(20) 초과 시
  "… 외 N건" 접힘까지 fixture(20/25건)로 커버된다. 빈 `diff_text`, scope 델타 0건, diff 0개 파일
  분기 모두 코드·테스트 양쪽에서 명시적으로 처리됨을 확인 — TODO/FIXME/미완성 표시 없음.

## 요약

이 changeset의 핵심은 (a) `--impl-done` 프롬프트가 예산에 잘려 "구현 없음"과 "구현이 잘림"을
구분 못하던 harness 결함 처방, (b) `workflow-assistant` 컨트롤러의 401 Swagger 문서화 갭 해소,
(c) WS 프로토콜 문서의 절 번호 재배치(§4.3 KB 이벤트 신설 삽입에 따른 순연) 및 그에 따른 크로스
레퍼런스 스윕이다. (a)·(b)는 코드·테스트·spec 문구가 line-level로 정확히 일치함을 직접
실행/grep으로 재검증했고 결함이 없다. (c)의 재배치 스윕은 이미 두 차례 fix 라운드를 거쳤는데도
불구하고 스스로 편집한 `6-websocket-protocol.md` 본문 안에 §4.6→§4.7 미반영 bare-prose 인용이
한 곳(line 979) 더 남아 있음을 이번 라운드에서 확인했다 — 매 라운드가 특정 주어("notification.new")
기준 grep으로 스윕 범위를 좁혀 온 것이 반복 재발의 근본 원인이다. 런타임 동작·API 계약·DB 상태
전이에는 영향이 없는 문서 전용 결함이라 WARNING으로 유지하며, CRITICAL 급 기능 결함·엣지 케이스
누락·데이터 유효성 문제·잘못된 반환값은 발견되지 않았다.

## 위험도

LOW
