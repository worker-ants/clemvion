# Rationale 연속성 검토 — eslint10-upgrade (`spec/5-system/`, --impl-done)

## 검토 범위 확인

`git diff origin/main...HEAD -- code_areas` 로 제공된 실제 변경분은 아래 5개 파일, 전부
**주석/문서화 변경만** 있고 로직(런타임 동작) 변경은 없다:

- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` (+주석만, 기존 `cause: err` 유지)
- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (주석 치환)
- `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (주석 치환, 기존 `eslint-disable-next-line preserve-caught-error` 유지)
- `codebase/backend/src/nodes/data/code/code.handler.ts` (+주석만, 기존 `cause: err` 유지)
- `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (주석 치환 2곳)

이 변경들은 모두 `spec/5-system/3-error-handling.md` **§6.3.1 `Error.cause` 부착 기준**(C1 AND C2)과
그 `## Rationale` 항목("`Error.cause` 부착 기준을 '소비처가 직렬화하는가' 로 잡지 않은 이유")을
직접 인용한다. 이 §6.3.1/Rationale 자체는 이번 PR 이전에 이미 `origin/main` 에 존재한다
(`44346ec81 docs(spec): Error.cause 부착 기준을 §6.3.1 로 정본화 (#1230)` — ANCESTOR_OF_MAIN 확인됨).
즉 본 PR 은 spec 을 바꾸지 않고, 기존 spec Rationale 을 코드 주석에서 **요약 중복 대신 포인터로
교체**하는 작업이다.

## 발견사항

검토 관점 1~4 (기각된 대안 재도입 / 원칙 위반 / 무근거 번복 / invariant 우회) 기준으로 CRITICAL·WARNING
후보를 찾지 못했다. 오히려 아래는 연속성이 **잘 지켜진 사례**로 기록해 둔다 (INFO, 비차단):

- **[INFO] 기각된 대안("소비처 직렬화 여부" 기준)이 재도입되지 않았음을 확인**
  - target 위치: `secret-resolver.service.ts` catch 블록 주석 (diff L1575~L1585), `expression-resolver.service.ts`/`code.handler.ts` 신규 주석 (diff L1553~L1558, L1640~L1646)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` `## Rationale` — "`Error.cause` 부착 기준을 '소비처가 직렬화하는가' 로 잡지 않은 이유 (§6.3.1, 2026-08-29)" 항목. 이 항목은 "지금 `.cause` 가 클라이언트로 직렬화되는가" 를 **명시적으로 기각**하고, "에러 객체 자신의 성질(C1 message 포함 여부 · C2 부가 속성 유무)" 을 채택했다.
  - 상세: secret-resolver 주석은 "이 경로의 에러가 서버 로그에만 남는 것도 아니다(#814 가 그 오전제를 반증)" 라는, 기각된 기준과 유사해 보이는 문구를 포함하지만, 이는 **판정 근거(C1: message 가 원본을 의도적으로 안 담는다)를 보조 설명**하는 문장이지 판정축으로 쓴 것이 아니다. 실제 판정 순서는 "C1 이 거짓 → 그래서 cause 미부착, C2 는 판정 불요" 로 §6.3.1 절차를 정확히 따른다. `expression-resolver`/`code.handler` 쪽도 C1(message 가 원본 포함)·C2(부가 속성이 `code`/`position`/`stack` 뿐, 민감정보 아님)를 각각 실측 근거(`packages/expression-engine/src/errors.ts` 확인 결과 `code`/`position` 두 필드뿐임을 대조 확인)와 함께 명시해 §6.3.1 을 정확히 구현했다.
  - 제안: 조치 불필요. 다만 secret-resolver 주석의 "서버 로그에만 남는 것도 아니다" 문장이 §6.3.1 의 "기각된 기준"과 표면적으로 닮아 다음 검토자가 오인할 소지가 있으니, 이후 이 주석을 다시 편집할 기회가 있으면 "이 사실은 C1 판정의 보조 근거일 뿐 판정축이 아니다" 를 한 문장 덧붙이는 것을 고려할 수 있다 (강제 아님).

- **[INFO] 주석 내 사실 정정(realm 귀속)은 spec 결정 번복이 아님 — 범위 확인**
  - target 위치: `code.handler.spec.ts` diff L1611~L1628 ("`toBeInstanceOf(Error)` 를 쓰지 않는" 이유를 "isolate 경계" → "Jest 의 realm" 으로 정정, 2026-08-29 실측 포함)
  - 과거 결정 출처: 해당 파일 자체의 기존 주석(spec `## Rationale` 항목 아님 — 코드 주석 수준의 기술적 설명)
  - 상세: 이 정정은 spec 문서의 `## Rationale` 을 다루지 않으며, 단지 코드 주석에 있던 "isolated-vm 자기 realm" 이라는 기존 설명이 실측(host 에서는 `instanceof Error` true, Jest vm context 에서는 false)으로 틀렸음을 바로잡은 것이다. `developer` 의 쓰기 권한(`codebase/**`)범위 안이고, spec 자기반증형 소정정 절차(5개 조건)는 spec 텍스트에만 적용되므로 해당 없음 — 여기서는 애초에 적용 대상이 아니다. 테스트 단언(`expect(cause).toBeDefined()` 등)이나 §6.3.1 C1/C2 판정 자체는 변경되지 않았다.
  - 제안: 조치 불필요.

## 요약

이번 eslint10-upgrade 변경분(`spec/5-system/` 관련 코드)은 로직 변경 없이 주석만 갱신했으며, 그 주석들은
전부 `spec/5-system/3-error-handling.md` §6.3.1 및 그 `## Rationale` ("소비처 직렬화 여부" 기준을 명시적으로
기각하고 C1 AND C2 를 채택한 결정)을 정확히 인용·구현한다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거
번복, invariant 우회 중 어느 것도 발견되지 않았다. 오히려 "정본에 요약을 중복하지 않고 포인터만 남긴다"는
바람직한 패턴(주석 자체가 "여기 요약을 두지 않는다" 고 명시)을 보여주는 사례다.

## 위험도

NONE
