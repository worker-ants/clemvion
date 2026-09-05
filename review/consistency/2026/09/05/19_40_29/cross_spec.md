# Cross-Spec 일관성 검토 — `spec-draft-notification-secret-storage.md`

## 검토 범위

target: `plan/in-progress/spec-draft-notification-secret-storage.md` (planner 턴,
`notification_secret_v2` 저장 형태 사실관계 정정안). 아래 계획된 4개 spec 변경을 실제 코드·
인접 spec 과 대조했다.

- `spec/5-system/14-external-interaction-api.md` §7.1 (사실 정정 + 이탈 blockquote)
- `spec/conventions/secret-store.md` §1 (`notification-signing.v2` 행에 미이행 고지)
- `spec/5-system/2-api-convention.md` frontmatter `code:` (정적 검증자 등재, W2)
- `spec/2-navigation/4-integration.md` §9.1 (IntegrationDto derived 필드 포인터, W3)

## 발견사항

- **[INFO]** `code:` frontmatter 동시 편집 — 다른 진행 중 planner 초안과 같은 블록을 겨냥
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:` (W2 변경안)
  - 충돌 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (worktree `plan-in-progress-items-b0c80b`) §완료 항목 "`2-api-convention.md`
    frontmatter `code:` 에 §5.4 검증자 등재" — 이미 커밋 `983fd0ade`(`docs(spec): §5.4
    검증자를 양쪽 규약에 등재…`)로 반영됨
  - 상세: 두 초안이 실제로 등재하려는 **검증자는 다르다** — 완료된 항목은 **런타임**
    검증자(`response-contract*.ts`, §5.4 축)를 `2-api-convention.md`/`swagger.md` 양쪽에
    이미 넣었고, 현재 target 은 **정적** 검증자(`swagger-dto-contract*.ts`)가
    `swagger.md` 에만 있고 `2-api-convention.md` 에는 빠진 것을 채운다. 실측:
    `2-api-convention.md` 의 `code:` 는 현재 `response-contract*.ts`·`swagger-probe*.ts`
    만 있고 `swagger-dto-contract*.ts` 는 없다 (`swagger.md` 에는 셋 다 있음) — target
    의 사실관계 진단은 정확하다. 다만 같은 YAML 리스트를 두 세션이 시차를 두고 건드리므로
    머지 순서에 따라 diff 충돌 여지가 있다.
  - 제안: 내용 충돌은 없음 — 그대로 진행하되, 머지 전 `2-api-convention.md` 의 `code:`
    최신 상태(983fd0ade 반영분)를 기준으로 rebase 확인.

- **[WARNING]** W3 의 전제("IntegrationDto 최근 선언 필드")가 아직 `origin/main` 에 없다
  — 병렬 미병합 브랜치 의존
  - target 위치: target 문서 §③ "`spec/2-navigation/4-integration.md` §9.1 (W3)"
  - 충돌 대상: 로컬 브랜치 `claude/sweep-response-contract-5ba0ad`
    (commit `dfb2664af` "트리거 회전 secret 이 두 경로로 나가고 있었다 — §5.4 스윕 1차")
  - 상세: `mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·
    `consecutiveNetworkFailures` 를 `IntegrationDto` 에 실제로 선언한 커밋은 이 미병합
    브랜치에만 있다 (`git merge-base HEAD dfb2664af` = `HEAD` 자체, 즉 `dfb2664af` 는
    `origin/main` 의 후손이 아니라 별도 브랜치). 이 worktree 의 실제
    `integration-response.dto.ts` 를 읽으면 그 5필드가 아직 선언돼 있지 않다. 또한 target
    문서 서두의 "checker 지적" 근거 자체(§① 실측)가 같은 `sweep-response-contract`
    브랜치를 전제로 한다고 target 스스로 밝히고 있어 이 의존은 의도된 것으로 보이나,
    **두 트랙의 병합 순서**가 어긋나면(이 spec 초안이 먼저 `main` 에 랜딩) `4-integration.md`
    §9.1 이 아직 존재하지 않는 DTO 필드를 "이미 선언된 것"처럼 가리키는 순간이 생긴다.
  - 제안: `4-integration.md` §9.1 포인터 반영을 `sweep-response-contract` 브랜치 병합
    **이후**로 순서를 명시하거나, 최소한 target 문서에 그 선행 의존을 한 줄 적을 것.

- **[WARNING]** `consecutiveNetworkFailures` 는 같은 코드 트랙에서 "노출 중단 후보"로
  이미 등재된 필드 — 포인터가 안정적 노출처럼 문서화할 위험
  - target 위치: target 문서 §③ W3 "IntegrationDto 가 최근 선언한 필드(… ·
    consecutiveNetworkFailures)는 신규 노출이 아니라 선언이 뒤늦게 정합된 것"
  - 충돌 대상: `dfb2664af` 커밋 본문 — "`IntegrationDto.consecutiveNetworkFailures` 만 FE
    참조 0곳이라 노출 중단 후보로 등재했다" 및 해당 DTO 필드의 JSDoc
    "**프런트엔드 참조가 0곳**이라 유일하게 소비되지 않는 필드… 빼는 것은 wire
    변경(파괴적)이라 CHANGELOG 를 동반해야 한다 — 별도 항목으로 트래커에 남긴다"
  - 상세: target 이 계획하는 `4-integration.md §9.1` 포인터가 5개 필드를 동급으로
    문서화하면, `consecutiveNetworkFailures` 하나만 이미 "제거 후보"라는 사실이 가려진다.
    이 필드가 나중에 실제로 제거되면 방금 추가한 포인터가 다시 stale 해진다.
  - 제안: 포인터 문구에 `consecutiveNetworkFailures` 는 "FE 미소비 — 제거 후보로 별도
    추적 중" 캐비엇을 함께 적어 다음 사람이 5필드를 동일 신뢰도로 읽지 않게 할 것.

