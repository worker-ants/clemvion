# 신규 식별자 충돌 Check 결과

- 검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`
- 구현 SoT 워킹트리: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4` (절대경로 `git diff`/`Read` 로 직접 확인)

## 조사 방법

1. `git -C <worktree> merge-base origin/main HEAD` → `14bc86a53fc95f73703ee2fe50968c4f0d73238d` 확인 후
   `git diff <merge-base>..HEAD` 로 이번 target 작업이 실제로 "새로 도입"한 항목만 1차 특정.
2. `spec/7-channel-web-chat/` 전체(6개 문서)를 대상으로, 위 diff 로 새로 생긴 식별자뿐 아니라 문서가
   이미 보유한 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·env var·config key·spec id 를
   검토 프롬프트의 "검색 대상 코퍼스"(`spec/0-overview.md`·`spec/1-data-model.md`·`spec/2-navigation/_product-overview.md`·
   `spec/5-system/*`·`spec/conventions/*`·`plan/in-progress/*`) 및 저장소 전수(`spec/`, `codebase/`)에 대해
   grep 로 교차 대조.

## Diff 범위 확정 (무엇이 실제로 새로운가)

```
git diff --stat <merge-base>..HEAD -- spec/
 spec/7-channel-web-chat/2-sdk.md | 4 ++++
```

`spec/7-channel-web-chat/` 산하 나머지 5개 문서(`0-architecture.md`·`1-widget-app.md`·`3-auth-session.md`·
`4-security.md`·`5-admin-console.md`) 는 origin/main 과 **바이트 단위로 동일** — 즉 R9(single-flight
coalesce)·EIA-RL-07 참조·`interactionAllowedOrigins`·env var 들은 이번 target 작업 이전에 이미 병합된
식별자이며 이번 작업이 "새로 도입"한 것이 아니다. 이번 target 이 실제로 추가한 것은:

- `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:` 리스트에 두 코드 경로
  (`codebase/channel-web-chat/src/widget/host-bridge.ts`, `.../use-widget.ts`) + 주석 4줄 추가뿐.
- 코드측: `codebase/channel-web-chat/src/{lib/widget-state.ts, widget/use-widget.ts}` 및 두 테스트
  파일의 내부 구현(순수 버그 fix), 신규 plan `plan/in-progress/webchat-boot-single-flight.md`.

## 항목별 점검

### 1. 요구사항 ID 충돌
target 이 새로 부여한 요구사항 ID 없음. `spec/7-channel-web-chat/*.md` 가 인용하는 기존 ID
(`EIA-RL-07`/`EIA-IN-02`/`EIA-IN-12`/`EIA-AU-04`/`EIA-NF-03`, `WH-SC-01`/`WH-SC-05`/`WH-SC-09`/`WH-EP-02`/`WH-NF-02`,
`NAV-WC-01..06`)는 모두 각 소유 문서(`spec/5-system/14-external-interaction-api.md`, `spec/5-system/12-webhook.md`,
`spec/2-navigation/_product-overview.md`)에 SoT 로 정의돼 있고 web-chat 쪽은 참조만 한다 — 재정의·충돌 없음.
`NAV-WC-*` 의 `WC` 2-letter 코드도 `spec/2-navigation/_product-overview.md` 전체 목록
(`AM/CA/CL/IN/KB/MP/SC/SS/ST/TR/UG/UP/WC/WF`)과 대조해 중복 없음.

코드 주석의 `spec 2-sdk §110` 류 참조(`use-widget.ts`·`use-widget-eager-start.test.ts`·`2-sdk.md` frontmatter
주석에 총 24회, 이번 diff 로 전부 신규 추가 확인 — `grep -c '^+.*§110'` = 16(테스트) + 7(구현) + 1(frontmatter))는
헤딩 번호가 아니라 **파일 내 절대 줄번호**를 가리키는, 이 저장소에 이미 있는 관용구다(예:
`http-request.handler.ts:353` 의 `spec §105`, `ai-turn-orchestrator.service.ts:647` 의 `execution-engine.md §646`,
`re-run.e2e-spec.ts:191` 의 `service §292`). 실측(`spec/7-channel-web-chat/2-sdk.md:110`)한 결과 정확히
"`wc:boot` 재전송(멱등 재설정)" 불릿을 가리켜 **정합** — 신규 식별자이나 기존 관용구와 형식이 같고 대상도
정확해 충돌·혼동 소지 없음.

### 2. 엔티티/타입명 충돌
이번 diff 가 도입한 이름은 `bootGenRef`/`unmountedRef`/`beginBootAttempt`/`cannotApplyConfig`/
`isAttemptStale`/`sessionEstablished`/`establishConfig` 7개 — 전부 `useWidget()` 함수 바디 내부의
`useRef`/`useCallback` **지역 변수**이며 export 되지 않는다. 저장소 전수 grep(`grep -rn "\b<id>\b" --include=*.ts*`)
결과 7개 전부 `codebase/channel-web-chat/src/widget/use-widget.ts` 와 그 전용 테스트
`use-widget-eager-start.test.ts` 두 파일에만 존재 — 스코프상 다른 모듈과 충돌할 표면이 없다.
`SeedOutcome`(`"ended"|"stale"|"continue"`) 타입은 이번 diff 이전부터 이미 존재(diff 에서 `+` 아님, 82번
줄 pre-existing) — 신규 union 멤버 추가 없음.

