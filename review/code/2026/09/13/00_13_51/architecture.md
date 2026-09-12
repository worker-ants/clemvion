# Architecture Review — keyset 커서 id/i 성분 UUID 검증 (filter-pg-invalid-text)

## 발견사항

- **[INFO]** 두 keyset 커서 디코더의 실패 계약이 서로 다르다 (무시 vs 400) — 이미 등재·추적 중
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`if (!isUuidShaped(id)) return null;` → 조용히 무시, 1페이지) vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`if (!isUuidShaped(parsed.i)) { throw new Error(...) }` → 400 `INVALID_CURSOR`)
  - 상세: 같은 개념(keyset 커서의 id 성분 검증 실패)에 두 개의 서로 다른 응답 계약이 존재한다. `2-api-convention.md §8.2`가 cursor 페이지네이션을 단일 표준(opaque base64·실패 시 400)으로 서술하는데 `login-history`는 이를 따르지 않는다. 이 배치는 각 디코더의 **기존 실패 모드에 맞춰** id 검증만 추가했으므로 신규로 만든 비대칭은 아니고, 오히려 각 계약을 개별적으로 "굳히는" 효과를 낸다.
  - 제안: `plan/in-progress/keyset-cursor-uuid-validation.md §C` 및 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이미 planner 소관 항목으로 등재되어 있음을 확인. 추가 조치 불필요 — 신규 CRITICAL/WARNING으로 재등재하지 않음.

- **[INFO]** 두 커서 디코더가 손으로 각각 구현되어 검증 서사(comment)가 ~12줄 가까이 복제됨
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-64` / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-177`
  - 상세: `isUuidShaped` 호출 자체는 공유 유틸 재사용이라 로직 중복은 아니지만, 그 호출을 정당화하는 산문 주석(22P02 메커니즘·필터 미분기 이유·spec Rationale 인용)이 두 파일에 거의 동일하게 박혀 있다. 인코딩이 달라(파이프 구분 vs base64 JSON) 디코더 자체의 단순 추출은 어렵지만, 주석만이라도 `common/utils/uuid.ts`의 `isUuidShaped` JSDoc으로 모으고 호출부는 짧은 참조로 압축하는 편이 유지보수 관점에서 낫다.
  - 제안: 이미 `/ai-review 2026/09/12/23_19_03` maintainability INFO#1로 지적되었고 `spec-draft-nullable-notation-followups.md`에 후속 항목으로 등재됨(주석-only라 이번 배치 수렴 기준에는 안 걸림). 재조치 불요, 추적 확인만.

- **[INFO]** 공유 유틸 `isUuidShaped`의 소비 컨텍스트가 원래 문서화된 범위(워크스페이스/채널 인가) 밖으로 확장됨
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (이번 diff에 포함되지 않은 파일 — 신규 소비처만 diff에 추가됨: `login-history.service.ts:8`, `background-runs/background-runs.service.ts:22`)
  - 상세: `isUuidShaped`의 JSDoc은 "클라이언트가 보낸 식별자를 워크스페이스 인가 경로에서 거를 때 403↔400 오응답을 막는다"는 서사로 존재 이유를 설명한다. 이번 변경은 같은 함수를 **인가 축이 아닌 리소스 지목(커서 id)** 축에 재사용한다 — 술어가 답하는 질문("Postgres가 파싱 가능한가")은 컨텍스트 불변이라 원칙 위반은 아니지만, 소비처가 넓어진 만큼 중앙 JSDoc이 새 소비 맥락(500→200/400 마스킹 방지)을 반영하지 않아 다음 사람이 "이 함수를 바꾸면 어디까지 영향을 주는가"를 판단할 때 SoT가 완전하지 않다.
  - 제안: 개발자가 `plan/in-progress/keyset-cursor-uuid-validation.md §B`에서 이미 이 확장을 인지하고 명시적으로 기록했다(`--impl-prep rationale_continuity INFO#2`). 이번 배치에서 실제 소비처 목록을 하드코딩하지 않고 `grep` 재현 절차로 대체한 것(`uuid.spec.ts`의 새 주석)도 향후 드리프트에 대한 적절한 방어다. 즉시 조치 불요, 신규 등재 없음.

- **[INFO]** `GlobalExceptionFilter`에 22P02 분기를 넣지 않기로 한 결정은 레이어 책임 분리 관점에서 타당함 (긍정 관찰)
  - 위치: `plan/in-progress/keyset-cursor-uuid-validation.md §A`
  - 상세: 필터(cross-cutting 예외 변환 계층)는 값의 출처(서버 서명값 vs 클라이언트 입력)를 알 수 없어 일괄 400 매핑을 하면 "서버 버그"를 "클라이언트 오류"로 오분류하는 계약 위반이 생긴다. 검증 책임을 필터가 아니라 각 입구(디코더)로 내린 이번 설계는 단일 책임 원칙(필터=범용 예외 변환, 서비스=도메인별 입력 검증)에 부합하고, `workspace-context.util.ts` 선례와도 결이 같다. 별도 조치 불필요.

## 요약

이번 변경은 두 개의 keyset 커서 디코더(`login-history.service.ts`, `background-runs.service.ts`)에 기존 공유 유틸 `isUuidShaped`를 재사용해 id 성분 검증을 추가하는 좁은 스코프의 패치다. 검증 로직 자체는 새 함수를 만들지 않고 이미 존재하는 유틸을 재사용해 DRY를 지켰고, 각 디코더는 자신의 기존 실패 계약(무시 vs 400)에 맞춰 처분을 통일하지 않고 국지적으로만 확장했다 — 이는 관측 가능한 동작 변경을 배제하기 위한 의도적 선택이며 `plan/in-progress/keyset-cursor-uuid-validation.md`에 상세히 근거가 기록되어 있다. 두 계약의 비대칭, 디코더 구현의 중복, 주석 복제, 공유 유틸 소비 범위 확장 등은 모두 아키텍처적으로 관찰 가능하지만 전부 개발자 자신이 이미 실측·기록하고 planner/후속 트래커 항목으로 등재해 두었다(`spec-draft-nullable-notation-followups.md`). `GlobalExceptionFilter`를 건드리지 않기로 한 결정도 레이어 책임 분리 원칙에 부합하는 근거 있는 판단이다. 순환 의존성, 모듈 경계 위반, 새로운 안티패턴은 발견되지 않았다.

## 위험도

LOW
