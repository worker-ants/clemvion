# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] 한도 초과 응답 바디 `{ executionId: 'ignored' }` — API 응답 봉투 형식 적용 여부 불명확
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` line ~689 (`return { executionId: 'ignored' }`)
- 상세: rate-limit 초과 시 `202 Accepted` + `{ executionId: 'ignored' }` 를 반환한다. 이 응답 형식이 동일 엔드포인트의 정상 경로(새 execution 시작 시 `{ executionId: '<uuid>' }`) 및 기타 skip 경로(group/bot skip, unsupported update type)와 동일한 sentinel 패턴임은 문서화되어 있다. 그러나 이 sentinel 값이 API 응답 봉투 형식(envelope) 준수 여부가 spec §5.5 에서 명시적으로 커버되지 않는다는 점이 consistency check(I-7)에서도 지적된 바 있다. 기존 skip 경로들과 동일 패턴이므로 실질적 breaking change 는 아니나, 클라이언트가 `executionId === 'ignored'` 를 명시적으로 처리해야 한다는 계약이 문서화되어 있지 않다.
- 제안: spec §5.5 신규 행에 `{ executionId: 'ignored' }` 가 다른 skip 케이스와 동일한 sentinel 값임을 명시하고, 클라이언트가 이 sentinel을 처리해야 함을 API 계약으로 공식화한다.

### [INFO] rate-limit 초과 시 `202` vs `429` 상태 코드 선택 — 명시적 근거 필요
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 전체 rate-limit 분기; `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` §결정 "초과 시 동작"
- 상세: rate-limit 초과 시 HTTP 202 Accepted 를 반환하는 선택에 대해 "non-2xx 시 provider webhook 자동 비활성화·retry 폭주 회피(R-CC-12)" 라는 근거가 plan 문서에 설명되어 있다. 이 결정은 Telegram 등 외부 provider 의 webhook 재시도 동작을 고려한 것으로, REST 표준(429 Too Many Requests)을 의도적으로 우회한 것이다. API 표준 관점에서 429 가 더 의미론적으로 정확하나, 이 프로젝트의 webhook 계약에서는 provider 동작 안정성이 우선한다는 트레이드오프는 기록되어 있다. 단, 이 엔드포인트를 직접 호출하는 내부/외부 클라이언트(provider 가 아닌 직접 API 소비자)에게는 오히려 혼동을 줄 수 있다.
- 제안: spec §5.5 또는 R-CC-19 에 "rate-limit 초과 시 202 선택 근거: provider webhook 자동 비활성화 방지(R-CC-12), 의도적 429 미사용"을 명시하여 향후 API 계약 리뷰 시 오해가 없도록 한다.

### [INFO] `markChatChannelRateLimited` — DB 갱신 실패 시 응답 계약 불영향(best-effort)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` lines 704-727
- 상세: `chat_channel_health=degraded` DB 갱신 실패는 swallow 처리되어 API 응답에 영향을 주지 않는다. 클라이언트 관점에서 202 응답은 항상 반환되며 DB 갱신 실패가 클라이언트에게 노출되지 않는다. 이는 API 응답 일관성 측면에서는 올바른 설계(health 갱신 실패가 webhook 수신 확인을 방해해서는 안 됨)이나, 운영자 알림 경로(log warn 만 존재)가 충분한지 검토 여부가 API 계약 SLA 맥락에서 고려될 수 있다.
- 제안: 현행 설계는 API 계약상 적절함. 추가적으로 health 갱신 실패에 대한 메트릭/알람 경로를 고려할 수 있으나 v1 범위 밖.

## 요약

이번 변경은 기존 webhook 인바운드 처리 흐름에 내부 rate-limit 로직(`ChatChannelRateLimiterService`)을 추가한 것으로, 외부 API 클라이언트(webhook 발신 provider)에 대한 응답 형식은 기존 skip 경로와 동일한 `202 Accepted` + `{ executionId: 'ignored' }` 패턴을 유지하여 하위 호환성을 보존한다. Breaking change 는 없다. rate-limit 초과 시 의도적으로 429 대신 202 를 선택한 근거(R-CC-12 provider retry 방지)는 plan 문서에 기재되어 있으나 spec §5.5 에는 명시되지 않아 API 계약 문서 완결성 관점에서 보강이 필요하다. `{ executionId: 'ignored' }` sentinel 값이 기존 skip 케이스들과 동일한 패턴임을 spec 에서 명시적으로 통합하는 것이 권장된다. 인증/인가, 요청 검증, URL/경로 설계, 페이지네이션, 버전 관리 측면에서는 이번 변경에 의한 영향이 없다.

## 위험도

LOW
