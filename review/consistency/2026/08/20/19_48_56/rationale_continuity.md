# Rationale 연속성 검토 — `spec-draft-inputoverride-marker-reject.md` (2026-08-20 19_48_56)

## 점검 대상
- target: `plan/in-progress/spec-draft-inputoverride-marker-reject.md` (spec draft, `--spec` 모드)
- 대조 대상: `spec/5-system/14-external-interaction-api.md §R17` · `spec/5-system/3-error-handling.md §1`
  · `spec/5-system/13-replay-rerun.md §8.1/§10.2` · `spec/4-nodes/7-trigger/1-manual-trigger.md §6`
  의 `## Rationale`/본문, 그리고 직전 라운드 `review/consistency/2026/08/20/19_34_37/*`
  (이 target 이 스스로 "그 CRITICAL 을 본문에 반영했다" 고 주장하는 그 라운드) · `12_08_46`·`18_24_31` 라운드
  · 실제 backend 코드(`executions.service.ts`, `workflows.controller.ts`, `http-exception.filter.ts`).

## 선행 확인 — target 이 인용하는 과거 라운드의 사실관계
target 헤더는 "`19_34_37` 게이트가 BLOCK:YES 를 냈고 그 CRITICAL 을 본문에 반영했다" 고 적는다.
`review/consistency/2026/08/20/19_34_37/SUMMARY.md`·`rationale_continuity.md` 를 직접 열어 대조한 결과:

- CRITICAL(re-run 이 `details[]` 대신 `errors` 로 던져 `GlobalExceptionFilter` 가 조용히 버림) —
  target 은 "⚠️ 초안의 전제가 틀렸다" 절 + "구현 스코프에 포함" 문단 + spec 변경 항목 2·3 으로 반영했다. **정합**.
- WARNING 1("외부 소비자 없음"을 "확인된 사실"로 단정, W5 미해결과 충돌) — target 은 표현을
  "사용자(저장소 소유자)의 답변" 으로 낮추고 W5 를 닫는 문장을 추가했다. **정합**.
- WARNING 2(`coerce_failed` "세 라운드" 과장 인용) — target 은 `19_34_37 rationale_continuity W2`
  를 명시 인용하며 정정했다. **정합**.
- INFO(`INVALID_INPUT` §1.3 미등재) — target 은 "(선택) 5." 항목으로 반영했다. **정합**.
- `12_08_46`·`18_24_31` 인용(정확 일치 경계·"완전 폐쇄" 오독 WARNING)도 각각 실제 세션 파일에서
  대응 문장을 확인했다 — **지어낸 이력 아님**(MEMORY "Rationale 기각된 대안은 실제 이력 필수" 통과).

즉 `19_34_37` 라운드가 지적한 항목들은 이번 target 에서 실제로 교정됐다. 아래는 **이번 라운드에서 새로 발견한** 항목이다.

## 발견사항

- **[WARNING]** re-run 을 `details[]` 대상에 포함시키면서, 그 사실을 명시적으로 배제해 온 세 번째 spec 문장을 갱신 대상에서 빠뜨렸다
  - target 위치: target 문서 `## 에러 계약 — 기존 헬퍼를 확장한다` 절의 "구현 스코프에 포함" 문단
    (`executions.service.ts` 의 catch 블록을 `details: toTriggerParameterErrorDetails(err.errors)` 로 교정)
    + `## spec 변경 4곳` 목록(2번 `3-error-handling.md §1.7`, 3번 `13-replay-rerun.md §8.1`)
  - 과거 결정 출처: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6, 184번째 줄
    ```
    > **응답 봉투**: Manual·Webhook 경로의 컨트롤러/서비스는 `BadRequestException({ code, message, details })`
    > 를 throw 하며 ... `{ error: { code, message, requestId, details } }` 로 응답한다.
    ```
    바로 위 표는 "Manual re-run (inputOverride)" 을 `INVALID_INPUT` 코드의 **별도 행**으로 이미
    구분해 두고 있는데도, 그 아래 "응답 봉투" 문장은 그 행을 `details` 봉투 서술에서 제외한다
    (`Manual`·`Webhook` 두 경로만 명시). 이 줄은 직전 라운드(`19_34_37` cross_spec/naming_collision
    CRITICAL 표)가 "re-run 은 이미 spec 상 제외돼 있음" 의 근거로 직접 인용한 문장이다.
  - 상세: target 은 이 CRITICAL 을 고치면서 `3-error-handling.md §1.7`(scope 주석에 re-run 을
    세 번째 소비처로 추가) · `13-replay-rerun.md §8.1`(details[] 는 §1.7 카탈로그를 따른다 명문화)
    두 문서를 명시적으로 갱신 대상에 넣었다 — 이는 "re-run 이 details 를 안 갖는다" 는 낡은 서술을
    바로잡는 올바른 방향이다. 그런데 정확히 **같은 성격의 서술이 세 번째 위치**
    (`1-manual-trigger.md:184`)에도 있고, 이 파일은 "spec 변경 4곳" 목록에 전혀 등장하지 않는다.
    구현 스코프대로 `executions.service.ts` 가 고쳐지면 re-run 도 `details` 봉투로 응답하게 되어
    이 문장의 "Manual·Webhook 경로" 라는 닫힌 열거가 **사실과 어긋나는 stale 문구**로 남는다.
    이는 이 문서군이 반복적으로 겪어 온 "총칭이 아니라 열거" 실패 형태와 동일하다 — §R17 이
    "적용 범위는 총칭이 아니라 열거다" 라고 스스로 못박아 온 이유가 정확히 이 패턴(자매 서술 중
    하나만 갱신되고 나머지가 낡은 채 남는 것)이었다.
  - 제안: `## spec 변경 4곳` 에 다섯(또는 필수) 번째 항목으로 `spec/4-nodes/7-trigger/1-manual-trigger.md
    §6` 의 "응답 봉투" 문장을 "Manual·Webhook·Manual re-run 경로" 로 갱신하는 항목을 추가할 것.
    표 위 어댑터별 응답 표(174~182행)는 이미 re-run 을 별도 행으로 정확히 구분해 두고 있으므로
    바로 아래 문장만 정정하면 된다 — 손이 작게 든다.

