# Rationale 연속성 검토 — webhook endpoint_path 전역 유일 (impl-prep, scope=spec/2-navigation/)

## 검토 범위와 방법

target 은 `spec/2-navigation/` (완전 포함된 `2-trigger-list.md`·`1-workflow-list.md`·`3-schedule.md`,
나머지는 예산 초과로 절단). 착수할 실제 변경(planner 커밋 `eb5332b57` 반영분 + developer 착수 예정
`V131`/`V132` 마이그레이션 + `triggers.service.ts`/`triggers.controller.ts` 정정 + 테스트)은 scope 밖
spec(`1-data-model.md`·`5-system/12-webhook.md`·`5-system/3-error-handling.md`·`5-system/2-api-convention.md`·
`data-flow/10-triggers.md`·`5-system/15-chat-channel.md`)에도 걸리므로, 번들에 포함된 이 문서들의
`## Rationale` 전문을 대조 대상으로 삼았다. 아래는 코드베이스 실측으로 보강한 결과다.

```
grep 결과 (codebase/backend):
- triggers.service.ts:216  "V002__indexes.sql 의 idx_trigger_workspace_endpoint — partial unique"
- triggers.service.ts:224  const TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint';
- V002__indexes.sql:26     CREATE UNIQUE INDEX idx_trigger_workspace_endpoint ON trigger (workspace_id, endpoint_path)
- migrations/ 디렉토리 최신 파일: V130__model_config_workspace_kind_index.{sql,conf} (V131/V132 미사용 — 충돌 없음)
```

## 발견사항

발견된 CRITICAL/WARNING 없음. 대조 결과는 다음과 같다.

- **[INFO] 계획된 구현이 2026-09-18 결정(1-data-model.md Rationale «Webhook `endpoint_path` 전역
  유일»)의 세 처방 — (a) 전역 UNIQUE 로 교체(V132), (b) 기존 중복은 나중 생성 트리거만 새 UUID 로
  재할당(V131, `created_at`·`id` 순으로 원본 판정), (c) 채팅 채널 상태 컬럼은 건드리지 않고 NOTICE 로만
  운영자에게 알림 — 을 그대로 따르고 있다. 세 처방 모두 **기각된 대안**(비유일 보조 인덱스 + 앱 레벨
  검사, 중복 시 마이그레이션 실패)을 재도입하지 않는다.
  - target 위치: 착수 예정 `V131__trigger_endpoint_path_dedupe.sql` / `V132__trigger_endpoint_path_global_unique.sql`
    (작업 지시 하단 "(main 추가)" 절)
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → "Webhook `endpoint_path` 전역 유일 (2026-09-18)"
  - 상세: 대조 결과 일치. 별도 조치 불필요 — 기록용 확인.

- **[INFO] `V131`/`V132` 사이 트랜잭션 분리(DO 블록 vs `CONCURRENTLY`)와 재실행 절차(0단계 DROP →
  재생성)도 같은 Rationale 문단이 이미 요구한 형태와 일치한다.**
  - target 위치: 위와 동일
  - 과거 결정 출처: 동일 Rationale 문단 — "정리(`DO` 블록)는 트랜잭션 문장이고 교체는 `CONCURRENTLY`
    라 한 파일에 둘 수 없다" + "V131 본문을 수동으로 다시 돌린 뒤 V132 를 재실행하면 0) DROP 이
    잔재를 치우고 성공한다"
  - 상세: 작업 지시의 V132 스텝("DROP(새) → CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS → DROP(옛)")이
    이 절차와 정확히 대응.

