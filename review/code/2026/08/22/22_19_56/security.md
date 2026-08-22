# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/executions/executions.service.ts` — 유일한 코드 변경 파일. `reRun()`의 40줄 입력 해석 블록(스키마 로드 → 마커 거부 resolve → 검증 실패 응답 매핑)을 `resolveManualOverrideInput` private 헬퍼로 추출한 순수 리팩터.
- 나머지 12개 파일(`plan/**`, `review/consistency/**`)은 마크다운/JSON 문서(plan 추적·consistency 리포트)로, 실행 코드가 아니어서 보안 관점 분석 대상이 아님. 시크릿·인젝션 패턴 없음을 확인.

## 발견사항

없음.

### 확인한 내용 (근거)

1. **동작 동등성**: 원본 `git show 95985e3ee`로 대조한 결과, 추출된 `resolveManualOverrideInput`은 삭제된 인라인 블록과 **바이트 단위로 동일한 로직**이다 — 스키마 로드 인자, `resolveTriggerParametersRejectingMasked(schema, inputOverride)` 호출 순서, `catch` 분기의 `code: 'INVALID_TRIGGER_PARAMETERS'` / `details: toTriggerParameterErrorDetails(err.errors)` 응답 봉투 전부 보존됨. 새 취약점을 만들 여지가 없는 기계적 추출.

2. **마커 재제출 거부(서버측 방어, EIA §R17) 보존**: 이 블록의 핵심 보안 로직인 "마스킹된 값이 그대로 재제출됐는가"를 검사하는 `resolveTriggerParametersRejectingMasked` 호출과 그 호출 순서(raw 우선 검사)가 그대로 헬퍼 안으로 이동했다. UI 를 거치지 않는 클라이언트(curl 등)의 우회를 막는 서버 2층 방어가 약화되지 않았다.

3. **`masked-reject-callers-guard` CI 가드 유효성**: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts`를 확인한 결과 이 가드는 **파일이 base 함수(`resolveTriggerParameters`)를 직접 import 하는지**를 AST 로 검사하며, wrapper(`resolveTriggerParametersRejectingMasked`) 호출이 어느 메서드/함수 내부에 있는지는 판단 기준이 아니다. `executions.service.ts`는 리팩터 전후 모두 wrapper만 import 하므로 가드 커버리지에 회귀 없음 — plan 문서가 주장한 M3 뮤테이션 검증 결과와 일치.

4. **인가/IDOR 체크 무변경**: `reRun()`의 워크스페이스 격리(`RERUN_EXECUTION_NOT_FOUND`), owner/admin 판정(RR-PL-06, `isOwnerOrAdmin`), chain 깊이 제한(RR-PL-05) 등 인가 로직은 이 diff 범위 밖이며 손대지 않았다.

5. **에러 응답 노출**: `toTriggerParameterErrorDetails(err.errors)`로 필드별 검증 실패 내역만 `details`에 실리며, 스택트레이스·내부 쿼리·시크릿 등 민감정보 노출 패턴 없음(기존과 동일).

6. **하드코딩 시크릿/인젝션/암호화**: 이번 diff 에 신규 SQL/쿼리, 하드코딩 자격증명, 약한 해시/암호화 알고리즘, 사용자 입력을 직접 커맨드·경로에 조합하는 코드 없음.

## 요약

본 변경은 기존에 이미 보안 검토·경화(하드닝)를 거친 재제출 마스킹 거부 로직을 동작 변경 없이 private 헬퍼로 추출한 순수 리팩터다. 원본과의 diff 대조 및 CI 가드(`masked-reject-callers.spec.ts`) 검토 결과, 마커 재제출 방어·에러 코드/봉투 계약·인가 체크가 모두 그대로 보존되어 새로운 보안 결함이나 회귀를 발견하지 못했다.

## 위험도

NONE
