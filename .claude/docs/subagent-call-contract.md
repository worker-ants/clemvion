# Sub-agent 호출 규약 (공통)

> 본 하네스의 모든 sub-agent (`.claude/agents/<name>.md`) 는 본 규약을 따른다. 각 agent definition 은 본 doc 을 한 줄로 인용하고 자신은 perspective + checklist + 위험도 등급 정의만 남긴다.

## 1. 호출 인자

호출자는 `prompt` 인자에 다음 KEY=VALUE 두 줄을 전달한다.

```
prompt_file=<...>
output_file=<...>
```

- `prompt_file` — 점검 관점 + 분석 대상이 결합된 markdown 파일 절대경로 (orchestrator 가 작성).
- `output_file` — 본인이 작성할 결과 파일 절대경로.

일부 sub-agent (`code-review-summary`, `consistency-summary`, `integration-risk-summary`, `resolution-applier`) 는 위 두 줄 대신 `session_dir=<...>` 한 줄을 받는다 — 자신의 정의에 명시.

## 2. 수행 절차

1. `prompt_file` 을 Read.
2. 파일의 "점검 관점" + 자신의 definition 본문 "리뷰 지침" / "체크리스트" 적용해 분석.
3. 결과 markdown 을 "출력 형식" 에 맞춰 `output_file` 에 Write.
4. 호출자에게 마지막 응답으로 한 줄**만** 반환.

> **예외 — 호출 prompt 에 "출력 규약" 이 붙어 있으면 그쪽이 우선한다.** Workflow 경유
> 호출(`.claude/workflows/*.js`)은 prompt 끝에 "STATUS 헤더 + delimiter + **보고서 전문**"
> 규약을 덧붙인다. 그때는 전문을 반드시 함께 반환한다 — 4번의 "한 줄만" 은 **직접 Agent
> 호출** 기본값이다. 이유는 §7.

## 3. 반환 라인 형식

```
STATUS=<success|rate_limit|network|fatal> ISSUES=<n> PATH=<output_file> RESET_HINT=<sec 또는 빈 값>
```

`resolution-applier` 등 확장 sub-agent 는 자기 definition 에 명시한 추가 필드를 포함할 수 있다. 그 외 sub-agent 는 위 4필드만 사용한다.

### 3.1 확장 sub-agent 카탈로그

기본 4필드 STATUS 라인 / markdown output 규약에서 벗어나는 sub-agent 는 현재 둘뿐이다. 본 카탈로그는 "어디를 봐야 하는지" 만 가리킨다 — 형식의 SSOT 는 각 definition 본문이다.

| sub-agent | 벗어나는 점 | SSOT |
|---|---|---|
| [`resolution-applier`](../agents/resolution-applier.md) | STATUS 라인에 `ITEMS` / `E2E` / `ESCALATE` / `NEEDS_SPEC` / `RESOLUTION` 추가 필드. 입력은 `session_dir=` 한 줄. | `resolution-applier.md` §반환 형식 + §ESCALATE 매트릭스 |
| [`review-router`](../agents/review-router.md) | `output_file` 가 markdown 이 아니라 **JSON**. STATUS 의 `ISSUES` 자리를 `selected_count` 의미로 재사용. | `review-router.md` §출력 형식 |

`code-review-summary` / `consistency-summary` / `integration-risk-summary` 은 입력만 `session_dir=` 한 줄이고 (§1 에 명시) 반환 라인은 기본 4필드 그대로라 확장이 아니다.

## 4. STATUS 결정 규약

