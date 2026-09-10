# 동시성(Concurrency) 코드 리뷰 — `impl-chat-channel-patch-token` (3라운드, `00_21_55`)

## 검토 방법

이번 라운드의 diff(`origin/main...HEAD`)는 (1) 실제 코드 변경 7개 파일(`ChatChannelUpdateConfigDto`
신설, `TriggersService` secret 쓰기 게이팅/검증)과 (2) 이미 두 차례 진행된 이전 리뷰 라운드
(`review/code/2026/09/10/23_21_57`, `review/code/2026/09/10/23_55_23`)의 산출물·plan·consistency
산출물이 커밋된 것으로 구성된다. 동시성 관점의 실질 표면은 (1)뿐이므로 여기 집중했고, 이전
라운드의 `concurrency.md`(23_55_23)가 이미 WARNING(MEDIUM)으로 지적한 지점이 있어 **그 지적이
현재 소스에도 여전히 유효한지**를 직접 `Read`로 재확인하는 데 검토를 집중했다. 저장소에 뮤테이션은
가하지 않았다(`git status --short` 확인, 확인 목적으로 뮤테이션이 필요하지 않았다).

## 발견사항

- **[WARNING]** 같은 트리거에 대한 동시 PATCH 가 `Trigger.config` 를 잃을 수 있다(lost update) —
  이전 라운드가 지적한 지점이 이번 diff 로도 해소되지 않고 그대로 남아 있음을 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 의
    `findById` 스냅샷 읽기(500행 부근)~`previousInboundSigningRef` 캡처(524~528행)~
    `triggerRepository.save(trigger)`(553~556행 부근), 그리고 `setupChatChannel()` 내부의
    두 번째 영속화 지점(`const newConfig = { ...(trigger.config ?? {}), chatChannel: mergedChannel }`
    → `this.triggerRepository.update(...)`, 1204~1215행 부근; 실패 경로의 `fallbackConfig` 도
    동일 패턴, 1240행 부근).
  - 상세: `update()` 는 요청 시작 시점에 `trigger` 를 한 번 읽어 그 in-memory 스냅샷을
    `assertChatChannelAlreadySetUp` 판단 → `Object.assign` 병합 → `save()` → `recordAudit` →
    `syncScheduleActivation` → `normalizeNotificationSecretRef` → `setupChatChannel()`(외부
    adapter HTTP 호출 포함)까지 여러 `await` 를 거치는 동안 계속 재사용한다. `setupChatChannel()`
    내부에서도 `trigger.config`(= `update()` 가 넘긴 `saved`, 즉 그 함수 진입 시점의 스냅샷)를
    다시 스프레드해 **두 번째** `triggerRepository.update()` 로 `config` 컬럼 전체를 덮어쓴다.
    `Trigger` 엔티티에 `@VersionColumn` 이 없고(`entities/trigger.entity.ts` 전수 확인 — 버전
    컬럼 0건), 이 read-modify-write 전체를 감싸는 트랜잭션이나 `SELECT ... FOR UPDATE` 행 잠금도
    없다. 즉 같은 트리거에 대해 (a) `chatChannel` 을 포함하지 않는 PATCH B(예: `name` 변경만)와
    (b) `chatChannel` 을 포함하는 PATCH A 가 겹치면, B 가 A 보다 먼저 `config` 를 읽었지만 A 의
    두 번째 `update()`(setupChatChannel 내부)보다 **나중에** 커밋될 경우 B 의 `save()` 가 A 가
    막 반영한 `chatChannel.inboundSigningRef` 존재 여부를 B 의 오래된 스냅샷으로 되돌려 쓸 수
    있다.
  - 파급: `ChatChannelInboundAuthenticator` 는 세 provider 모두 `if (!config.inboundSigningRef) return;`
    로 fail-open 이다(`review/code/2026/09/10/23_21_57/RESOLUTION.md` CRITICAL #1 이 이미 실측).
    이번 PR 이 단일 요청 관점에서 막 닫은 "카드 편집 PATCH 한 번으로 인입 서명 검증이
    fail-open 된다" 는 결함과 정확히 같은 증상이, 동시 요청의 인터리빙을 통해 재발할 수 있는
    경로가 여전히 남아 있다.
  - **이미 정식으로 triage 되어 있음** — 이 지적은 신규가 아니라 이전 라운드(`review/code/2026/09/10/23_55_23/concurrency.md` W1)가 먼저 냈고, `RESOLUTION.md`(`23_55_23`)가 developer
    SKILL §ISSUE FIX 정책의 수렴 예외 (a)(b)(c)를 인용해 **의도적으로 이번 PR 범위 밖으로 defer** 했다
    — 처방(advisory lock / `SELECT ... FOR UPDATE` / 낙관적 버전 비교)이 `update()` 뿐 아니라
    자매 메서드 `rotateChatChannelBotToken()`(1541~1550행 부근, 동일한 blind-overwrite 패턴)까지
    함께 바꿔야 해서 이 PR(두 CRITICAL 을 닫는 것)의 스코프를 넘는다는 근거다. 그 처분은
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(2116~2126행)에 실제로 등재돼
    있음을 직접 열어 확인했다 — 근거·처방 후보·자매 패턴 언급까지 정확히 대응한다. **사전 존재
    설계**(CCH-SE-01 best-effort 2단계 커밋)이지 이번 PR 이 새로 만든 아키텍처가 아니다 — 다만
    이번 PR 은 그 위에 새 보안 로직(`inboundSigningRef` 보존)을 얹어 그 레이스의 파급을 보안에
    중요한 영역으로 넓혔다.
  - 이번 라운드(round 2 fix, 커밋 `83d5f3f94`)가 이 지점을 조금이라도 건드렸는지 직접
    확인했다 — `git show 83d5f3f94 -- triggers.service.ts` 의 변경분은 `assertChatChannelInputSafe`
    에 함수 오버로드 2개(컴파일 타임 전용, `mode` 문자열 판별자와 DTO 타입을 타입 체커 수준에서
    결속)를 추가한 것뿐이고, `update()`/`setupChatChannel()`의 읽기-쓰기 구간·트랜잭션 경계는
    전혀 변경되지 않았다. 즉 이번 라운드는 레이스의 성격이나 범위를 바꾸지 않았다.
  - 제안: 새로운 제안은 없음 — 이전 라운드가 남긴 처방(트리거 단위 advisory lock 또는
    `SELECT ... FOR UPDATE` 로 `update()`/`setupChatChannel()`/`rotateChatChannelBotToken()` 의
    read-modify-write 구간 직렬화, 최소한 `config` 컬럼 낙관적 버전 비교)이 여전히 유효하며,
    이미 중앙 트래커에 등재돼 있으므로 이번 라운드에서 추가로 등재할 필요는 없다.

## 확인된 것 — 문제 없음

- `secrets.rotate()`(`SecretResolverService`)는 키별 UPSERT 로 구현돼 있어 개별 secret 쓰기
  자체는 동시 rotate 호출에 대해 원자적이다(위 발견은 secret store 가 아니라 `Trigger.config`
  JSONB 컬럼 전체 교체 패턴에 대한 것).
- `create()`/`update()` 모두 `await this.setupChatChannel(...)` 를 정상적으로 `await` 하고
  있고, 이번 diff 가 추가한 비동기 분기(`storeUserSuppliedSecrets` 게이팅에 걸린 `secrets.rotate`
  호출들) 중 `await` 누락은 없다. 이전 라운드(`83d5f3f94`)가 추가한 함수 오버로드 2개는 순수
  컴파일 타임 타입 선언이라 런타임 동작·동시성 표면에 영향이 없다.
- DTO 파일(`chat-channel-config.dto.ts`, `update-trigger.dto.ts`)·컨트롤러 Swagger 설명
  변경은 선언적 클래스/데코레이터/문서 문자열 수정뿐이라 동시성 표면이 없다.
- 신규·수정 테스트(`trigger-dto-validation.spec.ts`, `triggers.service.spec.ts`)는
  `it`/`it.each` 순차 실행 표준 패턴만 쓰고 `test.concurrent` 등 병렬 실행 지시자를 쓰지 않아
  테스트 간 상호 오염 위험은 없다. 두 파일의 실측 케이스 분리(비어있지 않은 값 vs `null`/`''`)도
  동시성과 무관한 입력 형태 축이다.
- `Trigger` 엔티티에 `@VersionColumn` 이 없다는 사실 자체와 `rotateChatChannelBotToken()` 의
  동일 blind-overwrite 패턴은 이번 diff 가 만든 것이 아닌 기존 아키텍처이며, 신규 결함으로
  보고하지 않는다.

## 요약

이번 라운드(3라운드)의 diff 는 DTO 계층 분리와 서비스 검증 로직 재정비가 중심이고, 그 자체에는
`async`/`await` 누락이나 새로운 경쟁 조건·데드락이 없다. 유일한 동시성 관련 사안은 이전 라운드가
이미 발견해 WARNING(MEDIUM)으로 기록한 "동시 PATCH 가 `Trigger.config` 를 잃을 수 있다(lost
update)" 이며, 직접 소스를 다시 읽어 그 지적이 현재 코드에도 여전히 유효함을 재확인했다. 다만 이
사안은 (1) 사전 존재 아키텍처(트랜잭션/낙관적 잠금 부재)이고 이번 PR 이 새로 만든 것이 아니며,
(2) 이전 라운드의 `RESOLUTION.md` 가 developer SKILL §ISSUE FIX 정책의 수렴 예외 (a)(b)(c)를
근거로 이미 이번 PR 범위 밖으로 defer 했고, (3) 그 처분이 `plan/in-progress/spec-draft-nullable-notation-followups.md` 중앙 트래커에 실제로 등재돼 있음을 확인했다. 이번 라운드(round 2 fix,
`83d5f3f94`)는 이 레이스가 걸린 구간을 전혀 건드리지 않았다 — 추가된 것은 컴파일 타임 타입
오버로드뿐이다. 따라서 이번 라운드에서 새로 발견되거나 악화된 동시성 결함은 없고, 이미 정당하게
triage 된 기존 항목의 재확인만 남는다.

## 위험도

LOW
