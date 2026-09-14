# 변경 범위(Scope) 리뷰 — trigger-config-lost-update

## 검토 방법

`git diff origin/main...HEAD --stat`(93 files, +8651/-75)로 변경 전수를 확인한 뒤,
`codebase/**` 아래 16개 실제 코드 파일의 diff 전량을 `git diff origin/main...HEAD -- <path>`
로 직접 열어 대조했다(프롬프트에는 크기 제한으로 일부가 생략돼 있었음). 프런트엔드/패키지/
channel-web-chat 은 diff 0건임을 `git diff --stat` 로 확인했다.

## 발견사항

변경 범위를 벗어나는 항목을 발견하지 못했다. 참고로 남기는 항목은 다음과 같다.

- **[INFO]** 웹훅 인입 hot path(`hooks.service.ts`)까지 고친 것은 "PATCH 동시성" 이라는
  1차 제목보다 넓어 보이지만, CHANGELOG·plan 이 "같은 결함 클래스(스냅샷 통째 save 로 인한
  `inboundSigningRef` 유실)가 PATCH 보다 더 잦은 인입 경로에도 있다"는 근거로 명시적으로
  스코프에 편입한 것이다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — 신설 `touchLastTriggeredAt`
    (게이트 978), 두 호출부(게이트 227, 686)
  - 상세: `git diff origin/main...HEAD -- CHANGELOG.md` 게이트 23~25("웹훅 인입 경로도 함께
    고쳤다…")가 이 편입을 정당화한다. `save(trigger)` → `touchLastTriggeredAt()`(컬럼 한정
    `update`)로 바뀐 것 외 다른 필드·로직 변경은 없다. drive-by 리팩터가 아니라 같은 근본
    원인(entity 통째 `save`)의 다른 발현이라 스코프 이탈로 보지 않는다.
  - 제안: 없음 — 근거가 이미 기록돼 있다.

- **[INFO]** `chat-channel-input-rules.ts` 에 `extractInboundSigningRef` 헬퍼를 신설해
  세 자리에 복제돼 있던 인라인 캐스트를 통합한 것도 이 PR 의 핵심 수정(binder ·
  `triggers.service.ts` · 신규 테스트)이 그 값을 반복해서 재계산해야 하는 데서 직접 파생된
  필요이며, 범위를 넘는 독립 리팩터링이 아니다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 게이트 247-250
  - 상세: 이 함수가 쓰이는 자리(`chat-channel-binder.service.ts` 의 `survivesWithFresh`,
    `triggers.service.ts` 의 `previousInboundSigningRef`)는 모두 이번 lost-update 수정이
    "재읽은 행에서 presence 를 다시 계산"해야 하는 지점들이다. 기존 코드(`triggers.service.ts`
    의 예전 인라인 캐스트)도 이번에 이 헬퍼로 교체됐지만, 그 교체가 이 PR 이 새로 건드리는
    바로 그 줄(§`previousInboundSigningRef` 계산부)이라 "무관한 코드까지 손댄" 리팩터는
    아니다.
  - 제안: 없음.

- **[INFO]** `repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`(및 spec·fixture)
  변경은 트리거 도메인 로직이 아니라 정적 분석 가드지만, 이 PR 이 `update()`/`rotateBotToken`
  의 저장 형태를 `this.triggerRepository.save(trigger)` 에서
  `manager.transaction(async (m) => m.save(Trigger, fresh))` 로 바꾼 결과 기존 가드가 수신자
  이름만 보고 그 저장을 "사라졌다"고 오판(false RED)하게 된 것을 이 PR 이 직접 유발했다.
  가드를 함께 고치지 않으면 이 PR 자체가 CI 래칫을 깬다 — 무관한 영역 수정이 아니라 이 PR 이
  만든 부작용의 필수 후속 조치다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
    게이트 35(`TRIGGER_ENTITY` 상수), 게이트 119-120(콜백 경계 판정), 게이트 162-170
    (`isManagerTriggerSave` 판정)
  - 상세: 커밋 메시지·CHANGELOG 등재("창 1 도 닫는다…")와 `endpoint-path-conflict-wrap.spec.ts`
    게이트 67-68 주석("`update` 의 저장은 `manager.transaction` 안으로 들어갔다")이 이 인과를
    스스로 설명하고 있어, 별도 확인 없이도 스코프 내 필수 수정임을 알 수 있다.
  - 제안: 없음.

- **[INFO]** `review/code/2026/09/14/{18_17_44,19_07_43,19_44_08,20_17_16}/**` ·
  `review/consistency/2026/09/14/17_10_16/**` 총 79개 산출물 파일과
  `plan/in-progress/trigger-config-lost-update.md` 는 코드 diff 자체는 아니지만, 이 저장소의
  `CLAUDE.md` §Skill 체계가 "구현 완료 후 `/ai-review` + Critical/Warning fix"를 상시 승인된
  강제 의무로 규정하고 있고, `plan/` 은 개발자 쓰기 권한 영역이다. 다섯 라운드의 리뷰-수정
  반복 이력이 SUMMARY/개별 리포트로 누적된 것은 이 프로젝트의 표준 워크플로 산출물이며 임의
  추가가 아니다.
  - 위치: 해당 없음(디렉터리 단위)
  - 상세: 프로젝트 메모(`feedback_review_fix_stale_loop.md`)에도 "fix 는 모아서 하고 리뷰"·
    "종료 조건은 codebase/ 수정 0 으로 끝나는 라운드"라는 규약이 있어, 여러 라운드가 누적되는
    것 자체가 이 종류 PR 의 정상 형태다.
  - 제안: 없음 — 코드 리뷰 스코프 관점에서 조치 불필요.

- **[INFO]** 코드 변경이 `codebase/backend` 로만 국한됨을 확인 — `codebase/frontend`,
  `codebase/packages`, `codebase/channel-web-chat` 는 diff 0건(`git diff --stat` 로 확인).
  포맷팅 전용 hunk 나 whitespace-only 변경도 `git diff --check` 로 0건을 확인했다.

## 요약

`git diff origin/main...HEAD` 전수(93 files)를 직접 열어 대조한 결과, 실제 애플리케이션
코드 변경은 `codebase/backend` 의 16개 파일(트리거 config lost-update 를 막는 advisory-lock
+ 재읽기 유틸(`trigger-config-lock.ts`)과 그 4개 쓰기 지점, 웹훅 hot-path 의 같은 결함 클래스
수정, 그 결과로 파생된 헬퍼 통합·정적 가드 보정, 테스트 인프라)에 국한되며 전부 CHANGELOG·
plan 문서가 명시한 인과로 설명된다. 프런트엔드·패키지·설정 파일·의존성(lockfile) 변경은
없고, 포맷팅 전용 diff 나 무관한 리팩터링·주석·임포트 정리도 발견되지 않았다. 나머지 다수
파일은 이 프로젝트가 강제하는 `/ai-review`·`consistency-check` 워크플로의 산출물(`review/**`)과
작업 추적 문서(`plan/**`)로, 코드 diff 스코프 이탈이 아니다. 변경 범위(Scope) 관점에서
지적할 사항이 없다.

## 위험도

NONE
