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

### W1 (SSRF) — 사용자 결정 후 **수정 완료**

사용자 결정 2건:
1. SSRF 처리 방식 → 차단 구현.
2. 플래그 정책 → **기존 `ALLOW_PRIVATE_HOST_TARGETS` 재사용** (http/db 와 동일,
   기본 ON·self-host opt-out). 별 `SMTP_BLOCK_PRIVATE_HOSTS` 폐기.

조치:
- `common/utils/smtp-host-guard.ts` 신설 — `ssrf.util`(isPrivateHost/
  resolvesToPrivate) 재사용, `ALLOW_PRIVATE_HOST_TARGETS=true` 시 opt-out.
- `testEmailTransport`(연결 테스트) + `SendEmailHandler`(발송) 양쪽 가드 적용
  → 비대칭 방지. 차단 시 `EMAIL_HOST_BLOCKED`.
- `ErrorCode.EMAIL_HOST_BLOCKED` enum 추가, `.env.example`
  ALLOW_PRIVATE_HOST_TARGETS 주석에 SMTP 포함 명시.
- 테스트: smtp-host-guard.spec(가드 로직), integrations·send-email spec(차단 분기).

### 그 외 보류

| SUMMARY # | 발견 | 보류 사유 |
|---|---|---|
| W2 | 보안 — SMTP 원본 에러 메시지 노출 | **수용**. 메시지는 사용자 **본인** SMTP 서버의 진단 정보(인증 실패 사유 등)로, 연결 테스트의 핵심 가치. `clampMessage` 로 길이만 제한. MCP tester 도 동일하게 외부 message 를 반환(일관). 일반화하면 디버깅 불가. |
| W4 | 보안 — `_selectedPort` 신뢰 경계 | **수용(기존 동작)**. `_selectedPort` 는 graph-traversal 의 모든 라우팅이 이미 신뢰하는 엔진 메타데이터이며 핸들러는 `port` 만 선언(applyPortSelection 이 변환). 본 PR 신규 도입 아님. first-party 핸들러 신뢰 모델. |
| INFO4 | `ErrorPortFallbackError` → `workflow-errors.ts` 이동 | 후속(선택). 낮은 우선순위. |
| INFO7,16 | spec §5.5 "NOOP"→`verify()` / `ERROR_PORT_FALLBACK` API 스키마 명시 | spec 영역 → project-planner 위임 ([[plan]] 후속 항목). |

## TEST 결과

- lint: 통과
- unit: 통과 (5013)
- build: 통과
- e2e: 통과 (127) — 재수행 결과로 갱신
