# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건 발견 (모두 target `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 의 `spec_impact` 열거 누락에서 기인, 병합 전 처분 필요)

## 전체 위험도
**HIGH** — 설계(전역 유일성 전환) 자체는 정합적이나, 그 결정이 실제로 참조하는 spec 문서 두 곳이 `spec_impact` 열거에서 누락되어 반영 즉시 자기모순/반증 문장이 남는다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/5-system/2-api-convention.md` §12.2 「유니크 제약 범위」 표가 옛 워크스페이스-스코프 전제("워크스페이스 단위 / 다른 워크스페이스와는 독립")를 그대로 남기며, 이 표가 인용하는 `1-data-model.md §3`(S2로 전역 UNIQUE로 바뀔 절)과 직접 모순된다 | draft `spec_impact` (5개 파일 열거, 이 파일 미포함) — S1~S7 전체 | `spec/5-system/2-api-convention.md:568-574` §12.2 표 | `spec_impact`에 이 파일 추가, S8 신설하여 표 행을 "전역"(V132 근거)으로 교체 |
| 2 | rationale_continuity | `chat_channel_health=degraded`를 설정하는 경로가 "정확히 둘"(CCH-SE-01, CCH-NF-03)이라고 닫아 둔 `spec/5-system/15-chat-channel.md`의 표 행 + R-CC-19 Rationale을, 결정 2/V131(마이그레이션에 의한 endpoint_path 재발급)이라는 세 번째 경로로 반증하면서 그 문장을 갱신하지 않음 | 결정 2, 「채팅 채널 트리거 — R-CC-21 과의 관계」절, 구현 V131. `spec_impact`에 이 파일 없음 | `spec/5-system/15-chat-channel.md` CCH-SE-01 표 행 + R-CC-19 Rationale("두 경로") | `spec_impact`에 `15-chat-channel.md` 추가하고 "두 경로"→"세 경로"(또는 N경로)로 갱신하며 세 번째 경로 명시, 또는 `chat_channel_health`를 건드리지 않는 대안으로 설계 변경 |

## planner 인계 (권한 밖 Critical)

(없음) — 두 Critical 모두 target 자체가 spec draft이며, 근본 원인(`spec_impact` 열거 누락)이 이 draft를 다루는 턴의 권한 안에 있다. 별도 인계 없이 이번 draft 개정에서 직접 처분 가능.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/7-channel-web-chat/5-admin-console.md:112`가 "DB unique가 중복 가로채기를 막는다"고 서술하는데, 이는 V132 이전에는 거짓이었다(웹챗 콘솔의 트리거 생성도 같은 `TriggersService` 경로를 거쳐 워크스페이스 단위 UNIQUE로는 다른 워크스페이스의 가로채기를 막지 못했음). draft가 이 이력을 인지하지 않음 | `spec_impact` 미포함 | `spec/7-channel-web-chat/5-admin-console.md:112` | S4(`12-webhook.md`) 또는 데이터 모델 Rationale에 "웹챗 콘솔의 트리거 생성도 같은 경로로 함께 보호됨" 한 문장 추가, 또는 트래커에 "검토했고 사후 정합" 기록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 마이그레이션 번호 V131/V132는 draft 작성 시점 스냅샷 — `--impl-prep`~구현 사이 다른 PR이 선점할 race 이론상 가능 | 구현 절 V131/V132 | 구현 착수 직전 migrations.md §5 절차대로 `git fetch && rebase`로 max(V) 재확인(체크리스트에 이미 있어 별도 조치 불요) |
| 2 | convention_compliance | `secret-store.md`(외부 provider 자격증명 스코프)와 `endpoint_path` 무로깅 결정의 근거 축이 다름 — 위반은 아니나 재확인 비용 존재 | 결정 2 항목2 | S3 Rationale에 "secret-store.md 스코프(외부 provider 자격증명) 밖" 한 문장 추가(선택) |
| 3 | naming_collision | S7 신설 절의 "정정(2026-09-18)" 표기가 선례 `2-trigger-list.md`의 "정정 (2026-09-08)"와 괄호 앞 공백이 다름 | S7 절 | 서식 통일(선택, 식별자 충돌 아님) |
| 4 | plan_coherence | `spec-draft-nullable-notation-followups.md:2165`의 다른 열린 항목("isActive 토글 전용 PATCH의 setupChannel 재호출 여부")이 이 draft의 근거와 혼동될 소지(실제로는 다른 PATCH 경로) | 트래커 line 2165 | 두 PATCH 경로(공존 vs 단독)를 문서상 명확히 구분해 두면 향후 혼동 예방(선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `2-api-convention.md` §12.2 유니크 범위 카탈로그 미갱신(Critical) + `5-admin-console.md` 사후정합 미인지(Warning) |
| rationale_continuity | HIGH | `15-chat-channel.md`의 "degraded 두 경로" 닫힌 열거를 세 번째 경로가 반증(Critical), 그 외 연속성 관리는 성숙 |
| convention_compliance | LOW | 정식 규약 위반 없음. V번호 재확인·secret-store 스코프 관련 INFO 2건 |
| plan_coherence | NONE | 트래커의 열린 결정을 실측 근거로 정상 종결, 선행 plan·번호 충돌 없음 |
| naming_collision | NONE | 신규 식별자 전수 grep 결과 기존 사용처와 충돌 없음(전부 기존 식별자 재사용) |

## 권장 조치사항
1. (BLOCK 해소) `spec_impact`에 `spec/5-system/2-api-convention.md`를 추가하고 S8을 신설해 §12.2 표 행을 "전역"으로 교체 — 이 draft가 다른 5곳에서 지운 "워크스페이스 단위/독립" 문구를 여섯 번째 위치에서도 제거한다.
2. (BLOCK 해소) `spec_impact`에 `spec/5-system/15-chat-channel.md`를 추가하고 CCH-SE-01 표 행 + R-CC-19 Rationale의 "두 경로" 서술을 마이그레이션발 세 번째 경로를 포함하도록 갱신하거나, `chat_channel_health` 재사용 대신 다른 방식(예: `chat_channel_last_error`만 채움)으로 설계를 조정한다.
3. (WARNING) `5-admin-console.md:112`의 "DB unique가 가로채기를 막는다"는 서술이 V132 이전엔 거짓이었다는 이력을 S4 또는 Rationale에 한 문장으로 남겨 웹챗 콘솔 경로도 이 수정의 수혜자임을 명시한다.
4. (INFO, 선택) V131/V132 번호 재확인 절차를 구현 착수 시 실행하고, secret-store 스코프 밖 판단·정정 블록 서식·트래커 항목 구분을 필요시 다듬는다.
