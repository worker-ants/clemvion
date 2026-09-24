# 신규 식별자 충돌 검토 — `spec/5-system` (--impl-prep)

## 조사 범위에 대한 사전 고지

`_prompts/naming_collision.md` 번들은 컨텍스트 예산 초과로 `spec/5-system/17`개 파일 중 3개
(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)만 본문이 포함되고 나머지 14개
(`4-execution-engine.md` 등)는 "의도된 절단"으로 생략되어 있었다. 생략을 "충돌 없음"의
근거로 삼지 않기 위해 저장소의 실제 `spec/5-system/*.md` 17개 파일 전체를 직접 `Read`/`grep`
하여 "미구현(Planned)" 표시가 붙은 — 즉 아직 코드에 없어 새로 도입될 — 식별자를 전수
추출하고, 그 각각을 `spec/`·`codebase/backend/src` 전역에서 재검색해 기존 사용처와의 의미
충돌 여부를 확인했다. 대상 문서 자체는 diff 가 아니라 이미 존재하는 spec 전체이므로(대부분
`status: implemented`/`partial`), "신규 식별자"는 문서 안에 명시적으로 미구현·Planned 로
표시된 항목으로 한정해 조사했다.

## 발견사항

- **[WARNING]** `SYSTEM_STATUS_FAILED_THRESHOLD` — 동일 ENV 키가 비교 기준을 바꿔 재정의됨
  - target 신규 식별자: 없음 (기존 키 재사용) — `spec/5-system/16-system-status-api.md` §3 의
    health 파생 규칙 개정이 **기존 env 키의 의미를 변경**한다.
  - 기존 사용처: `spec/5-system/16-system-status-api.md` §3 (`getFailedDegradedThreshold()` ←
    `SYSTEM_STATUS_FAILED_THRESHOLD`, 기본 1) — 문서 자신이 다음 문장으로 명시: "**의미 변경
    주의**: `SYSTEM_STATUS_FAILED_THRESHOLD` 의 비교 대상이 기존 '보관 중 누적 `failed`'
    에서 '최근 윈도우 `recentFailed`' 로 바뀐다. 기존 설정값을 유지해 배포하면 degraded 판정
    동작이 달라질 수 있다" (R-5).
  - 상세: 식별자(ENV 키 이름)는 그대로인데 그 값이 비교되는 대상(누적 총량 → 최근 윈도우
    카운트)이 바뀐다. 운영자가 과거에 튜닝해 둔 수치(예: threshold=1)를 그대로 배포판에
    올리면, 과거엔 "누적 1건 이상"이라는 매우 민감한 기준이었던 것이 이제는 "최근
    `failedWindowMinutes`(기본 60분) 내 1건 이상"이라는 다른 민감도의 기준으로 조용히
    재해석된다 — 키 이름만 보고 값을 재사용하는 운영자에게 동일 식별자가 다른 의미로
    다가오는 전형적 케이스다.
  - 제안: 문서가 이미 R-5 로 이 사실을 자체 고지하고 있어 CRITICAL 로 올리지는 않았으나,
    구현 시점에 (a) 부팅 로그/헬스 응답에 "threshold semantics changed at vX" 식 1회성
    경고를 남기거나 (b) 아예 `SYSTEM_STATUS_FAILED_THRESHOLD` 를
    `SYSTEM_STATUS_RECENT_FAILED_THRESHOLD` 로 개명하고 구버전 키는 deprecated alias 로
    유지하는 방안을 impl-prep 단계에서 함께 검토할 것을 권한다 — 새 이름을 쓰면 "같은 키,
    다른 의미"라는 이번 항목의 위험 자체가 원천적으로 사라진다.

## 조사했으나 충돌이 확인되지 않은 후보 (근거만 기록)

아래는 review 관점 1~6 에 따라 "새로 도입되는 식별자"로 후보에 올랐으나, 저장소 전역
재검색 결과 기존 사용처와 의미가 충돌하지 않아 발견사항에서 제외한 항목이다(향후 동일
지적이 반복되지 않도록 근거를 남긴다).

