# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] plan 파일(spec-sync-config-gaps.md)이 변경 대상에 포함됨
- 위치: `plan/in-progress/spec-sync-config-gaps.md`
- 상세: plan 파일 수정은 developer SKILL 에서 허용된 쓰기 권한(`plan/**`) 범위이며, 해당 변경 내용은 §A.3 구현 완료를 반영하는 체크박스 갱신과 구현 요약 추가다. "미구현 — 결정 필요" 섹션 제목이 "§A.3 호출 이력 — 구현 완료"로 변경된 것 포함. CLAUDE.md "plan 체크박스 = 실제 상태" 정책에 따른 필수 갱신이므로 범위 이탈 아님.
- 제안: 없음.

### [INFO] consistency check 산출물(review/consistency/...)이 변경 대상에 포함됨
- 위치: `review/consistency/2026/06/14/14_33_40/SUMMARY.md`, `review/consistency/2026/06/14/14_33_40/_retry_state.json`
- 상세: SUMMARY.md 는 --impl-prep consistency check 게이트 결과물이며, _retry_state.json 은 하네스가 자동 생성하는 내부 상태 파일이다. 두 파일 모두 구현 착수 직전 consistency-check 의무 수행 증거로서, 본 PR 에서 함께 커밋하는 것은 정책상 적절하다. 단, 이 산출물이 `/ai-review` scope 분석의 "코드 변경" 범위에 포함된다는 점에서 혼동 가능성이 있으나, 내용 자체는 범위 이탈이 아님.
- 제안: 없음.

### [INFO] hooks.service.ts 에서 `clientIp` 변수 리팩토링이 포함됨
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts`, 라인 ~133~148
- 상세: 기존에는 `extractClientIp(input.headers)` 가 인증 IP whitelist 검증 시 인라인으로 한 번 호출되었다. 변경 후 이 호출을 `const clientIp`로 끌어올려 인증 검증과 execute() options 전달에 공용으로 사용한다. 이는 §A.3 `sourceIp` 캡처를 위해 필요한 최소한의 구조 조정이며 동작 등가다. 추출 함수 자체가 idempotent 이므로 회귀 없음.
- 제안: 없음. 범위 내 필요한 리팩토링.

### [INFO] chat-channel handleChatChannelWebhook 에서 `extractClientIp` 이중 호출
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts`, 라인 ~599 (diff 기준)
- 상세: handleWebhook 경로에서는 `clientIp` 변수를 재사용하지만, handleChatChannelWebhook 경로에서는 `extractClientIp(input.headers) ?? undefined`를 다시 직접 호출한다. 두 경로가 별도 함수라 handleWebhook 의 `clientIp` 변수를 공유할 수 없으므로, 이 차이는 코드 구조상 필연적이다. 관련 없는 중복이 아님.
- 제안: 없음. 범위 내 정상.

## 요약

변경된 15개 파일 전체가 §A.3 호출 이력(소스 IP·응답 코드·기간별 호출 수) 구현이라는 단일 목적에 집중되어 있다. DB 마이그레이션(V096), 엔티티 컬럼, ExecuteOptions 타입 확장, 실행 엔진 영속, hooks 전달, getUsage 집계 쿼리·DTO, 프론트엔드 드로어 UI·차트, i18n, 테스트, plan 갱신, consistency check 산출물까지 이 기능의 수직 슬라이스를 빠짐없이 덮는 변경이다. 불필요한 리팩토링, 무관한 파일 수정, 기능 확장, 포맷팅 혼입 등의 범위 이탈 징후는 발견되지 않았다. hooks.service.ts 의 `clientIp` 변수 추출은 §A.3 캡처에 직접 필요한 최소 변경이다.

## 위험도

NONE
