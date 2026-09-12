# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** 동일한 근거(rationale) 주석 블록이 두 파일에 거의 그대로 복제됨
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-64` (`decodeCursor` 내부) 및 `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-177` (`decodeCursor` 내부)
  - 상세: `isUuidShaped` vs `isValidUuid` 선택 이유, SQLSTATE 22P02 → 500 마스킹 메커니즘, `spec/data-flow/12-workspace.md §Rationale "UUID 검증 강도 비대칭"` 인용을 설명하는 12줄짜리 주석이 두 파일에 표현만 살짝 바꿔(반환 방식 `return null` vs `throw`) 복사돼 있다. 코드 자체는 각 1줄(`if (!isUuidShaped(...))`)뿐이라 주석 대 코드 비율이 매우 높다. 두 파일이 서로를 "형제는 다르게 동작한다"고 명시적으로 상호 참조하고 있어 완전한 암묵적 드리프트 위험은 아니지만, 근거가 갱신될 때(예: `isUuidShaped` 정의나 워크스페이스 Rationale이 바뀔 때) 두 자리를 수동으로 동기화해야 한다.
  - 제안: 이 정도로 상세한 설명은 이미 `codebase/backend/src/common/utils/uuid.ts`의 `isUuidShaped` JSDoc에 존재하므로(파일을 열어 확인함 — 동일한 내용을 이미 서술), 각 호출부 주석은 "왜 이 함수를 쓰는지 + 형제 디코더와 계약이 다르다는 점"만 짧게 남기고 상세 근거는 `isUuidShaped`의 JSDoc으로 링크(`@see`/문구 인용)하는 방식으로 압축할 여지가 있다. 다만 이 저장소의 기존 관례(보안 관련 비자명한 결정에 상세 근거 주석을 남기는 스타일 — 같은 파일의 `record()` JSDoc, `encodeCursor` 주석 등)와 일관되므로 강하게 문제 삼을 사안은 아니다.

- **[INFO]** 두 keyset 커서 디코더가 유사한 검증 로직(구분자/형식 파싱 → 날짜 검증 → id 형태 검증)을 각각 손으로 구현하고 있어 구조적 중복이 존재
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` 함수 `decodeCursor` (파일 전체 컨텍스트 45-67행) 및 `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` 메서드 `decodeCursor` (파일 전체 컨텍스트 149-188행)
  - 상세: 인코딩 형태(파이프 구분 문자열 vs base64 JSON)와 실패 시 계약(무시 후 1페이지 vs 400 `INVALID_CURSOR`)이 달라 단순 추출로 합칠 수는 없지만, "날짜 파싱 실패 시 무효화" + "id가 `isUuidShaped`가 아니면 무효화"라는 뼈대는 두 곳에서 반복된다.
  - 제안: 이번 PR 범위에서 처리할 필요는 없음 — `plan/in-progress/keyset-cursor-uuid-validation.md §C`에 "두 디코더가 손으로 각각 구현돼 있다"는 사실이 이미 기술 부채로 명시 등재되어 있고, 계약 통일이 선행돼야 유의미한 추출이 가능하다는 근거도 함께 적혀 있다. 따라서 이는 새로 지적하는 결함이 아니라 기존 인지·등재된 부채임을 확인만 해 둔다.

- **[INFO]** 신규 테스트 케이스 이름·주석에 한국어 설명이 상세히 붙어 있고, 반증(대조군) 테스트가 짝을 이루는 패턴이 두 스펙 파일에서 동일하게 반복됨
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts` (`describe('findForUser')` 블록, 신규 케이스 2건) 및 `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts` (`describe('getBackgroundRun')` 블록, 신규 케이스 2건)
  - 상세: "비-UUID 거부" + "느슨한 형태(nil UUID) 통과 대조군"의 대칭 구조가 두 파일에서 거의 동일한 서술로 반복된다. 이는 결함이 아니라 오히려 이 저장소가 반복적으로 강조하는 "반대 방향 대조군 없이는 술어가 조용히 넓어질 수 있다"는 회귀 방지 관례를 잘 따른 것이다. 가독성·의도 명확성 관점에서 긍정적이므로 감점 요인 아님 — 참고로만 기록.

## 요약

변경 범위가 매우 좁고(두 서비스의 `decodeCursor`에 기존 유틸리티 `isUuidShaped` 호출 1줄씩 추가) 단일 책임 원칙을 그대로 유지한다. 새 로직·조건 분기·중첩이 늘지 않았고 매직 넘버도 없으며, 기존에 존재하는 검증 함수를 재사용해 새로운 정규식이나 유사 로직을 만들지 않은 점이 좋다. 네이밍(`isUuidShaped`, `CursorPayload.i` 등)은 기존 컨벤션과 일치한다. 유일하게 짚을 만한 점은 두 파일에 거의 동일한 12줄짜리 근거 주석이 복제되어 있다는 것과, 두 디코더 자체의 구조적 중복인데, 후자는 이미 plan 문서(`keyset-cursor-uuid-validation.md §C`)에 기술 부채로 정식 등재되어 있어 새로운 발견이 아니다. 테스트는 정상 케이스와 대조군(느슨한 형태 통과)을 짝지어 명확한 의도를 드러내며, 뮤테이션 검증까지 plan에 기록되어 있어 유지보수 관점에서 신뢰도가 높다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
