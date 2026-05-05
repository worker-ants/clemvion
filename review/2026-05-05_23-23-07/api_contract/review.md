### 발견사항

해당 없음

이번 변경은 전부 프론트엔드 UI 레이어 내부에 국한된다:

- `cron-to-visual.ts` — 순수 클라이언트 사이드 유틸리티 (파싱/빌드)
- `page.tsx` — `VisualCronEditor` 컴포넌트의 상태를 부모로 lift하는 리팩터링
- i18n 사전 추가, 테스트 추가, 스펙/플랜 문서 갱신

백엔드 HTTP API 호출 경로(`apiClient.post /schedules`, `apiClient.patch /schedules/:id` 등)와 페이로드 필드(`cronExpression`, `name`, `workflowId`, `timezone`, `parameterValues`)는 변경 전후 동일하다. `formCron` 에 담기는 값이 기존과 동일한 5-필드 표준 cron 문자열이며, 백엔드가 수신하는 요청 스키마에는 아무 영향이 없다.

### 요약

변경된 코드는 스케줄 생성·수정 다이얼로그의 "Cron 표현식 ↔ 시각 편집기" 탭 전환 시 상태 손실을 해결하기 위한 순수 프론트엔드 리팩터링이다. 백엔드 엔드포인트, 요청/응답 스키마, 인증·인가, URL 설계 어느 측면에도 변경이 없으므로 API 계약 관점의 위험은 존재하지 않는다.

### 위험도

NONE