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
4. 호출자에게 마지막 응답으로 한 줄**만** 반환. 본문은 절대 반환하지 말 것.

## 3. 반환 라인 형식

```
STATUS=<success|rate_limit|network|fatal> ISSUES=<n> PATH=<output_file> RESET_HINT=<sec 또는 빈 값>
```

`resolution-applier` 등 확장 sub-agent 는 자기 definition 에 명시한 추가 필드를 포함할 수 있다. 그 외 sub-agent 는 위 4필드만 사용한다.

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
