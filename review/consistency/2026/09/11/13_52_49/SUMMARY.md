# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**LOW** — CRITICAL 없음. `AUTH_CONFIG_NOT_FOUND` 의 `*_NOT_FOUND`=404 명명 관례 이탈(문서화 누락)과 결정 라벨 네임스페이스 3회 재발(구조적 미해결)이 WARNING 2건, 나머지는 근거 정확도·순서·범위 표기 관련 INFO.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance, naming_collision | 신규 등재 `AUTH_CONFIG_NOT_FOUND` 가 `3-error-handling.md` 의 `*_NOT_FOUND`→404 관례(8/8, 그리고 `MODEL_CONFIG_NOT_FOUND`/`MODEL_CONFIG_DEFAULT_MISSING` 을 이미 이 이유로 분리한 선례)를 깨고 400(`BadRequestException`, `assertAuthConfigInWorkspace`)으로 등재되는데 그 이탈을 문서에 밝히지 않는다 | "결정 3"/"변경안 3" (`3-error-handling.md` 신규 `§1.11`) | `3-error-handling.md` §1.3/§1.6/§1.9 의 `*_NOT_FOUND`=404 전수 선례 + `MODEL_CONFIG_NOT_FOUND`/`MODEL_CONFIG_DEFAULT_MISSING` 분리 Rationale(L605-610) | 신설 `§1.11` 행에 `status: 400` 명시 + 캡션 한 줄 추가(예: "cross-workspace 참조 검증은 입력값 유효성 문제로 취급해 400 — 이름은 NOT_FOUND 이나 다른 `*_NOT_FOUND` 코드와 달리 404 가 아니다"). 코드 되돌리기는 target 이 이미 기각했으므로 문서 쪽 캡션만으로 해소 |
| 2 | convention_compliance | 결정 라벨 네임스페이스 충돌이 `D-*`→`CV-*`→`DEC-*` 로 "세 번째 재발"이라고 target 스스로 진단하면서도, 매번 "라벨을 안 쓴다"는 국소 회피만 반복하고 구조적 해결(예약 접두사 레지스트리 등 정식 규약화)로 승격하지 않는다 | "결정" 섹션 상단 메타 코멘트 | CLAUDE.md "정식 규약은 `spec/conventions/<name>.md`" 원칙의 정신 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "결정 라벨 네임스페이스 3회 충돌 — 예약 접두사 레지스트리/짧은 규약 문서 신설 검토" 항목을 추가해 흔적을 남길 것 (이번 PR 범위에서 규약 문서 신설까지는 불요) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity, naming_collision | "결정" 절 상단이 `D-3`·`D-9` 를 `15-chat-channel.md` 자체의 독립 결정 라벨로 오인용 — 실제로는 `R-D-3`/`R-D-9`(discord.md 소속 Rationale ID)의 하이픈-포함 부분 문자열이며, 이 문서의 실재 독립 라벨은 `D-1`·`D-2` 뿐(2개). 결론(신규 라벨 미도입)은 `D-1`/`D-2` 만으로도 충분히 정당화되어 영향 없음 | `plan/in-progress/spec-draft-details-code-landed.md` "## 결정" 절 서두 | `D-3`·`D-9` 언급을 삭제하거나 "`R-D-3`/`R-D-9` 는 별개 네임스페이스" 로 정정 |
| 2 | cross_spec | 신설 `§1.11` 은 top-level 특화 코드이므로 §1.10(세부코드 표) 이 아니라 §1.9(top-level 코드 표: 코드\|status\|설명\|도메인 SoT) 형태를 따라야 함 — target 문서가 이 구분을 명시하지 않아 집행 단계에서 §1.10 을 복제하면 형태가 어긋날 수 있음 | 변경안 3 실행 지침 | §1.9 표 형태를 명시적으로 지목 |
| 3 | convention_compliance | 결정 5(botToken 형식 정정)가 같은 spec_impact 파일 `15-chat-channel.md §4.1` JSON 예시의 유사 인라인 주석(`\d+:[A-Za-z0-9_-]+`, 하한 없는 느슨한 형식)은 건드리지 않아 "이 턴에 하지 않는 것" 목록에도 안 올라 누락처럼 보임 | 변경안 5 vs `15-chat-channel.md §4.1` | "이 턴에 하지 않는 것" 목록에 명시적으로 추가하거나 가벼운 캡션 정정 |
| 4 | convention_compliance | 변경안 표 순서(1a→1b→1c)가 `15-chat-channel.md` 실제 물리적 섹션 순서(§5.4.1→§5.4.1.2→§5.4.1.1, 391/418행)와 반대 — 표 순서대로 편집하면 문서를 두 번 오감 | 변경안 표 1a/1b/1c | 표 순서를 실제 문서 순서로 재배열하거나 각주로 유의사항 명시 (역순 배치 자체는 선행 PR 산물이라 근본 수정은 범위 밖) |
| 5 | plan_coherence | 이번 실행의 자동 plan corpus 가 0건 로드(63개 전부 생략) — 기지 harness 갭(`harness-review-gate-followups.md`) 재현. 수동 Read/grep 으로 우회했으나 다음 자동 실행도 같은 우회를 보장하지 않음 | 검토 프로세스 자체 (target 내용과 무관) | target 은 수정 불요. 실행 시 `_prompts/plan_coherence.md` 로드 여부 확인을 권장(신규 결정 사안 아님) |
| 6 | plan_coherence | 변경안 4a·4b (`spec/4-nodes/7-trigger/providers/{slack,discord}.md`) 와 developer 트래커 항목 (f)(`codebase/frontend/.../providers/{slack,discord,telegram}{,.en}.mdx` 6파일)가 "provider 문서의 details.code 표기" 라는 유사 표현을 써 다음 편집자가 혼동할 여지(실제 충돌은 없음 — spec/ vs codebase/frontend 완전히 다른 파일 집합) | 변경안 4a·4b | 트래커 종결 항목 옆에 "developer 트래커 (f) 의 user-guide MDX 와는 별개" 한 줄 첨언 (선택적, 비차단) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 결정 1~5 모두 실측 근거 정확·기존 규칙과 additive 정합. `D-3`/`D-9` 인용 오류만 INFO |
| rationale_continuity | NONE | 5개 결정 전부 과거 Rationale(R-CC-10/21, R-2/12/14, §5.3) 위반·번복 없음. 결정 2 는 대안을 근거와 함께 명시적으로 기각한 정상 사례 |
| convention_compliance | LOW | `AUTH_CONFIG_NOT_FOUND` 명명 관례 이탈 미문서화, 라벨 네임스페이스 3회 재발 구조적 미해결 (WARNING 2건) + botToken 잔여 서술·표 순서 (INFO 2건) |
| plan_coherence | NONE | target 의 5개 결정이 트래커 4개 체크리스트 항목을 정확히 승계. 자동 corpus 0건 로드는 프로세스 갭(INFO) |
| naming_collision | LOW | `§1.11`/`AUTH_CONFIG_NOT_FOUND` 는 신규 충돌 없음(문자열 자체는 유일 사용처). 다만 `*_NOT_FOUND`=404 관례 위반은 WARNING. `D-3`/`D-9` 인용은 INFO |

## 권장 조치사항
1. (WARNING #1) `§1.11` 등재 문구에 `status: 400` + 캡션 한 줄을 추가해 `AUTH_CONFIG_NOT_FOUND` 가 `*_NOT_FOUND`=404 관례의 예외임을 명시.
2. (WARNING #2) `spec-draft-nullable-notation-followups.md` 에 "결정 라벨 네임스페이스 3회 충돌 — 구조적 해결 검토" 항목 추가.
3. (INFO #1) "## 결정" 절 서두의 `D-3`·`D-9` 인용을 `R-D-3`/`R-D-9` 로 정정하거나 삭제.
4. (INFO #2) 변경안 3 실행 시 §1.9 표 형태(top-level 코드)를 따르도록 명시.
5. (INFO #3, #4, #6) 선택적 보강 — 급하지 않음.
