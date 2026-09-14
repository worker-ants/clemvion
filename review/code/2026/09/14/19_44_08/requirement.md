# 요구사항(Requirement) 리뷰 — trigger-config-lost-update

## 검토 범위와 방법

이 PR 은 3라운드째 `/ai-review` 를 받는 상태다(`review/code/2026/09/14/18_17_44`,
`19_07_43` 가 이미 포함돼 있음). 두 라운드가 지적한 CRITICAL/WARNING 은 커밋
`567c82edb`(동시 PATCH 되돌림 수정) · `12ed21ff1`(창 1 도 락 안으로) · `c7a9c107e`(1라운드
수정이 만든 새 lost update + 웹훅 hot path fail-open)로 이미 처리돼 있다. 본 라운드에서는
- 핵심 구현 파일 실제 소스를 전문 Read (`trigger-config-lock.ts`,
  `chat-channel-binder.service.ts`, `triggers.service.ts` 의 `create`/`update`/
  `rotateBotToken`/`mergeExternalConfig`, `hooks.service.ts` 의 hot-path 두 자리)
- e2e 시나리오(`trigger-config-lost-update.e2e-spec.ts`)를 단계별로 손으로 추적해 어서션
  ①②③④ 가 실제로 코드 경로와 맞물리는지 확인
- `npx jest src/modules/triggers src/modules/hooks src/repo-guards`(전량, 저장소 트리
  변경 없이 실행) — 전부 GREEN(트리거 293/1skip, 훅 98/98, repo-guards 246/246)
- `npx tsc --noEmit -p tsconfig.json` — trigger/hooks/repo-guards 관련 신규 에러 없음
  (남은 타입 에러는 이 PR 이 건드리지 않은 파일: `auth-configs.service.spec.ts`,
  `workflow-assistant/tools/review-workflow.spec.ts`, carousel/cafe24-mcp 등 — 전수
  `git diff origin/main...HEAD --name-only` 대조로 확인)
- `spec/5-system/15-chat-channel.md` grep — advisory lock/lost-update 메커니즘은 spec
  본문에 없음(`plan` frontmatter `spec_impact: none` 과 일치, 순수 동시성 구현 세부)

저장소에 변경을 남기지 않았다(`git status --short` 최종 확인, review 산출물 디렉터리 외
diff 없음).

## 발견사항

- **[INFO]** 핵심 동시성 수정(4개 창)이 실제로 요구사항(lost-update 방지·fail-open 차단)을
  충족함을 코드 추적 + 테스트 실행으로 확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 전체,
    `chat-channel-binder.service.ts:264-278`(성공)·`:303-314`(catch),
    `triggers.service.ts:548-586`(update 창1)·`:1159-1169`(rotateBotToken)
  - 상세: `rewriteTriggerConfigLocked` 가 advisory lock(`trigger-config:<id>`) 획득 →
    락 안 재읽기 → `merge(fresh.config ?? {})` → `columns` 와 병합 → `update` 순으로
    동작하고, `config` 를 항상 **뒤에** 스프레드해 호출부 컬럼이 실수로 덮지 못하게 한다.
    `create()`/`update()`/`rotateBotToken()`/`setupChatChannel` 네 자리 모두 이 계약을
    지킨다. e2e 시나리오를 손으로 추적한 결과 — B(카드 편집 PATCH, ref 없음)가 락에 걸려
    대기하는 동안 A(telegram server-issued 발급 성공, 통짜 스냅샷 저장)가 커밋하면, B 의
    `update()` 창1이 락 안에서 A 의 커밋 결과를 재읽어 `previousInboundSigningRef` 를 A 의
    ref 로 재계산하고(513·562-563행), 이후 `setupChatChannel` catch 경로가
    `preservedInboundSigningRef` 를 통해 그 ref 를 보존한다. `rateLimitPerMinute=42` 와
    `untouchedByPatchB` 키도 창1의 재읽기 병합으로 살아남는다 — e2e 세 어서션(①②③)이
    실제로 각기 다른 코드 경로를 문다.
  - 결론: 차단 사유 없음. 참고용 기록.

