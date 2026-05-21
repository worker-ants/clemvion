# 정식 규약 준수 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel.md`
검토 모드: spec draft (--spec)
검토일: 2026-05-21

---

## 발견사항

### [WARNING] `spec/conventions/chat-channel-adapter.md` 신설 위치가 conventions 의 기존 입주자 패턴과 정합하나 명시적 분류 기준이 draft 에만 존재
- target 위치: §R-H (p. 671~686)
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md` §1 및 CLAUDE.md "정식 규약" 정의
- 상세: `spec/conventions/` 는 "다른 spec 이 참조하는 형식·인터페이스 규약"을 모은다는 정의에 비추어, `chat-channel-adapter.md` 가 여기에 위치하는 근거를 draft 의 §R-H 에서만 서술하고 있다. 정작 신설 예정 파일 자체(`chat-channel-adapter.md`)의 도입 시 `spec/conventions/` 디렉토리 인덱스(현재 없음)나 기존 거주자들이 공유하는 도입 방식(`_overview.md` 수준의 entry point)이 규약에 명시되어 있지 않다. Café24 패턴에서 단일 provider 초기에는 인덱스 over-engineering 으로 생략했다는 서술(§2.3 note)이 conventions 자체의 문서 구조 규약과 충돌할 여지가 있다.
- 제안: §R-H 의 정당화 내용을 draft 수준에서만 두지 말고, spec 반영 시 `spec/conventions/` 의 다른 파일들이 따르는 "파일 첫 줄 `# CONVENTION:` prefix + Overview 섹션" 패턴을 `chat-channel-adapter.md` 에도 적용할 것. 단일 provider 단계에서 인덱스 생략은 허용이지만 파일 자체의 헤더 형식(기존 `cafe24-api-metadata.md`, `node-output.md` 등과 동일)은 맞춰야 함.

---

### [WARNING] `providers/` 서브디렉토리에 `_overview.md` 가 없는 전략이 기존 카탈로그 패턴의 인덱스 규약과 불일치
- target 위치: §2.3 note (p. 62~64)
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md` §1 — 서브디렉토리 신설 시 `_overview.md` 를 인덱스로 두는 패턴
- 상세: draft 는 `cafe24-api-catalog/` 의 패턴을 참고했다고 명시하나, 해당 패턴의 핵심은 서브디렉토리에 `_overview.md` 를 두어 "디렉토리 구조 + 컬럼 정의 + 동기 정책 + coverage matrix" 를 제공하는 것이다. draft 는 "단일 provider 단계에서 인덱스 over-engineering" 이라며 생략을 결정했는데, 이 결정 자체가 기존 규약의 인덱스 관행과 의식적으로 벗어나는 것이다. `_overview.md` 없이 `providers/telegram.md` 만 있으면, 향후 두 번째 provider 추가 시 인덱스 신설 여부를 다시 논의해야 한다는 미결 부담이 남는다.
- 제안: 규약 자체를 변경하거나, spec 반영 시 최소한 빈 `_overview.md` (link + "단일 provider 단계 — 이후 확장 시 갱신") 를 함께 두는 것을 권장. 또는 §R-G Rationale 에 "두 번째 provider 추가 시 `_overview.md` 신설" 을 명시적 조건으로 기재.

---

### [WARNING] 요구사항 ID 체계(CCH-* prefix)의 분류 체계가 기존 spec 과 일부 불균형
- target 위치: §3.2 요구사항 표 (p. 96~122)
- 위반 규약: 기존 spec 파일들(`12-webhook.md` 의 `WH-*`, `14-external-interaction-api.md` 의 `EIA-*`) 의 ID 분류 체계 관행
- 상세: 기존 EIA spec 은 `EIA-NX-*`(outbound), `EIA-IN-*`(inbound), `EIA-AU-*`(인증), `EIA-RL-*`(신뢰성), `EIA-NF-*`(비기능) 처럼 기능 영역별 2자 약어 infix 를 사용한다. 본 draft 의 `CCH-AD-*`(adapter), `CCH-CV-*`(conversation), `CCH-MP-*`(message/presentation), `CCH-SE-*`(security), `CCH-NF-*`(비기능) 는 같은 체계를 따르고 있어 관행 준수이다. 그러나 `CCH-SE-04` (bot token rotation API) 가 요구사항 내에서 "권장" 등급이면서 구체적인 HTTP endpoint (`POST /api/triggers/:id/chat-channel/rotate-bot-token`) 까지 포함하고 있어, 요구사항 레벨 정의와 endpoint 명세가 혼재되는 형태가 나타난다. endpoint 명세는 통상 API Convention spec 또는 해당 도메인의 본문 섹션에 두는 관행과 다소 거리가 있다.
- 제안: `CCH-SE-04` 의 endpoint URL 명시를 요구사항 설명 본문에 두되, "endpoint 명세의 세부는 `12-webhook.md` 개정 §3.4 에 위임" 식으로 cross-link 처리하면 이중 정의를 방지할 수 있음.

---

### [INFO] §3.4.2 신규 컬럼의 SQL 선언 방식이 컬럼명 규약과 정합하나 `migrations.md` 슬롯 예약 절차 미수행
- target 위치: §3.4.2 신규 컬럼 (p. 213~228)
- 위반 규약: `spec/conventions/migrations.md` §5 — "PR-A 착수 직전 `migrations.md` 에서 슬롯 번호를 예약"
- 상세: draft §11 에서 "PR-A 착수 직전 `migrations.md` 에서 예약 (I4)" 라고 명시하고 있어 의식적으로 미루어 둔 것이지만, spec draft 검토 시점에서 이 선행 조건이 충족되지 않은 상태임을 확인한다. `migrations.md` 규약은 마이그레이션 V번호를 "PR 착수 전" 에 예약하도록 명시한다. spec 이 merge 된 후 PR-A 착수 전 예약을 빠트리면 V번호 충돌 위험이 있다.
- 제안: spec draft 가 merge 되기 전에 `migrations.md` 의 V번호 예약 절차를 체크리스트에 추가하거나, PR-A plan 파일에 "착수 첫 번째 작업 = V번호 예약" 을 명시. 현재 draft 에 I4 항목으로 언급되어 있어 인식은 있으나, spec merge 조건으로 명시적 차단이 없어 누락 위험이 존재.

---

### [INFO] §3.2 `CCH-MP-04` 의 "필수" 등급과 §11 "PR-D 분리 권고" 간 우선순위 불일치 가능성
- target 위치: §3.2 CCH-MP-04 (p. 113), §11 PR-D (p. 737)
- 위반 규약: spec 3섹션 구조 권장 사항 — 요구사항 등급("필수")이 구현 계획("후속 PR 분리")과 충돌 시 Rationale 에 명시적 해소가 필요
- 상세: `CCH-MP-04` (Carousel/Chart/Table → sendPhoto)가 "필수" 등급으로 지정되어 있으나, §11 에서는 "chart 는 PR-D first, carousel/table 은 SSR 인프라 후 별 PR 권장"으로 단계 분리를 권고하고 있다. 이는 "필수이지만 v1 에 전부 구현 안 해도 됨"이라는 의미인데, 요구사항 테이블에 "필수" 등급 단독으로 표시되면 독자가 v1 일괄 구현 의무로 해석할 수 있다.
- 제안: `CCH-MP-04` 에 "v1 = chart only, carousel/table 은 후속" 인라인 비고를 추가하거나 등급을 "필수(단계적)" 처럼 명확히 구분. §5.3.4 본문 말미의 "v1 분리" 명시(p. 505)가 이미 있으나 요구사항 표 자체에는 없어 표와 본문이 불일치.

---

### [INFO] §6.3 섹션 번호 중복 — `§6.3` 이 두 번 등장
- target 위치: §6.3 (p. 557, p. 575)
- 위반 규약: 문서 구조 규약 — 섹션 번호 중복 금지
- 상세: `## 6.3 §3.3 처리 흐름 다이어그램에 chatChannel 분기 (W4 해소)` (p. 557)와 `## 6.3 Rationale 한 줄 추가` (p. 575) 가 동일 번호로 존재한다. spec 반영 시 `12-webhook.md` 의 해당 섹션 구조에 문제가 없다면 draft 에서의 중복 번호이므로 형식 오류에 해당한다.
- 제안: 두 번째 `§6.3` 을 `§6.4` 로 정정.

