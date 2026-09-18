# Rationale 연속성 검토 — `spec-draft-webhook-endpoint-path-global-unique`

## 발견사항

### [CRITICAL] V131 중복 정리가 chat-channel 트리거의 `endpoint_path` 를 `setupChannel()` 재호출 없이 바꾼다 — 명시적으로 기각된 대안과 같은 결과

- **target 위치**: `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`
  - 「구현 (같은 PR, developer 턴)」의 **V131** 서술: `row_number() OVER (PARTITION BY endpoint_path ORDER BY created_at, id)` 가 1 보다 큰 행에 `endpoint_path = gen_random_uuid()::text` — SQL 마이그레이션이 `trigger.endpoint_path` 를 **직접 UPDATE** 한다.
  - 「결정」§2, 「마이그레이션 검증」의 V131 서술 — 바뀌는 트리거는 id·워크스페이스 id 만 NOTICE 로 남긴다(트리거 `type`·`config.chatChannel` 유무는 언급 없음).
  - 「비대상」표 — 묘비(지운 경로 재등록)·대소문자·인증 웹훅 셋만 열거하고 **chat-channel 트리거**는 등장하지 않는다.

- **과거 결정 출처**: `spec/5-system/15-chat-channel.md`
  - `## Rationale` → `### R-CC-21. PATCH 는 비밀을 쓰지 않는다` → 「**telegram carve-out 을 정하며 함께 기각한 것**」 목록의 마지막 항:
    > **`chatChannel` 이 실린 PATCH 에서 `setupChannel` 을 아예 안 부른다** — §5.4.1 표가 *"재호출로 provider 등록만 갱신"* 을 명시하고 `CCH-AD-02` 멱등성이 그 전제다. **endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊는다.**
  - 이 기각의 근거인 요구사항 표: `CCH-AD-02`(필수) — *"Trigger enable / 신규 생성 및 `chatChannel` 이 실린 일반 PATCH 시 어댑터의 `setupChannel()` 자동 호출(텔레그램은 `setWebhook`)"*.

- **상세**: `CCH-AD-02` 는 "endpoint_path 가 바뀌면 provider(Telegram/Slack/Discord) 등록도 함께 갱신되어야 한다"는 **필수** 불변식이고, `R-CC-21` 은 이 불변식을 지키기 위해 *"PATCH 에서 setupChannel 호출을 생략한다"*는 대안을 **명시적으로 기각**했다 — 이유는 정확히 "endpointPath 변경인데 provider 재등록이 끊긴다"였다.

  V131 은 애플리케이션 계층(`TriggersService.update()` → `setupChannel()`)을 완전히 우회해 DB 에서 직접 `endpoint_path` 를 바꾼다. 중복 묶음 중 "나중에 만든" 쪽(loser)이 chat-channel 트리거(`type='webhook'` + `config.chatChannel` 존재, CCH-AD-04)라면:
  1. 마이그레이션 뒤 DB 의 `endpoint_path` 는 새 UUID 지만, 그 워크스페이스가 Telegram/Slack/Discord 에 **등록해 둔 webhook URL 은 옛 경로 그대로**다(`setupChannel()`/`setWebhook` 미호출).
  2. 옛 경로는 이제 "먼저 만든" 쪽(winner)이 전역 UNIQUE 로 **단독 소유**한다 — winner 가 chat-channel 이 아니어도, 외부 provider 가 그 옛 경로로 계속 보내는 업데이트는 이제 **winner 의 워크플로**로 들어간다.
  3. 결과적으로 이 draft 가 고치려는 것과 **같은 클래스의 결함**(외부 발신자가 알고 있는 URL 이 다른 워크스페이스로 라우팅됨)이 마이그레이션 자체가 만든 잔여 상태로 재발한다 — 다만 방향이 반대(loser 의 진짜 provider 트래픽이 winner 로 샌다)일 뿐이다.
  4. NOTICE 가 id·워크스페이스 id 만 남기므로, 운영자가 이 사고를 사후에 감지할 방법이 없다.

  즉 V131 은 R-CC-21 이 명시적으로 기각한 대안("endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊는다")과 **똑같은 결과**를 다른 경로(마이그레이션)로 만들어 낸다. draft 는 이 충돌을 인지하지 못했고 「비대상」·「남는 틈」 어디에도 등재하지 않았다.

- **제안**: 다음 중 하나를 S3(Rationale)·구현 절에 명시:
  1. V131 실행 전/후로 `type='webhook' AND config->'chatChannel' IS NOT NULL` 인 loser 행을 추려 developer 턴에서 `setupChannel()` 을 재호출하는 후속 스텝을 추가(가장 안전).
  2. 최소한 NOTICE 에 `type`·`chatChannel 존재 여부` 를 포함시켜 운영자가 수동 재등록 대상을 식별할 수 있게 하고, 「비대상」표에 "chat-channel 트리거의 provider 재등록"을 새 항목으로 명시(즉시 처리는 못해도 트래커에 남길 것).
  3. 왜 이 경우엔 CCH-AD-02/R-CC-21 의 전제를 깨도 안전한지(예: 애초에 이런 조합이 나올 수 없는 이유)를 실측·근거로 반증한다면 그 근거를 S3 Rationale 에 적을 것 — 현재는 근거가 전혀 없다.

### [WARNING] `spec/data-flow/10-triggers.md` 의 기존 Rationale 절이 이번 결정으로 반증된 가정을 그대로 남긴다