- **[INFO] 인덱스·상수 이름 대조 — 실측으로 확인, 충돌 없음.** 코드베이스 실측 결과 현재
  `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'` (V002 정의)이고, 계획은 이를
  `idx_trigger_endpoint_path` 로 교체 후 `idx_trigger_workspace_endpoint` 를 DROP 하는 것이다. 신규
  이름 `idx_trigger_endpoint_path`·마이그레이션 번호 `V131`/`V132` 모두 기존 자원과 **충돌 없음**
  (`migrations/` 최신 파일은 `V130`).
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:216,224`
  - 과거 결정 출처: `spec/1-data-model.md` 동일 Rationale 문단(V132 가 "V002 의 UNIQUE 를 교체")
  - 상세: rationale 이 서술하는 옛 자원 이름과 실제 코드가 일치하므로, 계획이 가정하는 "옛 이름"이
    실측과 어긋날 위험은 없다.

- **[INFO] 409 에러 계약의 wire 형태 불변 확인.** `2-trigger-list.md` §2.3.1·§3 은 이미
  `TRIGGER_ENDPOINT_PATH_CONFLICT` / `details.field='endpoint_path'` 를 유지한 채 "전역" 문구만
  갱신되어 있다. 계획된 변경("409 메시지에서 워크스페이스 언급 제거"만, top-level `error.code` /
  `details.code` 불변)은 이 계약과 정합하며, 어떤 Rationale 도 이 wire 형태 변경을 요구하거나
  허용한 적이 없으므로 "메시지 문구만" 이라는 제약이 그대로 지켜지는 한 위반 소지가 없다.
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 (`endpointPath` 행), §3 (PATCH 하단 註)
  - 과거 결정 출처: 없음(이번 결정 자체가 §3 註의 SoT) — 참조용 확인.

- **[INFO] chat-channel 트리거의 "재등록 갭"은 이미 문서화된 기지(旣知) 제약이며, 이번 구현
  범위에서 새로 닫을 의무가 없다.** `1-data-model.md` Rationale 은 "새 경로를 받은 트리거가 채팅
  채널이면 provider 등록은 SQL 로 갱신할 수 없다"를 명시하고, `15-chat-channel.md` R-CC-21/R-CC-19/
  R-CC-12(d) 를 근거로 재등록은 **정상 경로(다시 저장 → `setupChannel`)** 에 위임하도록 이미
  결정돼 있다. 계획의 V131 이 NOTICE 로만 `chat_channel=true` 를 남기는 것은 그 결정의 실행이지
  번복이 아니다.
  - target 위치: 착수 예정 V131 스텝
  - 과거 결정 출처: `spec/1-data-model.md` Rationale + `spec/5-system/15-chat-channel.md` R-CC-21/
    R-CC-19/R-CC-12(d) (본 번들에 전문 포함, 예산 절단 대상 아님)
  - 상세: 두 문서가 서로 참조하며 일관된 결정을 유지 — 충돌 없음.

- **[INFO] "남는 틈"(트리거 삭제 후 경로 재등록 가능성)은 의도적으로 이번 스코프 밖에 남겨 별도
  트래커로 이관돼 있다.** target 어디에도 이 갭을 이번 PR 이 닫는다는 서술이 없으므로 스코프
  누락이 아니라 명시된 defer.
  - target 위치: 해당 없음(부재 확인)
  - 과거 결정 출처: `spec/1-data-model.md` Rationale "남는 틈" 문단
  - 상세: 참조용 확인, 조치 불필요.

## 요약

target(`spec/2-navigation/2-trigger-list.md` 및 완전 포함된 자매 문서)과 번들에 포함된 관련
Rationale(1-data-model.md · 12-webhook.md · data-flow/10-triggers.md · 15-chat-channel.md 등)은
2026-09-18 "Webhook `endpoint_path` 전역 유일" 결정에 대해 서로 모순 없이 정합해 있으며, 착수
예정 구현 계획(V131/V132 마이그레이션 + 서비스·컨트롤러 정정)도 그 Rationale 이 이미 확정한
처방(전역 UNIQUE·최초 생성자 우선·NOTICE-only·트랜잭션 분리)을 그대로 따른다. 기각된 대안(비유일
보조 인덱스+앱 레벨 검사, 중복 시 마이그레이션 실패)의 재도입 없음, 합의 원칙(409 wire 계약 불변·
채팅 채널 재등록은 정상 경로 위임·삭제 자원 정리와의 경계) 위반 없음, 무근거 결정 번복 없음(이번
변경 자체가 명시적 사용자 결정에 기반한 최초 확정이며 새 Rationale 이 이미 함께 작성돼 있음),
암묵적 invariant 우회 없음(옛 인덱스 이름·번호 충돌 여부를 코드베이스 실측으로 확인해 계획의
전제가 실제와 일치함을 검증). 예산 절단으로 본문이 빠진 15개(+57개) 파일 중 이번 착수 대상과
직접 관련된 것은 이미 "관련 Rationale 발췌"로 전문이 포함돼 있어 판정 공백은 없다.

## 위험도

NONE
