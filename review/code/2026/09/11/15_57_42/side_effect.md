# 부작용(Side Effect) 리뷰

## 검토 범위와 방법

이번 라운드(`15_57_42`)는 직전 라운드(`review/code/2026/09/11/15_31_54`, 이 세션의 side_effect 리뷰
포함)에서 지적된 CRITICAL 1(거짓 등재 주장)·WARNING 들에 대한 후속 커밋
(`6dc2b7d60`, "거짓 등재 주장을 바로잡고 옮긴 규칙에 전용 단위 테스트를 붙인다")을 검토 대상으로
한다. `git show --stat 6dc2b7d60`으로 실제 변경분을 직접 확인했다 — **`codebase/**` 변경은 신규
테스트 파일 `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` 185줄 추가
1건뿐**이고, 나머지는 `plan/in-progress/*.md`·`review/code/2026/09/11/15_31_54/**`(직전 라운드
산출물의 커밋 반영) 문서 변경이다. 소스 로직(`chat-channel-input-rules.ts`·`triggers.service.ts`)은
이번 커밋에서 손대지 않았다 — 그 파일들은 직전 커밋(`2ae81077c`)에서 이미 이동이 끝났고, 이번
라운드는 그 위에 테스트만 얹었다.

저장소 트리에는 아무것도 쓰지 않고 `git show`/`git diff`/`grep`/`Read` 읽기 전용 명령만 사용했다 —
원복 불필요, `git status --short`로 세션 산출물 외 잔여물 없음을 확인했다.

## 발견사항

- **[INFO]** 신규 스펙 파일은 순수 함수를 직접 호출하는 화이트박스 테스트로, 부작용 표면이 없다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` 전체(1-185)
  - 상세: `cfg()`(26-27)는 `{ provider: 'telegram', ...over }`로 매 호출마다 **새 객체**를 만들 뿐
    `over` 인자를 mutate 하지 않는다. `thrown()`(29-40)은 함수를 호출해 예외를 캡처할 뿐 다른 상태를
    건드리지 않는다. 12개 `it`/`it.each` 케이스 전부가 순수 함수(`assertChatChannelInputSafe` 등,
    직전 라운드에서 무상태·무전역·무파일시스템·무네트워크로 이미 확인된 함수들)만 호출한다 —
    `Test.createTestingModule`·mock·spy 가 전혀 없다(파일 상단 docstring 15-25가 이를 설계 의도로
    명시). 테스트 간 공유되는 module-level mutable 변수도 없다. `beforeEach`/`afterEach` 훅이 없어
    "정리해야 할 상태"조차 없다.
  - 제안: 없음(관찰 항목).

- **[INFO]** (직전 라운드에서 이미 확인된 사실의 재확인) private 메서드 → exported 모듈 함수 전환의
  호출 범위 확장은 이번 커밋에서도 실제 오용 호출자를 만들지 않았다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:138-140`
    (`assertPatchCarriesNoSecrets` export), `:227-229`
    (`assertInboundSigningPlaintextByProvider` export)
  - 상세: `grep -rln`으로 이동된 6개 함수명을 참조하는 파일을 전수 확인한 결과
    `chat-channel-input-rules.ts`(정의)·`chat-channel-input-rules.spec.ts`(신규 전용 테스트, 직접
    호출)·`triggers.service.ts`(호출부)·`triggers.service.spec.ts`·
    `dto/trigger-dto-validation.spec.ts`(뒤 둘은 주석 인용뿐, 실제 호출 아님) 다섯 뿐이다. 신규
    테스트 파일도 각 함수를 설계된 모드/타입 그대로만 호출한다(`assertPatchCarriesNoSecrets` 는
    PATCH 케이스로만, `assertInboundSigningPlaintextByProvider` 는 `ChatChannelConfigDto` 로만) —
    직전 라운드가 "이론적으로 열려 있다"고 지적한 오버로드 우회 호출(예: PATCH DTO 에
    `assertInboundSigningPlaintextByProvider` 를 단독 호출)은 신규 테스트에도 실제 코드에도 없다.
  - 제안: 없음 — 직전 라운드 INFO 를 재확정하는 수준이며 이번 커밋으로 위험이 늘지도 줄지도 않았다.

- **[INFO]** 이번 커밋이 만든 파일시스템 변경은 프로젝트 표준 워크플로 산출물이며 코드 부작용이 아니다
  - 위치: `plan/in-progress/impl-chat-channel-binder.md`(체크리스트·철회 처방 취소선 갱신),
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 트래커 항목 3건),
    `review/code/2026/09/11/15_31_54/**`(직전 라운드 산출물 커밋 반영, 신규 12개 파일)
  - 상세: `git show --stat 6dc2b7d60`로 확인한 파일시스템 변경 전부가 이 프로젝트의 명시된
    리뷰/plan 워크플로 규약(코드 리뷰 산출물은 `review/code/**`에 커밋, plan 갱신은 `plan/**`)을
    따른다. 예기치 못한 파일 생성·삭제(예: 의도치 않은 `.bak`, 임시 파일, 무관한 디렉터리 변경)는
    없다.
  - 제안: 없음(관찰 항목).

- **[INFO]** 시그니처/인터페이스 관점 — 이번 커밋은 어떤 함수 시그니처도 바꾸지 않았다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (이번 커밋에서
    diff 없음, `git show --stat 6dc2b7d60`로 확인)
  - 상세: 시그니처 변경·공개 API 변경은 전부 직전 커밋(`2ae81077c`)에서 이미 일어났고 그 라운드의
    side_effect 리뷰(`review/code/2026/09/11/15_31_54/side_effect.md`)가 위험도 NONE 으로 이미
    검증했다. 이번 커밋은 그 표면에 테스트만 추가했을 뿐 새로운 시그니처 변경이 없다.
  - 제안: 없음.

## 요약

이번 라운드에서 검토 대상이 된 실제 코드 변경은 신규 화이트박스 단위 테스트 파일 185줄뿐이며, 그
파일은 이미 부작용 없음이 확인된 순수 함수 6개를 모드/타입에 맞춰 직접 호출할 뿐 전역·공유 상태·
파일시스템·네트워크·이벤트 어느 것도 새로 만들지 않는다. `git show --stat`으로 이번 커밋의
`codebase/**` 변경 범위를 직접 확정했고, 직전 라운드가 지적했던 "private→exported 확장"에 대한
오용 호출자가 이번 신규 테스트를 포함해도 여전히 0건임을 grep 으로 재확인했다. plan/review 문서
변경은 프로젝트 표준 워크플로 산출물로 부작용 관점의 결함이 아니다. 부작용 관점에서 이번 라운드가
새로 만든 위험은 없다.

## 위험도

NONE
