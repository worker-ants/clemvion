# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-trigger-lock-gaps.md`

## 검토 방법

target draft 가 도입하는 신규 식별자(락 키 리터럴 `trigger-config:<triggerId>` · `exec-cap:<workspaceId>`,
frontmatter `code:` 항목, cascade 표 신규 행, `11-workflow.md` 신규 표)를 6개 관점별로 실제 spec 본문
(`spec/2-navigation/2-trigger-list.md`, `spec/conventions/redis-keys.md`, `spec/5-system/15-chat-channel.md`,
`spec/data-flow/11-workflow.md`)과 codebase(`grep -rn`)에 대조했다. draft 는 새 spec 파일도, 새
API endpoint 도, 새 이벤트명도, 새 ENV var 도 도입하지 않는다 — 기존 4개 문서의 본문·표·frontmatter
편집뿐이다. 따라서 관점 3(endpoint)·4(이벤트)·5(env var)는 target 범위에 해당 사항 없음.

## 발견사항

- **[INFO]** 락 키 리터럴 `trigger-config:<triggerId>` 와 기존 TS 타입 `TriggerConfig` 의 표기 인접
  - target 신규 식별자: `redis-keys.md §4` 표에 등재되는 Postgres advisory lock 키 리터럴
    `trigger-config:<triggerId>` (B1, `plan/in-progress/spec-draft-trigger-lock-gaps.md:132`)
  - 기존 사용처: `codebase/frontend/src/lib/types/trigger.ts:38` `export interface TriggerConfig { interaction?: TriggerInteractionConfig; [key: string]: unknown; }` — "트리거 `config` JSONB" 를 나타내는 프론트엔드 도메인 타입
  - 상세: 둘은 **같은 대상**(트리거의 `config` JSONB 컬럼)을 가리키는 서로 다른 층의 표현이라 의미
    충돌은 아니다 — 락이 보호하는 것이 정확히 `trigger.config` 재쓰기이므로 이름이 겹치는 것은
    오히려 의도된 상관관계에 가깝다. 다만 kebab-case 락 키 네임스페이스(`trigger-config:`)와
    PascalCase 타입명(`TriggerConfig`)이 spec 여러 문서에 흩어져 등장하면, 코드베이스를 모르는
    독자가 "그 `trigger-config:` 락이 `TriggerConfig` 타입 자체를 락으로 감싼다" 는 식으로
    과잉 해석할 여지는 있다.
  - 제안: 조치 불필요(현 상태로 병합해도 무방). 필요하면 `redis-keys.md` B1 신설 문단에 "이
    키 이름은 `Trigger.config` JSONB 컬럼에서 따왔다 — 프론트엔드 `TriggerConfig` 타입과는
    별개의 표현" 한 문장을 덧붙이면 충분하다. 이 항목만으로 draft 를 막을 이유는 없다.

## 점검했으나 충돌 없음을 확인한 항목 (전수 확인 근거)

1. **락 키 리터럴 자체의 선점 여부** — `grep -rn "trigger-config:" / "exec-cap"` (codebase 전체) 결과
   두 계열 모두 오직 `triggers.service.ts` / `schedules.service.ts` / `trigger-config-lock.ts` /
   `execution-engine.service.ts` 및 그 테스트에서만 쓰인다. `redis-keys.md` §3(실제 Redis 인벤토리)
   ·§4(인접 네임스페이스) 어디에도 기존 등재가 없다 — 신규 등재이지 재정의가 아니다.
2. **`redis-keys.md §4` 배치 자체의 적절성** — §4 는 정의상 "Redis 키가 아닌데 형태가 비슷한 것"
   전용 절이다(`background:run:<id>` Socket.IO 채널, `bg:<id>:<id>` in-memory map 키, `bull:<queue>:*`
   BullMQ 내부 키가 기존 3행). advisory lock 키는 실제로 Redis 를 경유하지 않는 Postgres 값이라
   §3(실제 인벤토리)이 아니라 §4 에 넣는 draft 의 선택은 기존 절 정의와 정합한다 — 오배치가 아니다.
3. **frontmatter `code:` 중복 소유 여부** — `2-trigger-list.md` A1 이 `trigger-config-lock.ts` 를
   추가해도, 이 파일은 어떤 기존 spec 의 `code:` 목록에도 없었다(`grep -rln trigger-config-lock spec/`
   결과 0건 전에는). `15-chat-channel.md` 의 `code:` 는 이미 `triggers.service.ts` /
   `triggers.controller.ts` 를 `2-trigger-list.md` 와 공유하고 있어 — 두 spec 이 같은 구현 파일을
   부분적으로 공유하는 것은 이 저장소의 기존 관행이다(`code:` glob 다중 매핑). 신규 파일 하나가
   추가 소유자를 얻는 것도 같은 패턴이라 충돌이 아니다.
