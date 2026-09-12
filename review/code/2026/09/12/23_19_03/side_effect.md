# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 의도된 관측 가능한 동작 변경 (HTTP status code) — 두 공개 엔드포인트
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`if (!isUuidShaped(id)) return null;`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`if (!isUuidShaped(parsed.i)) { throw new Error(...); }`)
  - 상세: `GET /api/users/me/login-history` 는 비-UUID 커서 id 에 대해 `500` → `200`(커서 무시, 1페이지)으로, `GET /api/executions/:id/background-runs/:runId` 는 `500` → `400 INVALID_CURSOR` 로 바뀐다. 둘 다 이 fix 의 목적 자체(잘못 마스킹된 500 을 제거)라 "의도치 않은" 부작용은 아니지만, 5xx 를 알람/재시도 신호로 쓰는 외부 모니터링·클라이언트에는 관측 가능한 회귀다. `CHANGELOG.md:73-76` 에 "⚠️ 배포 시 확인" 문구로 이미 고지되어 있어 절차상 문제는 없다.
  - 제안: 없음(이미 CHANGELOG 에 문서화됨). 배포 채널에 그 고지가 실제로 전달되는지만 확인.

- **[INFO]** 두 형제 디코더의 실패 계약 비대칭이 유지된다(무시 vs 400) — 새 결함 아님, 기존 비대칭을 코드에 명시적으로 남긴 것
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` `decodeCursor` (id 미검증 시 `null` 반환 → 무시) vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `decodeCursor` (`i` 미검증 시 `BadRequestException` throw)
  - 상세: 두 곳 모두 "각자의 기존 실패 계약을 유지"하는 방향으로 수정됐고, 통일하지 않은 이유(관측 가능한 동작 변경이라 별도 제품 결정 필요)가 양쪽 코드 주석과 `plan/in-progress/keyset-cursor-uuid-validation.md §B/§C`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 체크리스트에 모두 등재되어 있다. 부작용이라기보다 기존에 이미 존재하던 비대칭을 드러낸 것.
  - 제안: 없음(추적 완료, planner 항목으로 넘어감).

- **[INFO]** `GlobalExceptionFilter` 는 의도적으로 건드리지 않음 — 이 fix 가 다루지 않는 22P02 유입 경로(예: `@Query()`·body 필드가 직접 uuid 컬럼에 바인딩되는 다른 자리)는 여전히 500 마스킹 가능성이 남는다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3224-3256` (won't-do 종결 근거), `plan/in-progress/keyset-cursor-uuid-validation.md §A`
  - 상세: 필터에 22P02→400 전역 분기를 추가하는 안은 `3-error-handling.md §1`("서버가 서명한 값에 400 을 내면 서버 버그를 클라이언트 오류로 보고하게 된다")을 근거로 명시적으로 기각됐다. 이번 diff 는 확인된 2개 입구(keyset 커서)만 좁혀서 고쳤고, 다른 잠재적 22P02 유입 경로는 범위 밖으로 남는다는 점이 문서에 정직하게 적혀 있다. 이 diff 가 만든 새로운 회귀는 아니며, 기존 상태(필터 미분기)를 그대로 유지하는 결정이다.
  - 제안: 없음(정보 제공 목적). 추후 다른 입구에서 유사 결함이 발견되면 이번 근거 문서를 참조.

## 부작용 없음으로 확인한 항목

- **시그니처/인터페이스**: 두 `decodeCursor` 는 모두 모듈-내부 함수/`private` 메서드이며 외부에 노출되지 않는다. export 되는 클래스 메서드(`findForUser`, `getBackgroundRun` 등)의 시그니처는 변경되지 않았다.
- **공유 유틸 재사용**: `isUuidShaped` 는 `codebase/backend/src/common/utils/uuid.ts` 에 이미 존재하던 함수를 그대로 import 해 쓴 것이고, 그 파일 자체는 이번 diff 에서 수정되지 않았다(`git diff` 로 미변경 확인). 새 전역 상태·새 정규식·중복 구현이 도입되지 않았다.
- **`GlobalExceptionFilter`**: 파일 목록에 없고 실제로 수정되지 않았다 — 필터의 기존 23505/http-exception 분기 동작은 무변이다.
- **파일시스템/네트워크/환경변수**: 코드 diff(파일 2~5) 에 파일 I/O, 외부 서비스 호출, `process.env` 접근이 없다. CHANGELOG·plan 문서(파일 1, 6, 7)는 저장소 내 문서 산출물로, 이 세션의 정상적인 작업 범위 안의 파일 쓰기다.
- **이벤트/콜백**: 변경된 두 함수 모두 순수 값 검증 로직 추가이며 새 이벤트 발행·콜백 등록이 없다.
- **background-runs 의 예외 처리**: 새로 추가된 `throw new Error('cursor id is not uuid-shaped')` 는 기존에 이미 있던 `try { ... } catch { throw new BadRequestException({...}) }` 패턴 안에 들어가며, catch 블록 자체는 수정되지 않았다 — 기존 에러 변환 경로를 그대로 재사용한다.

## 요약

이 변경은 keyset 커서 id 검증 누락으로 인한 500 마스킹 결함을 두 지점(`login-history.service.ts`, `background-runs.service.ts`)에서 각자의 기존 실패 계약을 유지한 채로 좁혀 고친 것이다. 시그니처·전역 상태·파일시스템·네트워크·환경변수·이벤트 축에서 새로운 부작용은 발견되지 않았다. 유일하게 실질적인 "부작용"은 두 공개 엔드포인트의 관측 가능한 status code 변화(500→200 / 500→400)인데, 이는 이 fix 의 목적 자체이며 CHANGELOG 에 배포 시 확인 사항으로 이미 명시돼 있다. `GlobalExceptionFilter` 자체는 (근거를 남긴 채) 의도적으로 건드리지 않아 필터 계층의 부작용 표면은 이번 diff 로 넓어지지 않았다.

## 위험도

LOW