---

### [INFO] Redis key 패턴 `chat-channel:{triggerId}:{conversationKey}` 의 separator 일관성 확인 권장
- target 위치: §3.4.3 ChannelConversation (p. 233~246)
- 위반 규약: 해당 규약 파일 없음 — 기존 모듈 관행과의 정합 확인 권장
- 상세: draft 는 "콜론 separator + 계층형. 다른 모듈(예: `cafe24:`, `bg-monitor:`)과 동일 컨벤션" 이라고 자기 서술하고 있어 일관성을 인식하고 있다. 다만 Redis key 패턴 자체가 `spec/conventions/` 에 별도 정식 규약으로 없어 독립 검증이 불가하다. INFO 수준의 확인 권장.
- 제안: Redis key 패턴 규약이 없다면 기존 모듈 코드베이스에서 실제 사용 중인 key prefix 목록을 한 번 대조해 일관성을 확인 후 spec 반영.

---

## 요약

`plan/in-progress/spec-draft-chat-channel.md` 는 전반적으로 정식 규약을 인식하고 준수하려는 의도가 명확하게 드러난다. 요구사항 ID prefix (CCH-*) 분류 체계는 기존 EIA/WH 체계와 일관되고, Rationale 3섹션 구조(§8)도 각 spec 파일의 Rationale 에 분산 기록하는 방식으로 올바르게 위임하고 있으며, `spec/conventions/` 내 chat-channel-adapter.md 위치 선택도 cafe24 패턴 대비 충분히 정당화되어 있다. `spec/conventions/migrations.md` 의 V번호 예약 절차를 의식적으로 "PR-A 착수 직전" 으로 미룬 점은 규약을 따르는 시기를 늦추는 것이지 위반은 아니나, spec merge 후 누락 가능성에 대한 차단 장치가 없다는 점이 가장 실질적인 위험이다. WARNING 2건은 `providers/` 인덱스 생략 전략과 `chat-channel-adapter.md` 의 파일 헤더 형식 준수 여부로, spec 반영 시 기존 conventions 파일 헤더 패턴(`# CONVENTION:` prefix + Overview)을 맞추면 해소 가능하다. CRITICAL 발견사항은 없다.

## 위험도

LOW
