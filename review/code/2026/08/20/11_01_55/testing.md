# 테스트(Testing) 리뷰 — `token` 계열 값·키 패턴 마스킹 (11_01_55, 5라운드째 재검토)

## 검증 방법

정적 diff 검토에 더해, 프로덕션 정규식이 실제로 어떤 문자열에 매치하는지를 Node 로 직접
실행해 대조했다. 특히 `plan/in-progress/eia-secret-pattern-token-family.md` 와
`review/code/2026/08/17/14_00_15/RESOLUTION.md` 가 "뮤테이션 검증"의 근거로 제시하는 RED
개수를, `git show 45ba37792~1:codebase/backend/src/shared/utils/sanitize-error-message.ts`
로 확보한 **실제 직전 커밋의 리터럴 정규식**을 그대로 Node 에 넣어 재현했다(이전 라운드
reviewer/개발자가 각자 "재실행" 이라 주장한 수치가 서로 달라, 이번엔 파일을 사본으로
바꿔치기하지 않고 순수 정규식 로직만 재현해 검증했다).

## 발견사항

- **[WARNING] 이번 diff 에 남아있는 "뮤테이션 검증: 키 축 6 RED" 주장이 재현되지 않는다 — 실측 5 RED, `x-auth-token` 은 회귀 대상이 아니다**
  - 위치: `plan/in-progress/eia-secret-pattern-token-family.md:126-127,130,142` (특히 126행
    `결과는 값 축 **6 RED**, 키 축 **6 RED**` 와 127행 `키 축의 RED 6건은 id_token·csrf_token·
    csrfToken·session_token·x-auth-token + 캐너리 nextPageToken 이다`), 동일 주장이
    `review/code/2026/08/17/14_00_15/RESOLUTION.md:64-67` 에도 있다(`리뷰어는 내 "8 RED" 가
    실제로는 5 RED 라고 했다. **둘 다 틀렸다** — 직접 재실행하니 **6 RED**... 리뷰어는
    `x-auth-token` 을 빠뜨렸다`).
  - 상세: `sanitize-error-message.ts` 의 `CREDENTIAL_KEY_PATTERN` 은 이번 diff **직전** 커밋
    (`45ba37792~1`)에서 이미 `x[_-]auth[_-]?token` 을 별도 대안으로 갖고 있었다(`git show` 로
    직접 확인, diff 파일 7 의 제거된 줄과도 일치). 그 리터럴 정규식을 그대로 Node 에서
    `FAMILY` 8종에 실행하면:
    ```
    token           true   access_token   true   refresh-token  true
    id_token        false  csrf_token     false  csrfToken      false
    session_token   false  x-auth-token   true   (← 이미 매치)
    ```
    즉 **되돌려도 실패하는 키는 4개**(`id_token`/`csrf_token`/`csrfToken`/`session_token`)뿐이고,
    `x-auth-token` 은 직전 커밋 정규식이 이미 잡고 있어 되돌려도 GREEN 이다. 여기에 캐너리
    `nextPageToken`(직전 정규식으로도 미매치 → RED) 1건을 더하면 **정확히 5 RED** —
    직전 라운드 `requirement.md`(WARNING, "8 RED 가 아니라 5 RED")가 낸 수치와 일치하고, 이번
    diff 가 "리뷰어 수치도 틀렸다"며 6으로 정정한 것이 오히려 부정확하다. 개발자가 쓴 뮤턴트가
    실제 직전 프로덕션 코드가 아니라 `x[_-]auth[_-]?token` 대안이 빠진 근사 문자열이었을
    가능성이 높다(무효 뮤턴트 — 이 저장소가 이미 겪은 "치환 대상이 실제 이전 상태와 다르다"
    클래스, `feedback_mutation_validity_and_discriminating_input.md`).
    기능적 결함은 아니다 — `x-auth-token` 은 지금도 정확히 마스킹되고, 실제 회귀 테스트
    (`sanitize-error-message.spec.ts:368-378` `it.each(FAMILY)`)도 올바르게 통과·실패 신호를
    낸다. 문제는 **이 PR 자체가 "숫자만 적으면 재현이 안 된다"며 두 번 정정한 바로 그 수치가
    세 번째로도 틀린 채 커밋됐다**는 점 — 다음 사람이 이 문서를 근거로 커버리지를 신뢰하면
    안 되는 상태로 남아 있다.
  - 제안: `plan/in-progress/eia-secret-pattern-token-family.md:126-130` 의 "키 축 6 RED" 를
    "키 축 5 RED(`id_token`/`csrf_token`/`csrfToken`/`session_token` + 캐너리 `nextPageToken`.
    `x-auth-token` 은 직전 커밋의 `x[_-]auth[_-]?token` 대안이 이미 커버해 회귀 대상 아님)"로
    정정하고, `RESOLUTION.md:64-67` 의 "리뷰어는 x-auth-token 을 빠뜨렸다" 서술도 함께
    정정한다. 재현 스크립트를 이번엔 실제로 `git show <직전SHA>:<path>` 출력을 그대로 붙여
    넣는 방식으로 남기면(파일을 손으로 다시 타이핑하지 않고) 네 번째 재발을 막을 수 있다.

