# 부작용(Side Effect) 리뷰 — `12_56_06`

## 스코프 정리

직전 라운드(`12_37_14`)는 NONE 이었고, 라운드 1(`12_22_23`)이 낸 WARNING(`AuditLogsService.record()` DB 오류 삼킴)은
`plan/in-progress/spec-sync-auth-gaps.md` 에 이미 등재돼 있다 — 재확인:

```
69:- [ ] **`audit_log` 적재 실패에 관측 수단이 없다** (2026-08-11, side_effect WARNING).
76:      - [ ] 적재 실패 카운터/알림 도입 여부 결정 — 전 producer 공통이라 별도 트랙
```

여전히 그대로 남아 있다 — **재지적하지 않는다.**

이번 신규 델타는 커밋 `f5d485a52` 하나. `git show --stat f5d485a52` 로 직접 검증:

```
codebase/backend/src/modules/audit-logs/audit-action.const.ts   |   5 +-   (주석만)
codebase/backend/src/modules/triggers/triggers.service.spec.ts  |  33 +++ (테스트 1건 추가)
plan/in-progress/spec-sync-auth-gaps.md                         |   6 +   (plan 등재)
spec/5-system/1-auth.md                                         |   2 +-  (표 셀 문구 정정)
review/code/2026/08/11/12_22_23/*  (7개, 신규)                            (뒤늦은 SUMMARY/RESOLUTION 기록)
review/code/2026/08/11/12_37_14/*  (7개, 신규)                            (뒤늦은 SUMMARY/RESOLUTION 기록)
```

`codebase/backend/src/modules/triggers/{triggers.controller.ts,triggers.service.ts,triggers.controller.spec.ts}`
는 이번 커밋 `--stat` 목록에 **없다** — production 코드(controller/service 본체)는 이번 델타에서 손대지 않았다.

## 1. 런타임 동작 변경 0 인가 — production diff 직접 검증

**`audit-action.const.ts`** (`git show f5d485a52 -- ...` 로 hunk 단위 확인):
```diff
-  // *(주의 — 앞의 둘만 응답에 새 자격증명을 1회 평문 반환한다. `chat_channel_bot_token_rotated`
-  // 는 새 토큰이 **호출자 입력**이라 응답에 안 실린다. 이 주석의 첫 판은 셋 다 반환한다고 적었고
+  // *(주의 — `notification_secret_rotated`·`interaction_token_revoked` 만 응답에 새 자격증명을
+  // 1회 평문 반환한다. `chat_channel_bot_token_rotated` 는 새 토큰이 **호출자 입력**이라 응답에
+  // 안 실린다. 이 주석의 첫 판은 셋 다 반환한다고 적었고
```
`+`/`-` 라인 전부 `//` 로 시작 — `TRIGGER_*` 상수 키·값·순서는 완전히 불변. "위치 수식어(앞의 둘) →
이름(두 액션명 직접 나열)" 으로 바뀐 것뿐이다. 코드 실행에 영향 없음.

**`spec/5-system/1-auth.md`**: 표 셀 안의 "앞의 둘 중" → "" (수식어 삭제, 두 액션명은 이미 앞에 나열되어 있어
그대로 유지). 순수 산문 정정, 코드 아님.

**`plan/in-progress/spec-sync-auth-gaps.md`**: 신규 체크리스트 항목 1건 추가(`rotateBotToken` 5→6 구간 뮤턴트
잔여 갭 INFO 등재) — plan 문서, 코드 아님.

**`triggers.service.spec.ts`**: 아래 §2 참조 — 신규 테스트 1건(assert 2회) 추가뿐, `triggers.service.ts`/
`triggers.controller.ts` 는 diff 에 등장하지 않음.

**결론: "production 코드 변경 0" 주장은 액면가가 아니라 커밋 diff 를 파일별로 직접 열어 검증했고, 사실과
일치한다.** 주석 정정이 실수로 코드 줄(상수 키/값)을 건드린 흔적 없음.

## 2. 신규 테스트의 공유 mock 오염 여부

문제의 테스트(`triggers.service.spec.ts`):

```ts
it('저장이 실패하면 감사를 남기지 않는다 (회전 2종 — 검증이 아니라 save 가 던진다)', async () => {
  (triggerRepo.save as jest.Mock).mockRejectedValue(new Error('db down'));
  ...
  await expect(service.rotateNotificationSecret(...)).rejects.toThrow('db down');
  ...
  await expect(service.revokePerTriggerToken(...)).rejects.toThrow('db down');
  ...
});
```

