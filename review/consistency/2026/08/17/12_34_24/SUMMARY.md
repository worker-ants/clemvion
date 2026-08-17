# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음.

대상: `spec/5-system/` (EIA masking round2, `--impl-done`, diff-base=`origin/main`). 5개 checker
(Cross-Spec · Rationale Continuity · Convention Compliance · Plan Coherence · Naming Collision)
전원 전문 확보(`plan_coherence.md` 는 `no_status` 였으나 인라인 전문이 제공되어 그대로
`review/consistency/2026/08/17/12_34_24/plan_coherence.md` 에 영속화 완료) — 재시도 필요 항목 없음.

## 전체 위험도
**LOW** — Critical/모순 없음. WARNING 1건(spec frontmatter `code:` 증거 목록 누락)과 INFO 다수만
발견. 이번 diff(폼 `defaultValue` 프리필 왕복 오염 차단 — 마커 상수 재배치, frontend 가드 신설,
§R17 "프리필 왕복" 문단)는 데이터 모델·API 계약·요구사항 ID·명명 규약·plan 트래커 정합성
어디에서도 충돌을 만들지 않는다.

## Critical 위배 (BLOCK 사유)

없음.

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | frontmatter `code:` 가 §R17 이 새로 SoT/가드로 지목한 구현 표면 2곳(`sanitize-error-message.ts`, `dynamic-form-ui.tsx`) 미등재 — `spec-impl-evidence.md` 취지 약화(build 가드는 통과, R-1 의 알려진 글로브 사각지대) | `spec/5-system/14-external-interaction-api.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md` §2.1 / 기존 개별-등재 관행(`redact-stored-error.ts` 등) | `code:` 에 `codebase/backend/src/shared/utils/sanitize-error-message.ts`, `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` 두 항목 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | channel-web-chat 위젯 `DynamicForm` 은 애초에 `defaultValue` 를 프리필하지 않아 왕복 오염 자체가 불성립(모순 아님, 별도 기능 갭 가능성만 기록) | `codebase/channel-web-chat/src/widget/components/dynamic-form.tsx` | 조치 불요 |
| 2 | Cross-Spec | `spec/4-nodes/6-presentation/4-form.md`(Form 노드 정의)에 EIA §R17 마스킹/프리필-스킵 정책으로의 역참조 없음 | `spec/4-nodes/6-presentation/4-form.md` | 저비용 discoverability 개선 여지, 필수 아님 |
| 3 | Cross-Spec | `13-replay-rerun.md` §10.2 Re-run 프리필 왕복(OFF)이 §R17 "닫는 조건" 미완 서술과 정합 | `spec/5-system/13-replay-rerun.md` §10.2 | 조치 불요, 후속 확장 시 트래커 참조 |
| 4 | Rationale Continuity | Rationale(§R17)과 코드가 같은 커밋에서 동반 갱신 — 모범 사례 | `dynamic-form-ui.tsx` / §R17 "프리필 왕복" | 조치 불요 |
| 5 | Rationale Continuity | 마커 명칭·"정확 일치만 잡는다" 경계가 backend SoT·`DEFAULT_FILE_*` 관용구와 정확히 일치(직접 대조 확인) | `dynamic-form-ui.tsx` `MASKED_MARKERS`/`isMaskedMarker` | 조치 불요 |
| 6 | Rationale Continuity | 리뷰 이력 인용(`12_06_12`)이 실재 세션과 일치 — 지어낸 이력 아님 | 테스트 주석 / 커밋 메시지 | 조치 불요 |
| 7 | Convention Compliance | "카브아웃" vs "carve-out" 표기 혼용 — 신규 불릿 2곳만 영문 표기 | `spec/5-system/14-external-interaction-api.md` §R17 (1562/1567행) | 신규 불릿을 "카브아웃"으로 통일 |
| 8 | Convention Compliance | `nodeName`→`nodeLabel` 정정은 실제 코드(`chat-channel.dispatcher.ts`)와 일치 — 정당한 수정 | `spec/5-system/15-chat-channel.md` R-CC-15 | 조치 불요 |
| 9 | Plan Coherence | 체크박스는 `[x]` 로 완료 반영됐으나 옆 "이연 사유" blockquote 가 과거 문구 그대로 잔존(4번째 재발 패턴, 판정 영향 없음) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:293-299` | blockquote 끝에 "round2 PR(2026-08-17)에서 함께 처리됨" 한 줄 추가 |
| 10 | Naming Collision | `MASKED_MARKERS`/`isMaskedMarker` backend·frontend 동명 정의는 module boundary 상 충돌 불가능한 의도된 미러(주석에 명시) | `dynamic-form-ui.tsx` ↔ `sanitize-error-message.ts` | 조치 불요, backend JSDoc 경고 유지로 충분 |
| 11 | Naming Collision | i18n 키 `formMaskedDefaultHint` — en/ko 동시 추가, 기존 `form*` prefix 컨벤션 정합 | `dict/{en,ko}/editor.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | §R17 신설분과 인접 spec(데이터모델·WS·Re-run·webhook·Form노드·위젯) 대조 — 충돌 없음. 위젯 prefill 부재 등 참고사항만 |
| Rationale Continuity | NONE | Rationale-코드 동반 갱신, 마커 명명·경계가 backend SoT/기존 관용구와 정합, 리뷰 이력 인용 사실 확인 |
| Convention Compliance | LOW | WARNING 1건(frontmatter `code:` 증거 누락) + 표기 혼용 INFO 1건 |
| Plan Coherence | LOW | 트래커 stale 산문(완료 체크박스 옆 구 이연사유) 1건, 그 외 전 축 정합 |
| Naming Collision | NONE | 신규 식별자 3개(`MASKED_MARKERS`/`isMaskedMarker`/`formMaskedDefaultHint`) 전부 충돌 없음, 의도된 미러 확인 |

## 권장 조치사항
1. (WARNING 해소) `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 에
   `codebase/backend/src/shared/utils/sanitize-error-message.ts`,
   `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` 추가.
2. (선택, 저비용) 같은 문서 §R17 신규 불릿의 "carve-out" 표기를 "카브아웃"으로 통일.
3. (선택, 저비용) `plan/in-progress/spec-sync-external-interaction-api-gaps.md:293-299` 의
   "이연 사유" blockquote 에 완료 처리 시점 한 줄 추가.
4. BLOCK 사유 없음 — push/merge 진행 가능.
