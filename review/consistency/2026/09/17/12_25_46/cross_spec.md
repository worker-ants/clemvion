# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-trigger-lock-gaps.md`

## 검토 범위 · 방법

번들이 `spec_impact` 4개 문서(`2-trigger-list.md` · `redis-keys.md` · `15-chat-channel.md` ·
`11-workflow.md`) 본문 대부분을 컨텍스트 예산 초과로 누락했으므로, 프롬프트 하단 지시에 따라
네 파일 전체(또는 관련 절)를 worktree 절대경로로 직접 `Read` 하고, draft 가 인용하는 코드
(`trigger-config-lock.ts` · `execution-engine.service.ts` · migration 10건)를 `grep`/`Read` 로
대조했다. 또한 draft 가 건드리지 않는 인접 spec(`4-execution-engine.md §8/§9` · `4-integration.md`
· `14-external-interaction-api.md` · `3-schedule.md` · `data-flow/10-triggers.md`)도 열어 draft 의
새 서술과 충돌하는 기존 문면이 있는지 확인했다.

결론부터: draft 의 사실 관계(migration FK 전수, `exec-cap` 키 조합식, 락 타임아웃 5000ms, PATCH
차단 코드 경로, R-CC-21 각주 시제 등)는 코드·마이그레이션과 전부 일치했다. 발견된 실질 이슈는
draft 가 **새로 등재하려는 값이 같은 문서군의 기존 "보편 서술"과 충돌**하는 1건이다.

## 발견사항

