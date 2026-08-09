# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `assertRefFormat` 의 주석 블록이 두 가지 별개 관심사(SS-SE-05 보안 정책 근거 / TS `never` narrowing·lint 오탐 설명)를 하나로 묶어 파일 내 다른 주석 대비 유독 길다(7줄).
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:58` (블록 시작, `assertRefFormat` 메서드)
  - 상세: 58~59줄은 "plaintext 미노출" 보안 정책 근거, 60~64줄은 `isSecretRef` 타입가드에 의한 `never` 좁혀짐과 캐스트 제거가 안전한 이유를 설명한다. 두 설명 모두 정확하고(직접 `tsc --strict` 로 `refStr` 중간 변수 없이 `ref.length`/`ref.slice()` 를 호출하면 `TS2339: Property does not exist on type 'never'` 로 실패함을 확인했다 — 즉 `const refStr: string = ref;` 는 불필요한 변수가 아니라 실제로 필요한 코드다), 다만 성격이 다른 두 정보가 한 블록에 있어 스캔하기 번거롭다. 단, 동일 저장소의 다른 `no-unnecessary-type-assertion` 정리 지점들(`ai-turn-executor.ts:3282-3287`, `retry-turn.service.ts:152-156`, `telegram-client.ts:108-111`)도 같은 스타일(길고 근거를 상세히 남기는 주석)을 쓰고 있어 **파일 내부적으로는 길지만 저장소 컨벤션 위반은 아니다**.
  - 제안: 필수 사항은 아니나, 보안 정책 근거 주석과 타입 narrowing 근거 주석을 두 줄로 나누면(예: 정책 1줄 + 타입 설명 별도 블록) 향후 각 관심사를 개별적으로 수정·삭제하기 쉬워진다.

- **[INFO]** 에러 메시지에 노출하는 prefix 길이 `8` 이 이름 없는 매직 넘버다.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:67` (`refStr.slice(0, 8)`)
  - 상세: 이번 변경(불필요 캐스트 제거)과 무관한 기존 코드이며 동작 변화는 없다. `8` 이 왜 8인지(로그 노출 최소화 기준 등) 근거가 없어 향후 다른 개발자가 값을 바꿀 때 근거를 알기 어렵다.
  - 제안: `const REF_PREFIX_LOG_LEN = 8;` 같은 named constant 로 추출하면 의도가 명확해진다. 우선순위는 낮음(이번 diff 범위 밖).

## 요약

이번 변경은 `assertRefFormat` 의 false-branch 에서 `isSecretRef` 타입가드가 `ref` 를 `never` 로 좁힌다는 점을 활용해 불필요했던 캐스트를 제거하고 그 근거를 주석으로 남긴 것으로, 실제로 `tsc --strict` 로 검증한 결과 `const refStr: string = ref;` 대입이 없으면 `ref.length`/`ref.slice()` 호출이 `TS2339` 로 컴파일 에러가 남을 확인했다 — 즉 코드가 정확하고 필요한 형태로 작성되어 있다. 함수 길이·중첩 깊이·네이밍·중복은 모두 양호하며, 파일 전체가 단일 책임(SecretResolver 진입점)을 유지한다. 유일한 관찰 사항은 해당 주석 블록이 두 관심사를 한 곳에 묶어 다소 길다는 점과 기존부터 있던 매직 넘버 `8` 인데, 둘 다 파일 내 다른 위치나 저장소 관례와 비교해 실질적 리스크는 낮다.

## 위험도
LOW
