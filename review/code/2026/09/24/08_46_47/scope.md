# 변경 범위(Scope) 리뷰 — `removeMember()` owner 보호 가드 TOCTOU 수정

## 발견사항

- **[INFO]** `codebase/backend/test/helpers/concurrency.ts` 의 `VACUITY_GUARD_MS` export 와, 그로 인한 `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` 한 줄 변경은 "owner 승격 TOCTOU" 라는 이번 작업의 직접 대상(rotate 동시성이 아니라 member 제거 동시성)이 아닌 파일을 건드린다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts:31`(`export const VACUITY_GUARD_MS = 1_500;`), `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts:9`(신규 import), `:121`(`setTimeout(() => resolve({ settled: false }), VACUITY_GUARD_MS)`).
  - 상세: `integration-rotate-concurrency.e2e-spec.ts` 는 "rotate" 기능의 동시성 테스트로, 이번 PR 이 다루는 owner 제거/승격 TOCTOU 와 도메인이 다르다. 다만 변경 자체는 리터럴 `1_500` 을 동일 값의 export 상수로 치환하는 것뿐이고, 이 리뷰 라운드 자체가 이전 `/ai-review` 세션(`08_09_57` W5)에서 "공허성 가드 타임아웃이 세 번째로 하드코딩됐다"고 지적한 것을 이번 턴에 해소한 결과다(`RESOLUTION.md` 항목 5, `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목에도 근거가 남아 있다). 즉 무단 확장이 아니라 같은 PR 사이클 내 리뷰 피드백 반영이며, 변경 폭도 1줄+import 1줄로 최소다.
  - 제안: 조치 불요 — 근거가 문서화돼 있고 변경이 기계적이다. 향후 유사 케이스에서 "리뷰 피드백 반영으로 인접 파일을 건드린 이유"를 커밋 메시지나 plan 에 남기는 관례를 유지할 것.

## 점검 관점별 확인

1. **의도 이상의 변경**: 없음. 핵심 diff(`workspaces.service.ts`)는 정확히 `removeMember()` 의 owner 가드 TOCTOU 를 닫는 데 필요한 세 부분(import `Not` 추가, `throwCannotRemoveOwner()` 헬퍼, DELETE 술어 + 0-행 재조회 분기)으로만 구성돼 있다. 다른 메서드는 손대지 않았다.
2. **불필요한 리팩토링**: `throwCannotRemoveOwner()` 추출은 이번 diff 가 owner 가드를 부르는 자리를 2곳(이른 가드, 재조회 분기)으로 늘렸기 때문에 발생한 필연적 결과이지 별도 정리가 아니다. JSDoc 이 선례(`throwMemberNotFound()` 세 벌 복제 지적)까지 인용하며 근거를 남겼다.
3. **기능 확장**: 없음. 새 엔드포인트·새 옵션·새 분기 없음 — 기존 계약(403 `CANNOT_REMOVE_OWNER`)을 동시성 하에서도 참으로 만드는 것뿐이다.
4. **무관한 수정**: 위 INFO 1건 외 없음. `workspaces.service.spec.ts` 의 `FindOperator` import 추가도 같은 파일의 새 단언(`criteria.role.type`/`.value`)에 직접 쓰인다.
5. **포맷팅 변경**: 관찰되지 않음. diff 전체가 의미 있는 줄 추가/치환이며 순수 개행·공백 변경은 없다.
6. **주석 변경**: `removeMember()` JSDoc·인라인 주석 갱신은 코드 동작 변화(보장 범위가 "감사 중복"에서 "감사 중복 + owner 삭제" 둘로 확장)를 정확히 반영한 것이고, 종전 예고 문장("함께 닫지 않았다")을 남겨 두면 오독을 유발하므로 정정한 것 — CHANGELOG 마찬가지. 불필요한 주석 변경이 아니다.
7. **임포트 변경**: `Not`(workspaces.service.ts), `FindOperator`(spec.ts), `VACUITY_GUARD_MS`(두 e2e 파일) 전부 같은 diff 안에서 실사용된다. 미사용 임포트 추가나 무관한 정리 없음.
8. **설정 변경**: 없음. 스키마·마이그레이션·설정 파일 변경 없음.

`plan/in-progress/member-owner-toctou.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신), `review/code/2026/09/24/08_09_57/**`, `review/consistency/2026/09/24/07_29_15/**` 는 이 저장소의 표준 워크플로 산출물(plan tracking, 리뷰/일관성 검토 산출물 커밋)이며, scope 이탈이 아니라 프로세스 준수의 일부다.

## 요약

이번 변경은 `removeMember()` owner 보호 가드의 TOCTOU 를 닫는다는 단일 의도에 매우 엄격하게 부합한다. 핵심 서비스 코드는 필요한 최소 범위(import 1개, 헬퍼 추출 1개, DELETE 술어 + 재조회 분기)만 건드렸고, 테스트·plan·CHANGELOG·리뷰 산출물 변경은 모두 그 의도에 직접 대응하거나 프로젝트 표준 프로세스 산출물이다. 유일하게 도메인이 다른 파일(`integration-rotate-concurrency.e2e-spec.ts`)에 손댄 부분은 같은 PR 사이클의 리뷰 피드백(중복 하드코딩 제거)을 반영한 것으로, 근거가 문서화돼 있고 변경 폭도 1줄에 그쳐 문제로 보지 않는다.

## 위험도

NONE
