# 신규 식별자 충돌 검토 — spec-draft-eia-notification-payload-contract.md

## 검토 범위와 방법

target 문서를 읽고, 문서가 실제로 "새로 도입"한다고 주장하는 대상(EIA §6 도입부 신설, 필드
집합 통합, 포인터화)을 6개 관점으로 점검했다. 컨텍스트 예산 초과로 프롬프트에 본문이
누락된 관련 파일(`spec/5-system/14-external-interaction-api.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/conventions/chat-channel-adapter.md`,
`spec/3-workflow-editor/3-execution.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
`plan/in-progress/spec-draft-eia-r8-alignment.md`)는 직접 `Read`/`grep` 으로 열어 확인했다.

## 발견사항

target 문서는 요구사항 ID·엔티티/DTO 명·API endpoint·이벤트명·ENV/설정키를 **신규로 명명하지
않는다** — 기존 `execution.completed`/`failed`/`cancelled`/`ai_message`, 기존 필드명
(`status`/`error`/`result.cancelledBy`/`result.outputs`/`durationMs`), 기존 `EiaEvent`
타입(convention §1.2, R3), 기존 요구사항 ID(`EIA-RL-07`, `WEBCHAT_IDLE_TIMEOUT`, `RESUME_*`)를
그대로 재사용하며, 문서 구조(필드 열거 → 포인터)만 재배치한다. 6개 관점에 대해 실측한 결과는
다음과 같다.

- **요구사항 ID 충돌**: 없음. target 은 새 `EIA-XX-NN` ID 를 발급하지 않는다.
- **엔티티/타입명 충돌**: 없음. `EiaEvent`/`ChatChannelInternalEvent` 는 이미
  `chat-channel-adapter.md` §1.2/§1.3·R3 에 존재하는 타입이고, target 은 그 필드 열거를
  참조로 축약할 뿐 새 타입을 만들지 않는다.
- **API endpoint 충돌**: 없음. 신규 endpoint 없음.
- **이벤트/메시지명 충돌**: 없음. 5종 종결·대기 이벤트명은 모두 기존 EIA §6.1~§6.6 에 이미
  정의된 이름이다.
- **환경변수·설정키 충돌**: 없음. `notification.retry.maxAttempts`, `NOTIFICATION_BACKOFF_TYPE`
  등은 기존 키이며 target 이 새로 만들지 않는다.
- **파일 경로 충돌**: target 자체가 새 spec 파일을 만들지 않는다(기존 4개 파일의 절 본문만
  수정). plan 파일 경로 `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 도
  기존 파일과 겹치지 않는다(`ls plan/in-progress/` 확인, 동명 파일 없음).

아래는 CRITICAL/WARNING 급은 아니지만 기록해 둘 만한 INFO 항목이다.

- **[INFO]** target 이 `webhook` 봉투에 신규로 명문화하는 최상위 키 `payload`(예:
  `{type, executionId, triggerId, workflowId, seq, timestamp, payload:{…}}`)는, 같은 spec
  문서 §5(Inbound REST, L265/L273)가 이미 별도로 정의한 "전송 봉투" 개념(`TransformInterceptor`
  가 REST 응답을 `{"data": {...}}` 로 감싸는 것)과 **키 이름은 다르지만**(`payload` vs `data`)
  "봉투" 라는 동일 한국어 용어를 다른 wire 키에 재사용한다. 실제 문자열 식별자가 다르므로
  충돌은 아니나(`data` ≠ `payload`), 독자가 두 봉투 개념을 혼동할 여지가 있다 — §6 도입부 신설
  시 "이 봉투는 §5 의 REST `data` 래핑과 다른, webhook 전용 `payload` 래핑" 이라는 한 줄
  구분을 추가하면 향후 혼선을 예방할 수 있다.
  - target 신규 식별자: 없음(문자열 `payload` 는 target 이전에도 코드
    `notification-fanout.service.ts` L123-137 에 이미 존재 — target 은 미문서화 사실을
    문서화할 뿐)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md` L265, L273 (`data` 봉투,
    §5 Inbound REST 전역 규약)
  - 상세: 식별자 문자열 자체는 겹치지 않아 CRITICAL/WARNING 요건(동일 식별자의 다른 의미
    사용)에 해당하지 않는다. 개념적 인접성만 있다.
  - 제안: §6 도입부에 "REST 응답의 `data` 봉투(§5)와는 별개" 라는 구분 문구를 한 줄 추가.

- **[INFO]** target 문서의 frontmatter `worktree: eia-r8-cache-scope-4ae434` 는 현재 세션
  worktree 이름과 일치하지만, 그 worktree 슬러그("r8 cache scope")가 가리키는 주제는
  `plan/in-progress/spec-draft-eia-r8-alignment.md`(별도 worktree
  `eia-spec-r8-alignment-fff754`, §R8 idempotency 캐시 대상 서술 정합)이고, target 문서의
  실제 주제(종결 이벤트 payload 계약 통합)와는 무관하다. 두 plan 은 서로 다른 파일명·다른
  worktree 를 쓰므로 **식별자 충돌은 아니다** — 다만 이 worktree 안에서 두 무관한 주제가
  동시에 진행되고 있다는 점은 orchestrator/plan-lifecycle 관점에서 참고할 만하다(본 리뷰어의
  6개 점검 관점 밖이라 등급 부여는 보류).

## 요약

target 문서(`plan/in-progress/spec-draft-eia-notification-payload-contract.md`)는 신규
요구사항 ID·엔티티/DTO 명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로를 하나도 새로
발급하지 않는다. 이미 EIA §6.1~§6.6, WS §4.1/§4.4, `chat-channel-adapter.md` §1.2/§1.3,
`3-execution.md` §8.1 에 존재하는 이름·이벤트·타입을 재사용하며, 변경의 본질은 "필드 열거를
포인터로 축약"이라 새 식별자 표면 자체가 거의 생기지 않는다. `grep -n "^## \|^### "` 로
`14-external-interaction-api.md` §6 구조를 직접 확인한 결과 `## 6.` 과 `### 6.1` 사이가
실제로 비어 있어 draft 가 주장한 "재넘버링 없이 도입부 삽입 가능"도 사실과 일치했다.
`EIA §6.5 line 536` 인용 6곳(spec 3 · 코드 3)도 grep 으로 재확인해 draft 의 수치가 정확함을
검증했다. 발견된 두 항목은 모두 INFO 등급으로, 실제 식별자 문자열 충돌이 아니라 개념적 인접
용어(`payload` vs `data` 봉투)와 관할 밖 참고사항(worktree 슬러그-주제 불일치)이다.

## 위험도

NONE