- `LLM_TIMEOUT` (§7-llm-client.md 미구현 세분화 에러 코드 논의) — llm-client 계층은 timeout 을
  전용 코드로 매핑하지 **않기로** 명시적으로 결정했는데, 그 이유가 바로
  `codebase/backend/src/nodes/core/error-codes.ts` 의 기존 `LLM_TIMEOUT`(별개 노드 taxonomy)과의
  충돌을 피하기 위함이라고 문서 자신이 밝히고 있다. 즉 이 항목은 충돌이 아니라 "충돌을 미리
  회피한 설계"다.
- `LLM_AUTH_ERROR` / `LLM_MODEL_NOT_FOUND` / `LLM_CONTEXT_EXCEEDED` (§7-llm-client.md Planned
  세분화 에러 코드) — `spec/`·`codebase/backend/src` 전역에 기존 사용처 없음. 신규 도입 시
  충돌 없음.
- `EmbedResponse` (§7-llm-client.md / §8-embedding-pipeline.md Planned 타입) — 기존 사용처
  없음. 두 문서에서 일관되게 같은 의미(usage/dimensions 메타데이터 포함 응답 객체)로만
  언급된다.
- `workflow.executed` (§1-auth.md §4.1 Planned 감사 액션) — `spec/conventions/audit-actions.md`·
  `spec/data-flow/1-audit.md`·`audit-action.const.ts` 주석 3곳에서 동일 의미(고빈도·보존정책
  미정으로 의도적 유예)로 일관되게 미러링됨. 충돌 없음.
- `execution-run` / `execution-continuation` BullMQ 큐 이름 — 실제로는 이미 구현 완료된
  큐이며(§4-execution-engine.md, `system-status.constants.ts` 레지스트리와도 동기화), 신규
  식별자가 아니다.
- health 어휘 `degraded` (§16-system-status-api.md, §3-error-handling.md §609 "vectorDb
  체크 + degraded 3-state 는 Planned") — `notificationHealth`·`chat_channel_health`·시스템
  상태 API 등 기존 여러 표면에서 이미 동일 의미("완전 정상은 아니나 처리는 계속됨")로 쓰이고
  있어, `/api/health` 표면에 뒤늦게 같은 값을 추가하는 것은 의미 충돌이 아니라 어휘 통일에
  가깝다(§16-system-status-api.md R-4 가 근거를 명시).
- 이메일 변경 엔드포인트(`POST /api/users/me/email-change/{request,verify,resend,cancel}`) —
  `spec/5-system/1-auth.md` §1.1.B 는 흐름·재인증·감사만 소유하고, 엔드포인트 정의 SoT 는
  `spec/2-navigation/9-user-profile.md` §6.1 이라고 양쪽에서 상호 참조로 명시. 중복 정의가
  아니라 의도된 단일 SoT 참조.
- LDAP/SAML (§1-auth.md §1.3 미구현) — `spec/0-overview.md` 셀프호스팅 비교표와 일치, 충돌
  없음.
- `maxInterval`(§3-error-handling.md Planned RetryConfig 필드) — 저장소 내 다른 retry/backoff
  설정에서 동명 필드 사용 없음.

## 요약

`spec/5-system` 문서군 자체가 대부분 이미 구현·정착된 spec(mature, 반복 정합성 검토를 거친
영역)이라 순수한 "신규 식별자"는 각 파일에 명시적으로 표시된 미구현(Planned) 항목으로
좁혀졌고, 그 전수를 저장소 전역과 대조한 결과 유의미한 이름 충돌은 발견되지 않았다. 유일한
주목할 사항은 `SYSTEM_STATUS_FAILED_THRESHOLD` ENV 키가 이름은 그대로 둔 채 비교 기준(누적 →
최근 윈도우)만 바뀌는 경우로, 문서가 이미 이 위험을 자체 고지(R-5)하고 있어 CRITICAL 은
아니지만 배포 시 운영자 재검토가 필요하다는 점을 WARNING 으로 남긴다. 프롬프트 번들이 예산
초과로 14개 파일 본문을 생략했다는 사실은 직접 `Read`/`grep` 으로 보완했으므로 이 결론에
영향을 주지 않는다.

## 위험도

LOW
