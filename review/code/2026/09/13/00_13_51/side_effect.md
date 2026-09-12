# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공개 API 두 엔드포인트의 관측 가능한 실패 응답이 변경된다 (500 → 200 / 500 → 400)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`decodeCursor` 의 `if (!isUuidShaped(id)) return null;`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`if (!isUuidShaped(parsed.i)) { throw new Error(...); }`)
  - 상세: `GET /api/users/me/login-history` 는 비-UUID 커서 id 를 이제 조용히 무시하고 200(1페이지)을 반환하며, `GET /api/executions/:executionId/background-runs/:backgroundRunId` 는 400 `INVALID_CURSOR` 를 반환한다. 종전에는 두 경우 모두 Postgres SQLSTATE 22P02 가 `GlobalExceptionFilter` 를 통과해 500 으로 마스킹됐다. 이는 인터페이스(공개 API 계약) 변경이며, 이 응답 코드를 근거로 알람을 걸어 둔 외부 모니터링·클라이언트 재시도 로직이 있다면 그 신호를 더 이상 받지 못한다.
  - 근거: 이 영향은 `CHANGELOG.md`(`⚠️ 배포 시 확인` 절)와 `plan/in-progress/keyset-cursor-uuid-validation.md §B`에 이미 명시적으로 기록되어 있고, 의도된 변경으로 문서화되어 있다. 부작용 관점에서는 "숨겨진" 부작용이 아니라 "공지된" 인터페이스 변경이므로 CRITICAL/WARNING 이 아닌 INFO 로 남긴다.
  - 제안: 별도 조치 불요(이미 CHANGELOG·plan 에 등재됨). 배포 시 모니터링 대시보드에서 해당 500 카운트에 의존하는 알람이 있는지만 재확인 권고.

- **[INFO]** 구조적으로 동일한 두 keyset 커서 디코더가 서로 다른 실패 계약을 유지한다 (비대칭 고착)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` 의 `decodeCursor` (무시 후 `null` 반환) vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` 의 `decodeCursor` (400 `INVALID_CURSOR` throw)
  - 상세: 이번 변경이 두 디코더 각각의 "기존 실패 모드와 같은 처분"을 그대로 유지하며 id 검증만 추가했다. 결과적으로 같은 개념(잘못된 keyset id)에 대해 호출자마다 다른 응답 계약(무시 vs 명시적 에러)이 강화되어 굳어진다 — 이 두 엔드포인트를 함께 쓰는 클라이언트/SDK 코드가 있다면 에러 처리 분기를 엔드포인트별로 따로 둬야 한다는 뜻이다.
  - 근거: `plan/in-progress/keyset-cursor-uuid-validation.md §C`와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "완전히 해소된 상태가 아니다"로 이미 등재되어 있고, 통일 여부는 planner 결정 사항으로 명시되어 있다.
  - 제안: 별도 조치 불요(이미 기등재). 통일 결정은 별도 planner 턴에서.

- **[INFO]** 트래커 항목의 취소 처리 방식(won't-do)이 `GlobalExceptionFilter` 전역 동작을 바꾸지 않기로 결정
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다` 항목의 취소선 처리)
  - 상세: 원래 제안(필터에 22P02 → 400 전역 분기 추가)은 저장소 전체의 실패 분류를 바꾸는 광범위한 부작용을 낼 수 있었는데, 이 배치는 그 제안을 명시적으로 기각(won't-do)하고 각 엔드포인트 입구에서 국소적으로 검증하는 방식을 택했다. 이는 부작용 범위를 "필터(전역)"에서 "개별 디코더(로컬)"로 좁힌 올바른 방향이며, 별도 시정 사항 없음.
  - 제안: 없음(정보성 기록).

## 확인한 항목 (문제 없음)

- **전역 변수**: 신규 전역 변수 도입 없음. `CURSOR_UUID`/`NIL_UUID` 는 테스트 파일 내 로컬 `describe`/`it` 스코프 상수.
- **함수 시그니처**: `decodeCursor`(양쪽 파일 모두 모듈 비공개 함수)의 파라미터·반환 타입은 변경되지 않았다. 내부 분기만 추가됐고, 두 함수 모두 외부로 export 되지 않는다.
- **공유 유틸 함수**: `isUuidShaped`(`codebase/backend/src/common/utils/uuid.ts`)는 이번 diff 에서 구현이 전혀 수정되지 않았다(순수 함수, 모듈 레벨 정규식 상수 재사용, 부작용 없음). 새 호출부 2곳이 추가됐을 뿐 기존 호출부(`workspace-context.util.ts`)의 동작에는 영향 없음.
- **파일시스템**: `CHANGELOG.md` 갱신과 `plan/in-progress/keyset-cursor-uuid-validation.md` 신규 생성은 이 워크플로의 정상적인 산출물이며 예상치 못한 파일 변경이 아니다.
- **환경 변수/네트워크 호출**: 해당 없음. e2e 테스트가 실 DB·HTTP 호출을 하지만 이는 e2e 스펙의 정상적인 테스트 동작이며 프로덕션 코드가 새 외부 호출을 추가하지 않았다.
- **이벤트/콜백**: 변경 없음.
- **호출 순서(사전 인가 검증 전 커서 파싱)**: `background-runs.service.ts` 의 `getBackgroundRun` 은 `decodeCursor`(이제 새 400 분기 포함)를 `verifyExecutionAccess`(워크스페이스 소유권 검증) **이전**에 호출한다. 다만 이 순서는 이번 diff 가 도입한 것이 아니라 base64/JSON/날짜 검증이 이미 같은 자리에서 인가 이전에 수행되고 있었다 — 새 `i` 검증은 기존 순서에 편승했을 뿐 새로운 정보 노출 표면을 만들지 않는다(커서 유효성은 특정 리소스 소유권과 무관한 값).

## 요약

이번 변경은 두 keyset 커서 디코더에 `isUuidShaped` 검증을 추가해 인증된 사용자가 비-UUID 커서로 Postgres SQLSTATE 22P02 → 500 마스킹을 유발하던 경로를 막는다. 부작용 관점에서 가장 눈에 띄는 지점은 두 엔드포인트의 **관측 가능한 응답 코드가 바뀐다**는 점(500→200, 500→400)인데, 이는 CHANGELOG 와 plan 문서에 배포 영향(모니터링 신호 소실)까지 포함해 이미 상세히 공지되어 있어 "숨은" 부작용으로 보기 어렵다. 전역 상태·환경 변수·네트워크 호출·함수 시그니처·공개 export 변경은 없으며, 공유 유틸 `isUuidShaped` 자체는 손대지 않고 새 호출부만 추가해 기존 소비처에 영향이 없다. 두 디코더의 실패 계약 비대칭(무시 vs 400)은 의도적으로 유지된 기존 동작이며 통일 여부는 별도 planner 결정 사항으로 적절히 이관되어 있다.

## 위험도

LOW
