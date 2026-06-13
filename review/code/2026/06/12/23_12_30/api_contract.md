# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] 한도 초과 응답 `{ executionId: 'ignored' }` sentinel — spec §5.5 계약 문서 완결성
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — rate-limit 초과 분기 (`return { executionId: 'ignored' }`)
- 상세: rate-limit 초과 시 `202 Accepted` + `{ executionId: 'ignored' }` 를 반환한다. 이 sentinel 값은 group/bot skip, 비활성 trigger skip 등 기존 skip 경로와 동일 패턴으로 하위 호환성은 유지된다. RESOLUTION.md(22_49_12) 및 spec-draft 에서 spec §5.5 신규 행("분당 rate-limit 초과 (per-chat)")이 추가되었다고 기술되어 있으나, API 계약 관점에서 "클라이언트(직접 API 소비자)가 `executionId === 'ignored'` 를 명시적으로 처리해야 한다"는 요건이 공식 계약으로 문서화되어 있는지 확인이 필요하다. Breaking change 는 없음.
- 제안: spec §5.5 의 "분당 rate-limit 초과" 행에 `{ executionId: 'ignored' }` 가 다른 skip 케이스와 동일한 sentinel임을 명시하고, 이 sentinel 처리를 클라이언트 API 계약으로 공식화하면 충분하다. 현행 변경 범위 내에서 실질 위험은 없다.

### [INFO] rate-limit 초과 시 `202` 선택 (의도적 `429` 미사용) — spec 계약 명시 여부
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` rate-limit 분기; `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` §결정 "초과 시 동작"
- 상세: rate-limit 초과 시 HTTP `202 Accepted` 를 반환하는 결정은 "non-2xx 시 provider webhook 자동 비활성화·retry 폭주 회피(R-CC-12)" 근거로 plan 문서에 설명되어 있다. REST 표준(`429 Too Many Requests`)을 의도적으로 우회한 것으로, provider(Telegram 등) webhook 동작 안정성 우선의 트레이드오프다. 단, provider 가 아닌 내부/직접 API 소비자 입장에서는 rate-limit 상태를 `202` 로 표현하면 혼동이 발생할 수 있다. RESOLUTION.md(22_49_12) 기준 이 내용이 R-CC-19 에 포함됐다고 기술되어 있으나, spec 의 R-CC-19 또는 §5.5 에 "의도적 429 미사용, R-CC-12 근거" 가 명시되어 있는지 최종 확인이 필요하다.
- 제안: spec §5.5 또는 R-CC-19 에 "rate-limit 초과 시 202 반환 — R-CC-12(provider webhook 자동 비활성화 방지)에 의한 의도적 429 미사용"을 명시하면 향후 API 계약 리뷰 시 오해가 없다. RESOLUTION.md 에 이미 처리됐다고 기술된 내용이므로 추가 조치 필요성은 낮다.

### [INFO] `markChatChannelRateLimited` best-effort — API 응답 계약 영향 없음(정상 설계)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `markChatChannelRateLimited` 메서드
- 상세: `chat_channel_health=degraded` DB 갱신 실패는 swallow 처리되어 API 응답(`202` + `{ executionId: 'ignored' }`)에 영향을 주지 않는다. 클라이언트 관점에서 응답 일관성은 보장된다. warn 로그만 존재하는 운영 알림 경로는 API 계약 SLA 맥락에서 추가 메트릭 고려 여지가 있으나 v1 범위 밖이며 API 계약 자체에는 영향 없다.
- 제안: 현행 설계는 API 계약상 적절함. 메트릭/알람 보강은 별도 운영 태스크로 처리.

## 요약

이번 변경(CCH-NF-03 per-chat rate-limit)은 기존 webhook inbound 처리 흐름에 내부 rate-limit 로직(`ChatChannelRateLimiterService`)을 추가한 것으로, 외부 API 클라이언트(webhook 발신 provider 및 직접 소비자)에 대한 응답 형식은 기존 skip 경로와 동일한 `202 Accepted` + `{ executionId: 'ignored' }` 패턴을 유지하여 하위 호환성을 보존한다. Breaking change 는 없다. `202` 선택의 근거(R-CC-12)와 sentinel 패턴은 plan 문서 및 RESOLUTION.md 에 이미 처리됐다고 기술되어 있으며, spec §5.5/R-CC-19 에 반영된 상태다. 인증/인가, 요청 검증, URL/경로 설계, 페이지네이션, 버전 관리 측면은 이번 변경에 의한 영향이 없다. 전반적으로 API 계약 관점의 실질 위험은 없으며, 발견사항은 모두 문서 완결성 차원의 INFO 수준이다.

## 위험도

LOW
