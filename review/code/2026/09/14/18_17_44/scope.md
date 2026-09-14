# 변경 범위(Scope) 리뷰 — trigger-config-lost-update

## 검토 방법

`git diff --stat origin/main...HEAD` 로 실제 변경 파일 집합을 프롬프트에 열거된 14개 파일과 대조했고 (완전히 일치), 프롬프트에서 "크기 제한으로 전체 컨텍스트 미포함"으로 표시된 `chat-channel-binder.service.ts`·`triggers.service.ts`·`triggers.service.spec.ts` 는 `git diff origin/main...HEAD -- <path>` 로 전체 diff 를 직접 재확인해 프롬프트에 실린 unified diff 조각이 실제 diff 전체와 정확히 일치함을 확인했다(숨겨진 추가 변경 없음).

## 발견사항

- **[INFO]** `plan/`·`review/consistency/**` 8개 파일이 코드 변경과 함께 같은 changeset 에 포함
  - 위치: `plan/in-progress/trigger-config-lost-update.md`, `review/consistency/2026/09/14/17_10_16/*`(SUMMARY.md, meta.json, _retry_state.json, cross_spec.md, convention_compliance.md, plan_coherence.md, naming_collision.md, rationale_continuity.md)
  - 상세: 이 저장소의 `developer` 워크플로 규약(`CLAUDE.md`)은 구현 착수 직전 `consistency-check --impl-prep` 을 의무화하고, plan 문서를 `plan/in-progress/`에 두도록 요구한다. 이 8개 파일은 그 의무 절차의 산출물이며 코드 수정과 무관한 별도 관심사를 끌어들이지 않는다 — scope creep 이 아니라 규약이 요구하는 동반 아티팩트다.
  - 제안: 조치 불요(기록 목적).

- **[INFO]** 같은 "whole-key-replace 덮어쓰기" 패턴이 19곳 더 있다는 사실을 §D 에서 실측했지만 이번 PR 은 확장하지 않음
  - 위치: `plan/in-progress/trigger-config-lost-update.md` §D("같은 클래스의 자리가 넷보다 많다")
  - 상세: 전수 열거로 `save(entity)` 형태의 유사 위험 지점 10곳(+`update(criteria, partial)` 형태 다수)을 찾았으나, "이 PR 로 넓히지 않는다"고 명시하고 후속 항목으로만 등재했다. 오히려 스코프를 의도적으로 좁게 유지한 사례로, 범위 이탈이 아니라 범위 준수의 근거로 봐야 한다.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.update()`(창 1)를 락 방식으로 바꿔 실행해 보고 되돌린 이력이 코드 주석으로 남아 있음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (라인 앵커는 diff 게이트 기준 `525`~`534`, `save(trigger)` 호출 직전 블록)
  - 상세: 창 1까지 고치면 반환 엔티티·`endpointPath` UNIQUE 충돌 등 3개 계약이 함께 바뀌어 기존 스펙 6건이 RED 였다는 실측을 근거로 그 변경을 되돌리고 트래커 항목만 남겼다. 실제 diff 에는 되돌린 코드(예: `save`→`update`+재조회 시도)의 흔적이 남아 있지 않고 설명 주석만 추가됐다 — 코드 자체는 원래 로직을 그대로 유지하므로 범위 이탈이 아니라 범위 경계를 스스로 문서화한 것이다.
  - 제안: 조치 불요.

- **[INFO]** `triggers.service.spec.ts`의 모든 `getRepositoryToken(Trigger)` mock 을 `withTransactionMock()`으로 일괄 래핑
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `createBaseProviders` 및 7개 `describe` 블록 내 provider 배열
  - 상세: 새 `rewriteTriggerConfigLocked` 가 `manager.transaction`을 요구하게 되면서, 기존에 `manager` 를 안 갖던 모든 Trigger repo mock 이 깨지지 않도록 기계적으로 래핑한 변경이다. 로직·단언 내용을 바꾸지 않고 배선만 추가했으며, 이 PR 의 락 도입이라는 목적에 직접 종속된 필연적 변경이라 판단된다.
  - 제안: 조치 불요.

이 외에 요청 범위를 벗어난 리팩토링, 임포트 정리, 포맷팅 전용 변경, 무관한 파일·설정 수정은 발견되지 않았다. 새로 추가된 `trigger-config-lock.ts` 도 lock key 상수 하나 + 함수 두 개(`triggerConfigLockKey`, `rewriteTriggerConfigLocked`)로 구성돼 있어 "요청하지 않은 기능 확장"으로 보기 어렵고, JSDoc 이 길지만 이 저장소의 기존 관례(근거·기각된 대안·계약 명시)를 따른 것으로 이번 세션에서 새로 도입된 스타일이 아니다.

## 요약

전체 diff(14개 파일, `+1190/-40`)를 `origin/main` 대비 확인한 결과, 코드 변경은 명시된 목적(동시 PATCH 로 인한 `trigger.config` lost-update, 특히 `inboundSigningRef` fail-open 방지)에 정확히 대응하는 4개 소스 파일 + 1개 e2e 테스트로 좁게 유지되고 있으며, 새로 발견한 확장 가능 지점(19곳)·미해결 창(창 1)은 스스로 실측 후 의도적으로 스코프 밖으로 미뤘다는 근거를 남겼다. plan/consistency 8개 파일은 이 저장소의 강제 워크플로 산출물이라 스코프 이탈이 아니다. 요청 이상의 변경, 무관한 리팩토링, 포맷팅 전용 변경, 불필요한 주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
