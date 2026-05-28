# RESOLUTION — fix-mail-send-status ai-review

리뷰 세션: `review/code/2026/05/29/01_22_01/SUMMARY.md` (전체 위험도 MEDIUM, Critical 0).

## 조치 항목

| SUMMARY # | 카테고리 | 발견 | 조치 | commit |
|---|---|---|---|---|
| W3 / INFO1 | 보안 | error-port 메시지 무제한 DB/WS 저장 | `clampNodeErrorMessage` (2000자 상한) 도입, `finalizeErrorPortNode` 에서 적용 | refactor(review) |
| W6 / arch INFO3 / req | 요구사항·아키텍처 | `outgoingEdgeMap` optional → 미전달 시 fallback 침묵 | 파라미터 **required** 화 (nodeMap/executionMeta 도 위치상 required, 5개 호출부 모두 이미 전달). undefined 분기 제거 | refactor(review) |
| W7 / side-effect | 유지보수·보안 | top-level catch 의 `error.code` 가 임의 Error 의 `.code` 까지 누수 + 중복 | `instanceof ErrorPortFallbackError` 로 narrow (두 곳) | refactor(review) |
| W5 / W8 | 아키텍처·유지보수 | `executeNode` 내 64줄 error-port 인라인 블록 (SRP) | `finalizeErrorPortNode` private 메서드로 추출 | refactor(review) |
| W10 | 테스트 | `secure:'tls'` 매핑 미검증 | integrations spec 에 implicit-TLS 매핑 테스트 추가 | refactor(review) |
| W11 | 테스트 | `previewTest` email 경로 미커버 | previewTest email verify 테스트 추가 | refactor(review) |
| W18 | 테스트 | code 없는 error envelope 미테스트 | 엔진 spec 에 default-message 테스트 추가 | refactor(review) |
| W9 | 테스트 | `outgoingEdgeMap` 미전달 경로 | **moot** — 파라미터 required 화로 경로 자체 소멸 | (W6 와 동일) |
| INFO10 | 유지보수 | SMTP 타임아웃 하드코딩 | `SMTP_TEST_TIMEOUT_MS` 상수 추출 | refactor(review) |
| INFO12 | 문서 | `IntegrationTestResult.code` JSDoc MCP 전용 | `EMAIL_CONNECT_FAILED` 포함으로 갱신 | refactor(review) |
| INFO13 | 문서 | `ErrorPortFallbackError.code` 외부 직렬화 미명시 | JSDoc 한 줄 추가 | refactor(review) |

## 보류·후속 항목

| SUMMARY # | 발견 | 보류 사유 |
|---|---|---|
| **W1** | 보안 — SMTP `host` private IP 미차단 (SSRF) | **사용자 결정 대기 (ESCALATE)**. ① 이 risk 는 본 PR 신규 도입이 아니라 기존 `send_email` 핸들러가 이미 런타임에 host 로 접속하던 동작에 내재. ② private IP 하드 차단은 self-host 환경의 **내부 SMTP relay**(10.x/192.168.x/localhost mailhog 등 정상 사용처)를 깨뜨림. ③ SMTP 프로토콜 특성상 HTTP metadata(169.254.169.254) 탈취 난이도 높음. → 별도 보안 하드닝 이니셔티브로 분리 권장. 사용자 결정 후 별 plan 진행. |
| W2 | 보안 — SMTP 원본 에러 메시지 노출 | **수용**. 메시지는 사용자 **본인** SMTP 서버의 진단 정보(인증 실패 사유 등)로, 연결 테스트의 핵심 가치. `clampMessage` 로 길이만 제한. MCP tester 도 동일하게 외부 message 를 반환(일관). 일반화하면 디버깅 불가. |
| W4 | 보안 — `_selectedPort` 신뢰 경계 | **수용(기존 동작)**. `_selectedPort` 는 graph-traversal 의 모든 라우팅이 이미 신뢰하는 엔진 메타데이터이며 핸들러는 `port` 만 선언(applyPortSelection 이 변환). 본 PR 신규 도입 아님. first-party 핸들러 신뢰 모델. |
| INFO4 | `ErrorPortFallbackError` → `workflow-errors.ts` 이동 | 후속(선택). 낮은 우선순위. |
| INFO7,16 | spec §5.5 "NOOP"→`verify()` / `ERROR_PORT_FALLBACK` API 스키마 명시 | spec 영역 → project-planner 위임 ([[plan]] 후속 항목). |

## TEST 결과

- lint: 통과
- unit: 통과 (5013)
- build: 통과
- e2e: 통과 (127) — 재수행 결과로 갱신
