# 부작용(Side Effect) 리뷰

## 검토 범위

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규, 318줄) — `TriggersService`
  의 6개 private 메서드(`assertChatChannelInputSafe`(+overload 2) · `assertPatchCarriesNoSecrets` ·
  `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` ·
  `assertInboundSigningPlaintextByProvider` · `translateSetupChannelError`)를 순수 함수 모듈로 이동.
- `codebase/backend/src/modules/triggers/triggers.service.ts` — 위 6개 메서드 삭제 + import 로 대체
  호출 (324줄 삭제, 순증 없음).
- `plan/in-progress/impl-chat-channel-binder.md`, `review/consistency/2026/09/11/14_59_33/*` — plan·
  consistency-check 산출물(프로세스 문서). 코드 부작용 관점 밖.

diff 는 `git diff origin/main..HEAD --stat -- codebase/backend/src/modules/triggers/` 로 직접 확인
(332 insertions / 310 deletions, 두 파일만). 저장소를 뮤테이션하지 않고 `grep`/`git diff`/`git show`
읽기 전용 명령만 사용했다 — 원복 불필요.

## 발견사항

- **[INFO]** private 메서드 → exported 모듈 함수 전환으로 호출 규약(calling convention) 변경, 하지만
  실질 파급은 0으로 확인됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (전체 export 목록,
    특히 `assertPatchCarriesNoSecrets`·`assertInboundSigningPlaintextByProvider`)
  - 상세: 6개 함수가 `TriggersService` 의 `private` 인스턴스 메서드(`this.` 로만 호출 가능, 컴파일러가
    외부 호출을 원천 차단)에서 모듈-레벨 `export function` (같은 패키지 어디서든 import 가능)으로
    바뀌었다. 이는 형식적으로 "인터페이스 확장"이지만, 실측으로 세 가지를 확인했다: (1)
    `triggers.service.ts` 안에 `this.assert*`/`this.strip*`/`this.translate*` 잔존 호출 0건(모두
    module-level 호출로 정확히 치환됨), (2) `grep -rl` 로 두 함수명을 참조하는 파일은
    `triggers.service.ts`·`chat-channel-input-rules.ts`·두 `*.spec.ts`(둘 다 주석 인용일 뿐 실제
    호출 아님) 뿐, (3) `*.spec.ts` 에 `spyOn(service, 'assert…')` 류의 인스턴스 메서드 스파이 없음 —
    private 메서드였던 시절 그런 스파이가 애초에 불가능했으므로 당연한 결과. 따라서 이번 전환으로
    깨지는 기존 호출자는 없다. 다만 `assertInboundSigningPlaintextByProvider` 는 `mode` 판별
    오버로드(`assertChatChannelInputSafe`)의 보호를 우회해 PATCH DTO 에도 직접 호출 가능한 형태로
    패키지 내부에 노출된다 — 파일 상단 docstring 이 이 함수를 "생성 전용, 좁은 타입 그대로 두어
    PATCH 오용을 타입으로 막는다" 고 명시하지만, 그 방어는 `assertChatChannelInputSafe` 를 거칠
    때만 유효하고 신규 export 자체는 강제하지 않는다(같은 패키지 내 미래 호출자가 직접 import 해
    잘못된 mode 에 쓸 수 있는 이론적 여지). 현재 코드베이스에는 그런 오용 호출자가 없음(위 grep 로
    확인).
  - 제안: 현재 상태로 병합 안전. 다만 이 함수들이 `TriggersService` 밖 다른 모듈에서 직접 import 되는
    사례가 생기면, PR 설명/코드 리뷰에서 "PATCH 경로에서 `assertInboundSigningPlaintextByProvider` 를
    단독 호출하지 않는가"를 확인 항목으로 남겨 둘 것.

- **[INFO]** 순수 함수 이동 자체는 상태·전역·파일시스템·네트워크·이벤트 부작용 없음 (검증 완료)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 전체
  - 상세: 6개 함수 모두 (a) 인자로 받은 DTO/엔티티를 직접 mutate 하지 않는다 —
    `stripChatChannelPlaintext` 는 구조분해 rest-spread 로 **새 객체**를 반환(원본 미변경, 이전
    `private` 버전과 동일 로직), `assertChatChannelAlreadySetUp` 은 `trigger.config` 를 읽기만
    한다. (b) 전역 변수·모듈 top-level mutable state 를 도입하지 않는다 — export 되는 것은
    함수·타입뿐. (c) 파일시스템·환경변수·네트워크 호출이 없다. (d) 예외를 던지는 것 외의
    콜백/이벤트 발생이 없다 — 이는 이동 전 `private` 메서드 시절과 동일한 성질이며 이동으로
    새로 생긴 것이 아니다. Nest DI 그래프에도 변경이 없다(`triggers.module.ts` 의 `providers`
    배열에 이 파일에 대한 등록이 없음 — 의도된 설계, plan 문서가 "의존 0 이므로 provider 로
    감쌀 이유가 없다" 고 명시한 바와 일치).
  - 제안: 없음(관찰 항목).

- **[INFO]** 순환 의존(circular import) 재발 없음 — 실측
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:1-13` (import 절)
  - 상세: 신규 파일이 `./dto/chat-channel-config.dto`·`./entities/trigger.entity`·
    `./chat-channel-rejection-messages.const`·`@workflow/chat-channel-validation`·
    `../../nodes/core/error-codes` 를 import 한다. 이 중 `dto/chat-channel-config.dto.ts` 와
    `entities/trigger.entity.ts` 의 import 절을 직접 열어 확인한 결과 `triggers.service.ts` 또는
    `chat-channel-input-rules.ts` 를 역참조하지 않는다 — `#676`(`e827ed2a7`) 이 끊은
    `chat-channel↔triggers` 순환이 이번 이동으로 재도입되지 않았다.
  - 제안: 없음(관찰 항목). plan 문서(`plan/in-progress/impl-chat-channel-binder.md`)의 관련 주장과
    실측이 일치한다.

## 요약

`chat-channel-input-rules.ts` 신설과 `triggers.service.ts` 축소는 **6개 private 메서드를 module-level
export 함수로 그대로 옮긴 순수 리팩터**다. `git diff --stat` 으로 두 파일만 바뀌었고 테스트 파일 diff
가 0줄임을 직접 확인했으며, 옮겨진 함수들의 호출부(`this.` → 직접 호출)가 전수로 정확히 치환됐고
잔여 `this.` 참조·스파이 대상 손실이 없음을 grep 으로 검증했다. 로직 자체는 원본 mutate 없음·전역
상태 없음·파일시스템/네트워크/이벤트 부작용 없음이며, 이동으로 인한 순환 의존 재도입도 없다. 유일한
주목할 변화는 "private → exported" 로 인한 패키지 내부 접근 범위 확장인데, 현재는 오용 호출자가
없고 오버로드 가드(`assertChatChannelInputSafe`)를 우회하는 직접 호출 지점도 없다. `plan/`·
`review/consistency/**` 신규 파일들은 이 프로젝트의 표준 프로세스 산출물이며 코드 부작용과 무관하다.

## 위험도

NONE
