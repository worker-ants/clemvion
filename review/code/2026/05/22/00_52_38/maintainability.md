# 유지보수성(Maintainability) 리뷰

**리뷰 대상**: Chat Channel Telegram 기능 — spec 문서 및 plan 파일, consistency review 산출물  
**리뷰 일시**: 2026-05-22

---

## 발견사항

### [WARNING] 복합 문장이 과도하게 길어 단일 목적을 파악하기 어려운 config 필드 설명
- **위치**: `spec/1-data-model.md` — `config` 컬럼 변경 라인
- **상세**: 변경된 `config | JSONB` 셀 설명이 하나의 셀 안에 두 개의 cross-link 문장을 연결하여 한 줄이 지나치게 길어졌다. 향후 `interaction` 이나 다른 서브 필드가 추가될 경우 동일 셀에 계속 이어붙이는 패턴이 반복되면 유지보수가 매우 어려워진다.
- **제안**: `config | JSONB` 설명 셀 대신 `config` 아래에 indent 행(예: 하위 목록 또는 별도 "설정 서브 필드" 섹션)으로 분리하거나, 셀에는 "서브 필드는 하단 §x.x 참조"만 남기고 별도 표를 신설하는 방식으로 구조화한다.

---

### [WARNING] `spec/5-system/12-webhook.md` 처리 흐름 — 단계 번호 일관성 파괴
- **위치**: `spec/5-system/12-webhook.md` §7 처리 흐름, 7번 단계 이후
- **상세**: 기존 7→8→10 단계 번호 체계에서 Chat Channel 분기를 삽입하면서 7, 8, 9, 10 이 복합 분기 문단으로 재구성되었다. 분기 로직을 `7. config.chatChannel 가 있으면` / `8. config.chatChannel 가 없으면` 으로 나누었으나 두 분기 모두 하위 알파벳 스텝(a, b, c…)을 가지며 마지막 공통 단계 9, 10이 이어지는 형태다. 기존 step 숫자를 재사용하면서 분기가 추가되어 흐름을 처음 읽는 사람이 "9번 단계는 분기 이후 공통 단계인가"를 즉시 파악하기 어렵다.
- **제안**: 분기 시작을 명시하는 사전 헤더("7. 수신 분기:") + 하위 7a/7b 구조로 표현하거나, 분기 전·분기 공통을 시각적으로 구분하는 블록 주석을 활용한다.

---

### [WARNING] `spec/5-system/14-external-interaction-api.md` EIA-AU-08 서술 — 단일 요구사항 행이 구현 세부를 과다 포함
- **위치**: `spec/5-system/14-external-interaction-api.md` §3.3, EIA-AU-08 행
- **상세**: 요구사항 표의 한 셀에 "우회 방법, 제한 경로, 구현 플래그명(`InteractionRequestContext.scope`), 외부 Guard 제약"까지 모두 서술하고 있다. 요구사항 표 셀은 보통 "무엇을 해야 한다"의 선언 수준을 유지하는 반면, 이 행은 구현 방법까지 지정하여 요구사항-구현 경계를 혼합한다. 향후 구현 세부가 변경될 때 spec 수정 범위가 불명확해지고 변경 비용이 증가한다.
- **제안**: EIA-AU-08 셀을 "In-process trusted caller 는 토큰 발급·검증을 우회 가능 (HTTP 표면 경로 제외)" 수준으로 짧게 유지하고, 구현 세부(`InteractionRequestContext.scope` 플래그, Guard 제약)는 §5 또는 §10 구현 가이드 섹션으로 이동한다.

---

### [WARNING] `spec/conventions/chat-channel-adapter.md` 에 CHANGELOG 섹션 부재 (consistency 검토 재확인)
- **위치**: `spec/conventions/chat-channel-adapter.md` 전체 (파일 35, diff 미포함 구간)
- **상세**: consistency 검토(파일 20, `23_49_16/convention_compliance.md`)에서도 동일하게 지적되었다. conventions 디렉토리의 다른 파일들이 변경 이력 추적을 위한 CHANGELOG 또는 버전 표를 보유하는 관례가 있는 반면, `chat-channel-adapter.md`는 6함수 인터페이스 변경 이력을 추적할 수단이 없다. 인터페이스가 추가·변경될 때 diff 를 거슬러 올라가야 변경 맥락을 알 수 있어 유지보수 비용이 높다.
- **제안**: `## Changelog` 섹션을 Rationale 뒤에 추가하고 최초 행으로 `| 2026-05-21 | 최초 작성 — 6함수 인터페이스 도입 |` 를 등재한다.

---

### [WARNING] `spec/5-system/14-external-interaction-api.md` R10 확장 단락 — 책임 서술이 단일 단락에 3개 경로를 나열하여 과도하게 길어짐
- **위치**: `spec/5-system/14-external-interaction-api.md` §R10 추가 단락 (추가된 두 단락)
- **상세**: R10 에 추가된 두 단락이 (a) Chat Channel 어댑터의 위치, (b) Redis pub/sub vs. in-process EventEmitter 병존, (c) NotificationDispatcher의 fan-out 3갈래를 단일 단락 내에서 모두 설명한다. 내용이 정확하더라도 독자가 한 번에 소화해야 하는 개념이 많아 읽기 어렵다.
- **제안**: 세 갈래 설명을 번호 목록으로 분리하거나, "fan-out 갈래" 소제목을 두어 시각적으로 구분한다. Chat Channel 어댑터 위치 설명 → SSE vs. in-process 비교 → fan-out 3갈래 확대 순으로 소단락을 나누는 방식이 적합하다.