- **target 위치**: 변경안 **S6** — `spec/data-flow/10-triggers.md` 의 "`trigger` 생성 행"(§2 테이블, 실제 파일 173행)만 갱신 대상으로 적었고, 같은 파일의 `## Rationale` 섹션은 S1~S6 어디에도 포함돼 있지 않다.

- **과거 결정 출처**: `spec/data-flow/10-triggers.md` `## Rationale` → `### Webhook \`endpoint_path\` 의 UNIQUE 범위`(실제 파일 245~255행):
  > `(workspace_id, endpoint_path)` 가 UNIQUE 이므로 워크스페이스 스코프 안에서는 경로가 유일하다. … **충돌 회피는 `endpoint_path` 를 UUID 로 자동 발급(WH-MG-02)해 사실상 전역 고유로 만드는 방식에 의존한다** … 라우팅 키가 워크스페이스 무관 전역이고 공개 트리거의 경우 `endpoint_path` 가 사실상 비밀 키(WH-SC-01)이므로, 예측 가능한 비-UUID 경로 직접 지정(squatting·enumeration)을 형식 강제로 차단한다.

- **상세**: 이 절은 지금 draft 의 「무엇이 문제였나」·「재현」이 **정면으로 반증한** 바로 그 가정("UUID 고엔트로피 ⇒ 사실상 전역 고유")을 여전히 유효한 설계 근거처럼 서술한다. S6 은 같은 파일의 표 행(173행, "trigger 생성" sink)만 "V132 전역 UNIQUE" 로 바꾸는데, 그 몇 줄 아래(245행)의 Rationale 절은 손대지 않아 **같은 파일 안에서 표는 새 설계를, Rationale 은 옛(반증된) 설계를 말하는 상태**가 남는다. 이 저장소는 이런 상황에 대한 선례가 이미 있다 — `spec/2-navigation/2-trigger-list.md` `### R-2` 는 폐기된 설계를 지우지 않고 취소선 + "정정 (날짜)" 주석 + 대체 절 링크로 처리한다. 이번 draft 는 S3 에서 `spec/1-data-model.md` 에 새 Rationale 절을 추가하지만, `10-triggers.md` 쪽의 옛 절에는 그 결정을 가리키는 pointer 도, 취소선도 계획돼 있지 않다.

- **제안**: S6 에 한 항목을 추가해 `### Webhook \`endpoint_path\` 의 UNIQUE 범위` 절에 "정정(2026-09-18)" 주석을 달거나, 최소한 그 절 끝에 "이 절의 «UUID 고엔트로피가 사실상 전역 고유를 만든다」는 가정은 반증됐다 — [데이터 모델 Rationale «Webhook endpoint_path 전역 유일»](../1-data-model.md) 참조" 한 문장을 추가할 것.

### [INFO] `TRIGGER_ENDPOINT_PATH_CONFLICT` 카탈로그 설명문이 "동일 워크스페이스" 로 남는다

- **target 위치**: 변경안 S5 — `spec/5-system/3-error-handling.md` 한 곳만 명시(`… 가 (endpoint_path) UNIQUE 제약(전역)을 위반할 때 발행한다`로 교체 대상은 234행 한 문장뿐).
- **과거 결정 출처(문서 내 인접 서술)**: 같은 파일 238행 카탈로그 표 — `TRIGGER_ENDPOINT_PATH_CONFLICT | … 동일 워크스페이스에 같은 endpointPath 를 쓰는 트리거가 이미 존재.`
- **상세**: draft 본문(43~48행)이 스스로 지적하듯 이 "동일 워크스페이스에" 문구는 `triggers.service.ts` 409 메시지 원문이고, 구현 절은 그 메시지를 "워크스페이스를 말하지 않게" 고치겠다고 명시한다. 그런데 변경안 S5 는 234행(제약 설명)만 겨냥하고, 같은 표의 238행(코드 설명)에 있는 같은 "동일 워크스페이스에" 문구는 언급하지 않는다. Rationale 은 아니지만 위 두 발견과 같은 뿌리(문구가 여러 곳에 흩어져 일부만 갱신됨)라 함께 적는다.
- **제안**: S5 범위에 238행도 포함시켜 "동일 워크스페이스" 를 지우거나 "(다른 워크스페이스 포함)" 으로 명시.

## 요약

핵심 결정(유일성 범위를 워크스페이스 → 전역으로 바꾸는 것) 자체는 재현 가능한 보안 결함을 근거로 사용자 승인을 받았고, 기각한 대안(비유일 보조 인덱스 + 앱 레벨 중복 검사)도 이유와 함께 적혀 있어 이 축의 Rationale 연속성은 양호하다. 그러나 이 결정을 **실행하는 메커니즘**(V131 이 애플리케이션 계층을 건너뛰고 DB 에서 직접 `endpoint_path` 를 바꾸는 것)이, `spec/5-system/15-chat-channel.md` 의 `## Rationale`(`R-CC-21`)이 **명시적으로 기각**한 대안("PATCH 에서 endpointPath 가 바뀌는데 provider 재등록을 안 한다")과 같은 결과를 별도 경로로 재생산한다 — 그리고 이 충돌은 draft 어디에도 인지·처분돼 있지 않다. 부수적으로 `spec/data-flow/10-triggers.md` 의 기존 Rationale 절 하나가 이번에 반증된 가정을 그대로 남기게 된다.

## 위험도

CRITICAL
