# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 성공(success), 전문 확보 완료.

## 전체 위험도
**LOW** — 5개 checker 모두 CRITICAL 0건. WARNING 6건(모두 문서 stale 인용/범위 동기화 성격, 기능 결함 아님), INFO 다수. `plan_coherence` 만 MEDIUM(3건의 plan 문서 자기-비동기), 나머지는 NONE~LOW.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `EIA-NX-03`/`R12` 가 V066 로 폐기된 `hmacAlgorithm` 필드를 현재형으로 인용 (실제는 `AuthConfig.config.algorithm`) | `spec/5-system/14-external-interaction-api.md` §3.1 `EIA-NX-03`, `## Rationale` R12 | 같은 파일 §7.1 스키마 블록 · `spec/5-system/12-webhook.md` §4.2 (L167, L229) | `hmacAlgorithm: 'sha256'` 예시를 `AuthConfig.config.algorithm` 참조로 교체하거나 §7.1 스키마 현실에 맞게 재작성 |
| 2 | cross_spec | §11 WS↔외부 명령 매핑 표의 `execution.stop` 행이 "권위 표"의 won't-do 주석(`_(WS 명령 §4.2 won't-do)_`)을 누락 | `spec/5-system/14-external-interaction-api.md` §11 `execution.stop` 행 | `spec/5-system/6-websocket-protocol.md` §4.6 (PR #859 갱신본) | target §11 행에 동일 주석 추가해 두 "권위 표" 동기화 |
| 3 | convention_compliance | `/api/external/*` 네임스페이스 prefix 패턴이 재사용을 스스로 예고(R11)함에도 중앙 규약에 예외 유형으로 미등재 | `14-external-interaction-api.md` §5/§10/§12, Rationale R11 | `spec/5-system/2-api-convention.md` §2.2 명명 규칙 표 (예외 유형 1종만 등재) | §2.2 표에 "별도 인증 family 를 쓰는 top-level 네임스페이스" 예외 행 추가, `/api/external/*`(→R11) 를 대표 사례로 링크 |
| 4 | plan_coherence | `eia-terminal-payload.md` 가 스스로 "미등재"라 적은 companion 타입 수정(`EiaFailedEvent.error.code`/`nodeId` nullable) 이 실행 체크리스트("동반 필수")에 실제로 없음 (실측: `chat-channel/types.ts:392-401` 여전히 non-nullable) | `spec/5-system/14-external-interaction-api.md` §6.4 nullable 계약 | `plan/in-progress/eia-terminal-payload.md` ③-d(96~98행) vs "동반 필수" 체크리스트(172~177행) | "동반 필수" 절에 `chat-channel/types.ts:392-401` 동기화 항목 추가 |
| 5 | plan_coherence | `eia-terminal-payload.md` "범위" 체크리스트가 같은 문서의 "재판정 ③ 범위 조정" 결정(durationMs/result.outputs 를 "다음 PR"로 분리)과 어긋남 | `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 (durationMs/result.outputs Planned) | `plan/in-progress/eia-terminal-payload.md` 114~122행(범위 조정) vs 166~178행·205행(범위 체크리스트) | "범위" 절의 durationMs·result.outputs 에 "다음 PR 로 이연" 각주 추가, 205행 서술도 정정 |
| 6 | plan_coherence | `spec-draft-eia-62-waiting-payload.md` 가 이미 반증되어 target spec 에서 정정된 전제("code 를 만드는 건 sentinel 뿐")를 그대로 보유 | `spec/5-system/14-external-interaction-api.md` §6.4 Rationale (uncommitted diff 로 이미 정정됨) | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (4)절 118~121행 | (4)절에 "정정(2026-08-14, `eia-terminal-payload.md` ③-b)" 각주 추가, 결론은 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `code` nullable 근거 정정은 사실과 어긋난 근거를 실측 후 정정한 사례(결론 번복 아님) — `3-error-handling.md` §1.4/§1.5 로의 명시적 상호참조 보강 여지 | `14-external-interaction-api.md` §6.4 `execution.failed` 콜아웃 | `3-error-handling.md#14-워크플로우-실행-에러` 링크 추가(선택) |
| 2 | convention_compliance | 금번 diff 에서 언급된 에러 코드(`WORKER_HEARTBEAT_TIMEOUT` 등) 전부 기존 등재 코드 재사용, 신규 명명 없음 | §6.4 Rationale | 조치 불요 (준수 확인 기록) |
| 3 | naming_collision | "Notification" 용어가 인앱 알림(`NotificationsService`)과 EIA outbound webhook 통보 두 이질적 서브시스템에서 쓰임 — 기술적 충돌은 없으나 온보딩 시 혼동 여지 | `14-external-interaction-api.md` §3.1/§6/§7.1 vs `codebase/backend/src/modules/notifications/**` | EIA Rationale 에 "본 notification 은 트리거 outbound webhook 전용" caveat 추가(선택, 비차단) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 미커밋 diff(2줄) 자체는 무결. 문서 전체 대조에서 PR #228 원문 이후 미갱신된 stale 인용 2건(`hmacAlgorithm` 필드명, WS §4.6 won't-do 주석 누락) 발견 |
| rationale_continuity | NONE | diff 는 좁고(§6.3/§6.4), 기존 결론 번복 없이 근거 정확도만 개선. `plan/in-progress/eia-terminal-payload.md` 재판정 ③-b 에 근거 명시 |
| convention_compliance | LOW | 검토한 모든 축(에러코드/API 응답봉투/DTO/Redis키/감사액션/frontmatter)에서 규약 준수. `/api/external/*` prefix 패턴만 중앙 규약 미등재(SoT 분산) |
| plan_coherence | MEDIUM | target spec 자체와 plan 간 미해결 결정 충돌은 없음. 다만 `eia-terminal-payload.md` 가 같은 날 재판정으로 만든 최신 결정 3건을 자신의 실행 체크리스트/자매 plan 에 완전히 전파하지 못함 (companion 타입 누락·범위 결정 미반영·자매 plan 반증 전제 잔존) |
| naming_collision | NONE | diff 는 신규 식별자 도입 없음(순수 서술 수정). 문서 전체 대상 6개 관점 확장 조사에서도 기술적 충돌 없음 — "Notification" 용어 중복만 INFO |

## 권장 조치사항
1. (BLOCK 없음 — 필수 조치 아님) `plan/in-progress/eia-terminal-payload.md` "동반 필수" 체크리스트에 `chat-channel/types.ts:392-401` (`EiaFailedEvent.error.code`/`nodeId` nullable 동기화) 항목 추가 — 구현 착수 전 반영 권장 (developer 권한 내, plan 문서 수정만 필요).
2. 같은 plan 문서의 "범위" 체크리스트에서 `durationMs`·`result.outputs` 를 "다음 PR 로 이연" 으로 명확히 각주 처리 — 방금 내린 범위 축소 결정(114~122행)과의 불일치 해소.
3. `spec-draft-eia-62-waiting-payload.md` (4)절에 정정 각주 추가 — 반증된 sentinel-only 전제가 향후 재인용되는 것 방지.
4. `spec/5-system/14-external-interaction-api.md` §3.1 `EIA-NX-03`/R12 의 `hmacAlgorithm` 인용을 `AuthConfig.config.algorithm` 기준으로 정정, §11 `execution.stop` 행에 WS §4.6 과 동일한 `_(WS 명령 §4.2 won't-do)_` 주석 추가 — 다음 spec 편집 시 함께 처리 권장 (developer 는 spec read-only 이므로 planner 턴에서 처리).
5. (선택) `spec/5-system/2-api-convention.md` §2.2 에 `/api/external/*` 예외 유형 등재 — SoT 분산 방지, 차단 아님.