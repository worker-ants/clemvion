# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 한다

## 전체 위험도
**CRITICAL** — `secret-store.md` 신규 예외의 안전 근거("1회 노출")가 이 브랜치의 실제 코드 동작과 어긋난다. `notification_secret_v2`가 `GET/POST/PATCH /api/triggers`·`GET /api/schedules` 응답에서 상시(1회가 아니라 매 요청) 노출되고 있음을 두 checker(cross_spec, plan_coherence)가 각자 독립적으로 실측·확인했으며, 이는 미머지 자매 브랜치(`claude/sweep-response-contract-5ba0ad`)가 이미 진단·수정한 것과 동일한 결함이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, plan_coherence | `secret-store.md §1` 신규 예외 근거 (3) "서버 발급·1회 노출·영향 범위가 트리거 하나 … rotate 응답에만 실린다"가 이 브랜치의 실제 API 동작과 어긋남 — `notificationSecretV2`는 엔티티 컬럼 단위로 스트립되지 않아 `GET/POST/PATCH /api/triggers`·`GET /api/schedules`(트리거 조인) 응답에도 매 요청마다 평문으로 실린다(rotation grace 기간 24h 내내). `triggers.service.ts`의 `sanitizeChatChannelForResponse()`는 `config.chatChannel` JSONB 내부 키만 지우고 엔티티 최상위 컬럼은 건드리지 않으며, 전역 `ClassSerializerInterceptor`·`select:false`·`@Exclude()` 모두 없음(grep 0건) | `spec/conventions/secret-store.md §1` "비대상 — `Trigger.notification_secret_v2`" 등재문 근거 (3) (draft `plan/in-progress/spec-draft-notification-secret-storage.md:133-134`에서 유래, 이미 커밋 `790487f34`로 spec에 반영됨) | (a) 미머지 브랜치 `claude/sweep-response-contract-5ba0ad`의 커밋 `dfb2664af`("트리거 회전 secret이 두 경로로 나가고 있었다 — §5.4 스윕 1차")가 같은 필드의 동일 유출을 이미 실측·수정(`TriggerDto` 2건·`ScheduleDto` 18건 RED→GREEN, `sanitizeForResponse` 적용). 이 브랜치는 아직 그 수정을 포함하지 않음 | 근거 (3) 문구를 "정책상 노출 창은 rotate 응답 1회로 설계됐으나, 현재 구현은 `GET/POST/PATCH /api/triggers`·`GET /api/schedules`에서도 평문을 노출한다(미해결 결함 — 추적: 병행 브랜치 `claude/sweep-response-contract-5ba0ad`)"로 정정하고, 이 유출을 닫는 코드 수정을 이번 spec 등재와 짝지어 `plan/in-progress/`에 명시적으로 등재(체크박스)한다. 지금 상태로는 "이미 안전하다고 결정된 필드"라는 잘못된 인상을 남긴다 |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 위 Critical 은 `spec/conventions/secret-store.md`(spec 문서) 텍스트 정정 + `plan/in-progress/`
> 후속 항목 등재로 구성되며, 둘 다 이 target 문서를 다루는 현재 턴(project-planner, `spec/`·`plan/`
> 쓰기 권한 보유)의 권한 범위 안이다. developer 턴에서 발견된 spec drift가 아니므로 인계 대상이
> 아니다.

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Trigger/Schedule 응답이 `notification_secret_v2`/`chat_channel_token_v2`를 제외해야 한다는 요구사항이 `spec/**` 어디에도 정규 문장으로 없음(grep 0건) | draft 전체, 특히 EIA §7.1 정정문·`secret-store.md` 신규 예외 블록 | `14-external-interaction-api.md §7.2`, `2-navigation/2-trigger-list.md`, `2-api-convention.md §5.4` — 셋 다 해당 서술 없음 | `secret-store.md` 신규 예외 블록 또는 EIA §7.1 정정문에 "본 컬럼은 API 응답 DTO에 노출되지 않아야 한다(§5.4/swagger §5-1 대상)" 한 줄 추가 + 시행 코드를 `code:` frontmatter에 등재하는 후속 항목 명시 |
| 2 | convention_compliance | 신규 cross-file 인용("`chat-channel R-K`")이 같은 파일 안 기존 인용 라벨 표기 관례(`[Chat Channel §R-CC-16]`, `[EIA §R17]` 등 대문자+`§` 접두)와 다름 | `14-external-interaction-api.md §7.1` 정정문 | 같은 파일 1325·1885줄, `1-data-model.md:245`의 기존 인용 스타일 | `[Chat Channel §R-K](./15-chat-channel.md#r-k-…)` 형식으로 통일 |
| 3 | plan_coherence | `4-integration.md §9.1` 반영 결정("자매 브랜치 머지 후 반영")이 draft의 "후속(이 PR 밖)" 추적 목록에서 누락 — 이를 트리거할 체크박스/추적 항목이 문서 어디에도 없음 | `plan/in-progress/spec-draft-notification-secret-storage.md` §③ `4-integration.md §9.1 (W3)` 블록의 "선행 의존" 캐비엇(line ~161-164) | 같은 문서 `### 후속 (이 PR 밖)` 절(line 197-203) — 두 항목만 존재, 이 항목 없음 | "후속(이 PR 밖)" 목록에 "`4-integration.md §9.1`(+`1-data-model.md §2.10`) — `claude/sweep-response-contract-5ba0ad` 머지 후 반영" 항목 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `R-K`·`data-flow §1.5`·`EIA-NX-12`·`1-data-model.md §2.8/§2.10` 인용이 전부 원문과 자구 단위 일치 — 검증 완료 | draft §②·§③ | 조치 불요 |
| 2 | cross_spec | `4-integration.md §9.1`(W3) 유예 — 대상 5필드가 이 브랜치 `IntegrationDto`에 없고(`sweep-response-contract-5ba0ad` tip에만 존재, 아직 `origin/main` 조상 아님) "머지 후 반영" 판단이 실측상 타당 | draft §③ | 조치 불요 |
| 3 | cross_spec | `2-api-convention.md` frontmatter `code:` 등재(W2) — 이전엔 실제로 누락 상태였고(직전 §5.4 검증자 등재 커밋도 놓침) 이번 반영으로 해소됨 | draft §③, `2-api-convention.md` frontmatter | 조치 불요 |
| 4 | rationale_continuity | R-K/§1.5 → 신규 secret-store 예외로의 역방향 상호 링크 부재(EIA §7.1은 R-K·§1.5·secret-store §1로 링크하나 반대 방향은 없음) — target이 "두 문서는 갱신하지 않는다"를 명시적으로 택했으므로 의도된 범위 밖, navigability 참고 사항 | 없음(target이 다루지 않은 잔여) | 강제 아님. 후속 소정정 시 R-K 말미 또는 §1.5 "해소 이력" 문단에 secret-store.md §1 앵커 한 줄 추가 고려 |
| 5 | convention_compliance | 오류 정정 기록 방식("정정 이력" 블록쿼트 + 이탤릭 재인용)이 같은 파일의 지배적 관례(취소선 인라인 보존, 10곳 이상)와 형태가 다름 — 정보 손실은 없음. developer 자기-반증형 소정정 조항과는 무관(원문 작성자가 developer가 아님) | `14-external-interaction-api.md §7.1` "정정 이력(2026-09-05)" 블록 | 강제 아님. 일관성 원하면 `~~원문~~ **(2026-09-05 정정)**: ...` 인라인 취소선 형태로 전환 |
| 6 | plan_coherence | "미머지 브랜치라 못 고친다"는 후속 사유가 부정확 — 대상 문장(§5.4 시행 코드 관련)은 이미 이 브랜치 커밋 `983fd0ade`(`spec-draft-nullable-notation-followups.md:314`)에 존재해 바로 편집 가능 | draft "후속(이 PR 밖)" 첫 항목 | 강제 아님. 사유를 "미머지 브랜치라 접근 불가"에서 "스코프 밖이라 미룸"으로 정정 권장(한 줄 수정) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | secret-store.md 근거 3 "1회 노출"이 실제 코드(다중 경로 상시 노출)와 어긋남 + 응답 제외 요구사항 미정규화(WARNING) |
| rationale_continuity | NONE | 1차 CRITICAL(두 살아있는 Rationale 무근거 번복)을 target이 스스로 반증·정정 — 파일시스템 대조로 재확인. 신규 위반 없음 |
| convention_compliance | LOW | 인용 라벨 표기 불일치(WARNING), 정정 기록 방식 편차(INFO) — 순수 스타일, 명시 규약 위반 없음. `code:` 글로브·frontmatter 스키마는 정확히 준수 |
| plan_coherence | CRITICAL | cross_spec과 동일 결함(근거 3 미성립)을 독립적으로 실측·확인 + 자매 브랜치 머지 추적 누락(WARNING) |
| naming_collision | NONE | 신규 식별자 없음 — 기존 이름(컬럼·요구사항ID·Rationale ID·가드 파일 경로) 재사용/정정만, 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소 우선)** `spec/conventions/secret-store.md §1` 근거 (3) 문구를 실제 코드 상태와 맞게 정정 — "1회 노출"을 "정책상 설계는 1회이나 현재 구현은 `/api/triggers`·`/api/schedules`에서 상시 노출(미해결 결함)"로 교체.
2. 위 결함을 닫는 코드 수정 항목(엔티티 컬럼 스트립 백포트 또는 `claude/sweep-response-contract-5ba0ad` 머지 추적)을 `plan/in-progress/`에 명시적으로 등재해 spec 등재와 짝짓는다.
3. Trigger/Schedule 응답에서 `notification_secret_v2`/`chat_channel_token_v2` 제외 요구사항을 spec 정규 문장으로 추가(WARNING #1).
4. `4-integration.md §9.1` 반영을 "후속(이 PR 밖)" 목록에 추가(WARNING #3).
5. 선택: 인용 라벨 형식 통일(WARNING #2), 정정 기록 취소선화(INFO #5), 후속 사유 문구 정정(INFO #6).