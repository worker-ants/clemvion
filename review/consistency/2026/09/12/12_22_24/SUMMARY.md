# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. WARNING 6건 · INFO 7건은 발견되었으나 차단 사유 아님.

## 전체 위험도
**LOW** — CRITICAL 없음, 5개 checker 전원 자체 위험도 LOW 판정. 다만 WARNING 6건(특히 추적 정합성 2건)은 머지 전 반영 권장.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음 — CRITICAL 자체가 없고, 이 세션은 project-planner 의 `--spec` 자체 draft 검토이므로 권한 경계 이슈도 해당 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `4-execution-engine.md` C-1 의 "502 아니라 503" 문구가 스코프 한정 없이 절대적으로 읽혀, 새 결정(외부 provider 축)과의 관계가 편도 인용(신규→구 문서)만 있고 역방향 각주가 없다 | 결정 (4) — `4-execution-engine.md` C-1 (§7.4 근방) | 새 결정(4)의 R-CC-23 502 배선 | `4-execution-engine.md` C-1 문단 끝에 "외부 provider 호출 실패의 502 사용은 [15-chat-channel.md R-CC-23] 참조" 각주 추가. `spec_impact`/체크리스트에 이 파일 반영 |
| 2 | convention_compliance | `2-api-convention.md §6` 신규 502 행이 이웃 503 행의 "코드: X·Y — [링크]" 서술 패턴 없이 서술문만 있음 | 결정 (4) "추가할 행" 코드블록 | `2-api-convention.md §6` 기존 503 행 서식 | 503 행과 같은 형식으로 "코드: `CHAT_CHANNEL_SETUP_FAILED` — [15-chat-channel §5.4]" 추가 |
| 3 | convention_compliance (WARNING) + cross_spec (INFO, 동일 항목 상향 통합) | 체크리스트 (4-b) "swagger.md §2-4 에 5xx 행 신설" 표현이 기존 표의 "행=단일 구체 코드" 관행과 어긋나 500/503 까지 포함 오독 소지 | 체크리스트 (4-b) | `swagger.md §2-4` 기존 8행(200/201/204/400/401/403/404/409, 전부 단일 코드) | 체크리스트 문구를 "502 행 신설(`@ApiBadGatewayResponse`)" 로 좁힌다 |
| 4 | convention_compliance | `chat-channel-adapter.md` (`status: partial`)에 미구현 신규 계약(§1.1.2 `code` 프로퍼티, 3개 adapter 전부 developer 후속 위임)을 추가하면서 `pending_plans:` 갱신이 체크리스트에 없음 | 체크리스트 전체 / 결정 (2) | `spec/conventions/spec-impl-evidence.md §2.1`·§3 (partial spec 의 미구현 surface 추적 의무) | 체크리스트에 "`chat-channel-adapter.md` `pending_plans:` 에 추적 경로 추가" 항목 신설, 또는 대체 추적 수단을 Rationale 에 명시 |
| 5 | plan_coherence | "안 하는 것" 절이 `chatChannelLastError` (provider 원문이 DB 컬럼에 그대로 저장되는, 결정(3)과 같은 클래스의 문제)를 "별 항목으로 등재돼 있다"고 사실처럼 서술하나, `plan/` 전체 grep 결과 그런 트래커 항목이 실재하지 않는다(이 draft 자신만 매치) | `## 안 하는 것` 셋째 불릿 | `plan/in-progress/**`, `plan/complete/**` (해당 항목 부재) | 이 턴에서 트래커에 신규 항목으로 실제 등재하거나(`spec-draft-nullable-notation-followups.md` 편집 목록에 4번째 항목으로 추가 등), 문구를 "이 턴에서 새로 등재한다"로 정정. 근거 없는 "이미 추적됨" 주장인 채로 `complete/` 이동 금지 |
| 6 | naming_collision | 신규 `err.code`(`'BOT_TOKEN_INVALID'` 등, 우리가 만든 Error 프로퍼티)가 `discord.adapter.ts` 안에 이미 존재하는 **Discord 원본 API 응답의 숫자형 `code` 필드**(`app.code`/`res.code`)와 이름이 겹쳐, "구현 위임" 항목 3 작업 시 혼동 위험 | §1.1.2(신설) + "구현 위임" 항목 2·3·4 | `codebase/backend/.../discord/discord.adapter.ts:69,438` (Discord 원본 코드), `telegram-client.ts:95` (Node 시스템 에러 코드) | §1.1.2에 "이 `code` 는 어댑터가 새로 throw 하는 Error 자체의 프로퍼티이며 provider 원본 응답의 `code` 필드와 다른 객체·값 도메인" 한 줄 추가, 또는 항목 3에 혼동 주의 각주 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `15-chat-channel.md §7` 디렉터리 트리 주석이 `translateSetupChannelError`(실제로는 출력측 함수)를 "입력 검증·변환 순수 함수"로 서술 — draft 가 이미 "안 하는 것"으로 스스로 유예 | §7 구현 파일 트리 | 조치 불요(이미 유예). 후속 세션에서 파일 위치 정리 시 함께 갱신 |
| 2 | rationale_continuity | §1.1.2 fallback 예외 근거가 R-CCA-5/CCH-ERR-02 를 인용하지만, "메시지 문자열 파싱 금지" 원칙에 가장 가까운 선례(`3-error-handling.md §1.3 FILE_REQUIRED` 주석)를 누락 | 결정 (2) 예외 문단 | `3-error-handling.md §1.3 FILE_REQUIRED` 각주 추가 — 세 번째 독립 선례로 fallback 예외의 근거를 넓힌다 |
| 3 | rationale_continuity | fallback 제거 조건("세 adapter 모두 code 부착하면 삭제 후보")이 관찰 서술일 뿐 판정 트리거/소유자가 없음 | 결정 (2) | 세 adapter code 부착 완료 시 §1.1.2 fallback 제거를 후속 트래커 항목으로 등재하도록 체크리스트에 명시 |
| 4 | rationale_continuity | 502 카탈로그 신설이 §5.3 Rationale 이 경고한 "문서가 구현에 없는 동작을 약속" 위험의 축소판이나, draft 가 이미 구현 위임 1ⓕ 에서 필터 실측 확인을 자체 계획해 둠 | 결정 (4), 구현 위임 1ⓕ | 조치 불요. 향후 1ⓕ 실측에서 필터가 502 를 못 감싸는 것으로 나오면 §5.3 Rationale 과 교차 인용 |
| 5 | convention_compliance | `chat-channel-adapter.md §7` "모든 구체 어댑터 명세" 동시 갱신 문면과, slack 만 필수·discord/telegram 은 선택으로 처리한 이번 결정 사이 긴장(단, §1.1.1 선례도 텔레그램 1개 파일만 갱신해 완전 위반은 아님) | 결정 (6) / 구현 위임 항목 6 | 이 해석("영향받는 모든" 으로 읽음)을 Rationale 에 한 줄 명시 |
| 6 | convention_compliance | 결정 (3)의 "§7.5.2 의 `serverDetail` 자리로" 표현이, REST 에러 봉투(§5.3, `serverDetail` 필드 없음)와 EIA 이벤트(§7.5.2, `serverDetail` 있음) 필드명을 혼용해 오독 소지 | 결정 (3) 본문 | "§7.5.2 와 같은 원칙(클라이언트엔 고정 문구, 원문은 서버 전용)" 처럼 필드명 차용 없이 원칙만 인용하도록 문구 수정 |
| 7 | plan_coherence | `2-api-convention.md §6` 은 전역 카탈로그인데 502 도입은 chat-channel 로만 스코프됨(다른 외부 연동 provider 는 미검토) — 단, 이 저장소의 기존 선례(410/202 신설 시에도 즉시 전수 마이그레이션 요구 안 함)상 결함은 아님 | 결정 (4) | 조치 불요. 원한다면 "타 provider 외부 API 실패 → 502 정합 검토" 를 INFO 로 트래커에 남기는 정도 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 번들 절단(예산 초과)에도 실제 파일 직접 대조로 CRITICAL/WARNING 재확인. 유일한 실질 WARNING: `4-execution-engine.md` 502/503 문구의 편도 인용(역방향 각주 부재) |
| rationale_continuity | LOW | Rationale ID 계열(R-CC-22 최대, R-CCA-8 최대)·핵심 인용(§7.5.2, R-CCA-5, R-CC-15) 전부 원문과 일치. fallback 근거·제거조건 보강 여지만 INFO |
| convention_compliance | LOW | Rationale ID·에러코드 rename 금지·응답 봉투 형식 등 핵심 규약 준수. 502/5xx 표 서식 미준수 2건 + `pending_plans:` 누락 1건이 WARNING |
| plan_coherence | LOW | 선행 결정·트래커 부재 판정 등 대부분 정합. `chatChannelLastError` "이미 등재됨" 주장이 실측상 거짓인 점이 유일 WARNING |
| naming_collision | LOW | 신규 ID(R-CC-23/R-CCA-9)·섹션 번호·502·에러코드 재사용 전부 grep 기준 충돌 없음. 구현 단계에서 `code` 프로퍼티 이름이 Discord 원본 응답 필드와 겹쳐 혼동 위험만 WARNING |