- **[INFO]** 웹훅 hot path 두 자리(`hooks.service.ts`)가 컬럼 한정 `update()` 로 정확히
  교체됨 — commit 메시지·CHANGELOG·PR 의도와 구현이 일치
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:232-236`(`handleWebhook`),
    `:700-704`(`handleChatChannelWebhook`)
  - 상세: 둘 다 `trigger.lastTriggeredAt = new Date()` 뒤 `triggerRepository.update({id},
    {lastTriggeredAt})` 만 호출 — `save(trigger)` 잔존 없음(grep 확인:
    `grep -n "triggerRepository.save\|save(trigger)" hooks.service.ts` 결과 0건).
    신규 테스트(`hooks.service.spec.ts` 신규 `it`)가 `save` 미호출 + `update` patch 의
    키 집합이 `['lastTriggeredAt']` 뿐임을 단언해, "컬럼만 갱신" 이라는 함수 의도와
    구현이 line-level 로 일치한다.

- **[INFO]** 의도적으로 유예된 항목(`remove()` 미락·상태 컬럼 락 밖·헬퍼 `Trigger` 하드코딩
  등)은 plan(§D 후속 표) · 이전 라운드 `database.md`/`architecture.md` 에 이미 INFO 로
  등재·수용돼 있고, 위험도 근거(고아 UPDATE 무해·보안 무관)도 타당해 재지적하지 않는다.

- **[INFO]** spec fidelity — `spec/5-system/15-chat-channel.md` 본문에는 advisory
  lock/lost-update 방지 메커니즘 자체가 정의돼 있지 않다(순수 구현 세부, 요구사항 ID
  없음). `R-CC-22` 의 `code:` glob 이 `trigger-config-lock.ts` 를 아직 물지 않는 것은
  이미 plan(§D `--impl-prep` 등재 표)과 이전 라운드 `documentation.md`/`requirement.md`
  가 planner 범위로 등재해 뒀다 — 새로 지적할 spec 불일치 없음. 이 파일의 나머지 spec
  참조(`R-CC-21`, §5.4.1.1, ChatChannelConfig)는 구현과 대조했을 때 문구·필드명·게이팅
  조건이 spec 대로다(`inboundSigningRef` 단일 슬롯, provider-issued vs server-issued
  구분, PATCH 는 비밀 미수신 등).

이번 라운드에서 CRITICAL/WARNING 급 신규 발견은 없다. 코드가 스스로 반증한 이전 유예
근거(창1)를 정정하고, 그 정정이 만든 새 결함(창1의 `save` 가 형제 창의 컬럼 커밋을 덮음)과
가장 잦은 경로(웹훅 hot path)의 같은 클래스 결함까지 이번 배치에서 닫은 것으로 확인된다.

## 요약

핵심 요구사항 — "동시 PATCH/rotate/웹훅 인입이 `trigger.config` 를 lost-update 없이 갱신하고,
그 결과로 `inboundSigningRef` 가 fail-open 으로 되돌아가지 않는다" — 를 코드가 실제로
충족함을 소스 추적 + e2e 시나리오 재구성 + 전체 유닛 테스트 재실행(트리거 293/1skip, 훅
98/98, repo-guards 246/246, 전부 GREEN)으로 확인했다. `create`/`update`/`rotateBotToken`/
`setupChatChannel` 네 창이 같은 advisory lock 프리미티브(`rewriteTriggerConfigLocked` 또는
그 인라인 구현)를 공유하고, presence 게이트를 락 안에서 재계산하며, 웹훅 hot path 두 자리도
컬럼 한정 `update` 로 같은 결함 클래스를 닫았다. TODO/FIXME 류 미완성 표식은 없고, 반환값·
에러 경로(트리거 삭제 레이스 시 `false` 반환, best-effort catch)도 문서화된 계약과 일치한다.
spec 본문과의 불일치도 발견되지 않았다(이 구현 자체가 spec 대상이 아닌 동시성 세부이거나,
이미 planner 범위로 등재된 R-CC-22 glob 갭뿐). 남은 항목(창1 이외 `save()` 8곳 등)은
plan 이 실측 근거와 함께 명시적으로 후속으로 유예했고 근거가 타당하다.

## 위험도

NONE
