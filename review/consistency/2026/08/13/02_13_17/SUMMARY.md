# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, CRITICAL 0건)

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, `exec:seq:<executionId>` 소유 모듈 오분류와 §9.1 재작성 후 남는
댕글링 문자열 참조 2곳(cross_spec)이 "이 draft 가 고치려는 것과 같은 클래스의 결함을 새 형태로
재생산할 위험"이라 착수 전 반영을 권장한다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 신설 `redis-keys.md` 의 `code:` 6-모듈 glob 이 `exec:seq:<executionId>` 의 실제 소유 모듈(`modules/websocket`, `ExecutionSeqAllocator`)을 누락 — "실행 엔진 소유"로 오분류 | Overview 실측 표(①) 및 "제안 변경 1." frontmatter `code:` 계획 | 코드 실측: `modules/websocket/execution-seq-allocator.service.ts` (`modules/execution-engine`엔 `exec:seq`/`ExecutionSeqAllocator` grep 0건) | glob 에 `modules/websocket/execution-seq-allocator.service.ts` 추가, 또는 실측 표에서 `exec:seq` 를 별도 행으로 분리해 owner 정정 |
| 2 | cross_spec | §9.1 본문을 규약 문서 참조로 교체 시, 같은 파일의 §9.2 각주(L1179)·§9.3 도입부(L1183)에 남는 옛 패턴 문자열(`{service}:{workspaceId}:{resource}`)이 삭제된 텍스트를 가리키는 댕글링 참조가 됨 | "제안 변경 2." §9.1 재작성 계획 | `spec/5-system/4-execution-engine.md:1179`(§9.2 각주), `:1183`(§9.3 도입부) | 체크리스트에 "§9.2 각주(~L1179)·§9.3 도입부(~L1183)의 옛 패턴 인용을 §9.1/`conventions/redis-keys.md` 참조로 동반 갱신" 항목 추가 |
| 3 | convention_compliance | `## Rationale` H2 절이 문서에 두 개(L152, L204) — project-planner SKILL.md 가 명시한 "본문 끝에 단일 `## Rationale`" 지시 위반, 선행 동계열 문서는 H3 서브섹션으로 처리 | L204 `## Rationale — consistency \`02_01_16\` 노트 (BLOCK: YES → 조치)` | `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3-4번, 선행문서 `plan/complete/spec-draft-eia-idempotency-key-scope.md` 패턴 | L204 를 `### consistency-check \`02_01_16\` 노트 (BLOCK: YES → 조치)` 로 낮춰 L152 `## Rationale` 절의 서브섹션으로 병합 |
| 4 | convention_compliance | 신설 명명 규칙 `{도메인}:{용도}:{식별자}}` 3-세그먼트 서술이 표에 나열된 실제 키 다수(9~10개 계열, 4~6 세그먼트)와 글자 그대로 안 맞음 — 이번 착수 출발점이 된 "규칙이 실제와 어긋난다" 결함을 축소된 형태로 재생산 | L105-106 신설 `redis-keys.md` "명명 규칙(사실 기반)" 서술 | 실측 표: `interaction:idempotency:<executionId>:<route>:<key>`(5) · `cafe24:install:nonce:<mall_id>:<ts>:<hmac>`(6) 등 | "식별자" 를 `{식별자...}`(가변 다중 세그먼트) 로 명시하거나 "머리 2세그먼트만 고정, 꼬리는 가변" 으로 한정 서술 |
| 5 | plan_coherence | "후속 항목 등재: webhook·chat-channel·cafe24 역참조(범위 밖)" 가 세 도메인을 뭉뚱그려, EIA 에서 이미 반증한 "빈 포인터"(리터럴 부재) 위험을 webhook 에서 놓칠 수 있음 | 체크리스트 "후속 항목 등재" 항목 | `spec/5-system/12-webhook.md` 전체에 `wh:rl:min:<ip>`/`wh:rl:hour:<ip>` 리터럴 0건(cc/cafe24 는 이미 리터럴 존재) | "chat-channel·cafe24=역참조만" / "webhook=EIA §8.4 와 동형 처리 필요(12-webhook.md 에 리터럴 먼저 추가)" 로 분리, 또는 이번 범위에 webhook 리터럴 한 줄 포함 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec + plan_coherence (중복 발견) | §9.2 앵커(`#92-용도별-키-정의-및-ttl`) 인바운드 참조 실측이 "3건"이라 적혀 있으나 실제는 5건(`14-external-interaction-api.md` 3 · `6-websocket-protocol.md` 1(누락) · `data-flow/3-execution.md` 1). heading 보존 결론 자체는 불변(오히려 강화) | "Rationale — consistency `02_01_16` 노트" 표 INFO 2·7 행 | 커밋 전 `grep -rn '4-execution-engine.md#92' spec/` 재확인 후 "5건(6-websocket-protocol.md 포함)" 으로 정정 |
| 2 | cross_spec | data-flow/15 §2.2 `exec:seq` 중복 등재를 "이미 겪은 결함의 증상"으로 든 Rationale 비유가 부정확 — 실은 `data-flow/0-overview.md` §3.3 "Schema 매핑 표" 설계 의도(도메인별 sink 전체 요약)에 부합하는 정상 항목 | Rationale "왜 단일 표로 합치지 않는가" | Rationale 문구를 "data-flow 문서는 원래 sink 를 요약 나열한다(§3.3) — 전역 인벤토리가 상세까지 옮기면 세 번째 SoT 가 생긴다"로 정정(급하지 않음) |
| 3 | rationale_continuity | 인접 네임스페이스 각주에 `_contextKey`(`bg:<executionId>:<backgroundRunId>`, in-memory Map 라우팅 전용)가 누락 — `conventions/execution-context.md` 원칙4가 이미 이 혼동을 명문화한 전례 | "제안 변경 1. 인접 네임스페이스 각주" 항목 | 각주에 `_contextKey`(`bg:*`, in-memory 전용, SoT `execution-context.md` 원칙4) 한 줄 추가 |
| 4 | convention_compliance | "비-카탈로그 conventions 문서 18개" 수치가 실측(21개, 3개 제외 시 18개 — 제외 기준 미기재)과 바로 안 맞음 | L101-102 | "18개" 대신 "예외 없이"만 남기거나 제외 기준(카탈로그 메타데이터·가드 정의 문서 자신) 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `exec:seq` owner 오분류 · §9.1 재작성 후 댕글링 참조 2곳 (둘 다 WARNING) |
| rationale_continuity | LOW | 전반적으로 견고, `_contextKey` 각주 누락만 INFO |
| convention_compliance | LOW | `## Rationale` H2 중복 · 명명 규칙 세그먼트 수 불일치 (WARNING 2건), 나머지는 build 가드와 정합 |
| plan_coherence | LOW | webhook 빈 포인터 위험 방치(WARNING), §9.2 인바운드 건수 undercount(INFO) |
| naming_collision | NONE | 신규 식별자(`redis-keys` id/경로, 8개 도메인 접두) 전부 충돌 없음, target 이 이미 자체 교정 완료 |

## 권장 조치사항
1. `exec:seq:<executionId>` 를 6-모듈 glob 대상(`modules/websocket`)에 반영하거나 실측 표에서 owner 정정 (cross_spec WARNING 1)
2. §9.1 재작성 시 §9.2 각주(~L1179)·§9.3 도입부(~L1183)의 옛 패턴 문자열 인용을 체크리스트에 명시적으로 동반 갱신 (cross_spec WARNING 2)
3. 두 번째 `## Rationale` H2 절을 H3 서브섹션으로 병합 (convention_compliance WARNING 1)
4. 신설 명명 규칙 서술을 "머리 2세그먼트 고정, 꼬리 가변"으로 명확화 (convention_compliance WARNING 2)
5. webhook rate-limit 리터럴(`wh:rl:min:<ip>`/`wh:rl:hour:<ip>`)의 빈 포인터 문제를 chat-channel/cafe24 와 분리해 별도 처리 계획 명시 (plan_coherence WARNING)
6. (선택, INFO) §9.2 인바운드 건수·conventions 문서 개수·data-flow Rationale 비유·`_contextKey` 각주 — 착수를 막지 않는 정확도 보완