## 권장 조치사항

1. **[WARNING #5, 최우선]** `chatChannelLastError` 원문 저장 이슈를 실제 트래커 항목으로 신설하거나(`spec-draft-nullable-notation-followups.md` 편집 목록에 추가 등), "안 하는 것" 절 문구를 사실과 맞게 정정 — 근거 없는 "이미 추적됨" 주장인 채로 `plan/complete/` 이동 금지.
2. **[WARNING #4]** `chat-channel-adapter.md` `pending_plans:` 에 이번 draft 가 신설하는 미구현 계약(§1.1.2)의 추적 경로를 추가하거나, 대체 추적 근거를 Rationale 에 명시.
3. **[WARNING #2, #3]** `2-api-convention.md §6`·`swagger.md §2-4` 편집 시 기존 표의 서식 관행(코드+링크, 행=단일 코드)을 그대로 따르도록 체크리스트 문구를 구체화.
4. **[WARNING #1]** `4-execution-engine.md` C-1에 새 결정(R-CC-23)으로의 역방향 각주 추가.
5. **[WARNING #6]** §1.1.2 신설 문단 또는 "구현 위임" 항목 3에 `discord.adapter.ts` 기존 `code` 필드와의 구분 각주 추가 — developer 턴 착수 전 반영 권장.
6. INFO 7건은 차단과 무관하나, 특히 #2(fallback 제거 조건 트래커화)·#5(§7 "모든 어댑터" 해석 명시)는 다음 세션의 재조사 비용을 줄이므로 함께 반영 권장.
