# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 전문을 반환했고, Critical/Warning 급 위배는 0건이다.

## 전체 위험도
**LOW** — Plan Coherence 가 LOW(정밀도 보강 성격 INFO 2건), 나머지 4개는 NONE. target
(`plan/in-progress/spec-draft-eia-notification-payload-contract.md`, --spec 모드, 6차 draft)는
`spec/**` 데이터 모델·API 계약·RBAC·규약·plan 정합·신규 식별자 6개 관점 전수 실측(grep/원문 대조/
git 이력)에서 실질 위반이 발견되지 않았다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | WS 프로토콜 문서 자체의 기존 `### 4.4` 헤딩 중복 (target 무관, 기존 결함) | `spec/5-system/6-websocket-protocol.md` L378 vs L747 (사이에 `### 4.3`이 순서를 벗어나 끼어 있음) | target 스코프 밖. 별도 spec-doc 정리 항목으로만 기록 권장 (WS 문서 재넘버링은 이번 draft 원칙과 무관) |
| 2 | Rationale Continuity | WS §4.4 Rationale(PR #945)이 앵커로 삼는 "EIA §6.2 blockquote" 서술이 target 의 §6 도입부 승격 이후에도 정확히 성립하는지 편집 실행 시 재확인 필요 | target `## 결정 (2)`, 근거: `spec/5-system/6-websocket-protocol.md` `## Rationale` "§4.4 wire 필드 caveat" | target 실행 체크리스트(§6.2 blockquote 이관 항목)에 "이관 후에도 앵커가 정확한 위치를 가리키는지 확인" 한 줄 추가. 필요시 WS Rationale 문구를 "EIA §6 도입부 + §6.2 blockquote"로 소폭 갱신 |
| 3 | Convention Compliance | `redis-keys.md` §1 인용이 인용부호(직접 인용 형식)를 쓰면서 주어를 "본 문서는"→"인벤토리는"으로 paraphrase | target `## 왜` 절 인용구 | 원문 그대로 인용하거나 인용부호를 벗겨 paraphrase 임을 명확히. 의미 왜곡 없어 반려 사유 아님 |
| 4 | Plan Coherence | `retry-turn-terminal-guard.md` #2(`cancelledBy` 추가)가 target 을 역참조하지 않음 — 구현자가 "spec §4.1"만 보고 target 이 이관하는 새 SoT(EIA §6 도입부)를 놓칠 여지 | target 위치: `## 후속 (developer)` 마지막 항목 / 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md` §"코드" 표 #2 | `retry-turn-terminal-guard.md` #2 항목에 "EIA 쪽 정본은 §6 도입부 — target draft 머지 후 확인" 역포인터 한 줄 추가 |
| 5 | Plan Coherence | `node-output-redesign/README.md:372` 의 EIA cross-ref 가 이미 잘못된 절 번호(§6.3, 실제는 §6.4 `execution.failed`)를 가리키고 있었음 — target 리라이트 이전부터 존재하던 결함 | `plan/in-progress/node-output-redesign/README.md:372` | 재검증 시 "성격이 바뀌었는지"뿐 아니라 절 번호(§6.3→§6.4) 자체도 정정 대상에 포함 |
| 6 | Naming Collision | target 이 문서화하는 webhook 봉투 최상위 키 `payload` 가 같은 spec 문서 §5 의 REST 응답 `data` 봉투와 "봉투"라는 용어를 개념적으로 공유(문자열 자체는 다름, 충돌 아님) | `spec/5-system/14-external-interaction-api.md` §5(L265, L273) vs target 이 문서화하는 §6 webhook 봉투 | §6 도입부에 "REST 응답의 `data` 봉투(§5)와는 별개"라는 구분 문구 한 줄 추가 |
| 7 | Naming Collision | target frontmatter `worktree: eia-r8-cache-scope-4ae434` 의 슬러그("r8 cache scope")가 가리키는 주제(`spec-draft-eia-r8-alignment.md`, §R8 idempotency 캐시)와 target 실제 주제(종결 이벤트 payload 계약)가 무관 — 식별자 충돌은 아님 | target frontmatter | orchestrator/plan-lifecycle 관점 참고사항. 6개 점검 관점 밖이라 등급 부여 보류 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 필드 잔여 참조·"line 536" 6곳·"3-wire" 주장·선례 인용·§6 도입부 삽입 위치·데이터 모델 전수 검증 — 잔여 충돌 없음. WS 문서 기존 `### 4.4` 중복은 target 무관 INFO |
| Rationale Continuity | NONE | WS PR #945·EIA R3/R10/R14/R16/R19·chat-channel-adapter R3·redis-keys.md 인용 전수 원문·git 대조 — 왜곡·기각 대안 재도입 없음. §6.2 blockquote 앵커 재확인만 INFO |
| Convention Compliance | NONE | 파일 명명·frontmatter 스키마·spec-impl-evidence `partial`/`pending_plans` 정합·에러코드 명명·닫힌 union 비확장·"부재=키 생략" 전부 준수. redis-keys.md 인용 paraphrase만 INFO |
| Plan Coherence | LOW | 미해결 결정 정면 충돌·선행 plan 미해소·후속 누락 없음. retry-turn-terminal-guard #2 역포인터 부재, node-output-redesign 기존 절번호 오류(target 이전부터 존재) 2건 INFO |
| Naming Collision | NONE | 요구사항 ID·엔티티/타입·API endpoint·이벤트명·ENV키·파일경로 신규 발급 없음. `payload` vs `data` 봉투 개념적 인접, worktree 슬러그-주제 불일치 2건 INFO |

## 권장 조치사항

1. (BLOCK 없음 — 선택적 보강) `retry-turn-terminal-guard.md` #2 항목에 target §6 도입부를
   가리키는 역포인터 한 줄 추가 (Plan Coherence #4).
2. (선택적 보강) `node-output-redesign/README.md:372` 재검증 시 §6.3→§6.4 절 번호 정정도 함께
   포함 (Plan Coherence #5).
3. (선택적 보강) target 실행 시 §6.2 blockquote 이관 체크리스트에 WS Rationale 앵커 정확성 확인
   한 줄 추가 (Rationale Continuity #2).
4. (선택적, 사소) `redis-keys.md` 인용부호 안 문구를 원문 그대로로 맞추거나 paraphrase 임을
   명확히 (Convention Compliance #3).
5. (선택적) §6 도입부 신설 시 "REST `data` 봉투(§5)와는 별개"라는 구분 문구 한 줄 추가
   (Naming Collision #6).
6. 위 5건 모두 낮은 비용·낮은 위험의 선택적 보강이며 target 진행에 지장 없음 — 이번 PR 진행
   가능.
