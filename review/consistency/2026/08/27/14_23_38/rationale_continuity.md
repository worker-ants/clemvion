# Rationale 연속성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 방법 메모

프롬프트의 diff 섹션이 컨텍스트 예산으로 생략되어 있어, 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/masking-residuals-0b195b`)에서 직접
`git diff origin/main...HEAD`(spec/5-system/ 실질 변경 3파일 + 관련 spec/conventions/**
2파일 + spec/2-navigation/14-execution-history.md)를 재확인했다. 이 브랜치는 직전
rationale-continuity 3라운드(`19_26_06` CRITICAL→해소, `13_25_45` NONE, `13_47_15` NONE)를
거쳤으므로, 이번 라운드는 **`13_47_15` 이후 새로 추가된 커밋**(`69802a686` — R-5 W2 문구를
"두 노드 spec 미확인 추정"으로 반증하고 정정)이 기존 Rationale 과 충돌 없이 안착했는지를
중점 검증했다. `cd5cf104b`(직후 커밋)는 review 산출물만 추가하는 chore 커밋으로 spec/
변경이 없음을 `git show --stat` 으로 확인했다.

## 검토 대상 diff (spec/5-system/ 및 직접 인용되는 관련 spec)

- `spec/5-system/4-execution-engine.md` — `_resumeState`/`_retryState`/`_resumeCheckpoint`
  credential 제거 서술을 "`maskSensitiveFields` boundary" → "allow-list"로 정정, `Engine Raw
  Config Exposure` 절에 storage-time 마스킹 부재 명문화 블록의 앵커 수정.
- `spec/5-system/14-external-interaction-api.md` / `spec/5-system/6-websocket-protocol.md` —
  §R17/§4.1 인용 원칙명 `boundary masking parity` → `egress masking parity` 동기화.
- `spec/2-navigation/14-execution-history.md` R-5 — "자격증명을 노드 config 에 평문 담는
  노드 타입(HTTP Request·Send Email 등)"이라던 근거 문구를 두 노드 spec 실측 결과로 좁힘
  (`69802a686`, 신규).
- `spec/conventions/node-output.md` / `spec/conventions/egress-masking.md` — Principle 0/7,
  마스킹 좌표계 표 관련 신설 blockquote.

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO] `69802a686` 의 R-5 W2 정정이 실제 근거(두 노드 spec)와 일치함을 독립 재검증**
  - target 위치: `spec/2-navigation/14-execution-history.md` R-5 "본 가드는 ..." 아래
    blockquote (2026-08-27 정정 문단).
  - 과거 결정 출처: 같은 R-5 blockquote 의 직전 버전(`57fb83592`가 도입한 "HTTP Request ·
    Send Email 등... 근본 처방은 참조 간접화" 문구) — 이 문장 자체가 이번 PR 내에서
    developer 가 작성한 예고성 진단이었다.
  - 상세: 정정문은 "Send Email 은 config 에 자격증명이 앉지 않는다"(integrationId 간접화),
    "HTTP Request `authentication='integration'` 도 동일 간접화 + url 은
    `sanitizeUrlCredentials` 로 치환", "남는 표면은 `authentication='custom'` 뿐"이라 주장한다.
    두 노드 spec 을 직접 열어 대조한 결과 모두 일치했다: `spec/4-nodes/4-integration/
    3-send-email.md:140`("`config.integrationId` ... 자격증명 자체는 echo 되지 않음"),
    `spec/4-nodes/4-integration/1-http-request.md:85,184`("Config echo 빌드... 명시 열거...
    `url` 만 `sanitizeUrlCredentials` 결과로 교체", "`integrationId` ... 자격증명 자체는
    절대 echo 금지"). 즉 이 정정은 근거 없는 번복이 아니라 **정본 요건(§3)을 충족하는
    자기반증형 정정**이다 — 옛 문장을 취소선 없이 교체했지만 (a) 날짜(2026-08-27)와 반증
    이유(두 spec 미확인 추정)를 명시하고, (b) 대체 근거(위 두 인용)를 함께 실었으며,
    (c) 좁혀진 형태를 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 정본
    트래커에도 동일 표로 반영했다(테이블 4행, 대상/실측/판정 컬럼).
  - 제안: 조치 불필요. 참고로 이 문장은 developer 가 같은 PR 안에서 직접 써 넣은 예고성
    문구를 실측으로 반증한 사례라 CLAUDE.md의 "자기-반증형 소정정" 성격에 부합하지만,
    해당 조항은 developer 가 `spec/` 을 planner 턴 없이 직접 고치는 절차 요건(다섯 조건)에
    관한 것이고, 본 검토는 Rationale **내용의 정합성**만 판단한다 — 절차 준수 여부는 이
    관점의 범위 밖이다.

- **[INFO] "boundary masking parity" 원칙명 잔존 여부 재확인 — 0건**
  - target 위치: `spec/5-system/14-external-interaction-api.md`, `spec/5-system/
    6-websocket-protocol.md`, `spec/conventions/node-output.md`, `codebase/backend/src/
    modules/execution-engine/**`.
  - 상세: `grep -rn "boundary masking parity" spec/ codebase/` 재실행 결과 0건. `13_47_15`
    라운드가 이미 spec/ 기준 0건을 확인했었고, 이번엔 codebase/execution-engine/ 까지
    범위를 넓혀도(`69802a686` 커밋 메시지가 "이 PR 에서 스윕 범위가 세 번 좁았다"고 자인한
    이력이 있어 재확인) 동일하게 0건. 남은 `maskSensitiveFields` 참조는 전부 "종전에는"
    형태의 역사적 주석(`handler-output.adapter.ts:32`, 관련 spec 파일)으로, 기각된 대안의
    재도입이 아니라 정정 이력 서술이다.
  - 제안: 조치 불필요.

- **[INFO] `config` 절대-echo-금지 invariant 와 신설 egress-only 마스킹 정책의 정합 재확인**
  - target 위치: `spec/conventions/node-output.md` Principle 7 (`## 절대 echo 금지` 및
    바로 아래 "egress 값-마스킹이 이 금지를 backstop 한다" blockquote, L359-376).
  - 상세: 이번 PR 이전부터 있던 "핸들러는 자격증명을 config 에 절대 echo 하지 않는다"는
    invariant가, storage-time 마스킹 제거 이후에도 명시적으로 "여전히 상시 불변식"으로
    재확인되어 있고 egress 값-마스킹은 이를 대체가 아니라 "backstop(방어 계층)"으로 자리
    매김했다 — 신설 정책이 기존 invariant 를 우회하지 않는다.
  - 제안: 조치 불필요.

## 요약

`13_47_15` 라운드가 NONE 으로 판정한 이후 spec/5-system/ 및 인접 spec 에 발생한 유일한
실질 변경은 R-5 W2 문구를 "두 노드 spec 실측"으로 좁힌 `69802a686` 정정이다. 이 정정을
독립적으로(HTTP Request·Send Email 두 노드 spec 원문 대조) 재검증한 결과 주장이 정확했고,
날짜·반증 사유·대체 근거·정본 트래커 반영을 모두 갖춘 모범적인 정정 형태였다. `boundary
masking parity` 잔존 여부를 codebase 까지 범위를 넓혀 재확인해도 0건이며, "config 절대
echo 금지" invariant 는 egress-only 마스킹 정책 신설 이후에도 대체가 아닌 backstop 으로
명시적으로 재확인되어 있다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, 암묵적
invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
