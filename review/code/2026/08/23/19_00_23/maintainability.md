# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 컴파일타임 결속 assertion 이 한 줄에 밀집돼 있어 이 TS 관용구에 익숙하지 않으면 판독이 느리다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:165` (`const assertAllowlistCoversHandlerContract: PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number] ? true : never = true;`)
  - 상세: `PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number] ? true : never = true` 라는 conditional-type exhaustiveness-check 패턴은 강력하지만 흔치 않다. 무엇을 검증하는지는 바로 위(152~159행) JSDoc 블록이 잘 설명하지만, 선언 자체는 타입·값이 뒤섞여 한 줄로 붙어 있어 시각적으로 파싱하기 어렵다. `void assertAllowlistCoversHandlerContract;` (168행)도 "왜 즉시 버리는 변수를 선언하는가"에 대한 단서가 선언부 근처에는 없다(설명은 위 JSDoc에만 있음).
  - 제안: 타입 조건부를 여러 줄로 정렬해 `PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number]` 부분과 `? true : never = true` 부분을 명확히 분리하거나, 선언 바로 위에 한 줄짜리 "컴파일타임 전용 — 실행되지 않음" 같은 근접 주석을 추가하면 JSDoc까지 거슬러 올라가지 않아도 의도가 즉시 읽힌다.

- **[INFO]** `allowlistNodeOutputKeys` 가 형제 함수 `stripDeep` 의 `__proto__` 방어 관례를 따르지 않는데 그 이유가 코드에 남아있지 않다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:179-192` (`allowlistNodeOutputKeys`) vs `strip-external-only-fields.ts:230-243` (`stripDeep`)
  - 상세: 같은 파일의 `stripDeep` 은 `{...obj}` 로 만든 `out` 에 키를 **쓸 때** bracket 대입 대신 `Object.defineProperty` 를 쓰며, 그 이유를 "`__proto__` 키에 bracket 대입하면 접근자를 타 프로토타입을 오염시킨다(CWE-1321)"고 명시적으로 설명한다(232-237행). 새로 추가된 `allowlistNodeOutputKeys` 도 같은 방식(`{...obj}` 로 얕은 복제 후 키 조작)으로 동작하지만 `delete out[k]` 를 그대로 쓴다. `delete` 는 own-property 를 대상으로 한 `[[Delete]]` 라 `stripDeep` 이 우려한 accessor-오염 경로(값 **대입** 시 상속 setter 를 타는 문제)에 해당하지 않아 실제로는 안전하지만, 그 판단 근거가 이 함수 근처 어디에도 적혀 있지 않다. 이 저장소는 "손으로 짠 primitive + 확신 주석이 반증되면 물러선다"는 교훈을 이미 여러 번 겪었는데, 이번엔 반대로 안전한 코드에 대한 근거 주석이 빠져, 훗날 이 `delete` 를 조건부 대입으로 리팩터링하는 사람이 형제 함수가 이미 겪은 프로토타입 오염 클래스를 다시 들여올 위험이 있다.
  - 제안: `delete out[k];` 위에 한 줄로 "`delete` 는 own-property `[[Delete]]` 라 `stripDeep` 의 `__proto__` accessor 문제(대입 전용)에 해당하지 않는다" 정도의 근거 주석을 남기면, 이후 이 함수를 값-대입 방식으로 바꾸는 변경이 같은 위험 인식 없이 들어가는 것을 막을 수 있다.

- **[INFO]** 구현 상수에서 파생하는 `it.each` 픽스처가 리터럴 대조 캐너리로 완화됐지만 원래 형태가 파일에 그대로 남아있다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts:259-265` (`it.each([...NODE_OUTPUT_ALLOWED_KEYS])('허용 키 \`%s\` 는 통과한다', ...)`)
  - 상세: 같은 파일 231-234행 주석이 정확히 지적하듯, `NODE_OUTPUT_ALLOWED_KEYS` 를 그대로 스프레드해 픽스처로 쓰는 `it.each` 는 "생성 입력 vs 큐레이션 코퍼스" 패턴이라 목록이 줄면 케이스도 함께 줄어 조용히 통과한다(이 PR 자체가 뮤테이션으로 실증: `formConfig` 제거 시 91→90건, 전부 GREEN). 바로 앞에 리터럴 비교 캐너리(235-257행)를 추가해 실질적으로 완화했지만, 취약한 원본 테스트(259-265행)는 그대로 남아 있다 — 만약 향후 편집에서 리터럴 캐너리 쪽만 삭제/약화되면 이 vacuous 패턴이 되살아난다. 이미 문서화됐고 설계상 의도된 상태라 CRITICAL/WARNING 은 아니지만, 유지보수 관점에서 "완화됐다"와 "제거됐다"를 혼동하기 쉬운 지점이다.
  - 제안: 필수는 아니나, 259-265행 바로 위에도 "이 블록은 리터럴 캐너리(235-257)가 살아있을 때만 안전하다" 정도의 상호 참조 주석을 남기면 두 테스트의 의존 관계가 코드만 보고도 드러난다.

## 요약

핵심 변경(`allowlistNodeOutputKeys`, `NODE_OUTPUT_ALLOWED_KEYS`, `interaction.service.ts` 배선)은 함수가 짧고(≤15행) 순환 복잡도가 낮으며, 매직 넘버가 없고, 네이밍이 형제 함수(`stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS`)와 일관된 동사-명사 관례를 그대로 따른다. JSDoc 이 "왜 deny-list 로 부족한가", "왜 최상위만 거르는가", "왜 다른 두 출구에는 안 거나"를 구체적 근거(코드 인용·파일 경로·과거 사고 참조)로 설명해, 이 저장소가 이미 여러 차례 지적받았던 "근거 없는 확신 주석"·"손동기화 드리프트" 문제를 컴파일타임 assertion 으로 실제로 막아낸 점이 돋보인다. 테스트 스위트도 캐너리·뮤테이션 검증·판별력 실측을 갖춰 견고하다. 위에서 지적한 세 건은 모두 INFO 수준으로, 코드가 틀렸다기보다 "왜 안전한지/왜 취약할 수 있는지"에 대한 근접 주석이 한 걸음 더 필요한 지점들이다. plan/consistency 산출물 파일(5~14번)은 자동 생성된 프로세스 문서라 코드 유지보수성 기준을 적용할 대상이 아니었다.

## 위험도
LOW
