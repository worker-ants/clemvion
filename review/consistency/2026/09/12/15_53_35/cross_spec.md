# Cross-Spec 일관성 검토 — `spec/5-system/15-chat-channel.md` (impl-prep)

## 검토 방법 메모

전달된 `_prompts/cross_spec.md` 번들은 컨텍스트 예산 초과로 `spec/0-overview.md` 와 target
문서(`15-chat-channel.md`) 를 제외한 **111개 관련 spec 파일 본문이 전부 절단**돼 있었다
(5-system 17개 + 관련 spec 94개). "여기 없다 = 내용 없다" 로 판정하지 않기 위해, target 이
실제로 인용하는 아래 파일들을 리포지토리에서 **직접 `Read`/`grep`** 하여 대조했다:
`spec/1-data-model.md` §2.8 · `spec/2-navigation/2-trigger-list.md` (§2.1/§2.3.1/§3/R-12) ·
`spec/4-nodes/7-trigger/providers/{_overview,telegram,slack,discord}.md` ·
`spec/5-system/{2-api-convention,3-error-handling,4-execution-engine,14-external-interaction-api,12-webhook}.md` ·
`spec/conventions/{chat-channel-adapter,audit-actions,error-codes}.md` ·
`spec/data-flow/14-chat-channel.md`. 아래 발견사항은 이 직접 대조를 근거로 한다.

## 작업 맥락

`plan/in-progress/chat-channel-rules-cleanup.md` 는 `spec_impact: none` 인 순수 코드 정리
(`chat-channel-input-rules.ts` 헬퍼 추출 등)로, target spec 문서 자체를 편집하지 않는다.
따라서 본 검토의 실질 질문은 "이 착수가 기존 spec 상태와 새로 충돌을 만드는가" 가 아니라
"착수 시점의 `spec/5-system/15-chat-channel.md` (변경 없음) 가 다른 영역과 이미 모순돼 있는가"
이다.

## 발견사항

교차 인용 지점(요구사항 ID·에러 코드·데이터 모델 컬럼·RBAC·상태 코드 네임스페이스 분리)을
전수 대조한 결과 **CRITICAL/WARNING 급 모순은 발견되지 않았다.** 확인한 항목:

- **요구사항 ID 네임스페이스**: `CCH-*` prefix 는 `15-chat-channel.md` 바깥에서 재정의되지 않고,
  `1-data-model.md` · `2-trigger-list.md` · `12-webhook.md`(WH-MG-09) · `14-external-interaction-api.md` ·
  `providers/{telegram,slack,discord}.md` 가 전부 링크로만 인용한다(값 복제 없음).
- **데이터 모델**: `1-data-model.md §2.8` 의 Trigger 5개 신규 컬럼(`chat_channel_health` 등) +
  `hasBotToken` derived 필드 cross-link 이 target §4.2/§5.4.2 서술과 **정확히 일치**한다.
- **EIA 관계**: `14-external-interaction-api.md` 의 R10(단일 sink 확장) · EIA-AU-08(in-process
  trusted caller) · `InteractionRequestContext` discriminated union(§3.3.1) · R5(외부 WS 보류) 가
  target §5.1/§5.3/§8/Rationale 이 주장하는 내용과 **양방향으로 정합** — 한쪽만 갱신되고 다른
  쪽이 stale 인 흔적 없음.
- **에러 코드 계층 분리**: `STATE_MISMATCH`(EIA REST, 409) vs `INVALID_EXECUTION_STATE`(WS, 내부
  코드) 의 표면별 분리는 `4-execution-engine.md §7.5.1` · `14-external-interaction-api.md` ·
  `3-error-handling.md` 세 곳이 동일하게 설명한다. target §4.1.1 의 `surfaceMismatch`
  (`HooksService.forwardToInteractionService` → `InteractionService.interact()` in-process 경유)가
  `STATE_MISMATCH` 를 인용하는 것은 EIA 진입점을 타는 호출이므로 올바른 네임스페이스 선택이다.
- **`field`→`code` 동봉 규칙**: `2-api-convention.md §5.3` 의 2026-09-11 규약화("field 실으면
  code 도 싣는다")와 target §5.4.1/§5.4.1.2 의 `#1317` 배선 서술이 시점·내용 모두 일치.
- **RBAC**: target 은 `rotate-bot-token` 엔드포인트 자체의 role 요구를 명시하지 않지만,
  `1-auth.md:431` 이 `trigger.chat_channel_bot_token_rotated` 를 "Editor+ 가 호출 가능한 특권
  작업" 으로 명시 — 트리거 CRUD 권한 매트릭스(`1-auth.md:374`)와 별개 축으로 이미 커버돼 있어
  누락이 아니다.
- **감사 로그 액션명**: `conventions/audit-actions.md` 의 `chat_channel_bot_token_rotated`
  (resource-prefix 과거분사)와 target §5.4.1 말미의 2026-08-11 정정 서술(`chat-channel.rotate-
  bot-token` 오기 → `trigger` resource 로 정정)이 일치.
- **Redis 키·TTL**: `data-flow/14-chat-channel.md §2.2` 의 `cc:dedup:*`(TTL 30s) / `cc:rl:*`
  (TTL 60s) 서술이 target CCH-SE-02/CCH-NF-03 의 30초/60건 정책과 일치.
- **provider 목록**: `providers/_overview.md §1` 의 v1 supported(`telegram`/`slack`/`discord`)가
  target CCH-AD-01 의 단일 진실 인용과 일치.

## 요약

`spec/5-system/15-chat-channel.md` 는 최근 다회 라운드(#1317~#1324)의 cross-spec 정합화를 거쳐
현재 상태에서 데이터 모델·EIA 계약·에러 코드 네임스페이스·RBAC·감사 로그·Redis 키 전반에 걸쳐
다른 영역과의 참조가 양방향으로 일치한다. 금번 착수(`chat-channel-rules-cleanup`, spec_impact:
none)는 spec 문서를 편집하지 않는 순수 코드 리팩터이므로 새로운 cross-spec 충돌을 만들 표면이
없다. 다만 자동 조립된 `--impl-prep` 프롬프트 번들이 예산 초과로 관련 spec 111개 파일을 절단한
채 target 만 온전히 실었다는 점은 이 체크의 구조적 약점으로 남아 있다 — 이번엔 수동 `Read`/`grep`
으로 보완했으나, 재발 방지책(청크 분할·요약 축약 등)은 harness 쪽 개선 과제로 별도 적어둘 만하다.

## 위험도

NONE
