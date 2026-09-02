# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보)

## 전체 위험도
**LOW** — spec 델타 0(코드 전용 PR), 신규 구현(`auth.token_expired` WS 소켓 만료 종속)이 확정된
Rationale/plan 계획을 문구 단위로 정확히 따름. 유일한 실질 WARNING 은 `2-api-convention.md §10.4`
의 재연결 서술이 이번 구현으로 상시 발동하게 된 예외 경로를 반영하지 못한 것.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 Critical 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `2-api-convention.md §10.4` "지수 백오프 자동 재연결 + 마지막 이벤트 ID 재전송" 서술이, 서버발신 `disconnect()`(토큰 자연 만료, §1.2)에는 자동 재연결이 발화하지 않고 복구도 `execution.snapshot` 방식이라는 `6-websocket-protocol.md` 의 기존 정정을 반영 못함. 이번 diff 로 이 예외 경로가 15분 주기 상시 발동으로 바뀌어 실질 영향 확대 | `spec/5-system/2-api-convention.md` §10.4 (313-317행) | `spec/5-system/6-websocket-protocol.md` §6.1/§1.2/§6.2 + Rationale | §10.4 에 "서버발신 disconnect(§1.2 토큰 만료)는 자동 재연결 대상 아님, 명시적 재연결 필요" 예외 한 줄 + "마지막 이벤트 ID 재전송은 EIA(SSE) 전용, native WS 는 snapshot" 반영. planner 턴 권장(요구사항 텍스트라 developer 자기-반증형 소정정 비대상) |
| 2 | convention_compliance | (기존·비신규) `2-api-convention.md §6` HTTP 상태 코드 SoT 표에 `410 Gone`·`202 Accepted` 누락 — 같은 문서 §11.3 이 이미 두 코드를 사용 | `spec/5-system/2-api-convention.md` §6 (198-213행) | 문서 자기 정합(SoT 표 완결성) | planner 턴에서 §6 표에 410/202 행 추가. 이번 PR diff 밖 — 이미 `--impl-prep` W1 로 발견돼 developer plan 에 위임 등재됨(재발 아님, 중복 확인) |
| 3 | convention_compliance | (기존·비신규) `PASSWORD_INVALID`(재인증) vs `INVALID_PASSWORD`(비밀번호 변경) — 표기 규칙은 준수하나 의미가 근접해 이름만으로 컨텍스트 구분 불가 | `spec/5-system/3-error-handling.md:50,66-67,70`, `spec/5-system/1-auth.md:337,339,521,750,756` | `spec/conventions/error-codes.md` §1 "의미 기반 명명" 원칙 | planner 턴에서 (a) 분리 근거를 `error-codes.md` 에 정식 등재 또는 (b) 별도 절 신설 검토. 이번 PR diff 밖 — `--impl-prep` W2 로 이미 발견돼 developer plan 에 위임 등재됨(재발 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec / convention_compliance / plan_coherence (3개 checker 중복 확인) | `spec/5-system/6-websocket-protocol.md` 의 `auth.token_expired` 배지가 여전히 `_(계획·미구현)_` — 이번 diff 로 backend/frontend 구현이 완결됐음에도 spec 텍스트 미반영 | `6-websocket-protocol.md:52,876,1096,1100,1133`, `plan/in-progress/spec-sync-websocket-protocol-gaps.md:23` | 조치 불요(이번 PR). developer 권한 밖(자기-반증형 소정정 조건 1·2 미충족) — `ws-token-expired-socket-lifetime-impl.md:94-96` 및 code review SUMMARY(SPEC-DRIFT#1) 와 동일하게 "머지 후 planner 턴"으로 이미 정확히 위임돼 있음. 병합 조율자가 그 턴이 실제로 열리는지만 확인 |
| 2 | plan_coherence | 형제 plan `spec-draft-ws-wontdo-maintenance-appping.md` — 대응 spec 변경(`36f2791a9`)은 이미 `origin/main` 반영됐으나 plan 파일 자체가 체크리스트 없이 미종결·`complete/` 미이동 | `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md` | 본 diff 와 무관(사전 존재). 별도 planner 턴에서 체크리스트 채움 + `plan/complete/` 이동 권장(경미, 비차단) |
| 3 | naming_collision | `auth.token_expired`(WS)/`token_expired`(Integration status_reason 슬러그)/`TOKEN_EXPIRED`(REST 에러 코드) 3종 근접 표기 — 선행 `--impl-prep` INFO#7 이 지목했던 것을 이번 구현의 JSDoc 이 직접 인용하며 네임스페이스 경계를 재확인 | `websocket-events.types.ts:274-306` | 조치 불요 — 해소 확인(재발 아님) |
| 4 | naming_collision | `AuthEventType` enum·`AuthTokenExpiredPayload` — 기존 `XxxEventType` 명명 패턴 정확히 준수, 사전 사용 없음(신규 도입 지점 외 미출현) | `websocket-events.types.ts` | 조치 불요 |
| 5 | naming_collision | frontend 로컬 헬퍼 `refreshAndReconnect` — 모듈 로컬(비-export) 스코프, 정의·호출 3곳 외 출현 없어 충돌 표면 자체 없음 | `ws-client.ts` | 조치 불요(정보성 기록) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `2-api-convention.md §10.4` 재연결 서술이 이번 구현으로 상시화된 예외 경로(서버발신 disconnect)를 반영 못함(WARNING). spec 델타 0, 다른 영역(auth TTL/revoke, 데이터모델, EIA 경계)과는 값·문구 정합 확인 |
| rationale_continuity | NONE | `R-ws-socket-lifetime-binds-token` 의 기각된 대안(emit-only·명령별 guard·won't-do) 어느 것도 재도입 안 함, lead time 60초·revoke 카브아웃 문구까지 정확히 준수. `R-wontdo-rawws-rest`·`1-auth.md` revoke 불변식과도 정합 |
| convention_compliance | LOW | 신규 식별자·payload·frontend 레이어링·i18n 페어링 전부 준수. WARNING 2건은 이번 PR 밖(기존 갭, 이미 planner 위임 등재) + INFO 1건(spec 배지 stale, 이미 위임) |
| plan_coherence | NONE | spec-draft → impl plan → code review SUMMARY 3곳이 spec 배지 잔존을 동일하게 "머지 후 planner 턴, developer 권한 밖"으로 일치시켜 둠. 미해결 결정 충돌/선행 plan 미해소/후속 누락 없음 |
| naming_collision | NONE | 신규 식별자 3종(`AuthEventType.AUTH_TOKEN_EXPIRED`·`AuthTokenExpiredPayload`·`refreshAndReconnect`) 전부 기존 코드베이스·spec 과 이름 충돌 없음. 근접 표기 후보는 이미 disambiguation 문서화 + 구현이 JSDoc 으로 재확인 |

## 권장 조치사항
1. (비차단, 다음 planner 턴) `2-api-convention.md §10.4` 에 "서버발신 disconnect(§1.2 토큰 만료)는 자동 재연결 대상 아님 + 복구는 execution.snapshot 방식" 예외 반영.
2. (비차단, 다음 planner 턴, 기존 갭) `2-api-convention.md §6` 표에 `410`·`202` 행 추가.
3. (비차단, 다음 planner 턴, 기존 갭) `PASSWORD_INVALID`/`INVALID_PASSWORD` 분리 근거를 `error-codes.md` 에 정식 등재.
4. (비차단, 병합 조율자 확인용) 머지 후 별도 planner 턴에서 `6-websocket-protocol.md` 의 `auth.token_expired` "Planned" 배지를 실제 상태로 flip + `spec-sync-websocket-protocol-gaps.md:23` 체크박스 정리.
5. (경미, 비차단) `spec-draft-ws-wontdo-maintenance-appping.md` 체크리스트 채움 + `plan/complete/` 이동.
