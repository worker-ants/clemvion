# 유지보수성(Maintainability) 리뷰 — delta 재검토 (테스트 2건 + 주석 정정 3곳)

## 스코프 확정

프롬프트 페이로드는 `origin/main` 대비 전체 diff(22개 파일)를 담고 있으나, orchestrator 지시대로
**직전 라운드(`12_22_23`) 이후의 실제 delta만** 재검토 대상으로 좁혔다. `git log` 로 확인한 결과 이번
라운드의 실제 변경은 커밋 `9eb2c6088`(`fix(audit): 셋 중 하나에만 회귀를 걸었다 + 내 근거 문장이 사실과
달랐다`) 하나이며, 그 안의 코드/테스트 변경은 다음 두 항목으로 정확히 좁혀진다.

## (a) `audit-action.const.ts` 정정된 주석 — 읽기 좋은가

파일: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:82-97`

3문단 구조: ① 3분리 축의 의미(특권 작업 + 무효화 대상이 액션마다 다름) ② Rationale 위치 참조
③ `*(주의 — …)*` 로 감싼 정정 이력. 확인 결과:

- **[INFO]** `*(주의 — …)*` 괄호 안에서 "① 어느 둘만 평문 자격증명을 반환하는지"라는 **정규범적 사실**과
  "② 첫 판이 틀렸었다"는 **이력 서술**이 한 문장 블록에 함께 들어 있다. 다만 문장 순서가 정규범적 사실
  (`앞의 둘만 응답에 … 반환한다`)을 먼저 진술하고, 이력 서술은 마지막 문장에 em dash 인용(`— ai-review
  12_22_23 documentation`)으로 명확히 구분돼 있어 규범문이 흐려지지는 않는다. 굳이 더 다듬는다면 이력
  문장을 별도 줄로 분리할 수 있지만, 등재할 만큼의 문제는 아니다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:90-92`
- 나머지 두 주석 정정(`spec/5-system/1-auth.md:431` 표 셀, `triggers.service.spec.ts:2362` docstring)도
  같은 사실 정정(응답에 평문 반환되는 것은 둘뿐, `chat_channel_bot_token_rotated` 는 호출자 입력이라
  응답에 없음)을 각 문서 컨텍스트에 맞게 일관되게 반영했다. 세 곳의 서술이 서로 모순되지 않는다(전수
  대조 완료).

결론: **CRITICAL 없음.** 정정 이력이 규범문을 가리지 않고, 세 곳 모두 사실관계가 일치한다.

## (b) 새 테스트 2건 — 기존 describe 관례 부합 여부

파일: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
대상: `describe('TriggersService.rotateBotToken — 6단계 오케스트레이션', …)` 안에 추가된

- `it('감사 — 성공 시 trigger.chat_channel_bot_token_rotated 를 남긴다', …)` — 라인 1774
- `it('감사 — 오케스트레이션이 중간에 실패하면 남기지 않는다', …)` — 라인 1789

확인한 관례 일치 항목:

1. **네이밍 패턴**: 같은 describe 안의 기존 테스트들(`정상 — …`, `§5.4 — …`, `첫 rotation — …`)이
   이미 `<라벨> — <설명>` 형식을 쓰고 있고, 신규 두 테스트의 `감사 — …` 도 동일 패턴이다.
2. **mock 변수 관례**: `auditLogs = moduleRef.get(AuditLogsService) as unknown as { record: jest.Mock }`
   캐스팅 패턴이 자매 describe(`TriggersService — 감사 로깅 (trigger.*)`, 라인 2318)와 **글자 그대로**
   동일하다 — 새 관례를 만들지 않고 기존 것을 재사용했다.
3. **액션 문자열 하드코딩 관례**: `action: 'trigger.chat_channel_bot_token_rotated'` 를 상수 참조 대신
   리터럴로 박고 그 이유를 인라인 주석(`문자열로 박는다 — 상수를 참조하면 …`)으로 남긴 것도, 자매
   describe 의 기존 테스트들이 이미 쓰던 동일한 관례(자기참조 방지)와 일치한다.
4. **beforeEach 확장 방식**: 6단계 mock 이 이미 갖춰진 `beforeEach` 에 `auditLogs` 필드 하나만
   덧붙이는 최소 diff — 기존 셋업 구조를 재사용하고 새 셋업 블록을 만들지 않았다.
5. **실패 케이스 근거**: "감사가 남으면 거짓 타임라인" 이라는 근거를 인라인 주석으로 남긴 것도, 이
   파일 전반에 걸친 "왜 이 순서/조건인가"를 주석으로 고정하는 기존 관례(예: `create 는 secret
   마이그레이션 전에 기록한다 (W6 순서 고정)` 부근 주석)와 결이 같다.

결론: **CRITICAL 없음.** 두 테스트는 명명·mock 캐스팅·리터럴 액션 문자열·주석 근거 남기기 등 이
파일이 이미 확립한 관례를 모두 그대로 따른다. 새로운 스타일이나 이질적인 패턴을 도입하지 않았다.

## 발견사항

CRITICAL 발견 없음. 위 (a)/(b) 확인 과정에서 등재할 만한 새 항목도 없다(비-CRITICAL 은 등재 처분
원칙에 따라 재기재하지 않음).

## 요약

이번 라운드 delta(테스트 2건 추가 + 주석 정정 3곳)는 직전 라운드에서 지적된 사실 오류(응답에 평문
반환되는 자격증명이 셋이 아니라 둘)를 정확히 정정했고, 그 정정이 세 위치(`audit-action.const.ts`
주석·`1-auth.md` 표 셀·`triggers.service.spec.ts` docstring) 사이에서 서로 모순 없이 일관된다. 새로
추가된 테스트 2건은 같은 파일 안의 자매 describe 가 이미 쓰고 있는 mock 캐스팅·네이밍·리터럴 액션
문자열 관례를 그대로 재사용해 스타일 이탈이 없다. `audit-action.const.ts` 의 "주의" 괄호가 정정 이력과
정규범적 사실을 한 문장 블록에 담고 있는 점은 아주 사소한 다듬을 여지지만, 규범문을 가리지 않으므로
등재 대상이 아니다.

## 위험도

NONE