| STATUS | 조건 |
|---|---|
| `success` | 정상 완료. `ISSUES` = CRITICAL+WARNING+INFO 합 (또는 자신의 카운팅 규칙). |
| `rate_limit` | 한도 메시지 수신 (`Claude AI usage limit reached`, `rate_limit_exceeded`, `quota`, `5-hour limit`, `try again in ...`). **임의 우회·재시도 금지**. 메시지에서 파싱한 reset 초를 `RESET_HINT` 로. |
| `network` | 네트워크 오류 (`ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `service unavailable`, `bad gateway`, `gateway timeout`). `RESET_HINT` 보통 비움. |
| `fatal` | 결정적 오류 (`prompt_file` 부재, `output_file` Write 실패 등). 가능하면 `output_file` 에 사유 기재. Write 자체가 실패한 경우 응답 본문(STATUS 라인 위)에 사유 기재 후 fatal 보고. |

**Write 실패 시 success 거짓 보고 절대 금지.** 호출자가 보수적으로 fatal 강등할 수 있도록 본인도 fatal 로 보고한다.

## 5. 한도·네트워크 재시도 흐름

sub-agent 는 재시도 결정을 하지 않는다 — STATUS 만 보고. 재시도 결정은 호출자(main) 가 `_retry_state.json` 으로 추적하고 `ScheduleWakeup` 으로 재예약한다.

## 6. 위험도 등급 (분석형 sub-agent 공통)

| 등급 | 의미 |
|---|---|
| `NONE` | 해당 없음 / 발견 없음. |
| `LOW` / `INFO` | 참고 사항. 차단하지 않음. |
| `MEDIUM` / `WARNING` | 조치 권장. |
| `HIGH` / `CRITICAL` | 즉시 차단 / 사용자 결정 필요. |

각 agent definition 의 "출력 형식" 에 위 등급을 적용한다.

## 7. 하네스 제약 (실측 2026-07-17)

sub-agent 는 하네스로부터 **본 규약과 상충하는 지시**를 함께 받는다:

> `Subagents should return findings as text, not write report files. Include this content
> in your final response instead.`

이는 안내문이 아니라 **Write 툴의 하드 차단**이다. 실측(probe workflow `wf_61290a15-aec` ·
`wf_45d76e40-507`)으로 확인한 규칙:

| 대상 | 결과 |
|---|---|
| `SUMMARY.md` · `summary.md` · `REPORT.md` · `findings.md` | **차단** |
| `RESOLUTION.md` · `<checker>.md`(`cross_spec.md` 등) · `notes.md` | 허용 |
| `SUMMARY.txt` · `my-SUMMARY.md` | 허용 |

- **basename 정확 일치** 규칙이며 **agent 의 terminal 여부와 무관**하다 (비-terminal agent 의
  `SUMMARY.md` Write 는 막히고, terminal agent 의 `cross_spec.md` Write 는 성공한다).
- 따라서 **`SUMMARY.md` 는 어떤 sub-agent 도 쓸 수 없다** → summary 계열은 전문을 반환하고
  **호출자(main)가 멱등 Write** 한다. 각 SKILL §3 이 이를 이미 규정한다.
- **개별 결과 파일(`<name>.md`)은 차단되지 않는다.** 그럼에도 sub-agent 가 Write 를 건너뛰고
  전문을 텍스트로 반환하는 일이 잦다 — 위 하네스 지시를 따르기 때문이다(실측: 한 런에서
  5개 checker 중 4개가 Write 호출 0회). **§3 의 "STATUS 한 줄" 만 반환하고 파일을 안 쓰면
  그 결과는 사라진다** — 통합 SUMMARY 가 해당 checker 의 Critical 을 누락해 BLOCK 판정이
  **거짓 음성**이 된다(2026-07-10 실측 3회).
- 그래서 Workflow 스크립트는 prompt 에 "전문도 함께 반환" 규약을 덧붙이고, 반환 전문을
  authoritative 로 삼아 summary agent 에 **인라인 전달**한다. 파일이 없어도 판정이 온전하다.

**직접 Agent fan-out 시 주의**: Workflow 를 우회하면 위 보정이 없다. `output_file` Write 를
명시적으로 지시·확인하고, 끝나면 `--sync-from-disk` 로 `_retry_state.json` 을 실측 동기화한다
(그 경로는 `--update` 를 자동 호출하지 않는다).