---

### [INFO] `spec/4-nodes/7-trigger/0-common.md` — 신규 cross-link 문장이 한 줄로 너무 많은 정보를 포함
- **위치**: `spec/4-nodes/7-trigger/0-common.md`, 추가된 bullet 라인
- **상세**: 추가된 `-` 항목이 provider catalog 링크, 기능 설명, Webhook 트리거와의 관계, Chat Channel spec 링크를 하나의 bullet 안에 모두 담고 있다. 다른 항목들은 파일 링크만 두는 간결한 형식인데 이 항목만 장문이다. 일관성이 낮고 향후 유사 항목 추가 시 패턴 기준이 모호해진다.
- **제안**: bullet 을 "`providers/_overview.md` — Webhook 트리거 Chat Channel provider catalog" 수준으로 짧게 유지하고 상세 설명은 `_overview.md` 본문에 위임한다.

---

### [INFO] `_retry_state.json` 파일들 — newline at end of file 누락 반복
- **위치**: `review/consistency/2026/05/21/17_55_28/_retry_state.json`, `18_10_33/_retry_state.json`, `23_49_16/_retry_state.json`, `meta.json` 파일들
- **상세**: 세 라운드의 `_retry_state.json`, `meta.json` 모두 `\ No newline at end of file` 로 끝난다. POSIX 표준에서 텍스트 파일은 개행으로 끝나야 하며, git diff 에서 이 경고가 반복적으로 노출되어 리뷰 노이즈를 유발한다. 자동화 도구가 파일을 생성하는 패턴이라면 생성 로직에서 일괄 수정이 필요하다.
- **제안**: `_retry_state.json`, `meta.json` 생성 코드(또는 템플릿)에서 파일 끝 개행을 추가하도록 수정한다.

---

### [INFO] `plan/in-progress/node-config-required-defaults-sweep.md` — 후속 follow-up 섹션이 본문보다 길어 focus 가 분산됨
- **위치**: `plan/in-progress/node-config-required-defaults-sweep.md` §후속 follow-up
- **상세**: 진행 체크리스트(§진행 체크리스트)는 간결하지만, 후속 follow-up 섹션이 본문 분량의 2배에 달하는 항목들을 나열한다. 각 항목은 별 plan 으로 분리하기로 결정된 내용이지만, plan 파일이 아직 없는 것(예: `spec Rationale 공식화`, `visibleWhen DSL 통합`)들도 이 파일에서 추적된다. 이 파일이 완료 처리될 때 해당 항목들의 후속 추적이 어떻게 이루어지는지 불명확하다.
- **제안**: plan 파일이 아직 없는 follow-up 항목들은 별도 GitHub Issue 또는 backlog plan 파일로 이전하고, 이 파일의 follow-up 섹션에는 "별 plan 링크"만 남기는 방식으로 정리한다.

---

### [INFO] `spec/2-navigation/4-integration.md` Rationale 변경 — 축약으로 인한 맥락 손실
- **위치**: `spec/2-navigation/4-integration.md` §Rationale (c)항 변경
- **상세**: 변경 전 (c)항에는 "`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 가 왜 예외인지"(historical artifact, Private 흐름에서 시작해 app_type 무관으로 확장된 경위)와 "신규 코드 기준"이 모두 서술되어 있었다. 변경 후에는 이 맥락이 크게 축약되어 독자가 왜 이 코드가 예외인지를 알 수 없다. 이 변경이 Chat Channel 기능과 직접 연관이 없다면 의도하지 않은 정보 손실일 수 있다.
- **제안**: (c)항 축약이 의도된 것인지 확인한다. 의도되지 않은 변경이라면 원문의 맥락 설명을 복원한다.

---

## 요약

이번 변경은 Chat Channel 어댑터 도입을 위한 spec 문서, plan 파일, consistency review 산출물로 구성되어 있으며 소스 코드 파일은 포함되지 않는다. 전반적으로 문서 구조와 Rationale 작성 방식이 기존 프로젝트 패턴을 준수하고 있고 단일 진실 원칙(SoT) 적용도 적절하다. 주요 유지보수성 우려는 세 가지다. 첫째, `14-external-interaction-api.md` 의 EIA-AU-08 요구사항 행과 R10 확장 단락이 구현 세부와 아키텍처 설명을 단일 위치에 과도하게 집중시켜 향후 구현 변경 시 spec 수정 범위가 모호해진다. 둘째, `12-webhook.md` 의 처리 흐름 단계 번호 재사용으로 분기 가독성이 저하되어 신규 분기 추가 시 동일 패턴이 반복될 위험이 있다. 셋째, `_retry_state.json`/`meta.json` 파일들의 파일 끝 개행 누락이 자동 생성 도구에서 반복되고 있어, 도구 레벨에서 일괄 수정이 필요하다. 나머지 발견사항들은 가독성 개선 및 정보 손실 방지 수준의 권장 사항이다.

---

## 위험도

LOW
