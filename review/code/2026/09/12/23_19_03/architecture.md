# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** 두 keyset 커서 디코더가 동일한 결함 클래스를 각자 손으로 고쳤고, 공유 추상화가 없다
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-65` (`decodeCursor`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-181` (`decodeCursor`)
  - 상세: 두 서비스가 "id 성분이 `uuid` 컬럼에 바인딩되기 전 형태를 검증해야 한다"는 같은 지식을 각각의 `decodeCursor` 에 독립 구현했고, 그 근거를 설명하는 11줄짜리 주석 블록이 두 파일에 거의 그대로 복제돼 있다(`isUuidShaped` 선택 이유, `isValidUuid` 를 쓰면 안 되는 이유, 형제 파일이 다른 처분을 한다는 사실까지 동일 문구). 인코딩 형식(파이프 구분 vs base64 JSON)과 실패 계약(무시 vs 400)이 다르다는 이유로 공용 keyset-cursor 코덱으로의 추출을 명시적으로 보류했다(`plan/in-progress/keyset-cursor-uuid-validation.md` §C, 118-129행 부근). 검증 로직 자체는 공유 유틸(`isUuidShaped`)을 재사용해 중복을 피했으므로 로직 중복은 아니지만, **그 로직을 어떻게·왜 호출하는지에 대한 서술적 지식**이 두 곳에 복제되어 있어 다음에 근거가 바뀌면(예: `isUuidShaped` 의 정의 변경) 두 파일을 동기화해야 한다.
  - 제안: 현재 규모(모집단 2, 인코딩 상이)에서 코덱 추출은 과도한 추상화일 수 있다는 plan 의 판단에 동의하지만, 최소한 공통 근거 설명은 `common/utils/uuid.ts` 의 `isUuidShaped` JSDoc 한 곳으로 모으고 각 서비스 주석은 그 문서를 가리키는 짧은 참조로 줄이는 편이 향후 드리프트를 줄인다. 세 번째 커서 디코더가 생기면 그때 재추출을 고려.

- **[INFO]** 같은 개념(malformed keyset cursor)에 대해 두 REST 표면의 실패 계약이 다른 채로 각각 강화되어, 통합 없이 비대칭이 사실상 고정됐다
  - 위치: `plan/in-progress/keyset-cursor-uuid-validation.md:77-83` (처분 섹션, "각자의 기존 계약을 유지")
  - 상세: `login-history` 는 비-UUID id 를 무시하고 1페이지로 폴백(200)하고, `background-runs` 는 400 `INVALID_CURSOR` 를 던진다. 이번 변경은 이 비대칭을 없애지 않고 **양쪽 다** id 검증을 추가해 각자의 기존 계약을 그대로 유지·강화했다 — plan 문서 스스로 이것이 "문서화되지 않은 비대칭을 사실상 고정하는 선택"이라고 인정한다. 이는 API 계약(인터페이스) 레이어의 일관성 문제로, 동일한 클래스의 문제(잘못된 페이지네이션 커서)에 대해 클라이언트가 두 가지 다른 처리 방식을 예상해야 하게 만든다. 통일은 관측 가능한 동작 변경이라 이 PR 범위 밖이라는 판단은 합리적이고, 실제로 `spec/2-api-convention.md §8.2` 갭으로 별도 planner 항목에 등재됐다(`plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 3298-3312행 부근).
  - 제안: 이미 백로그에 등재되어 있으므로 추가 조치는 불필요하다. 다만 이 PR 이 "고치는 김에 통일"하지 않고 **비대칭을 각각 굳혔다**는 사실이 다음 PR 에서 회귀 테스트(4개 뮤테이션 캐너리)를 깨지 않고는 통일이 더 비싸진다는 점만 기록해 둔다(정보성).

- **[INFO]** `GlobalExceptionFilter`(cross-cutting 레이어)에 22P02 분기를 추가하는 대신 각 서비스 경계에서 검증하는 설계 결정 — 레이어 책임 분리 관점에서 타당
  - 위치: `plan/in-progress/keyset-cursor-uuid-validation.md:17-52` (§A)
  - 상세: 애초 트래커 항목은 `GlobalExceptionFilter` 에 SQLSTATE 22P02 → 400 매핑을 넣는 처방이었으나, 실측 후 이 저장소의 기존 원칙(`3-error-handling.md §1`: "서버가 서명한 값에 400 을 내면 서버 버그를 클라이언트 오류로 보고하게 된다")과 기존 코드의 23502 처분(500 유지)이 이미 "값의 출처를 모르는 필터는 일괄 매핑을 하면 안 된다"는 원칙을 실천하고 있음을 근거로 처방을 철회했다. 대신 각 입구(서비스 레이어)에서 자신이 아는 컨텍스트로 조기 검증하는 기존 저장소 전략(`workspace-context.util.ts` 선례)을 따랐다. 이는 필터(횡단 관심사/에러 변환 레이어)와 서비스(비즈니스 로직 레이어)의 책임을 명확히 가르는 결정이고, 그 결정을 spec 원칙·기존 코드 사례로 뒷받침한 점이 좋다. 아키텍처적으로 견고한 판단이며 결함이 아니다.
  - 제안: 없음(참고용 긍정 기록).

## 요약

이번 변경은 두 REST 엔드포인트의 keyset 커서 디코더에 이미 존재하는 공유 유틸(`isUuidShaped`)을 가져와 UUID 형태 검증을 추가한 좁은 범위의 결함 수정이다. 검증 로직 자체의 중복은 없고(공유 유틸 재사용), 의존성 방향도 깨끗하며(서비스 → 공용 유틸, 순환 없음), 횡단 관심사(예외 필터)와 서비스 경계 검증의 책임을 가르는 판단도 spec 원칙과 기존 선례에 근거해 잘 뒷받침되어 있다. 다만 두 디코더 사이의 지식(설계 근거 주석)이 거의 그대로 복제되어 있고, 같은 개념(malformed cursor)에 대한 두 표면의 응답 계약(무시 vs 400)이 통일 없이 각각 굳어진 점은 향후 유지보수·API 일관성 관점에서 부담이 될 수 있다. 두 사안 모두 plan 문서에 근거와 함께 명시적으로 등재·유예되어 있어 이번 PR 의 결함이라기보다 이미 추적 중인 기술 부채로 보는 것이 타당하다.

## 위험도

LOW