`mockRejectedValue`(Once 아님)을 쓴 것은 **의도된 설계다** — 같은 테스트 안에서 두 sibling 메서드
(`rotateNotificationSecret`, `revokePerTriggerToken`) 모두를 같은 실패 상태로 검증해야 하므로 두 번째 호출에서도
reject 가 유지돼야 한다.

**격리 확인**: 이 describe 블록(`TriggersService — 감사 로깅 (trigger.*)`, `triggers.service.spec.ts:2290`)의
`beforeEach`(`:2303`)는 매 `it()` 마다 `Test.createTestingModule({ providers: createBaseProviders({ save: jest.fn(...), ... }) }).compile()` 을
**처음부터 새로 생성**한다. `createBaseProviders`(`:23`)는 모듈 스코프 팩토리 함수라 호출될 때마다 완전히 새로운
`jest.fn()` 인스턴스들을 만들고, `triggerRepo = moduleRef.get(...)` 로 그 새 인스턴스를 다시 바인딩한다. 즉
`mockRejectedValue` 로 오염된 `triggerRepo.save` 는 **그 mock 객체 자체가 다음 `it()` 에서 폐기되고 새로
교체**되므로, `jest.clearAllMocks`/`resetAllMocks` 류의 리셋 로직이 없어도 다음 테스트로 새어나갈 수 없다(단순
호출 이력 리셋이 아니라 통짜 재생성이라 더 강한 격리).

**실측**: 해당 describe 만 targeted 실행 —
```
Tests: 63 skipped, 11 passed, 74 total
```
11건 전부 통과, 순서 의존 실패 없음. 전체 트리거+감사 관련 3개 스펙 파일 합산 실행도 `88 passed, 1 skipped` 로 그린.

**결론: 오염 없음. `beforeEach` 가 "리셋"이 아니라 "재생성"을 하고 있어 지적된 결함 형태 자체가 이 파일
구조에서는 성립하지 않는다.**

## 3. 등재된 WARNING 재확인

`plan/in-progress/spec-sync-auth-gaps.md:69-76` 의 `AuditLogsService.record()` DB 오류 삼킴 WARNING 은 이번
델타에서도 그대로 유지돼 있다(§스코프 정리 참조). 코드 변경 없음 — 재지적하지 않음.

## 그 외 부작용 관점

- **전역 변수/환경 변수**: 도입·수정 없음.
- **시그니처/인터페이스 변경**: 이번 델타(`f5d485a52`)에는 없음(§1 에서 확인한 대로 controller/service 본체
  미접촉). 이전 라운드에서 이미 검토된 `userId` 파라미터 추가는 재론 대상 아님.
- **파일시스템 부작용**: 신규 파일은 전부 `review/code/2026/08/11/{12_22_23,12_37_14}/**` — 컨벤션이 정한
  경로(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)와 일치. 커밋 메시지가 "밀린 위생"으로 명시한 뒤늦은
  기록이고, 게이트가 "빈 세션"으로 놓칠 수 있던 실제 산출물을 사후 커밋한 것 — 예상치 못한 위치에 쓰기 없음.
- **네트워크 호출/이벤트·콜백**: 신규 도입 없음. `recordAudit` 발화 지점(순서)은 이번 델타에서 건드리지 않았다.

## 발견사항

새 CRITICAL 없음. 새 WARNING 없음.

- **[INFO]** 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2434` (신규 테스트) —
  상세: `triggerRepo.save` 에 `mockRejectedValue`(비-Once)를 쓰지만, 이 describe 의 `beforeEach`(`:2303`)가
  매 테스트마다 테스트 모듈 전체를 재생성해 mock 인스턴스 자체가 교체되므로 실질적 오염 경로가 없다. 제안:
  없음(현행 구조 유지가 곧 방어).

## 요약

`f5d485a52` 는 주장대로 production 런타임 코드(0줄)를 건드리지 않았다 — `audit-action.const.ts` 는 주석 두
줄만 정정했고(`+`/`-` 전부 `//` 시작, 상수 값·순서 불변), `triggers.controller.ts`/`triggers.service.ts` 는
이번 커밋 diff 에 아예 등장하지 않는다. 신규 테스트가 쓰는 `mockRejectedValue`(비-Once)는 언뜻 공유 상태
오염처럼 보이지만, 해당 describe 블록의 `beforeEach` 가 테스트마다 NestJS 테스트 모듈과 mock 인스턴스를
통째로 재생성하는 구조라 다음 테스트로 새어나갈 수 없음을 소스 확인 + targeted 실행(11/11 통과, 전체 관련
스펙 88/89 통과)으로 재확인했다. 라운드 1 WARNING(`record()` DB 오류 삼킴)은 plan 에 여전히 유효하게
등재돼 있어 재지적하지 않는다.

## 위험도

NONE

STATUS: OK
