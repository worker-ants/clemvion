# Architecture Review — keyset 커서 id 성분 UUID 형태 검증

## 발견사항

- **[INFO]** 근거 주석(~12~13줄, `isUuidShaped` 선택 이유·22P02→500 마스킹 메커니즘·spec Rationale 인용)이 두 디코더에 거의 동일하게 복제됨
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-64` (전체 파일 컨텍스트 게이트 기준) / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-177`
  - 상세: 검증 로직 자체(`isUuidShaped` 호출)는 공유 유틸(`common/utils/uuid.ts`)을 통해 재사용되므로 코드 중복은 아니다. 그러나 그 함수를 고른 이유·마스킹 메커니즘 설명이 산문으로 양쪽에 그대로 복제되어, 근거가 바뀌면 두 곳을 동기화해야 하는 유지보수 부담이 생긴다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (같은 세션, `/ai-review 2026/09/12/23_19_03` maintainability INFO#1)에 "상세 근거를 `isUuidShaped` JSDoc 한 곳으로 모으고 호출부는 짧은 참조로 압축" 하는 처분안이 이미 등재되어 있다. 이번 배치에서 손대지 않은 이유(주석-only라 수렴 판정 기준에 안 걸림)도 타당하다 — 신규 지적이 아니라 기존 추적 항목의 재확인으로 처리해도 된다.

- **[INFO]** 개념적으로 같은 "keyset 커서" 추상화가 두 모듈에서 손으로 각각 구현되어 있고, id 검증 실패 시 처분(무시 vs 400)도 서로 다름
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` 모듈 레벨 함수 `decodeCursor` / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` 클래스 private 메서드 `decodeCursor`
  - 상세: 인코딩이 다르고(평문 `<iso>|<id>` vs base64 JSON) 실패 계약도 다르다(하나는 조용히 첫 페이지로, 하나는 `400 INVALID_CURSOR`). `2-api-convention.md §8.2` 가 커서 페이지네이션을 단일 표준으로 서술하는 것과 어긋나는 비대칭이 이번 변경으로 오히려 "각자의 기존 계약을 강화"하는 방향으로 굳어졌다. 다만 이는 이번 diff 가 만든 문제가 아니라 기존에 있던 비대칭을 그대로 보존한 것이고, 통일은 관측 가능한 동작 변경이라 제품 결정이 필요하다는 판단(`keyset-cursor-uuid-validation.md §A/§C`)이 명시적으로 문서화되어 있다.
  - 제안: 현재 상태로 무방하나, 공용 keyset-cursor 헬퍼 추출은 "Rule of Three" 기준으로 판단할 것 — 모집단이 2인 지금은 추출 비용이 편익을 넘는다는 plan 의 판단이 합리적이다. 세 번째 유사 디코더가 생기면 그때 추상화를 재검토하라는 신호로 plan 에 남겨 두는 것이 적절하다(이미 §C 에 등재됨).

- **[INFO]** `GlobalExceptionFilter` 에 22P02→400 분기를 넣는 중앙집중식 처방을 명시적으로 기각하고, 대신 각 입구(디코더)에서 조기 검증하는 방향을 택함 — 아키텍처적으로 올바른 판단
  - 위치: `plan/in-progress/keyset-cursor-uuid-validation.md §A` (근거), 실제 적용은 위 두 서비스 파일
  - 상세: 필터는 값의 출처(클라이언트 입력 vs 서버 서명값)를 알 수 없는 레이어라는 근거로, 그 레이어에 검증 책임을 두면 `spec/5-system/3-error-handling.md §1` 이 이미 세운 원칙("서버가 서명한 값에 400 을 내면 서버 버그를 클라이언트 오류로 보고하게 된다")을 위반하게 된다는 점을 실측(23502 캐너리)까지 곁들여 논증했다. 계층별 책임 경계를 지키는 판단으로, 안티패턴(잘못된 위치에서의 조기 일반화)을 피한 사례다. 결함이 아니라 긍정적으로 기록한다.

## 요약

이번 변경은 두 개의 독립적인 keyset 커서 디코더(`LoginHistoryService`, `BackgroundRunsService`)에 UUID 형태 검증을 추가하는 좁고 국소적인 수정이다. 검증 로직은 이미 존재하는 공유 유틸(`isUuidShaped`)을 그대로 재사용해 DIP/DRY 를 지켰고, 각 서비스의 기존 실패 계약(무시 vs 400)을 바꾸지 않아 SRP·개방-폐쇄 원칙에 부합한다. `GlobalExceptionFilter` 에 중앙집중식 22P02 분기를 넣는 대안을 검토했으나, 필터가 값의 출처를 알 수 없다는 계층 책임 논거로 명시적으로 기각한 결정은 레이어 경계를 정확히 지킨 좋은 사례다. 남은 아키텍처 부채(근거 주석 중복, 두 디코더 계약 비대칭, 공용 헬퍼 부재)는 모두 이번 diff 이전부터 존재했거나 이번 diff 로 인해 새로 생긴 것이 아니며, `plan/in-progress/` 문서에 근거와 함께 명시적으로 등재되어 후속 결정을 기다리는 상태다. 순환 의존성·모듈 경계 침범·과도한 추상화 등 구조적 결함은 발견되지 않았다.

## 위험도
LOW