- **[INFO]** `spec/1-data-model.md §2.8` 의 `notification_secret_v2` 행이 인접 서술이지만
  target 의 `spec_impact` 밖에 있다
  - target 위치: target 문서 §③ "`spec/5-system/14-external-interaction-api.md` §7.1"
    변경안 (data-model.md 는 `spec_impact` 미포함)
  - 충돌 대상: `spec/1-data-model.md:240` "`notification_secret_v2` … (NOT NULL 이면
    `config.notification.signing.secret` 와 둘 다 검증)"
  - 상세: 실제로는 모순이 아니다 — `config.notification.signing.secret` 는 legacy
    fallback 평문 필드로 코드에 실재한다(`notification-webhook.processor.ts:43,86-90`,
    `secretRef` 미존재 시 fallback). 다만 이 행은 `secretRef`(현재 우선 경로)를 언급하지
    않아 `notification_secret_v2` 검증 흐름을 어느 하나만 읽으면 완전히 파악하기 어렵다.
    target 의 목적이 "이 컬럼의 사실관계를 spec 전역에서 정확히" 맞추는 것이므로, 같은
    구조를 설명하는 인접 SoT 문서가 target 의 교정 범위 밖에 남는다.
  - 제안: 반드시 이번 턴에 처리할 필요는 없음(모순은 아님) — 다만 후속 그루밍 항목으로
    "data-model.md §2.8 이 `secretRef` 우선순위를 언급하지 않는다"를 남겨 둘 것.

- **[INFO]** EIA-NX-12(§3.1)가 이미 "1회 평문 반환"을 명시 — §7.1 교정문과 상호 링크 권장
  (충돌 아님, 정합 강화 제안)
  - target 위치: target 문서 §③ EIA §7.1 변경안
  - 참조: `spec/5-system/14-external-interaction-api.md:81` EIA-NX-12 — "응답에 새
    secret 을 1회 평문 반환하는 특권 작업이라 액터·시각이 남아야 한다"
  - 상세: 이 문장은 이미 "1회 노출 시점의 평문"을 정당한 것으로 인정하고 있다(신규
    rotate 응답의 관례적 1회 노출). target 이 §7.1 에 신설할 "현재 구현은 평문 컬럼"
    blockquote 와 이 조항은 서로 다른 것을 말한다(하나는 "응답 1회 노출", 하나는
    "DB 컬럼 자체가 평문") — 모순은 없으나 나란히 두면 독자가 "그 1회 노출이 곧 저장
    형태"라고 오인하지 않도록 상호 참조를 링크하면 좋다.
  - 제안: §7.1 신설 blockquote 말미에 "(rotate 응답의 1회 평문 노출 자체는 EIA-NX-12 로
    이미 의도된 설계)" 한 줄 추가 고려.

## 검증된 사실관계 (충돌 아님 — 대조 결과 기록)

- 코드 실측 결과 target 의 ①(사실관계) 은 정확하다: `triggers.service.ts`
  `rotateNotificationSecret()` 의 JSDoc 자체가 이미 "1. …컬럼에 새 secret **평문** 저장"
  이라 적고 있고, `trigger.entity.ts` 의 `notificationSecretV2` 주석은 `chatChannelTokenV2`
  주석("secret store ref … **plaintext 아님**")과 달리 ref 를 주장하지 않는다.
- `spec/5-system/15-chat-channel.md` §R-K 는 이미 두 컬럼의 "명명 패턴은 동일하나 의미는
  다르다"는 비대칭을 인정하고 있어 target 의 §7.1 교정과 모순되지 않는다.
- `secret-store.md §1` 의 `notification-signing.v2` ref 이름 자체(카탈로그 엔트리)는
  target 이 예외 목록을 늘리지 않기로 한 결정과 상충하지 않는다 — 그 테이블은 "정의된
  ref 이름" 목록이지 "현재 컬럼이 그 ref 를 쓴다"는 보장이 아니다.
- RBAC·상태 전이·요구사항 ID 축에서는 target 이 새 권한 구조·상태 머신·ID 를 도입하지
  않으므로 해당 축의 충돌은 발견되지 않았다.

## 요약

target 초안은 `notification_secret_v2` 컬럼의 저장 형태(평문 vs ref)에 대한 사실관계
정정을 코드 실측으로 뒷받침하고 있고, 인접 spec(`chat-channel.md` §R-K, `secret-store.md`
§1, `1-data-model.md` §2.8)과 정면으로 모순되는 지점은 없다. 발견된 항목은 전부 조율·순서
문제다 — (1) 같은 `2-api-convention.md` frontmatter `code:` 블록을 겨냥하는 별도 진행 중
planner 초안과의 편집 조율, (2) W3(§9.1 포인터)의 전제가 아직 `origin/main` 에 없는 병렬
미병합 브랜치(`claude/sweep-response-contract-5ba0ad`)에만 존재해 병합 순서에 의존한다는
점, (3) `consecutiveNetworkFailures` 가 이미 "제거 후보"로 등재돼 있어 포인터 문서화 시
그 사실을 함께 적지 않으면 곧 다시 stale 해질 위험. CRITICAL 급 데이터 모델·API 계약·RBAC·
상태 전이 충돌은 없다.

## 위험도

LOW