- **[INFO] `websocket.service.spec.ts` 의 신규 키-축 회귀 테스트가 단일 for-loop 조합 테스트라 자매 파일 대비 진단력이 약하다**
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:119-158` (`it('redacts
    the full credential key pattern set...')`, `secrets` 객체를 만들고 `for (const key of
    Object.keys(secrets))` 로 순회하며 `expect` 하는 형태)
  - 상세: 자매 파일 `sanitize-error-message.spec.ts:380-387` 은 같은 성격의 검증을
    `it.each(FAMILY)` 로 8개 **독립 테스트**로 쪼개, 어떤 계열 멤버가 회귀했는지 테스트 이름
    자체로 즉시 알 수 있다. 반면 `websocket.service.spec.ts` 쪽은 하나의 `it` 안에서 for-loop 로
    17개 키를 순회하다 첫 실패에서 예외가 던져져 루프가 멈춘다 — 예를 들어 `x-auth-token` 이
    프로덕션 정규식 회귀로 깨지면 그 뒤에 오는 `csrf_token`/`csrfToken`/`session_token`/
    `id_token` 이 실제로 안전한지 여부는 이 실행에서 전혀 관측되지 않는다(Jest 리포트는
    "1 failed"만 보여준다). 이번 WARNING-1 수정으로 신규 커버리지가 생긴 것은 맞지만, 실패
    시 원인 좁히기(narrowing)에 자매 파일만큼의 정밀도가 없다.
  - 제안: 필수는 아니나, `secrets` 객체를 `Object.entries` 기반 `it.each` 로 바꾸면(또는 최소한
    새로 추가된 5종만이라도 별도 `it.each` 블록으로 분리) 실패 시 정확히 어떤 키가 깨졌는지
    테스트 이름으로 바로 드러난다.

- **[INFO] `token` 계열 fixture(`FAMILY`)가 두 스펙 파일에 각각 하드코딩돼 있어 드리프트 위험이 남는다**
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:368-378`(`FAMILY`
    배열) vs `codebase/backend/src/modules/websocket/websocket.service.spec.ts:135-142`(`secrets`
    객체 내 5개 신규 키)
  - 상세: 두 목록은 지금은 의미상 같은 축(`token`/`access_token`/`refresh-token`/`id_token`/
    `csrf_token`/`csrfToken`/`session_token`/`x-auth-token`)을 겨누지만, 서로 다른 파일에
    독립적으로 타이핑된 리터럴이라 공유 SoT 가 없다. 이번 PR 이 고친 결함 자체가 "값 축과 키
    축, 그리고 두 미러 파일 중 하나만 갱신되고 다른 하나가 조용히 뒤처지는" 클래스였다는 점을
    고려하면, 테스트 fixture 역시 같은 방식으로 드리프트할 수 있다(다음에 계열이 하나 더
    늘 때 한쪽 파일의 리스트만 갱신되는 시나리오).
  - 제안: 필수는 아니나, 공유 테스트 fixture(예: `test/fixtures/credential-key-family.ts` 류)로
    `FAMILY` 를 추출해 두 spec 파일이 같은 배열을 import 하게 하면 향후 계열 추가 시 자동으로
    양쪽에 반영된다.

