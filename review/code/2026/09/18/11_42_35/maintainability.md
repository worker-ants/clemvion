# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 개요

이번 변경은 `#1346`(트리거 삭제 자원 정리) 머지 뒤 남은 stale 주석 8곳 정리 + 메서드 리네임
(`teardownChannelConfig` → `teardownRegisteredChannel`) 1건이다. **동작 변경 없음** — 순수
문서/이름 정정 PR. 그 특성에 맞춰 이번 리뷰는 (a) 리네임이 전 콜사이트에 일관되게 적용됐는지,
(b) 새로 쓴 주석 자체가 가독성·중복·미래 staleness 관점에서 건강한지에 집중했다.

## 발견사항

- **[INFO]** 리네임(`teardownChannelConfig` → `teardownRegisteredChannel`)은 정의부 + 전 콜사이트
  + 테스트 mock/이벤트 라벨까지 일관되게 적용됨 — 긍정적 확인
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:380`(정의),
    `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:252`·`:370`(내부 호출 2곳),
    `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:123`(프로덕션 호출부),
    `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts:53`·`:315`(mock·단언)
  - 상세: 저장소 전수 grep 결과 옛 이름 `teardownChannelConfig` 는 새 JSDoc 안의 "이전 이름은 …였다"
    라는 역사적 언급 한 곳(`chat-channel-binder.service.ts:377`)만 남고 실제 코드 참조는 0건이다.
    새 이름은 `teardownChatChannel`(저장된 config 로 해제)과 어순만 다르던 옛 이름의 혼동 소지를
    실제로 없앤다 — grep·로그에서 두 메서드가 섞이던 문제(주석이 밝히는 도입 사유)를 해소하는
    쪽으로 이름이 개선됐다. `@link` 크로스레퍼런스로 자매 메서드와의 관계도 명확히 문서화됨.
  - 제안: 없음(양호). consistency check(`naming_collision` checker)도 저장소 전역 충돌 0건을
    별도로 확인함.

- **[INFO]** 같은 사실("네 삭제 경로가 커밋 뒤에 비밀을 지운다")이 4~5개 파일에서 매번 다른 문장으로
  재서술됨 — 단일 정본 문구 없이 자유 재서술이 반복되는 패턴
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:173-174`,
    `codebase/backend/src/modules/triggers/trigger-config-lock.ts:118-124`,
    `codebase/backend/src/modules/triggers/triggers.service.ts:669-671`,
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3965-3966`,
    `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:149-151`·`:167-168`
  - 상세: 다섯 자리 모두 "트리거 행을 없애는 네 경로 / 삭제 경로가 비밀을 커밋 **뒤**에 지운다"는
    같은 사실을 매번 조금씩 다른 표현으로 다시 적는다(예: "네 삭제 경로와 쓰기 보상이 그 함수를
    지난다" vs "트리거·스케줄·워크플로·워크스페이스 삭제 — 커밋 뒤 `deleteByPrefix`" vs "삭제 경로는
    외부 해제를 행 삭제 전에 끝내고 비밀은 커밋 뒤에 지우므로"). `trigger-config-lock.ts` 자신의
    Rationale 이 바로 이 실수("목록은 두 번 틀렸다 …")를 지적하며 "소비자와 그 정리 목록을 여기
    적지 않는다 — 규칙만 적는다"는 원칙을 세웠는데, 그 원칙이 이 파일에는 적용됐지만 나머지
    네 파일은 각자 손으로 같은 목록을 다시 서술하고 있어 원칙이 국지적으로만 지켜진 상태다.
    다섯 곳 중 셋(`trigger-config-lock.ts`·`triggers.service.ts`·`e2e-spec.ts` R4 문단)은 "spec
    트리거 목록 §4.3" 을 SoT 로 명시 인용하지만 표현 자체는 다르다.
  - 제안: 차단 사유는 아니지만, 이 사실을 가리키는 표준 짧은 문구(예: "네 삭제 경로(spec 트리거
    목록 §4.3)가 비밀을 커밋 뒤에 지운다")를 정하고 다섯 자리 모두 그 문구를 그대로 재사용하면,
    다섯 번째 경로가 추가될 때(이번 PR 이 고치고 있는 바로 그 실패 클래스) 한 곳만 놓쳐도 나머지
    넷과 문구가 달라 grep 으로 잡기 쉬워진다. 지금처럼 표현이 전부 다르면 "이 문장들이 같은
    사실을 말한다"는 것 자체가 grep 으로 드러나지 않는다.

- **[INFO]** `secret-resolver.service.ts` JSDoc 이 "현재 안전한 이유"를 특정 호출부 이름 + 날짜로
  못박는 서술을 반복 — 이번이 두 번째 갱신
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:173-176`
  - 상세: "프로덕션 직접 호출부는 `trigger-resource-release.ts` 의 `deleteTriggerSecretsAfterCommit`
    한 곳이고 … (2026-09-18 전수 확인 — 2026-08-09 에는 `triggers.service.ts` 한 곳이었다)."
    이 문장은 정확히 이번 PR 이 고치고 있는 종류의 서술이다 — "지금은 이 한 곳뿐이라 안전하다"는
    주장을 날짜·구체적 호출부 이름과 함께 못박는 패턴은, 그 아래 문단이 스스로 지적하듯("그 안전은
    **호출부 목록이 그대로일 때만** 참이다") 호출부가 하나 더 생기면 다시 갱신해야 한다. 실제로
    2026-08-09 버전이 이미 한 번 stale 해져 이번에 정정된 이력이 있다. 코드 자체(`prefix.startsWith`
    + LIKE 메타문자 거부)가 이미 입력을 무조건 거부하므로 이 안전 논거는 방어적 이중 서술이고, 다음에
    호출부가 또 늘면 세 번째 갱신이 필요하다.
  - 제안: 차단 사유 아님(코드가 이미 입력 자체를 거부하므로 이 주석이 stale 해져도 보안적으로
    무해). 다만 "2026-08-09 에는 …였다"류의 구체적 호출부 이력을 코드 주석에 계속 누적하는 대신,
    그 감사 이력은 `plan/complete/` 로 넘기고 코드 주석에는 "호출부가 하나뿐이라는 사실에 의존하지
    않는다(방어는 위 두 검사가 한다)"는, 호출부 수와 무관하게 참인 문장만 남기는 편이 세 번째
    갱신을 막는다.

- **[INFO]** e2e 주석 리플로우에서 문장 중간에 부자연스럽게 짧은 줄이 생김 — 사소한 산문 포맷 결함
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:151`
  - 상세: "`secret_store` 는 FK 가 없어(application-level cascade)" 로 줄이 끝나고 다음 줄 "raw
    `DELETE FROM trigger` 로는 **고아 row 가 남는다**." 로 이어진다. 인접 줄들이 대체로 80~90자
    폭을 채우는 데 비해 이 줄만 짧아, 문장이 "…없어(application-level cascade)\nraw …" 로 끊겨
    한 호흡에 읽히지 않는다. 기능에는 영향 없는 순수 프로즈 wrap 이슈.
  - 제안: 다음에 이 문단을 편집할 때 줄바꿈만 다시 맞추면 됨. 이 PR 을 위해 별도 커밋할 정도는
    아님.

- **[INFO]** (기존 패턴, 이번 diff 가 심화시킴) `trigger-config-lock.ts` 의 JSDoc 밀도가 매우 높음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `rewriteTriggerConfigLocked`
    함수(문서화 블록 약 70줄 vs 함수 본문 약 55줄, 그중 상당수도 인라인 주석)
  - 상세: 이번 diff 는 이 함수 위 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 에 문단을 하나 더
    추가한다(소비자 목록이 "두 번 틀렸다"는 이력 문단). 이 파일 전체가 이미 극단적으로 주석이
    많은 편인데(동시성 버그 이력이 많아 각 결정의 근거를 지역적으로 남기려는 의도로 보임), 이번
    추가로 그 밀도가 한 단계 더 올라간다. CLAUDE.md 의 "결정의 배경·근거는 해당 spec 문서 끝의
    `## Rationale`" 원칙과 비교하면, 이 파일의 서술 상당 부분(기각된 대안·비대칭 실패 정책 표 등)이
    spec Rationale 대신 코드 JSDoc 에 상주한다. 이 PR 이 만든 문제는 아니고(사전 결정, 여러
    라운드 리뷰가 이미 승인한 패턴), 코드 자체 로직 변경도 없어 리스크는 낮다.
  - 제안: 차단 사유 아님. 향후 이 파일을 다시 건드릴 기회가 있으면, 히스토리성 서술("목록은 두 번
    틀렸다")처럼 "현재 무엇이 참인가"가 아니라 "과거에 무엇이 틀렸었나"를 말하는 문장들을 spec
    Rationale 로 옮기고 코드에는 현재형 규칙만 남기는 방향을 고려할 것 — 정확히 이번 PR 이 다른
    파일들에서 하고 있는 작업과 같은 방향이다.

- **[INFO]** `plan/`·`review/consistency/` 산출물(파일 10~18)은 코드가 아니라 프로세스 문서/생성물
  - 위치: `plan/in-progress/trigger-release-stale-comments.md`,
    `review/consistency/2026/09/18/11_26_25/*`
  - 상세: 유지보수성 8관점(가독성·네이밍·함수 길이 등)은 애플리케이션 코드를 전제로 하므로 이
    산출물들에는 해당 사항이 없다. plan 문서의 실측표·체크리스트 구조 자체는 저장소 관례를 잘
    따른다(표 형식, 출처 열, 비대상 절 분리).
  - 제안: 조치 불요.

## 요약

순수 주석 정정 + 메서드 리네임 1건으로 구성된 PR 이며, 코드 로직 변경이 전혀 없어 함수 길이·중첩
깊이·매직 넘버·순환 복잡도 관점에서는 논할 거리가 없다. 리네임은 정의부부터 전 콜사이트·테스트
mock 까지 빠짐없이 일관되게 적용되어 오히려 기존의 `teardownChatChannel`/`teardownChannelConfig`
어순 혼동을 해소하는 순가독성 개선이다. 유일하게 남는 결이 있다면, "네 삭제 경로가 커밋 뒤 비밀을
지운다"는 동일 사실이 다섯 개 파일에서 서로 다른 문장으로 반복 서술되고 있다는 점과, 그중 한 곳
(`secret-resolver.service.ts`)은 "지금은 호출부가 하나뿐이라 안전하다"는 날짜 못박힌 서술을 두
번째로 갱신하고 있다는 점이다 — 둘 다 이번 PR 이 고치는 실패 클래스(stale 서술)를 다른 형태로
재생산할 잠재력이 있으나, 즉각적인 위험이나 차단 사유는 아니며 전부 INFO 등급이다.

## 위험도

LOW
