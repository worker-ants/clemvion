## Convention Compliance Check — `spec/4-nodes/4-integration/` (--impl-prep)

5개 대상 문서를 `spec/conventions/node-output.md`, `spec/conventions/cafe24-api-metadata.md` 에 대해 점검했습니다.

---

### 발견사항

---

- **[CRITICAL]** `send_email` 성공 포트 이름 불일치 — `0-common.md` vs `3-send-email.md`
  - target 위치: `0-common.md §7` 출력 구조 색인 + `3-send-email.md §3.2` / §5.1
  - 위반 규약: `spec/conventions/node-output.md` Principle 5 (port 는 "출력 포트 ID" 그대로 사용)
  - 상세: `0-common.md §7` 색인은 send_email 정상 케이스를 **`§5.1 ('success')`** 로 기록합니다. 그러나 `3-send-email.md §3.2` 포트 정의표 및 §5.1 JSON 예시는 일관되게 **`port: 'out'`** 을 사용합니다. HTTP Request / Database Query / Cafe24 는 모두 `'success'` 포트를 사용하므로, `send_email` 만 `'out'` 을 쓰는 이유도 어디에도 문서화되어 있지 않습니다. 구현자가 `0-common.md §7` 을 기준으로 삼으면 잘못된 포트 이름(`success`)을 구현하게 됩니다.
  - 제안:
    1. `3-send-email.md §3.2` 와 §5.1 을 `success` 로 통일 (다른 Integration 노드와 일관성 확보), 또는
    2. `0-common.md §7` 색인을 `§5.1 ('out')` 으로 정정 + `3-send-email.md Rationale` 에 `out` 을 쓰는 이유 명시

---

- **[WARNING]** `database_query.meta.rowCount` — 세 문서 간 삼중 불일치
  - target 위치: `spec/conventions/node-output.md` Principle 2 / `0-common.md §6` / `2-database-query.md §5.1`
  - 위반 규약: `spec/conventions/node-output.md` Principle 2 DB 행
  - 상세:
    | 문서 | `meta.rowCount` 방침 |
    |------|----------------------|
    | `node-output.md` Principle 2 | `meta.durationMs`, **`meta.rowCount`** — DB 메트릭으로 열거 |
    | `0-common.md §6` | `meta.rowCount` 가능 (`output.rowCount` 와 중복 허용) |
    | `2-database-query.md §5.1` 주석 | **명시적으로 `meta` 에 넣지 않는다** ("같은 값이 두 곳에 있으면 일관성을 해친다") |

    `database-query.md` 의 결정이 가장 구체적이고 근거가 있으나, 상위 규약(`node-output.md`)이 이를 반영하지 않아 새 구현자가 Principle 2 를 보고 `meta.rowCount` 를 추가할 수 있습니다.
  - 제안: `node-output.md` Principle 2 의 DB 행에서 `meta.rowCount` 를 제거하거나 각주로 "database_query 는 output.rowCount 만 사용" 을 추가. `0-common.md §6` 도 동일하게 정정.

---

- **[INFO]** `HTTP_4XX` 코드가 3xx (manual redirect 한도 도달) 도 포함
  - target 위치: `1-http-request.md §6` 에러 코드 표 + §4 step 12
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2 (`code` 는 `UPPER_SNAKE_CASE`, 의미 명확)
  - 상세: 코드 네임 `HTTP_4XX` 의 조건 컬럼이 `400 ≤ statusCode < 500 (또는 manual redirect 한도 도달한 3xx 도달 시)` 로 기술됩니다. 3xx 응답 상황에서 `HTTP_4XX` 를 반환하면, 구현자나 워크플로 작성자가 코드명만 보고 "4xx 에러"로 오해합니다. 또한 §5.8 에서 `integration` 인증 + 5홉 초과는 `SSRF_BLOCKED` throw 로 별도 처리되므로, 이 케이스가 어떤 auth 유형에서만 발생하는지 불명확합니다.
  - 제안: §6 표에 "(non-integration auth 의 3xx 한도 케이스)" 부연을 추가하거나, 3xx redirect 한도 초과용 별도 코드(`HTTP_REDIRECT_LIMIT`) 신설 여부를 검토 (Rationale 에 현재 결정 이유 추가 권장).

---

- **[INFO]** `node-output.md` Principle 10/11 이 컨벤션 파일에서 미노출
  - target 위치: `1-http-request.md §5`, `2-database-query.md §5`, `3-send-email.md §5`, `4-cafe24.md §5` 모두 "CONVENTIONS Principle 11 포맷" 참조
  - 위반 규약: N/A (truncation 추정)
  - 상세: 제공된 `node-output.md` 는 Principle 9 까지만 노출됩니다. target 문서들이 일관되게 인용하는 Principle 11 의 내용("JSON 예시는 undefined 필드 생략, 5필드 외 top-level 키 금지")은 모든 노드에 동일하게 적용 중이므로 적용 자체의 오류는 없으나, 컨벤션 파일 내 Principle 10/11 의 존재 여부를 확인 권장.

---

### 요약

`spec/4-nodes/4-integration/` 의 4개 노드 스펙은 `spec/conventions/node-output.md` 의 5필드 invariant, config echo (Principle 7), error contract (Principle 3), `meta.durationMs` 통일 등 핵심 규약을 전반적으로 잘 준수합니다. `cafe24-api-metadata.md` 컨벤션과의 정합도 유지됩니다. 단, **send_email 성공 포트 이름이 공통 색인(`0-common.md §7`)과 개별 스펙 간에 `'success'` / `'out'` 으로 불일치**하여 구현 시 오류로 직결될 수 있으며, **DB `meta.rowCount` 방침이 세 문서 간 모순**되는 점이 구현 착수 전에 반드시 해소되어야 합니다.

### 위험도

**MEDIUM** — CRITICAL 1건(send_email 포트명 불일치)이 구현에 직접 영향을 줍니다. WARNING 1건(meta.rowCount)도 DB 노드 구현 전 정리가 필요합니다.