4. **`엔진 §8`(execution-engine.md) 앵커·용어 정합** — `## 8. 동시 실행 제한` 헤딩이 실재하며
   ("§8 동시성 cap 은 PR2b 구현 완료(advisory-lock admission gate — §8 참조)") 이미 같은 락 계열을
   서술하고 있다. B1 이 이 절을 SoT 로 인용하는 것은 새 개념을 만드는 것이 아니라 기존 서술에
   키 리터럴을 잇는 것이다.
5. **`§3 API`(2-trigger-list.md) 앵커** — draft 가 반복 인용하는 `#3-api` 는 실제 `## 3. API` 헤딩과
   일치하고, `#43-cascade-동작` / `#44-결과에러` 도 각각 `### 4.3 cascade 동작` / `### 4.4 결과·에러`
   헤딩과 일치한다(기존 문서 안에서 이미 같은 형식으로 상호 링크되어 쓰이고 있음을 확인).
6. **§4.3 cascade 표 신규 행 "상류 — `workflow`·`workspace` 삭제"** — "상류" 라는 표현이 같은 문서군
   안에서 다른 의미의 고정 용어로 이미 쓰이고 있는지 확인했으나(`15-chat-channel.md:940` 의
   "상류가 고장났다"), 그쪽은 일반 서술어("upstream 서비스")일 뿐 라벨/식별자가 아니라 충돌
   대상이 아니다. 다만 기존 cascade 표의 다른 행이 전부 구체 엔티티/컬럼명(`schedule`,
   `execution.trigger_id`, `auth_config_id` 등)을 "연관 엔티티" 칸에 쓰는 데 비해 신규 행만 방향성
   레이블("상류")을 쓰는 스타일 차이가 있다 — 이는 **식별자 충돌이 아니라 표 컨벤션 일관성**
   문제라 본 checker 의 6개 관점(요구사항 ID/엔티티명/endpoint/이벤트명/env-key/파일경로) 밖이므로
   등급 부여 없이 기록만 남긴다.
7. **`15-chat-channel.md §5.4.1.1` 각주 치환 대상 문자열** — C1 이 치환하려는 원문
   `> **(2026-09-10 정합화 — slack/discord 축)**` 이 line 450 에 정확히 존재함을 확인했다. 새
   식별자를 만드는 편집이 아니라 기존 문장 뒤에 구를 덧붙이는 것이라 충돌 검토 대상 자체가 아니다.
8. **`11-workflow.md §3.1` 신규 표** — 해당 절(`### 3.1 workflow.is_active`)에는 현재 mermaid
   다이어그램만 있고 표가 없어(직접 Read 로 확인), D2 의 신규 표 삽입은 기존 표를 덮어쓰거나
   이름이 겹치는 문제가 없다. 다이어그램 라벨 치환(`CASCADE: nodes/edges/...` → `FK 파급은 아래
   표로`)도 새 식별자를 만들지 않는다.
9. **`/trigger-config` 같은 라우트·모듈명 선점 여부** — `grep -rn "'/trigger-config"` 결과 0건.
   REST 경로·NestJS 모듈명으로서의 "trigger-config" 선점은 없다 — 순수 lock-key 네임스페이스로만
   신설된다.

## 요약

target draft 는 새 spec 파일·API endpoint·이벤트명·ENV 변수를 전혀 도입하지 않고, 기존 4개 spec
문서의 표·frontmatter·각주만 편집한다. 유일한 "신규 식별자"는 Postgres advisory lock 키 리터럴
두 계열(`trigger-config:<triggerId>` · `exec-cap:<workspaceId>`)이며, 코드베이스 전수 grep 결과
두 계열 모두 다른 의미로 선점된 바 없고 `redis-keys.md §4`(비-Redis 인접 네임스페이스 전용 절)에
정확히 부합하는 위치에 등재된다. `code:` frontmatter 추가·cascade 표 신규 행·`11-workflow.md` 신규
표 모두 기존 문서의 빈 자리를 채우는 것이라 기존 항목과 겹치지 않는다. 유일하게 적을 만한 것은
락 키 이름과 기존 프론트엔드 `TriggerConfig` 타입 간의 표기 유사성인데, 이는 같은 도메인 대상을
가리키는 의도된 상관관계라 CRITICAL/WARNING 이 아니라 INFO 로 남긴다.

## 위험도

NONE
