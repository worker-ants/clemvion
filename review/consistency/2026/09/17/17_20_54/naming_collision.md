# 신규 식별자 충돌 검토 — spec-draft-deletion-releases-trigger-resources.md

## 발견사항

- **[WARNING]** D7 의 «창 1/2/3» 번호가 같은 도메인의 기존 «창 1~4» 번호와 형태가 겹친다
  - target 신규 식별자: `## D7. 남는 창 — 적어 둔다` 표의 `# | 창 | 남는 것 | 처분` — 1(외부 해제
    열거 뒤·부모 잠금 전에 생긴 트리거), 2(삭제 쪽 외부 해제 뒤·행 삭제 전 동시 요청), 3(행 삭제
    커밋과 비밀 정리 사이 프로세스 종료)
  - 기존 사용처: `plan/complete/trigger-config-lost-update.md` `## A. 착수 전 실측 — 창이 넷이다`
    (창 1 = `TriggersService.update()` 의 `findById`→`save`, 창 2·3 =
    `ChatChannelBinderService.setupChatChannel()` 성공/catch, 창 4 = `rotateBotToken()`) — 같은
    트리거 config 동시성 도메인에서 이미 확립된 번호 체계이고, target 자신도 이 번호 체계를 그대로
    인용한다(target §「실측」 3번째 사실: *"기존 창 1 e2e `trigger-update-save-window.e2e-spec.ts`
    ③ 은 …"*, D4 §2: *"위 5라운드 W1"*)
  - 상세: target 은 자신이 새로 여는 결함 표면(삭제 경로가 남기는 자원)을 가리키는 데도 «창 N» 이라는
    같은 형태의 번호를 재사용했다. 대부분의 인용은 `D7 창 2`처럼 접두를 붙여 구분하지만, Rationale 끝
    *"그래서 창 2 로 적고 미룬다"*(D7 표 바로 다음 문단) 한 곳은 접두 없이 **맨 번호 `창 2`** 로만
    인용한다. 이 문서 안에서 «창 1»(같은 문서 §실측, PATCH 본 저장 재읽기 창을 가리킴) 과 «창 2»(D7,
    provider 재등록 창) 가 같은 형태로 병존하므로, 두 문서를 오가며 구현할 developer(DRT-2)가 어느
    번호 체계인지 헷갈릴 여지가 있다 — 특히 D7 자체가 `trigger-config-lost-update.md` 의 5라운드 W1 을
    직접 이어받는 자리라 두 번호 체계가 같은 문장 근방에 등장한다.
  - 제안: D7 표의 열 이름을 `창` 대신 `# | 남는 창(D7) | 남는 것 | 처분` 처럼 D7 소속을 표 헤더에
    박거나, 번호 자체를 `G1/G2/G3`(gap) 같은 다른 접두로 바꿔 `trigger-config-lost-update.md` 의
    «창 1~4» 와 형태 충돌을 없앤다. 최소한 Rationale 의 "그래서 창 2 로 적고 미룬다" 한 문장에는
    누락된 `D7` 접두를 되살인다.

## 비충돌 확인 (검토했으나 문제 없음)

- **트래커 라벨 `DRT-1`~`DRT-3`**: 저장소 전체(`spec/`·`plan/`·`.claude/docs`·`.claude/skills`·
  `CLAUDE.md`·`codebase/`) grep 0건 재확인 — target 이 스스로 밝힌 대로 기존 `T1`/`T2`(`#676` 계열,
  `plan/in-progress/spec-draft-nullable-notation-followups.md`)와 겹치지 않는다. 2차 `--spec` 이 잡은
  CRITICAL(`T1~T3` 충돌)은 이미 해소돼 있다.
- **`#43-cascade-동작` 앵커**: `spec/2-navigation/2-trigger-list.md` §4.3 제목 "cascade 동작"은 기존
  제목 그대로이며(target 은 그 표 **다음**에 문단만 추가), `spec/data-flow/11-workflow.md` 등 기존
  참조 앵커와 그대로 맞는다.
- **`secret-store.md` §5.3/§6 제목 변경**("Trigger 삭제 시" → "트리거 행이 없어질 때")으로 앵커 슬러그가
  바뀌지만, 그 옛 앵커(`#53-trigger-...`, `#6-trigger-...`)를 인용하는 자리는 저장소 전체에 0건 —
  깨지는 링크 없음.
- **`SS-SE-05`**: target 이 "로그의 SS-SE-05 식별자" 라고 인용한 자리는 `secret-store.md` §4 에 이미
  정의된 항목(*"resolve 실패 시 ref + workspaceId 만 기록"*)과 정확히 일치 — 새 식별자 아님, 올바른
  재인용.
- **`secret-store.md §R4` 앵커** (`#r4-trigger-fk-미설정`): 기존 제목 "Trigger FK 미설정" 그대로 유지
  (본문만 넓힘) — 앵커 불변.
- **`pending_plans` frontmatter 필드**: 이미 20+ spec 문서가 쓰는 기존 컨벤션 필드. `1-workflow-list.md`
  는 기존 배열에 추가, `secret-store.md` 는 필드 자체가 없어 신설 — target 의 구분(S1 vs S10)이
  실제 현재 frontmatter 상태와 일치.
- **"미구현 (Planned)" 표기**: `spec/2-navigation/_layout.md`·`1-workflow-list.md`·`4-nodes/0-overview.md`
  등 여러 data-flow/nav 문서에서 이미 쓰는 관례적 표기 — 새 태그 아님, 올바른 재사용.
- **`schedule:<id>` BullMQ 키**: `spec/data-flow/10-triggers.md` §1.4 에 이미 정의된 job scheduler ID
  형식과 동일 — target 이 새로 만든 키 형식이 아니다.
- **`ListenerRegistry`("listener registry")**: `spec/5-system/15-chat-channel.md`·
  `spec/data-flow/14-chat-channel.md` 의 기존 `ChannelListenerRegistry` 를 가리키는 것과 일치.
- **DRT-2 의 모듈명**(`TriggersModule`/`SchedulesModule`/`ExecutionEngineModule`/`WebsocketModule`/
  `WorkflowsModule`): `codebase/backend/src/modules/` 실제 디렉토리(`triggers`·`schedules`·
  `execution-engine`·`websocket`·`workflows`)와 일치 — 새 모듈명 도입 아님.
- **API endpoint**: target 은 새 endpoint 를 추가하지 않는다(기존 `DELETE /api/triggers/:id` ·
  `DELETE /api/schedules/:id` · `DELETE /api/workflows/:id` · `DELETE /api/workspaces/:id` ·
  `POST /api/triggers/:id/chat-channel/rotate-bot-token` 모두 기존 계약 재인용).
- **환경변수·설정키**: 신규 도입 없음.
- **파일 경로**: `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` 는
  `spec-draft-*` 명명 컨벤션(`spec-draft-nullable-notation-followups.md` 등)을 그대로 따른다 — 기존
  파일과 겹치지 않음.
- **`D1`~`D7`/`S1`~`S10` 결정·변경 라벨**: 이 draft 문서 내부에서만 쓰이는 로컬 스코프 라벨이고, 실제
  spec 본문에 삽입되는 인용문(S1~S10 의 교체 텍스트) 안에는 이 라벨들이 새지 않는다 — 같은 패턴(문서별
  독립 `D1.`/`S1.` 네임스페이스)이 `rag-quality-improvement.md`·`ai-agent-tool-payload-budget-guardrail.md`
  등 다른 plan 문서에도 있어 저장소 관례에 부합.

## 요약

target 이 새로 부여하는 트래커 라벨(`DRT-1~3`)·재사용하는 앵커(`#43-cascade-동작`)·frontmatter 필드
(`pending_plans`)·기존 관례 표기(`미구현 (Planned)`)·기존 키 형식(`schedule:<id>`)·기존 식별자
(`SS-SE-05`, `R4`)는 모두 저장소 grep 으로 재확인했을 때 충돌이 없다 — 2차 `--spec` 이 잡았던
`T1~T3` 충돌은 이미 해소돼 있다. 유일한 실질 발견은 D7 이 새로 여는 «창 1/2/3» 번호가, 같은 트리거
동시성 도메인에서 이미 확립된 `trigger-config-lost-update.md` 의 «창 1~4» 번호와 형태가 겹치고 target
자신도 그 옛 번호를 같은 문서 안에서 인용한다는 점이다 — 대부분 `D7` 접두로 구분되지만 Rationale 의
한 문장이 접두 없이 노출돼 있어 WARNING 으로 등재한다. push 를 막을 CRITICAL 은 없다.

## 위험도

LOW