`spec/7-channel-web-chat/2-sdk.md` §5 의 공개 타입(`BootConfig`/`ChatInstance`/`WidgetEvent`/`Unsubscribe`)과
`4-security.md`/`3-auth-session.md` 의 `EmbedConfigDto` 는 이번 diff 대상이 아니며(문서 무변경), 저장소 내
다른 도메인의 동명 타입과도 충돌 없음(`EmbedConfigDto`는 `codebase/backend/src/modules/hooks/dto/...` 유일 정의).

### 3. API endpoint 충돌
이번 target 은 신규 endpoint 를 도입하지 않는다. `GET /api/hooks/:endpointPath/embed-config` 는 기존
구현(`hooks.controller.ts:55`)·`spec/data-flow/14-chat-channel.md` 와 정합해 이미 등재된 endpoint 이며
이번 diff 범위 밖. 다른 endpoint 신설 없음.

### 4. 이벤트/메시지명 충돌
신규 이벤트명 없음. `wc:boot`/`wc:command`/`wc:ready`/`wc:resize`/`wc:event` postMessage 프로토콜은
`wc:` namespace prefix 로 이미 격리돼 있고(`2-sdk.md §3` "타 채널·OAuth popup 메시지와 혼용 방지"), 저장소
전수 검색 결과 `'wc:` 리터럴을 쓰는 다른 postMessage 채널은 없음 — 충돌 없음. SSE 이벤트명도 이번 diff 로
신설된 것 없음(`execution.replay_unavailable` 등은 병합 이전에 이미 반영).

### 5. 환경변수·설정키 충돌
이번 diff 는 env var/config key 를 신설하지 않는다. 기존 `NEXT_PUBLIC_WIDGET_CDN_BASE`(frontend, 선택)와
`WEB_CHAT_WIDGET_ORIGINS`(backend)는 spec·`codebase/frontend/README.md`·`.env.example`·
`widget-base.ts`/`web-chat-cors.ts` 전 표면에서 동일 의미로 일관 사용 확인. `interactionAllowedOrigins` 도
CORS(§2)·임베드 allowlist(§3)가 "별도 키 미신설 — 단일 진실 원칙"으로 명시적으로 통합해 쓰는 것으로 문서화돼
있어(`4-security.md §3`), 신규 config key 충돌 없음.

### 6. 파일 경로 충돌
신규 spec 파일 없음(`2-sdk.md` 편집만). `id: web-chat-security` 는 frontmatter 주석에서 스스로 "basename
`4-security` 와 의도적으로 다름 — 타 영역의 `4-security` 슬러그와 충돌 방지"라고 명시하는데, 실측 결과
`spec/7-channel-web-chat/` 산하 6개 문서의 `id:` (`web-chat-architecture`/`web-chat-widget-app`/`web-chat-sdk`/
`web-chat-auth-session`/`web-chat-security`/`web-chat-admin-console`)는 `spec/**` 전체 142개 frontmatter id
중 유일값 — 의도한 충돌 방지가 실제로 유효함을 확인(참고: `spec/4-nodes/*/0-common.md` 6개의 `id: common`
중복과 `spec-impl-evidence.md` 예시 코드블록의 `id: chat-channel` 중복은 이번 target 과 무관한 기존
사례이며, 전자는 디렉토리-scoped 관용 패턴으로 별도 사안).

신규 plan `plan/in-progress/webchat-boot-single-flight.md` 도 `plan/{in-progress,complete}/` 전체(약 30개
webchat/web-chat 접두 plan) 대비 유일한 파일명 — 충돌 없음.

## 요약

이번 target 작업(`webchat-boot-single-flight`)의 실질 diff 는 `spec/7-channel-web-chat/2-sdk.md` frontmatter
4줄(기존 코드 경로를 evidence 로 추가)과 `codebase/channel-web-chat/src/{lib,widget}/*.ts` 내부의 React
훅 구현(단일 함수 `useWidget()` 스코프에 갇힌 7개 지역 변수/콜백)으로, 신규로 "공개적으로 보이는" 식별자를
사실상 도입하지 않는다. 요구사항 ID·엔티티/DTO·API endpoint·postMessage/SSE 이벤트명·env var·config
key·spec 파일 경로 6개 관점 모두 저장소 전수 grep 으로 대조했으며, 기존 사용처와 의미가 다르게 재사용된
사례를 찾지 못했다. `spec/7-channel-web-chat/` 문서군 자체도(이번 diff 대상은 아니지만 스코프 전체 점검
차원에서 함께 확인) `web-chat-*` id·`NAV-WC-*`·`WEB_CHAT_WIDGET_ORIGINS` 등 잠재적 충돌 지점마다 이미
의도적 네임스페이스 분리·"별도 키 미신설" 원칙을 문서화해 두고 있어 구조적으로 충돌 위험이 낮다.

## 위험도

NONE
