# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 결과 확보(전문 인라인 확보, `convention_compliance.md` 는 디스크 누락을 확인해 인라인 전문을 그대로 영속화함). Critical 위배 없음.

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 3건(자매 plan 미검증 전제·좌표계 표 staleness 위험·`code:` frontmatter exhaustive-consumer 스타일 이탈)이 최고 등급이며, 모두 신설 문서 자체를 막을 사유는 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `code:` frontmatter 4파일이 정의처만 담아, 문서가 직접 경고하는 두 스캐너 함수(backend `hasMaskedLeaf`, frontend `hasMaskedMarkerLeaf`)의 정의 파일이 증거 목록 밖에 남는다 — 스스로 인용한 `node-cancellation.md` 의 exhaustive-consumer `code:` 스타일과 어긋남 | 작업 체크리스트 2번째 항목 (`code:` 4파일 지정) | `spec/conventions/node-cancellation.md` (exhaustive consumer 등재 선례) | `code:` 에 `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 와 `codebase/frontend/src/lib/utils/masked-markers.ts` 추가(최소 좌표계 표 5행 인용 파일 전부 등재). 정의처만 남기는 것이 의도라면 그 기준을 문서에 한 줄 명시 |
| 2 | plan_coherence | "마스킹은 한 번 — 그 뒤 단계는 마커를 덮지 않는다" 규율을 확정형으로 명문화하지만, 근거가 `toFanoutEnvelope` 호출 순서 하나뿐이고 `TerminalErrorPayload` 전수 경유 확인은 자매 plan 에 아직 미완료(`[ ]`)로 남아 있다 | "마스킹은 한 번" 섹션(줄 136~148), "소유한다" 목록 3번 | `plan/in-progress/ws-event-types-extract.md` `## 후속(이 PR 범위 밖) > ### 그 밖` 미체크 항목 (`TerminalErrorPayload` 채우는 호출부의 `sanitizeErrorMessage` 경유 여부 전수 확인) | (a) target 작업 항목에 위 전수 확인을 선행 조건으로 명시, 또는 (b) "이 순서 계약은 `toFanoutEnvelope` 경로에 한정해 확인됐다" 는 범위 caveat 를 문서에 추가 |
| 3 | plan_coherence | 좌표계 표를 "심볼 기준으로 고정"하겠다고 선언하지만, 정본 트래커에 이미 등재된 통합 작업(W4)이 실행되면 표가 가리키는 개별 호출부 심볼이 단일 헬퍼로 흡수돼 stale 해질 수 있는데도 target 이 이 구체적 트리거를 언급하지 않는다 | "실측한 좌표계" 표 2·5행, `## 작업` 체크리스트 신설 문서 항목 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 미체크 항목 `[ ] inputData 마스킹 게이트 4곳을 단일 헬퍼로 통합 (2026-08-20 등재, 14_44_08 W4)` | target 신설 문서 또는 W4 항목 어느 한쪽에 상호 참조를 남겨, W4 착수 시 좌표계 표(특히 5행 호출부 열) 동반 갱신을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "마커 리터럴을 적지 않는다" 원칙이 target 이 SoT 로 지목한 EIA §R17 자체의 관행(마커 리터럴·에러 코드를 정상 인용)과 대비돼 독자 혼동 가능 | 본문 81~84행 | 신설 문서에 "EIA §R17 은 wire 계약 서술이라 리터럴이 정상, 본 문서는 내부 좌표계만 다루므로 이름을 쓴다" 한 줄 추가(필수 아님) |
| 2 | cross_spec | `code:` 4파일이 이미 다른 3개 spec 문서와 중복 소유 — 저장소 기존 관행과 일치, build gate 영향 없음 | `## 작업` 133~138행 | 조치 불요 |
| 3 | rationale_continuity | "기계 검사 repo-guard" 기각 근거가 spec `## Rationale` 이 아니라 plan/harness 설계 결정 문서에서 원용한 유비 | "## Rationale > 기각한 대안" 4번째 항목 | 신설 문서로 옮길 때 "(harness CI 가드 설계 결정에서 원용한 유비)" 출처 성격 명시 |
| 4 | convention_compliance | `--spec` 예산 절단으로 `conversation-thread.md`·`spec-impl-evidence.md` 등 일부 conventions 본문이 이번 검토 입력에서 생략(기지 패턴) — checker 가 직접 읽어 보완 검증, 모순 없음 | N/A (입력 한계) | 조치 불요 |
| 5 | convention_compliance | `id`/파일명/frontmatter 패턴(`id: egress-masking`, `status: implemented`, `code:` 4파일 실재, §Overview/본문/§Rationale 구조)이 기존 conventions 와 완전히 일치함을 확인 | frontmatter 계획 전체 | 조치 불요 (긍정 확인) |
| 6 | naming_collision | "egress" 라는 단어가 값-패턴 마스킹(target)과 네트워크 egress 방화벽(SSRF, `http-request.md`)이라는 서로 다른 두 도메인에 공존 — 현재는 항상 복합어로 구분돼 실질 혼동 없음 | 문서 제목/주제어 | Overview 에 "네트워크 egress 방화벽과 무관" 1문장 콜아웃 추가 시 미래 검색 혼동 감소(필수 아님) |
| 7 | naming_collision | `spec-code-paths` 가드 대상 4개 경로 전부 worktree 에서 실재 확인, `spec-code-paths.test.ts` 통과 예상 | frontmatter `code:` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 좌표계 표(값·연산자·소비처·호출부)를 코드와 줄 단위 대조해 전부 일치 확인. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 축 직접 모순 없음. INFO 2건(마커 리터럴 관행 대비, `code:` 중복 소유)만 발견 |
| Rationale Continuity | NONE | 직전 라운드(`18_14_45`) CRITICAL(좌표계 표 값 `1`↔`10` 오기재) 정정 확인. "기각한 대안" 4건 모두 실제 소스와 라인 단위 일치, 기존 invariant(마스킹-once·strip-only·SoT 분리 선례) 우회 없음. INFO 1건(기각 근거 출처 성격) |
| Convention Compliance | LOW | frontmatter 스키마·3섹션 구조·"비대상" 카브아웃 표기가 기존 conventions 와 동형. WARNING 1건(`code:` exhaustive-consumer 스타일 이탈), INFO 2건(예산 절단·패턴 일치 긍정 확인) |
| Plan Coherence | LOW | 정본 트래커의 "신설 여부 planner 판단" 항목을 정확히 처분, 미해결 결정 우회 없음. WARNING 2건(미검증 전제 위 확정형 규율, 자매 plan W4 로 인한 표 staleness 위험) |
| Naming Collision | NONE | 신규 발행 식별자(`id: egress-masking`, 파일 경로)만 확인 필요했고 `spec/conventions/**` 전수 검색 결과 충돌 없음. 코드 심볼·에러 코드·EIA §R17 참조는 전부 재인용(재정의 아님), 값·연산자까지 코드와 일치. INFO 2건(bare word "egress" 이중 의미, 경로 실재 확인) |

## 권장 조치사항
1. (WARNING #2) `ws-event-types-extract.md` 의 `TerminalErrorPayload`/`sanitizeErrorMessage` 전수 확인 항목을 target 의 선행 조건으로 명시하거나, "마스킹은 한 번" 규율에 `toFanoutEnvelope` 경로 한정 caveat 를 추가한다.
2. (WARNING #3) `spec-sync-external-interaction-api-gaps.md` W4(`inputData` 마스킹 게이트 단일 헬퍼 통합) 항목과 신설 `egress-masking.md` 좌표계 표 사이에 상호 참조를 남겨, W4 착수 시 표(특히 소비처 열) 동반 갱신을 명시한다.
3. (WARNING #1) `code:` frontmatter 에 `reject-masked-resubmission.ts`(`hasMaskedLeaf`)와 `frontend/src/lib/utils/masked-markers.ts`(`hasMaskedMarkerLeaf`)를 추가하거나, 정의처만 남기는 선정 기준을 문서에 명시한다.
4. (선택) INFO 항목 중 "마커 리터럴 관행 대비" 콜아웃과 "네트워크 egress 방화벽과 무관" 콜아웃을 Overview 에 한 줄씩 추가하면 향후 독자 혼동을 예방한다.