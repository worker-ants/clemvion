# Consistency Check 통합 보고서

**BLOCK: NO** — 수집된 4개 checker 결과에 Critical 발견 없음. 단, `plan_coherence` checker 는 `status=success` 로
보고됐으나 output 파일(`plan_coherence.md`)이 디스크에 실제로 존재하지 않아(재시도 필요) 그 관점(plan 정합성)은
**이번 통합 보고서에 반영되지 못했다** — 아래 참고.

## 전체 위험도
**LOW** — 실질 target diff(`40a375972`, disclaimer 문구 해요체 통일 3줄)는 4개 checker 전원 NONE/LOW 로 정합
확인. `plan_coherence` 결과 누락이 유일한 절차적 공백.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `endpointPath` 비밀성 서술이 문서마다 "사실상 비밀 키" vs "비밀 아님"으로 다른 형용사 사용(실질 결론·RBAC·API 동작은 동일, 표현상 nuance) | `spec/7-channel-web-chat/3-auth-session.md §1` vs `5-admin-console.md §7` (충돌 대상: `spec/2-navigation/2-trigger-list.md` R-15 "capability token") | `3-auth-session.md §1` 문구 옆에 `5-admin-console §7`/trigger-list R-15 상호 링크 추가해 "엔트로피 방어(비밀 키) ≠ 워크스페이스 내부 RBAC 상 비공개 아님" 두 축 명시 (비차단) |
| 2 | convention_compliance | 잔존 합쇼체 disclaimer fixture 1건(사용자 비가시, footer 렌더 검증용 테스트 문자열) — 이번 diff 스코프 밖 | `codebase/channel-web-chat/src/widget/widget-app.test.tsx:44` (`"AI는 한정된 데이터로 동작합니다."`) | 선택적으로 canonical 해요체 문구로 교체 가능하나 테스트 의미 영향 없어 후속으로 미뤄도 무방. 반복 지적 방지를 원하면 `i18n-userguide.md §적용 범위`에 "테스트 fixture 문자열 제외" 명문화 검토 |
| 3 | convention_compliance | `4-security.md` frontmatter `code:` 가 가리키는 `embed-config.dto.ts`(swagger.md §5-1 `*-response.dto.ts` 패턴과 다르게 보임) — 이번 진단 대상 아님, 별도 병렬 세션(origin/main PR #926)이 이미 `embed-config-response.dto.ts` 로 정정 완료. 현재 워크트리는 그 커밋을 병합받지 않은 fork 상태일 뿐 self-consistent | `spec/7-channel-web-chat/4-security.md` frontmatter | 조치 불요 — 리베이스/머지 시 자동 해소 |
| 4 | (절차) | `plan_coherence` checker 가 `status=success` 로 보고됐으나 `<session_dir>/plan_coherence.md` 파일이 디스크에 없음 (disk-write gap) | `review/consistency/2026/07/12/12_26_01/plan_coherence.md` (부재) | `plan_coherence` checker 단독 재실행 후 본 SUMMARY 갱신 필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | EIA/Webhook/Execution Engine/Conversation Thread/Interaction Type Registry/데이터모델/Navigation/i18n/Presentation 전 접점 실측 대조 — 모순 없음. `endpointPath` 비밀성 형용사 표현 불일치만 INFO |
| rationale_continuity | NONE | disclaimer 문구 해요체 통일은 기각된 대안 재도입·원칙 위반·무근거 번복·invariant 우회 어디에도 해당 안 됨. 오히려 i18n-userguide P6 을 사후 준수한 정합화 |
| convention_compliance | NONE | 해요체 통일 diff 는 i18n-userguide §Principle 6 정확히 준수. 잔존 test fixture 1건·DTO 파일명(별건, 이미 해소)만 INFO |
| plan_coherence | **재시도 필요** | output 파일 누락(disk-write gap) — 결과 미확보 |
| naming_collision | NONE | 신규 식별자(요구사항 ID/엔티티·DTO/API endpoint/이벤트명/ENV키/파일경로) 도입 없음 — 기존 `disclaimer` 필드 문자열 값 교체뿐 |

## 권장 조치사항
1. `plan_coherence` checker 를 단독 재실행해 output 파일을 확보하고 본 SUMMARY 를 갱신할 것 (BLOCK 판정 자체는 현재 4/5 결과 기준 NO 이나, plan 정합성 관점이 아직 커버되지 않았음).
2. (선택, 비차단) `3-auth-session.md §1` 에 `5-admin-console §7`/trigger-list R-15 상호 링크 추가.
3. (선택, 비차단) `widget-app.test.tsx:44` 합쇼체 fixture 정합 또는 i18n-userguide 스코프 명문화.

---

## 검증 노트 (main Claude, 후속)

`plan_coherence` 의 디스크 출력 부재(Workflow disk-write 갭)는 **재실행 없이 journal.jsonl 복구로 해소**했다. 반환 전문 확인 결과 **위험도 NONE** (INFO 2건, 모두 "조치 불요"): (1) diff-base 가 fork-point 보다 앞서 reverse-diff 오염 소지 → fork-point `84b1ea635` 기준 실제 diff 는 disclaimer 문구뿐임을 재확인, (2) 오케스트레이터 plan 번들에 web-chat 직접연관 plan 3개 누락됐으나 직접 열람 대조 시 target 서술과 **정합**(carousel 배너·replay_unavailable no-op 후속 문구 일치). 따라서 **5/5 checker 확보 완료**, 통합 판정 **BLOCK: NO** 는 신뢰 가능하다.