- **[WARNING]** `exec-cap:<workspaceId>` 등재가 "워크스페이스 세그먼트를 가진 키는 없다"는 두 문서의 보편 서술과 충돌
  - target 위치: draft `### B. spec/conventions/redis-keys.md §4` — B1 표 행(`exec-cap:<workspaceId>`
    등재) · B2 문단
  - 충돌 대상:
    - `spec/conventions/redis-keys.md §2` (draft 가 수정하는 **같은 파일의 다른 절**, 미수정):
      > "**현재 실재하는 키 중 `workspaceId` 세그먼트를 가진 것은 없다.** 전부 execution·trigger·IP·
      > 전역 단위 책임이고 …"
    - `spec/5-system/4-execution-engine.md §9.2` (draft의 `spec_impact` 목록에 **없음**, 미수정):
      > "위 키들은 전부 워크스페이스에 종속되지 않는 책임 … 을 가지므로 워크스페이스 세그먼트 없이
      > 둔다 … **이것이 예외가 아니라 저장소 전체의 관례**라는 점은 `conventions/redis-keys.md §2`
      > 참조 — **실재하는 어느 키도 워크스페이스 세그먼트를 쓰지 않는다.**"
  - 상세: draft B1 은 `exec-cap:${workspaceId ?? execution.workflowId}` (`execution-engine.service.ts:2974`
    실측 확인)를 redis-keys.md **§4**("Redis 키가 아닌데 형태가 비슷한 것")에 등재한다. `exec-cap`
    키는 `workspaceId` 가 있을 때 그것을 **문자 그대로 포함**하므로, 정의상 "워크스페이스 세그먼트를
    가진 키"다. 그런데 같은 파일 §2 와 `4-execution-engine.md §9.2` 는 **"실재하는 어느 키도
    워크스페이스 세그먼트를 쓰지 않는다"를 "저장소 전체의 관례"로 못박고**, §9.2 는 그 근거로 바로
    이 §2 를 인용한다. draft 는 이 두 자리 중 어느 쪽도 건드리지 않는다.
    - §4 가 "Redis 키가 아니다"를 명시하므로 §2의 "키"를 "Redis 키"로 좁게 읽으면 형식논리상
      모순은 아니라고 볼 여지가 있다. 그러나 §9.2 의 표현은 "저장소 **전체**의 관례"로 범위를
      Redis 로 한정하지 않고 있고, 이 문서 자신도(§1 두 예외 계열, §3 "한 모듈이 접두를 여럿
      쓴다") 정확히 이런 종류의 예외를 **명시적으로 각주 처리하는 관례**를 이미 갖고 있다 —
      이번만 그 관례를 따르지 않는 것은 일관성 결함이다.
    - `trigger-config-lock.ts` 자신의 JSDoc(6~15행)도 "`exec-cap:<workspaceId>` 조차 아직
      미등재다 — 두 계열의 §4 등재는 planner 항목으로 올렸다"고 명시해, 이 draft 가 그 항목을
      닫으러 온 것이 맞다 — 다만 **등재만 하고 인접한 보편 서술을 정정하지 않으면** "§4 에는
      워크스페이스 세그먼트 키가 있는데 §2/§9.2 는 하나도 없다고 계속 말하는" 상태로 착지한다.
  - 제안: 다음 중 하나를 B2 문단(또는 §2 자체)에 한 줄 추가:
    1. §2 문장 앞에 "(§4의 advisory-lock 류 제외 — 그쪽은 워크스페이스 세그먼트를 쓸 수 있다)"
       같은 scope 한정어를 넣거나,
    2. B2 말미에 "§2 의 «워크스페이스 세그먼트 없음» 은 **Redis 키(§3)** 한정이며, 본 절(§4)의
       advisory lock 키는 그 범위 밖이다"라는 명시적 caveat 를 추가.
    같은 논리로 `spec/5-system/4-execution-engine.md §9.2` 의 인용문("저장소 전체의 관례")도
    함께 정정 대상이므로, 이 파일을 draft `spec_impact` 에 추가하거나(가장 깔끔), 최소한 B2
    문단에서 그 인용을 함께 무효화하는 한 문장을 남길 것.

## 비대상으로 확인한 항목 (충돌 아님 — 오탐 방지용 기록)

검토 중 잠재 충돌로 의심했으나 실측 결과 **충돌이 아님**을 확인한 항목들:

- **redis-keys.md B1 의 표 소속** — B1이 목표로 삼는 표는 §3 "전역 인벤토리"(컬럼: 키/소유
  모듈/상세 SoT)가 아니라 §4 "인접 네임스페이스"(컬럼: 이름/실체/SoT)다. draft 의 열 구성이
  §4 헤더와 정확히 일치하고, advisory lock 키는 Redis 를 경유하지 않으므로 §4 배치가 맞다 —
  §3 (Redis 전용 인벤토리)에 넣었다면 그 자체로 CRITICAL 이었을 것.
- **redis-keys.md 자신의 `code:` frontmatter 에 `modules/triggers/**` 미포함** — §4 기존 항목
  (Socket.IO 채널·in-memory map·BullMQ 내부키)도 전부 `code:` 목록 밖에 있다. §4 는 애초에
  "이 문서가 실체를 소유하지 않는" 절이라 code 커버리지 대상이 아닌 것이 기존 패턴이며, draft 의
  추가도 그 패턴을 따른다. 갭 아님.
- **`2-trigger-list.md §3 API` 의 Cafe24 링크(`./4-integration.md`)** — 대상 파일에
  `cafe24-token-refresh` 큐와 "advisory lock 기각(DB 커넥션 점유 증가)" 근거가 실제로
  `4-integration.md:1444` 에 존재. 링크·인용 정확.
- **CASCADE 전수(D2) 대 마이그레이션** — `REFERENCES workflow(id)` 6개 마이그레이션(`node`/`edge`/
  `trigger`/`execution`/`workflow_version`/`integration_usage_log`/`llm_usage_log`(SET NULL)/
  `alert_rule`/`workflow_assistant_session`/`workflow_test_dataset`)이 draft 표와 정확히 일치.
  이후 마이그레이션(V002·V105)은 index 추가일 뿐 FK 재정의 없음 — "바꾼 흔적 0건" 서술 정확.
- **R-CC-21 시제(C1/C2)** — `spec/5-system/15-chat-channel.md:450` 각주는 실제로 과거시제
  ("구현이 정반대였다")이고, 현재 코드(`chat-channel-input-rules.ts`,
  `chat-channel-rejection-messages.const.ts`)는 §5.4.1.1 표(현재 정책)와 일치. "모순"이 아니라
  "시제 오독 소지"라는 draft 의 판정이 정확.
  하나 이제 통합.
- **락 대기 상한 5초(A4)** — `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 실측 일치.
- **외부 provider 호출이 락 밖(A2)** — `triggers.service.ts` "창 1" 트랜잭션은 검증·병합·`save`만
  포함하고 `setupChatChannel`은 그 트랜잭션 커밋 뒤에 호출됨 — 서술과 코드 일치.
- **EIA(`14-external-interaction-api.md`) / Schedule(`3-schedule.md`) / data-flow
  `10-triggers.md §1.4`** — 세 문서 모두 트리거 `config` 재작성에 대한 자체 락·원자성 주장을
  갖고 있지 않아, draft 가 도입하는 "트리거 단위 advisory lock" 서술과 정면으로 배치되는 기존
  문면은 없음 (data-flow §1.4 의 `name`/`is_active` 컬럼 한정 UPDATE 서술은 draft 의 "컬럼 한정
  갱신은 락을 잡지 않는다"와 침묵 일치 — 반박 아님).
- **요구사항 ID·RBAC·상태 전이** — draft 는 새 CCH-*/WH-*/CV-* 류 요구사항 ID 를 발급하지
  않고, RBAC 매트릭스를 변경하지 않으며, `workflow.is_active` 상태 머신 자체(전이 종류)는
  D1 에서도 그대로 유지(다이어그램 라벨만 표로 위임). 이 세 관점에서 충돌 없음.

## 요약

Draft 는 착수 전 실측을 충실히 거쳤고, 코드·마이그레이션 대조 결과 모든 구체적 사실 주장(락
타임아웃값·CASCADE 전수·`exec-cap` 키 조합식·PATCH 차단 경로·R-CC-21 시제)이 정확했다. Cross-spec
관점에서 발견된 유일한 실질 이슈는 B 절이 `exec-cap:<workspaceId>` 를 `redis-keys.md §4` 에
등재하면서, 같은 문서 §2 와 `4-execution-engine.md §9.2`(spec_impact 밖)가 이미 선언한 "워크스페이스
세그먼트를 가진 키는 하나도 없다 — 저장소 전체의 관례"라는 보편 서술을 정정하지 않고 남겨 둔다는
점이다. 기능적 모순(둘 중 하나가 작동 불가)은 아니지만, 이 저장소가 스스로 정한 "예외는 명시적으로
각주 처리한다"는 문서 관례를 이번 절에서만 어기게 되므로 WARNING 으로 판정한다. 나머지 다섯
관점(API 계약·요구사항 ID·상태 전이·RBAC·계층 책임)에서는 유의미한 충돌을 찾지 못했다.

## 위험도

LOW