- **[INFO]** 병렬 워크트리(`eia-inputdata-marker-guard`)의 동일 트래커 항목과의 재확인 시점
  - target 위치: target frontmatter `worktree: eia-inputoverride-reject-a3f1c9`
  - 상세: `19_34_37 naming_collision` 이 이미 관측한 바와 같이, 병렬 워크트리
    `eia-inputdata-marker-guard` 가 같은 트래커 항목("`inputOverride` 서버측 마커 리터럴 거부")을
    갖고 있다(그 워크트리의 CLAUDE.md 가 이번 호출의 시스템 컨텍스트로도 섞여 들어왔다). 그 시점
    diff 는 없었다고 기록돼 있으나, 이는 Rationale 충돌이라기보다 MEMORY 의 "백로그 착수 전 병렬
    세션 머지 확인" 패턴이라 이 checker 의 본 관점(과거 Rationale 재도입/원칙 위반)과는 축이 다르다.
  - 제안: push 직전 병렬 워크트리와의 diff 재확인(이미 트래킹된 절차 — 새 조치 요구 아님).

## 정합성 확인 (문제 없음으로 판정한 항목)
1. **판정 기준("마스킹된 읽기에서 되돌아온 값인가")** — §R17 이 이미 확립한 "round-trip 되는 값만
   카브아웃 대신 가드로 다룬다" 축(2026-08-20 갱신분)과 정확히 같은 원칙의 서버측 적용. 새 대안이 아니다.
2. **정확 일치만 감지 / 중첩 leaf 검사 / MAX_REDACT_DEPTH(10) 정렬** — §R17 "보장의 경계" 문단·
   `sanitize-error-message.ts`(`MAX_REDACT_DEPTH = 10` 실측 확인)와 일치. 프런트 `isMaskedMarker`
   선례(`12_08_46 W2`)를 정확히 인용해 "부분 포함 매칭" 대안을 기각한 것도 실제 이력과 부합.
3. **`resolveTriggerParameters` 공유 함수 안에 넣지 않는다는 판단** — R10 계열의 "공유 프리미티브를
   넓히면 무관한 경로가 오염된다" 원칙 계승. 5개 호출부 실측도 target 표와 일치.
4. **`coerce_failed` 재사용 기각 + 이력 정정** — 기각 사유(#1188 UX 퇴화 재현 우려) 자체는 실측과
   일치하며, "세 라운드" 과장 인용은 이번 target 에서 `19_34_37 W2` 를 명시 인용해 정정됐다.
5. **§R17 잔여② "닫는 조건 충족" 서술을 UI 한정으로 좁히는 갱신 방향** — `18_24_31` WARNING 을
   정확히 이행하는 방향(§R17 표에 서버측 행 추가 + 남는 경계를 webhook/schedule 로 재정의).
6. **`MASKED_VALUE_RESUBMITTED` 를 §1.7 에 도메인-참조 패턴으로 등재** — `3-error-handling.md`
   자체 Rationale 이 이미 확립한 "정의 SoT 는 도메인 spec, §1 은 공용 카탈로그 가시성 등재" 관행
   (WebAuthn/2FA·KB 선례)과 동일 패턴. 새 원칙 도입이 아니다.

## 요약
target 은 직전 라운드(`19_34_37`)가 낸 BLOCK:YES CRITICAL 1건과 WARNING 2건을 실제로 교정했고,
그 인용(과거 라운드 세션 ID·발견 내용)도 실제 세션 파일과 대조해 검증됐다 — 지어낸 이력이 아니다.
§R17 의 "정확 일치만 감지"·"round-trip 되는 값만 가드로 다룬다"·"공유 프리미티브 비오염" 등 이미
합의된 원칙들도 정확히 계승하며 새 결정(서버측 400 거부, `coerce_failed` 비재사용)에는 근거 있는
새 Rationale 을 함께 쓰고 있어 기본 골격은 건전하다. 다만 이번 라운드에서 새로 하나를 찾았다 —
re-run 을 `details[]` 대상에 포함시키는 CRITICAL 교정을 하면서, "Manual·Webhook 경로만 details
봉투를 갖는다" 고 명시한 세 번째 자매 문장(`1-manual-trigger.md:184`)이 "spec 변경 4곳" 목록에서
누락됐다. `3-error-handling.md §1.7`·`13-replay-rerun.md §8.1` 두 곳은 정확히 갱신하면서 같은
성격의 세 번째 위치를 놓친 것으로, 이 문서군이 스스로 "총칭이 아니라 열거" 라고 반복 경계해 온
바로 그 실패 형태의 소규모 재발이다. 구현되면 즉시 잘못된 문장이 되므로 spec 확정 전 반영을
권한다.

## 위험도
LOW