- **[INFO] 대문자 전용 형태(`TOKEN=`, `{CSRF_TOKEN: …}`)에 대한 명시적 회귀 케이스가 없다**
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:368-378`(`FAMILY`
    배열 — 전부 소문자/카멜케이스 조합, 전체 대문자 항목 없음)
  - 상세: `SECRET_LEAK_PATTERNS`[1]과 `CREDENTIAL_KEY_PATTERN` 모두 `/i` 플래그로 대소문자를
    무시하도록 설계돼 있고 다른 기존 키(`Authorization`, `Bearer`)도 대소문자 무관하게
    동작하는 것으로 미루어 실제 매칭도 문제없을 것으로 보이나(코드 검토로 확인), 계열 전체를
    다루는 이번 신규 `describe` 블록에 그 사실을 못박는 케이스가 하나도 없다. 대소문자
    무시가 이 정규식 세트의 핵심 방어선인 만큼(운영 로그·업스트림 provider 가 어떤 대소문자로
    키를 보낼지 통제 불가) 회귀 방지용 캐너리 가치가 있다.
  - 제안: 필수는 아니나, `it('대문자 키도 매칭한다', () => expect(redactSecrets('TOKEN=sk-live-abc123')).toBe('***'))` 류 1건을 추가하면 `/i` 플래그가 실수로 빠지는 회귀를 즉시 잡는다.

## 확인했으나 문제 없는 항목

- `sanitize-error-message.spec.ts` 신규 `describe('token 계열 — 값 축과 키 축을 같은 표로
  고정')` 는 값 축·키 축을 같은 `FAMILY` 표로 고정하고, 오탐 경계 캐너리(`tokenizer=`)와
  받아들이는 오탐 캐너리(`nextPageToken`)를 모두 갖춰 이 저장소가 반복 지적해 온 "한 축만
  고치고 다른 축이 조용히 남는" 결함 클래스를 구조적으로 방지한다 — 좋은 패턴.
- `mcp-error-codes.spec.ts` 는 케이스를 삭제하지 않고 이름·JSDoc 만 갱신해 "이관됐다"는
  사실을 기록하면서 회귀 앵커(characterization test)로 남겼다 — MCP 소비자가 이 형태에
  계속 의존한다는 사실이 공용 쪽 diff 만 봐서는 안 보이는데, 이 테스트가 그 의존을 대신
  증언한다.
- `websocket.service.spec.ts` 신규 오탐 경계 테스트(`tokenizer` 보존 / `nextPageToken` 마스킹)
  는 자매 파일의 동일 캐너리와 정확히 같은 결정을 미러링한다.
- Mock 사용은 적절하다 — `gateway.broadcastToChannel` 은 `jest.fn()` 으로 단순 스텁, 실제
  sanitize 로직은 mock 하지 않고 그대로 실행해 프로덕션 정규식이 실제로 동작하는지를
  검증한다(과도한 mock 으로 실제 동작과 괴리되는 패턴 없음).
- 테스트 격리: `beforeEach` 에서 `gateway`/`service` 를 매번 새로 만들고, 새로 추가된 테스트도
  선행 테스트의 상태에 의존하지 않는다. 순서 무관하게 독립 실행 가능.
- 회귀 유효성: 기존 테스트(`redacts credential-shaped keys...`, `preserves nested object
  reference identity...` 등)는 이번 정규식 확장과 무관한 필드만 사용해 diff 이후에도 계속
  유효하다 — 옛 3-대안이 새 대안의 진짜 상위집합이라 기존에 통과하던 케이스가 깨질 이유가
  없음을 직접 확인.
- 테스트 용이성: `redactSecrets`/`deepRedactSecrets`/`redactMcpSecrets` 는 순수 함수(입력
  mutation 없음, 외부 의존성 없음)라 정규식 확장 자체는 별도 DI/mocking 없이 바로
  단위테스트 가능한 구조 — 이번처럼 값·키 두 축을 나란히 표로 고정하기 쉬운 이유이기도 하다.

## 요약

프로덕션 정규식 확장 자체와 그것을 검증하는 신규 회귀 테스트(`sanitize-error-message.spec.ts`
FAMILY 표, `websocket.service.spec.ts` 신규 키 세트 + 오탐 캐너리, `mcp-error-codes.spec.ts`
characterization 갱신)는 기능적으로 올바르고 이 저장소가 반복 겪어 온 "미러 중 하나만
갱신/테스트됨" 결함 클래스를 구조적으로 예방한다. 다만 이 PR 이 스스로 두 차례("8→5→6")
정정해 온 "뮤테이션 검증 키 축 RED 개수"가 직전 커밋의 실제 정규식으로 재현한 결과와도
다시 어긋난다 — `x-auth-token` 은 직전 커밋에서 이미 별도 대안으로 커버돼 있어 되돌려도
회귀하지 않는데, 이번 diff 는 그것을 회귀 항목으로 잘못 포함시켜 "6 RED" 로 기록했고
그 과정에서 앞선 리뷰어의 정확한 수치(5)를 오히려 틀렸다고 정정했다. 실질 코드 결함은
아니지만, 테스트 신뢰성·재현성 관점에서는 실질적인 문제다 — 다음 사람이 이 plan 문서를
근거로 "키 축 커버리지가 6건 회귀를 잡는다"고 믿으면 안 되는 상태로 커밋된다. 그 외에는
자매 파일 대비 진단력이 약한 for-loop 조합 테스트, fixture 중복(SoT 파편화 소지),
대문자 케이스 캐너리 부재 등 경미한 완결성 갭만 남는다.

## 위험도

WARNING — 실 코드 결함·기능적 커버리지 갭은 없음(실제 정규식·테스트 모두 올바르게
동작). 다만 이 PR 이 자체적으로 "재현 가능한 뮤테이션 수치"를 반복 강조하며 두 번 정정한
바로 그 수치가 이번에도(세 번째로) 재현되지 않아, 테스트-증거 신뢰성 항목에서는 단순
완결성 이슈보다 무겁게 본다.
